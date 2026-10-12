import assert from "node:assert/strict";
import test from "node:test";
import { EMBODIMENT_SCENARIO_LADDER_WALK } from "./embodimentFixtureScenarioTypes.js";
import { runEmbodimentFixtureScenario } from "./embodimentFixtureScenario.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";

test("the scenario walks the full ladder, suspends/resumes, closes, re-possesses, and refuses truthfully", () => {
  const trace = runEmbodimentFixtureScenario();
  const expectedWalk = EMBODIMENT_SCENARIO_LADDER_WALK.slice(1);
  assert.deepEqual(trace.ladderWalkStates, [...expectedWalk]);
  assert.equal(trace.appearanceAddressed, true);
  assert.equal(trace.sessionOneFinalStatus, "closed");
  assert.equal(trace.sessionTwoFinalStatus, "closed");
  assert.equal(trace.bodyPreservedAcrossRepossession, true);
  assert.equal(trace.repossessionSoulBindingId, trace.soulBindingBId);
  assert.notEqual(trace.repossessionSoulBindingId, trace.soulBindingAId);
  assert.equal(trace.simulated, true);
});

test("the scenario refusal paths carry the typed v7 error codes (never silent skips)", () => {
  const trace = runEmbodimentFixtureScenario();
  assert.deepEqual(trace.refusalOutcomes, {
    "open-unknown-body": "YOU_BODY_NOT_FOUND",
    "open-unknown-soul-binding": "YOU_SOUL_BINDING_INVALID",
    "register-invalid-soul-binding": "YOU_SOUL_BINDING_INVALID",
    "transition-off-ladder": "YOU_EMBODIMENT_STATE_INVALID",
    "transition-no-op": "YOU_EMBODIMENT_STATE_INVALID",
    "transition-to-unavailable": "YOU_EMBODIMENT_STATE_INVALID",
    "transition-unknown-session": "YOU_AVATAR_SESSION_NOT_FOUND",
    "transition-terminal-locked": "YOU_EMBODIMENT_STATE_INVALID",
    "close-already-closed": "YOU_EMBODIMENT_STATE_INVALID",
  });
});

test("the scenario ledger readout: projection == replay and the hash is golden-stable", () => {
  const first = runEmbodimentFixtureScenario();
  const second = runEmbodimentFixtureScenario();
  assert.equal(first.projectionMatchesReplay, true);
  assert.equal(second.projectionMatchesReplay, true);
  assert.equal(first.eventCount > 0, true);
  assert.equal(first.ledgerHash, second.ledgerHash);
  assert.match(first.ledgerHash, /^[0-9a-f]{8}$/);
});

test("byte-identical replay: the same seed reproduces the whole trace exactly", () => {
  const left = runEmbodimentFixtureScenario();
  const right = runEmbodimentFixtureScenario();
  assert.equal(stableStringify(left), stableStringify(right));
});

test("a different seed changes ids but the scenario structure is identical", () => {
  const baseline = runEmbodimentFixtureScenario();
  const variant = runEmbodimentFixtureScenario({ seed: "you-w7a-embodiment-scenario-alt" });
  assert.notEqual(variant.bodyId, baseline.bodyId);
  assert.deepEqual(variant.ladderWalkStates, baseline.ladderWalkStates);
  assert.deepEqual(variant.refusalOutcomes, baseline.refusalOutcomes);
  assert.equal(variant.projectionMatchesReplay, true);
  assert.equal(variant.bodyPreservedAcrossRepossession, true);
});

test("the scenario steps cover every required W7A story beat in order", () => {
  const trace = runEmbodimentFixtureScenario();
  const names = trace.steps.map((entry) => entry.name);
  const requiredPrefix = [
    "body-registered",
    "soul-bindings-registered",
    "avatar-session-opened",
    "ladder-walk:idle->listening",
    "avatar-session-suspended",
    "avatar-session-resumed",
    "avatar-session-closed",
    "avatar-session-two-opened",
    "soul-reassigned",
    "avatar-session-two-closed",
    "refusal-paths",
    "ledger-readout",
  ];
  let cursor = 0;
  for (const required of requiredPrefix) {
    const at = names.indexOf(required, cursor);
    assert.notEqual(at, -1, `missing scenario step: ${required}`);
    cursor = at;
  }
  assert.equal(trace.steps[trace.steps.length - 1]?.name, "ledger-readout");
});
