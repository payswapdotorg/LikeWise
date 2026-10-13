// Provider-neutral arena adapter seam (W8C).
//
// External arena providers (the expert/automation network behind a
// CapabilityGap) are adapters, never domain authorities
// (docs/you/ARCHITECTURE.md §15 — the ARENA BOUNDARY LAW: the Arena never
// silently mutates YOU state; every result returns as a typed payload
// applied through YOU's own authority). This seam defines the neutral W8C
// arena surface: a typed arena invocation (a provider-neutral
// ArenaProviderDescriptor-shaped provider + a CapabilityGap-shaped neutral
// gap record + a deterministic retry ladder + the escalation authorization
// context) that produces content-addressed run records per the frozen v8
// contract laws. The neutral shapes are owned by you-lab and are
// structurally aligned with the frozen @zcode/shared YOU v8
// ArenaProviderDescriptor / CapabilityGap / ArenaRetryPolicy /
// EscalationAuthorization / ArenaRun shapes; mapping onto the frozen
// contract happens ONLY in src/contractSeam.ts.
//
// ESCALATION AUTHORIZATION LAW (seam-level, fail-closed for every adapter):
// an invocation whose retry ladder requires authorization is refused unless
// an explicit, escalation-linked, unexpired authorization context is present
// (YOU_ESCALATION_AUTHORIZATION_REQUIRED). Scope SEMANTICS stay with the
// arena authority service (W8A); the seam verifies presence, identity
// linkage and expiry — the mechanical laws.
//
// GAP PERSISTENCE LAW: gap records are inputs, never mutated; run records
// are append-only ladder entries (a projection of attempts); the retry
// authority is the ArenaRetryPolicy ladder (validated here —
// YOU_RETRY_POLICY_INVALID on malformed/ineligible ladders).
//
// Determinism: run ladders, payloads and digests are pure functions of
// their inputs (no clock, no Math.random, no network — seeded derivations
// only, docs/you/FIXTURES.md). Effort/latency/cost are structured fields
// carrying explicit not-measured markers (truth law — never invented
// numbers).

import { createHash } from "node:crypto";

import { canonicalJson, fnv1a32, roundTo, sortedUnique } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import type { MetricField } from "../benchmarks/runner.js";

/**
 * Neutral capability-gap category — aligned 1:1 with the frozen v1
 * CapabilityGapCategory seven-literal union.
 */
export type NeutralCapabilityGapCategory =
  | "TOOL_GAP" | "EDITOR_GAP" | "MODEL_GAP" | "SKILL_GAP"
  | "KNOWLEDGE_GAP" | "DATA_GAP" | "EXPERT_GAP"
  | (string & {});

/** The seven frozen v1 gap categories (the authored coverage matrix basis). */
export const NEUTRAL_CAPABILITY_GAP_CATEGORIES = [
  "TOOL_GAP", "EDITOR_GAP", "MODEL_GAP", "SKILL_GAP", "KNOWLEDGE_GAP", "DATA_GAP", "EXPERT_GAP",
] as const;

/** Neutral escalation eligibility — aligned 1:1 with the frozen v1 EscalationEligibility. */
export type NeutralEscalationEligibility = "not-eligible" | "eligible" | "escalated" | (string & {});

/** Neutral arena run status — aligned 1:1 with the frozen v8 ArenaRunStatus. */
export type NeutralArenaRunStatus = "started" | "completed" | "failed" | "aborted" | (string & {});

/** Neutral arena learning permission — aligned 1:1 with the frozen v8 ArenaLearningPermission. */
export type NeutralArenaLearningPermission = "none" | "aggregate" | "full" | (string & {});

/**
 * Neutral retry/backoff class — the W8C authored vocabulary for the frozen
 * v8 ArenaRetryPolicy.backoffClass (an opaque string whose registry
 * authority is the W8C lane): circuit-breaker, hedged-request,
 * exponential-backoff-jitter, token-bucket.
 */
export type NeutralArenaBackoffClass =
  | "circuit-breaker" | "hedged-request" | "exponential-backoff-jitter" | "token-bucket"
  | (string & {});

/** The four W8C authored backoff classes (the retry registry's class table). */
export const NEUTRAL_BACKOFF_CLASSES = [
  "circuit-breaker", "hedged-request", "exponential-backoff-jitter", "token-bucket",
] as const;

/** Neutral attempted strategy — aligned 1:1 with the frozen v1 AttemptedStrategy. */
export interface NeutralAttemptedStrategy {
  readonly strategy: string;
  readonly outcome: "failed" | "partial" | "rejected";
  readonly evidenceRef: string | null;
}

/**
 * Neutral capability-gap record — aligned 1:1 with the frozen v1
 * CapabilityGap field set minus arenaEscalationRef (the escalation link is
 * service-owned identity; the seam construction injects it at mapping
 * time). An INPUT to the arena, never mutated (GAP PERSISTENCE LAW).
 */
export interface NeutralArenaGapRecord {
  readonly id: string;
  readonly intentRef: string | null;
  readonly attemptedStrategies: readonly NeutralAttemptedStrategy[];
  readonly failureEvidence: readonly string[];
  readonly category: NeutralCapabilityGapCategory;
  readonly confidence: number;
  readonly suggestedNextAction: string;
  readonly escalationEligibility: NeutralEscalationEligibility;
}

/**
 * Neutral arena provider descriptor — aligned 1:1 with the frozen v8
 * ArenaProviderDescriptor (provider references are opaque; registry
 * authority = the W8C lane; real runtime integration stays behind this
 * seam).
 */
export interface NeutralArenaProviderDescriptor {
  readonly id: string;
  readonly providerKind: string;
  readonly capabilityClasses: readonly string[];
  readonly endpointRef: string | null;
}

/**
 * Neutral deterministic retry ladder — aligned 1:1 with the frozen v8
 * ArenaRetryPolicy (the retry authority for a run ladder).
 */
export interface NeutralArenaRetryLadder {
  readonly maxAttempts: number;
  readonly backoffClass: NeutralArenaBackoffClass;
  readonly eligibilityCategories: readonly NeutralCapabilityGapCategory[];
  readonly requiresAuthorization: boolean;
}

/**
 * Neutral escalation authorization context — aligned 1:1 with the frozen v8
 * EscalationAuthorization (the user authorization gate; grants are
 * immutable records).
 */
export interface NeutralArenaAuthorizationContext {
  readonly authorizationId: string;
  readonly escalationId: string;
  readonly authorizedBy: string;
  readonly scope: string;
  readonly grantedAt: string;
  readonly expiresAt: string | null;
  readonly learningPermission: NeutralArenaLearningPermission;
}

/** Typed arena invocation request = provider + gap + retry ladder + authorization gate. */
export interface NeutralArenaInvocation {
  readonly requestId: string;
  readonly provider: NeutralArenaProviderDescriptor;
  readonly gap: NeutralArenaGapRecord;
  readonly retryLadder: NeutralArenaRetryLadder;
  /** The escalation this invocation executes (null when the gap is not escalated). */
  readonly escalationId: string | null;
  readonly authorization: NeutralArenaAuthorizationContext | null;
  readonly submittedAt: string;
}

/**
 * A run-ladder record — aligned 1:1 with the frozen v8 ArenaRun (one
 * automation attempt against the gap; append-only, never mutated). Content
 * lives in the output's content-addressed payload sidecar, never inlined
 * here.
 */
export interface NeutralArenaRunRecord {
  readonly id: string;
  readonly gapId: string;
  readonly strategy: string;
  readonly attempt: number;
  readonly status: NeutralArenaRunStatus;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly outcomeEvidenceRef: string | null;
  readonly simulated: boolean;
}

/** One expert-result content entry (the payload of a completed run; simulated fixture model). */
export interface ArenaExpertResultEntry {
  readonly resultType: "typed-payload" | "artifact" | "guidance";
  readonly finding: string;
  readonly recovery: number;
  readonly evidenceRefs: readonly string[];
  readonly strategy: string;
  readonly attempt: number;
  readonly deliveredAt: string;
}

/** Structured effort/latency/cost fields with honest markers (truth law). */
export interface ArenaEffortFields {
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

/** Deterministic output of a typed arena invocation. */
export interface NeutralArenaOutput {
  readonly adapterId: string;
  readonly requestId: string;
  readonly runRecords: readonly NeutralArenaRunRecord[];
  /**
   * Expert-result payloads for this invocation keyed by run record id — the
   * content-store sidecar the caller resolves outcomeEvidenceRefs against.
   * NEVER inlined in the run records themselves; the canonical JSON of the
   * entry list hashes to resultContentHash (content-addressing law).
   */
  readonly payloads: Readonly<Record<string, Record<string, unknown>>>;
  /** Canonical-JSON digest over the expert-result entries (deterministic). */
  readonly resultContentHash: string;
  readonly warnings: readonly string[];
  readonly effort: ArenaEffortFields;
  readonly simulated: boolean;
}

/** Profile of a registered arena adapter behind the seam. */
export interface ArenaAdapterProfile {
  readonly id: string;
  /** Backing registry technology id, or null for pure mock candidates. */
  readonly technologyId: string | null;
  /** Capability classes the adapter's provider serves (validated against the invocation's provider descriptor). */
  readonly servedCapabilityClasses: readonly string[];
  /** Gap categories the adapter can run against. */
  readonly supportedCategories: readonly NeutralCapabilityGapCategory[];
  /** "mock" for pure mocks; "evaluation" for registry-backed evaluation adapters. */
  readonly adapterKind: "mock" | "evaluation";
  /** Whether the adapter implementation itself is bit-deterministic. */
  readonly deterministic: boolean;
  readonly determinismNote: string;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
  readonly eligibilityBasis: string;
}

export interface ArenaAdapter {
  readonly profile: ArenaAdapterProfile;
  /** Typed arena invocation over provider + gap + ladder + authorization (deterministic, simulated). */
  invoke(request: NeutralArenaInvocation): NeutralArenaOutput;
}

/** Error code aligned with the frozen v8 typed error literal (you-lab-owned). */
export const ARENA_ADAPTER_UNSUPPORTED_CODE = "YOU_ARENA_ADAPTER_UNSUPPORTED";
export const RETRY_LADDER_INVALID_CODE = "YOU_RETRY_POLICY_INVALID";
export const ARENA_AUTHORIZATION_REQUIRED_CODE = "YOU_ESCALATION_AUTHORIZATION_REQUIRED";

/** Typed refusal thrown when the adapter cannot serve the invocation's provider/category surface. */
export class UnsupportedArenaRequestError extends Error {
  readonly code = ARENA_ADAPTER_UNSUPPORTED_CODE;
  constructor(adapterId: string, detail: string, supported: readonly string[]) {
    super(
      `${ARENA_ADAPTER_UNSUPPORTED_CODE}: adapter '${adapterId}' does not support ${detail} (supported: ${supported.join(", ") || "none"})`,
    );
  }
}

/** Typed refusal thrown when the retry ladder is malformed or the gap category is not eligible. */
export class InvalidRetryLadderError extends Error {
  readonly code = RETRY_LADDER_INVALID_CODE;
  constructor(detail: string) {
    super(`${RETRY_LADDER_INVALID_CODE}: ${detail}`);
  }
}

/** Typed refusal thrown when the escalation authorization law fails at the seam. */
export class ArenaAuthorizationRequiredError extends Error {
  readonly code = ARENA_AUTHORIZATION_REQUIRED_CODE;
  constructor(detail: string) {
    super(`${ARENA_AUTHORIZATION_REQUIRED_CODE}: ${detail}`);
  }
}

/** Unsupported aspects of an invocation for an adapter ([] when fully supported). */
export function unsupportedArenaInvocationAspects(
  profile: ArenaAdapterProfile,
  request: NeutralArenaInvocation,
): readonly string[] {
  const aspects: string[] = [];
  const served = profile.servedCapabilityClasses.some((clazz) => request.provider.capabilityClasses.includes(clazz));
  if (!served) {
    aspects.push(`provider capability classes [${request.provider.capabilityClasses.join(", ")}]`);
  }
  if (!profile.supportedCategories.includes(request.gap.category)) {
    aspects.push(`gap category '${request.gap.category}'`);
  }
  return aspects;
}

/**
 * Fail-closed seam gate EVERY adapter invokes first: provider/category
 * support (YOU_ARENA_ADAPTER_UNSUPPORTED), retry-ladder validity
 * (YOU_RETRY_POLICY_INVALID) and the escalation authorization law
 * (YOU_ESCALATION_AUTHORIZATION_REQUIRED). No adapter can bypass the
 * authorization law — the gate is shared, not advisory.
 */
export function assertArenaInvocationSupported(
  profile: ArenaAdapterProfile,
  request: NeutralArenaInvocation,
): void {
  const unsupported = unsupportedArenaInvocationAspects(profile, request);
  const firstUnsupported = unsupported[0];
  if (unsupported.length > 0 && firstUnsupported !== undefined) {
    throw new UnsupportedArenaRequestError(
      profile.id,
      firstUnsupported,
      sortedUnique([
        ...profile.servedCapabilityClasses.map((clazz) => `class:${clazz}`),
        ...profile.supportedCategories.map((category) => `category:${category}`),
      ]),
    );
  }
  const ladder = request.retryLadder;
  if (!Number.isInteger(ladder.maxAttempts) || ladder.maxAttempts < 1) {
    throw new InvalidRetryLadderError(`maxAttempts must be an integer >= 1 (got ${ladder.maxAttempts})`);
  }
  if (ladder.backoffClass.length === 0) {
    throw new InvalidRetryLadderError("backoffClass is empty (the ladder names its backoff class)");
  }
  if (ladder.eligibilityCategories.length === 0) {
    throw new InvalidRetryLadderError("eligibilityCategories is empty (the ladder names the gap categories it may retry)");
  }
  if (!ladder.eligibilityCategories.includes(request.gap.category)) {
    throw new InvalidRetryLadderError(
      `gap category '${request.gap.category}' is not in the ladder's eligibility categories [${ladder.eligibilityCategories.join(", ")}]`,
    );
  }
  const authorization = request.authorization;
  if (authorization !== null && request.escalationId !== null && authorization.escalationId !== request.escalationId) {
    throw new ArenaAuthorizationRequiredError(
      `authorization ${authorization.authorizationId} is linked to escalation ${authorization.escalationId}, but the invocation executes escalation ${request.escalationId} (identity linkage refused)`,
    );
  }
  if (ladder.requiresAuthorization) {
    if (authorization === null) {
      throw new ArenaAuthorizationRequiredError(
        "the retry ladder requires an explicit EscalationAuthorization and none was presented",
      );
    }
    if (request.escalationId === null) {
      throw new ArenaAuthorizationRequiredError(
        "the retry ladder requires authorization, but the invocation names no escalation to link it to",
      );
    }
    if (authorization.scope.length === 0) {
      throw new ArenaAuthorizationRequiredError("the authorization scope is empty (scope semantics stay with the arena authority; an empty scope is never accepted)");
    }
    if (authorization.expiresAt !== null) {
      const expiry = Date.parse(authorization.expiresAt);
      const submitted = Date.parse(request.submittedAt);
      if (Number.isNaN(expiry) || Number.isNaN(submitted) || expiry < submitted) {
        throw new ArenaAuthorizationRequiredError(
          `authorization ${authorization.authorizationId} expires at ${authorization.expiresAt}, before the submission at ${request.submittedAt} (expired grants never run)`,
        );
      }
    }
  }
}

/** sha-256 hex digest of string/bytes input (deterministic, no clock). */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Opaque deterministic run-record id for (adapterId, requestId, attempt) — you_arena-run_<16hex>. */
export function neutralArenaRunId(adapterId: string, requestId: string, attempt: number): string {
  return `you_arena-run_${sha256Hex(`${adapterId}|${requestId}|${attempt}`).slice(0, 16)}`;
}

/** Opaque content-store expert-result reference for (adapterId, requestId, attempt). */
export function neutralArenaEvidenceRef(adapterId: string, requestId: string, attempt: number): string {
  return `content-store://you-lab/arena/${adapterId}/${requestId}/attempt-${attempt}`;
}

/**
 * Aggregate content-addressing digest (the single definition of the law:
 * the entry list plus the backoff class the ladder ACTUALLY ran under; an
 * empty ladder has a class-less envelope). Every adapter computes its
 * resultContentHash here and the scorer recomputes byte-identically —
 * the hash binds the payload bytes, never the other way around.
 */
export function aggregateContentDigest(
  entryPayload: Record<string, unknown> | null,
  actualBackoffClass: NeutralArenaBackoffClass,
): string {
  if (entryPayload === null) {
    return sha256Hex(canonicalJson({ entries: [] }));
  }
  return sha256Hex(canonicalJson({ entries: [entryPayload], backoffClass: actualBackoffClass }));
}

/** Honest not-measured effort fields for simulated arena adapters. */
export function notMeasuredArenaEffortFields(): ArenaEffortFields {
  return {
    effort: { kind: "not-measured", marker: "not-measured (simulated)" },
    latency: { kind: "not-measured", marker: "not-measured (simulated)" },
    cost: { kind: "not-measured", marker: "not-measured (simulated)" },
  };
}

/**
 * Authored strategy ladders per frozen gap category — the fixture model's
 * retry-strategy vocabulary (W8C authored fixture definition — computed,
 * not measured, and never a claim about real arena providers).
 */
export const ARENA_STRATEGY_LADDERS: Readonly<Record<string, readonly string[]>> = {
  TOOL_GAP: ["tool-reattach", "tool-substitute", "tool-register-new"],
  EDITOR_GAP: ["editor-recommend", "editor-handoff"],
  MODEL_GAP: ["model-reroute", "model-upskill"],
  SKILL_GAP: ["skill-procedure-lookup", "skill-practice"],
  KNOWLEDGE_GAP: ["knowledge-retrieve", "knowledge-ingest"],
  DATA_GAP: ["data-capture", "data-validate"],
  EXPERT_GAP: ["expert-consult", "expert-review"],
};

/** Canonical strategy for (category, attempt) — ladder cycling, deterministic. */
export function intendedStrategyAt(category: NeutralCapabilityGapCategory, attempt: number): string {
  const ladder = ARENA_STRATEGY_LADDERS[category];
  if (!ladder) {
    throw new Error(`intendedStrategyAt: no authored strategy ladder for category "${category}" (the seven frozen categories only)`);
  }
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error(`intendedStrategyAt: attempt must be an integer >= 1 (got ${attempt})`);
  }
  return ladder[(attempt - 1) % ladder.length] ?? ladder[0]!;
}

/**
 * Canonical run outcome for (gapId, attempt) — hash-derived fixture
 * arithmetic (completed with seeded probability ~0.7 per attempt; computed,
 * not measured, never a claim about real arena providers).
 */
export function intendedRunStatusAt(gapId: string, attempt: number): "completed" | "failed" {
  return unitFrom("you-lab-arena-model", gapId, `attempt-${attempt}`, "status") < 0.7 ? "completed" : "failed";
}

/**
 * Authored result types per frozen gap category — the fixture model's
 * expert-result surface (aligned with the frozen v1 ArenaExpertResult
 * resultType union).
 */
export const ARENA_RESULT_TYPES: Readonly<Record<string, "typed-payload" | "artifact" | "guidance">> = {
  TOOL_GAP: "typed-payload",
  EDITOR_GAP: "artifact",
  MODEL_GAP: "typed-payload",
  SKILL_GAP: "guidance",
  KNOWLEDGE_GAP: "typed-payload",
  DATA_GAP: "artifact",
  EXPERT_GAP: "guidance",
};

/** Canonical result type for a category (the seven frozen categories only). */
export function intendedResultTypeFor(category: NeutralCapabilityGapCategory): "typed-payload" | "artifact" | "guidance" {
  const resultType = ARENA_RESULT_TYPES[category];
  if (!resultType) {
    throw new Error(`intendedResultTypeFor: no authored result type for category "${category}" (the seven frozen categories only)`);
  }
  return resultType;
}

/**
 * Canonical expert-result recovery value for (gapId, backoffClass) —
 * hash-derived, class-dependent, rounded to 4 decimals. The class
 * dependence models retry-ladder quality honestly inside the fixture
 * model: well-behaved ladder classes recover in [0.7, 1.0], others in
 * lower bands. A misderiving adapter (answering under a different class)
 * derives different values and loses fidelity — the shared synthetic
 * model behind simulated adapters and the fixture objective (never a
 * measurement of a real retry library).
 */
export function intendedRecoveryAt(gapId: string, backoffClass: NeutralArenaBackoffClass): number {
  const base = unitFrom("you-lab-arena-model", gapId, "recovery");
  switch (backoffClass) {
    case "exponential-backoff-jitter":
      return roundTo(0.7 + base * 0.3, 4);
    case "hedged-request":
      return roundTo(0.65 + base * 0.35, 4);
    case "circuit-breaker":
      return roundTo(0.6 + base * 0.35, 4);
    case "token-bucket":
      return roundTo(0.5 + base * 0.4, 4);
    default:
      throw new Error(`intendedRecoveryAt: no authored recovery band for backoff class "${backoffClass}" (the four W8C classes only)`);
  }
}

/** Canonical expert-result finding text for (gap, strategy) — deterministic. */
export function intendedFindingFor(gap: NeutralArenaGapRecord, strategy: string): string {
  return `${strategy} applied to ${gap.category}: ${gap.suggestedNextAction}`;
}

/**
 * Encode an expert-result entry as a content-addressed payload record. The
 * payload carries BOTH the backoff class the ladder ACTUALLY ran under and
 * the class that was REQUESTED — for a class-honoring adapter these are
 * equal; for a misderiving adapter they differ and the misderivation stays
 * visible (truth law — never rewritten into a correct one).
 */
export function encodeArenaExpertResult(
  entry: ArenaExpertResultEntry,
  request: NeutralArenaInvocation,
  actualBackoffClass: NeutralArenaBackoffClass,
): Record<string, unknown> {
  return {
    resultType: entry.resultType,
    finding: entry.finding,
    recovery: entry.recovery,
    evidenceRefs: [...entry.evidenceRefs],
    strategy: entry.strategy,
    attempt: entry.attempt,
    backoffClass: actualBackoffClass,
    requestedBackoffClass: request.retryLadder.backoffClass,
    deliveredAt: entry.deliveredAt,
  };
}

/** Decode an expert-result payload back into its entry. */
export function decodeArenaExpertResult(payload: Record<string, unknown>): ArenaExpertResultEntry {
  const evidenceRefs = Array.isArray(payload.evidenceRefs) ? payload.evidenceRefs.map((ref) => String(ref)) : [];
  return {
    resultType: String(payload.resultType ?? "guidance") as ArenaExpertResultEntry["resultType"],
    finding: String(payload.finding ?? ""),
    recovery: Number(payload.recovery ?? 0),
    evidenceRefs,
    strategy: String(payload.strategy ?? ""),
    attempt: Number(payload.attempt ?? 0),
    deliveredAt: String(payload.deliveredAt ?? ""),
  };
}

/** Digest label for the neutral arena seam (honest provenance wiring). */
export function neutralArenaSeamVersion(): string {
  return `you-lab-arena-seam/1 (fnv1a32 core ${fnv1a32("you-lab-arena-seam/1")})`;
}
