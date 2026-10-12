// YOU agent body registry machinery (W7A — docs/you/CONTRACTS.md
// "Wave-7 contract freeze (v7)": "AgentBody (appearance/role/capabilities/
// tools/policies/memory + evaluator contracts, content-addressed
// appearance)").
//
// This module owns the pure AgentBody machinery: the stateless intake
// validator, canonical construction with content-addressed appearance
// (appearance and heavy spec content are NEVER inlined in records —
// appearanceRef + appearanceHash on the same content-store abstraction as
// the evidence lane, docs/you/CONTRACTS.md wave-7 freeze), and integrity
// verification of pre-built bodies. The BODY/SOUL SEPARATION LAW holds by
// construction: nothing in this module knows about souls or sessions; a
// Body record, once constructed, is frozen and is never mutated by
// possession, re-possession or release.

import type { AgentBody, OpaqueId } from "./contract.js";
import { sha256Hex, type EvidenceContentStore } from "./evidenceStore.js";
import { canonicalStringList, isCanonicalList } from "./soulBinding.js";
import { deepFreeze, stableStringify } from "./serialize.js";

/** Inline appearance spec (any JSON-safe value) OR a pre-addressed pair. */
export type AgentBodyAppearanceInput =
  | { readonly spec: unknown }
  | { readonly contentRef: string; readonly contentHash: string }
  | null;

/** Body intake (opaque references; heavy content is never inlined). */
export interface AgentBodyInput {
  readonly role: string;
  readonly appearance?: AgentBodyAppearanceInput;
  readonly capabilities?: readonly string[];
  readonly tools?: readonly OpaqueId[];
  readonly policyRefs?: readonly string[];
  readonly memoryContractRef: string;
  readonly evaluatorContractRef: string;
}

/** A refusal returned by the stateless validator (never an exception). */
export interface AgentBodyRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/** Appearance addressing result of a successful intake. */
export interface AppearanceAddress {
  readonly appearanceRef: string | null;
  readonly appearanceHash: string | null;
}

/** Ids + the content store used for appearance addressing. */
export interface AgentBodyDeps {
  readonly ids: { next(kind: string): OpaqueId };
  readonly store: EvidenceContentStore;
}

const SHA256_HEX_LENGTH = 64;

function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

/**
 * The stateless AgentBody validator (the single intake authority). Returns
 * null when the input is sound, or the refusal reason. Pure: no clock, no
 * rng; appearance CONTENT resolution happens only at construction time
 * (this validator checks shape only, so it can run without a store).
 */
export function validateAgentBodyInput(input: AgentBodyInput): AgentBodyRefusal | null {
  if (typeof input.role !== "string" || input.role.trim().length === 0) {
    return { reason: "role-empty", detail: "role must be a non-empty string" };
  }
  if (typeof input.memoryContractRef !== "string" || input.memoryContractRef.trim().length === 0) {
    return { reason: "memory-contract-ref-empty", detail: "memoryContractRef must be a non-empty string" };
  }
  if (typeof input.evaluatorContractRef !== "string" || input.evaluatorContractRef.trim().length === 0) {
    return { reason: "evaluator-contract-ref-empty", detail: "evaluatorContractRef must be a non-empty string" };
  }
  for (const capability of input.capabilities ?? []) {
    if (typeof capability !== "string" || capability.trim().length === 0) {
      return { reason: "capability-invalid", detail: "capabilities must be non-empty strings" };
    }
  }
  for (const tool of input.tools ?? []) {
    if (typeof tool !== "string" || tool.trim().length === 0) {
      return { reason: "tool-invalid", detail: "tools must be non-empty opaque ids" };
    }
  }
  for (const policyRef of input.policyRefs ?? []) {
    if (typeof policyRef !== "string" || policyRef.trim().length === 0) {
      return { reason: "policy-ref-invalid", detail: "policyRefs must be non-empty strings" };
    }
  }
  const appearance = input.appearance ?? null;
  if (appearance !== null && "contentRef" in appearance) {
    if (typeof appearance.contentRef !== "string" || appearance.contentRef.trim().length === 0) {
      return { reason: "appearance-ref-malformed", detail: "pre-addressed appearance requires a non-empty contentRef" };
    }
    if (typeof appearance.contentHash !== "string" || !isSha256Hex(appearance.contentHash)) {
      return {
        reason: "appearance-hash-malformed",
        detail: `pre-addressed appearance requires a ${SHA256_HEX_LENGTH}-char hex sha-256 contentHash`,
      };
    }
  }
  return null;
}

/**
 * Resolves the appearance addressing for a validated intake:
 * - inline `{ spec }`: the canonical JSON serialization of the spec is
 *   stored through the content store (contentRef + sha-256 contentHash);
 * - pre-addressed pair: the ref must resolve in the store AND the stored
 *   bytes' sha-256 must equal the recorded hash (content-addressed
 *   integrity — never a silent repair);
 * - null: no stored appearance (appearanceRef/appearanceHash both null).
 */
export function addressAgentBodyAppearance(
  appearance: AgentBodyAppearanceInput,
  store: EvidenceContentStore,
): AppearanceAddress | { readonly refusal: AgentBodyRefusal } {
  if (appearance === null || appearance === undefined) {
    return { appearanceRef: null, appearanceHash: null };
  }
  if ("spec" in appearance) {
    const bytes = new TextEncoder().encode(stableStringify(appearance.spec));
    const binding = store.put(bytes);
    return { appearanceRef: binding.contentRef, appearanceHash: binding.contentHash };
  }
  const bytes = store.get(appearance.contentRef);
  if (bytes === null) {
    return {
      refusal: {
        reason: "appearance-ref-unresolved",
        detail: "pre-addressed appearance contentRef does not resolve in the content store",
      },
    };
  }
  const actualHash = sha256Hex(bytes);
  if (actualHash !== appearance.contentHash) {
    return {
      refusal: {
        reason: "appearance-hash-mismatch",
        detail: `pre-addressed appearance hash ${appearance.contentHash} does not match stored content ${actualHash}`,
      },
    };
  }
  return { appearanceRef: appearance.contentRef, appearanceHash: appearance.contentHash };
}

/**
 * Constructs the immutable AgentBody record. Lists are canonicalized
 * (sorted + de-duplicated). Throws only on programmer error (validated
 * intake is required — same contract as constructSoulBinding).
 */
export function constructAgentBody(input: AgentBodyInput, deps: AgentBodyDeps): AgentBody {
  const refusal = validateAgentBodyInput(input);
  if (refusal !== null) {
    throw new Error(`constructAgentBody refused intake: ${refusal.reason} (${refusal.detail})`);
  }
  const addressed = addressAgentBodyAppearance(input.appearance ?? null, deps.store);
  if ("refusal" in addressed) {
    throw new Error(`constructAgentBody refused appearance: ${addressed.refusal.reason}`);
  }
  return deepFreeze({
    id: deps.ids.next("agent-body"),
    role: input.role,
    appearanceRef: addressed.appearanceRef,
    appearanceHash: addressed.appearanceHash,
    capabilities: canonicalStringList(input.capabilities),
    tools: canonicalStringList(input.tools),
    policyRefs: canonicalStringList(input.policyRefs),
    memoryContractRef: input.memoryContractRef,
    evaluatorContractRef: input.evaluatorContractRef,
  });
}

/**
 * Integrity check for a pre-built body (e.g. off a persisted projection):
 * shape must be sound, the appearance pair must be consistent (both null
 * or both present, hash well-formed) and lists canonical. Returns the
 * reason when unsound, or null when sound.
 */
export function verifyAgentBodyIntegrity(body: AgentBody): string | null {
  if (typeof body.id !== "string" || body.id.length === 0) {
    return "body-id-malformed";
  }
  if (typeof body.role !== "string" || body.role.trim().length === 0) {
    return "role-empty";
  }
  if (typeof body.memoryContractRef !== "string" || body.memoryContractRef.trim().length === 0) {
    return "memory-contract-ref-empty";
  }
  if (typeof body.evaluatorContractRef !== "string" || body.evaluatorContractRef.trim().length === 0) {
    return "evaluator-contract-ref-empty";
  }
  const hasRef = body.appearanceRef !== null;
  const hasHash = body.appearanceHash !== null;
  if (hasRef !== hasHash) {
    return "appearance-pair-inconsistent";
  }
  if (hasHash && body.appearanceHash !== null && !isSha256Hex(body.appearanceHash)) {
    return "appearance-hash-malformed";
  }
  if (!isCanonicalList(body.capabilities) || !isCanonicalList(body.tools) || !isCanonicalList(body.policyRefs)) {
    return "lists-not-canonical";
  }
  for (const list of [body.capabilities, body.tools, body.policyRefs]) {
    for (const entry of list) {
      if (entry.trim().length === 0) {
        return "list-entry-empty";
      }
    }
  }
  return null;
}

/** Sorts bodies by id (FIXTURES.md law 4: stable ordering). */
export function sortAgentBodies(bodies: readonly AgentBody[]): AgentBody[] {
  return [...bodies].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
