// Deterministic mock editing adapter (W5C).
//
// Implements the provider-neutral editing seam against pure mock candidates.
// The mock transforms the fixture's intended edit plan into an
// EditChangeSet-shaped result — content-addressed op payloads (payloadRef +
// payloadHash = sha-256 of the canonical payload bytes) — with seeded
// degradation knobs (op dropout, numeric jitter, environment loss) so the
// round-trip benchmark can score different fidelity classes across the
// native/embedded/external kinds. PURE MOCKS (technologyId: null): their
// parameters are fixture inputs exercising the seam, NOT assessments of any
// real editor technology. No clock, no Math.random, no network — all
// degradation is derived from hash-keyed streams (unitFrom), so every value
// is a pure function of (adapterId, requestId, opIndex, entityId).

import { canonicalJson } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import type { NeutralEntity, NeutralEnvironment, CandidateOperation } from "../adapters/editorAdapterSeam.js";
import {
  assertEditingRequestSupported,
  encodeEditOpPayload,
  neutralEditChangeSetId,
  neutralEditOpPayloadRef,
  notMeasuredEditingEffortFields,
  sha256Hex,
  type EditingAdapter,
  type EditingAdapterProfile,
  type NeutralEditChangeSet,
  type NeutralEditChangeSetOp,
  type NeutralEditingOutput,
  type NeutralEditingRequest,
  type NeutralEditorKind,
  type NeutralImportExportFormat,
} from "./editingAdapterSeam.js";

const GENERATOR = "you-lab-mock-editing-adapter/1";

/** Mock degradation configuration (fixture input, not a technology assessment). */
export interface MockEditingConfig {
  readonly id: string;
  readonly editorKind: NeutralEditorKind;
  readonly supportedFormats: readonly NeutralImportExportFormat[];
  /** Seeded per-op dropout probability (0..1): fraction of intended ops lost in the round trip. */
  readonly opDropoutRate: number;
  /** Seeded relative jitter applied to numeric transform values (0..1). */
  readonly transformJitter: number;
  /** Whether environment edits survive the round trip at all. */
  readonly environmentSurvives: boolean;
}

export function createMockEditingAdapter(config: MockEditingConfig): EditingAdapter {
  const profile: EditingAdapterProfile = {
    id: config.id,
    technologyId: null,
    editorKind: config.editorKind,
    supportedFormats: config.supportedFormats,
    deterministic: true,
    determinismNote: "pure mock: all degradation is seed-derived (unitFrom keyed streams); byte-identical replay from the seed",
    roundTripSafe: false,
    productionEligible: null,
    eligibilityBasis: "pure mock candidate — no registry backing, no eligibility claim",
  };
  return {
    profile,
    invoke(request: NeutralEditingRequest): NeutralEditingOutput {
      assertEditingRequestSupported(profile, request);
      const entities = (request.subjectArtifact.content.entities as readonly NeutralEntity[] | undefined) ?? [];
      const environment = request.subjectArtifact.content.environment as NeutralEnvironment | undefined;
      const operations = buildOperations(config, request, entities);
      const changeSetId = neutralEditChangeSetId(config.id, request.requestId);
      const warnings: string[] = [];
      const ops: NeutralEditChangeSetOp[] = [];
      const payloads: Record<string, Record<string, unknown>> = {};
      for (let index = 0; index < operations.length; index++) {
        const operation = operations[index];
        if (!operation) continue;
        const payload = encodeEditOpPayload(operation);
        const payloadBytes = canonicalJson(payload);
        const payloadHash = sha256Hex(payloadBytes);
        const opId = `op-${changeSetId}-${String(index).padStart(2, "0")}`;
        ops.push({
          id: opId,
          kind: operation.op,
          payloadRef: neutralEditOpPayloadRef(config.id, request.requestId, index),
          payloadHash,
        });
        payloads[opId] = payload;
      }
      if (!config.environmentSurvives && request.editPlan.environment !== undefined) {
        warnings.push("environment edit did not survive the mock round trip (format conversion loss)");
      }
      const changeSet: NeutralEditChangeSet = {
        id: changeSetId,
        sessionId: request.editingSessionId,
        ops,
        createdAt: request.submittedAt,
      };
      const editedContent = applyMockOperations({ entities: [...entities], environment }, operations);
      return {
        adapterId: config.id,
        requestId: request.requestId,
        changeSet,
        payloads,
        editedContentHash: sha256Hex(canonicalJson(editedContent)),
        warnings: [...new Set(warnings)].sort(),
        effort: notMeasuredEditingEffortFields(),
        simulated: true,
      };
    },
  };
}

/** Build the degraded candidate operations for (config, request, subject entities). */
function buildOperations(
  config: MockEditingConfig,
  request: NeutralEditingRequest,
  entities: readonly NeutralEntity[],
): CandidateOperation[] {
  const plan = request.editPlan;
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const operations: CandidateOperation[] = [];
  const scaleIds = Object.keys(plan.scaleEdits).sort();
  for (const entityId of scaleIds) {
    const factor = plan.scaleEdits[entityId];
    if (factor === undefined) continue;
    const entity = byId.get(entityId);
    if (!entity) continue;
    const jitter = 1 + (unitFrom(config.id, request.requestId, entityId, "scale") * 2 - 1) * config.transformJitter;
    operations.push({
      op: "upsert_entity",
      entity: {
        ...entity,
        transform: {
          ...entity.transform,
          scale: [
            round3(entity.transform.scale[0] * factor * jitter),
            round3(entity.transform.scale[1] * factor * jitter),
            round3(entity.transform.scale[2] * factor * jitter),
          ] as const,
        },
      },
    });
  }
  for (const entity of [...plan.addedEntities].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    operations.push({ op: "upsert_entity", entity });
  }
  for (const entityId of [...plan.removedEntityIds].sort()) {
    if (!byId.has(entityId)) continue;
    operations.push({ op: "remove_entity", entityId });
  }
  if (plan.environment !== undefined && config.environmentSurvives) {
    operations.push({ op: "update_environment", environment: plan.environment });
  }
  // Seeded op dropout: keep the deterministic order, drop by per-op survival draw.
  const kept: CandidateOperation[] = [];
  for (let index = 0; index < operations.length; index++) {
    const operation = operations[index];
    if (!operation) continue;
    const dropped = unitFrom(config.id, request.requestId, `op-${index}`, "dropout") < config.opDropoutRate;
    if (dropped) continue;
    kept.push(operation);
  }
  return kept;
}

/** Apply mock operations to a neutral-state-like record (pure). */
function applyMockOperations(
  state: { entities: NeutralEntity[]; environment: NeutralEnvironment | undefined },
  operations: readonly CandidateOperation[],
): Record<string, unknown> {
  let entities = [...state.entities];
  let environment = state.environment;
  for (const operation of operations) {
    if (operation.op === "upsert_entity") {
      entities = entities.filter((entity) => entity.id !== operation.entity.id);
      entities = [...entities, operation.entity];
    } else if (operation.op === "remove_entity") {
      entities = entities.filter((entity) => entity.id !== operation.entityId);
    } else if (environment !== undefined) {
      environment = { ...environment, ...operation.environment };
    }
  }
  const sorted = [...entities].sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    entities: sorted,
    ...(environment === undefined ? {} : { environment }),
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Generator label for provenance wiring (honest mock scope). */
export function mockEditingGenerator(): string {
  return GENERATOR;
}
