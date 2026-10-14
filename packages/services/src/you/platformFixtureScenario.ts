// YOU W10A platform fixture scenario — scripted, deterministic
// orchestration of the full hardening arrow (docs/you/WORK_ORDERS.md
// W10A; FIXTURES.md):
//
//   scan policy registered (+ invalid-policy refusals) -> import A
//   scanned clean -> admitted -> import B scanned -> QUARANTINED (the
//   fail-closed birth) -> admission refusals (quarantined + unscanned)
//   -> explicit release record (the only path out) -> admission after
//   release -> release refusals (already released + clean) -> import D
//   scan attempt -> RATE LIMIT EXCEEDED (the scan never runs —
//   enforcement BEFORE effect) -> 70 clock ticks burn the window ->
//   import D scanned (rejected, terminal) -> release/admission
//   refusals on the rejected import -> re-scan refusal (already
//   scanned) -> retention pass refused (consent-protected: an ACTIVE
//   granted consent) -> retention pass recorded (withdrawn consent ->
//   free) (+ class/subject refusals) -> DR restore verified (hash
//   match BEFORE activation, check evidence rides the event) -> DR
//   restore hash-mismatch (recorded failed attempt, NEVER activated) ->
//   DR snapshot-missing refusal (nothing to audit) -> lookup refusals
//   -> ledger readout (all four wave-10 events present; live projection
//   == replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same service seed produces byte-identical
// traces (golden expectation). Fixture policies/verdicts/releases/
// passes/restores stay `simulated: true` (truth law). The scenario owns
// the injected clock (it burns ticks deterministically to roll the scan
// window) and the DR snapshot content store (it stages the backup
// bytes before creating the service).

import type { OpaqueId, SolutionEvent } from "@zcode/shared";
import { createDeterministicClock, type DeterministicClock } from "../../../shared/src/you/clock.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createPlatformService, PlatformService } from "./platformService.js";
import {
  PLATFORM_SCENARIO_DR_SNAPSHOT_ONE_TEXT,
  PLATFORM_SCENARIO_DR_SNAPSHOT_TWO_TEXT,
  PLATFORM_SCENARIO_IMPORT_A_REF,
  PLATFORM_SCENARIO_IMPORT_A_SCAN,
  PLATFORM_SCENARIO_IMPORT_B_REF,
  PLATFORM_SCENARIO_IMPORT_B_SCAN,
  PLATFORM_SCENARIO_IMPORT_C_REF,
  PLATFORM_SCENARIO_IMPORT_D_REF,
  PLATFORM_SCENARIO_IMPORT_D_SCAN,
  PLATFORM_SCENARIO_RELEASE_INPUT,
  PLATFORM_SCENARIO_RETENTION_CLASS,
  PLATFORM_SCENARIO_RETENTION_CONSENT_FREE,
  PLATFORM_SCENARIO_RETENTION_CONSENT_PROTECTED,
  PLATFORM_SCENARIO_RETENTION_S1_REF,
  PLATFORM_SCENARIO_RETENTION_S2_REF,
  PLATFORM_SCENARIO_SCAN_POLICY_INPUT,
  PLATFORM_SCENARIO_SEED,
  PLATFORM_SCENARIO_SOLUTION_ID,
  PLATFORM_SCENARIO_TICKS_TO_BURN,
  fixtureBytes,
  outcomeCode,
  tamperHash,
  type PlatformScenarioOptions,
  type PlatformScenarioStep,
  type PlatformScenarioTrace,
} from "./platformFixtureScenarioTypes.js";

export {
  PLATFORM_SCENARIO_DR_SNAPSHOT_ONE_TEXT,
  PLATFORM_SCENARIO_DR_SNAPSHOT_TWO_TEXT,
  PLATFORM_SCENARIO_IMPORT_A_REF,
  PLATFORM_SCENARIO_IMPORT_A_SCAN,
  PLATFORM_SCENARIO_IMPORT_B_REF,
  PLATFORM_SCENARIO_IMPORT_B_SCAN,
  PLATFORM_SCENARIO_IMPORT_C_REF,
  PLATFORM_SCENARIO_IMPORT_D_REF,
  PLATFORM_SCENARIO_IMPORT_D_SCAN,
  PLATFORM_SCENARIO_RELEASE_INPUT,
  PLATFORM_SCENARIO_RETENTION_CLASS,
  PLATFORM_SCENARIO_RETENTION_CONSENT_FREE,
  PLATFORM_SCENARIO_RETENTION_CONSENT_PROTECTED,
  PLATFORM_SCENARIO_RETENTION_S1_REF,
  PLATFORM_SCENARIO_RETENTION_S2_REF,
  PLATFORM_SCENARIO_SCAN_POLICY_INPUT,
  PLATFORM_SCENARIO_SEED,
  PLATFORM_SCENARIO_SOLUTION_ID,
  PLATFORM_SCENARIO_TICKS_TO_BURN,
} from "./platformFixtureScenarioTypes.js";
export type { PlatformScenarioOptions, PlatformScenarioStep, PlatformScenarioTrace } from "./platformFixtureScenarioTypes.js";

function step(index: number, name: string, facts: Record<string, string | number | boolean>): PlatformScenarioStep {
  return { step: index, name, facts };
}

function must<T>(
  result: { readonly ok: boolean; readonly value?: T; readonly error?: { readonly code: string; readonly message: string } },
  where: string,
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`scenario failed at ${where}: ${result.error?.code ?? "unknown"} ${result.error?.message ?? ""}`);
  }
  return result.value;
}

/**
 * Runs the full scripted platform-hardening scenario against a freshly
 * created service. Deterministic: same seed + same options => identical
 * trace.
 */
export function runPlatformFixtureScenario(options: PlatformScenarioOptions = {}): PlatformScenarioTrace {
  const solutionId = options.solutionId ?? PLATFORM_SCENARIO_SOLUTION_ID;
  // The scenario owns the injected clock (it burns ticks deterministically
  // to roll the import:scan window past its 60s span).
  const clock: DeterministicClock = createDeterministicClock();
  // The scenario stages the DR snapshot backups in the content store
  // BEFORE creating the service (a restore reads what a backup wrote —
  // the same content-store abstraction as the evidence lane).
  const store: EvidenceContentStore = createFixtureEvidenceContentStore();
  const snapshotOne = store.put(fixtureBytes(PLATFORM_SCENARIO_DR_SNAPSHOT_ONE_TEXT));
  const snapshotTwo = store.put(fixtureBytes(PLATFORM_SCENARIO_DR_SNAPSHOT_TWO_TEXT));
  const service = createPlatformService({
    workspaceIdentity: "ws-w10a-scenario-platform",
    seed: options.seed ?? PLATFORM_SCENARIO_SEED,
    clock,
    contentStore: store,
  });

  const steps: PlatformScenarioStep[] = [];
  let stepIndex = 0;
  const refusalOutcomes: Record<string, string> = {};
  const scanWalk: string[] = [];
  const importVerdictIds: OpaqueId[] = [];

  // -- scan policy registered (+ invalid-policy refusals) ---------------------

  const scanPolicy = must(
    service.registerRateLimitPolicy(solutionId, { ...PLATFORM_SCENARIO_SCAN_POLICY_INPUT }),
    "registerScanPolicy",
  );
  steps.push(
    step((stepIndex += 1), "scan-policy-registered", {
      policyId: scanPolicy.policy.id,
      scope: scanPolicy.policy.scope,
      windowS: scanPolicy.policy.windowS,
      burst: scanPolicy.policy.burst,
      action: scanPolicy.policy.action,
    }),
  );

  const invalidScope = service.registerRateLimitPolicy(solutionId, {
    ...PLATFORM_SCENARIO_SCAN_POLICY_INPUT,
    scope: "Import Scan",
  });
  refusalOutcomes["policy-scope-invalid"] = outcomeCode(invalidScope);
  const invalidWindow = service.registerRateLimitPolicy(solutionId, {
    ...PLATFORM_SCENARIO_SCAN_POLICY_INPUT,
    windowS: 0,
  });
  refusalOutcomes["policy-window-zero"] = outcomeCode(invalidWindow);
  const invalidBurst = service.registerRateLimitPolicy(solutionId, {
    ...PLATFORM_SCENARIO_SCAN_POLICY_INPUT,
    burst: 0,
  });
  refusalOutcomes["policy-burst-zero"] = outcomeCode(invalidBurst);
  const invalidAction = service.registerRateLimitPolicy(solutionId, {
    ...PLATFORM_SCENARIO_SCAN_POLICY_INPUT,
    action: "throttle" as unknown as typeof PLATFORM_SCENARIO_SCAN_POLICY_INPUT.action,
  });
  refusalOutcomes["policy-action-invalid"] = outcomeCode(invalidAction);
  steps.push(
    step((stepIndex += 1), "invalid-policy-refusals", {
      ...refusalOutcomes,
      refusalCount: 4,
    }),
  );

  // -- import A scanned clean -> admitted ---------------------------------------

  const importA = must(
    service.scanImport(solutionId, { artifactRef: PLATFORM_SCENARIO_IMPORT_A_SCAN.artifactRef, scanClass: PLATFORM_SCENARIO_IMPORT_A_SCAN.scanClass, findings: [...PLATFORM_SCENARIO_IMPORT_A_SCAN.findings] }),
    "scanImportA",
  );
  importVerdictIds.push(importA.verdict.id);
  scanWalk.push("clean");
  steps.push(
    step((stepIndex += 1), "import-scanned-clean", {
      verdictId: importA.verdict.id,
      artifactRef: PLATFORM_SCENARIO_IMPORT_A_REF,
      scanClass: importA.verdict.scanClass,
      verdict: importA.verdict.verdict,
      quarantinedAtIsNull: importA.verdict.quarantinedAt === null,
      findingCount: PLATFORM_SCENARIO_IMPORT_A_SCAN.findings.length,
    }),
  );

  const admittedA = must(service.admitImport(solutionId, PLATFORM_SCENARIO_IMPORT_A_REF), "admitImportA");
  steps.push(
    step((stepIndex += 1), "import-admitted", {
      artifactRef: PLATFORM_SCENARIO_IMPORT_A_REF,
      admissionReason: admittedA.admissionReason,
      verdict: admittedA.verdict.verdict,
    }),
  );

  // -- import B scanned -> QUARANTINED (the fail-closed birth) ------------------

  const importB = must(
    service.scanImport(solutionId, { artifactRef: PLATFORM_SCENARIO_IMPORT_B_SCAN.artifactRef, scanClass: PLATFORM_SCENARIO_IMPORT_B_SCAN.scanClass, findings: [...PLATFORM_SCENARIO_IMPORT_B_SCAN.findings] }),
    "scanImportB",
  );
  importVerdictIds.push(importB.verdict.id);
  scanWalk.push("quarantined");
  steps.push(
    step((stepIndex += 1), "import-quarantined", {
      verdictId: importB.verdict.id,
      artifactRef: PLATFORM_SCENARIO_IMPORT_B_REF,
      scanClass: importB.verdict.scanClass,
      verdict: importB.verdict.verdict,
      quarantinedAt: importB.verdict.quarantinedAt ?? "",
      findingCount: PLATFORM_SCENARIO_IMPORT_B_SCAN.findings.length,
    }),
  );

  // -- admission refusals (quarantined + unscanned: never enter evidence) -------

  const admissionB = service.admitImport(solutionId, PLATFORM_SCENARIO_IMPORT_B_REF);
  refusalOutcomes["admission-quarantined"] = outcomeCode(admissionB);
  const admissionC = service.admitImport(solutionId, PLATFORM_SCENARIO_IMPORT_C_REF);
  refusalOutcomes["admission-unscanned"] = outcomeCode(admissionC);
  steps.push(
    step((stepIndex += 1), "admission-refusals", {
      "admission-quarantined": refusalOutcomes["admission-quarantined"] ?? "",
      "admission-unscanned": refusalOutcomes["admission-unscanned"] ?? "",
    }),
  );

  // -- the explicit release record (the ONLY path out of quarantine) ------------

  const release = must(
    service.releaseQuarantinedImport(solutionId, PLATFORM_SCENARIO_IMPORT_B_REF, { ...PLATFORM_SCENARIO_RELEASE_INPUT }),
    "releaseImportB",
  );
  scanWalk.push("released");
  steps.push(
    step((stepIndex += 1), "import-released", {
      releaseId: release.release.id,
      artifactRef: PLATFORM_SCENARIO_IMPORT_B_REF,
      releasedBy: release.release.releasedBy,
      reason: release.release.reason,
      releasedAt: release.release.releasedAt,
    }),
  );

  const admittedB = must(service.admitImport(solutionId, PLATFORM_SCENARIO_IMPORT_B_REF), "admitImportB");
  steps.push(
    step((stepIndex += 1), "import-admitted-after-release", {
      artifactRef: PLATFORM_SCENARIO_IMPORT_B_REF,
      admissionReason: admittedB.admissionReason,
      verdict: admittedB.verdict.verdict,
    }),
  );

  // -- release refusals (lifecycle: already released + clean needs no release) ---

  const reRelease = service.releaseQuarantinedImport(solutionId, PLATFORM_SCENARIO_IMPORT_B_REF, { ...PLATFORM_SCENARIO_RELEASE_INPUT });
  refusalOutcomes["release-not-quarantined"] = outcomeCode(reRelease);
  const releaseClean = service.releaseQuarantinedImport(solutionId, PLATFORM_SCENARIO_IMPORT_A_REF, { ...PLATFORM_SCENARIO_RELEASE_INPUT });
  refusalOutcomes["release-clean-import"] = outcomeCode(releaseClean);
  steps.push(
    step((stepIndex += 1), "release-refusals", {
      "release-not-quarantined": refusalOutcomes["release-not-quarantined"] ?? "",
      "release-clean-import": refusalOutcomes["release-clean-import"] ?? "",
    }),
  );

  // -- RATE LIMIT EXCEEDED: the scan NEVER runs (enforcement BEFORE effect) ------

  const scanDRefused = service.scanImport(solutionId, { artifactRef: PLATFORM_SCENARIO_IMPORT_D_SCAN.artifactRef, scanClass: PLATFORM_SCENARIO_IMPORT_D_SCAN.scanClass, findings: [...PLATFORM_SCENARIO_IMPORT_D_SCAN.findings] });
  refusalOutcomes["scan-limit-exceeded"] = outcomeCode(scanDRefused);
  const scanDStatus = service.importStatusOf(solutionId, PLATFORM_SCENARIO_IMPORT_D_REF);
  steps.push(
    step((stepIndex += 1), "scan-limit-exceeded", {
      artifactRef: PLATFORM_SCENARIO_IMPORT_D_REF,
      refusal: refusalOutcomes["scan-limit-exceeded"] ?? "",
      scanNeverRan: scanDStatus === null,
      importStatusUnset: service.importStatusOf(solutionId, PLATFORM_SCENARIO_IMPORT_D_REF) === null,
    }),
  );

  // -- burn 70 ticks: the 60s window rolls ----------------------------------------

  for (let tick = 0; tick < PLATFORM_SCENARIO_TICKS_TO_BURN; tick += 1) {
    clock.now();
  }

  // -- import D scanned (rejected, terminal) + its refusals ----------------------

  const importD = must(
    service.scanImport(solutionId, { artifactRef: PLATFORM_SCENARIO_IMPORT_D_SCAN.artifactRef, scanClass: PLATFORM_SCENARIO_IMPORT_D_SCAN.scanClass, findings: [...PLATFORM_SCENARIO_IMPORT_D_SCAN.findings] }),
    "scanImportD",
  );
  importVerdictIds.push(importD.verdict.id);
  scanWalk.push("rejected");
  steps.push(
    step((stepIndex += 1), "import-scanned-rejected", {
      verdictId: importD.verdict.id,
      artifactRef: PLATFORM_SCENARIO_IMPORT_D_REF,
      scanClass: importD.verdict.scanClass,
      verdict: importD.verdict.verdict,
      quarantinedAtIsNull: importD.verdict.quarantinedAt === null,
      findingCount: PLATFORM_SCENARIO_IMPORT_D_SCAN.findings.length,
    }),
  );

  const releaseRejected = service.releaseQuarantinedImport(solutionId, PLATFORM_SCENARIO_IMPORT_D_REF, { ...PLATFORM_SCENARIO_RELEASE_INPUT });
  refusalOutcomes["release-rejected-terminal"] = outcomeCode(releaseRejected);
  const admissionD = service.admitImport(solutionId, PLATFORM_SCENARIO_IMPORT_D_REF);
  refusalOutcomes["admission-rejected"] = outcomeCode(admissionD);
  steps.push(
    step((stepIndex += 1), "rejected-import-refusals", {
      "release-rejected-terminal": refusalOutcomes["release-rejected-terminal"] ?? "",
      "admission-rejected": refusalOutcomes["admission-rejected"] ?? "",
    }),
  );

  // -- re-scan refusal (an artifactRef is scanned exactly once) -------------------

  const rescanB = service.scanImport(solutionId, { artifactRef: PLATFORM_SCENARIO_IMPORT_B_SCAN.artifactRef, scanClass: PLATFORM_SCENARIO_IMPORT_B_SCAN.scanClass, findings: [...PLATFORM_SCENARIO_IMPORT_B_SCAN.findings] });
  refusalOutcomes["rescan-already-scanned"] = outcomeCode(rescanB);
  steps.push(
    step((stepIndex += 1), "rescan-refusal", {
      "rescan-already-scanned": refusalOutcomes["rescan-already-scanned"] ?? "",
    }),
  );

  // -- retention: the consent gate (an ACTIVE consent outranks the class) --------

  const consentProtected = service.enforceRetention(
    solutionId,
    { retentionClass: PLATFORM_SCENARIO_RETENTION_CLASS, subjectRef: PLATFORM_SCENARIO_RETENTION_S1_REF },
    PLATFORM_SCENARIO_RETENTION_CONSENT_PROTECTED,
  );
  refusalOutcomes["retention-consent-protected"] = outcomeCode(consentProtected);
  const retentionPass = must(
    service.enforceRetention(
      solutionId,
      { retentionClass: PLATFORM_SCENARIO_RETENTION_CLASS, subjectRef: PLATFORM_SCENARIO_RETENTION_S2_REF },
      PLATFORM_SCENARIO_RETENTION_CONSENT_FREE,
    ),
    "enforceRetentionPass",
  );
  steps.push(
    step((stepIndex += 1), "retention-pass-recorded", {
      recordId: retentionPass.record.id,
      retentionClass: retentionPass.record.retentionClass,
      subjectRef: retentionPass.record.subjectRef,
      enforcedAt: retentionPass.record.enforcedAt,
      consentState: retentionPass.consentState,
      consentProtectedRefusal: refusalOutcomes["retention-consent-protected"] ?? "",
    }),
  );

  const invalidClass = service.enforceRetention(
    solutionId,
    { retentionClass: "forever", subjectRef: PLATFORM_SCENARIO_RETENTION_S2_REF },
    PLATFORM_SCENARIO_RETENTION_CONSENT_FREE,
  );
  refusalOutcomes["retention-class-invalid"] = outcomeCode(invalidClass);
  const emptySubject = service.enforceRetention(
    solutionId,
    { retentionClass: PLATFORM_SCENARIO_RETENTION_CLASS, subjectRef: "" },
    PLATFORM_SCENARIO_RETENTION_CONSENT_FREE,
  );
  refusalOutcomes["retention-subject-empty"] = outcomeCode(emptySubject);
  steps.push(
    step((stepIndex += 1), "retention-refusals", {
      "retention-class-invalid": refusalOutcomes["retention-class-invalid"] ?? "",
      "retention-subject-empty": refusalOutcomes["retention-subject-empty"] ?? "",
    }),
  );

  // -- DR restore verified (content-hash check BEFORE activation) ----------------

  const restoreOne = must(
    service.restoreSnapshot(solutionId, { snapshotRef: snapshotOne.contentRef, expectedContentHash: snapshotOne.contentHash }),
    "restoreSnapshotOne",
  );
  steps.push(
    step((stepIndex += 1), "dr-restore-verified", {
      restoreId: restoreOne.record.id,
      snapshotRef: snapshotOne.contentRef,
      verified: restoreOne.record.verified,
      checkEvidencePresent: restoreOne.evidence.expectedContentHash === restoreOne.evidence.actualContentHash,
      byteLength: restoreOne.evidence.byteLength,
      activated: true,
    }),
  );

  // -- DR restore unverifiable (hash mismatch: recorded, NEVER activated) --------

  const restoreTwo = service.restoreSnapshot(solutionId, { snapshotRef: snapshotTwo.contentRef, expectedContentHash: tamperHash(snapshotTwo.contentHash) });
  refusalOutcomes["dr-hash-mismatch"] = outcomeCode(restoreTwo);
  const activeAfterMismatch = must(service.activeDrRestoreOf(solutionId), "activeDrRestoreAfterMismatch");
  steps.push(
    step((stepIndex += 1), "dr-restore-hash-mismatch", {
      snapshotRef: snapshotTwo.contentRef,
      refusal: refusalOutcomes["dr-hash-mismatch"] ?? "",
      activeRestoreId: activeAfterMismatch.record?.id ?? "",
      stillActiveSnapshotOne: activeAfterMismatch.record?.snapshotRef === snapshotOne.contentRef,
    }),
  );

  // -- DR snapshot missing (unverifiable: nothing exists to audit) ----------------

  const missingSnapshot = service.restoreSnapshot(solutionId, {
    snapshotRef: "you_content_missing00000000000",
    expectedContentHash: "0".repeat(64),
  });
  refusalOutcomes["dr-snapshot-missing"] = outcomeCode(missingSnapshot);
  steps.push(
    step((stepIndex += 1), "dr-snapshot-missing", {
      refusal: refusalOutcomes["dr-snapshot-missing"] ?? "",
    }),
  );

  // -- lookup refusals (error taxonomy) --------------------------------------------

  const unknownRestore = service.restoreOf(solutionId, "you_dr-restore_missing000000000");
  refusalOutcomes["dr-unknown-restore"] = outcomeCode(unknownRestore);
  const unknownVerdict = service.importVerdictOf(solutionId, PLATFORM_SCENARIO_IMPORT_C_REF);
  refusalOutcomes["import-unknown-verdict"] = outcomeCode(unknownVerdict);
  steps.push(
    step((stepIndex += 1), "lookup-refusals", {
      "dr-unknown-restore": refusalOutcomes["dr-unknown-restore"] ?? "",
      "import-unknown-verdict": refusalOutcomes["import-unknown-verdict"] ?? "",
    }),
  );

  // -- ledger readout: all four wave-10 events, projection == replay ---------------

  const events: readonly SolutionEvent[] = must(service.ledgerEventsOf(solutionId), "ledgerEventsOf");
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  }
  const live = must(service.projectionOf(solutionId), "projectionOf");
  const replay = PlatformService.replay(events);
  const projectionMatchesReplay = stableStringify(live) === stableStringify(replay);
  const ledgerHash = must(service.ledgerHashOf(solutionId), "ledgerHashOf");
  steps.push(
    step((stepIndex += 1), "ledger-readout", {
      eventCount: events.length,
      ledgerHash,
      projectionMatchesReplay,
      rateLimitEnforced: eventCounts["rate-limit-enforced"] ?? 0,
      importQuarantined: eventCounts["import-quarantined"] ?? 0,
      retentionEnforced: eventCounts["retention-enforced"] ?? 0,
      drRestoreRecorded: eventCounts["dr-restore-recorded"] ?? 0,
    }),
  );

  const restores = must(service.drRestoresOf(solutionId), "drRestoresOf");
  const drRestoreIds = restores.restores.map((record) => record.id);

  return {
    solutionId,
    scanPolicyId: scanPolicy.policy.id,
    importVerdictIds,
    releaseId: release.release.id,
    retentionRecordId: retentionPass.record.id,
    drRestoreIds,
    activeDrRestoreId: activeAfterMismatch.record?.id ?? null,
    scanWalk,
    refusalOutcomes,
    eventCounts,
    eventCount: events.length,
    ledgerHash,
    projectionMatchesReplay,
    simulated: true,
    steps,
  };
}
