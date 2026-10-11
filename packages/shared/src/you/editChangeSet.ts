// YOU edit change-set machinery (W5A — docs/you/CONTRACTS.md "Wave-5
// contract freeze (v5)", frozen EditChangeSet / EditChangeSetOp).
//
// An edit change set is an ordered, immutable list of edit operations
// produced by one editing session. Every op payload is content-addressed
// on the wave-2 content-store abstraction (payloadRef + sha-256
// payloadHash) — payload bytes are NEVER inlined in records or events.
//
// Validation is STATELESS (docs/you/WORK_ORDERS.md W5A: "stateless
// validators; no clock use") and covers, per the frozen acceptance list:
//   - no empty op lists;
//   - op ids opaque non-empty strings, unique within the change set;
//   - op kinds non-empty strings (no surrounding whitespace);
//   - op payloads content-addressed (payloadRef + sha-256 payloadHash).
// The op ORDER is the caller's (ordered ops; the validator never reorders).
// Every refusal is a typed EditChangeSetRefusal; the editing application
// service maps it to the frozen YOU_CHANGESET_INVALID error.
//
// Fixture laws (docs/you/FIXTURES.md) apply verbatim: fixture payload
// bytes are synthesized only from an injected DeterministicRng; the same
// seed produces byte-identical content on every run and platform.

import type { EditChangeSet, EditChangeSetOp, OpaqueId } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { EvidenceContentStore } from "./evidenceStore.js";
import type { YouIdFactory } from "./ids.js";
import type { YouRng } from "./rng.js";
import { deepFreeze } from "./serialize.js";
import { isSha256Hex } from "./performanceTimeline.js";

/** Returns a validation reason for an illegal op kind, or null when legal. */
export function validateEditOpKind(kind: string): string | null {
  if (typeof kind !== "string" || kind.length === 0) {
    return "op kind must be a non-empty string";
  }
  if (kind !== kind.trim()) {
    return "op kind must not carry surrounding whitespace";
  }
  return null;
}

/** Typed change-set refusal codes (mapped to YOU_CHANGESET_INVALID by the service). */
export type EditChangeSetRefusalCode = "invalid-session-id" | "empty-op-list" | "invalid-op";

export type EditChangeSetRefusal =
  | { readonly ok: false; readonly code: "invalid-session-id"; readonly detail: string }
  | { readonly ok: false; readonly code: "empty-op-list"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-op"; readonly detail: string; readonly opIndex: number };

/**
 * Stateless structural validation of an ordered op list (no clock, no
 * store, no ambient state). Returns ok, or the FIRST typed refusal in a
 * deterministic single pass: op shape (id, kind, payloadRef, sha-256
 * payloadHash) -> duplicate op ids.
 */
export function validateEditChangeSetOps(ops: readonly EditChangeSetOp[]): { readonly ok: true } | EditChangeSetRefusal {
  if (ops.length === 0) {
    return { ok: false, code: "empty-op-list", detail: "an edit change set requires at least one op" };
  }
  const seenIds = new Set<OpaqueId>();
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    if (op === undefined) {
      continue;
    }
    if (typeof op.id !== "string" || op.id.length === 0) {
      return { ok: false, code: "invalid-op", detail: `op ${index}: id must be a non-empty string`, opIndex: index };
    }
    if (seenIds.has(op.id)) {
      return { ok: false, code: "invalid-op", detail: `op ${index}: duplicate op id "${op.id}"`, opIndex: index };
    }
    seenIds.add(op.id);
    const kindReason = validateEditOpKind(op.kind);
    if (kindReason !== null) {
      return { ok: false, code: "invalid-op", detail: `op ${index}: ${kindReason}`, opIndex: index };
    }
    if (typeof op.payloadRef !== "string" || op.payloadRef.length === 0) {
      return { ok: false, code: "invalid-op", detail: `op ${index}: payloadRef must be a non-empty string`, opIndex: index };
    }
    if (!isSha256Hex(op.payloadHash)) {
      return { ok: false, code: "invalid-op", detail: `op ${index}: payloadHash must be a sha-256 hex digest`, opIndex: index };
    }
  }
  return { ok: true };
}

/** Stateless structural validation of a built change set (session id + ops). */
export function validateEditChangeSet(changeSet: EditChangeSet): { readonly ok: true } | EditChangeSetRefusal {
  if (typeof changeSet.sessionId !== "string" || changeSet.sessionId.length === 0) {
    return { ok: false, code: "invalid-session-id", detail: "an edit change set requires a non-empty sessionId" };
  }
  return validateEditChangeSetOps(changeSet.ops);
}

export interface EditChangeSetOpIntake {
  readonly kind: string;
  /** Explicit payload binding (payloadRef + sha-256 payloadHash). */
  readonly payloadRef?: string;
  readonly payloadHash?: string;
  /** Explicit payload bytes (stored through the content store). */
  readonly bytes?: Uint8Array;
  /** Injected rng for fixture byte synthesis (required when no binding/bytes given). */
  readonly rng?: YouRng;
}

export type EditChangeSetOpRefusalCode = "invalid-op-kind" | "invalid-payload-binding";

export type EditChangeSetOpRefusal =
  | { readonly ok: false; readonly code: "invalid-op-kind"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-payload-binding"; readonly detail: string };

/**
 * Constructs one immutable, deep-frozen EditChangeSetOp. The payload is
 * either an explicit content binding or bytes (explicit or rng-synthesized)
 * stored through the wave-2 content store — never inlined.
 */
export function createEditChangeSetOp(
  intake: EditChangeSetOpIntake,
  deps: { readonly ids: YouIdFactory; readonly store: EvidenceContentStore },
): { readonly ok: true; readonly op: EditChangeSetOp } | EditChangeSetOpRefusal {
  const kindReason = validateEditOpKind(intake.kind);
  if (kindReason !== null) {
    return { ok: false, code: "invalid-op-kind", detail: `invalid op kind: ${kindReason}` };
  }
  let payloadRef = intake.payloadRef;
  let payloadHash = intake.payloadHash;
  if (payloadRef === undefined || payloadHash === undefined) {
    const bytes = intake.bytes ?? (intake.rng !== undefined ? synthesizeFixtureOpBytes(intake.rng, intake.kind) : null);
    if (bytes === null) {
      return {
        ok: false,
        code: "invalid-payload-binding",
        detail: "an edit op requires an explicit payload binding, bytes or an injected rng",
      };
    }
    const binding = deps.store.put(bytes);
    payloadRef = binding.contentRef;
    payloadHash = binding.contentHash;
  } else if (typeof payloadRef !== "string" || payloadRef.length === 0 || !isSha256Hex(payloadHash)) {
    return {
      ok: false,
      code: "invalid-payload-binding",
      detail: "an explicit op payload binding requires a non-empty payloadRef and a sha-256 payloadHash",
    };
  }
  return {
    ok: true,
    op: deepFreeze({
      id: deps.ids.next("edit-op"),
      kind: intake.kind,
      payloadRef,
      payloadHash,
    }),
  };
}

/**
 * Fixed synthetic op-payload sizes per known op kind (fixture definition —
 * part of the frozen fixture contract; changing any size changes every
 * golden expectation and requires a new fixture version, never an
 * in-place edit).
 */
export const FIXTURE_OP_KIND_BYTE_LENGTHS: Readonly<Record<string, number>> = {
  annotation: 256,
  material: 1024,
  metadata: 128,
  transform: 512,
};

/** Default size for op-kind extensions (fixture definition). */
export const FIXTURE_OP_KIND_DEFAULT_BYTE_LENGTH = 256;

export function fixtureOpKindByteLength(kind: string): number {
  return FIXTURE_OP_KIND_BYTE_LENGTHS[kind] ?? FIXTURE_OP_KIND_DEFAULT_BYTE_LENGTH;
}

/**
 * Deterministic synthetic op payload bytes (FIXTURES.md laws 1-2, 7:
 * seed-derived only; no PII, no biometric data). The RNG consumption order
 * (4 bytes per nextUint32, little-endian) is part of the frozen fixture
 * definition and mirrors the wave-2/wave-3/wave-4 synthesizers.
 */
export function synthesizeFixtureOpBytes(rng: YouRng, kind: string): Uint8Array {
  const length = fixtureOpKindByteLength(kind);
  const bytes = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += 4) {
    const word = rng.nextUint32();
    const remaining = Math.min(4, length - offset);
    for (let byteIndex = 0; byteIndex < remaining; byteIndex += 1) {
      bytes[offset + byteIndex] = (word >>> (byteIndex * 8)) & 0xff;
    }
  }
  return bytes;
}

export interface EditChangeSetIntake {
  readonly sessionId: OpaqueId;
  readonly ops: readonly EditChangeSetOp[];
}

/**
 * Creates the immutable, deep-frozen EditChangeSet (ordered ops verbatim;
 * the record never reorders — ordering is the caller's authority).
 */
export function createEditChangeSet(
  intake: EditChangeSetIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): { readonly ok: true; readonly changeSet: EditChangeSet } | EditChangeSetRefusal {
  const refusal = validateEditChangeSetOps(intake.ops);
  if (!refusal.ok) {
    return refusal;
  }
  if (typeof intake.sessionId !== "string" || intake.sessionId.length === 0) {
    return { ok: false, code: "invalid-session-id", detail: "an edit change set requires a non-empty sessionId" };
  }
  return {
    ok: true,
    changeSet: deepFreeze({
      id: deps.ids.next("edit-change-set"),
      sessionId: intake.sessionId,
      ops: Object.freeze([...intake.ops]),
      createdAt: deps.clock.now(),
    }),
  };
}
