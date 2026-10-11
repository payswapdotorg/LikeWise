// Profile-backed production-eligible editing evaluation adapter (W5C).
//
// VS Code-class editing adapter behind the provider-neutral editing seam.
// HONEST SCOPE: this is an EVALUATION adapter — a deterministic simulation
// of a VS Code-class extensible native editor's round-trip behavior (the
// seam's native class; text/JSON artifacts edited byte-precisely with small
// seeded degradation), NOT the real Visual Studio Code runtime. Real
// runtime integration is W6+ compute-plane work; every effort/latency/cost
// field carries an explicit not-measured (simulated) marker (truth law —
// never invented numbers, never a claim that the real editor ran).
//
// Production eligibility is DERIVED from registry facts at construction
// time (permissive SPDX + maintenance recency, per
// editing/editorEvaluation.ts) and the factory FAILS CLOSED if 'vscode'
// stops deriving as the top eligible candidate.

import { canonicalJson } from "../determinism.js";
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
} from "./editingAdapterSeam.js";
import {
  assessEditingProductionEligibility,
  deriveEditingCandidateProfiles,
  rankEditingProductionEligible,
} from "./editorEvaluation.js";

const GENERATOR = "you-lab-vscode-evaluation-adapter/1 (simulated VS Code-class editing behavior; real Visual Studio Code not executed)";
export const VSCODE_EVALUATION_ADAPTER_ID = "vscode-editing-eval";

/**
 * Simulated degradation of a VS Code-class extensible editor round trip:
 * text/JSON edits apply byte-precisely — no op dropout and no numeric
 * drift in the simulated model (fixture arithmetic — labeled simulated,
 * never a measurement of the real editor).
 */
const SIMULATED_OP_DROPOUT_RATE = 0;

export interface VscodeAdapterFacts {
  /** Registry-derived eligibility basis (cited verbatim from the assessment). */
  readonly eligibilityBasis: string;
  readonly maintenanceAgeDays: number;
}

export function createVscodeEditingEvaluationAdapter(
  registry: Parameters<typeof deriveEditingCandidateProfiles>[0],
): EditingAdapter & { readonly facts: VscodeAdapterFacts } {
  const technology = registry.byId("vscode");
  if (!technology) {
    throw new Error("vscode-editing-eval: technology 'vscode' missing from the registry (truth law — refusing to construct)");
  }
  const candidateProfiles = deriveEditingCandidateProfiles(registry);
  const vscodeProfile = candidateProfiles.find((profile) => profile.technologyId === "vscode");
  if (!vscodeProfile) {
    throw new Error("vscode-editing-eval: 'vscode' is not a derived editing candidate (truth law — refusing to construct)");
  }
  const ranked = rankEditingProductionEligible(assessEditingProductionEligibility(candidateProfiles, registry));
  const top = ranked[0];
  if (!top || top.technologyId !== "vscode") {
    throw new Error(
      `vscode-editing-eval: 'vscode' no longer derives as the top production-eligible candidate (top: ${top?.technologyId ?? "none"}) — refusing to construct (truth law)`,
    );
  }
  const profile: EditingAdapterProfile = {
    id: VSCODE_EVALUATION_ADAPTER_ID,
    technologyId: "vscode",
    editorKind: "native",
    supportedFormats: ["json", "edit-interchange"],
    deterministic: true,
    determinismNote:
      "the evaluation adapter is a pure function of the request (seeded derivations only); the real VS Code editor surface is user-configurable and not bit-reproducible (engineering assessment)",
    roundTripSafe: true,
    productionEligible: true,
    eligibilityBasis: top.basis,
  };
  const facts: VscodeAdapterFacts = {
    eligibilityBasis: top.basis,
    maintenanceAgeDays: top.maintenanceAgeDays,
  };
  return {
    profile,
    facts,
    invoke(request: NeutralEditingRequest): NeutralEditingOutput {
      assertEditingRequestSupported(profile, request);
      const entities = (request.subjectArtifact.content.entities as readonly NeutralEntity[] | undefined) ?? [];
      const environment = request.subjectArtifact.content.environment as NeutralEnvironment | undefined;
      const operations = buildVscodeOperations(request, entities);
      const changeSetId = neutralEditChangeSetId(VSCODE_EVALUATION_ADAPTER_ID, request.requestId);
      const ops: NeutralEditChangeSetOp[] = [];
      const payloads: Record<string, Record<string, unknown>> = {};
      for (let index = 0; index < operations.length; index++) {
        const operation = operations[index];
        if (!operation) continue;
        const payload = encodeEditOpPayload(operation);
        const payloadHash = sha256Hex(canonicalJson(payload));
        const opId = `op-${changeSetId}-${String(index).padStart(2, "0")}`;
        ops.push({
          id: opId,
          kind: operation.op,
          payloadRef: neutralEditOpPayloadRef(VSCODE_EVALUATION_ADAPTER_ID, request.requestId, index),
          payloadHash,
        });
        payloads[opId] = payload;
      }
      const changeSet: NeutralEditChangeSet = {
        id: changeSetId,
        sessionId: request.editingSessionId,
        ops,
        createdAt: request.submittedAt,
      };
      const editedContent = applyOperations({ entities: [...entities], environment }, operations);
      return {
        adapterId: VSCODE_EVALUATION_ADAPTER_ID,
        requestId: request.requestId,
        changeSet,
        payloads,
        editedContentHash: sha256Hex(canonicalJson(editedContent)),
        warnings: [],
        effort: notMeasuredEditingEffortFields(),
        simulated: true,
      };
    },
  };
}

/** VS Code-class simulated edit operations (seeded micro-jitter only). */
function buildVscodeOperations(
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
    operations.push({
      op: "upsert_entity",
      entity: {
        ...entity,
        transform: {
          ...entity.transform,
          scale: [
            round3(entity.transform.scale[0] * factor),
            round3(entity.transform.scale[1] * factor),
            round3(entity.transform.scale[2] * factor),
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
  if (plan.environment !== undefined) {
    operations.push({ op: "update_environment", environment: plan.environment });
  }
  // SIMULATED_OP_DROPOUT_RATE is 0 (VS Code-class text edits apply
  // byte-precisely) — no seeded dropout draw is performed.
  void SIMULATED_OP_DROPOUT_RATE;
  return operations;
}

/** Apply operations to a neutral-state-like record (pure). */
function applyOperations(
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

/** Generator label for provenance wiring (honest simulated scope). */
export function vscodeEvaluationGenerator(): string {
  return GENERATOR;
}
