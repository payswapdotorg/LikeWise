import assert from "node:assert/strict";
import test from "node:test";
import type { SolutionEvent } from "./contract.js";
import { replayPlatformLedger } from "./platformLedger.js";
import { stableStringify } from "./serialize.js";

const SOLUTION_ID = "you_w10a_fold_solution01";

function event(type: SolutionEvent["type"], payload: Record<string, string | number | boolean>): SolutionEvent {
  return {
    id: `you_event_${type}-${Object.keys(payload).length}`,
    solutionId: SOLUTION_ID,
    type,
    occurredAt: "2026-01-01T00:00:01.000Z",
    subjectRef: null,
    payload,
    provenance: { source: "solution-event-ledger", generator: "agent", createdAt: "2026-01-01T00:00:01.000Z", lineage: [] },
  };
}

test("replayPlatformLedger requires at least one event (the W1A fold precedent)", () => {
  assert.throws(() => replayPlatformLedger([]), /requires at least one event/);
});

test("the fold reconstructs enforcement records and the per-scope usage heads", () => {
  const events: SolutionEvent[] = [
    event("rate-limit-enforced", {
      enforcementId: "enforce-1",
      policyId: "policy-1",
      scope: "import:scan",
      action: "deny",
      outcome: "allowed",
      reason: "within-burst",
      subject: "importA",
      windowStart: "2026-01-01T00:00:00.000Z",
      used: 1,
      burst: 2,
      windowS: 60,
      checkedAt: "2026-01-01T00:00:00.000Z",
      simulated: true,
    }),
    event("rate-limit-enforced", {
      enforcementId: "enforce-2",
      policyId: "policy-1",
      scope: "import:scan",
      action: "deny",
      outcome: "exceeded",
      reason: "burst-exhausted",
      subject: "importC",
      windowStart: "2026-01-01T00:00:00.000Z",
      used: 2,
      burst: 2,
      windowS: 60,
      checkedAt: "2026-01-01T00:00:02.000Z",
      simulated: true,
    }),
  ];
  const projection = replayPlatformLedger(events);
  assert.equal(projection.solutionId, SOLUTION_ID);
  assert.equal(projection.enforcements["enforce-1"]?.outcome, "allowed");
  assert.equal(projection.enforcements["enforce-2"]?.outcome, "exceeded");
  assert.equal(projection.enforcements["enforce-2"]?.action, "deny");
  assert.equal(projection.enforcements["enforce-2"]?.checkedAt, "2026-01-01T00:00:02.000Z");
  // The usage head: the LATEST evaluation per scope wins.
  assert.deepEqual(projection.rateLimitUsage["import:scan"], {
    windowStart: "2026-01-01T00:00:00.000Z",
    used: 2,
    burst: 2,
    windowS: 60,
  });
});

test("the fold reconstructs the quarantine lifecycle: birth then explicit release (latest wins)", () => {
  const events: SolutionEvent[] = [
    event("import-quarantined", {
      verdictId: "verdict-1",
      artifactRef: "importB",
      scanClass: "avatar-vrm",
      verdict: "quarantined",
      quarantinedAt: "2026-01-01T00:00:03.000Z",
      findingCount: 1,
      "finding.0": "signature:embedded-script",
      "findingSeverity.0": "medium",
      phase: "quarantined",
      releaseId: "",
      releasedBy: "",
      releaseReason: "",
      releasedAt: "",
      simulated: true,
    }),
    event("import-quarantined", {
      verdictId: "verdict-1",
      artifactRef: "importB",
      scanClass: "avatar-vrm",
      verdict: "quarantined",
      quarantinedAt: "2026-01-01T00:00:03.000Z",
      findingCount: 1,
      "finding.0": "signature:embedded-script",
      "findingSeverity.0": "medium",
      phase: "released",
      releaseId: "release-1",
      releasedBy: "user-1",
      releaseReason: "reviewed",
      releasedAt: "2026-01-01T00:00:05.000Z",
      simulated: true,
    }),
  ];
  const projection = replayPlatformLedger(events);
  const importEntry = projection.imports["importB"];
  assert.ok(importEntry !== undefined);
  assert.equal(importEntry.status, "released");
  assert.equal(importEntry.verdict, "quarantined");
  assert.equal(importEntry.releaseId, "release-1");
  assert.equal(importEntry.releasedBy, "user-1");
  assert.equal(importEntry.releasedAt, "2026-01-01T00:00:05.000Z");
  assert.deepEqual(importEntry.findings, [{ signature: "signature:embedded-script", severity: "medium" }]);
  assert.equal(importEntry.findingCount, 1);
});

test("the fold reconstructs retention passes and DR restores with their evidence facts", () => {
  const events: SolutionEvent[] = [
    event("retention-enforced", {
      recordId: "pass-1",
      retentionClass: "project-retention",
      subjectRef: "subject-1",
      enforcedAt: "2026-01-01T00:00:06.000Z",
      consentState: "withdrawn",
      simulated: true,
    }),
    event("dr-restore-recorded", {
      restoreId: "restore-1",
      snapshotRef: "snapshot-1",
      restoredAt: "2026-01-01T00:00:07.000Z",
      verified: true,
      activated: true,
      checkEvidencePresent: true,
      expectedHash: "aa",
      actualHash: "aa",
      byteLength: 8,
      refusalReason: "",
      simulated: true,
    }),
    event("dr-restore-recorded", {
      restoreId: "restore-2",
      snapshotRef: "snapshot-2",
      restoredAt: "2026-01-01T00:00:08.000Z",
      verified: false,
      activated: false,
      checkEvidencePresent: false,
      expectedHash: "bb",
      actualHash: "",
      byteLength: 0,
      refusalReason: "hash-mismatch",
      simulated: true,
    }),
  ];
  const projection = replayPlatformLedger(events);
  assert.deepEqual(projection.retentionPasses["pass-1"], {
    retentionClass: "project-retention",
    subjectRef: "subject-1",
    enforcedAt: "2026-01-01T00:00:06.000Z",
    consentState: "withdrawn",
    simulated: true,
  });
  assert.equal(projection.drRestores["restore-1"]?.verified, true);
  assert.equal(projection.drRestores["restore-1"]?.activated, true);
  assert.equal(projection.drRestores["restore-1"]?.checkEvidencePresent, true);
  assert.equal(projection.drRestores["restore-2"]?.verified, false);
  assert.equal(projection.drRestores["restore-2"]?.activated, false);
  assert.equal(projection.drRestores["restore-2"]?.refusalReason, "hash-mismatch");
  // A failed restore NEVER carries check evidence.
  assert.equal(projection.drRestores["restore-2"]?.checkEvidencePresent, false);
});

test("the fold is deterministic and defensive: same events => same projection; unknown shapes ignored", () => {
  const events: SolutionEvent[] = [
    event("rate-limit-enforced", {
      enforcementId: "enforce-1",
      scope: "import:scan",
      outcome: "allowed",
      simulated: true,
    }),
    event("import-quarantined", { artifactRef: "x", phase: "quarantined", simulated: true }),
    event("retention-enforced", { recordId: "pass-1", simulated: true }),
    event("dr-restore-recorded", { restoreId: "restore-1", verified: true, simulated: true }),
    event("version-published", { versionId: "v1" }),
  ];
  const first = replayPlatformLedger(events);
  const second = replayPlatformLedger(events.map((item) => ({ ...item })));
  assert.equal(stableStringify(first), stableStringify(second));
  // Missing ids fold defensively (ignored), never crash.
  assert.equal(Object.keys(first.enforcements).length, 1);
  assert.equal(Object.keys(first.imports).length, 1);
  assert.equal(Object.keys(first.retentionPasses).length, 1);
  assert.equal(Object.keys(first.drRestores).length, 1);
  // Defaults stay truthful: unknown outcomes fold to "allowed"; unknown phases to "quarantined".
  assert.equal(first.enforcements["enforce-1"]?.outcome, "allowed");
  assert.equal(first.imports["x"]?.status, "quarantined");
});
