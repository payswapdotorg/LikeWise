// YOU learning rights machinery (W6A — docs/you/CONTRACTS.md "Wave-6
// contract freeze (v6)", frozen LearningRightUsage / LearningRights).
//
// RIGHTS LAW (wave-6 core): a learning record is usable only within its
// LearningRights consent grant (consentRef + consentHash traceable to
// the wave-2 consent authority — there is no second consent path);
// records without rights are inert; usage outside the grant is a typed
// refusal (YOU_LEARNING_RIGHTS_REQUIRED at the service seam).
//
// This module owns the pure machinery:
//   - the six sanctioned usage classes (runtime mirror of the union);
//   - INERT_LEARNING_RIGHTS (the "no rights" grant: records carrying it
//     exist in the ledger but can never be used);
//   - LearningGrantFacts + learningGrantHash: the content-addressed
//     binding between a rights grant and the wave-2 consent facts it
//     was issued under (sha-256 over the canonical grant serialization
//     — the same content-addressing discipline as the wave-2 store);
//   - evaluateLearningRights: the stateless enforcement predicate.
//
// Enforcement rules (golden; tested as a matrix):
//   evaluateLearningRights(rights, usage, liveGrant, now):
//     1. inert rights ALWAYS deny ("rights-inert") — records without
//        rights are inert.
//     2. the requested usage class must be inside the grant
//        ("usage-not-granted") — usage outside the grant is refused.
//     3. the live grant must resolve through the consent authority
//        ("consent-unresolvable") — a dangling consentRef never falls
//        back to permissive.
//     4. the live consent state must be "granted" ("consent-<state>") —
//        denial, withdrawal and expiry block future use (fail closed,
//        the wave-2 withdrawal law).
//     5. the grant must permit learning reuse ("learning-reuse-not-
//        permitted") and cover the "learning" purpose
//        ("purpose-not-covered").
//     6. the recomputed live grant hash must equal the recorded
//        consentHash ("consent-hash-mismatch") — the rights bind to the
//        exact consent facts they were issued under.
//     7. a set expiresAt that is due at `now` denies ("rights-expired").
//
// No clock, no store, no ambient state: `now` is an explicit ISO-8601
// argument (the service passes the injected clock's reading).

import type { ConsentState, LearningRightUsage, LearningRights } from "./contract.js";
import { sha256Hex } from "./evidenceStore.js";
import { stableStringify } from "./serialize.js";

/** The six sanctioned usage classes (runtime mirror of the contract union). */
export const LEARNING_RIGHT_USAGES: readonly LearningRightUsage[] = [
  "organization-improvement",
  "tool-selection",
  "editor-selection",
  "pipeline-improvement",
  "capability-gap-analysis",
  "personalization",
];

/** True when the value is one of the six sanctioned usage classes. */
export function isLearningRightUsage(value: string): value is LearningRightUsage {
  return (LEARNING_RIGHT_USAGES as readonly string[]).includes(value);
}

/**
 * The "no rights" grant: records carrying it are inert (they exist in
 * the ledger, may climb the validation ladder, but can never be used).
 * Empty consentRef + empty consentHash is the ONLY inert pairing — a
 * bound grant must carry both.
 */
export const INERT_LEARNING_RIGHTS: LearningRights = Object.freeze({
  usage: Object.freeze([]),
  consentRef: "",
  consentHash: "",
  expiresAt: null,
});

/** True when the rights grant is the inert (no-rights) grant. */
export function isInertLearningRights(rights: LearningRights): boolean {
  return rights.consentRef.length === 0 && rights.consentHash.length === 0 && rights.usage.length === 0;
}

/** Typed rights-intake refusal codes (mapped by the service). */
export type LearningRightsRefusalCode = "invalid-usage-list" | "invalid-consent-binding" | "invalid-expiry";

export type LearningRightsRefusal =
  | { readonly ok: false; readonly code: "invalid-usage-list"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-consent-binding"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-expiry"; readonly detail: string };

/**
 * Stateless structural validation of a rights intake: usage classes must
 * be sanctioned and unique; consentRef + consentHash must be paired
 * (both empty = the inert grant; both non-empty = a bound grant — never
 * one without the other); expiresAt is null or a non-empty ISO-8601
 * string. The INERT grant itself validates.
 */
export function validateLearningRightsIntake(input: {
  readonly usage: readonly string[];
  readonly consentRef: string;
  readonly consentHash: string;
  readonly expiresAt: string | null;
}): { readonly ok: true } | LearningRightsRefusal {
  const seenUsages = new Set<string>();
  for (const usage of input.usage) {
    if (typeof usage !== "string" || !isLearningRightUsage(usage)) {
      return {
        ok: false,
        code: "invalid-usage-list",
        detail: `learning rights usage "${String(usage)}" is not one of the six sanctioned classes (${LEARNING_RIGHT_USAGES.join(", ")})`,
      };
    }
    if (seenUsages.has(usage)) {
      return { ok: false, code: "invalid-usage-list", detail: `duplicate learning rights usage class "${usage}"` };
    }
    seenUsages.add(usage);
  }
  const refEmpty = input.consentRef.length === 0;
  const hashEmpty = input.consentHash.length === 0;
  if (refEmpty !== hashEmpty) {
    return {
      ok: false,
      code: "invalid-consent-binding",
      detail: "learning rights must carry both consentRef and consentHash, or neither (the inert grant)",
    };
  }
  if (!refEmpty && input.usage.length === 0) {
    return {
      ok: false,
      code: "invalid-consent-binding",
      detail: "a bound learning rights grant must sanction at least one usage class",
    };
  }
  if (input.expiresAt !== null && (typeof input.expiresAt !== "string" || input.expiresAt.length === 0)) {
    return {
      ok: false,
      code: "invalid-expiry",
      detail: "learning rights expiresAt must be null or a non-empty ISO-8601 string",
    };
  }
  return { ok: true };
}

/** Constructs the immutable, deep-frozen LearningRights. */
export function createLearningRights(input: {
  readonly usage: readonly LearningRightUsage[];
  readonly consentRef: string;
  readonly consentHash: string;
  readonly expiresAt: string | null;
}): { readonly ok: true; readonly rights: LearningRights } | LearningRightsRefusal {
  const validated = validateLearningRightsIntake(input);
  if (!validated.ok) {
    return validated;
  }
  return {
    ok: true,
    rights: deepFreezeRights({
      usage: [...input.usage],
      consentRef: input.consentRef,
      consentHash: input.consentHash,
      expiresAt: input.expiresAt,
    }),
  };
}

function deepFreezeRights(rights: LearningRights): LearningRights {
  return Object.freeze({
    usage: Object.freeze([...rights.usage]),
    consentRef: rights.consentRef,
    consentHash: rights.consentHash,
    expiresAt: rights.expiresAt,
  });
}

// ---------------------------------------------------------------------------
// The content-addressed consent binding (consentRef + consentHash)
// ---------------------------------------------------------------------------

/**
 * The traceable wave-2 consent facts a rights grant binds to, as
 * resolved live through the consent authority port. The facts are the
 * wave-2 ConsentPolicy fields plus the live state — the learning lane
 * never invents consent facts of its own (no second consent path).
 */
export interface LearningGrantFacts {
  readonly policyId: string;
  readonly state: ConsentState;
  readonly scope: string;
  /** Sorted purpose list (stable ordering, FIXTURES.md law 4). */
  readonly purposes: readonly string[];
  readonly learningReuse: boolean;
  readonly operationalUse: boolean;
}

/**
 * The content-addressed hash of a live grant: sha-256 over the canonical
 * serialization of the grant facts (sorted keys, sorted purposes). The
 * LearningRights.consentHash recorded at issuance must equal the hash of
 * the live grant for usage to be sanctioned — the grant binds to the
 * exact consent facts it was issued under.
 */
export function learningGrantHash(facts: LearningGrantFacts): string {
  const canonical = {
    learningReuse: facts.learningReuse,
    operationalUse: facts.operationalUse,
    policyId: facts.policyId,
    purposes: [...facts.purposes].sort(),
    scope: facts.scope,
    state: facts.state,
  };
  return sha256Hex(new TextEncoder().encode(stableStringify(canonical)));
}

/** True when the live grant facts hash to the recorded consentHash. */
export function grantHashMatches(rights: LearningRights, facts: LearningGrantFacts): boolean {
  return learningGrantHash(facts) === rights.consentHash;
}

// ---------------------------------------------------------------------------
// The stateless enforcement predicate (the rights law)
// ---------------------------------------------------------------------------

/** The typed enforcement outcome with a machine-readable reason. */
export type LearningRightsDecision =
  | { readonly allowed: true; readonly reason: "rights-within-grant" }
  | { readonly allowed: false; readonly reason: string };

/**
 * Enforcement predicate: may the learning record carrying these rights
 * be used for the given usage class? Stateless and fail-closed; `now`
 * is an explicit ISO-8601 argument (no ambient clock). The check order
 * is fixed so the refusal reason is deterministic (see the golden rules
 * in the module header).
 */
export function evaluateLearningRights(
  rights: LearningRights,
  usage: LearningRightUsage,
  liveGrant: LearningGrantFacts | null,
  now: string,
): LearningRightsDecision {
  if (isInertLearningRights(rights)) {
    return { allowed: false, reason: "rights-inert" };
  }
  if (!rights.usage.includes(usage)) {
    return { allowed: false, reason: "usage-not-granted" };
  }
  if (liveGrant === null) {
    return { allowed: false, reason: "consent-unresolvable" };
  }
  if (liveGrant.state !== "granted") {
    return { allowed: false, reason: `consent-${liveGrant.state}` };
  }
  if (!liveGrant.learningReuse) {
    return { allowed: false, reason: "learning-reuse-not-permitted" };
  }
  if (!liveGrant.purposes.includes("learning")) {
    return { allowed: false, reason: "purpose-not-covered" };
  }
  if (!grantHashMatches(rights, liveGrant)) {
    return { allowed: false, reason: "consent-hash-mismatch" };
  }
  if (rights.expiresAt !== null && rights.expiresAt <= now) {
    return { allowed: false, reason: "rights-expired" };
  }
  return { allowed: true, reason: "rights-within-grant" };
}
