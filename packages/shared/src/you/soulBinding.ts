// YOU soul binding machinery (W7A — docs/you/CONTRACTS.md "Wave-7 contract
// freeze (v7)": "SoulBinding (provider-neutral LLM/VLM/runtime binding)";
// "SoulRoutingProfile (system-one/system-two — ROUTING PROFILES, not fixed
// model identities)").
//
// This module owns the pure soul-binding machinery: the stateless input
// validator (the single refusal authority reused at registration time AND
// at session-open / soul-reassignment time), canonical construction, and
// integrity verification of pre-built bindings. Provider/model references
// are opaque strings — the provider/model registry authority is the W7C
// lane; nothing here is a second provider authority.

import type { OpaqueId, SoulBinding, SoulRoutingProfile } from "./contract.js";
import { deepFreeze } from "./serialize.js";

export const SOUL_ROUTING_PROFILES = ["system-one", "system-two"] as const;

const ROUTING_PROFILE_SET: ReadonlySet<string> = new Set(SOUL_ROUTING_PROFILES);

/** True when the value is one of the two frozen routing profiles. */
export function isSoulRoutingProfile(value: unknown): value is SoulRoutingProfile {
  return typeof value === "string" && ROUTING_PROFILE_SET.has(value);
}

/** Soul binding intake (provider-neutral, opaque references only). */
export interface SoulBindingInput {
  readonly providerKind: string;
  readonly modelRef: string;
  readonly routingProfile: SoulRoutingProfile;
  readonly capabilities?: readonly string[];
}

/** A refusal returned by the stateless validator (never an exception). */
export interface SoulBindingRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless soul-binding validator (the single intake authority).
 * Returns null when the input is sound, or the refusal reason. Validation
 * is pure: no clock, no rng, no store, no registry lookup.
 */
export function validateSoulBindingInput(input: SoulBindingInput): SoulBindingRefusal | null {
  if (typeof input.providerKind !== "string" || input.providerKind.trim().length === 0) {
    return { reason: "provider-kind-empty", detail: "providerKind must be a non-empty string" };
  }
  if (typeof input.modelRef !== "string" || input.modelRef.trim().length === 0) {
    return { reason: "model-ref-empty", detail: "modelRef must be a non-empty string" };
  }
  if (!isSoulRoutingProfile(input.routingProfile)) {
    return {
      reason: "routing-profile-invalid",
      detail: `routingProfile must be one of: ${SOUL_ROUTING_PROFILES.join(", ")}`,
    };
  }
  for (const capability of input.capabilities ?? []) {
    if (typeof capability !== "string" || capability.trim().length === 0) {
      return { reason: "capability-invalid", detail: "capabilities must be non-empty strings" };
    }
  }
  return null;
}

/** Ids for soul bindings come from the injected factory (opaque, no PII). */
export interface SoulBindingDeps {
  readonly ids: { next(kind: string): OpaqueId };
}

/**
 * Constructs the immutable SoulBinding record. Lists are canonicalized
 * (sorted + de-duplicated — docs/you/FIXTURES.md law 4: stable ordering),
 * so the same intake always yields the byte-identical record shape.
 */
export function constructSoulBinding(input: SoulBindingInput, deps: SoulBindingDeps): SoulBinding {
  const refusal = validateSoulBindingInput(input);
  if (refusal !== null) {
    throw new Error(`constructSoulBinding refused intake: ${refusal.reason} (${refusal.detail})`);
  }
  return deepFreeze({
    id: deps.ids.next("soul-binding"),
    providerKind: input.providerKind,
    modelRef: input.modelRef,
    routingProfile: input.routingProfile,
    capabilities: canonicalStringList(input.capabilities),
  });
}

/**
 * Integrity check for a pre-built binding (e.g. one arriving off a
 * persisted projection): shape must be sound and lists canonical. Returns
 * the reason when unsound, or null when sound.
 */
export function verifySoulBindingIntegrity(binding: SoulBinding): string | null {
  if (typeof binding.id !== "string" || binding.id.length === 0) {
    return "binding-id-malformed";
  }
  const shapeRefusal = validateSoulBindingInput({
    providerKind: binding.providerKind,
    modelRef: binding.modelRef,
    routingProfile: binding.routingProfile,
    capabilities: binding.capabilities,
  });
  if (shapeRefusal !== null) {
    return shapeRefusal.reason;
  }
  if (!isCanonicalList(binding.capabilities)) {
    return "capabilities-not-canonical";
  }
  return null;
}

/** Sorts bindings by id (FIXTURES.md law 4: stable ordering). */
export function sortSoulBindings(bindings: readonly SoulBinding[]): SoulBinding[] {
  return [...bindings].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Sorted + de-duplicated copy of a string list (canonical form). */
export function canonicalStringList(values: readonly string[] | undefined): string[] {
  return [...new Set(values ?? [])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** True when a list is already in canonical (sorted, deduplicated) form. */
export function isCanonicalList(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined || previous >= current) {
      return false;
    }
  }
  return true;
}
