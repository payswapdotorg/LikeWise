// YOU provider-neutral Arena client boundary (W8A — docs/you/CONTRACTS.md
// "Wave-8 contract freeze (v8)": "ArenaProviderDescriptor (provider-neutral
// arena client boundary)"; PROVIDER NEUTRALITY: arena providers are
// adapters behind a fail-closed seam (the W4C/W6C/W7C precedent).
// Provider references are opaque; real runtime integration stays W9+
// compute-plane work.
//
// ARENA BOUNDARY LAW (docs/you/ARCHITECTURE.md §15): the client NEVER
// mutates YOU state. Every typed invocation returns a typed payload (an
// ArenaDelivery wrapping the frozen ArenaExpertResult shape plus a
// content-addressed artifact binding); application happens through YOU's
// own authority (arenaService.ts exposes the payload; the solution plane
// applies it).
//
// Fail-closed rules (golden):
//   1. an unknown provider id refuses with typed
//      YOU_ARENA_ADAPTER_UNSUPPORTED ("provider-unknown");
//   2. a provider whose capabilityClasses do not cover the invocation's
//      gap category refuses with the same typed code
//      ("provider-capability-mismatch");
//   3. an invocation against a category with no fixture result refuses
//      with the same typed code ("no-fixture-result") — never a silent
//      fallback.
//
// The fixture adapter implements the seam deterministically
// (docs/you/FIXTURES.md law 9: mock Arena expert results come from the
// frozen v1 table keyed by capability-gap category); timestamps come
// from the injected clock and artifact content is addressed through the
// wave-2 content-store abstraction (sha-256, never inlined).

import type { ArenaExpertResult, ArenaProviderDescriptor, CapabilityGapCategory, OpaqueId, YouError } from "./contract.js";
import type { YouClock } from "./clock.js";
import { ARENA_MOCK_EXPERT_RESULTS } from "./gap.js";
import type { YouIdFactory } from "./ids.js";
import type { EvidenceContentStore } from "./evidenceStore.js";
import { deepFreeze } from "./serialize.js";
import { stableStringify } from "./serialize.js";

// ---------------------------------------------------------------------------
// Provider descriptor registry machinery (opaque provider refs)
// ---------------------------------------------------------------------------

/** Provider-descriptor intake (provider-neutral, opaque references only). */
export interface ArenaProviderInput {
  readonly providerKind: string;
  readonly capabilityClasses: readonly string[];
  /** null when the provider has no registered endpoint (fixture providers). */
  readonly endpointRef?: string | null;
}

/** A refusal returned by the stateless provider validator (never an exception). */
export interface ArenaProviderRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless provider-descriptor validator (the single intake
 * authority): providerKind must be a non-empty string; capabilityClasses
 * must be a non-empty list of unique non-empty strings; endpointRef must
 * be null or a non-empty string.
 */
export function validateArenaProviderInput(input: ArenaProviderInput): ArenaProviderRefusal | null {
  if (typeof input.providerKind !== "string" || input.providerKind.trim().length === 0) {
    return { reason: "provider-kind-empty", detail: "providerKind must be a non-empty string" };
  }
  if (!Array.isArray(input.capabilityClasses) || input.capabilityClasses.length === 0) {
    return {
      reason: "capability-classes-empty",
      detail: "capabilityClasses must list at least one capability class",
    };
  }
  const seen = new Set<string>();
  for (const capabilityClass of input.capabilityClasses) {
    if (typeof capabilityClass !== "string" || capabilityClass.trim().length === 0) {
      return { reason: "capability-class-invalid", detail: "capabilityClasses must be non-empty strings" };
    }
    if (seen.has(capabilityClass)) {
      return { reason: "capability-class-duplicate", detail: `duplicate capability class "${capabilityClass}"` };
    }
    seen.add(capabilityClass);
  }
  const endpointRef = input.endpointRef ?? null;
  if (endpointRef !== null && (typeof endpointRef !== "string" || endpointRef.length === 0)) {
    return { reason: "endpoint-ref-invalid", detail: "endpointRef must be null or a non-empty string" };
  }
  return null;
}

/** Deps for descriptor construction (injected id factory only). */
export interface ArenaProviderDeps {
  readonly nextId: (kind: string) => OpaqueId;
}

/** Constructs the immutable, deep-frozen descriptor (canonical class order). */
export function constructArenaProviderDescriptor(
  input: ArenaProviderInput,
  deps: ArenaProviderDeps,
): { readonly ok: true; readonly descriptor: ArenaProviderDescriptor } | { readonly ok: false; readonly refusal: ArenaProviderRefusal } {
  const refusal = validateArenaProviderInput(input);
  if (refusal !== null) {
    return { ok: false, refusal };
  }
  return {
    ok: true,
    descriptor: deepFreeze({
      id: deps.nextId("arena-provider"),
      providerKind: input.providerKind,
      capabilityClasses: Object.freeze([...input.capabilityClasses].sort()),
      endpointRef: input.endpointRef ?? null,
    }),
  };
}

/** Sorts descriptors by id (FIXTURES.md law 4: stable ordering). */
export function sortArenaProviderDescriptors(descriptors: readonly ArenaProviderDescriptor[]): ArenaProviderDescriptor[] {
  return [...descriptors].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The provider lookup the client seam resolves through (the service's
 * registry). Opaque refs only — the registry authority at the service
 * seam; research/registry authority = the W8C lane.
 */
export interface ArenaProviderLookup {
  descriptorOf(providerId: OpaqueId): ArenaProviderDescriptor | null;
}

// ---------------------------------------------------------------------------
// The ArenaClient seam
// ---------------------------------------------------------------------------

/** One typed invocation against the Arena boundary. */
export interface ArenaInvocation {
  readonly providerId: OpaqueId;
  readonly escalationId: OpaqueId;
  readonly gapId: OpaqueId;
  readonly category: CapabilityGapCategory;
  /** The ARENA.md minimum-context capsule (opaque refs, never inlined). */
  readonly minimumContext: readonly string[];
}

/**
 * The typed delivery payload: the frozen ArenaExpertResult shape plus
 * the content-addressed artifact binding for the delivered result bytes.
 * The client returns this; it NEVER applies anything (the boundary law).
 */
export interface ArenaDelivery {
  readonly providerId: OpaqueId;
  readonly escalationId: OpaqueId;
  readonly expertResult: ArenaExpertResult;
  readonly contentRef: OpaqueId;
  readonly contentHash: string;
  /** Envelope timestamp (injected clock) — when YOU received the delivery. */
  readonly deliveredAt: string;
  readonly simulated: boolean;
}

/** Deps injected into a client (clock/ids/store — never ambient). */
export interface ArenaClientDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
  readonly store: EvidenceContentStore;
}

/** The typed client result: a delivery or a typed YouError (fail-closed). */
export type ArenaClientResult =
  | { readonly ok: true; readonly delivery: ArenaDelivery }
  | { readonly ok: false; readonly error: YouError };

/** The provider-neutral Arena client seam (an injection point, never an authority). */
export interface ArenaClient {
  invoke(request: ArenaInvocation): ArenaClientResult;
}

function adapterFailure(reason: string, detail: string, providerId: OpaqueId): { readonly ok: false; readonly error: YouError } {
  return {
    ok: false,
    error: {
      code: "YOU_ARENA_ADAPTER_UNSUPPORTED",
      message: detail,
      details: { reason, providerId },
      simulated: true,
    },
  };
}

/**
 * The deterministic fixture Arena client (FIXTURES.md law 9): resolves the
 * provider through the injected lookup (fail-closed on unknown providers
 * and capability mismatches), picks the frozen v1 mock expert result for
 * the gap category, content-addresses the result bytes through the
 * injected store, and returns the typed delivery. Truth law: the delivery
 * stays `simulated: true`.
 */
export function createFixtureArenaClient(lookup: ArenaProviderLookup, deps: ArenaClientDeps): ArenaClient {
  return {
    invoke(request: ArenaInvocation): ArenaClientResult {
      const descriptor = lookup.descriptorOf(request.providerId);
      if (descriptor === null) {
        return adapterFailure(
          "provider-unknown",
          `unknown arena provider: ${request.providerId}`,
          request.providerId,
        );
      }
      if (!descriptor.capabilityClasses.includes(request.category)) {
        return adapterFailure(
          "provider-capability-mismatch",
          `arena provider ${request.providerId} does not serve capability class ${request.category}`,
          request.providerId,
        );
      }
      const expertResult = ARENA_MOCK_EXPERT_RESULTS[request.category];
      if (expertResult === undefined) {
        return adapterFailure(
          "no-fixture-result",
          `no fixture expert result for capability-gap category ${request.category}`,
          request.providerId,
        );
      }
      const binding = deps.store.put(new TextEncoder().encode(stableStringify(expertResult)));
      const delivery: ArenaDelivery = deepFreeze({
        providerId: request.providerId,
        escalationId: request.escalationId,
        expertResult,
        contentRef: binding.contentRef,
        contentHash: binding.contentHash,
        deliveredAt: deps.clock.now(),
        simulated: true,
      });
      return { ok: true, delivery };
    },
  };
}
