// Deterministic round-trip fidelity scorer (W5C).
//
// The fidelity score is a COMPUTED fixture objective (deterministic
// arithmetic over the intended edit plan and the adapter's change set) — it
// is explicitly not a user study, not a live measurement, and not a
// scientific claim about any real editor technology. Effort, latency and
// cost are recorded by the runner as "not-measured (simulated)" markers;
// they are never faked here.

import { canonicalJson } from "../determinism.js";
import { roundTo } from "../determinism.js";
import type { NeutralCanonicalState, NeutralEntity, NeutralEnvironment, CandidateOperation } from "../adapters/editorAdapterSeam.js";
import { applyCandidateOperations } from "../adapters/editorAdapterSeam.js";
import { decodeEditOpPayload, type NeutralEditChangeSet, type NeutralEditingRequest } from "./editingAdapterSeam.js";

/** Score weights (authored fixture definition — asserted in tests). */
export const ROUND_TRIP_WEIGHTS = { entityFidelity: 0.6, environmentFidelity: 0.2, opFaithfulness: 0.2 } as const;

export const SCORER_ROUND_TRIP_VERSION =
  "you-lab-round-trip-scorer/1 (deterministic fixture objective — computed, not measured)";

export interface RoundTripFidelityParts {
  /** Fraction of intended-final entities present and canonical-equal after the round trip. */
  readonly entityFidelity: number;
  /** Fraction of environment fields preserved (1 when no environment edit was intended). */
  readonly environmentFidelity: number;
  /** Fraction of intended operations structurally represented in the applied change set. */
  readonly opFaithfulness: number;
  readonly fidelityScore: number;
}

/** Intended candidate operations for an edit plan over a subject state (deterministic). */
export function intendedOperationsForPlan(
  state: NeutralCanonicalState,
  request: NeutralEditingRequest,
): CandidateOperation[] {
  const plan = request.editPlan;
  const byId = new Map(state.entities.map((entity) => [entity.id, entity]));
  const operations: CandidateOperation[] = [];
  const scaleIds = Object.keys(plan.scaleEdits).sort();
  for (const entityId of scaleIds) {
    const factor = plan.scaleEdits[entityId];
    if (factor === undefined) continue;
    const entity = byId.get(entityId);
    if (!entity) continue;
    operations.push({
      op: "upsert_entity",
      entity: {
        ...entity,
        transform: {
          ...entity.transform,
          scale: [
            entity.transform.scale[0] * factor,
            entity.transform.scale[1] * factor,
            entity.transform.scale[2] * factor,
          ] as const,
        },
      },
    });
  }
  for (const entity of [...plan.addedEntities].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    operations.push({ op: "upsert_entity", entity });
  }
  for (const entityId of [...plan.removedEntityIds].sort()) {
    operations.push({ op: "remove_entity", entityId });
  }
  if (plan.environment !== undefined) {
    operations.push({ op: "update_environment", environment: plan.environment });
  }
  return operations;
}

/**
 * Score a round-trip: apply the adapter's change set to the subject state
 * (decoding payloads from the content-store sidecar) and compare the final
 * state against the intended final state (the edit plan applied directly).
 */
export function scoreRoundTripFidelity(
  subjectState: NeutralCanonicalState,
  request: NeutralEditingRequest,
  changeSet: NeutralEditChangeSet,
  payloads: Readonly<Record<string, Record<string, unknown>>>,
): RoundTripFidelityParts {
  const applied: CandidateOperation[] = [];
  for (const op of changeSet.ops) {
    const payload = payloads[op.id];
    if (!payload) continue;
    applied.push(decodeEditOpPayload(op, payload));
  }
  const actualFinal = applyCandidateOperations(subjectState, applied);
  const intendedFinal = applyCandidateOperations(subjectState, intendedOperationsForPlan(subjectState, request));

  // Entity fidelity: canonical-equality over the union of intended/actual ids.
  const intendedById = new Map(intendedFinal.entities.map((entity) => [entity.id, entity]));
  const actualById = new Map(actualFinal.entities.map((entity) => [entity.id, entity]));
  const allIds = [...new Set([...intendedById.keys(), ...actualById.keys()])].sort();
  let entityMatches = 0;
  for (const id of allIds) {
    const intended = intendedById.get(id);
    const actual = actualById.get(id);
    if (intended && actual && canonicalJson(intended) === canonicalJson(actual)) {
      entityMatches += 1;
    }
  }
  const entityFidelity = allIds.length === 0 ? 1 : entityMatches / allIds.length;

  // Environment fidelity: field-level comparison (1 when no edit intended).
  const environmentFidelity = environmentMatch(intendedFinal.environment, actualFinal.environment, request);

  // Op faithfulness: fraction of intended ops with a structurally matching applied op.
  const intendedOps = intendedOperationsForPlan(subjectState, request);
  const appliedKeys = new Set(applied.map(operationKey));
  let faithful = 0;
  for (const operation of intendedOps) {
    if (appliedKeys.has(operationKey(operation))) faithful += 1;
  }
  const opFaithfulness = intendedOps.length === 0 ? 1 : faithful / intendedOps.length;

  return {
    entityFidelity: roundTo(entityFidelity, 4),
    environmentFidelity: roundTo(environmentFidelity, 4),
    opFaithfulness: roundTo(opFaithfulness, 4),
    fidelityScore: roundTo(
      ROUND_TRIP_WEIGHTS.entityFidelity * entityFidelity +
        ROUND_TRIP_WEIGHTS.environmentFidelity * environmentFidelity +
        ROUND_TRIP_WEIGHTS.opFaithfulness * opFaithfulness,
      4,
    ),
  };
}

function environmentMatch(
  intended: NeutralEnvironment,
  actual: NeutralEnvironment,
  request: NeutralEditingRequest,
): number {
  if (request.editPlan.environment === undefined) return 1;
  let matched = 0;
  if (canonicalJson(intended.keyLightDirection) === canonicalJson(actual.keyLightDirection)) matched += 1;
  if (intended.ambientIntensity === actual.ambientIntensity) matched += 1;
  if (intended.background === actual.background) matched += 1;
  return matched / 3;
}

function operationKey(operation: CandidateOperation): string {
  if (operation.op === "upsert_entity") return `upsert_entity:${operation.entity.id}`;
  if (operation.op === "remove_entity") return `remove_entity:${operation.entityId}`;
  return "update_environment";
}

/** Read the neutral canonical state out of subject artifact content (defensive). */
export function subjectStateFromContent(content: Readonly<Record<string, unknown>>): NeutralCanonicalState {
  return {
    entities: (content.entities as readonly NeutralEntity[] | undefined) ?? [],
    environment: (content.environment as NeutralEnvironment | undefined) ?? {
      keyLightDirection: [0, 0, 0],
      ambientIntensity: 0,
      background: "",
    },
  };
}
