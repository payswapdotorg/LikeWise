// ToolGap / KnowledgeGap projection builder tests (W8C) — coverage: the
// projection builders derive the frozen v8 projection shapes from neutral
// CapabilityGap-shaped records deterministically, the honest null
// toolId/missingKnowledgeRef law holds (the lab owns no inventory
// authority), remediation strings derive from the gap record, and
// malformed gap records are typed YOU_GAP_PROJECTION_INVALID rejections —
// never silently clamped.
import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_KNOWLEDGE_DOMAINS,
  ARENA_TOOL_CAPABILITIES,
  GAP_PROJECTION_INVALID_CODE,
  GapProjectionInvalidError,
  buildKnowledgeGapProjection,
  buildToolGapProjection,
} from "./gapProjections.js";
import { fixtureScenario, ARENA_BENCHMARK_FIXTURES, synthesizeArenaScenario } from "./arenaFixtures.js";
import type { NeutralArenaGapRecord } from "./arenaAdapterSeam.js";

function toolGapFixture(): NeutralArenaGapRecord {
  return synthesizeArenaScenario("projection-tool-seed", {
    category: "TOOL_GAP",
    attemptedStrategyCount: 2,
    evidenceRefCount: 3,
    maxAttempts: 2,
    backoffClass: "exponential-backoff-jitter",
    requiresAuthorization: false,
  }).gap;
}

function knowledgeGapFixture(): NeutralArenaGapRecord {
  return synthesizeArenaScenario("projection-knowledge-seed", {
    category: "KNOWLEDGE_GAP",
    attemptedStrategyCount: 1,
    evidenceRefCount: 2,
    maxAttempts: 1,
    backoffClass: "circuit-breaker",
    requiresAuthorization: false,
  }).gap;
}

test("gap projections: the tool projection derives the frozen shape deterministically", () => {
  const gap = toolGapFixture();
  const projection = buildToolGapProjection(gap);
  assert.equal(projection.gapId, gap.id);
  assert.equal(projection.toolId, null, "the lab owns no tool inventory — toolId stays null (honest)");
  assert.ok(ARENA_TOOL_CAPABILITIES.includes(projection.requiredCapability as (typeof ARENA_TOOL_CAPABILITIES)[number]));
  assert.ok(projection.remediation.includes(projection.requiredCapability));
  assert.ok(projection.remediation.includes(`${gap.attemptedStrategies.length} attempted strategies recorded`));
  assert.ok(projection.remediation.includes(gap.suggestedNextAction));
  assert.ok(projection.remediation.includes("projection, never an authority"));
  // deterministic derivation
  assert.deepEqual(buildToolGapProjection(gap), projection);
  // different gap ids may derive different capabilities (hash-indexed vocabulary)
  const other = synthesizeArenaScenario("projection-tool-other", {
    category: "TOOL_GAP",
    attemptedStrategyCount: 1,
    evidenceRefCount: 1,
    maxAttempts: 1,
    backoffClass: "token-bucket",
    requiresAuthorization: false,
  }).gap;
  const otherProjection = buildToolGapProjection(other);
  assert.equal(otherProjection.gapId, other.id);
  assert.ok(ARENA_TOOL_CAPABILITIES.includes(otherProjection.requiredCapability as (typeof ARENA_TOOL_CAPABILITIES)[number]));
});

test("gap projections: the knowledge projection derives the frozen shape deterministically", () => {
  const gap = knowledgeGapFixture();
  const projection = buildKnowledgeGapProjection(gap);
  assert.equal(projection.gapId, gap.id);
  assert.equal(projection.missingKnowledgeRef, null, "the lab owns no knowledge store — the ref stays null (honest)");
  assert.ok(ARENA_KNOWLEDGE_DOMAINS.includes(projection.domain as (typeof ARENA_KNOWLEDGE_DOMAINS)[number]));
  assert.ok(projection.remediation.includes(projection.domain));
  assert.ok(projection.remediation.includes(gap.suggestedNextAction));
  assert.ok(projection.remediation.includes("projection, never an authority"));
  assert.deepEqual(buildKnowledgeGapProjection(gap), projection);
});

test("gap projections: category mismatches are typed YOU_GAP_PROJECTION_INVALID rejections", () => {
  const toolGap = toolGapFixture();
  const knowledgeGap = knowledgeGapFixture();
  assert.throws(
    () => buildKnowledgeGapProjection(toolGap),
    (error: unknown) => {
      assert.ok(error instanceof GapProjectionInvalidError);
      assert.equal(error.code, GAP_PROJECTION_INVALID_CODE);
      assert.match(error.message, /requires category KNOWLEDGE_GAP/);
      return true;
    },
  );
  assert.throws(
    () => buildToolGapProjection(knowledgeGap),
    (error: unknown) => {
      assert.ok(error instanceof GapProjectionInvalidError);
      assert.equal(error.code, GAP_PROJECTION_INVALID_CODE);
      assert.match(error.message, /requires category TOOL_GAP/);
      return true;
    },
  );
});

test("gap projections: malformed gap records are typed rejections — never clamped, never guessed", () => {
  const gap = toolGapFixture();
  const malformed: readonly [string, NeutralArenaGapRecord][] = [
    ["empty id", { ...gap, id: "" }],
    ["empty category", { ...gap, category: "" }],
    ["confidence above 1", { ...gap, confidence: 1.5 }],
    ["confidence below 0", { ...gap, confidence: -0.1 }],
    ["confidence NaN", { ...gap, confidence: Number.NaN }],
    ["empty suggestedNextAction", { ...gap, suggestedNextAction: "" }],
    ["empty strategy string", { ...gap, attemptedStrategies: [{ strategy: "", outcome: "failed", evidenceRef: null }] }],
    ["invalid strategy outcome", { ...gap, attemptedStrategies: [{ strategy: "s", outcome: "succeeded" as never, evidenceRef: null }] }],
  ];
  for (const [label, record] of malformed) {
    assert.throws(
      () => buildToolGapProjection(record),
      (error: unknown) => {
        assert.ok(error instanceof GapProjectionInvalidError, `${label}: typed error`);
        assert.equal(error.code, GAP_PROJECTION_INVALID_CODE);
        return true;
      },
      label,
    );
    assert.throws(() => buildKnowledgeGapProjection(record), GapProjectionInvalidError, `${label}: knowledge builder validates too`);
  }
});

test("gap projections: the benchmark fixture scenarios project cleanly (the W8C full-fixture law)", () => {
  for (const fixture of ARENA_BENCHMARK_FIXTURES) {
    const scenario = fixtureScenario(fixture);
    if (fixture.scenarioSpec.category === "TOOL_GAP") {
      const projection = buildToolGapProjection(scenario.gap);
      assert.equal(projection.gapId, scenario.gap.id);
    } else if (fixture.scenarioSpec.category === "KNOWLEDGE_GAP") {
      const projection = buildKnowledgeGapProjection(scenario.gap);
      assert.equal(projection.gapId, scenario.gap.id);
    } else {
      // non-tool/non-knowledge categories have no projection builder — a
      // typed rejection is the honest answer (never a wrong-shape guess)
      assert.throws(() => buildToolGapProjection(scenario.gap), GapProjectionInvalidError);
    }
  }
});
