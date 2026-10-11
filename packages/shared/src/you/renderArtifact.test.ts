import assert from "node:assert/strict";
import test from "node:test";
import type { RenderArtifactReviewStatus } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import {
  createRenderArtifactReview,
  isLegalRenderArtifactReviewTransition,
  isTerminalRenderArtifactReviewStatus,
  RENDER_ARTIFACT_REVIEW_TRANSITIONS,
  supersedeRenderArtifactReview,
  transitionRenderArtifactReview,
} from "./renderArtifact.js";

const ARTIFACT = "you_render-artifact_0000000100000001";

function makeDeps() {
  return {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0030)),
  };
}

test("the review transition table is pending -> accepted | rejected | superseded with terminals locked", () => {
  assert.deepEqual(RENDER_ARTIFACT_REVIEW_TRANSITIONS, {
    pending: ["accepted", "rejected", "superseded"],
    accepted: [],
    rejected: [],
    superseded: [],
  } as const);

  const legal: readonly [RenderArtifactReviewStatus, RenderArtifactReviewStatus][] = [
    ["pending", "accepted"],
    ["pending", "rejected"],
    ["pending", "superseded"],
  ];
  for (const [from, to] of legal) {
    assert.ok(isLegalRenderArtifactReviewTransition(from, to), `${from} -> ${to}`);
  }

  const illegal: readonly [RenderArtifactReviewStatus, RenderArtifactReviewStatus][] = [
    ["pending", "pending"],
    ["accepted", "rejected"],
    ["accepted", "accepted"],
    ["accepted", "superseded"],
    ["accepted", "pending"],
    ["rejected", "accepted"],
    ["rejected", "superseded"],
    ["rejected", "pending"],
    ["superseded", "pending"],
    ["superseded", "accepted"],
    ["superseded", "rejected"],
    ["superseded", "superseded"],
  ];
  for (const [from, to] of illegal) {
    assert.ok(!isLegalRenderArtifactReviewTransition(from, to), `${from} -> ${to} must be illegal`);
  }

  assert.equal(isTerminalRenderArtifactReviewStatus("accepted"), true);
  assert.equal(isTerminalRenderArtifactReviewStatus("rejected"), true);
  assert.equal(isTerminalRenderArtifactReviewStatus("superseded"), true);
  assert.equal(isTerminalRenderArtifactReviewStatus("pending"), false);
});

test("reviews are created pending or directly resolved, never as superseded", () => {
  const deps = makeDeps();
  const pending = createRenderArtifactReview({ artifactId: ARTIFACT, status: "pending" }, deps);
  assert.ok(pending.id.startsWith("you_artifact-review_"));
  assert.equal(pending.artifactId, ARTIFACT);
  assert.equal(pending.status, "pending");
  assert.ok(Object.isFrozen(pending));

  const resolved = createRenderArtifactReview({ artifactId: ARTIFACT, status: "accepted" }, deps);
  assert.equal(resolved.status, "accepted");

  assert.throws(() => createRenderArtifactReview({ artifactId: "", status: "pending" }, deps), /artifactId/);
  assert.throws(() => createRenderArtifactReview({ artifactId: ARTIFACT, status: "superseded" as "pending" }, deps), /opening status/);
});

test("resolving a pending review is an immutable record replacement (same id, new status)", () => {
  const deps = makeDeps();
  const pending = createRenderArtifactReview({ artifactId: ARTIFACT, status: "pending" }, deps);
  const accepted = transitionRenderArtifactReview(pending, "accepted");
  assert.notEqual(accepted, pending);
  assert.equal(accepted.id, pending.id);
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.reviewedAt, pending.reviewedAt);
  // The original record object is untouched.
  assert.equal(pending.status, "pending");
  assert.ok(Object.isFrozen(accepted));

  const superseded = transitionRenderArtifactReview(pending, "superseded");
  assert.equal(superseded.status, "superseded");
  assert.equal(superseded.id, pending.id);
});

test("terminal reviews never transition again (illegal transitions throw)", () => {
  const deps = makeDeps();
  const accepted = createRenderArtifactReview({ artifactId: ARTIFACT, status: "accepted" }, deps);
  assert.throws(() => transitionRenderArtifactReview(accepted, "rejected"), /illegal artifact review transition accepted -> rejected/);
  assert.throws(() => transitionRenderArtifactReview(accepted, "superseded"), /illegal artifact review transition/);
  assert.throws(() => transitionRenderArtifactReview(accepted, "pending"), /illegal artifact review transition/);

  const rejected = createRenderArtifactReview({ artifactId: ARTIFACT, status: "rejected" }, deps);
  assert.throws(() => transitionRenderArtifactReview(rejected, "accepted"), /illegal/);
});

test("supersession creates a brand-new record; the superseded record keeps its status", () => {
  const deps = makeDeps();
  const first = createRenderArtifactReview({ artifactId: ARTIFACT, status: "accepted" }, deps);
  const supersession = supersedeRenderArtifactReview(first, { artifactId: ARTIFACT, status: "rejected" }, deps);
  assert.equal(supersession.supersededReviewId, first.id);
  assert.notEqual(supersession.replacement.id, first.id);
  assert.equal(supersession.replacement.artifactId, first.artifactId);
  assert.equal(supersession.replacement.status, "rejected");
  // The previous record is never overwritten.
  assert.equal(first.status, "accepted");

  // A pending review must be resolved or withdrawn before supersession.
  const pending = createRenderArtifactReview({ artifactId: ARTIFACT, status: "pending" }, deps);
  assert.throws(() => supersedeRenderArtifactReview(pending, { artifactId: ARTIFACT, status: "accepted" }, deps), /pending review must be resolved/);
});

test("review records serialize deterministically", () => {
  const run = () => createRenderArtifactReview({ artifactId: ARTIFACT, status: "pending" }, makeDeps());
  assert.equal(stableStringify(run()), stableStringify(run()));
});
