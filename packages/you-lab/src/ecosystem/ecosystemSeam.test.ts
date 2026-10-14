// Contract seam v10 tests (W10C) — coverage: the ecosystem shapes construct
// VALID frozen v10 shapes through the single seam module
// (ProviderMatrixEntry / CostLatencyBudget / ProductionEligibilityRecord),
// the region and breaker-class mappings are 1:1 at the seam, the identity
// law holds on the full path (adapters never mint request or matrix-row
// identity), the PRODUCTION ELIGIBILITY LAW refuses empty rollback
// evidence at the frozen boundary, and effort/matrix observations carry
// honest markers.
import assert from "node:assert/strict";
import test from "node:test";
import {
  ecosystemThroughAdapter,
  mapEcosystemRegion,
  toEcosystemEffortObservations,
  toFrozenCostLatencyBudget,
  toFrozenProductionEligibilityRecord,
  toFrozenProviderMatrixEntry,
  toProviderMatrixObservations,
} from "../contractSeam.js";
import { createStage10EcosystemRegistry } from "../technology/ecosystemSeedProfiles.js";
import { deriveProviderMatrix } from "./providerMatrixSeam.js";
import { createModelViewerArEvaluationAdapter, MODEL_VIEWER_EVALUATION_ADAPTER_ID } from "./modelViewerArEvaluationAdapter.js";
import {
  createStandardEcosystemLedger,
  ECOSYSTEM_BENCHMARK_FIXTURES,
  fixtureRequest,
} from "./ecosystemFixtures.js";
import { runStandardEcosystemBenchmark } from "./ecosystemRunner.js";
import { createStandardEcosystemCandidates } from "./ecosystemCandidates.js";
import { createRollbackEvidenceRegistry, createProductionEligibilityLedger } from "./eligibilityLedger.js";
import { budgetGuardId } from "./budgetGuardSeam.js";

const registry = createStage10EcosystemRegistry();
const matrix = deriveProviderMatrix(registry);
const ledger = createStandardEcosystemLedger();

test("contract seam v10: the region mapping is 1:1 with the authored vocabulary and validated", () => {
  for (const region of ["global", "cn", "kr", "in"]) {
    assert.equal(mapEcosystemRegion(region), region);
  }
  assert.throws(() => mapEcosystemRegion("jp" as never), /no jp region is minted/);
  assert.throws(() => mapEcosystemRegion("eu" as never), /outside the W10C authored region vocabulary/);
  assert.throws(() => mapEcosystemRegion(""), /empty region/);
});

test("contract seam v10: toFrozenProviderMatrixEntry maps the matrix row 1:1", () => {
  const entry = matrix.resolve("model-viewer", "global");
  assert.ok(entry);
  const frozen = toFrozenProviderMatrixEntry(entry);
  assert.equal(frozen.id, entry.id);
  assert.equal(frozen.providerKind, "model-viewer");
  assert.equal(frozen.region, "global");
  assert.deepEqual(frozen.capabilityClasses, [...entry.capabilityClasses]);
  assert.equal(frozen.eligible, true);
  assert.equal(frozen.simulated, true, "truth law: matrix rows stay simulated at the frozen boundary");
  // malformed rows are typed rejections
  assert.throws(() => toFrozenProviderMatrixEntry({ ...entry, id: "" }), /empty id/);
  assert.throws(() => toFrozenProviderMatrixEntry({ ...entry, providerKind: "" }), /empty providerKind/);
  assert.throws(() => toFrozenProviderMatrixEntry({ ...entry, region: "jp" as never }), /no jp region is minted/);
  assert.throws(() => toFrozenProviderMatrixEntry({ ...entry, capabilityClasses: [] }), /empty capabilityClasses/);
  assert.throws(
    () => toFrozenProviderMatrixEntry({ ...entry, capabilityClasses: ["slot:ar", ""] }),
    /empty capability class/,
  );
});

test("contract seam v10: toFrozenCostLatencyBudget maps the descriptor 1:1 with the W8C breaker table", () => {
  const request = fixtureRequest(ECOSYSTEM_BENCHMARK_FIXTURES[0]!);
  const frozen = toFrozenCostLatencyBudget(request.budget);
  assert.equal(frozen.id, request.budget.id);
  assert.equal(frozen.scope, request.budget.scope);
  assert.equal(frozen.costBudget, request.budget.costBudget);
  assert.equal(frozen.latencyBudgetS, request.budget.latencyBudgetS);
  assert.equal(frozen.breakerClass, "exponential-backoff-jitter");
  assert.equal(frozen.simulated, true);
  // the breaker classes carried forward from W8C all map
  for (const breakerClass of ["circuit-breaker", "hedged-request", "exponential-backoff-jitter", "token-bucket"] as const) {
    const scope = `seam-budget-${breakerClass}`;
    const budget = {
      id: budgetGuardId(scope, breakerClass),
      scope,
      costBudget: 10,
      latencyBudgetS: 1,
      breakerClass,
      simulated: true,
    };
    assert.equal(toFrozenCostLatencyBudget(budget).breakerClass, breakerClass);
  }
  // malformed descriptors are typed rejections
  assert.throws(() => toFrozenCostLatencyBudget({ ...request.budget, id: "" }), /empty id/);
  assert.throws(() => toFrozenCostLatencyBudget({ ...request.budget, scope: "" }), /empty scope/);
  assert.throws(() => toFrozenCostLatencyBudget({ ...request.budget, costBudget: 0 }), /costBudget 0/);
  assert.throws(() => toFrozenCostLatencyBudget({ ...request.budget, latencyBudgetS: -1 }), /latencyBudgetS -1/);
  assert.throws(
    () => toFrozenCostLatencyBudget({ ...request.budget, breakerClass: "linear-backoff" as never }),
    /outside the W8C authored backoff vocabulary/,
  );
});

test("contract seam v10: toFrozenProductionEligibilityRecord enforces the rollback-evidence law", () => {
  const decision = ledger.latestDecisionFor("model-viewer");
  assert.ok(decision);
  const frozen = toFrozenProductionEligibilityRecord(decision);
  assert.equal(frozen.id, decision.id);
  assert.equal(frozen.subjectRef, "model-viewer");
  assert.equal(frozen.eligible, true);
  assert.equal(frozen.rollbackEvidenceRef, decision.rollbackEvidenceRef);
  assert.equal(frozen.decidedAt, decision.decidedAt);
  assert.equal(frozen.simulated, true);
  // the law: an empty rollbackEvidenceRef is refused at the frozen boundary
  assert.throws(
    () => toFrozenProductionEligibilityRecord({ ...decision, rollbackEvidenceRef: "" }),
    /YOU_PRODUCTION_ELIGIBILITY_INVALID .*PRODUCTION ELIGIBILITY LAW requires rollback evidence/,
  );
  assert.throws(() => toFrozenProductionEligibilityRecord({ ...decision, id: "" }), /empty id/);
  assert.throws(() => toFrozenProductionEligibilityRecord({ ...decision, subjectRef: "" }), /empty subjectRef/);
  assert.throws(() => toFrozenProductionEligibilityRecord({ ...decision, decidedAt: "" }), /empty decidedAt/);
});

test("contract seam v10: ecosystemThroughAdapter constructs the full frozen path with the identity law", () => {
  const adapter = createModelViewerArEvaluationAdapter(registry);
  const request = fixtureRequest(ECOSYSTEM_BENCHMARK_FIXTURES[0]!);
  const path = ecosystemThroughAdapter(adapter, request, matrix, ledger);
  assert.equal(path.matrixEntry.id, matrix.resolve("model-viewer", "global")?.id);
  assert.equal(path.matrixEntry.providerKind, "model-viewer");
  assert.equal(path.matrixEntry.region, "global");
  assert.equal(path.budget.id, request.budget.id);
  assert.equal(path.eligibility?.subjectRef, "model-viewer");
  assert.equal(path.eligibility?.eligible, true);
  assert.equal(path.output.requestId, request.requestId);
  assert.equal(path.output.matrixEntryId, path.matrixEntry.id);
  assert.ok(Object.keys(path.output.payloads).length > 0);

  // identity law: an adapter minting fulfillments for another matrix row is refused
  const minter = {
    profile: adapter.profile,
    fulfill(...args: Parameters<typeof adapter.fulfill>) {
      const output = adapter.fulfill(...args);
      return {
        ...output,
        matrixEntryId: matrix.resolve("babylonjs", "global")!.id,
      };
    },
  };
  assert.throws(
    () => ecosystemThroughAdapter(minter as never, request, matrix, ledger),
    /identity law — adapters never mint matrix rows/,
  );

  // identity law: an adapter minting another request identity is refused
  const requestMinter = {
    profile: adapter.profile,
    fulfill(...args: Parameters<typeof adapter.fulfill>) {
      const output = adapter.fulfill(...args);
      return { ...output, requestId: "someone-elses-request" };
    },
  };
  assert.throws(
    () => ecosystemThroughAdapter(requestMinter as never, request, matrix, ledger),
    /identity law — adapters never mint request identity/,
  );

  // unknown refs refuse before the adapter runs
  assert.throws(
    () => ecosystemThroughAdapter(adapter, { ...request, providerKind: "not-a-provider" }, matrix, ledger),
    /the ecosystem gate refuses unknown refs before the adapter runs/,
  );
});

test("contract seam v10: a subject with no ledger decision maps eligibility as null (honest absence)", () => {
  const adapter = createModelViewerArEvaluationAdapter(registry);
  const request = fixtureRequest(ECOSYSTEM_BENCHMARK_FIXTURES[1]!); // babylonjs subject — ledger seeded too
  const emptyLedger = createProductionEligibilityLedger(createRollbackEvidenceRegistry([]));
  const path = ecosystemThroughAdapter(adapter, request, matrix, emptyLedger);
  assert.equal(path.matrixEntry.providerKind, "babylonjs");
  assert.equal(path.eligibility, null);
});

test("contract seam v10: effort and matrix observations carry honest markers", () => {
  const report = runStandardEcosystemBenchmark(createStandardEcosystemCandidates(registry), matrix, ledger);
  const evaluation = report.candidateResults.find((entry) => entry.candidateId === MODEL_VIEWER_EVALUATION_ADAPTER_ID);
  assert.ok(evaluation);
  const observations = toEcosystemEffortObservations(evaluation);
  assert.equal(observations.simulated, true);
  assert.equal(observations.fixtureCount, 3);
  assert.equal(observations.ecosystemEffort, "not-measured (simulated)");
  assert.equal(observations["latencyMs.measured"], false);
  assert.equal(observations["costUnits.measured"], false);

  const matrixObservations = toProviderMatrixObservations(matrix);
  assert.equal(matrixObservations.simulated, true);
  assert.equal(matrixObservations.entryCount, matrix.entries.length);
  assert.equal(
    (matrixObservations.eligibleCount as number) + (matrixObservations.ineligibleCount as number),
    matrix.entries.length,
  );
  assert.equal(matrixObservations["region.global.entries"], matrix.entries.filter((entry) => entry.region === "global").length);
  assert.equal(matrixObservations["region.cn.entries"], matrix.entries.filter((entry) => entry.region === "cn").length);
  assert.equal(matrixObservations["region.kr.entries"], matrix.entries.filter((entry) => entry.region === "kr").length);
  assert.equal(matrixObservations["region.in.entries"], matrix.entries.filter((entry) => entry.region === "in").length);
  // no jp observation key exists (the honest region vocabulary)
  assert.equal("region.jp.entries" in matrixObservations, false);
});

test("contract seam v10: the full path is deterministic end-to-end (byte-identical replay)", () => {
  const adapter = createModelViewerArEvaluationAdapter(registry);
  const request = fixtureRequest(ECOSYSTEM_BENCHMARK_FIXTURES[0]!);
  const first = ecosystemThroughAdapter(adapter, request, matrix, ledger);
  const second = ecosystemThroughAdapter(adapter, request, matrix, ledger);
  assert.deepEqual(first, second);
});
