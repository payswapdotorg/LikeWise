// Provider-neutral learning adapter seam (W6C).
//
// External learners are adapters, never domain authorities
// (docs/you/ARCHITECTURE.md). This seam defines the neutral W6C learning
// surface: a typed learning invocation (a captured LearningSignal + a
// candidate scope) that produces LearningRecord-shaped candidate results —
// content-addressed learned content (contentRef + contentHash) per the
// frozen v6 contract laws. The neutral shapes are owned by you-lab and are
// structurally aligned with the frozen @zcode/shared YOU v6
// LearningSignal/LearningRecord/LearningRights shapes; mapping onto the
// frozen contract happens ONLY in src/contractSeam.ts.
//
// RIGHTS LAW: adapters never mint consent. Learning rights are threaded
// from the injected request context (consentRef + consentHash traceable to
// the wave-2 consent authority — there is no second consent path); records
// without rights are inert.
//
// Determinism: learned content, candidate records and digests are pure
// functions of their inputs (no clock, no Math.random, no network — seeded
// derivations only, docs/you/FIXTURES.md). Effort/latency/cost are
// structured fields carrying explicit not-measured markers (truth law —
// never invented numbers).

import { createHash } from "node:crypto";

import { fnv1a32, roundTo, sortedUnique } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import type { MetricField } from "../benchmarks/runner.js";

/** Neutral learning scope — aligned 1:1 with the frozen v1/v6 LearningScope taxonomy. */
export type NeutralLearningScope =
  | "GLOBAL" | "TENANT" | "APPLICATION" | "PROJECT" | "USER" | "TWIN" | "ASSET" | "TASK"
  | (string & {});

/** Neutral learning signal kind — aligned 1:1 with the frozen v6 LearningSignalKind. */
export type NeutralLearningSignalKind =
  | "feedback" | "manual-takeover" | "edit-session" | "expert-intervention" | "repeated-intent" | "capability-gap"
  | (string & {});

/** Neutral sanctioned usage class — aligned 1:1 with the frozen v6 LearningRightUsage. */
export type NeutralLearningRightUsage =
  | "organization-improvement" | "tool-selection" | "editor-selection"
  | "pipeline-improvement" | "capability-gap-analysis" | "personalization"
  | (string & {});

/** Neutral learner class taxonomy — the W6C order's candidate classes. */
export type NeutralLearnerClass =
  | "rule-induction" | "preference-learning" | "bandit-selection"
  | "contextual-ranking" | "cost-aware-selection" | "program-synthesis" | "workflow-mining"
  | (string & {});

/**
 * Neutral learner capability profile — the order's capability record
 * (input signal kinds, scopes supported, output classes). Researched data
 * derived from the technology registry (never a runtime authority);
 * structurally aligned with the frozen v6 learning shapes.
 */
export interface LearningCapabilityProfile {
  readonly id: string;
  readonly learnerClass: NeutralLearnerClass;
  readonly displayName: string;
  readonly inputSignalKinds: readonly NeutralLearningSignalKind[];
  readonly supportedScopes: readonly NeutralLearningScope[];
  readonly outputClasses: readonly NeutralLearningRightUsage[];
  readonly notes: string;
  readonly derivedFrom: string;
}

/** A captured neutral learning signal — aligned 1:1 with frozen v6 LearningSignal (evidence never inlined). */
export interface NeutralLearningSignal {
  readonly id: string;
  readonly kind: NeutralLearningSignalKind;
  readonly scope: NeutralLearningScope;
  readonly subjectRef: string | null;
  readonly evidenceRefs: readonly string[];
  readonly capturedAt: string;
  readonly simulated: boolean;
}

/**
 * Neutral learning rights — aligned 1:1 with the frozen v6 LearningRights.
 * THREADED from the injected request context; adapters never mint consent.
 */
export interface NeutralLearningRights {
  readonly usage: readonly NeutralLearningRightUsage[];
  readonly consentRef: string;
  readonly consentHash: string;
  readonly expiresAt: string | null;
}

/**
 * A LearningRecord-shaped candidate result — aligned 1:1 with the frozen v6
 * LearningRecord narrowed to adapter outputs: status is always "candidate"
 * (the validation ladder belongs to the learning service, W6A) and
 * supersession linkage is always null at the seam. Learned content is
 * content-addressed (contentRef + contentHash); payloads are never inlined.
 */
export interface NeutralLearningCandidate {
  readonly id: string;
  readonly signalId: string;
  readonly status: "candidate";
  readonly scope: NeutralLearningScope;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly rights: NeutralLearningRights;
  readonly validatedAt: string;
  readonly supersededById: null;
  readonly simulated: boolean;
}

/** Typed learning invocation request (LearningSignal + candidate scope + injected rights). */
export interface NeutralLearningRequest {
  readonly requestId: string;
  /** The captured learning signal to learn from (evidence content-addressed, never inlined). */
  readonly signal: NeutralLearningSignal;
  /** The candidate scope the learner is invoked under. */
  readonly scope: NeutralLearningScope;
  /** RIGHTS LAW: rights threaded from the injected context — adapters never mint consent. */
  readonly rights: NeutralLearningRights;
  readonly submittedAt: string;
}

/** Structured effort/latency/cost fields with honest markers (truth law). */
export interface LearningEffortFields {
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

/** Deterministic output of a typed learning invocation. */
export interface NeutralLearningOutput {
  readonly adapterId: string;
  readonly requestId: string;
  readonly candidates: readonly NeutralLearningCandidate[];
  /**
   * Learned-content payloads for this invocation keyed by candidate id —
   * the content-store sidecar the caller can resolve contentRefs against.
   * NEVER inlined in the candidate records themselves (the v6
   * content-addressing law holds: records carry contentRef + contentHash
   * only); each payload's canonical JSON hashes to its candidate's
   * contentHash.
   */
  readonly payloads: Readonly<Record<string, Record<string, unknown>>>;
  /** Canonical-JSON digest over the learned content entries (deterministic). */
  readonly learnedContentHash: string;
  readonly warnings: readonly string[];
  readonly effort: LearningEffortFields;
  readonly simulated: boolean;
}

/** Profile of a registered learning adapter behind the seam. */
export interface LearningAdapterProfile {
  readonly id: string;
  /** Backing registry technology id, or null for pure mock candidates. */
  readonly technologyId: string | null;
  readonly learnerClass: NeutralLearnerClass;
  readonly supportedSignalKinds: readonly NeutralLearningSignalKind[];
  readonly supportedScopes: readonly NeutralLearningScope[];
  /** "mock" for pure mocks; "evaluation" for registry-backed evaluation adapters. */
  readonly adapterKind: "mock" | "evaluation";
  /** Whether the adapter implementation itself is bit-deterministic. */
  readonly deterministic: boolean;
  readonly determinismNote: string;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
  readonly eligibilityBasis: string;
}

export interface LearningAdapter {
  readonly profile: LearningAdapterProfile;
  /** Typed learning invocation over the captured signal (deterministic, simulated). */
  learn(request: NeutralLearningRequest): NeutralLearningOutput;
}

/** Error code aligned with the frozen v6 typed error literal (you-lab-owned). */
export const LEARNING_UNSUPPORTED_CODE = "YOU_LEARNING_SIGNAL_INVALID";

/** Typed refusal thrown when an adapter is invoked with an unsupported signal kind or scope. */
export class UnsupportedLearningSignalError extends Error {
  readonly code = LEARNING_UNSUPPORTED_CODE;
  constructor(adapterId: string, detail: string, supported: readonly string[]) {
    super(
      `${LEARNING_UNSUPPORTED_CODE}: adapter '${adapterId}' does not support ${detail} (supported: ${supported.join(", ") || "none"})`,
    );
  }
}

/** Unsupported aspects of a request for an adapter ([] when fully supported). */
export function unsupportedLearningRequestAspects(
  profile: LearningAdapterProfile,
  request: NeutralLearningRequest,
): readonly string[] {
  const aspects: string[] = [];
  if (!profile.supportedSignalKinds.includes(request.signal.kind)) {
    aspects.push(`signal kind '${request.signal.kind}'`);
  }
  if (!profile.supportedScopes.includes(request.scope)) {
    aspects.push(`scope '${request.scope}'`);
  }
  return aspects;
}

/** Typed refusal helper: throws when the request signal kind/scope is not supported. */
export function assertLearningRequestSupported(
  profile: LearningAdapterProfile,
  request: NeutralLearningRequest,
): void {
  const unsupported = unsupportedLearningRequestAspects(profile, request);
  const first = unsupported[0];
  if (unsupported.length > 0 && first !== undefined) {
    throw new UnsupportedLearningSignalError(
      profile.id,
      unsupported.join(" and "),
      sortedUnique([
        ...profile.supportedSignalKinds.map((kind) => `kind:${kind}`),
        ...profile.supportedScopes.map((scope) => `scope:${scope}`),
      ]),
    );
  }
}

/** sha-256 hex digest of string/bytes input (deterministic, no clock). */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Opaque deterministic candidate record id for (adapterId, requestId, evidenceRef) — you_learning-record_<16hex>. */
export function neutralLearningCandidateId(adapterId: string, requestId: string, evidenceRef: string): string {
  return `you_learning-record_${sha256Hex(`${adapterId}|${requestId}|${evidenceRef}`).slice(0, 16)}`;
}

/** Opaque content-store learned-content reference for one candidate of (adapterId, requestId, index). */
export function neutralLearningContentRef(adapterId: string, requestId: string, index: number): string {
  return `content-store://you-lab/learning/${adapterId}/${requestId}/candidate-${index}`;
}

/** Honest not-measured effort fields for simulated learning adapters. */
export function notMeasuredLearningEffortFields(): LearningEffortFields {
  return {
    effort: { kind: "not-measured", marker: "not-measured (simulated)" },
    latency: { kind: "not-measured", marker: "not-measured (simulated)" },
    cost: { kind: "not-measured", marker: "not-measured (simulated)" },
  };
}

/**
 * Learning key domains of the synthetic learning model — the fixture
 * objective's vocabulary, one domain per sanctioned usage class (W6C
 * authored fixture definition — computed, not measured, and never a claim
 * about real learner behavior).
 */
export const LEARNING_KEY_DOMAINS = [
  "preferred-tool",
  "preferred-editor",
  "pipeline-step-order",
  "organization-rule",
  "capability-gap-priority",
  "personalization-weight",
] as const;

/** Canonical learned-content key for an evidence index (domain cycling, deterministic). */
export function intendedLearningKeyAt(index: number): string {
  return LEARNING_KEY_DOMAINS[index % LEARNING_KEY_DOMAINS.length] ?? LEARNING_KEY_DOMAINS[0]!;
}

/**
 * Canonical learned-content value for an evidence ref (hash-derived, in
 * [0.5, 1.0], rounded to 4 decimals). The shared synthetic model behind
 * simulated adapters and the fixture objective — a pure function of the
 * evidence ref (never a measurement of a real learner).
 */
export function intendedLearningValueAt(evidenceRef: string): number {
  return roundTo(0.5 + unitFrom("you-lab-learning-model", evidenceRef, "value") * 0.5, 4);
}

/** One learned-content entry inside a candidate record payload. */
export interface LearnedContentEntry {
  /** Learning key domain (e.g. "preferred-tool"). */
  readonly key: string;
  /** Learned value (deterministic fixture model — simulated, not measured). */
  readonly value: number;
  /** The evidence ref the entry was learned from (content-addressed). */
  readonly evidenceRef: string;
}

/**
 * Encode a learned-content entry as a content-addressed candidate payload
 * record. The payload bytes are the canonical JSON of the returned record;
 * the hash of those bytes is the candidate's contentHash
 * (content-addressing law).
 */
export function encodeLearningPayload(
  entry: LearnedContentEntry,
  request: NeutralLearningRequest,
): Record<string, unknown> {
  return {
    key: entry.key,
    value: entry.value,
    evidenceRef: entry.evidenceRef,
    signalKind: request.signal.kind,
    scope: request.scope,
    learnedAt: request.submittedAt,
  };
}

/** Decode a candidate payload back into its learned-content entry. */
export function decodeLearnedContent(payload: Record<string, unknown>): LearnedContentEntry {
  return {
    key: String(payload.key ?? ""),
    value: Number(payload.value ?? 0),
    evidenceRef: String(payload.evidenceRef ?? ""),
  };
}

/** Digest label for the neutral learning seam (honest provenance wiring). */
export function neutralLearningSeamVersion(): string {
  return `you-lab-learning-seam/1 (fnv1a32 core ${fnv1a32("you-lab-learning-seam/1")})`;
}
