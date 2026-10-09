import assert from "node:assert/strict";
import test from "node:test";
import type { OpaqueId } from "@zcode/shared";
import { projectRetention } from "../../../shared/src/you/evidenceRetention.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createEvidenceService, type EvidenceService } from "./evidenceService.js";
import { createTwinService, TwinService, type TwinService as TwinServiceType } from "./twinService.js";
import { createEvidenceServicePort } from "./twinServiceTypes.js";

const SOLUTION = "you_w3a_service_test";

interface Fixture {
  readonly evidence: EvidenceService;
  readonly twin: TwinServiceType;
  readonly policyId: OpaqueId;
  readonly evidenceIds: OpaqueId[];
}

/** Deterministic domain blocks through the twin service's own content store. */
function blocksFor(fixture: Fixture, seedText: string, domains: string[] = ["style"]): readonly import("@zcode/shared").HtirDomainBlock[] {
  const result = fixture.twin.synthesizeDomainBlocks(SOLUTION, { domains, seedText, provenanceSource: "test:blocks" });
  assert.ok(result.ok);
  return result.value.blocks;
}

/**
 * Wires the real wave-2 EvidenceService behind the twin service through
 * the port seam: one granted capture-consent policy + two recorded
 * evidence items (sensitive-media image, project-artifact depth).
 */
function createFixture(seed: string): Fixture {
  const evidence = createEvidenceService({ workspaceIdentity: "ws-w3a-service-test", seed: `${seed}:evidence` });
  const twin = createTwinService({
    workspaceIdentity: "ws-w3a-service-test",
    seed: `${seed}:twin`,
    evidencePort: createEvidenceServicePort(evidence, SOLUTION),
  });
  const opened = evidence.openCaptureSession(SOLUTION, {
    evidenceRequest: null,
    scope: "USER",
    consent: {
      purposes: ["solution-generation", "quality-improvement"],
      operationalUse: true,
      learningReuse: false,
      retention: projectRetention("2099-01-01T00:00:00.000Z", "service test consent"),
      revocable: true,
    },
  });
  assert.ok(opened.ok);
  const granted = evidence.grantConsent(SOLUTION, opened.value.consentPolicyId);
  assert.ok(granted.ok);
  const evidenceIds: OpaqueId[] = [];
  for (const spec of [
    { modality: "image" as const, privacyClass: "sensitive-media" as const },
    { modality: "depth" as const, privacyClass: "project-artifact" as const },
  ]) {
    const recorded = evidence.recordEvidence(SOLUTION, {
      evidenceRequestId: null,
      captureSessionId: null,
      evidenceType: "fixture",
      modality: spec.modality,
      privacyClass: spec.privacyClass,
      retention: projectRetention("2099-01-01T00:00:00.000Z", "service test evidence"),
      consentPolicyId: opened.value.consentPolicyId,
    });
    assert.ok(recorded.ok);
    evidenceIds.push(recorded.value.record.id);
  }
  return { evidence, twin, policyId: opened.value.consentPolicyId, evidenceIds };
}

function publishSeedVersion(fixture: Fixture, domains: string[] = ["identity-binding", "morphology", "geometry-skeleton"]) {
  const created = fixture.twin.createTwin(SOLUTION, { displayName: "Service Test Twin" });
  assert.ok(created.ok);
  const blocks = fixture.twin.synthesizeDomainBlocks(SOLUTION, { domains, seedText: "service-test-v1", provenanceSource: "test:v1" });
  assert.ok(blocks.ok);
  const published = fixture.twin.publishTwinVersion(SOLUTION, created.value.twin.id, {
    domainBlocks: blocks.value.blocks,
    evidence: { evidenceIds: fixture.evidenceIds },
    provenanceSource: "test:v1",
  });
  assert.ok(published.ok);
  return { twinId: created.value.twin.id, version: published.value.version };
}

test("unknown twins and versions are typed YOU_TWIN_NOT_FOUND / YOU_VERSION_NOT_FOUND", () => {
  const fixture = createFixture("errors");
  const missingTwin = fixture.twin.publishTwinVersion(SOLUTION, "you_twin_missing", {
    domainBlocks: [],
    provenanceSource: "t",
  });
  assert.ok(!missingTwin.ok);
  assert.equal(missingTwin.error.code, "YOU_TWIN_NOT_FOUND");
  assert.equal(missingTwin.error.details["reason"], "unknown-twin");

  const { twinId } = publishSeedVersion(fixture);
  const missingVersion = fixture.twin.promoteTwinVersion(SOLUTION, twinId, "you_twin-version_missing");
  assert.ok(!missingVersion.ok);
  assert.equal(missingVersion.error.code, "YOU_VERSION_NOT_FOUND");

  const readMissing = fixture.twin.twinVersionOf(SOLUTION, twinId, "you_twin-version_missing");
  assert.ok(!readMissing.ok);
  assert.equal(readMissing.error.code, "YOU_VERSION_NOT_FOUND");
});

test("publication enforces monotonic version numbers and rejects invalid domain blocks", () => {
  const fixture = createFixture("monotonic");
  const { twinId, version } = publishSeedVersion(fixture);
  assert.equal(version.version, 1);
  assert.equal(version.status, "candidate");
  const blocks = fixture.twin.synthesizeDomainBlocks(SOLUTION, { domains: ["identity-binding", "morphology"], seedText: "service-test-v2", provenanceSource: "test:v2" });
  assert.ok(blocks.ok);
  const second = fixture.twin.publishTwinVersion(SOLUTION, twinId, {
    domainBlocks: blocks.value.blocks,
    provenanceSource: "test:v2",
  });
  assert.ok(second.ok);
  assert.equal(second.value.version.version, 2);

  const duplicateBlocks = [...blocks.value.blocks, blocks.value.blocks[0]!];
  const duplicate = fixture.twin.publishTwinVersion(SOLUTION, twinId, { domainBlocks: duplicateBlocks, provenanceSource: "t" });
  assert.ok(!duplicate.ok);
  assert.equal(duplicate.error.code, "YOU_HTIR_DOMAIN_INVALID");

  const empty = fixture.twin.publishTwinVersion(SOLUTION, twinId, { domainBlocks: [], provenanceSource: "t" });
  assert.ok(!empty.ok);
  assert.equal(empty.error.code, "YOU_INVALID_STATE");
});

test("promotion supersedes the previous canonical and refuses replays with YOU_IMMUTABLE_VIOLATION", () => {
  const fixture = createFixture("promotion");
  const { twinId, version: v1 } = publishSeedVersion(fixture);
  const promotedV1 = fixture.twin.promoteTwinVersion(SOLUTION, twinId, v1.id);
  assert.ok(promotedV1.ok);
  assert.equal(promotedV1.value.version.status, "canonical");
  assert.equal(promotedV1.value.superseded, null);

  const replay = fixture.twin.promoteTwinVersion(SOLUTION, twinId, v1.id);
  assert.ok(!replay.ok);
  assert.equal(replay.error.code, "YOU_IMMUTABLE_VIOLATION");

  const blocks = fixture.twin.synthesizeDomainBlocks(SOLUTION, { domains: ["identity-binding", "morphology", "geometry-skeleton"], seedText: "service-test-v2", provenanceSource: "test:v2" });
  assert.ok(blocks.ok);
  const v2 = fixture.twin.publishTwinVersion(SOLUTION, twinId, { domainBlocks: blocks.value.blocks, provenanceSource: "test:v2" });
  assert.ok(v2.ok);
  const promotedV2 = fixture.twin.promoteTwinVersion(SOLUTION, twinId, v2.value.version.id);
  assert.ok(promotedV2.ok);
  assert.ok(promotedV2.value.superseded !== null);
  assert.equal(promotedV2.value.superseded.id, v1.id);
  assert.equal(promotedV2.value.superseded.status, "superseded");

  const canonical = fixture.twin.canonicalVersionOf(SOLUTION, twinId);
  assert.ok(canonical.ok);
  assert.equal(canonical.value.version?.id, v2.value.version.id);

  const supersededReplay = fixture.twin.promoteTwinVersion(SOLUTION, twinId, v1.id);
  assert.ok(!supersededReplay.ok);
  assert.equal(supersededReplay.error.code, "YOU_IMMUTABLE_VIOLATION");
});

test("published versions stay byte-identical across promotion except the status field", () => {
  const fixture = createFixture("immutability");
  const { twinId, version: v1 } = publishSeedVersion(fixture);
  const before = stableStringify({ ...v1, status: undefined });
  const promoted = fixture.twin.promoteTwinVersion(SOLUTION, twinId, v1.id);
  assert.ok(promoted.ok);
  const after = fixture.twin.twinVersionOf(SOLUTION, twinId, v1.id);
  assert.ok(after.ok);
  assert.equal(stableStringify({ ...after.value.version, status: undefined }), before);
  assert.throws(() => {
    (after.value.version as unknown as { version: number }).version = 99;
  });
});

test("binding-time consent matrix: granted binds, expired blocks, unknown evidence is typed", () => {
  const granted = createFixture("consent-granted");
  const { twinId } = publishSeedVersion(granted);
  const bound = granted.twin.publishTwinVersion(SOLUTION, twinId, {
    domainBlocks: blocksFor(granted, "bind-granted"),
    evidence: { evidenceIds: granted.evidenceIds },
    provenanceSource: "t",
  });
  assert.ok(bound.ok);
  assert.equal(bound.value.version.evidenceBindings.length, 2);
  for (const binding of bound.value.version.evidenceBindings) {
    assert.equal(binding.consent.state, "granted");
  }

  // A denied consent policy blocks evidence RECORDING itself (W2
  // fail-closed) — denied evidence never exists to bind. The reachable
  // non-granted binding state is expiry/withdrawal:
  const expired = createFixture("consent-expired");
  assert.ok(expired.evidence.expireConsent(SOLUTION, expired.policyId).ok);
  const expiredTwin = expired.twin.createTwin(SOLUTION, { displayName: "T" });
  assert.ok(expiredTwin.ok);
  const blockedExpired = expired.twin.publishTwinVersion(SOLUTION, expiredTwin.value.twin.id, {
    domainBlocks: blocksFor(expired, "bind-expired"),
    evidence: { evidenceIds: expired.evidenceIds },
    provenanceSource: "t",
  });
  assert.ok(!blockedExpired.ok);
  assert.equal(blockedExpired.error.code, "YOU_CONSENT_REQUIRED");
  assert.equal(blockedExpired.error.details["reason"], "consent-expired");

  const unknown = granted.twin.publishTwinVersion(SOLUTION, twinId, {
    domainBlocks: blocksFor(granted, "bind-unknown"),
    evidence: { evidenceIds: ["you_evidence_missing"] },
    provenanceSource: "t",
  });
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.code, "YOU_EVIDENCE_NOT_FOUND");
});

test("withdrawal blocks NEW bindings and processing; published versions keep their provenance", () => {
  const fixture = createFixture("withdrawal");
  const { twinId, version: v1 } = publishSeedVersion(fixture);
  const promoted = fixture.twin.promoteTwinVersion(SOLUTION, twinId, v1.id);
  assert.ok(promoted.ok);

  const withdrawn = fixture.evidence.withdrawConsent(SOLUTION, fixture.policyId);
  assert.ok(withdrawn.ok);
  assert.equal(withdrawn.value.reference.state, "withdrawn");

  const blocks = fixture.twin.synthesizeDomainBlocks(SOLUTION, { domains: ["style"], seedText: "post-withdrawal", provenanceSource: "t" });
  assert.ok(blocks.ok);
  const blockedByIds = fixture.twin.publishTwinVersion(SOLUTION, twinId, {
    domainBlocks: blocks.value.blocks,
    evidence: { evidenceIds: fixture.evidenceIds },
    provenanceSource: "t",
  });
  assert.ok(!blockedByIds.ok);
  assert.equal(blockedByIds.error.code, "YOU_CONSENT_REQUIRED");
  assert.equal(blockedByIds.error.details["reason"], "consent-withdrawn");
  assert.equal(blockedByIds.error.details["liveConsentState"], "withdrawn");

  const blockedByPrebuilt = fixture.twin.publishTwinVersion(SOLUTION, twinId, {
    domainBlocks: blocks.value.blocks,
    evidence: { bindings: v1.evidenceBindings },
    provenanceSource: "t",
  });
  assert.ok(!blockedByPrebuilt.ok);
  assert.equal(blockedByPrebuilt.error.code, "YOU_CONSENT_REQUIRED");

  const blockedJob = fixture.twin.submitReconstructionJob(SOLUTION, {
    twinVersionId: v1.id,
    method: "hybrid",
    targetDomains: ["face-hands"],
    evidence: { evidenceIds: fixture.evidenceIds },
  });
  assert.ok(!blockedJob.ok);
  assert.equal(blockedJob.error.code, "YOU_CONSENT_REQUIRED");

  // Already-published immutable versions keep their recorded provenance.
  const stillThere = fixture.twin.twinVersionOf(SOLUTION, twinId, v1.id);
  assert.ok(stillThere.ok);
  assert.equal(stillThere.value.version.evidenceBindings.length, 2);
  for (const binding of stillThere.value.version.evidenceBindings) {
    assert.equal(binding.consent.state, "granted");
    assert.ok(binding.evidenceContentHash.length > 0);
  }
});

test("pre-built bindings with a tampered content hash are typed YOU_CONTENT_HASH_MISMATCH", () => {
  const fixture = createFixture("hash-mismatch");
  const { twinId, version: v1 } = publishSeedVersion(fixture);
  const tampered = v1.evidenceBindings.map((binding, index) =>
    index === 0 ? { ...binding, evidenceContentHash: "0".repeat(64) } : binding,
  );
  const blocks = fixture.twin.synthesizeDomainBlocks(SOLUTION, { domains: ["style"], seedText: "tamper", provenanceSource: "t" });
  assert.ok(blocks.ok);
  const refused = fixture.twin.publishTwinVersion(SOLUTION, twinId, {
    domainBlocks: blocks.value.blocks,
    evidence: { bindings: tampered },
    provenanceSource: "t",
  });
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, "YOU_CONTENT_HASH_MISMATCH");
});

test("reconstruction job state machine: legal transitions pass, illegal ones are typed refusals", () => {
  const fixture = createFixture("jobs");
  const { version: v1 } = publishSeedVersion(fixture);

  const submitted = fixture.twin.submitReconstructionJob(SOLUTION, {
    twinVersionId: v1.id,
    method: "hybrid",
    targetDomains: ["face-hands", "geometry-skeleton"],
    evidence: { evidenceIds: fixture.evidenceIds },
  });
  assert.ok(submitted.ok);
  const jobId = submitted.value.spec.id;
  assert.equal(submitted.value.spec.targetDomains.length, 2);

  // Illegal: complete while queued, start twice, fail after terminal.
  const completeWhileQueued = fixture.twin.completeReconstructionJob(SOLUTION, jobId);
  assert.ok(!completeWhileQueued.ok);
  assert.equal(completeWhileQueued.error.code, "YOU_INVALID_STATE");
  assert.equal(completeWhileQueued.error.details["fromStatus"], "queued");
  assert.equal(completeWhileQueued.error.details["toStatus"], "completed");

  const started = fixture.twin.startReconstructionJob(SOLUTION, jobId);
  assert.ok(started.ok);
  assert.equal(started.value.status, "running");

  const startAgain = fixture.twin.startReconstructionJob(SOLUTION, jobId);
  assert.ok(!startAgain.ok);
  assert.equal(startAgain.error.code, "YOU_INVALID_STATE");

  const completed = fixture.twin.completeReconstructionJob(SOLUTION, jobId);
  assert.ok(completed.ok);
  assert.equal(completed.value.result.status, "completed");
  assert.equal(completed.value.result.producedDomainBlocks.length, 2);
  assert.equal(completed.value.result.effortObservations["latencyMs.measured"], false);

  const completeAgain = fixture.twin.completeReconstructionJob(SOLUTION, jobId);
  assert.ok(!completeAgain.ok);
  assert.equal(completeAgain.error.code, "YOU_INVALID_STATE");
  const failAfterTerminal = fixture.twin.failReconstructionJob(SOLUTION, jobId, "too late");
  assert.ok(!failAfterTerminal.ok);
  assert.equal(failAfterTerminal.error.code, "YOU_INVALID_STATE");

  // A failed-from-queued job and a failed-from-running job are both legal.
  const failedFromQueued = fixture.twin.submitReconstructionJob(SOLUTION, { twinVersionId: v1.id, method: "hybrid", targetDomains: ["hair"] });
  assert.ok(failedFromQueued.ok);
  const failedQueued = fixture.twin.failReconstructionJob(SOLUTION, failedFromQueued.value.spec.id, "fixture adapter failure");
  assert.ok(failedQueued.ok);
  assert.equal(failedQueued.value.result.status, "failed");
  assert.deepEqual([...failedQueued.value.result.producedDomainBlocks], []);
  assert.equal(failedQueued.value.result.effortObservations["failureReason"], "fixture adapter failure");

  const failedFromRunning = fixture.twin.submitReconstructionJob(SOLUTION, { twinVersionId: v1.id, method: "neural-appearance", targetDomains: ["style"] });
  assert.ok(failedFromRunning.ok);
  assert.ok(fixture.twin.startReconstructionJob(SOLUTION, failedFromRunning.value.spec.id).ok);
  const failedRunning = fixture.twin.failReconstructionJob(SOLUTION, failedFromRunning.value.spec.id, "runtime failure");
  assert.ok(failedRunning.ok);
  assert.equal(failedRunning.value.result.status, "failed");

  const unknownJob = fixture.twin.startReconstructionJob(SOLUTION, "you_recon-job_missing");
  assert.ok(!unknownJob.ok);
  assert.equal(unknownJob.error.code, "YOU_INVALID_STATE");
});

test("publishVersionFromJobResult requires a completed job and publishes the produced blocks", () => {
  const fixture = createFixture("publish-from-job");
  const { twinId, version: v1 } = publishSeedVersion(fixture);
  const submitted = fixture.twin.submitReconstructionJob(SOLUTION, {
    twinVersionId: v1.id,
    method: "hybrid",
    targetDomains: ["face-hands"],
    evidence: { evidenceIds: fixture.evidenceIds },
  });
  assert.ok(submitted.ok);
  const early = fixture.twin.publishVersionFromJobResult(SOLUTION, twinId, submitted.value.spec.id);
  assert.ok(!early.ok);
  assert.equal(early.error.code, "YOU_INVALID_STATE");
  assert.equal(early.error.details["reason"], "job-not-completed");

  assert.ok(fixture.twin.startReconstructionJob(SOLUTION, submitted.value.spec.id).ok);
  assert.ok(fixture.twin.completeReconstructionJob(SOLUTION, submitted.value.spec.id).ok);
  const published = fixture.twin.publishVersionFromJobResult(SOLUTION, twinId, submitted.value.spec.id);
  assert.ok(published.ok);
  assert.equal(published.value.version.version, 2);
  assert.deepEqual(
    published.value.version.domainBlocks.map((block) => block.domain),
    ["face-hands"],
  );
  assert.equal(published.value.version.evidenceBindings.length, 2);
});

test("unsupported method/domain combinations are typed YOU_RECONSTRUCTION_UNSUPPORTED before any consent check", () => {
  const fixture = createFixture("unsupported");
  const { version: v1 } = publishSeedVersion(fixture);
  // Even with withdrawn consent, the unsupported combination wins (fail-fast).
  assert.ok(fixture.evidence.withdrawConsent(SOLUTION, fixture.policyId).ok);
  const refused = fixture.twin.submitReconstructionJob(SOLUTION, {
    twinVersionId: v1.id,
    method: "explicit-geometry",
    targetDomains: ["voice"],
    evidence: { evidenceIds: fixture.evidenceIds },
  });
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, "YOU_RECONSTRUCTION_UNSUPPORTED");
  assert.equal(refused.error.details["unsupportedDomains"], "voice");
  assert.equal(refused.error.details["method"], "explicit-geometry");

  const unknownMethod = fixture.twin.submitReconstructionJob(SOLUTION, {
    twinVersionId: v1.id,
    method: "photogrammetry-v2",
    targetDomains: ["geometry-skeleton"],
  });
  assert.ok(!unknownMethod.ok);
  assert.equal(unknownMethod.error.code, "YOU_RECONSTRUCTION_UNSUPPORTED");

  const emptyTargets = fixture.twin.submitReconstructionJob(SOLUTION, {
    twinVersionId: v1.id,
    method: "hybrid",
    targetDomains: [],
  });
  assert.ok(!emptyTargets.ok);
  assert.equal(emptyTargets.error.code, "YOU_RECONSTRUCTION_UNSUPPORTED");
});

test("remediation requests are idempotent per deficiency key and populate the next publication", () => {
  const fixture = createFixture("remediation");
  const { twinId } = publishSeedVersion(fixture);
  // Give v1 a low-score deficiency.
  const deficientBlocks = blocksFor(fixture, "deficient", ["identity-binding", "morphology", "geometry-skeleton", "face-hands"]).map(
    (block) => ({ ...block, confidence: block.domain === "face-hands" ? 0.5 : 0.9 }),
  );
  const deficient = fixture.twin.publishTwinVersion(SOLUTION, twinId, {
    domainBlocks: deficientBlocks,
    evidence: { evidenceIds: fixture.evidenceIds },
    provenanceSource: "t",
  });
  assert.ok(deficient.ok);
  const deficiency = deficient.value.version.quality.deficiencies.find((entry) => entry.domain === "face-hands");
  assert.ok(deficiency !== undefined);
  assert.equal(deficiency.remediationEvidenceRequestId, null);

  const opened = fixture.twin.openRemediationEvidenceRequest(SOLUTION, twinId, deficient.value.version.id, deficiency.id);
  assert.ok(opened.ok);
  assert.equal(opened.value.alreadyLinked, false);
  assert.equal(opened.value.request.targetDeficiency, `${deficiency.deficiencyClass}:face-hands`);

  const again = fixture.twin.openRemediationEvidenceRequest(SOLUTION, twinId, deficient.value.version.id, deficiency.id);
  assert.ok(again.ok);
  assert.equal(again.value.alreadyLinked, true);
  assert.equal(again.value.request.id, opened.value.request.id);

  const unknownDeficiency = fixture.twin.openRemediationEvidenceRequest(SOLUTION, twinId, deficient.value.version.id, "you_twin-deficiency_missing");
  assert.ok(!unknownDeficiency.ok);
  assert.equal(unknownDeficiency.error.code, "YOU_INVALID_STATE");

  // A NEW publication of the same deficient facet carries the request id.
  const republished = fixture.twin.publishTwinVersion(SOLUTION, twinId, {
    domainBlocks: deficient.value.version.domainBlocks.map((block) => ({ ...block })),
    evidence: { evidenceIds: fixture.evidenceIds },
    provenanceSource: "t:republish",
  });
  assert.ok(republished.ok);
  const linked = republished.value.version.quality.deficiencies.find((entry) => entry.domain === "face-hands");
  assert.ok(linked !== undefined);
  assert.equal(linked.remediationEvidenceRequestId, opened.value.request.id);

  // The lookup API serves the same request.
  const served = fixture.twin.remediationRequestOfDeficiency(SOLUTION, twinId, deficient.value.version.id, deficiency.id);
  assert.ok(served.ok);
  assert.equal(served.value.request?.id, opened.value.request.id);
});

test("a twin service without an evidence port publishes evidence-free versions and refuses evidence-bound ones", () => {
  const twin = createTwinService({ workspaceIdentity: "ws-no-port", seed: "no-port" });
  const created = twin.createTwin(SOLUTION, { displayName: "No Port Twin" });
  assert.ok(created.ok);
  const blocks = twin.synthesizeDomainBlocks(SOLUTION, { domains: ["style"], seedText: "s", provenanceSource: "t" });
  assert.ok(blocks.ok);
  const published = twin.publishTwinVersion(SOLUTION, created.value.twin.id, { domainBlocks: blocks.value.blocks, provenanceSource: "t" });
  assert.ok(published.ok);
  assert.equal(published.value.version.evidenceBindings.length, 0);
  // No bindings => provenance-missing deficiency (deterministic quality model).
  assert.equal(published.value.version.quality.deficiencies.some((entry) => entry.deficiencyClass === "provenance-missing"), true);

  const refused = twin.publishTwinVersion(SOLUTION, created.value.twin.id, {
    domainBlocks: blocks.value.blocks,
    evidence: { evidenceIds: ["you_evidence_any"] },
    provenanceSource: "t",
  });
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, "YOU_INVALID_STATE");
  assert.equal(refused.error.details["reason"], "evidence-port-not-configured");
});

test("the live projection equals the ledger replay exactly (append-only state reproduction)", () => {
  const fixture = createFixture("replay");
  const { twinId, version: v1 } = publishSeedVersion(fixture);
  assert.ok(fixture.twin.promoteTwinVersion(SOLUTION, twinId, v1.id).ok);
  const submitted = fixture.twin.submitReconstructionJob(SOLUTION, {
    twinVersionId: v1.id,
    method: "hybrid",
    targetDomains: ["face-hands", "geometry-skeleton"],
    evidence: { evidenceIds: fixture.evidenceIds },
  });
  assert.ok(submitted.ok);
  assert.ok(fixture.twin.startReconstructionJob(SOLUTION, submitted.value.spec.id).ok);
  assert.ok(fixture.twin.completeReconstructionJob(SOLUTION, submitted.value.spec.id).ok);
  const v2 = fixture.twin.publishVersionFromJobResult(SOLUTION, twinId, submitted.value.spec.id);
  assert.ok(v2.ok);
  assert.ok(fixture.twin.promoteTwinVersion(SOLUTION, twinId, v2.value.version.id).ok);
  const deficiency = v2.value.version.quality.deficiencies[0];
  if (deficiency !== undefined) {
    assert.ok(fixture.twin.openRemediationEvidenceRequest(SOLUTION, twinId, v2.value.version.id, deficiency.id).ok);
  }
  assert.ok(fixture.twin.assessTwinQualityOf(SOLUTION, twinId, v2.value.version.id).ok);

  const events = fixture.twin.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  assert.ok(events.value.length > 0);
  const projection = fixture.twin.projectionOf(SOLUTION);
  assert.ok(projection.ok);
  const replayed = TwinService.replay(events.value);
  assert.equal(stableStringify(projection.value), stableStringify(replayed));
  // Append-only: the serialized ledger is a prefix-stable, parseable record.
  const serialized = fixture.twin.serializeLedgerOf(SOLUTION);
  assert.ok(serialized.ok);
  assert.ok(JSON.parse(serialized.value).length === events.value.length);
});

test("recorded evidence resolves through the port with the frozen enforcement decision", () => {
  const fixture = createFixture("port");
  const firstEvidenceId = fixture.evidenceIds[0];
  assert.ok(firstEvidenceId !== undefined);
  const record = fixture.evidence.evidenceRecordOf(SOLUTION, firstEvidenceId);
  assert.ok(record.ok);
  assert.equal(record.value.simulated, true);
  const decision = fixture.evidence.checkProcessing(SOLUTION, firstEvidenceId, "solution-generation");
  assert.ok(decision.ok);
  assert.equal(decision.value.outcome.allowed, true);
  assert.equal(decision.value.outcome.reason, "consent-active");
});
