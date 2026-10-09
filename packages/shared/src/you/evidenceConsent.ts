// YOU consent authority primitives (W2A — docs/you/CONTRACTS.md
// "Evidence / capture / consent", docs/you/SECURITY.md "Consent").
//
// Consent is explicit, scoped, revocable, purpose-specific and
// server-enforced; operational use and learning reuse are consented
// separately. This module owns:
//   - ConsentPolicy record construction/validation;
//   - the append-only consent state machine (unknown -> granted/denied;
//     granted -> withdrawn/expired — re-grant after a terminal state
//     requires a NEW policy id, never a state rewrite);
//   - the enforcement predicates canProcess / canLearn (fail-closed).
//
// Enforcement rules (golden; tested as a matrix):
//   canProcess(privacyClass, purpose, activeConsent):
//     1. privacyClass "credential" is NEVER processable as evidence.
//     2. No consent reference at all: sensitive classes are denied
//        ("consent-required"); non-sensitive classes are allowed.
//     3. An unregistered policy id (stale reference) behaves like an
//        undecided instrument: sensitive denied, non-sensitive allowed.
//     4. An explicit non-granted decision (denied / withdrawn / expired)
//        ALWAYS denies — refusal, revocation and expiry block future use
//        of the evidence captured under the instrument, regardless of
//        class (fail closed; docs/you/SECURITY.md "Withdrawal stops
//        future use").
//     5. An undecided instrument ("unknown") denies sensitive classes and
//        allows non-sensitive classes (nothing has been refused yet).
//     6. A granted consent governs both classes: the purpose must be
//        covered and operational use must be permitted.
//   canLearn(activeConsent): granted + policy.learningReuse + the
//     "learning" purpose must be covered.

import type {
  ConsentPolicy,
  ConsentPurpose,
  ConsentReference,
  ConsentState,
  EvidencePrivacyClass,
  EvidenceRetention,
  LearningScope,
  OpaqueId,
} from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** Data classes that require an ACTIVE consent reference for processing. */
export const SENSITIVE_PRIVACY_CLASSES: readonly EvidencePrivacyClass[] = [
  "sensitive-media",
  "biometric-evidence",
  "medical",
];

/** Classes that are never processable as evidence material. */
export const NON_PROCESSABLE_PRIVACY_CLASSES: readonly EvidencePrivacyClass[] = ["credential"];

export function isSensitivePrivacyClass(privacyClass: EvidencePrivacyClass): boolean {
  return SENSITIVE_PRIVACY_CLASSES.includes(privacyClass);
}

export function isNonProcessablePrivacyClass(privacyClass: EvidencePrivacyClass): boolean {
  return NON_PROCESSABLE_PRIVACY_CLASSES.includes(privacyClass);
}

export interface ConsentPolicyIntake {
  readonly purposes: readonly ConsentPurpose[];
  readonly scope: LearningScope;
  readonly operationalUse: boolean;
  readonly learningReuse: boolean;
  readonly retention: EvidenceRetention;
  readonly revocable: boolean;
}

/** Creates an immutable ConsentPolicy with an explicit id. */
export function createConsentPolicy(id: OpaqueId, intake: ConsentPolicyIntake): ConsentPolicy {
  if (id.length === 0) {
    throw new Error("ConsentPolicy requires a non-empty id");
  }
  if (intake.purposes.length === 0) {
    throw new Error("ConsentPolicy requires at least one purpose");
  }
  return deepFreeze({
    id,
    purposes: Object.freeze([...intake.purposes]),
    scope: intake.scope,
    operationalUse: intake.operationalUse,
    learningReuse: intake.learningReuse,
    retention: intake.retention,
    revocable: intake.revocable,
  });
}

/** The authoritative consent for a policy id, as seen by enforcement. */
export interface ActiveConsent {
  readonly policy: ConsentPolicy | null;
  readonly state: ConsentState;
}

/** Deterministic enforcement outcome with a machine-readable reason. */
export interface ConsentDecisionOutcome {
  readonly allowed: boolean;
  readonly reason: string;
}

export interface CanProcessInput {
  readonly privacyClass: EvidencePrivacyClass;
  readonly purpose: ConsentPurpose;
  readonly consent: ActiveConsent | null;
}

/** Enforcement predicate: may evidence of this class be processed for the purpose? */
export function canProcess(input: CanProcessInput): ConsentDecisionOutcome {
  if (isNonProcessablePrivacyClass(input.privacyClass)) {
    return { allowed: false, reason: "privacy-class-not-processable" };
  }
  const sensitive = isSensitivePrivacyClass(input.privacyClass);
  const consent = input.consent;
  if (consent === null || consent.policy === null) {
    // No reference, or a reference to an unregistered (stale) policy:
    // behaves like an undecided instrument.
    return sensitive
      ? { allowed: false, reason: "consent-required" }
      : { allowed: true, reason: "non-sensitive-without-consent" };
  }
  if (consent.state === "denied" || consent.state === "withdrawn" || consent.state === "expired") {
    return { allowed: false, reason: `consent-${consent.state}` };
  }
  if (consent.state === "unknown") {
    return sensitive
      ? { allowed: false, reason: "consent-required" }
      : { allowed: true, reason: "non-sensitive-consent-undecided" };
  }
  if (!consent.policy.purposes.includes(input.purpose)) {
    return { allowed: false, reason: "purpose-not-covered" };
  }
  if (!consent.policy.operationalUse) {
    return { allowed: false, reason: "operational-use-not-permitted" };
  }
  return { allowed: true, reason: "consent-active" };
}

/** Enforcement predicate: may the referenced evidence be reused for learning? */
export function canLearn(consent: ActiveConsent | null): ConsentDecisionOutcome {
  if (consent === null || consent.policy === null) {
    return { allowed: false, reason: "consent-required" };
  }
  if (consent.state !== "granted") {
    return { allowed: false, reason: `consent-${consent.state}` };
  }
  if (!consent.policy.learningReuse) {
    return { allowed: false, reason: "learning-reuse-not-permitted" };
  }
  if (!consent.policy.purposes.includes("learning")) {
    return { allowed: false, reason: "purpose-not-covered" };
  }
  return { allowed: true, reason: "learning-permitted" };
}

/**
 * Consent state machine (append-only). Terminal states are final for the
 * policy id: a re-grant after denied/withdrawn/expired must register a NEW
 * policy — the registry never rewrites history.
 */
const CONSENT_TRANSITIONS: Readonly<Record<ConsentState, readonly ConsentState[]>> = {
  unknown: ["granted", "denied"],
  granted: ["withdrawn", "expired"],
  denied: [],
  expired: [],
  withdrawn: [],
};

export function isLegalConsentTransition(from: ConsentState, to: ConsentState): boolean {
  return CONSENT_TRANSITIONS[from].includes(to);
}

/** Snapshot reference for the current state of a policy. */
export function consentReferenceFor(policy: ConsentPolicy, state: ConsentState): ConsentReference {
  return deepFreeze({ policyId: policy.id, state, learningPermission: policy.learningReuse });
}

/**
 * Server-enforced consent registry: the authority for consent state truth.
 * The service layer wraps every mutation with append-only ledger events;
 * this class only owns the in-memory fold and the transition guards.
 */
export class ConsentRegistry {
  private readonly policies = new Map<OpaqueId, ConsentPolicy>();
  private readonly states = new Map<OpaqueId, ConsentState>();

  /** Registers a policy (state stays "unknown" until a decision). */
  registerPolicy(policy: ConsentPolicy): void {
    if (this.policies.has(policy.id)) {
      throw new Error(`consent policy already registered: ${policy.id}`);
    }
    this.policies.set(policy.id, policy);
    this.states.set(policy.id, "unknown");
  }

  hasPolicy(policyId: OpaqueId): boolean {
    return this.policies.has(policyId);
  }

  policyOf(policyId: OpaqueId): ConsentPolicy | null {
    return this.policies.get(policyId) ?? null;
  }

  /** Authoritative state ("unknown" covers both never-decided and unregistered). */
  stateOf(policyId: OpaqueId): ConsentState {
    return this.states.get(policyId) ?? "unknown";
  }

  /** The active consent as enforcement sees it. */
  active(policyId: OpaqueId): ActiveConsent {
    const policy = this.policyOf(policyId);
    if (policy === null) {
      return { policy: null, state: "unknown" };
    }
    return { policy, state: this.stateOf(policyId) };
  }

  /** Records the first decision (grant or deny); throws on later decisions. */
  recordDecision(policyId: OpaqueId, decision: "granted" | "denied"): ConsentReference {
    const policy = this.policyOf(policyId);
    if (policy === null) {
      throw new Error(`unknown consent policy: ${policyId}`);
    }
    const current = this.stateOf(policyId);
    if (!isLegalConsentTransition(current, decision)) {
      throw new Error(`illegal consent transition ${current} -> ${decision} for ${policyId}`);
    }
    this.states.set(policyId, decision);
    return consentReferenceFor(policy, decision);
  }

  /** Withdraws an active grant (revocation); terminal for the policy id. */
  withdraw(policyId: OpaqueId): ConsentReference {
    const policy = this.policyOf(policyId);
    if (policy === null) {
      throw new Error(`unknown consent policy: ${policyId}`);
    }
    const current = this.stateOf(policyId);
    if (current !== "granted") {
      throw new Error(`illegal consent withdrawal from state ${current} for ${policyId}`);
    }
    if (!policy.revocable) {
      throw new Error(`consent policy is not revocable: ${policyId}`);
    }
    this.states.set(policyId, "withdrawn");
    return consentReferenceFor(policy, "withdrawn");
  }

  /** Expires an active grant (retention-driven); terminal for the policy id. */
  expire(policyId: OpaqueId): ConsentReference {
    const policy = this.policyOf(policyId);
    if (policy === null) {
      throw new Error(`unknown consent policy: ${policyId}`);
    }
    const current = this.stateOf(policyId);
    if (current !== "granted") {
      throw new Error(`illegal consent expiry from state ${current} for ${policyId}`);
    }
    this.states.set(policyId, "expired");
    return consentReferenceFor(policy, "expired");
  }

  /** Enforcement helper: may this policy's evidence be processed? */
  canProcessFor(policyId: OpaqueId, privacyClass: EvidencePrivacyClass, purpose: ConsentPurpose): ConsentDecisionOutcome {
    return canProcess({ privacyClass, purpose, consent: this.active(policyId) });
  }

  /** Enforcement helper: may this policy's evidence be reused for learning? */
  canLearnFrom(policyId: OpaqueId): ConsentDecisionOutcome {
    return canLearn(this.active(policyId));
  }

  /** Sorted policy list (stable ordering for projections/fixtures). */
  policiesSorted(): readonly ConsentPolicy[] {
    return [...this.policies.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
}
