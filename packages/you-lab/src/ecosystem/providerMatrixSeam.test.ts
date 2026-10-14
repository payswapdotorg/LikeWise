// Provider matrix seam tests (W10C) — coverage: the ecosystem gate
// (ProviderMatrixEntry registry) derives deterministically from the
// technology registry, validates integrity, refuses unknown refs
// fail-closed (YOU_PROVIDER_MATRIX_INVALID — the ECOSYSTEM GATE LAW),
// gates ineligible rows, enforces the production eligibility law for
// production-mode requests, and the seeded fixture model is deterministic.
import assert from "node:assert/strict";
import test from "node:test";
import { createStage10EcosystemRegistry } from "../technology/ecosystemSeedProfiles.js";
import { validateRegistryIntegrity } from "../technology/registry.js";
import {
  DEFAULT_MAX_MAINTENANCE_AGE_DAYS,
  ECOSYSTEM_BREAKER_CLASSES,
  ECOSYSTEM_CAPABILITY_SLOTS,
  ECOSYSTEM_EXPORT_CLASSES,
  ECOSYSTEM_REGIONS,
  ECOSYSTEM_STYLE_CLASSES,
  MATRIX_CLASS_PREFIXES,
  PROVIDER_MATRIX_INVALID_CODE,
  PROVIDER_MATRIX_ROW_SPECS,
  ProviderMatrixInvalidError,
  assertEcosystemRequestSupported,
  deriveProviderMatrix,
  intendedBreakerQualityAt,
  intendedFulfillmentFidelityAt,
  neutralEcosystemSeamVersion,
  providerMatrixEntryId,
  validateProviderMatrixIntegrity,
  type NeutralEcosystemRequest,
  type ProviderMatrixRowSpec,
} from "./providerMatrixSeam.js";
import { createRollbackEvidenceRegistry, createProductionEligibilityLedger } from "./eligibilityLedger.js";
import { budgetGuardId } from "./budgetGuardSeam.js";
import { createStandardEcosystemLedger, fixtureRequest, ECOSYSTEM_BENCHMARK_FIXTURES } from "./ecosystemFixtures.js";

const registry = createStage10EcosystemRegistry();
const matrix = deriveProviderMatrix(registry);
const ledger = createStandardEcosystemLedger();

function requestFixture(overrides: Partial<NeutralEcosystemRequest> = {}): NeutralEcosystemRequest {
  const base = fixtureRequest(ECOSYSTEM_BENCHMARK_FIXTURES[0]!);
  return { ...base, ...overrides };
}

test("provider matrix: derives deterministically from the registry (byte-identical replay)", () => {
  const second = deriveProviderMatrix(registry);
  assert.deepEqual(matrix.entries, second.entries);
  assert.equal(matrix.entries.length, PROVIDER_MATRIX_ROW_SPECS.length);
  // every entry id is the canonical (providerKind, region) digest
  for (const entry of matrix.entries) {
    assert.equal(entry.id, providerMatrixEntryId(entry.providerKind, entry.region));
    assert.match(entry.id, /^you_matrix_[0-9a-f]{16}$/);
    assert.equal(entry.simulated, true, "truth law: matrix rows stay simulated");
  }
});

test("provider matrix: integrity validation is green and catches drift", () => {
  const report = validateProviderMatrixIntegrity(matrix, registry);
  assert.equal(report.valid, true, JSON.stringify(report.issues));
  // a hand-asserted eligible flag drifts from the registry derivation
  const idmVton = matrix.entries.find((entry) => entry.providerKind === "idm-vton")!;
  const forged = {
    entries: matrix.entries.map((entry) =>
      entry.providerKind === "idm-vton" ? { ...entry, eligible: true } : entry,
    ),
    byId: matrix.byId,
    resolve: matrix.resolve,
    basisFor: matrix.basisFor,
  };
  const forgedReport = validateProviderMatrixIntegrity(forged, registry);
  assert.equal(forgedReport.valid, false);
  assert.ok(forgedReport.issues.some((issue) => issue.startsWith(idmVton.id) && issue.includes("drifts from the registry-derived")));
});

test("provider matrix: integrity catches unbacked rows and silent spec drops", () => {
  const unbacked = {
    entries: [...matrix.entries, {
      id: providerMatrixEntryId("not-a-technology", "global"),
      providerKind: "not-a-technology",
      region: "global",
      capabilityClasses: ["slot:ar"],
      eligible: true,
      simulated: true,
    }],
    byId: matrix.byId,
    resolve: matrix.resolve,
    basisFor: matrix.basisFor,
  };
  const report = validateProviderMatrixIntegrity(unbacked, registry);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((issue) => issue.includes("does not resolve")));
  // silent row-spec drop
  const dropped = {
    entries: matrix.entries.filter((entry) => entry.providerKind !== "babylonjs"),
    byId: matrix.byId,
    resolve: matrix.resolve,
    basisFor: matrix.basisFor,
  };
  const droppedReport = validateProviderMatrixIntegrity(dropped, registry);
  assert.equal(droppedReport.valid, false);
  assert.ok(droppedReport.issues.some((issue) => issue.includes("silent drop")));
});

test("provider matrix: the honest research findings gate as ineligible (truth law)", () => {
  const byProvider = new Map(matrix.entries.map((entry) => [entry.providerKind, entry] as const));
  // NC-licensed virtual try-on research rows
  assert.equal(byProvider.get("idm-vton")?.eligible, false, "IDM-VTON is CC-BY-NC-SA-4.0 — never production-eligible");
  assert.equal(byProvider.get("ootdiffusion")?.eligible, false, "OOTDiffusion is CC-BY-NC-SA-4.0 — never production-eligible");
  // unverified license (no LICENSE file in the vrm-specification repo)
  assert.equal(byProvider.get("vrm-specification")?.eligible, false, "vrm-specification license is unverified — blocked");
  // maintenance-gate failures
  assert.equal(byProvider.get("gpt4all")?.eligible, false, "gpt4all last release 2025-02-25 — maintenance gate failed");
  assert.equal(byProvider.get("ip-adapter")?.eligible, false, "ip-adapter last commit 2024-06-28 — maintenance gate failed");
  // license-class failures (outside the permissive SPDX set)
  assert.equal(byProvider.get("comfyui")?.eligible, false, "comfyui is GPL-3.0 — outside the permissive set");
  assert.equal(byProvider.get("mozilla-hubs")?.eligible, false, "mozilla-hubs is MPL-2.0 — outside the permissive set");
  assert.equal(byProvider.get("webxr-device-api")?.eligible, false, "W3C software+document license — outside the permissive set");
  // closed regional providers stay ineligible pending API-terms review
  for (const regional of ["deepseek-api", "zhipu-bigmodel", "moonshot-platform", "volcengine-doubao", "naver-ncloud", "upstage-solar", "sarvam-api"]) {
    assert.equal(byProvider.get(regional)?.eligible, false, `${regional} is a closed provider — API terms not reviewed`);
  }
  // the production-eligible picks DID derive
  for (const eligible of ["model-viewer", "babylonjs", "playcanvas", "godot", "three-vrm", "jitsi-meet", "galene", "llamafile", "localai", "jan", "diffusers", "safetensors", "sd-scripts", "arjs"]) {
    assert.equal(byProvider.get(eligible)?.eligible, true, `${eligible} derives as registry-eligible`);
  }
});

test("provider matrix: the region vocabulary is honest (no jp region minted)", () => {
  assert.deepEqual([...ECOSYSTEM_REGIONS], ["global", "cn", "kr", "in"]);
  for (const entry of matrix.entries) {
    assert.ok(ECOSYSTEM_REGIONS.includes(entry.region as (typeof ECOSYSTEM_REGIONS)[number]));
  }
  // every region except global is gated by regional-provider rows only
  for (const entry of matrix.entries.filter((row) => row.region !== "global")) {
    assert.ok(entry.capabilityClasses.includes("slot:regional-provider"));
  }
});

test("provider matrix: gate refuses unknown refs fail-closed (the ECOSYSTEM GATE LAW)", () => {
  const adapterProfile = {
    id: "gate-test-adapter",
    technologyId: null,
    servedRegions: [...ECOSYSTEM_REGIONS],
    servedStyles: [...ECOSYSTEM_STYLE_CLASSES],
    servedExports: [...ECOSYSTEM_EXPORT_CLASSES],
    adapterKind: "mock" as const,
    deterministic: true,
    determinismNote: "test",
    productionEligible: null,
    eligibilityBasis: "test",
  };
  // unknown provider ref
  assert.throws(
    () => assertEcosystemRequestSupported(adapterProfile, requestFixture({ providerKind: "not-a-provider" }), matrix, ledger),
    (error: unknown) => error instanceof ProviderMatrixInvalidError && error.code === PROVIDER_MATRIX_INVALID_CODE && /unknown matrix ref/.test(error.message),
  );
  // known provider in the wrong region (cn row exists but this provider is global-only)
  assert.throws(
    () => assertEcosystemRequestSupported(adapterProfile, requestFixture({ region: "cn" }), matrix, ledger),
    /no matrix row for provider 'model-viewer' in region 'cn'/,
  );
  // unknown region
  assert.throws(
    () => assertEcosystemRequestSupported(adapterProfile, requestFixture({ region: "jp" }), matrix, ledger),
    /no matrix row for provider 'model-viewer' in region 'jp'/,
  );
  // unknown style ref (outside the vocabulary)
  assert.throws(
    () => assertEcosystemRequestSupported(adapterProfile, requestFixture({ styleRefs: ["baroque"] }), matrix, ledger),
    /outside the authored style vocabulary/,
  );
  // style not gated by the resolved row
  assert.throws(
    () => assertEcosystemRequestSupported(adapterProfile, requestFixture({ styleRefs: ["voxel"] }), matrix, ledger),
    /does not gate style 'voxel'/,
  );
  // unknown export ref
  assert.throws(
    () => assertEcosystemRequestSupported(adapterProfile, requestFixture({ exportRefs: ["obj"] }), matrix, ledger),
    /outside the authored export vocabulary/,
  );
  // export not gated by the resolved row
  assert.throws(
    () => assertEcosystemRequestSupported(adapterProfile, requestFixture({ exportRefs: ["vrm-1.0"] }), matrix, ledger),
    /does not gate export 'vrm-1.0'/,
  );
  // ineligible row (the NC-licensed try-on lane)
  assert.throws(
    () => assertEcosystemRequestSupported(
      adapterProfile,
      requestFixture({ providerKind: "idm-vton", styleRefs: ["photoreal"], exportRefs: [] }),
      matrix,
      ledger,
    ),
    /not registry-eligible/,
  );
  // adapter does not serve the region
  assert.throws(
    () => assertEcosystemRequestSupported(
      { ...adapterProfile, servedRegions: ["global"] },
      requestFixture({ providerKind: "deepseek-api", region: "cn", styleRefs: ["photoreal"], exportRefs: [] }),
      matrix,
      ledger,
    ),
    /does not serve region 'cn'/,
  );
  // ineligible regional row (closed provider — unverified API-terms license)
  assert.throws(
    () => assertEcosystemRequestSupported(
      adapterProfile,
      requestFixture({ providerKind: "deepseek-api", region: "cn", styleRefs: ["photoreal"], exportRefs: [] }),
      matrix,
      ledger,
    ),
    /not registry-eligible — license is unverified \(DeepSeek API provider terms \(closed provider/, 
  );
});

test("provider matrix: production-mode requests require a latest eligible ledger decision (PRODUCTION ELIGIBILITY LAW)", () => {
  const adapterProfile = {
    id: "gate-test-adapter",
    technologyId: null,
    servedRegions: [...ECOSYSTEM_REGIONS],
    servedStyles: [...ECOSYSTEM_STYLE_CLASSES],
    servedExports: [...ECOSYSTEM_EXPORT_CLASSES],
    adapterKind: "mock" as const,
    deterministic: true,
    determinismNote: "test",
    productionEligible: null,
    eligibilityBasis: "test",
  };
  const emptyLedger = createProductionEligibilityLedger(createRollbackEvidenceRegistry([]));
  assert.throws(
    () => assertEcosystemRequestSupported(adapterProfile, requestFixture({ productionMode: true }), matrix, emptyLedger),
    /no latest eligible ProductionEligibilityRecord/,
  );
  // the standard ledger carries an eligible model-viewer decision
  const entry = assertEcosystemRequestSupported(adapterProfile, requestFixture({ productionMode: true }), matrix, ledger);
  assert.equal(entry.providerKind, "model-viewer");
});

test("provider matrix: derivation fails closed on unknown row-spec refs", () => {
  const validSpec = PROVIDER_MATRIX_ROW_SPECS[0]!;
  const brokenSpecs: readonly ProviderMatrixRowSpec[] = [
    { technologyId: "does-not-exist", region: "global", styleRefs: [], exportRefs: [], slotRefs: [] },
    { technologyId: "model-viewer", region: "mars", styleRefs: [], exportRefs: [], slotRefs: [] },
    { technologyId: "model-viewer", region: "global", styleRefs: ["baroque"], exportRefs: [], slotRefs: [] },
    { technologyId: "model-viewer", region: "global", styleRefs: [], exportRefs: ["obj"], slotRefs: [] },
    { technologyId: "model-viewer", region: "global", styleRefs: [], exportRefs: [], slotRefs: ["teleport"] },
  ];
  for (const spec of brokenSpecs) {
    assert.throws(
      () => deriveProviderMatrix(registry, { rowSpecs: [validSpec, spec] }),
      (error: unknown) => error instanceof ProviderMatrixInvalidError && error.code === PROVIDER_MATRIX_INVALID_CODE,
      `expected derivation refusal for spec ${JSON.stringify(spec)}`,
    );
  }
  // the shipped default specs derive cleanly (no patch residue)
  assert.equal(deriveProviderMatrix(registry).entries.length, PROVIDER_MATRIX_ROW_SPECS.length);
  assert.equal(validSpec.technologyId, PROVIDER_MATRIX_ROW_SPECS[0]!.technologyId);
});

test("provider matrix: capability classes derive as a sorted union over the three prefixes", () => {
  const entry = matrix.resolve("babylonjs", "global");
  assert.ok(entry);
  assert.deepEqual(entry.capabilityClasses, [
    "export:glb", "export:gltf", "export:webxr-ar-scene",
    "slot:ar", "slot:game-export",
    "style:anime-stylized", "style:illustrated", "style:photoreal",
  ]);
  assert.equal(MATRIX_CLASS_PREFIXES.style, "style:");
  assert.equal(MATRIX_CLASS_PREFIXES.export, "export:");
  assert.equal(MATRIX_CLASS_PREFIXES.slot, "slot:");
});

test("provider matrix: the seeded fidelity model is deterministic and inside its bands", () => {
  for (let i = 0; i < 5; i++) {
    const fidelity = intendedFulfillmentFidelityAt("model-viewer", "photoreal", "glb");
    assert.equal(fidelity, intendedFulfillmentFidelityAt("model-viewer", "photoreal", "glb"));
    assert.ok(fidelity >= 0.5 && fidelity <= 1.0, `fidelity in [0.5, 1.0]: ${fidelity}`);
  }
  for (const breakerClass of ECOSYSTEM_BREAKER_CLASSES) {
    const quality = intendedBreakerQualityAt("model-viewer", breakerClass);
    assert.equal(quality, intendedBreakerQualityAt("model-viewer", breakerClass));
    assert.ok(quality > 0 && quality <= 1.1, `quality band sane: ${quality}`);
  }
  // well-behaved classes derive strictly higher bands than token-bucket for the same provider
  assert.ok(
    intendedBreakerQualityAt("model-viewer", "exponential-backoff-jitter") > intendedBreakerQualityAt("model-viewer", "token-bucket"),
  );
  assert.throws(() => intendedBreakerQualityAt("model-viewer", "linear-backoff" as never), /four W8C classes only/);
  assert.throws(() => intendedBreakerQualityAt("model-viewer", ""), /four W8C classes only/);
});

test("provider matrix: registry integrity stays green with the W10C additions (truth law)", () => {
  const report = validateRegistryIntegrity(registry);
  assert.equal(report.valid, true, JSON.stringify(report.issues.slice(0, 5)));
});

test("provider matrix: research facts cited by the matrix are the verified ones (spot checks)", () => {
  // The deepseek row's basis cites the unverified API-terms license, not a software release claim.
  const deepseek = matrix.resolve("deepseek-api", "cn");
  assert.ok(deepseek);
  const basis = matrix.basisFor(deepseek.id);
  assert.ok(/license is unverified \(.*closed provider/.test(basis), basis);
  // The W3C spec row cites the verified non-SPDX custom form.
  const webxr = matrix.resolve("webxr-device-api", "global");
  assert.ok(webxr);
  assert.ok(/license is a non-SPDX custom form \(W3C Software and Document License/.test(matrix.basisFor(webxr.id)));
  // The model-viewer row's basis cites the verified Apache-2.0 license source.
  const modelViewer = matrix.resolve("model-viewer", "global");
  assert.ok(modelViewer);
  const modelViewerBasis = matrix.basisFor(modelViewer.id);
  assert.ok(/Apache-2.0/.test(modelViewerBasis) && /registry\.npmjs\.org/.test(modelViewerBasis), modelViewerBasis);
  // The maintenance-fail rows cite their stale maintenance facts.
  const gpt4all = matrix.resolve("gpt4all", "global");
  assert.ok(gpt4all);
  assert.ok(/maintenance gate failed/.test(matrix.basisFor(gpt4all.id)));
});

test("provider matrix: budget guards bind before the effect — the over-budget request refuses at the gate", () => {
  const adapterProfile = {
    id: "gate-test-adapter",
    technologyId: null,
    servedRegions: [...ECOSYSTEM_REGIONS],
    servedStyles: [...ECOSYSTEM_STYLE_CLASSES],
    servedExports: [...ECOSYSTEM_EXPORT_CLASSES],
    adapterKind: "mock" as const,
    deterministic: true,
    determinismNote: "test",
    productionEligible: null,
    eligibilityBasis: "test",
  };
  // Over-budget declared spend: the gate refuses BEFORE the effect (the
  // request never reaches the adapter's fulfillment loop).
  assert.throws(
    () => assertEcosystemRequestSupported(adapterProfile, requestFixture({ declaredCostUnits: 1000 }), matrix, ledger),
    (error: unknown) => error instanceof Error && error.message.startsWith("YOU_BUDGET_EXCEEDED"),
  );
  assert.throws(
    () => assertEcosystemRequestSupported(adapterProfile, requestFixture({ declaredLatencyS: 999 }), matrix, ledger),
    /latency 999\/10s/,
  );
});

test("provider matrix: the maintenance gate default and seam version labels are exported", () => {
  assert.equal(DEFAULT_MAX_MAINTENANCE_AGE_DAYS, 365);
  assert.match(neutralEcosystemSeamVersion(), /you-lab-ecosystem-seam\/1/);
  assert.equal(ECOSYSTEM_BREAKER_CLASSES.length, 4);
  assert.equal(ECOSYSTEM_CAPABILITY_SLOTS.length, 8);
  assert.equal(ECOSYSTEM_STYLE_CLASSES.length, 5);
  assert.equal(ECOSYSTEM_EXPORT_CLASSES.length, 5);
});

test("provider matrix: fixture requests derive budgets deterministically inside their envelopes", () => {
  for (const fixture of ECOSYSTEM_BENCHMARK_FIXTURES) {
    const first = fixtureRequest(fixture);
    const second = fixtureRequest(fixture);
    assert.deepEqual(first, second, "fixture request derives byte-identically");
    assert.ok(first.declaredCostUnits <= first.budget.costBudget, "declared cost inside the budget");
    assert.ok(first.declaredLatencyS <= first.budget.latencyBudgetS, "declared latency inside the budget");
    assert.equal(first.budget.simulated, true);
    assert.match(first.budget.id, /^you_budget_[0-9a-f]{16}$/);
    assert.equal(first.budget.id, budgetGuardId(first.budget.scope, first.budget.breakerClass));
  }
});

test("provider matrix: a valid fixture request resolves through the gate (no refusal)", () => {
  const adapterProfile = {
    id: "gate-test-adapter",
    technologyId: null,
    servedRegions: [...ECOSYSTEM_REGIONS],
    servedStyles: [...ECOSYSTEM_STYLE_CLASSES],
    servedExports: [...ECOSYSTEM_EXPORT_CLASSES],
    adapterKind: "mock" as const,
    deterministic: true,
    determinismNote: "test",
    productionEligible: null,
    eligibilityBasis: "test",
  };
  for (const fixture of ECOSYSTEM_BENCHMARK_FIXTURES) {
    const request = fixtureRequest(fixture);
    const entry = assertEcosystemRequestSupported(adapterProfile, request, matrix, ledger);
    assert.equal(entry.providerKind, request.providerKind);
    assert.equal(entry.region, request.region);
  }
});
