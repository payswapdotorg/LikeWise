// Contract seam tests (W1C + W2C) — coverage: mapping onto the frozen
// @zcode/shared YOU contract v1 AND v2 produces valid frozen-contract shapes,
// and contractSeam.ts is the ONLY module touching the frozen contract.
// W2C coverage area 4: adapter observations construct valid EvidenceRecords /
// qualityObservations per the frozen v2 contracts.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  recommendationForArtifact,
  toEditorRecommendation,
  toEvidenceRecord,
  toEvidenceReview,
  toQualityObservations,
  toSolutionPatchOperations,
  type CaptureEvidenceContext,
  type QualityObservationEntry,
} from "./contractSeam.js";
import { createMockEditorAdapter } from "./adapters/mockEditorAdapter.js";
import type { CandidateOperation, NeutralEntity } from "./adapters/editorAdapterSeam.js";
import { deriveEditorCapabilityProfiles } from "./technology/editorCapability.js";
import { createDefaultRegistry } from "./technology/seedProfiles.js";
import { generateSyntheticCapture } from "./capture/syntheticPayload.js";
import { createMockSegmentationAdapter } from "./capture/mockSegmentationAdapter.js";
import { createMockPoseAdapter } from "./capture/mockPoseAdapter.js";
import { poseQualityEntries, scorePoseObservations, scoreSegmentationObservations, segmentationQualityEntries } from "./capture/observationScorer.js";

const registry = createDefaultRegistry();
const capabilities = deriveEditorCapabilityProfiles(registry);

test("contract seam: toEditorRecommendation produces a valid frozen EditorRecommendation shape", () => {
  const blender = capabilities.find((profile) => profile.technologyId === "blender");
  assert.ok(blender);
  const recommendation = toEditorRecommendation(blender, registry);
  // frozen contract fields: editorId, editorName, rationale, exportFormat
  assert.equal(typeof recommendation.editorId, "string");
  assert.ok(recommendation.editorId.length > 0);
  assert.equal(recommendation.editorName, "Blender");
  assert.ok(recommendation.rationale.includes("tier 3"));
  assert.ok(recommendation.rationale.includes("GPL"));
  assert.ok(recommendation.rationale.includes("https://"));
  assert.ok(["glb", "gltf"].includes(recommendation.exportFormat));
});

test("contract seam: recommendations are deterministic and cite verified license sources", () => {
  const svgEdit = capabilities.find((profile) => profile.technologyId === "svg-edit");
  assert.ok(svgEdit);
  const a = toEditorRecommendation(svgEdit, registry);
  const b = toEditorRecommendation(svgEdit, registry);
  assert.deepEqual(a, b);
  const technology = registry.byId("svg-edit");
  assert.ok(technology);
  assert.ok(a.rationale.includes(technology.license.sourceUrl));
});

test("contract seam: toSolutionPatchOperations maps candidate operations 1:1 onto frozen ops", () => {
  const entity: NeutralEntity = {
    id: "ent-1",
    kind: "synthetic-human",
    label: "Synthetic Human A",
    transform: { position: [0, 1, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
    attributes: { quality: 0.7, simulated: true },
  };
  const operations: CandidateOperation[] = [
    { op: "upsert_entity", entity },
    { op: "remove_entity", entityId: "ent-2" },
    { op: "update_environment", environment: { ambientIntensity: 0.5 } },
  ];
  const frozen = toSolutionPatchOperations(operations);
  assert.equal(frozen.length, 3);
  assert.ok(frozen[0] && frozen[0].op === "upsert_entity");
  if (frozen[0].op === "upsert_entity") {
    assert.equal(frozen[0].entity.id, "ent-1");
    assert.equal(frozen[0].entity.kind, "synthetic-human");
    assert.deepEqual(frozen[0].entity.transform.position, [0, 1, 2]);
  }
  assert.ok(frozen[1] && frozen[1].op === "remove_entity" && frozen[1].entityId === "ent-2");
  assert.ok(frozen[2] && frozen[2].op === "update_environment");
  if (frozen[2].op === "update_environment") {
    assert.equal(frozen[2].environment.ambientIntensity, 0.5);
  }
});

test("contract seam: recommendationForArtifact resolves through the registry", () => {
  const blenderCapability = capabilities.find((profile) => profile.technologyId === "blender");
  assert.ok(blenderCapability);
  const adapter = createMockEditorAdapter(blenderCapability);
  const artifact = adapter.exportArtifact({
    solutionId: "solution-1",
    versionId: "version-1",
    entities: [],
    environment: { keyLightDirection: [1, 0, 0], ambientIntensity: 0.3, background: "#000000" },
    targetTechnologyId: "blender",
    reason: "agent-edit",
  });
  const recommendation = recommendationForArtifact(artifact, capabilities, registry);
  assert.ok(recommendation);
  assert.equal(recommendation.editorId, "blender");
  const unknown = recommendationForArtifact(
    { ...artifact, technologyId: "not-a-technology" },
    capabilities,
    registry,
  );
  assert.equal(unknown, null);
});

test("contract seam: contractSeam.ts is the ONLY module referencing the frozen contract", () => {
  const srcDir = join(dirname(fileURLToPath(import.meta.url)));
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (name.endsWith(".ts") && !name.endsWith(".test.ts") && name !== "contractSeam.ts") {
        const text = readFileSync(path, "utf8");
        if (text.includes("shared/src/you/contract") || text.includes('from "@zcode/shared"')) {
          offenders.push(path);
        }
      }
    }
  };
  walk(srcDir);
  assert.deepEqual(offenders, [], `frozen contract must only be touched at the seam: ${offenders.join(", ")}`);
});

// ---------------------------------------------------------------------------
// W2C: seam mapping onto the frozen v2 evidence/capture/consent contracts
// ---------------------------------------------------------------------------

const CAPTURE_SPEC = { frames: 1, width: 16, height: 20, modality: "image" as const, includeProp: false };

function evidenceContextFixture(): CaptureEvidenceContext {
  return {
    evidenceId: "ev-0001",
    evidenceRequestId: "er-0007",
    captureSessionId: "cs-0042",
    contentRef: "content-store://synthetic/w2c-0001",
    contentHash: "5f2a1c9e",
    privacyClass: "sensitive-media",
    retention: { policy: "delete-after-review" as const, deleteAfter: "2026-10-16T00:00:00Z", reason: "fixture retention window" },
    consent: { policyId: "cp-0009", state: "granted" as const, learningPermission: false },
    capturedAt: "2026-10-09T12:00:00Z",
    provenance: {
      source: "you-lab capture fixture",
      generator: "fixture" as const,
      createdAt: "2026-10-09T12:00:00Z",
      lineage: [],
    },
  };
}

test("contract seam v2: adapter observations construct a valid frozen EvidenceRecord", () => {
  const { payload } = generateSyntheticCapture("seam-record-seed", CAPTURE_SPEC);
  const adapter = createMockPoseAdapter({ id: "mock-pose-seam", jitterAmplitude: 0.04, dropLandmarkCount: 0, visibilityFloor: 0.9 });
  const batch = adapter.observe(payload, "seam-record-seed");
  const record = toEvidenceRecord(evidenceContextFixture(), batch.observations, payload.modality);
  // frozen v2 EvidenceRecord field set, 1:1 with the injected context
  assert.equal(record.id, "ev-0001");
  assert.equal(record.evidenceRequestId, "er-0007");
  assert.equal(record.captureSessionId, "cs-0042");
  assert.equal(record.evidenceType, "reference-image");
  assert.equal(record.modality, "image");
  assert.equal(record.contentRef, "content-store://synthetic/w2c-0001");
  assert.equal(record.contentHash, "5f2a1c9e");
  assert.equal(record.privacyClass, "sensitive-media");
  assert.deepEqual(record.retention, evidenceContextFixture().retention);
  assert.deepEqual(record.consent, evidenceContextFixture().consent);
  assert.equal(record.capturedAt, "2026-10-09T12:00:00Z");
  assert.deepEqual(record.provenance, evidenceContextFixture().provenance);
  // truth law: simulated observations construct simulated-labeled evidence
  assert.equal(record.simulated, true);
});

test("contract seam v2: modality -> evidenceType mapping table is 1:1 and frozen-valid", () => {
  const cases: readonly [string, string][] = [
    ["image", "reference-image"],
    ["video", "reference-video"],
    ["depth", "measurement"],
    ["audio", "reference-audio"],
    ["measurement", "measurement"],
    ["document", "document"],
  ];
  const { payload } = generateSyntheticCapture("seam-modality-seed", { ...CAPTURE_SPEC, modality: "image" });
  const adapter = createMockPoseAdapter({ id: "mock-pose-mod", jitterAmplitude: 0.03, dropLandmarkCount: 0, visibilityFloor: 0.9 });
  const observations = adapter.observe(payload, "seam-modality-seed").observations;
  for (const [modality, expectedType] of cases) {
    const record = toEvidenceRecord(evidenceContextFixture(), observations, modality as typeof payload.modality);
    assert.equal(record.evidenceType, expectedType, modality);
    assert.equal(record.modality, modality, "modality carried 1:1");
  }
});

test("contract seam v2: EvidenceRecord construction is deterministic", () => {
  const { payload } = generateSyntheticCapture("seam-determinism-seed", CAPTURE_SPEC);
  const adapter = createMockSegmentationAdapter({
    id: "mock-seg-seam",
    chromaThreshold: 0.55,
    keepProbability: 0.95,
    stride: 1,
    minRegionBlocks: 4,
    confidenceBase: 0.9,
  });
  const observations = adapter.observe(payload, "seam-determinism-seed").observations;
  const first = toEvidenceRecord(evidenceContextFixture(), observations, payload.modality);
  const second = toEvidenceRecord(evidenceContextFixture(), observations, payload.modality);
  assert.deepEqual(first, second);
});

test("contract seam v2: zero observations or empty content fields are typed rejections", () => {
  const { payload } = generateSyntheticCapture("seam-reject-seed", CAPTURE_SPEC);
  const adapter = createMockPoseAdapter({ id: "mock-pose-reject", jitterAmplitude: 0.03, dropLandmarkCount: 0, visibilityFloor: 0.9 });
  const observations = adapter.observe(payload, "seam-reject-seed").observations;
  assert.throws(() => toEvidenceRecord(evidenceContextFixture(), [], payload.modality), /zero observations/);
  assert.throws(
    () => toEvidenceRecord({ ...evidenceContextFixture(), contentRef: "" }, observations, payload.modality),
    /contentRef/,
  );
  assert.throws(
    () => toEvidenceRecord({ ...evidenceContextFixture(), contentHash: "" }, observations, payload.modality),
    /contentHash/,
  );
});

test("contract seam v2: quality observations project onto the frozen SolutionQualityMap", () => {
  const entries: readonly QualityObservationEntry[] = [
    { key: "capture.pose.landmark-recall", value: 0.8235 },
    { key: "capture.segmentation.person-iou", value: 0.91 },
    { key: "capture.pose.score", value: 0.7 },
  ];
  const quality = toQualityObservations(entries);
  assert.deepEqual(Object.keys(quality), [
    "capture.pose.landmark-recall",
    "capture.pose.score",
    "capture.segmentation.person-iou",
  ], "keys emitted in sorted order");
  assert.equal(quality["capture.segmentation.person-iou"], 0.91);
  // out-of-range and malformed values are rejected — never silently clamped
  assert.throws(() => toQualityObservations([{ key: "k", value: 1.5 }]), /outside \[0, 1\]/);
  assert.throws(() => toQualityObservations([{ key: "k", value: -0.1 }]), /outside \[0, 1\]/);
  assert.throws(() => toQualityObservations([{ key: "", value: 0.5 }]), /empty quality key/);
});

test("contract seam v2: toEvidenceReview produces a valid frozen EvidenceReview shape", () => {
  const { payload } = generateSyntheticCapture("seam-review-seed", CAPTURE_SPEC);
  const adapter = createMockPoseAdapter({ id: "mock-pose-review", jitterAmplitude: 0.04, dropLandmarkCount: 0, visibilityFloor: 0.9 });
  const observations = adapter.observe(payload, "seam-review-seed").observations;
  const record = toEvidenceRecord(evidenceContextFixture(), observations, payload.modality);
  const parts = scorePoseObservations(observations, generateSyntheticCapture("seam-review-seed", CAPTURE_SPEC).groundTruth);
  const review = toEvidenceReview(
    {
      id: "rev-0001",
      evidenceId: record.id,
      reviewerType: "agent",
      status: "accepted",
      notes: "fixture review over simulated observations",
      reviewedAt: "2026-10-09T12:30:00Z",
    },
    poseQualityEntries(parts),
  );
  assert.equal(review.id, "rev-0001");
  assert.equal(review.evidenceId, "ev-0001");
  assert.equal(review.reviewerType, "agent");
  assert.equal(review.status, "accepted");
  assert.equal(review.reviewedAt, "2026-10-09T12:30:00Z");
  assert.deepEqual(Object.keys(review.qualityObservations), [
    "capture.pose.landmark-recall",
    "capture.pose.positional-quality",
    "capture.pose.score",
  ]);
  for (const value of Object.values(review.qualityObservations)) {
    assert.ok(value >= 0 && value <= 1, `quality value in [0,1]: ${value}`);
  }
});

test("contract seam v2: full W2C path — payload -> observations -> score -> EvidenceRecord + review", () => {
  const seed = "seam-e2e-seed";
  const { payload, groundTruth } = generateSyntheticCapture(seed, { ...CAPTURE_SPEC, includeProp: true });
  const segmentation = createMockSegmentationAdapter({
    id: "mock-seg-e2e",
    chromaThreshold: 0.55,
    keepProbability: 0.95,
    stride: 1,
    minRegionBlocks: 4,
    confidenceBase: 0.9,
  });
  const batch = segmentation.observe(payload, seed);
  assert.equal(batch.simulated, true);
  const parts = scoreSegmentationObservations(batch.observations, groundTruth);
  const record = toEvidenceRecord(evidenceContextFixture(), batch.observations, payload.modality);
  const review = toEvidenceReview(
    {
      id: "rev-0002",
      evidenceId: record.id,
      reviewerType: "fixture",
      status: "pending",
      notes: "end-to-end seam exercise",
      reviewedAt: "2026-10-09T13:00:00Z",
    },
    segmentationQualityEntries(parts),
  );
  assert.equal(record.simulated, true);
  assert.equal(review.qualityObservations["capture.segmentation.person-iou"], parts.personIoU);
  assert.equal(review.qualityObservations["capture.segmentation.score"], parts.segmentationScore);
});
