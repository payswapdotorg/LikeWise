// YOU HTIR domain blocks (W3A — docs/you/ARCHITECTURE.md §4 "HTIR",
// CONTRACTS.md "Twin / reconstruction", frozen v3 contracts).
//
// HTIR = Human Twin Intermediate Representation, composed of typed domain
// blocks (identity binding, morphology, geometry/skeleton, face/hands,
// appearance/materials, hair, articulation/blendshapes, neural appearance,
// motion profile, voice, style + open domain extensions). Domain content
// is NEVER inlined: each block is content-addressed through the wave-2
// content-store abstraction (`contentRef` + sha-256 `contentHash`).
//
// Fixture laws (docs/you/FIXTURES.md) apply verbatim: domain payload bytes
// are synthesized only from an injected DeterministicRng; confidence is a
// deterministic function of the stored content hash; every fixture block
// stays labeled `simulated: true` (truth law).

import type { AuthorType, HtirDomainBlock, HtirDomainKind, OpaqueId, ProvenanceRecord } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import type { YouRng } from "./rng.js";
import { seedFromString } from "./rng.js";
import { deepFreeze } from "./serialize.js";
import { type EvidenceContentStore } from "./evidenceStore.js";

/**
 * Known HTIR domains (docs/you/ARCHITECTURE.md §4). The contract union is
 * OPEN: domain extensions are legal without contract changes; this list is
 * only the fixture's naming/length table, not a closed authority.
 */
export const KNOWN_HTIR_DOMAINS = [
  "appearance-materials",
  "articulation-blendshapes",
  "face-hands",
  "geometry-skeleton",
  "hair",
  "identity-binding",
  "morphology",
  "motion-profile",
  "neural-appearance",
  "style",
  "voice",
] as const;
export type KnownHtirDomain = (typeof KNOWN_HTIR_DOMAINS)[number];

/**
 * Fixed synthetic payload sizes per known domain (fixture definition —
 * part of the frozen fixture contract; changing any size changes every
 * golden expectation and requires a new fixture version).
 */
export const FIXTURE_HTIR_DOMAIN_BYTE_LENGTHS: Readonly<Record<string, number>> = {
  "appearance-materials": 2048,
  "articulation-blendshapes": 1536,
  "face-hands": 1536,
  "geometry-skeleton": 2048,
  hair: 1024,
  "identity-binding": 256,
  morphology: 1024,
  "motion-profile": 3072,
  "neural-appearance": 4096,
  style: 512,
  voice: 2048,
};

/** Default size for domain extensions (fixture definition). */
export const FIXTURE_HTIR_DOMAIN_DEFAULT_BYTE_LENGTH = 512;

export function fixtureHtirDomainByteLength(domain: HtirDomainKind): number {
  return FIXTURE_HTIR_DOMAIN_BYTE_LENGTHS[domain] ?? FIXTURE_HTIR_DOMAIN_DEFAULT_BYTE_LENGTH;
}

/**
 * Deterministic synthetic HTIR domain payload bytes (FIXTURES.md laws 1-2,
 * 7: seed-derived only; no PII, no biometric data). The RNG consumption
 * order (4 bytes per nextUint32, little-endian) is part of the frozen
 * fixture definition and mirrors the wave-2 evidence synthesizer.
 */
export function synthesizeHtirDomainBytes(rng: YouRng, domain: HtirDomainKind): Uint8Array {
  const length = fixtureHtirDomainByteLength(domain);
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

/** 2^32 as a float for the [0, 1) conversion. */
const TWO_POW_32 = 4294967296;

/**
 * Deterministic fixture confidence in [0.5, 1) derived from the stored
 * content hash (fixture definition): the 8 hex chars at the offset keyed
 * by the domain name (FNV-1a seed mod 56, so offset + 8 <= 64) parse to
 * a [0, 1) value mapped into the upper half. Fixture confidences never
 * imply scientific validity (truth law).
 */
export function fixtureDomainConfidence(contentHash: string, domain: HtirDomainKind): number {
  const offset = seedFromString(domain) % 56;
  const word = Number.parseInt(contentHash.slice(offset, offset + 8), 16);
  const parsed = Number.isNaN(word) ? 0 : word / TWO_POW_32;
  return Math.round((0.5 + parsed / 2) * 10000) / 10000;
}

/** Returns a validation reason for an illegal domain kind, or null when legal. */
export function validateHtirDomainKind(domain: HtirDomainKind): string | null {
  if (typeof domain !== "string" || domain.trim().length === 0) {
    return "domain kind must be a non-empty string";
  }
  if (domain !== domain.trim()) {
    return "domain kind must not carry surrounding whitespace";
  }
  return null;
}

/** True for the known domain set (extensions return false; they are still legal). */
export function isKnownHtirDomain(domain: HtirDomainKind): boolean {
  return (KNOWN_HTIR_DOMAINS as readonly string[]).includes(domain);
}

export interface HtirDomainBlockIntake {
  readonly domain: HtirDomainKind;
  /**
   * Explicit payload bytes. When omitted, deterministic fixture bytes are
   * synthesized from the injected rng (fixture mode).
   */
  readonly bytes?: Uint8Array;
  /** Injected rng for fixture byte synthesis (required when bytes are omitted). */
  readonly rng?: YouRng;
  /**
   * Explicit 0..1 confidence (real adapters pass measured values). When
   * omitted, the deterministic fixture confidence derived from the stored
   * content hash is used.
   */
  readonly confidence?: number;
  readonly provenanceSource: string;
  readonly generator?: AuthorType;
  /** Ancestors, oldest first (e.g. the reconstruction job / source version). */
  readonly lineage?: readonly OpaqueId[];
  /** Truth law: fixture/synthetic blocks stay labeled. */
  readonly simulated: boolean;
}

export interface HtirDomainBlockDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
  /** Wave-2 content-store abstraction: contentRef + sha-256 contentHash. */
  readonly store: EvidenceContentStore;
}

/**
 * Constructs one immutable, deep-frozen HtirDomainBlock. Content is stored
 * through the wave-2 content store (never inlined); the block records the
 * opaque `contentRef` plus the sha-256 `contentHash` binding.
 */
export function createHtirDomainBlock(
  intake: HtirDomainBlockIntake,
  deps: HtirDomainBlockDeps,
): HtirDomainBlock {
  const domainReason = validateHtirDomainKind(intake.domain);
  if (domainReason !== null) {
    throw new Error(`invalid HTIR domain kind: ${domainReason}`);
  }
  if (intake.confidence !== undefined && (!Number.isFinite(intake.confidence) || intake.confidence < 0 || intake.confidence > 1)) {
    throw new Error("explicit HTIR domain confidence must be a finite number in [0, 1]");
  }
  const bytes =
    intake.bytes ?? (intake.rng !== undefined ? synthesizeHtirDomainBytes(intake.rng, intake.domain) : null);
  if (bytes === null) {
    throw new Error("HTIR domain block requires explicit bytes or an injected rng");
  }
  const binding = deps.store.put(bytes);
  const createdAt = deps.clock.now();
  const confidence = intake.confidence ?? fixtureDomainConfidence(binding.contentHash, intake.domain);
  const provenance: ProvenanceRecord = deepFreeze({
    source: intake.provenanceSource,
    generator: intake.generator ?? "fixture",
    createdAt,
    lineage: Object.freeze([...(intake.lineage ?? [])]),
  });
  return deepFreeze({
    id: deps.ids.next("htir-block"),
    domain: intake.domain,
    contentRef: binding.contentRef,
    contentHash: binding.contentHash,
    confidence,
    simulated: intake.simulated,
    provenance,
  });
}

/** Returns a validation reason for a domain-block list, or null when valid. */
export function validateHtirDomainBlocks(blocks: readonly HtirDomainBlock[]): string | null {
  const seen = new Set<HtirDomainKind>();
  for (const block of blocks) {
    const domainReason = validateHtirDomainKind(block.domain);
    if (domainReason !== null) {
      return `block ${block.id}: ${domainReason}`;
    }
    if (!Number.isFinite(block.confidence) || block.confidence < 0 || block.confidence > 1) {
      return `block ${block.id}: confidence must be a finite number in [0, 1]`;
    }
    if (block.contentHash.length === 0) {
      return `block ${block.id}: contentHash must be non-empty`;
    }
    if (seen.has(block.domain)) {
      return `duplicate domain "${block.domain}" in one domain-block list`;
    }
    seen.add(block.domain);
  }
  return null;
}

/** Sorted unique domain kinds of a block list (FIXTURES.md law 4: stable ordering). */
export function domainsOfBlocks(blocks: readonly HtirDomainBlock[]): HtirDomainKind[] {
  return [...new Set(blocks.map((block) => block.domain))].sort();
}
