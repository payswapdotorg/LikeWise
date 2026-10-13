import assert from "node:assert/strict";
import test from "node:test";
import type { SolutionEvent } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { SolutionEventLedger } from "./events.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import { replayArenaLedger } from "./arenaLedger.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(7717)) };

function ledger(): SolutionEventLedger {
  return new SolutionEventLedger("you_w8a_ledger_test", DEPS);
}

test("the fold reconstructs gap records with their v1 linkage facts", () => {
  const book = ledger();
  book.append({
    type: "capability-gap-detected",
    subjectRef: "you_gap_0000000000000001",
    payload: {
      capabilityGapId: "you_gap_0000000000000001",
      category: "TOOL_GAP",
      confidence: 0.8,
      escalationEligibility: "eligible",
      intentRef: "you_intent_0000000000000001",
      suggestedNextAction: "substitute-gltf-pipeline",
      strategyCount: 2,
      "strategy.0": "gltf-transform",
      "strategyOutcome.0": "failed",
      "strategy.1": "manual-edit",
      "strategyOutcome.1": "partial",
      failureEvidenceCount: 1,
      "failureEvidenceRef.0": "you_evidence_0000000000000001",
      simulated: true,
    },
  });
  const projection = replayArenaLedger(book.events());
  const gap = projection.gaps["you_gap_0000000000000001"];
  assert.ok(gap !== undefined);
  assert.equal(gap.category, "TOOL_GAP");
  assert.equal(gap.confidence, 0.8);
  assert.equal(gap.escalationEligibility, "eligible");
  assert.equal(gap.intentRef, "you_intent_0000000000000001");
  assert.deepEqual(gap.strategies, [
    { strategy: "gltf-transform", outcome: "failed" },
    { strategy: "manual-edit", outcome: "partial" },
  ]);
  assert.deepEqual(gap.failureEvidenceRefs, ["you_evidence_0000000000000001"]);
  assert.equal(gap.simulated, true);
});

test("the fold reconstructs the run ladder head per run", () => {
  const book = ledger();
  book.append({
    type: "arena-run-recorded",
    subjectRef: "you_arena-run_0000000000000001",
    payload: {
      runId: "you_arena-run_0000000000000001",
      gapId: "you_gap_0000000000000001",
      strategy: "gltf-transform",
      attempt: 1,
      statusBefore: "",
      statusAfter: "started",
      startedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "",
      outcomeEvidenceRef: "",
      simulated: true,
    },
  });
  book.append({
    type: "arena-run-recorded",
    subjectRef: "you_arena-run_0000000000000001",
    payload: {
      runId: "you_arena-run_0000000000000001",
      gapId: "you_gap_0000000000000001",
      strategy: "gltf-transform",
      attempt: 1,
      statusBefore: "started",
      statusAfter: "failed",
      startedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "2026-01-01T00:00:02.000Z",
      outcomeEvidenceRef: "you_evidence_0000000000000002",
      simulated: true,
    },
  });
  const projection = replayArenaLedger(book.events());
  const run = projection.runs["you_arena-run_0000000000000001"];
  assert.ok(run !== undefined);
  assert.equal(run.status, "failed");
  assert.equal(run.attempt, 1);
  assert.equal(run.completedAt, "2026-01-01T00:00:02.000Z");
  assert.equal(run.outcomeEvidenceRef, "you_evidence_0000000000000002");
  assert.equal(run.simulated, true);
});

test("the fold walks the escalation status head through request, start and delivery", () => {
  const book = ledger();
  const facts = (escalationStatusAfter: string, extra: Record<string, string> = {}): Record<string, string | number | boolean> => ({
    escalationId: "you_escalation_0000000000000001",
    capabilityGapId: "you_gap_0000000000000001",
    escalationStatusBefore: "",
    escalationStatusAfter,
    authorizationId: "",
    reason: "",
    providerId: "",
    resultType: "",
    contentRef: "",
    contentHash: "",
    deliveredAt: "",
    simulated: true,
    ...extra,
  });
  book.append({ type: "arena-escalation-requested", subjectRef: "you_escalation_0000000000000001", payload: facts("requested") });
  book.append({
    type: "escalation-authorized",
    subjectRef: "you_escalation-authorization_0000000000000001",
    payload: {
      authorizationId: "you_escalation-authorization_0000000000000001",
      escalationId: "you_escalation_0000000000000001",
      capabilityGapId: "you_gap_0000000000000001",
      authorizedBy: "you_user_0000000000000001",
      scope: "arena:tool-gap-remediation",
      grantedAt: "2026-01-01T00:00:03.000Z",
      expiresAt: "2026-01-01T00:05:00.000Z",
      learningPermission: "aggregate",
      authorizationStatusAfter: "active",
      escalationStatusAfter: "authorized",
      simulated: true,
    },
  });
  book.append({
    type: "arena-escalation-requested",
    subjectRef: "you_escalation_0000000000000001",
    payload: facts("in-progress", { authorizationId: "you_escalation-authorization_0000000000000001", reason: "escalation-started" }),
  });
  book.append({
    type: "arena-escalation-requested",
    subjectRef: "you_escalation_0000000000000001",
    payload: facts("delivered", {
      providerId: "you_arena-provider_0000000000000001",
      resultType: "typed-payload",
      contentRef: "you_content_0123456789abcdef",
      contentHash: "a".repeat(64),
      deliveredAt: "2026-01-01T00:00:05.000Z",
    }),
  });
  const projection = replayArenaLedger(book.events());
  const escalation = projection.escalations["you_escalation_0000000000000001"];
  assert.ok(escalation !== undefined);
  assert.equal(escalation.status, "delivered");
  assert.equal(escalation.gapId, "you_gap_0000000000000001");
  assert.equal(escalation.authorizationId, "you_escalation-authorization_0000000000000001");
  assert.equal(escalation.providerId, "you_arena-provider_0000000000000001");
  assert.equal(escalation.resultType, "typed-payload");
  assert.equal(escalation.contentRef, "you_content_0123456789abcdef");
  assert.equal(escalation.contentHash, "a".repeat(64));
  assert.equal(escalation.deliveredAt, "2026-01-01T00:00:05.000Z");
});

test("the fold reconstructs the authorization chain with supersession and cancellation", () => {
  const book = ledger();
  const grant = (authorizationId: string, grantedAt: string, permission: string): Record<string, string | number | boolean> => ({
    authorizationId,
    escalationId: "you_escalation_0000000000000001",
    capabilityGapId: "you_gap_0000000000000001",
    authorizedBy: "you_user_0000000000000001",
    scope: "arena:tool-gap-remediation",
    grantedAt,
    expiresAt: "2026-01-01T00:05:00.000Z",
    learningPermission: permission,
    authorizationStatusAfter: "active",
    escalationStatusAfter: "authorized",
    simulated: true,
  });
  book.append({ type: "escalation-authorized", subjectRef: "you_escalation-authorization_0000000000000001", payload: grant("you_escalation-authorization_0000000000000001", "2026-01-01T00:00:03.000Z", "aggregate") });
  // A permission change registers the successor grant and supersedes the first.
  book.append({
    type: "learning-permission-recorded",
    subjectRef: "you_escalation-authorization_0000000000000002",
    payload: {
      authorizationId: "you_escalation-authorization_0000000000000002",
      escalationId: "you_escalation_0000000000000001",
      learningPermission: "full",
      supersededAuthorizationId: "you_escalation-authorization_0000000000000001",
      recordedAt: "2026-01-01T00:00:06.000Z",
      simulated: true,
    },
  });
  // A withdrawal re-projects the head grant and cancels the escalation.
  book.append({
    type: "escalation-cancelled",
    subjectRef: "you_escalation_0000000000000001",
    payload: {
      escalationId: "you_escalation_0000000000000001",
      capabilityGapId: "you_gap_0000000000000001",
      authorizationId: "you_escalation-authorization_0000000000000002",
      authorizationStatusAfter: "withdrawn",
      escalationStatusAfter: "cancelled",
      reason: "user-withdrew",
      cancelledAt: "2026-01-01T00:00:07.000Z",
      simulated: true,
    },
  });
  const projection = replayArenaLedger(book.events());
  const first = projection.authorizations["you_escalation-authorization_0000000000000001"];
  const second = projection.authorizations["you_escalation-authorization_0000000000000002"];
  assert.ok(first !== undefined && second !== undefined);
  assert.equal(first.status, "superseded");
  assert.equal(first.supersededById, "you_escalation-authorization_0000000000000002");
  assert.equal(first.learningPermission, "aggregate");
  assert.equal(second.status, "withdrawn");
  assert.equal(second.reason, "user-withdrew");
  assert.equal(second.recordedAt, "2026-01-01T00:00:07.000Z");
  assert.equal(second.learningPermission, "full");
  assert.equal(second.authorizedBy, "you_user_0000000000000001");
  // The escalation head carries the chain head and the cancelled status.
  const escalation = projection.escalations["you_escalation_0000000000000001"];
  assert.equal(escalation?.status, "cancelled");
  assert.equal(escalation?.authorizationId, "you_escalation-authorization_0000000000000002");
  // The latest permission recording is the successor's.
  assert.equal(projection.learningPermissions["you_escalation_0000000000000001"]?.learningPermission, "full");
});

test("the fold reconstructs applied and rejected results and gap projections", () => {
  const book = ledger();
  book.append({
    type: "arena-result-applied",
    subjectRef: "you_escalation_0000000000000001",
    payload: {
      escalationId: "you_escalation_0000000000000001",
      capabilityGapId: "you_gap_0000000000000001",
      changeSetId: "you_change-set_0000000000000001",
      escalationStatusAfter: "applied",
      reason: "",
      simulated: true,
    },
  });
  book.append({
    type: "arena-result-applied",
    subjectRef: "you_escalation_0000000000000002",
    payload: {
      escalationId: "you_escalation_0000000000000002",
      capabilityGapId: "you_gap_0000000000000002",
      changeSetId: "",
      escalationStatusAfter: "rejected",
      reason: "result-rejected-by-user",
      simulated: true,
    },
  });
  book.append({
    type: "gap-projection-published",
    subjectRef: "you_gap-projection_0000000000000001",
    payload: {
      projectionId: "you_gap-projection_0000000000000001",
      gapId: "you_gap_0000000000000001",
      projectionKind: "tool-gap",
      toolId: "",
      requiredCapability: "substitute-gltf-pipeline",
      remediation: "tool-substitution",
      simulated: true,
    },
  });
  book.append({
    type: "gap-projection-published",
    subjectRef: "you_gap-projection_0000000000000002",
    payload: {
      projectionId: "you_gap-projection_0000000000000002",
      gapId: "you_gap_0000000000000002",
      projectionKind: "knowledge-gap",
      domain: "human-proportion-rules",
      missingKnowledgeRef: "you_content_0123456789abcdef",
      remediation: "knowledge-patch",
      simulated: true,
    },
  });
  const projection = replayArenaLedger(book.events());
  assert.equal(projection.escalations["you_escalation_0000000000000001"]?.status, "applied");
  assert.equal(projection.escalations["you_escalation_0000000000000002"]?.status, "rejected");
  const tool = projection.projections["you_gap-projection_0000000000000001"];
  assert.ok(tool !== undefined);
  assert.equal(tool.kind, "tool-gap");
  assert.equal(tool.toolId, "");
  assert.equal(tool.requiredCapability, "substitute-gltf-pipeline");
  const knowledge = projection.projections["you_gap-projection_0000000000000002"];
  assert.ok(knowledge !== undefined);
  assert.equal(knowledge.kind, "knowledge-gap");
  assert.equal(knowledge.domain, "human-proportion-rules");
  assert.equal(knowledge.missingKnowledgeRef, "you_content_0123456789abcdef");
  assert.equal(knowledge.remediation, "knowledge-patch");
});

test("replayArenaLedger is deterministic (same events => byte-identical projection)", () => {
  const build = (): readonly SolutionEvent[] => {
    const book = ledger();
    book.append({
      type: "capability-gap-detected",
      subjectRef: "you_gap_0000000000000001",
      payload: {
        capabilityGapId: "you_gap_0000000000000001",
        category: "TOOL_GAP",
        confidence: 0.8,
        escalationEligibility: "eligible",
        intentRef: "",
        suggestedNextAction: "substitute-gltf-pipeline",
        strategyCount: 1,
        "strategy.0": "gltf-transform",
        "strategyOutcome.0": "failed",
        failureEvidenceCount: 0,
        simulated: true,
      },
    });
    book.append({
      type: "escalation-authorized",
      subjectRef: "you_escalation-authorization_0000000000000001",
      payload: {
        authorizationId: "you_escalation-authorization_0000000000000001",
        escalationId: "you_escalation_0000000000000001",
        capabilityGapId: "you_gap_0000000000000001",
        authorizedBy: "you_user_0000000000000001",
        scope: "arena:tool-gap-remediation",
        grantedAt: "2026-01-01T00:00:03.000Z",
        expiresAt: "",
        learningPermission: "none",
        authorizationStatusAfter: "active",
        escalationStatusAfter: "authorized",
        simulated: true,
      },
    });
    return book.events();
  };
  const events: readonly SolutionEvent[] = build();
  const first = replayArenaLedger(events);
  const second = replayArenaLedger(events);
  assert.equal(stableStringify(first), stableStringify(second));
  assert.notEqual(first, second); // Distinct fold outputs, identical content.
  assert.throws(() => replayArenaLedger([]), /requires at least one event/);
});
