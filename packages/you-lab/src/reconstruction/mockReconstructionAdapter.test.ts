// Mock reconstruction adapter tests (W3C) — coverage area 2: adapter
// determinism (byte-identical replay from the request), typed refusals for
// unsupported combinations, method coverage across the three families,
// confidence bounds and simulated labels.
import assert from "node:assert/strict";
import test from "node:test";
import { createMockReconstructionAdapter } from "./mockReconstructionAdapter.js";
import { deriveReconstructionEvidence } from "./reconstructionEvidence.js";
import {
  NEUTRAL_HTIR_DOMAIN_BYTE_LENGTHS,
  NEUTRAL_HTIR_DOMAIN_DEFAULT_BYTE_LENGTH,
  RECONSTRUCTION_BENCHMARK_DOMAINS,
  sha256Hex,
  synthesizeNeutralDomainBytes,
  UnsupportedReconstructionCombinationError,
  unsupportedReconstructionDomains,
  type NeutralReconstructionRequest,
} from "./reconstructionAdapterSeam.js";

const EVIDENCE_SPEC = { capture: { frames: 2, width: 16, height: 20, modality: "image" as const, includeProp: true }, viewCount: 6 };
const { evidence } = deriveReconstructionEvidence("mock-recon-test-seed", EVIDENCE_SPEC);

function request(
  method: string,
  targetDomains: readonly string[],
  overrides: Partial<NeutralReconstructionRequest> = {},
): NeutralReconstructionRequest {
  return {
    requestId: "recon-mock-test-1",
    twinVersionId: "twin-test-1",
    method,
    targetDomains,
    evidence,
    submittedAt: "2026-10-11T12:00:00Z",
    ...overrides,
  };
}

const PRECISE_GEOMETRY = {
  id: "mock-recon-geometry-precise",
  method: "explicit-geometry",
  confidenceBase: 0.62,
  evidenceSensitivity: 0.33,
  domainDropoutRate: 0,
  confidenceJitter: 0.02,
};

test("mock reconstruction: byte-identical replay from the same request (blocks, hashes, payload bytes)", () => {
  const adapter = createMockReconstructionAdapter(PRECISE_GEOMETRY);
  const req = request("explicit-geometry", RECONSTRUCTION_BENCHMARK_DOMAINS["explicit-geometry"] ?? []);
  const first = adapter.reconstruct(req);
  const second = adapter.reconstruct(req);
  assert.deepEqual(first, second, "full output deep-equal on replay");
  for (const block of first.producedBlocks) {
    assert.ok(Buffer.isBuffer(block.payload) || block.payload instanceof Uint8Array, "payload bytes present");
    assert.equal(sha256Hex(block.payload), block.contentHash, "contentHash binds the payload bytes");
  }
});

test("mock reconstruction: different request ids produce different payload hashes (no cross-request collapse)", () => {
  const adapter = createMockReconstructionAdapter(PRECISE_GEOMETRY);
  const domains = RECONSTRUCTION_BENCHMARK_DOMAINS["explicit-geometry"] ?? [];
  const a = adapter.reconstruct(request("explicit-geometry", domains, { requestId: "recon-a" }));
  const b = adapter.reconstruct(request("explicit-geometry", domains, { requestId: "recon-b" }));
  const hashA = a.producedBlocks.map((block) => block.contentHash).sort().join(",");
  const hashB = b.producedBlocks.map((block) => block.contentHash).sort().join(",");
  assert.notEqual(hashA, hashB, "content differs per request");
});

test("mock reconstruction: covers the three method families over their supported domains", () => {
  for (const method of ["explicit-geometry", "neural-appearance", "hybrid"] as const) {
    const adapter = createMockReconstructionAdapter({ ...PRECISE_GEOMETRY, id: `mock-${method}`, method });
    const domains = RECONSTRUCTION_BENCHMARK_DOMAINS[method] ?? [];
    const output = adapter.reconstruct(request(method, domains));
    assert.equal(output.status, "completed");
    assert.deepEqual(
      output.producedBlocks.map((block) => block.domain),
      [...domains].sort(),
      `${method}: produces one block per requested domain`,
    );
  }
});

test("mock reconstruction: 'voice' is never a reconstruction output domain (typed refusal)", () => {
  for (const method of ["explicit-geometry", "neural-appearance", "hybrid"] as const) {
    const adapter = createMockReconstructionAdapter({ ...PRECISE_GEOMETRY, id: `mock-${method}`, method });
    assert.deepEqual(unsupportedReconstructionDomains(method, ["voice"]), ["voice"], `${method}: voice unsupported`);
    assert.throws(
      () => adapter.reconstruct(request(method, ["voice"])),
      (error: unknown) => error instanceof UnsupportedReconstructionCombinationError,
      `${method}: refusal throws the typed error`,
    );
    assert.throws(
      () => adapter.reconstruct(request(method, ["voice"])),
      /YOU_RECONSTRUCTION_UNSUPPORTED/,
      `${method}: refusal carries the frozen-aligned error code`,
    );
  }
});

test("mock reconstruction: requests for a method the adapter does not implement are typed refusals", () => {
  const geometryOnly = createMockReconstructionAdapter(PRECISE_GEOMETRY);
  assert.throws(
    () => geometryOnly.reconstruct(request("neural-appearance", ["hair"])),
    /adapter "mock-recon-geometry-precise" does not implement method "neural-appearance"/,
    "no silent fallback to another method (truth law)",
  );
  assert.throws(
    () => geometryOnly.reconstruct(request("hybrid", ["geometry-skeleton"])),
    /YOU_RECONSTRUCTION_UNSUPPORTED/,
    "the refusal still carries the frozen-aligned error code",
  );
});

test("mock reconstruction: unknown methods are fully unsupported (open vocabulary, honest refusal)", () => {
  assert.deepEqual(unsupportedReconstructionDomains("gaussian-splatting-avatar", ["hair", "style"]), ["hair", "style"]);
  const exotic = createMockReconstructionAdapter({ ...PRECISE_GEOMETRY, id: "mock-recon-exotic", method: "gaussian-splatting-avatar" });
  assert.deepEqual(exotic.profile.supportedDomains, [], "no claimed domains for an unknown method");
  assert.throws(() => exotic.reconstruct(request("gaussian-splatting-avatar", ["hair"])), /YOU_RECONSTRUCTION_UNSUPPORTED/);
});

test("mock reconstruction: confidence stays in [0, 1] and effort fields are not-measured markers", () => {
  const adapter = createMockReconstructionAdapter(PRECISE_GEOMETRY);
  const output = adapter.reconstruct(request("explicit-geometry", RECONSTRUCTION_BENCHMARK_DOMAINS["explicit-geometry"] ?? []));
  assert.equal(output.simulated, true, "output labeled simulated");
  for (const block of output.producedBlocks) {
    assert.ok(block.confidence >= 0 && block.confidence <= 1, `confidence in [0,1]: ${block.confidence}`);
    assert.equal(block.simulated, true, "block labeled simulated");
    assert.ok(block.generator.includes("you-lab-mock-reconstruction-adapter"));
  }
  for (const field of [output.effort.effort, output.effort.latency, output.effort.cost]) {
    assert.equal(field.kind, "not-measured");
    assert.equal(field.kind === "not-measured" ? field.marker : "", "not-measured (simulated)");
  }
});

test("mock reconstruction: seeded domain dropout drops blocks deterministically with warnings", () => {
  const degraded = createMockReconstructionAdapter({
    id: "mock-recon-neural-degraded",
    method: "neural-appearance",
    confidenceBase: 0.6,
    evidenceSensitivity: 0.3,
    domainDropoutRate: 0.35,
    confidenceJitter: 0.04,
  });
  const domains = RECONSTRUCTION_BENCHMARK_DOMAINS["neural-appearance"] ?? [];
  const first = degraded.reconstruct(request("neural-appearance", domains));
  const second = degraded.reconstruct(request("neural-appearance", domains));
  assert.equal(first.producedBlocks.length, second.producedBlocks.length, "dropout is deterministic");
  assert.ok(first.producedBlocks.length < domains.length, "at least one domain dropped by the seeded dropout");
  assert.ok(first.warnings.some((warning) => warning.includes("dropout")), "dropout recorded as a warning");
  for (const warning of first.warnings) {
    assert.ok(warning.includes("domain block not produced"), "warning wording stable");
  }
});

test("mock reconstruction: domain payload byte lengths follow the frozen fixture table", () => {
  assert.equal(NEUTRAL_HTIR_DOMAIN_BYTE_LENGTHS["identity-binding"], 256);
  assert.equal(NEUTRAL_HTIR_DOMAIN_BYTE_LENGTHS["neural-appearance"], 4096);
  assert.equal(NEUTRAL_HTIR_DOMAIN_BYTE_LENGTHS["motion-profile"], 3072);
  assert.equal(NEUTRAL_HTIR_DOMAIN_DEFAULT_BYTE_LENGTH, 512);
  const bytes = synthesizeNeutralDomainBytes("adapter-x", "request-y", "open-domain-extension");
  assert.equal(bytes.length, 512, "domain extensions use the default length");
  const identity = synthesizeNeutralDomainBytes("adapter-x", "request-y", "identity-binding");
  assert.equal(identity.length, 256);
  assert.deepEqual([...synthesizeNeutralDomainBytes("adapter-x", "request-y", "identity-binding")], [...identity], "byte synthesis is pure per key");
  assert.notDeepEqual([...synthesizeNeutralDomainBytes("adapter-z", "request-y", "identity-binding")], [...identity], "different key -> different bytes");
});

test("mock reconstruction: profile is a pure mock (technologyId null, no eligibility claim)", () => {
  const adapter = createMockReconstructionAdapter(PRECISE_GEOMETRY);
  assert.equal(adapter.profile.technologyId, null, "mock never claims a real technology");
  assert.equal(adapter.profile.productionEligible, null, "mock never claims production eligibility");
  assert.equal(adapter.profile.deterministic, true);
  assert.ok(adapter.profile.eligibilityBasis.includes("pure mock"));
});
