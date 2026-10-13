// Failure Atlas tests (W9C) — coverage: the entry builders derive immutable
// observations from failing world-run outcomes (deterministic identity —
// replay mints the identical entry), every entry carries an evidence ref
// (the FAILURE ATLAS LAW), non-failing or malformed outcomes are typed
// YOU_FAILURE_ATLAS_INVALID rejections, the ledger is append-only with
// duplicate observations refused, and the summary is a derived projection
// (informs, never decides).
import assert from "node:assert/strict";
import test from "node:test";
import {
  FAILURE_ATLAS_INVALID_CODE,
  FailureAtlasInvalidError,
  appendAtlasEntry,
  buildFailureAtlasEntry,
  collectFailureObservations,
  failureAtlasEntryId,
  summarizeFailureAtlas,
  type NeutralFailureAtlasEntry,
} from "./failureAtlas.js";
import { LAB_FAILURE_CLASSES, runWorldPipeline, synthesizeLabWorld, type LabWorldRunOutcome, type LabWorldSpec } from "./worlds.js";
import { seedGenomeNode } from "./pipelineGenome.js";

const OBSERVED_AT = "2026-10-14T12:00:00Z";

function spec(): LabWorldSpec {
  return {
    seed: "w9c-atlas-test-01",
    actorCount: 4,
    cameraCount: 2,
    sensorCount: 2,
    lightingVariants: 1,
    noiseLevel: 0.6,
    occlusionEnabled: true,
    perturbationCount: 8,
  };
}

function failingOutcome(): LabWorldRunOutcome {
  // difficulty 0.52 with the strength-0.32 root gives a 0.42 failure band;
  // scan a few root seeds for a deterministically failing outcome
  const world = synthesizeLabWorld(spec());
  for (let index = 0; index < 32; index++) {
    const root = seedGenomeNode("you_experiment_w9c-atlastest", `atlas-root-${index}`);
    const outcome = runWorldPipeline(world, [root], { runId: "you_lab-run_atlastest", submittedAt: OBSERVED_AT });
    if (outcome.failureClass !== null) return outcome;
  }
  throw new Error("fixture setup: no failing outcome found in the seeded scan band");
}

function nonFailingOutcome(): LabWorldRunOutcome {
  const world = synthesizeLabWorld({ ...spec(), noiseLevel: 0.01, occlusionEnabled: false, perturbationCount: 0 });
  for (let index = 0; index < 32; index++) {
    const root = seedGenomeNode("you_experiment_w9c-atlastest", `atlas-clean-${index}`);
    const outcome = runWorldPipeline(world, [root], { runId: "you_lab-run_atlastest-clean", submittedAt: OBSERVED_AT });
    if (outcome.failureClass === null) return outcome;
  }
  throw new Error("fixture setup: no clean outcome found in the seeded scan band");
}

test("atlas: buildFailureAtlasEntry derives the immutable observation deterministically", () => {
  const outcome = failingOutcome();
  const entry = buildFailureAtlasEntry(outcome, OBSERVED_AT);
  assert.equal(entry.id, failureAtlasEntryId(outcome.worldId, outcome.runId, outcome.failureClass!));
  assert.match(entry.id, /^you_atlas_[0-9a-f]{16}$/);
  assert.equal(entry.worldRef, outcome.worldId);
  assert.equal(entry.runRef, outcome.runId);
  assert.equal(entry.failureClass, outcome.failureClass);
  assert.equal(entry.evidenceRef, outcome.evidenceRef, "the observation carries the run's evidence ref");
  assert.equal(entry.firstObservedAt, OBSERVED_AT);
  assert.equal(entry.simulated, true, "truth law: fixture observations stay labeled simulated");
  // replay mints the identical entry (immutable, idempotent identity)
  assert.deepEqual(buildFailureAtlasEntry(outcome, OBSERVED_AT), entry);
  // an observation carries NO authority fields: no remediation, no cause,
  // no decision — the structural law (the atlas informs, the gate decides)
  const keys = Object.keys(entry).sort();
  assert.deepEqual(keys, ["evidenceRef", "failureClass", "firstObservedAt", "id", "runRef", "simulated", "worldRef"]);
});

test("atlas: malformed observations are typed YOU_FAILURE_ATLAS_INVALID rejections", () => {
  const failing = failingOutcome();
  const clean = nonFailingOutcome();
  assert.throws(
    () => buildFailureAtlasEntry(clean, OBSERVED_AT),
    (error: unknown) => {
      assert.ok(error instanceof FailureAtlasInvalidError);
      assert.equal(error.code, FAILURE_ATLAS_INVALID_CODE);
      assert.match(error.message, /nothing to record/);
      return true;
    },
  );
  const malformed: readonly [string, LabWorldRunOutcome, string][] = [
    ["empty runId", { ...failing, runId: "" }, OBSERVED_AT],
    ["empty worldId", { ...failing, worldId: "" }, OBSERVED_AT],
    ["empty evidenceRef", { ...failing, evidenceRef: "" }, OBSERVED_AT],
    ["foreign failure class", { ...failing, failureClass: "cosmic-ray-flip" }, OBSERVED_AT],
    ["empty observedAt", failing, ""],
    ["unparseable observedAt", failing, "yesterday"],
  ];
  for (const [label, outcome, observedAt] of malformed) {
    assert.throws(
      () => buildFailureAtlasEntry(outcome, observedAt),
      (error: unknown) => {
        assert.ok(error instanceof FailureAtlasInvalidError, `${label}: typed error`);
        assert.equal(error.code, FAILURE_ATLAS_INVALID_CODE);
        return true;
      },
      label,
    );
  }
});

test("atlas: the ledger is append-only and refuses duplicate observations", () => {
  const outcome = failingOutcome();
  const entry = buildFailureAtlasEntry(outcome, OBSERVED_AT);
  const ledger = appendAtlasEntry([], entry);
  assert.equal(ledger.length, 1);
  assert.deepEqual(ledger[0], entry);
  assert.throws(
    () => appendAtlasEntry(ledger, entry),
    (error: unknown) => {
      assert.ok(error instanceof FailureAtlasInvalidError);
      assert.equal(error.code, FAILURE_ATLAS_INVALID_CODE);
      assert.match(error.message, /already recorded/);
      return true;
    },
  );
  // the input ledger is untouched
  assert.equal(ledger.length, 1);
  // malformed entries are refused
  const malformed: readonly [string, NeutralFailureAtlasEntry][] = [
    ["empty id", { ...entry, id: "" }],
    ["empty worldRef", { ...entry, worldRef: "" }],
    ["empty runRef", { ...entry, runRef: "" }],
    ["empty failureClass", { ...entry, failureClass: "" }],
    ["empty evidenceRef", { ...entry, evidenceRef: "" }],
    ["empty firstObservedAt", { ...entry, firstObservedAt: "" }],
  ];
  for (const [label, bad] of malformed) {
    assert.throws(() => appendAtlasEntry([], bad), FailureAtlasInvalidError, label);
  }
});

test("atlas: collectFailureObservations selects only the failing outcomes (explicit, named selection)", () => {
  const failing = failingOutcome();
  const clean = nonFailingOutcome();
  const selected = collectFailureObservations([clean, failing, clean]);
  assert.deepEqual(selected, [failing]);
  assert.deepEqual(collectFailureObservations([clean, clean]), []);
});

test("atlas: the summary is a derived projection with deterministic ordering", () => {
  const outcomeA = failingOutcome();
  const otherClass = LAB_FAILURE_CLASSES.find((clazz) => clazz !== outcomeA.failureClass)!;
  const outcomeB = { ...outcomeA, failureClass: otherClass, runId: "you_lab-run_atlastest-b" };
  const entries = [
    buildFailureAtlasEntry(outcomeA, OBSERVED_AT),
    buildFailureAtlasEntry(outcomeB, OBSERVED_AT),
  ];
  const summary = summarizeFailureAtlas(entries);
  assert.equal(summary.totalEntries, 2);
  assert.equal(summary.worldsCovered, 1);
  assert.equal(summary.runsCovered, 2);
  assert.deepEqual(summary.byFailureClass, {
    [outcomeA.failureClass!]: 1,
    [otherClass]: 1,
  });
  // deterministic ordering: class keys sorted regardless of insertion order
  assert.deepEqual(Object.keys(summary.byFailureClass), Object.keys(summary.byFailureClass).sort());
  assert.deepEqual(summarizeFailureAtlas([]), { totalEntries: 0, byFailureClass: {}, worldsCovered: 0, runsCovered: 0 });
  assert.deepEqual(summarizeFailureAtlas(entries), summarizeFailureAtlas([...entries].reverse()));
});
