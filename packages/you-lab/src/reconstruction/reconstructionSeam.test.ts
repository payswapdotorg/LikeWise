// Reconstruction contract seam tests (W3C) — coverage area 4: mapping onto
// the frozen v3 twin/reconstruction contracts produces valid frozen-contract
// shapes: ReconstructionJobSpec -> ReconstructionJobResult through the
// provider-neutral adapter; HtirDomainBlock construction (content referenced,
// never inlined); TwinVersion assembly from adapter outputs; honest effort
// markers. Type-only imports from the frozen contract are compile-time
// assertions that the constructed shapes ARE the frozen v3 shapes (runtime
// field assertions follow the W2C convention of not importing contract
// values into you-lab tests).
import assert from "node:assert/strict";
import test from "node:test";
import type {
  HtirDomainBlock,
  ReconstructionJobResult,
  ReconstructionJobSpec,
  TwinEvidenceBinding,
  TwinQualityState,
  TwinVersion,
} from "../../../shared/src/you/contract.js";
import {
  reconstructThroughAdapter,
  toEffortObservations,
  toHtirDomainBlocks,
  toNeutralReconstructionRequest,
  toReconstructionJobResult,
  toTwinQualityState,
  toTwinVersion,
  type ReconstructionBlockContext,
  type TwinAssemblyConstruction,
  type TwinDeficiencyConstruction,
} from "../contractSeam.js";
import { createReconstructionRegistry } from "../technology/reconstructionSeedProfiles.js";
import { createColmapPhotogrammetryAdapter } from "./colmapPhotogrammetryAdapter.js";
import { createMockReconstructionAdapter } from "./mockReconstructionAdapter.js";
import { deriveReconstructionEvidence } from "./reconstructionEvidence.js";
import { RECONSTRUCTION_BENCHMARK_DOMAINS } from "./reconstructionAdapterSeam.js";
import { scoreDomainBlocks, reconstructionQualityEntries } from "./domainBlockScorer.js";

const registry = createReconstructionRegistry();
const colmapAdapter = createColmapPhotogrammetryAdapter(registry);
const mockAdapter = createMockReconstructionAdapter({
  id: "mock-recon-seam",
  method: "hybrid",
  confidenceBase: 0.6,
  evidenceSensitivity: 0.3,
  domainDropoutRate: 0,
  confidenceJitter: 0.02,
});

const EVIDENCE_SPEC = {
  capture: { frames: 2, width: 20, height: 20, modality: "image" as const, includeProp: true },
  viewCount: 6,
};
const evidence = deriveReconstructionEvidence("w3c-seam-seed", EVIDENCE_SPEC).evidence;

const blockProvenance = {
  source: "you-lab reconstruction fixture",
  generator: "fixture" as const,
  createdAt: "2026-10-11T12:00:00Z",
  lineage: ["recon-job-seam-1", "twin-version-seam-1"],
};

function jobSpec(): ReconstructionJobSpec {
  return {
    id: "recon-job-seam-1",
    twinVersionId: "twin-version-seam-1",
    method: "hybrid",
    targetDomains: [...(RECONSTRUCTION_BENCHMARK_DOMAINS.hybrid ?? [])].sort(),
    evidenceBindings: evidence.map((item) => ({
      evidenceId: item.evidenceId,
      evidenceContentHash: item.contentHash,
      consent: { policyId: "cp-w3c-seam", state: "granted", learningPermission: false },
    })),
    createdAt: "2026-10-11T11:00:00Z",
  };
}

test("reconstruction seam: frozen spec maps 1:1 onto the neutral adapter request", () => {
  const spec = jobSpec();
  const request = toNeutralReconstructionRequest(spec, evidence);
  assert.equal(request.requestId, spec.id);
  assert.equal(request.twinVersionId, spec.twinVersionId);
  assert.equal(request.method, spec.method);
  assert.deepEqual(request.targetDomains, spec.targetDomains);
  assert.equal(request.submittedAt, spec.createdAt);
  assert.equal(request.evidence.length, evidence.length);
  for (const binding of spec.evidenceBindings) {
    const match = request.evidence.find((item) => item.evidenceId === binding.evidenceId);
    assert.ok(match, `${binding.evidenceId}: resolved`);
    assert.equal(match.contentHash, binding.evidenceContentHash, "hash carried 1:1");
  }
});

test("reconstruction seam: unresolved or mismatched evidence bindings are typed rejections", () => {
  const spec = jobSpec();
  assert.throws(() => toNeutralReconstructionRequest(spec, []), /no resolved evidence/);
  assert.throws(
    () =>
      toNeutralReconstructionRequest(spec, [
        { ...evidence[0]!, contentHash: "0".repeat(64) },
        ...evidence.slice(1),
      ]),
    /content-hash mismatch/,
  );
  const extra = [...evidence, { ...evidence[0]!, evidenceId: "ev-recon-extra" }];
  assert.throws(() => toNeutralReconstructionRequest(spec, extra), /unresolved extra evidence/);
  const emptyDomains: ReconstructionJobSpec = { ...spec, targetDomains: [] };
  assert.throws(() => toNeutralReconstructionRequest(emptyDomains, evidence), /at least one target domain/);
});

test("reconstruction seam: neutral blocks construct valid frozen v3 HtirDomainBlocks", () => {
  const output = mockAdapter.reconstruct(toNeutralReconstructionRequest(jobSpec(), evidence));
  const context: ReconstructionBlockContext = { provenance: blockProvenance };
  const blocks = toHtirDomainBlocks(output.producedBlocks, context);
  // frozen v3 HtirDomainBlock field set, 1:1 with the neutral blocks
  const frozen: readonly HtirDomainBlock[] = blocks;
  assert.equal(frozen.length, output.producedBlocks.length);
  for (let index = 0; index < frozen.length; index++) {
    const block = frozen[index];
    const neutral = output.producedBlocks[index];
    assert.ok(block && neutral);
    assert.equal(block.id, neutral.blockId);
    assert.equal(block.domain, neutral.domain);
    assert.equal(block.contentRef, neutral.contentRef);
    assert.equal(block.contentHash, neutral.contentHash);
    assert.equal(block.confidence, neutral.confidence);
    assert.equal(block.simulated, true, "truth law: simulated stays labeled");
    assert.deepEqual(block.provenance, blockProvenance, "provenance injected by the caller");
    assert.ok(!("payload" in block), "payload bytes dropped at the seam (content never inlined)");
    assert.ok(/^[0-9a-f]{64}$/.test(block.contentHash), "sha-256 hex content hash");
  }
});

test("reconstruction seam: malformed blocks are typed rejections (never silently repaired)", () => {
  const output = mockAdapter.reconstruct(toNeutralReconstructionRequest(jobSpec(), evidence));
  const context: ReconstructionBlockContext = { provenance: blockProvenance };
  const blocks = output.producedBlocks;
  assert.throws(() => toHtirDomainBlocks([{ ...blocks[0]!, contentRef: "" }], context), /contentRef/);
  assert.throws(() => toHtirDomainBlocks([{ ...blocks[0]!, contentHash: "deadbeef" }], context), /sha-256 hex/);
  assert.throws(() => toHtirDomainBlocks([{ ...blocks[0]!, confidence: 1.5 }], context), /outside \[0, 1\]/);
});

test("reconstruction seam: effort MetricFields project onto honest effortObservations records", () => {
  const output = mockAdapter.reconstruct(toNeutralReconstructionRequest(jobSpec(), evidence));
  const observations = toEffortObservations(output.effort, output.producedBlocks.length, evidence.length);
  assert.equal(observations["domainBlocksProduced"], output.producedBlocks.length);
  assert.equal(observations["evidenceBindingsProcessed"], evidence.length);
  assert.equal(observations["simulated"], true);
  for (const key of ["computeEffort", "latencyMs", "costUnits"]) {
    assert.equal(observations[`${key}.measured`], false, `${key}: not measured`);
    assert.equal(observations[key], "not-measured (simulated)", `${key}: explicit marker`);
  }
  // estimate-kind fields stay honestly simulated
  const estimateObservations = toEffortObservations(
    {
      effort: { kind: "not-measured", marker: "not-measured (simulated)" },
      latency: { kind: "estimate", value: 900, unit: "ms", simulated: true, basis: "fixture estimate" },
      cost: { kind: "not-measured", marker: "not-measured (simulated)" },
    },
    1,
    1,
  );
  assert.equal(estimateObservations["latencyMs.measured"], false);
  assert.equal(estimateObservations["latencyMs.estimate"], 900);
  assert.equal(estimateObservations["latencyMs.simulated"], true);
  assert.ok(!("computeEffort.estimate" in estimateObservations));
});

test("reconstruction seam: spec -> adapter -> frozen ReconstructionJobResult (the W3C mapping)", () => {
  const spec = jobSpec();
  const result = reconstructThroughAdapter(spec, mockAdapter, evidence, {
    completedAt: "2026-10-11T12:30:00Z",
    blockProvenance,
  });
  // compile-time: the result IS the frozen v3 ReconstructionJobResult
  const frozen: ReconstructionJobResult = result;
  assert.equal(frozen.jobId, spec.id);
  assert.equal(frozen.status, "completed");
  assert.equal(frozen.completedAt, "2026-10-11T12:30:00Z");
  assert.equal(frozen.simulated, true);
  assert.equal(frozen.producedDomainBlocks.length, spec.targetDomains.length);
  assert.deepEqual(
    frozen.producedDomainBlocks.map((block) => block.domain),
    spec.targetDomains,
  );
  assert.equal(frozen.effortObservations["domainBlocksProduced"], spec.targetDomains.length);
  assert.equal(frozen.effortObservations["evidenceBindingsProcessed"], spec.evidenceBindings.length);
  assert.equal(frozen.effortObservations["latencyMs"], "not-measured (simulated)");
});

test("reconstruction seam: the colmap evaluation adapter flows through the same frozen mapping", () => {
  const spec: ReconstructionJobSpec = {
    ...jobSpec(),
    method: "explicit-geometry",
    targetDomains: [...(RECONSTRUCTION_BENCHMARK_DOMAINS["explicit-geometry"] ?? [])].sort(),
  };
  const result = reconstructThroughAdapter(spec, colmapAdapter, evidence, {
    completedAt: "2026-10-11T12:45:00Z",
    blockProvenance,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.producedDomainBlocks.length, 6);
  assert.equal(result.simulated, true);
  assert.equal(result.effortObservations["latencyMs"], "not-measured (simulated)");
  assert.equal(result.effortObservations["computeEffort"], "not-measured (simulated)");
});

test("reconstruction seam: failed outputs construct failed job results with the failure reason", () => {
  const spec = jobSpec();
  const output = mockAdapter.reconstruct(toNeutralReconstructionRequest(spec, evidence));
  const result = toReconstructionJobResult({
    spec,
    output: {
      ...output,
      status: "failed",
      failureReason: "fixture-simulated failure",
      producedBlocks: [],
    },
    completedAt: "2026-10-11T13:00:00Z",
    blockProvenance,
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(result.producedDomainBlocks, [], "failed jobs produce no domain blocks");
  assert.equal(result.effortObservations["failureReason"], "fixture-simulated failure");
  assert.equal(result.simulated, true);
});

test("reconstruction seam: adapter output belonging to another job is a typed rejection", () => {
  const spec = jobSpec();
  const output = mockAdapter.reconstruct(toNeutralReconstructionRequest(spec, evidence));
  assert.throws(
    () =>
      toReconstructionJobResult({
        spec,
        output: { ...output, requestId: "another-job" },
        completedAt: "2026-10-11T13:00:00Z",
        blockProvenance,
      }),
    /does not belong to this job spec/,
  );
});

test("reconstruction seam: TwinVersion assembly from adapter outputs (frozen v3 shape)", () => {
  const spec = jobSpec();
  const request = toNeutralReconstructionRequest(spec, evidence);
  const output = mockAdapter.reconstruct(request);
  const parts = scoreDomainBlocks(output.producedBlocks, request.targetDomains, request.evidence, request.method);
  const quality = toTwinQualityState(reconstructionQualityEntries(parts), [], "2026-10-11T14:00:00Z");
  const construction: TwinAssemblyConstruction = {
    twinVersionId: "twin-version-seam-2",
    twinId: "twin-seam-1",
    version: 2,
    status: "candidate",
    evidenceBindings: spec.evidenceBindings,
    quality,
    createdAt: "2026-10-11T14:00:00Z",
    provenance: { ...blockProvenance, lineage: ["twin-version-seam-1"] },
    blockProvenance,
  };
  const twinVersion = toTwinVersion(construction, output.producedBlocks);
  // compile-time: the assembled version IS the frozen v3 TwinVersion
  const frozen: TwinVersion = twinVersion;
  assert.equal(frozen.id, "twin-version-seam-2");
  assert.equal(frozen.twinId, "twin-seam-1");
  assert.equal(frozen.version, 2);
  assert.equal(frozen.status, "candidate");
  assert.equal(frozen.domainBlocks.length, output.producedBlocks.length);
  assert.deepEqual(frozen.evidenceBindings, spec.evidenceBindings, "evidence bindings carried 1:1");
  assert.equal(frozen.createdAt, "2026-10-11T14:00:00Z");
  for (const block of frozen.domainBlocks) {
    assert.ok(!("payload" in block), "payload bytes never inlined into the twin version");
  }
});

test("reconstruction seam: TwinQualityState projects scorer entries + typed deficiencies", () => {
  const spec = jobSpec();
  const request = toNeutralReconstructionRequest(spec, evidence);
  const output = mockAdapter.reconstruct(request);
  const parts = scoreDomainBlocks(output.producedBlocks, request.targetDomains, request.evidence, request.method);
  const deficiencies: readonly TwinDeficiencyConstruction[] = [
    {
      id: "def-w3c-1",
      deficiencyClass: "coverage-gap",
      domain: "hair",
      severity: 0.25,
      remediationHint: "capture additional appearance evidence",
      remediationEvidenceRequestId: "er-w3c-1",
    },
  ];
  const quality = toTwinQualityState(reconstructionQualityEntries(parts), deficiencies, "2026-10-11T14:30:00Z");
  // compile-time: the quality state IS the frozen v3 TwinQualityState
  const frozen: TwinQualityState = quality;
  assert.deepEqual(Object.keys(frozen.domainScores), [
    "reconstruction.blocks.confidence-fidelity",
    "reconstruction.blocks.content-addressing",
    "reconstruction.blocks.domain-coverage",
    "reconstruction.blocks.score",
  ], "domain scores emitted in sorted order");
  for (const value of Object.values(frozen.domainScores)) {
    assert.ok(value >= 0 && value <= 1, `quality value in [0,1]: ${value}`);
  }
  assert.equal(frozen.deficiencies.length, 1);
  assert.equal(frozen.deficiencies[0]?.deficiencyClass, "coverage-gap");
  assert.equal(frozen.deficiencies[0]?.remediationEvidenceRequestId, "er-w3c-1");
  assert.equal(frozen.assessedAt, "2026-10-11T14:30:00Z");
  // out-of-range severity is a typed rejection — never silently clamped
  assert.throws(
    () => toTwinQualityState([], [{ ...deficiencies[0]!, severity: 1.5 }], "2026-10-11T14:30:00Z"),
    /outside \[0, 1\]/,
  );
});

test("reconstruction seam: twin assembly rejects malformed identity (never silent repair)", () => {
  const spec = jobSpec();
  const output = mockAdapter.reconstruct(toNeutralReconstructionRequest(spec, evidence));
  const quality = toTwinQualityState([], [], "2026-10-11T15:00:00Z");
  const base: TwinAssemblyConstruction = {
    twinVersionId: "tv-x",
    twinId: "twin-x",
    version: 1,
    status: "candidate",
    evidenceBindings: [],
    quality,
    createdAt: "2026-10-11T15:00:00Z",
    provenance: blockProvenance,
    blockProvenance,
  };
  assert.throws(() => toTwinVersion({ ...base, twinId: "" }, output.producedBlocks), /twinId/);
  assert.throws(() => toTwinVersion({ ...base, version: 0 }, output.producedBlocks), /positive integer/);
  assert.throws(() => toTwinVersion({ ...base, version: 1.5 }, output.producedBlocks), /positive integer/);
});

test("reconstruction seam: full W3C path — evidence -> adapter -> blocks -> job result -> twin version", () => {
  const spec = jobSpec();
  const jobResult = reconstructThroughAdapter(spec, mockAdapter, evidence, {
    completedAt: "2026-10-11T16:00:00Z",
    blockProvenance,
  });
  assert.equal(jobResult.status, "completed");
  // the twin service would promote the result blocks into a TwinVersion at the seam:
  const quality = toTwinQualityState(
    [
      { key: "reconstruction.blocks.score", value: 0.9 },
      { key: "twin.coverage.domains", value: 0.85 },
    ],
    [],
    "2026-10-11T16:30:00Z",
  );
  const twinVersion = toTwinVersion(
    {
      twinVersionId: "twin-version-seam-3",
      twinId: "twin-seam-1",
      version: 3,
      status: "canonical",
      evidenceBindings: spec.evidenceBindings,
      quality,
      createdAt: "2026-10-11T16:30:00Z",
      provenance: { ...blockProvenance, lineage: [spec.twinVersionId] },
      blockProvenance,
    },
    jobResult.producedDomainBlocks.map((block) => ({
      blockId: block.id,
      domain: block.domain,
      contentRef: block.contentRef,
      contentHash: block.contentHash,
      confidence: block.confidence,
      simulated: true as const,
      generator: "you-lab-mock-reconstruction-adapter/1",
      payload: new Uint8Array(0),
    })),
  );
  assert.equal(twinVersion.status, "canonical");
  assert.equal(twinVersion.domainBlocks.length, jobResult.producedDomainBlocks.length);
  const binding: TwinEvidenceBinding = twinVersion.evidenceBindings[0]!;
  assert.equal(binding.evidenceId, evidence[0]!.evidenceId);
  assert.equal(binding.evidenceContentHash, evidence[0]!.contentHash);
});
