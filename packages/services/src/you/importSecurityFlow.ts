// YOU platform service — import security scan / quarantine / release /
// admission flow (W10A). The ops live here; platformService.ts is the
// single authority that dispatches into them (the W1A/W8A flow
// precedent).
//
// THE IMPORT SECURITY LAW (docs/you/CONTRACTS.md wave-10): unscanned
// imports never enter evidence; quarantine is fail-closed and reversible
// only through an explicit release record (YOU_IMPORT_QUARANTINED).
//
// Every op gates through the rate limiter FIRST (its canonical scope —
// enforcement-before-effect by construction); an exceeded budget
// returns the typed error and the scan/admission/release NEVER runs.
// The scan applies the shared deterministic verdict rule (any high
// finding rejects; any medium finding quarantines; otherwise clean).
// Quarantine birth and the explicit release ride the frozen
// `import-quarantined` event (the wave's only import event — the W7A
// ride-along precedent: the event carries phase "quarantined" |
// "released"); clean and rejected verdicts are pre-admission service
// state (the arena provider precedent) and materialize in the ledger
// only through their quarantine-class facts.
//
// Admission is fail-closed: unscanned, quarantined and rejected imports
// all refuse with the typed YOU_IMPORT_QUARANTINED (distinct stable
// reasons); only clean and released imports enter evidence. Release
// exists ONLY for quarantined imports (an explicit release record per
// the law); rejected is terminal; clean needs no release.

import type { ImportSecurityVerdict, OpaqueId } from "@zcode/shared";
import {
  constructImportReleaseRecord,
  constructImportSecurityVerdict,
  evaluateImportScanVerdict,
  importAdmissionDecision,
  validateImportReleaseInput,
  validateImportScanInput,
  type ImportQuarantineStatus,
  type ImportReleaseInput,
  type ImportReleaseRecord,
  type ImportScanInput,
} from "../../../shared/src/you/importSecurity.js";
import { appendImportQuarantined } from "./platformLedgerOps.js";
import { gateRateLimitOp } from "./rateLimitFlow.js";
import {
  platformFailure,
  type PlatformFlowDeps,
  type PlatformPlaneRecord,
  type PlatformServiceResult,
} from "./platformServiceTypes.js";

/** The canonical gate scope for scans (enforcement-before-effect). */
export const IMPORT_SCAN_GATE_SCOPE = "import:scan";
/** The canonical gate scope for admissions. */
export const IMPORT_ADMIT_GATE_SCOPE = "import:admit";
/** The canonical gate scope for releases. */
export const IMPORT_RELEASE_GATE_SCOPE = "import:release";

/**
 * Scans an import and records its verdict (the deterministic rule; the
 * verdict becomes the artifact's head). A QUARANTINED verdict emits the
 * `import-quarantined` event (phase "quarantined") — the fail-closed
// quarantine birth. Refusals: the rate-limit gate (typed
 * YOU_RATE_LIMIT_EXCEEDED — the scan never runs), typed
 * YOU_INVALID_STATE for scan intake shape.
 */
export function scanImportOp(
  plane: PlatformPlaneRecord,
  deps: PlatformFlowDeps,
  input: ImportScanInput,
): PlatformServiceResult<{ readonly verdict: ImportSecurityVerdict }> {
  const gate = gateRateLimitOp(plane, deps, IMPORT_SCAN_GATE_SCOPE, input.artifactRef);
  if (!gate.ok) {
    return gate;
  }
  const refusal = validateImportScanInput(input);
  if (refusal !== null) {
    return platformFailure("YOU_INVALID_STATE", `import scan refused: ${refusal.detail}`, {
      reason: refusal.reason,
      artifactRef: input.artifactRef,
    });
  }
  // An artifactRef is scanned exactly once (the verdict is immutable and
  // content-addressed; a re-scan of the same ref is a typed refusal —
  // the fold's per-artifact lifecycle stays single-valued).
  if (plane.importVerdicts.has(input.artifactRef)) {
    return platformFailure("YOU_INVALID_STATE", "import scan refused: the artifact is already scanned", {
      reason: "already-scanned",
      artifactRef: input.artifactRef,
    });
  }
  const verdictKind = evaluateImportScanVerdict(input.findings);
  const quarantinedAt = verdictKind === "quarantined" ? deps.clock.now() : null;
  const constructed = constructImportSecurityVerdict({
    id: deps.ids.next("import-verdict"),
    artifactRef: input.artifactRef,
    scanClass: input.scanClass,
    verdict: verdictKind,
    quarantinedAt,
  });
  if (!constructed.ok) {
    return platformFailure("YOU_INVALID_STATE", `import scan refused: ${constructed.refusal.detail}`, {
      reason: constructed.refusal.reason,
      artifactRef: input.artifactRef,
    });
  }
  plane.importVerdicts.set(input.artifactRef, constructed.verdict);
  plane.importFindings.set(input.artifactRef, Object.freeze([...input.findings]));
  plane.importStatuses.set(input.artifactRef, verdictKind);
  if (verdictKind === "quarantined") {
    appendImportQuarantined(plane, {
      phase: "quarantined",
      verdict: constructed.verdict,
      findings: input.findings,
    });
  }
  return { ok: true, value: { verdict: constructed.verdict } };
}

/**
 * Releases a QUARANTINED import through an explicit release record (the
 * ONLY path out of quarantine — the IMPORT SECURITY LAW). Emits the
 * `import-quarantined` event with phase "released" carrying the release
 * record facts. Refusals: the rate-limit gate, typed
 * YOU_IMPORT_QUARANTINED for lifecycle violations (unscanned import,
 * not quarantined, rejected terminal).
 */
export function releaseQuarantinedImportOp(
  plane: PlatformPlaneRecord,
  deps: PlatformFlowDeps,
  artifactRef: OpaqueId,
  input: ImportReleaseInput,
): PlatformServiceResult<{ readonly release: ImportReleaseRecord }> {
  const gate = gateRateLimitOp(plane, deps, IMPORT_RELEASE_GATE_SCOPE, artifactRef);
  if (!gate.ok) {
    return gate;
  }
  const status = plane.importStatuses.get(artifactRef) ?? null;
  if (status === null) {
    return platformFailure("YOU_IMPORT_QUARANTINED", "unscanned import cannot be released", {
      reason: "unscanned-import",
      artifactRef,
    });
  }
  if (status === "rejected") {
    return platformFailure("YOU_IMPORT_QUARANTINED", "a rejected import is terminal (no release path)", {
      reason: "rejected-terminal",
      artifactRef,
    });
  }
  if (status !== "quarantined") {
    return platformFailure("YOU_IMPORT_QUARANTINED", "only a quarantined import is releasable", {
      reason: "not-quarantined",
      artifactRef,
      status,
    });
  }
  const intake = validateImportReleaseInput(input);
  if (intake !== null) {
    return platformFailure("YOU_IMPORT_QUARANTINED", `import release refused: ${intake.detail}`, {
      reason: intake.reason,
      artifactRef,
    });
  }
  const releasedAt = deps.clock.now();
  const constructed = constructImportReleaseRecord({
    id: deps.ids.next("import-release"),
    artifactRef,
    releasedBy: input.releasedBy,
    reason: input.reason,
    releasedAt,
  });
  if (!constructed.ok) {
    return platformFailure("YOU_IMPORT_QUARANTINED", `import release refused: ${constructed.refusal.detail}`, {
      reason: constructed.refusal.reason,
      artifactRef,
    });
  }
  const quarantinedVerdict = plane.importVerdicts.get(artifactRef);
  if (quarantinedVerdict === undefined) {
    return platformFailure("YOU_IMPORT_QUARANTINED", "quarantined import has no verdict record (inconsistent state)", {
      reason: "quarantine-verdict-missing",
      artifactRef,
    });
  }
  plane.importReleases.set(constructed.release.id, constructed.release);
  plane.importStatuses.set(artifactRef, "released");
  appendImportQuarantined(plane, {
    phase: "released",
    verdict: quarantinedVerdict,
    findings: plane.importFindings.get(artifactRef) ?? [],
    release: constructed.release,
  });
  return { ok: true, value: { release: constructed.release } };
}

/**
 * The admission gate (the IMPORT SECURITY LAW's teeth): only clean and
 * released imports enter evidence. Unscanned / quarantined / rejected
 * refuse with the typed YOU_IMPORT_QUARANTINED (stable reasons). Gates
 * through the rate limiter first (enforcement-before-effect).
 */
export function admitImportOp(
  plane: PlatformPlaneRecord,
  deps: PlatformFlowDeps,
  artifactRef: OpaqueId,
): PlatformServiceResult<{ readonly verdict: ImportSecurityVerdict; readonly admissionReason: string }> {
  const gate = gateRateLimitOp(plane, deps, IMPORT_ADMIT_GATE_SCOPE, artifactRef);
  if (!gate.ok) {
    return gate;
  }
  const status: ImportQuarantineStatus | null = plane.importStatuses.get(artifactRef) ?? null;
  const decision = importAdmissionDecision(status);
  if (!decision.allowed) {
    return platformFailure("YOU_IMPORT_QUARANTINED", `import admission refused (${decision.reason})`, {
      reason: decision.reason,
      artifactRef,
      status: status ?? "unscanned",
    });
  }
  const verdict = plane.importVerdicts.get(artifactRef);
  if (verdict === undefined) {
    return platformFailure("YOU_IMPORT_QUARANTINED", "import admission refused (unscanned import)", {
      reason: "unscanned-import",
      artifactRef,
    });
  }
  return { ok: true, value: { verdict, admissionReason: decision.reason } };
}
