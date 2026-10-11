// COLMAP photogrammetry evaluation adapter tests (W3C) — the
// production-eligible, profile-backed adapter: registry-derived eligibility
// (fail-closed), honest simulated-execution markers, determinism,
// explicit-geometry-only support, and view-driven fixture behavior.
import assert from "node:assert/strict";
import test from "node:test";
import { createReconstructionRegistry } from "../technology/reconstructionSeedProfiles.js";
import { createDefaultRegistry } from "../technology/seedProfiles.js";
import { COLMAP_EVALUATION_ADAPTER_ID, createColmapPhotogrammetryAdapter } from "./colmapPhotogrammetryAdapter.js";
import { deriveReconstructionEvidence } from "./reconstructionEvidence.js";
import {
  RECONSTRUCTION_BENCHMARK_DOMAINS,
  type NeutralReconstructionRequest,
} from "./reconstructionAdapterSeam.js";

const registry = createReconstructionRegistry();
const adapter = createColmapPhotogrammetryAdapter(registry);

const VIEW_STARVED_SPEC = { capture: { frames: 1, width: 24, height: 32, modality: "image" as const, includeProp: true }, viewCount: 1 };
const MULTIVIEW_SPEC = { capture: { frames: 2, width: 20, height: 20, modality: "depth" as const, includeProp: true }, viewCount: 10 };
const viewStarved = deriveReconstructionEvidence("colmap-eval-starved", VIEW_STARVED_SPEC).evidence;
const multiview = deriveReconstructionEvidence("colmap-eval-multiview", MULTIVIEW_SPEC).evidence;

function request(evidence: typeof viewStarved, method = "explicit-geometry"): NeutralReconstructionRequest {
  return {
    requestId: "recon-colmap-eval-1",
    twinVersionId: "twin-colmap-eval",
    method,
    targetDomains: RECONSTRUCTION_BENCHMARK_DOMAINS[method] ?? [],
    evidence,
    submittedAt: "2026-10-11T12:00:00Z",
  };
}

test("colmap eval adapter: is registry-backed with DERIVED production eligibility", () => {
  assert.equal(adapter.profile.id, COLMAP_EVALUATION_ADAPTER_ID);
  assert.equal(adapter.profile.technologyId, "colmap", "backed by the researched colmap registry profile");
  assert.equal(adapter.profile.productionEligible, true, "eligibility derived from registry facts");
  assert.ok(adapter.profile.eligibilityBasis.includes("BSD-3-Clause"), "basis cites the license");
  assert.ok(adapter.profile.eligibilityBasis.includes("W4+ compute-plane"), "basis defers real integration to W4+");
  assert.equal(adapter.facts.maintenanceAgeDays, 0, "latest colmap maintenance signal is the research date");
});

test("colmap eval adapter: honest simulated-execution markers (the real COLMAP never runs here)", () => {
  const output = adapter.reconstruct(request(multiview));
  assert.equal(output.simulated, true, "output labeled simulated");
  for (const block of output.producedBlocks) {
    assert.ok(block.generator.includes("simulated classic-photogrammetry behavior"));
    assert.ok(block.generator.includes("real COLMAP not executed"), "generator label discloses the simulation");
  }
  for (const field of [output.effort.effort, output.effort.latency, output.effort.cost]) {
    assert.equal(field.kind, "not-measured", "no latency/cost/effort numbers invented");
    assert.equal(field.kind === "not-measured" ? field.marker : "", "not-measured (simulated)");
  }
});

test("colmap eval adapter: explicit-geometry only — typed refusal for other methods (no silent fallback)", () => {
  assert.deepEqual(adapter.profile.methods, ["explicit-geometry"]);
  const neuralDomains = RECONSTRUCTION_BENCHMARK_DOMAINS["neural-appearance"] ?? [];
  assert.throws(
    () => adapter.reconstruct(request(multiview, "neural-appearance")),
    /adapter "colmap-photogrammetry-eval" does not implement method "neural-appearance"/,
    "neural-appearance jobs are refused, never silently run as geometry",
  );
  assert.throws(() => adapter.reconstruct(request(multiview, "hybrid")), /YOU_RECONSTRUCTION_UNSUPPORTED/);
  // explicit-geometry domains are supported; appearance-only domains are not
  assert.throws(
    () => adapter.reconstruct({ ...request(multiview), targetDomains: ["hair", "style"] }),
    /does not support target domain/,
    "appearance-only domains are refused for explicit-geometry",
  );
  void neuralDomains;
});

test("colmap eval adapter: deterministic byte-identical replay", () => {
  const first = adapter.reconstruct(request(multiview));
  const second = adapter.reconstruct(request(multiview));
  assert.deepEqual(first, second);
  for (const block of first.producedBlocks) {
    assert.equal(block.contentHash.length, 64, "sha-256 hex");
  }
});

test("colmap eval adapter: photogrammetry confidence is view-driven (fixture arithmetic)", () => {
  const starved = adapter.reconstruct(request(viewStarved));
  const rich = adapter.reconstruct(request(multiview));
  const mean = (blocks: typeof starved.producedBlocks): number =>
    blocks.reduce((sum, block) => sum + block.confidence, 0) / blocks.length;
  assert.ok(mean(rich.producedBlocks) > mean(starved.producedBlocks), "multiview evidence lifts confidence");
  assert.ok(mean(starved.producedBlocks) < 0.6, `view-starved confidence stays modest: ${mean(starved.producedBlocks)}`);
  assert.ok(mean(rich.producedBlocks) > 0.85, `multiview confidence is high: ${mean(rich.producedBlocks)}`);
});

test("colmap eval adapter: produces exactly the explicit-geometry benchmark domains", () => {
  const output = adapter.reconstruct(request(multiview));
  assert.deepEqual(
    output.producedBlocks.map((block) => block.domain),
    [...(RECONSTRUCTION_BENCHMARK_DOMAINS["explicit-geometry"] ?? [])].sort(),
  );
  assert.equal(output.status, "completed");
  assert.deepEqual(output.warnings, []);
});

test("colmap eval adapter: factory fails closed when the registry loses colmap eligibility facts", () => {
  // A registry without the W3C reconstruction profiles has no 'colmap'
  // technology at all — the factory must refuse to construct.
  assert.throws(() => createColmapPhotogrammetryAdapter(createDefaultRegistry()), /missing from the registry/);
});
