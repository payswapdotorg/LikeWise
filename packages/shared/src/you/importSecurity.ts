// YOU ImportSecurityVerdict machinery (W10A — docs/you/CONTRACTS.md
// "Wave-10 contract freeze (v10)": "ImportSecurityVerdict (scan classes,
// clean/quarantined/rejected verdicts)"; the IMPORT SECURITY LAW:
// unscanned imports never enter evidence; quarantine is fail-closed and
// reversible only through an explicit release record
// (YOU_IMPORT_QUARANTINED)).
//
// This module owns the STATELESS validators and gates (WORK_ORDERS.md
// W10A: "ImportSecurityVerdict: scan classes, clean/quarantined/rejected
// verdicts; fail-closed quarantine, release only via explicit records").
// Validation is pure: no clock, no rng, no store, no registry lookup —
// the service maps refusals to typed YOU_IMPORT_QUARANTINED errors at
// its seam.
//
// Verdict rule (fixture definition, deterministic — the scanner's
// decision function): any high-severity finding REJECTS; otherwise any
// medium-severity finding QUARANTINES; otherwise the import is CLEAN.
// The finding list itself is scan input (fixture scenarios script it);
// real scanner adapters stay W10C+ compute-plane work behind the
// fail-closed seam.
//
// The frozen ImportSecurityVerdict shape carries the scan facts only
// (id/artifactRef/scanClass/verdict/quarantinedAt/simulated — no
// lifecycle-status field), exactly like the W8A EscalationAuthorization
// carried its grant facts only. The quarantine lifecycle status is a
// PROJECTION over the append-only facts: quarantine birth and release
// ride the frozen `import-quarantined` event (the wave's only import
// event — the W7A ride-along precedent: suspend/resume carried
// statusAfter on embodiment-state-changed); clean and rejected verdicts
// are pre-admission SERVICE STATE (the arena provider precedent:
// descriptors "materialize in the ledger only through delivery facts").
// The explicit release record (ImportReleaseRecord below) is the ONLY
// path out of quarantine.

import type { ImportSecurityVerdict, OpaqueId } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** The sanctioned scan classes (the frozen fixture contract). */
export const IMPORT_SCAN_CLASSES = [
  "artifact-bundle",
  "asset-mesh",
  "material-texture",
  "avatar-vrm",
  "editor-plugin",
  "pipeline-config",
] as const;

export type ImportScanClass = (typeof IMPORT_SCAN_CLASSES)[number];

const SCAN_CLASS_SET: ReadonlySet<string> = new Set(IMPORT_SCAN_CLASSES);

/** The three frozen verdicts (the contract's verdict union verbatim). */
export const IMPORT_VERDICTS = ["clean", "quarantined", "rejected"] as const;

const VERDICT_SET: ReadonlySet<string> = new Set(IMPORT_VERDICTS);

/** The three finding severities (the scanner's input ladder). */
export const IMPORT_SEVERITIES = ["low", "medium", "high"] as const;

export type ImportSeverity = (typeof IMPORT_SEVERITIES)[number];

const SEVERITY_SET: ReadonlySet<string> = new Set(IMPORT_SEVERITIES);

/** True when the value is one of the sanctioned scan classes. */
export function isImportScanClass(value: unknown): value is ImportScanClass {
  return typeof value === "string" && SCAN_CLASS_SET.has(value);
}

/** True when the value is one of the three frozen verdicts. */
export function isImportVerdict(value: unknown): value is ImportSecurityVerdict["verdict"] {
  return typeof value === "string" && VERDICT_SET.has(value);
}

/** True when the value is one of the three severities. */
export function isImportSeverity(value: unknown): value is ImportSeverity {
  return typeof value === "string" && SEVERITY_SET.has(value);
}

/** One scanner finding (the scan input facts). */
export interface ImportScanFinding {
  /** Opaque signature token (e.g. "signature:embedded-script"). */
  readonly signature: string;
  readonly severity: ImportSeverity;
}

/** Scan intake (the scanner's input). */
export interface ImportScanInput {
  readonly artifactRef: OpaqueId;
  readonly scanClass: string;
  readonly findings: readonly ImportScanFinding[];
}

/** A refusal returned by the stateless validators (never an exception). */
export interface ImportSecurityRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless scan-intake validator (the single scan authority):
 * artifactRef must be a non-empty opaque id, scanClass one of the six
 * sanctioned classes, findings a list of well-formed
 * {signature, severity} pairs (no duplicate signatures — the scan
 * deduplicates before deciding).
 */
export function validateImportScanInput(input: ImportScanInput): ImportSecurityRefusal | null {
  if (typeof input.artifactRef !== "string" || input.artifactRef.length === 0) {
    return { reason: "artifact-ref-empty", detail: "artifactRef must be a non-empty opaque id" };
  }
  if (!isImportScanClass(input.scanClass)) {
    return {
      reason: "scan-class-invalid",
      detail: `scanClass must be one of: ${IMPORT_SCAN_CLASSES.join(", ")}`,
    };
  }
  if (!Array.isArray(input.findings)) {
    return { reason: "findings-malformed", detail: "findings must be a list of {signature, severity} pairs" };
  }
  const seen = new Set<string>();
  for (const finding of input.findings) {
    if (finding === null || typeof finding !== "object") {
      return { reason: "findings-malformed", detail: "findings must be a list of {signature, severity} pairs" };
    }
    if (typeof finding.signature !== "string" || finding.signature.length === 0) {
      return { reason: "finding-signature-empty", detail: "each finding signature must be a non-empty string" };
    }
    if (!isImportSeverity(finding.severity)) {
      return {
        reason: "finding-severity-invalid",
        detail: `finding severity must be one of: ${IMPORT_SEVERITIES.join(", ")}`,
      };
    }
    if (seen.has(finding.signature)) {
      return { reason: "finding-duplicate", detail: `duplicate finding signature "${finding.signature}"` };
    }
    seen.add(finding.signature);
  }
  return null;
}

/**
 * The deterministic verdict rule: any high finding rejects; otherwise
 * any medium finding quarantines; otherwise the import is clean.
 */
export function evaluateImportScanVerdict(findings: readonly ImportScanFinding[]): ImportSecurityVerdict["verdict"] {
  for (const finding of findings) {
    if (finding.severity === "high") {
      return "rejected";
    }
  }
  for (const finding of findings) {
    if (finding.severity === "medium") {
      return "quarantined";
    }
  }
  return "clean";
}

/**
 * Constructs the immutable, deep-frozen verdict. Consistency gate:
 * quarantinedAt is non-null IFF the verdict is quarantined (a clean or
 * rejected verdict never carries a quarantine timestamp; a quarantined
 * verdict always does — the service passes the injected clock reading).
 */
export function constructImportSecurityVerdict(
  input: {
    readonly id: OpaqueId;
    readonly artifactRef: OpaqueId;
    readonly scanClass: string;
    readonly verdict: ImportSecurityVerdict["verdict"];
    readonly quarantinedAt: string | null;
  },
): { readonly ok: true; readonly verdict: ImportSecurityVerdict } | { readonly ok: false; readonly refusal: ImportSecurityRefusal } {
  const scanRefusal = validateImportScanInput({
    artifactRef: input.artifactRef,
    scanClass: input.scanClass,
    findings: [],
  });
  if (scanRefusal !== null) {
    return { ok: false, refusal: scanRefusal };
  }
  if (!isImportVerdict(input.verdict)) {
    return {
      ok: false,
      refusal: { reason: "verdict-invalid", detail: `verdict must be one of: ${IMPORT_VERDICTS.join(", ")}` },
    };
  }
  if (input.verdict === "quarantined" && (typeof input.quarantinedAt !== "string" || input.quarantinedAt.length === 0)) {
    return {
      ok: false,
      refusal: { reason: "quarantined-at-missing", detail: "a quarantined verdict requires its quarantinedAt timestamp" },
    };
  }
  if (input.verdict !== "quarantined" && input.quarantinedAt !== null) {
    return {
      ok: false,
      refusal: { reason: "quarantined-at-inconsistent", detail: "only a quarantined verdict carries quarantinedAt" },
    };
  }
  return {
    ok: true,
    verdict: deepFreeze({
      id: input.id,
      artifactRef: input.artifactRef,
      scanClass: input.scanClass,
      verdict: input.verdict,
      quarantinedAt: input.verdict === "quarantined" ? input.quarantinedAt : null,
      simulated: true,
    }),
  };
}

/**
 * The quarantine lifecycle status (a projection over the append-only
 * facts, never stored on the frozen verdict shape):
 *   clean      — scanned, no findings of medium/high severity;
 *   quarantined — scanned, medium severity, awaiting an explicit release;
 *   released   — a quarantined import freed by an explicit release record;
 *   rejected   — scanned, high severity, TERMINAL (no release path).
 */
export type ImportQuarantineStatus = "clean" | "quarantined" | "released" | "rejected";

/**
 * The explicit release record — the ONLY path out of quarantine (the
 * IMPORT SECURITY LAW). Immutable, deep-frozen; rides the ledger as an
 * `import-quarantined` event with phase "released" (see
 * platformLedger.ts).
 */
export interface ImportReleaseRecord {
  readonly id: OpaqueId;
  readonly artifactRef: OpaqueId;
  readonly releasedBy: OpaqueId;
  readonly reason: string;
  readonly releasedAt: string;
  readonly simulated: boolean;
}

/** Release intake (the release record facts). */
export interface ImportReleaseInput {
  readonly releasedBy: OpaqueId;
  readonly reason: string;
}

/** The stateless release-intake validator. */
export function validateImportReleaseInput(input: ImportReleaseInput): ImportSecurityRefusal | null {
  if (typeof input.releasedBy !== "string" || input.releasedBy.length === 0) {
    return { reason: "released-by-empty", detail: "releasedBy must be a non-empty opaque id" };
  }
  if (typeof input.reason !== "string" || input.reason.trim().length === 0) {
    return { reason: "release-reason-empty", detail: "release reason must be a non-empty string" };
  }
  return null;
}

/** Constructs the immutable, deep-frozen release record. */
export function constructImportReleaseRecord(
  input: {
    readonly id: OpaqueId;
    readonly artifactRef: OpaqueId;
    readonly releasedBy: OpaqueId;
    readonly reason: string;
    readonly releasedAt: string;
  },
): { readonly ok: true; readonly release: ImportReleaseRecord } | { readonly ok: false; readonly refusal: ImportSecurityRefusal } {
  if (typeof input.artifactRef !== "string" || input.artifactRef.length === 0) {
    return { ok: false, refusal: { reason: "artifact-ref-empty", detail: "artifactRef must be a non-empty opaque id" } };
  }
  const refusal = validateImportReleaseInput({ releasedBy: input.releasedBy, reason: input.reason });
  if (refusal !== null) {
    return { ok: false, refusal };
  }
  if (typeof input.releasedAt !== "string" || input.releasedAt.length === 0) {
    return { ok: false, refusal: { reason: "released-at-missing", detail: "releasedAt must be a non-empty ISO-8601 string" } };
  }
  return {
    ok: true,
    release: deepFreeze({
      id: input.id,
      artifactRef: input.artifactRef,
      releasedBy: input.releasedBy,
      reason: input.reason,
      releasedAt: input.releasedAt,
      simulated: true,
    }),
  };
}

/**
 * The admission gate decision (the IMPORT SECURITY LAW's teeth):
 * unscanned imports never enter evidence; quarantined imports stay
 * quarantined; rejected imports are terminal. Only clean and released
 * imports may enter evidence.
 */
export type ImportAdmissionDecision =
  | { readonly allowed: true; readonly reason: "scanned-clean" | "released" }
  | { readonly allowed: false; readonly reason: "unscanned-import" | "import-quarantined" | "import-rejected" };

/** True when the import may enter evidence under this lifecycle status. */
export function importAdmissionDecision(status: ImportQuarantineStatus | null): ImportAdmissionDecision {
  switch (status) {
    case null:
      return { allowed: false, reason: "unscanned-import" };
    case "clean":
      return { allowed: true, reason: "scanned-clean" };
    case "released":
      return { allowed: true, reason: "released" };
    case "quarantined":
      return { allowed: false, reason: "import-quarantined" };
    case "rejected":
      return { allowed: false, reason: "import-rejected" };
  }
}

/** True when the lifecycle status is releasable (only quarantine is). */
export function isReleasableStatus(status: ImportQuarantineStatus | null): status is "quarantined" {
  return status === "quarantined";
}
