// YOU Solution service — shared internal types and helpers.
//
// The application service (solutionService.ts) is the single authority
// over Solution truth; the flow modules (solutionFeedbackFlow.ts,
// solutionTakeoverFlow.ts, solutionInterchangeFlow.ts,
// solutionEscalationFlow.ts, solutionLedgerOps.ts) operate on the
// per-solution record it owns. This module carries the shapes shared by
// those collaborators. Nothing here is a second authority.

import type {
  AttemptedStrategy,
  CapabilityGap,
  CapabilityGapCategory,
  ChangeSet,
  ConsentReference,
  EditEvidenceMode,
  EditMode,
  EditSession,
  EvidenceRequest,
  FeedbackCategory,
  FeedbackRequest,
  LearningScope,
  OpaqueId,
  SolutionIdentity,
  SolutionQualityMap,
  SolutionSelector,
  SolutionVersion,
  YouError,
} from "@zcode/shared";
import type { SolutionArtifactPackage, SolutionStateDiff } from "../../../shared/src/you/artifact.js";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";
import type { LearningDerivationOutcome } from "../../../shared/src/you/learning.js";
import type { SolutionProtocolRuntime } from "../../../shared/src/you/protocol.js";
import type { SolutionVersionChain } from "../../../shared/src/you/versioning.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type SolutionServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function failure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

export interface SolutionServiceDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/** One solution owned by the service: identity, chain, ledger, runtime, stores. */
export interface SolutionRecord {
  readonly identity: SolutionIdentity;
  readonly intent: IntentRecord;
  readonly chain: SolutionVersionChain;
  readonly ledger: SolutionEventLedger;
  readonly runtime: SolutionProtocolRuntime;
  readonly feedback: Map<OpaqueId, FeedbackRequest>;
  readonly evidence: Map<OpaqueId, EvidenceRequest>;
  readonly evidenceToFeedback: Map<OpaqueId, OpaqueId>;
  readonly editSessions: Map<OpaqueId, EditSession>;
  readonly sessionChanges: Map<OpaqueId, OpaqueId>;
  readonly gaps: Map<OpaqueId, CapabilityGap>;
  readonly changeSets: Map<OpaqueId, ChangeSet>;
  readonly artifacts: Map<OpaqueId, SolutionArtifactPackage>;
}

/** Intent intake record (Phase-0; the TL may freeze a richer Intent later). */
export interface IntentRecord {
  readonly id: OpaqueId;
  readonly text: string;
  readonly fingerprint: string;
  readonly solutionId: OpaqueId;
  readonly createdAt: string;
}

export interface FeedbackIntakeInput {
  readonly targetRef: SolutionSelector;
  readonly category: FeedbackCategory;
  readonly userComment: string;
  readonly requestedAction: string;
  readonly scope?: LearningScope;
  readonly consent?: ConsentReference;
}

export interface TakeoverInput {
  readonly mode: EditMode;
  readonly evidenceMode: EditEvidenceMode;
  readonly consent?: ConsentReference;
  readonly editorRef?: string;
  readonly editorVersion?: string;
  readonly platform?: string;
}

export interface ImprovementOutcome {
  readonly before: SolutionQualityMap;
  readonly after: SolutionQualityMap;
  readonly deltas: Readonly<Record<string, number>>;
  readonly version: SolutionVersion;
  readonly changeSet: ChangeSet;
  readonly feedback: FeedbackRequest;
  readonly evidence: EvidenceRequest;
}

export interface TakeoverOutcome {
  readonly session: EditSession;
  readonly diff: SolutionStateDiff;
  readonly version: SolutionVersion;
  readonly changeSet: ChangeSet;
  readonly artifact: SolutionArtifactPackage;
}

export interface ReImportOutcome {
  readonly editedArtifact: SolutionArtifactPackage;
  readonly diff: SolutionStateDiff;
  readonly version: SolutionVersion;
  readonly changeSet: ChangeSet;
}

export interface ArenaOutcome {
  readonly gap: CapabilityGap;
  readonly version: SolutionVersion;
  readonly changeSet: ChangeSet;
}

export interface LearningOutcome {
  readonly stored: boolean;
  readonly outcome: LearningDerivationOutcome;
}

export interface GapIntakeInput {
  readonly category: CapabilityGapCategory;
  readonly confidence: number;
  readonly attemptedStrategies: readonly AttemptedStrategy[];
  readonly failureEvidence?: readonly OpaqueId[];
  readonly suggestedNextAction?: string;
}

/** Flattens a quality map into ledger payload keys (`quality.<class>`). */
export function qualityPayload(quality: SolutionQualityMap): Record<string, number> {
  const payload: Record<string, number> = {};
  for (const [deficiencyClass, score] of Object.entries(quality).sort(([a], [b]) => (a < b ? -1 : 1))) {
    payload[`quality.${deficiencyClass}`] = score;
  }
  return payload;
}
