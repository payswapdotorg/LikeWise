// YOU Solution application service — the single authority over Solution
// truth (docs/you/CONTRACTS.md "State ownership", WORK_ORDERS.md W1A).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns the per-solution records (identity,
// version chain, event ledger, protocol runtime, feedback/evidence/
// session/gap stores) and the learning-candidate store; the concrete
// flows live in the solution*Flow modules and always mutate through the
// version chain + append-only ledger (solutionLedgerOps.proposeAndAccept
// is the only path to canonical truth). Phase 0 is fully deterministic:
// injected clock + seeded RNG; everything simulated stays labeled
// simulated (truth law).

import type { OpaqueId, SolutionEvent, SolutionIdentity, SolutionVersion } from "@zcode/shared";
import { createDeterministicClock, type YouClock } from "../../../shared/src/you/clock.js";
import { buildFixtureSnapshot } from "../../../shared/src/you/fixture.js";
import { replayLedger, SolutionEventLedger, type SolutionLedgerProjection } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import type { LearningCandidate } from "../../../shared/src/you/learning.js";
import { SolutionProtocolRuntime } from "../../../shared/src/you/protocol.js";
import { createDeterministicRng, seedFromString, uint32ToHex8 } from "../../../shared/src/you/rng.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import { SolutionVersionChain } from "../../../shared/src/you/versioning.js";
import { emitVersionPublished, proposeAndAccept, statusMap, escalationStatusMap } from "./solutionLedgerOps.js";
import { applyArenaResultOp, escalateGapToArenaMockOp, recordFixtureCapabilityGapOp } from "./solutionEscalationFlow.js";
import {
  improveFromEvidenceOp,
  provideFixtureEvidenceOp,
  requestEvidenceOp,
  submitFeedbackOp,
} from "./solutionFeedbackFlow.js";
import {
  exportSolutionOp,
  recommendEditorOp,
  simulateExternalEditAndReImportOp,
} from "./solutionInterchangeFlow.js";
import {
  beginTakeoverOp,
  closeTakeoverWithCorrectionOp,
  deriveLearningOp,
} from "./solutionTakeoverFlow.js";
import type {
  FeedbackIntakeInput,
  GapIntakeInput,
  IntentRecord,
  LearningOutcome,
  ReImportOutcome,
  SolutionRecord,
  SolutionServiceDeps,
  SolutionServiceResult,
  TakeoverInput,
  TakeoverOutcome,
  ImprovementOutcome,
  ArenaOutcome,
} from "./solutionServiceTypes.js";
import { failure } from "./solutionServiceTypes.js";

export interface SolutionServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
}

/** The application-service authority over Solution truth. */
export class SolutionService {
  private readonly solutions = new Map<OpaqueId, SolutionRecord>();
  private readonly learningCandidates = new Map<string, LearningCandidate>();
  private readonly deps: SolutionServiceDeps;

  private constructor(readonly workspaceIdentity: string, clock: YouClock, ids: YouIdFactory) {
    this.deps = { clock, ids };
  }

  /** Creates a deterministic service (injected clock + seeded ids). */
  static create(config: SolutionServiceConfig): SolutionService {
    const seed = config.seed ?? "you-phase0-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new SolutionService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
    );
  }

  /** Intent intake: creates the fixture Solution (v1) from the intent seed. */
  intakeIntent(input: { readonly text: string; readonly displayName?: string }): SolutionServiceResult<{
    readonly solution: SolutionIdentity;
    readonly version: SolutionVersion;
    readonly intent: IntentRecord;
    readonly learningApplied: boolean;
  }> {
    if (input.text.length === 0) {
      return failure("YOU_INVALID_STATE", "intent text must be non-empty", { reason: "empty-intent" });
    }
    const numericSeed = seedFromString(input.text);
    const fingerprint = uint32ToHex8(numericSeed);
    const solutionId = this.deps.ids.next("solution");
    const identity: SolutionIdentity = {
      id: solutionId,
      workspaceIdentity: this.workspaceIdentity,
      displayName: input.displayName ?? `Solution ${fingerprint.slice(0, 6)}`,
    };
    const created = SolutionVersionChain.createRoot({
      solution: identity,
      snapshot: buildFixtureSnapshot(numericSeed),
      provenanceSource: `fixture:${fingerprint}`,
      deps: this.deps,
    });
    const ledger = new SolutionEventLedger(solutionId, this.deps);
    ledger.append({
      type: "solution-created",
      subjectRef: solutionId,
      generator: "fixture",
      payload: { seedFingerprint: fingerprint, displayName: identity.displayName, simulated: true },
    });
    const intent: IntentRecord = {
      id: this.deps.ids.next("intent"),
      text: input.text,
      fingerprint,
      solutionId,
      createdAt: this.deps.clock.now(),
    };
    const record: SolutionRecord = {
      identity,
      intent,
      chain: created.chain,
      ledger,
      runtime: SolutionProtocolRuntime.open({
        solution: identity,
        versionResolver: (versionId) => created.chain.get(versionId),
        initialVersionId: created.root.id,
        deps: this.deps,
      }).runtime,
      feedback: new Map(),
      evidence: new Map(),
      evidenceToFeedback: new Map(),
      editSessions: new Map(),
      sessionChanges: new Map(),
      gaps: new Map(),
      changeSets: new Map(),
      artifacts: new Map(),
    };
    emitVersionPublished(record, created.root, { simulated: true });
    this.solutions.set(solutionId, record);

    const candidate = this.learningCandidates.get(fingerprint);
    if (candidate === undefined) {
      return { ok: true, value: { solution: identity, version: created.root, intent, learningApplied: false } };
    }
    const applied = proposeAndAccept(record, {
      baseVersionId: created.root.id,
      operations: candidate.operations,
      intentRef: intent.id,
      authorType: "user",
      changePayload: { learningApplied: true, learningCandidateId: candidate.id, actor: "user" },
      versionPayload: { learningApplied: true, learningCandidateId: candidate.id },
    });
    if (applied === null) {
      return failure("YOU_INVALID_STATE", "learning candidate could not be applied to the new solution", {
        reason: "learning-application-failed",
        learningCandidateId: candidate.id,
      });
    }
    return { ok: true, value: { solution: identity, version: applied.version, intent, learningApplied: true } };
  }

  submitFeedback(solutionId: OpaqueId, input: FeedbackIntakeInput): SolutionServiceResult<{ readonly feedback: import("@zcode/shared").FeedbackRequest }> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : submitFeedbackOp(record, this.deps, input);
  }

  requestEvidence(solutionId: OpaqueId, feedbackId: OpaqueId): SolutionServiceResult<{ readonly evidence: import("@zcode/shared").EvidenceRequest }> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : requestEvidenceOp(record, this.deps, feedbackId);
  }

  provideFixtureEvidence(solutionId: OpaqueId, evidenceId: OpaqueId): SolutionServiceResult<{ readonly evidence: import("@zcode/shared").EvidenceRequest }> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : provideFixtureEvidenceOp(record, evidenceId);
  }

  improveFromEvidence(solutionId: OpaqueId, feedbackId: OpaqueId): SolutionServiceResult<ImprovementOutcome> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : improveFromEvidenceOp(record, feedbackId);
  }

  beginTakeover(solutionId: OpaqueId, input: TakeoverInput): SolutionServiceResult<{ readonly session: import("@zcode/shared").EditSession }> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : beginTakeoverOp(record, this.deps, input);
  }

  closeTakeoverWithCorrection(
    solutionId: OpaqueId,
    sessionId: OpaqueId,
    input: { readonly operations: readonly import("@zcode/shared").SolutionPatchOperation[] },
  ): SolutionServiceResult<TakeoverOutcome> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : closeTakeoverWithCorrectionOp(record, this.deps, sessionId, input);
  }

  /** Consent-gated learning derivation; stores only granted candidates. */
  deriveLearningFromTakeover(solutionId: OpaqueId, sessionId: OpaqueId): SolutionServiceResult<LearningOutcome> {
    const record = this.require(solutionId);
    if (record === null) {
      return unknownSolution(solutionId);
    }
    const derived = deriveLearningOp(record, this.deps, sessionId);
    if (!derived.ok) {
      return derived;
    }
    if (derived.value.outcome.ok) {
      this.learningCandidates.set(record.intent.fingerprint, derived.value.outcome.candidate);
      return { ok: true, value: { stored: true, outcome: derived.value.outcome } };
    }
    return derived;
  }

  recommendEditor(solutionId: OpaqueId): SolutionServiceResult<{ readonly editorId: string; readonly exportFormat: string }> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : recommendEditorOp(record);
  }

  exportSolution(solutionId: OpaqueId): SolutionServiceResult<{ readonly artifact: import("../../../shared/src/you/artifact.js").SolutionArtifactPackage }> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : exportSolutionOp(record, this.deps);
  }

  simulateExternalEditAndReImport(
    solutionId: OpaqueId,
    artifactId: OpaqueId,
    input: { readonly operations: readonly import("@zcode/shared").SolutionPatchOperation[] },
  ): SolutionServiceResult<ReImportOutcome> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : simulateExternalEditAndReImportOp(record, this.deps, artifactId, input);
  }

  recordFixtureCapabilityGap(solutionId: OpaqueId, input: GapIntakeInput): SolutionServiceResult<{ readonly gap: import("@zcode/shared").CapabilityGap }> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : recordFixtureCapabilityGapOp(record, this.deps, input);
  }

  escalateGapToArenaMock(solutionId: OpaqueId, gapId: OpaqueId): SolutionServiceResult<{ readonly gap: import("@zcode/shared").CapabilityGap }> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : escalateGapToArenaMockOp(record, this.deps, gapId);
  }

  applyArenaResult(solutionId: OpaqueId, gapId: OpaqueId): SolutionServiceResult<ArenaOutcome> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : applyArenaResultOp(record, gapId);
  }

  /** Live authoritative projection (same shape as replayLedger output). */
  projectionOf(solutionId: OpaqueId): SolutionServiceResult<SolutionLedgerProjection> {
    const record = this.require(solutionId);
    if (record === null) {
      return unknownSolution(solutionId);
    }
    return {
      ok: true,
      value: {
        solutionId,
        currentVersionId: record.chain.current().id,
        versions: record.chain.versions().map((version) => ({
          versionId: version.id,
          versionNumber: version.version,
          parentVersionId: version.parentVersionId ?? "",
          authorType: version.provenance.generator,
          quality: version.state.quality,
        })),
        feedback: statusMap(record.feedback, (entry) => entry.status),
        evidence: statusMap(record.evidence, (entry) => entry.status),
        editSessions: statusMap(record.editSessions, (entry) => (entry.endedAt === null ? "open" : "closed")),
        changeSets: statusMap(record.changeSets, (entry) => entry.status),
        capabilityGaps: statusMap(record.gaps, (entry) =>
          entry.arenaEscalationRef?.status === "applied"
            ? "applied"
            : entry.escalationEligibility === "escalated"
              ? "escalated"
              : entry.escalationEligibility,
        ),
        arenaEscalations: escalationStatusMap(record),
      },
    };
  }

  /** Ledger events of one solution (persist + replay boundary). */
  ledgerEventsOf(solutionId: OpaqueId): SolutionServiceResult<readonly SolutionEvent[]> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : { ok: true, value: record.ledger.events() };
  }

  /** Ledger canonical serialization (persist boundary). */
  serializeLedgerOf(solutionId: OpaqueId): SolutionServiceResult<string> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : { ok: true, value: record.ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): SolutionServiceResult<string> {
    const record = this.require(solutionId);
    return record === null ? unknownSolution(solutionId) : { ok: true, value: stableContentHash(record.ledger.events()) };
  }

  /** Stored learning candidates (user can inspect what will be learned). */
  learningCandidatesOf(): readonly LearningCandidate[] {
    return [...this.learningCandidates.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  /** Replays a persisted ledger through the shared fold. */
  static replay(events: readonly SolutionEvent[]): SolutionLedgerProjection {
    return replayLedger(events);
  }

  private require(solutionId: OpaqueId): SolutionRecord | null {
    return this.solutions.get(solutionId) ?? null;
  }
}

function unknownSolution<T>(solutionId: OpaqueId): SolutionServiceResult<T> {
  return failure("YOU_INVALID_STATE", "unknown solution", { reason: "unknown-solution", solutionId });
}

/** Creates the deterministic Solution application service. */
export function createSolutionService(config: SolutionServiceConfig): SolutionService {
  return SolutionService.create(config);
}
