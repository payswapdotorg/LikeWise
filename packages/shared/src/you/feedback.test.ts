import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { FeedbackCategory, SolutionSelector } from "./contract.js";
import { buildFixtureSnapshot, listFixtureRegions } from "./fixture.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import {
  createConsentReference,
  createEvidenceRequestForFeedback,
  createFeedbackRequest,
  PHASE0_CONSENT_POLICY_ID,
  transitionEvidence,
  transitionFeedback,
  validateSelectorTarget,
} from "./feedback.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(41)) };
const SNAPSHOT = buildFixtureSnapshot("feedback-test");

function humanSelector(): SolutionSelector {
  const human = SNAPSHOT.entities.find((entity) => entity.kind === "synthetic-human");
  assert.ok(human !== undefined);
  return { kind: "entity", entityId: human.id };
}

function feedback(overrides: Partial<Parameters<typeof createFeedbackRequest>[0]> = {}) {
  return createFeedbackRequest(
    {
      scope: "USER",
      targetRef: humanSelector(),
      category: "geometry",
      userComment: "Proportions look off.",
      sourceSolutionVersionId: "you_version_feedback01",
      requestedAction: "improve geometry fidelity",
      consent: createConsentReference("unknown", false),
      ...overrides,
    },
    DEPS,
  );
}

test("createFeedbackRequest produces a canonical, immutable record", () => {
  const request = feedback();
  assert.match(request.id, /^you_feedback_[0-9a-f]{16}$/);
  assert.equal(request.status, "open");
  assert.equal(request.scope, "USER");
  assert.equal(request.category, "geometry");
  assert.equal(request.createdAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(request.consent, { policyId: PHASE0_CONSENT_POLICY_ID, state: "unknown", learningPermission: false });
  assert.ok(Object.isFrozen(request));
  assert.throws(() => {
    (request as unknown as { status: string }).status = "addressed";
  }, TypeError);
  assert.throws(() => feedback({ userComment: "" }));
});

test("validateSelectorTarget accepts entity, region and quality selectors that resolve", () => {
  const human = SNAPSHOT.entities.find((entity) => entity.kind === "synthetic-human");
  assert.ok(human !== undefined);
  const region = listFixtureRegions(SNAPSHOT)[0];
  assert.ok(region !== undefined);
  assert.ok(validateSelectorTarget({ kind: "entity", entityId: human.id }, SNAPSHOT));
  assert.ok(validateSelectorTarget({ kind: "region", regionId: region.regionId }, SNAPSHOT));
  assert.ok(validateSelectorTarget({ kind: "quality", deficiencyClass: "geometry" }, SNAPSHOT));
  assert.equal(validateSelectorTarget({ kind: "entity", entityId: "you_entity_missing01" }, SNAPSHOT), false);
  assert.equal(validateSelectorTarget({ kind: "region", regionId: "nope::head" }, SNAPSHOT), false);
  assert.equal(validateSelectorTarget({ kind: "quality", deficiencyClass: "nonexistent" }, SNAPSHOT), false);
});

test("feedback status transitions are lawful and produce new records", () => {
  const open = feedback();
  const addressed = transitionFeedback(open, "addressed");
  assert.equal(addressed.status, "addressed");
  assert.equal(open.status, "open");
  assert.throws(() => transitionFeedback(addressed, "open"));
  assert.throws(() => transitionFeedback(open, "open"));
  const rejected = transitionFeedback(open, "rejected");
  assert.equal(rejected.status, "rejected");
  const superseded = transitionFeedback(open, "superseded");
  assert.equal(superseded.status, "superseded");
});

test("evidence status transitions are lawful", () => {
  const request = createEvidenceRequestForFeedback(feedback(), DEPS);
  assert.equal(request.status, "requested");
  const provided = transitionEvidence(request, "provided");
  assert.equal(provided.status, "provided");
  assert.equal(request.status, "requested");
  const fulfilled = transitionEvidence(provided, "fulfilled");
  assert.equal(fulfilled.status, "fulfilled");
  assert.throws(() => transitionEvidence(fulfilled, "provided"));
  assert.throws(() => transitionEvidence(request, "fulfilled"));
  assert.equal(transitionEvidence(request, "declined").status, "declined");
  assert.equal(transitionEvidence(request, "cancelled").status, "cancelled");
});

test("createEvidenceRequestForFeedback targets the category's deficiency with fixture evidence", () => {
  const categories: FeedbackCategory[] = ["geometry", "identity_mismatch", "style", "behavior"];
  for (const category of categories) {
    const request = createEvidenceRequestForFeedback(feedback({ category }), DEPS);
    assert.equal(request.evidenceType, "fixture");
    assert.equal(request.status, "requested");
    assert.equal(request.preferredFraming, "synthetic reference framing, deterministic seed, medium quality");
    assert.ok(request.reason.includes(request.targetDeficiency));
    assert.ok(request.privacyRequirements.includes("no biometric data"));
    assert.equal(request.retention, "session-only");
    assert.ok(Object.isFrozen(request));
  }
  const geometry = createEvidenceRequestForFeedback(feedback({ category: "geometry" }), DEPS);
  assert.equal(geometry.targetDeficiency, "geometry");
  const identity = createEvidenceRequestForFeedback(feedback({ category: "identity_mismatch" }), DEPS);
  assert.equal(identity.targetDeficiency, "identity");
});

test("createConsentReference defaults to the phase-0 policy", () => {
  const consent = createConsentReference("granted", true);
  assert.deepEqual(consent, { policyId: PHASE0_CONSENT_POLICY_ID, state: "granted", learningPermission: true });
  const custom = createConsentReference("denied", false, "custom-policy");
  assert.equal(custom.policyId, "custom-policy");
});
