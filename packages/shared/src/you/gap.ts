// YOU CapabilityGap + mock Arena escalation
// (docs/you/ARCHITECTURE.md §10/§15, ARENA.md, FIXTURES.md law 9).
//
// A gap records attempted strategies and evidence before escalation.
// Arena is the human capability escape hatch: Phase 0 uses a
// deterministic fixture table keyed by capability-gap category. Arena
// never silently mutates YOU state — the typed expert result returns as
// ChangeSet operations applied through YOU's own versioning authority.

import type {
  ArenaEscalationRef,
  ArenaExpertResult,
  AttemptedStrategy,
  CapabilityGap,
  CapabilityGapCategory,
  OpaqueId,
  SolutionPatchOperation,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { deepFreeze } from "./serialize.js";

/** Fixed fixture delivery timestamp for Arena mock results. */
export const ARENA_FIXTURE_DELIVERED_AT = "2026-01-01T00:10:42.000Z";

/**
 * Deterministic Arena mock expert results, keyed by capability-gap
 * category (docs/you/FIXTURES.md law 9). Payloads are primitives only.
 */
export const ARENA_MOCK_EXPERT_RESULTS: Readonly<Record<CapabilityGapCategory, ArenaExpertResult>> = deepFreeze({
  TOOL_GAP: {
    deliveredAt: ARENA_FIXTURE_DELIVERED_AT,
    resultType: "typed-payload",
    payload: { remediation: "tool-substitution", replacementTool: "gltf-transform", qualityBoost: 0.12 },
    appliesAsChangeSetId: null,
  },
  EDITOR_GAP: {
    deliveredAt: ARENA_FIXTURE_DELIVERED_AT,
    resultType: "typed-payload",
    payload: { remediation: "editor-substitution", replacementEditor: "threejs-editor", qualityBoost: 0.1 },
    appliesAsChangeSetId: null,
  },
  MODEL_GAP: {
    deliveredAt: ARENA_FIXTURE_DELIVERED_AT,
    resultType: "guidance",
    payload: { remediation: "model-profile-update", suggestedProfile: "higher-fidelity-reconstruction", qualityBoost: 0.08 },
    appliesAsChangeSetId: null,
  },
  SKILL_GAP: {
    deliveredAt: ARENA_FIXTURE_DELIVERED_AT,
    resultType: "typed-payload",
    payload: { remediation: "skill-capsule", skill: "humanoid-retargeting", qualityBoost: 0.12 },
    appliesAsChangeSetId: null,
  },
  KNOWLEDGE_GAP: {
    deliveredAt: ARENA_FIXTURE_DELIVERED_AT,
    resultType: "typed-payload",
    payload: { remediation: "knowledge-patch", knowledge: "human-proportion-rules", qualityBoost: 0.1 },
    appliesAsChangeSetId: null,
  },
  DATA_GAP: {
    deliveredAt: ARENA_FIXTURE_DELIVERED_AT,
    resultType: "guidance",
    payload: { remediation: "evidence-recall", evidence: "additional-reference-set", qualityBoost: 0.08 },
    appliesAsChangeSetId: null,
  },
  EXPERT_GAP: {
    deliveredAt: ARENA_FIXTURE_DELIVERED_AT,
    resultType: "artifact",
    payload: { remediation: "expert-correction-artifact", artifactKind: "corrected-geometry", qualityBoost: 0.15 },
    appliesAsChangeSetId: null,
  },
});

/** Minimum confidence before escalation is eligible. */
export const ESCALATION_CONFIDENCE_THRESHOLD = 0.5;

/** Deterministic eligibility rule: >= 1 attempted strategy AND confidence >= 0.5. */
export function computeEscalationEligibility(input: {
  readonly attemptedStrategies: readonly AttemptedStrategy[];
  readonly confidence: number;
}): "not-eligible" | "eligible" {
  const attemptedEnough = input.attemptedStrategies.length >= 1;
  const confidentEnough = Number.isFinite(input.confidence) && input.confidence >= ESCALATION_CONFIDENCE_THRESHOLD;
  return attemptedEnough && confidentEnough ? "eligible" : "not-eligible";
}

export interface GapDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

export interface CapabilityGapInput {
  readonly intentRef?: OpaqueId | null;
  readonly attemptedStrategies: readonly AttemptedStrategy[];
  readonly failureEvidence?: readonly OpaqueId[];
  readonly category: CapabilityGapCategory;
  readonly confidence: number;
  readonly suggestedNextAction: string;
}

/** Records an immutable CapabilityGap. */
export function recordCapabilityGap(input: CapabilityGapInput, deps: GapDeps): CapabilityGap {
  if (input.attemptedStrategies.length === 0) {
    throw new Error("CapabilityGap requires at least one attempted strategy");
  }
  return deepFreeze({
    id: deps.ids.next("gap"),
    intentRef: input.intentRef ?? null,
    attemptedStrategies: Object.freeze([...input.attemptedStrategies]),
    failureEvidence: Object.freeze([...(input.failureEvidence ?? [])]),
    category: input.category,
    confidence: input.confidence,
    suggestedNextAction: input.suggestedNextAction,
    escalationEligibility: computeEscalationEligibility(input),
    arenaEscalationRef: null,
  });
}

/** Minimum sufficient context capsule sent to Arena (ARENA.md). */
export const ARENA_MINIMUM_CONTEXT: readonly string[] = [
  "intent-reference",
  "capability-gap-record",
  "relevant-solution-version",
  "privacy-policy",
];

/** Requests an Arena escalation for an eligible gap. Returns updated gap + ref. */
export function requestArenaEscalation(gap: CapabilityGap, deps: GapDeps): {
  readonly gap: CapabilityGap;
  readonly escalation: ArenaEscalationRef;
} {
  if (gap.escalationEligibility !== "eligible") {
    throw new Error(`gap ${gap.id} is not escalation-eligible`);
  }
  if (gap.arenaEscalationRef !== null) {
    throw new Error(`gap ${gap.id} already carries an escalation`);
  }
  const escalation: ArenaEscalationRef = deepFreeze({
    escalationId: deps.ids.next("escalation"),
    status: "requested",
    minimumContext: Object.freeze([...ARENA_MINIMUM_CONTEXT]),
    expertResult: null,
  });
  return {
    gap: deepFreeze({ ...gap, escalationEligibility: "escalated", arenaEscalationRef: escalation }),
    escalation,
  };
}

/**
 * Mock Arena delivers its typed expert result for the gap category.
 * Returns the updated gap (escalation "delivered"). Fixture-only path.
 */
export function deliverFixtureExpertResult(gap: CapabilityGap): {
  readonly gap: CapabilityGap;
  readonly result: ArenaExpertResult;
} {
  const escalation = gap.arenaEscalationRef;
  if (escalation === null || escalation.status !== "requested") {
    throw new Error(`gap ${gap.id} has no requested escalation`);
  }
  const result = ARENA_MOCK_EXPERT_RESULTS[gap.category];
  if (result === undefined) {
    throw new Error(`no fixture expert result for category ${gap.category}`);
  }
  const delivered: ArenaEscalationRef = deepFreeze({ ...escalation, status: "delivered", expertResult: result });
  return { gap: deepFreeze({ ...gap, arenaEscalationRef: delivered }), result };
}

/** Marks the expert result applied through ChangeSet `<changeSetId>`. */
export function markArenaResultApplied(gap: CapabilityGap, changeSetId: OpaqueId): CapabilityGap {
  const escalation = gap.arenaEscalationRef;
  if (escalation === null || escalation.expertResult === null) {
    throw new Error(`gap ${gap.id} has no expert result to apply`);
  }
  const appliedResult: ArenaExpertResult = deepFreeze({ ...escalation.expertResult, appliesAsChangeSetId: changeSetId });
  const applied: ArenaEscalationRef = deepFreeze({ ...escalation, status: "applied", expertResult: appliedResult });
  return deepFreeze({ ...gap, arenaEscalationRef: applied });
}

/** Deterministic gap category -> deficiency class targeted by remediation. */
export const GAP_CATEGORY_TO_DEFICIENCY: Readonly<Record<CapabilityGapCategory, string>> = {
  TOOL_GAP: "geometry",
  EDITOR_GAP: "appearance",
  MODEL_GAP: "identity",
  SKILL_GAP: "motion-naturalness",
  KNOWLEDGE_GAP: "composition",
  DATA_GAP: "geometry",
  EXPERT_GAP: "identity",
};

/**
 * Expresses an Arena expert result as deterministic ChangeSet operations.
 * The quality boost comes from the typed result payload when numeric.
 */
export function arenaResultToOperations(gap: CapabilityGap, result: ArenaExpertResult): readonly SolutionPatchOperation[] {
  const deficiencyClass = GAP_CATEGORY_TO_DEFICIENCY[gap.category];
  const boost = result.payload.qualityBoost;
  const delta = typeof boost === "number" && Number.isFinite(boost) ? boost : 0.1;
  return [{ op: "adjust_quality", deficiencyClass, delta }];
}
