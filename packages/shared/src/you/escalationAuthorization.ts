// YOU EscalationAuthorization lifecycle machinery (W8A —
// docs/you/CONTRACTS.md "Wave-8 contract freeze (v8)":
// "EscalationAuthorization (the user authorization gate)" and the
// ESCALATION AUTHORIZATION LAW: an escalation NEVER runs without an
// explicit, in-scope, unexpired EscalationAuthorization granted by the
// user. Authorization grants are immutable records; expiry and
// withdrawal create new records — nothing is mutated in place.
//
// The frozen EscalationAuthorization shape carries the GRANT facts only
// (id/escalationId/authorizedBy/scope/grantedAt/expiresAt/
// learningPermission — no lifecycle-status field), exactly like the W7A
// AvatarSession carried its status in-contract. The lifecycle status is
// therefore a PROJECTION over the append-only authorization chain: a
// grant appends a new immutable entry (status "active"); expiry and
// withdrawal append new entries wrapping the SAME frozen grant facts
// with the new status; a learning-permission change appends a whole NEW
// grant record (the previous grant projects as "superseded" — the W6A
// supersession precedent: "append-only linkage, never an overwrite").
// The original grant records stay byte-identical forever.
//
// This module owns the pure machinery:
//   - ARENA_LEARNING_PERMISSIONS (none/aggregate/full — the frozen
//     permission ladder, the W6 rights law extended to the arena boundary);
//   - the stateless grant-intake validator (scope/expiry/permission);
//   - grant construction (immutable, deep-frozen);
//   - the chain-entry constructors for lifecycle changes
//     (supersede/expire/withdraw — all new records, never mutations);
//   - evaluateEscalationAuthorization: the stateless LAW predicate
//     (fail-closed, fixed check order for deterministic reasons).
//
// No clock, no rng, no store, no ambient state: `now` is an explicit
// ISO-8601 argument (the service passes the injected clock's reading).

import type { ArenaLearningPermission, EscalationAuthorization, OpaqueId } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** The three learning permissions in frozen canonical order. */
export const ARENA_LEARNING_PERMISSIONS = ["none", "aggregate", "full"] as const;

const PERMISSION_SET: ReadonlySet<string> = new Set(ARENA_LEARNING_PERMISSIONS);

/** True when the value is one of the three frozen learning permissions. */
export function isArenaLearningPermission(value: unknown): value is ArenaLearningPermission {
  return typeof value === "string" && PERMISSION_SET.has(value);
}

/**
 * The lifecycle status of an authorization-chain entry (a projection,
 * never stored on the frozen grant shape).
 */
export type EscalationAuthorizationStatus = "active" | "superseded" | "expired" | "withdrawn";

/** The chain statuses that block escalation progress (fail-closed). */
export const ESCALATION_AUTHORIZATION_BLOCKING_STATUSES: readonly EscalationAuthorizationStatus[] = [
  "expired",
  "withdrawn",
];

/** True when the status blocks escalation progress. */
export function isEscalationAuthorizationBlocking(status: EscalationAuthorizationStatus): boolean {
  return (ESCALATION_AUTHORIZATION_BLOCKING_STATUSES as readonly string[]).includes(status);
}

/**
 * One immutable entry of the authorization chain: the frozen grant facts
 * plus the lifecycle status this entry records. Entries are append-only;
 * the chain head is the authority.
 */
export interface EscalationAuthorizationEntry {
  readonly authorization: EscalationAuthorization;
  readonly status: EscalationAuthorizationStatus;
  /** Stable reason for the status this entry records ("" on the grant). */
  readonly reason: string;
  /** ISO-8601; when this entry was recorded (the grant's grantedAt for grants). */
  readonly recordedAt: string;
}

/** Grant intake (the user authorization facts). */
export interface EscalationAuthorizationInput {
  readonly escalationId: OpaqueId;
  readonly authorizedBy: OpaqueId;
  readonly scope: string;
  /** ISO-8601 expiry; null grants no expiry. */
  readonly expiresAt: string | null;
  readonly learningPermission: ArenaLearningPermission;
}

/** A refusal returned by the stateless grant validator (never an exception). */
export interface EscalationAuthorizationRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless grant-intake validator (the single authorization intake
 * authority): escalationId/authorizedBy must be non-empty opaque ids,
 * scope a non-empty string, expiresAt null or a non-empty ISO-8601
 * string that is AFTER grantedAt (a grant born expired is refused — the
 * user must set a live window), learningPermission one of the three
 * frozen rungs.
 */
export function validateEscalationAuthorizationInput(
  input: EscalationAuthorizationInput,
  grantedAt: string,
): EscalationAuthorizationRefusal | null {
  if (typeof input.escalationId !== "string" || input.escalationId.length === 0) {
    return { reason: "escalation-id-empty", detail: "authorization escalationId must be a non-empty opaque id" };
  }
  if (typeof input.authorizedBy !== "string" || input.authorizedBy.trim().length === 0) {
    return { reason: "authorized-by-empty", detail: "authorization authorizedBy must be a non-empty opaque id" };
  }
  if (typeof input.scope !== "string" || input.scope.trim().length === 0) {
    return { reason: "scope-empty", detail: "authorization scope must be a non-empty string" };
  }
  if (input.expiresAt !== null && (typeof input.expiresAt !== "string" || input.expiresAt.length === 0)) {
    return { reason: "expiry-malformed", detail: "authorization expiresAt must be null or a non-empty ISO-8601 string" };
  }
  if (input.expiresAt !== null && input.expiresAt <= grantedAt) {
    return {
      reason: "expiry-not-after-grant",
      detail: "authorization expiresAt must be strictly after grantedAt (a grant born expired is refused)",
    };
  }
  if (!isArenaLearningPermission(input.learningPermission)) {
    return {
      reason: "learning-permission-invalid",
      detail: `learningPermission must be one of: ${ARENA_LEARNING_PERMISSIONS.join(", ")}`,
    };
  }
  return null;
}

/** Deps for grant construction (injected clock reading + id factory). */
export interface EscalationAuthorizationDeps {
  readonly now: () => string;
  readonly nextId: (kind: string) => OpaqueId;
}

/** Constructs the immutable, deep-frozen grant record. */
export function constructEscalationAuthorization(
  input: EscalationAuthorizationInput,
  deps: EscalationAuthorizationDeps,
): { readonly ok: true; readonly authorization: EscalationAuthorization } | { readonly ok: false; readonly refusal: EscalationAuthorizationRefusal } {
  const grantedAt = deps.now();
  const refusal = validateEscalationAuthorizationInput(input, grantedAt);
  if (refusal !== null) {
    return { ok: false, refusal };
  }
  return {
    ok: true,
    authorization: deepFreeze({
      id: deps.nextId("escalation-authorization"),
      escalationId: input.escalationId,
      authorizedBy: input.authorizedBy,
      scope: input.scope,
      grantedAt,
      expiresAt: input.expiresAt,
      learningPermission: input.learningPermission,
    }),
  };
}

/** The grant entry (status "active", the chain root). */
export function grantEntryOf(authorization: EscalationAuthorization): EscalationAuthorizationEntry {
  return deepFreeze({
    authorization,
    status: "active",
    reason: "",
    recordedAt: authorization.grantedAt,
  });
}

/**
 * The expiry entry: materializes the (derivable) expiry of the head
 * grant as a NEW entry (status "expired"). The lazy predicate below
 * remains the enforcement authority; this entry is the ledger trail.
 */
export function expireEntryAt(previous: EscalationAuthorizationEntry, at: string): EscalationAuthorizationEntry {
  return deepFreeze({ ...previous, status: "expired", reason: "authorization-expired", recordedAt: at });
}

/** The withdrawal entry: the user pulls the plug — a NEW entry, status "withdrawn". */
export function withdrawEntryAt(previous: EscalationAuthorizationEntry, at: string, reason: string): EscalationAuthorizationEntry {
  return deepFreeze({ ...previous, status: "withdrawn", reason: reason.length > 0 ? reason : "user-withdrew-authorization", recordedAt: at });
}

/** True when the entry's grant is due for expiry at `now` (ISO-8601 comparison). */
export function isEscalationAuthorizationDue(entry: EscalationAuthorizationEntry, now: string): boolean {
  return entry.authorization.expiresAt !== null && entry.authorization.expiresAt <= now;
}

/**
 * The effective status of a chain entry at `now`: the recorded status,
 * except that an "active" entry whose expiresAt is due projects as
 * "expired" (lazy expiry — the immutable grant facts stay untouched).
 */
export function effectiveAuthorizationStatus(entry: EscalationAuthorizationEntry, now: string): EscalationAuthorizationStatus {
  if (entry.status === "active" && isEscalationAuthorizationDue(entry, now)) {
    return "expired";
  }
  return entry.status;
}

/** The typed LAW decision with a machine-readable reason. */
export type EscalationAuthorizationDecision =
  | { readonly allowed: true; readonly reason: "authorization-within-grant" }
  | { readonly allowed: false; readonly reason: string };

/**
 * The ESCALATION AUTHORIZATION LAW predicate: may the escalation run
 * under this authorization at `now`? Stateless and fail-closed; the
 * check order is fixed so the refusal reason is deterministic:
 *   1. a missing authorization refuses ("authorization-required");
 *   2. the effective status must be "active" ("authorization-<status>");
 *   3. the grant's scope must cover the requested scope
 *      ("authorization-scope-mismatch");
 *   4. an expiresAt due at `now` refuses ("authorization-expired").
 */
export function evaluateEscalationAuthorization(
  entry: EscalationAuthorizationEntry | null,
  now: string,
  requestedScope: string,
): EscalationAuthorizationDecision {
  if (entry === null) {
    return { allowed: false, reason: "authorization-required" };
  }
  const status = effectiveAuthorizationStatus(entry, now);
  if (status !== "active") {
    return { allowed: false, reason: `authorization-${status}` };
  }
  if (!scopeCovers(entry.authorization.scope, requestedScope)) {
    return { allowed: false, reason: "authorization-scope-mismatch" };
  }
  if (isEscalationAuthorizationDue(entry, now)) {
    return { allowed: false, reason: "authorization-expired" };
  }
  return { allowed: true, reason: "authorization-within-grant" };
}

/**
 * Scope matching: the grant scope covers the requested scope when they
 * are equal, or when the grant is a prefix scope ending in "*" (e.g.
 * "arena:*" covers "arena:solve"). An exact grant never covers a
 * different scope.
 */
export function scopeCovers(grantScope: string, requestedScope: string): boolean {
  if (grantScope === requestedScope) {
    return true;
  }
  if (grantScope.endsWith("*")) {
    const prefix = grantScope.slice(0, -1);
    return requestedScope.startsWith(prefix);
  }
  return false;
}
