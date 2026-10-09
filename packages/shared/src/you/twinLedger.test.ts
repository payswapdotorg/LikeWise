import assert from "node:assert/strict";
import test from "node:test";
import type { SolutionEvent } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { deepFreeze, stableStringify } from "./serialize.js";
import { SolutionEventLedger } from "./events.js";
import { replayTwinLedger } from "./twinLedger.js";

function makeLedger(): { ledger: SolutionEventLedger; deps: { clock: ReturnType<typeof createDeterministicClock>; ids: ReturnType<typeof createRngIdFactory> } } {
  const deps = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(0x5eed_0005)) };
  return { ledger: new SolutionEventLedger("you_w3a_ledger_test", deps), deps };
}

test("replayTwinLedger requires at least one event", () => {
  assert.throws(() => replayTwinLedger([]));
});

test("replay folds publications, promotions, quality, jobs and remediation requests", () => {
  const { ledger } = makeLedger();
  ledger.append({
    type: "twin-version-published",
    subjectRef: "tv1",
    payload: { kind: "publication", twinVersionId: "tv1", twinId: "t1", twinDisplayName: "Twin 1", versionNumber: 1, statusAfter: "candidate", domainBlockCount: 3, evidenceBindingCount: 2 },
  });
  ledger.append({
    type: "twin-quality-assessed",
    subjectRef: "tv1",
    payload: {
      twinVersionId: "tv1",
      assessedAt: "2026-01-01T00:00:01.000Z",
      deficiencyCount: 2,
      "score.face-hands": 0.6946,
      "score.geometry-skeleton": 0.8941,
      "deficiency.0.class": "geometric-error",
      "deficiency.0.domain": "face-hands",
      "deficiency.0.severity": 0.3054,
      "deficiency.0.remediationEvidenceRequestId": "er1",
      "deficiency.1.class": "coverage-gap",
      "deficiency.1.domain": "morphology",
      "deficiency.1.severity": 1,
      "deficiency.1.remediationEvidenceRequestId": "",
    },
  });
  ledger.append({
    type: "twin-version-published",
    subjectRef: "tv2",
    payload: { kind: "publication", twinVersionId: "tv2", twinId: "t1", twinDisplayName: "Twin 1", versionNumber: 2, statusAfter: "candidate", domainBlockCount: 3, evidenceBindingCount: 3 },
  });
  ledger.append({
    type: "twin-version-published",
    subjectRef: "tv1",
    payload: { kind: "promotion", twinVersionId: "tv1", twinId: "t1", versionNumber: 1, statusAfter: "canonical" },
  });
  ledger.append({
    type: "twin-version-published",
    subjectRef: "tv2",
    payload: { kind: "promotion", twinVersionId: "tv2", twinId: "t1", versionNumber: 2, statusAfter: "canonical", supersededVersionId: "tv1" },
  });
  ledger.append({
    type: "reconstruction-job-submitted",
    subjectRef: "job1",
    payload: { jobId: "job1", twinVersionId: "tv2", method: "hybrid", targetDomains: "face-hands,geometry-skeleton", targetDomainCount: 2, evidenceBindingCount: 3 },
  });
  ledger.append({
    type: "reconstruction-job-completed",
    subjectRef: "job1",
    payload: { jobId: "job1", statusAfter: "completed", producedBlockCount: 2 },
  });
  ledger.append({
    type: "evidence-requested",
    subjectRef: "er1",
    payload: { evidenceRequestId: "er1", twinVersionId: "tv2", targetDeficiency: "geometric-error:face-hands", reason: "remediate" },
  });

  const projection = replayTwinLedger(ledger.events());
  assert.equal(projection.solutionId, "you_w3a_ledger_test");
  // Twin summary: publications in order, canonical from the last promotion.
  assert.deepEqual(projection.twins["t1"], {
    displayName: "Twin 1",
    versionIds: ["tv1", "tv2"],
    latestVersionNumber: 2,
    canonicalVersionId: "tv2",
  });
  // Version statuses reflect the last transition; supersession linkage recorded.
  assert.equal(projection.twinVersions["tv1"]?.status, "superseded");
  assert.equal(projection.twinVersions["tv2"]?.status, "canonical");
  assert.equal(projection.twinVersions["tv1"]?.domainBlockCount, 3);
  assert.equal(projection.twinVersions["tv2"]?.evidenceBindingCount, 3);
  assert.deepEqual(projection.supersededBy, { tv1: "tv2" });
  // Quality facts fully reconstructed, including remediation links.
  const quality = projection.quality["tv1"];
  assert.ok(quality !== undefined);
  assert.deepEqual(quality.domainScores, { "face-hands": 0.6946, "geometry-skeleton": 0.8941 });
  assert.equal(quality.deficiencies.length, 2);
  assert.deepEqual(quality.deficiencies[0], {
    deficiencyClass: "geometric-error",
    domain: "face-hands",
    severity: 0.3054,
    remediationEvidenceRequestId: "er1",
  });
  assert.deepEqual(quality.deficiencies[1], {
    deficiencyClass: "coverage-gap",
    domain: "morphology",
    severity: 1,
    remediationEvidenceRequestId: "",
  });
  // Jobs and remediation requests.
  assert.deepEqual(projection.reconstructionJobs["job1"], {
    status: "completed",
    method: "hybrid",
    twinVersionId: "tv2",
    targetDomains: ["face-hands", "geometry-skeleton"],
    producedBlockCount: 2,
  });
  assert.deepEqual(projection.evidenceRequests["er1"], { targetDeficiency: "geometric-error:face-hands", twinVersionId: "tv2" });
});

test("a duplicate publication event for the same version id does not fork the projection", () => {
  const publication = (versionId: string): SolutionEvent =>
    deepFreeze({
      id: `evt-${versionId}`,
      solutionId: "you_w3a_ledger_test",
      type: "twin-version-published",
      occurredAt: "2026-01-01T00:00:00.000Z",
      subjectRef: versionId,
      payload: { kind: "publication", twinVersionId: versionId, twinId: "t1", twinDisplayName: "Twin 1", versionNumber: 1, statusAfter: "candidate", domainBlockCount: 1, evidenceBindingCount: 0 },
      provenance: { source: "t", generator: "fixture", createdAt: "2026-01-01T00:00:00.000Z", lineage: [] },
    });
  const projection = replayTwinLedger([publication("tv1"), publication("tv1")]);
  assert.equal(projection.twins["t1"]?.versionIds.length, 2);
  assert.equal(projection.twinVersions["tv1"]?.versionNumber, 1);
});

test("replay is deterministic: same events => byte-identical projection", () => {
  const { ledger } = makeLedger();
  ledger.append({
    type: "twin-version-published",
    subjectRef: "tv1",
    payload: { kind: "publication", twinVersionId: "tv1", twinId: "t1", twinDisplayName: "Twin 1", versionNumber: 1, statusAfter: "candidate", domainBlockCount: 1, evidenceBindingCount: 0 },
  });
  ledger.append({
    type: "twin-quality-assessed",
    subjectRef: "tv1",
    payload: { twinVersionId: "tv1", assessedAt: "2026-01-01T00:00:01.000Z", deficiencyCount: 0, "score.morphology": 0.9 },
  });
  const events = ledger.events();
  assert.equal(stableStringify(replayTwinLedger(events)), stableStringify(replayTwinLedger([...events])));
});

test("a failed job completion folds the failure status without produced blocks", () => {
  const { ledger } = makeLedger();
  ledger.append({
    type: "reconstruction-job-submitted",
    subjectRef: "job9",
    payload: { jobId: "job9", twinVersionId: "tv1", method: "neural-appearance", targetDomains: "hair", targetDomainCount: 1, evidenceBindingCount: 0 },
  });
  ledger.append({
    type: "reconstruction-job-completed",
    subjectRef: "job9",
    payload: { jobId: "job9", statusAfter: "failed", producedBlockCount: 0, failureReason: "adapter-failure" },
  });
  const projection = replayTwinLedger(ledger.events());
  assert.equal(projection.reconstructionJobs["job9"]?.status, "failed");
  assert.equal(projection.reconstructionJobs["job9"]?.producedBlockCount, 0);
});
