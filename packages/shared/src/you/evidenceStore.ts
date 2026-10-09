// YOU evidence content store (W2A — docs/you/CONTRACTS.md "Evidence /
// capture / consent", wave-2 freeze).
//
// Evidence content is NEVER inlined in records or events: records carry an
// opaque `contentRef` plus a sha-256 `contentHash` binding. This module
// defines the store abstraction plus the deterministic in-memory fixture
// implementation (seed-derived synthetic bytes; sha-256 via the node:crypto
// builtin — not a new dependency).
//
// Fixture laws (docs/you/FIXTURES.md) apply verbatim: no ambient
// nondeterminism — synthetic bytes come only from an injected
// DeterministicRng; the same seed produces byte-identical content on every
// run and platform. `get` returns a defensive copy so callers cannot
// corrupt stored bytes in place (hash binding stays verifiable).

import { createHash } from "node:crypto";
import type { CaptureModality, OpaqueId } from "./contract.js";
import type { YouRng } from "./rng.js";

/** sha-256 hex digest of raw bytes (node:crypto builtin). */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Result of storing content: the opaque ref plus the content hash binding. */
export interface EvidenceContentBinding {
  readonly contentRef: OpaqueId;
  readonly contentHash: string;
  readonly byteLength: number;
}

/**
 * Content store abstraction. Implementations are injection points for real
 * object storage later; the fixture implementation below is deterministic
 * and in-memory. `contentRef` values are opaque store keys; content is
 * addressed by the sha-256 `contentHash` recorded alongside the ref.
 */
export interface EvidenceContentStore {
  /** Stores bytes; returns the opaque ref and the sha-256 hash binding. */
  put(bytes: Uint8Array): EvidenceContentBinding;
  /** Returns a defensive copy of the stored bytes, or null when absent. */
  get(contentRef: OpaqueId): Uint8Array | null;
  /** True when the ref resolves. */
  has(contentRef: OpaqueId): boolean;
  /** Removes the content for a ref (retention); returns what was removed. */
  delete(contentRef: OpaqueId): boolean;
  /** Number of stored refs (observability/tests). */
  readonly size: number;
}

/**
 * Fixed synthetic payload sizes per modality (fixture definition — part of
 * the frozen fixture contract; changing any size changes every golden
 * expectation and requires a new fixture version, never an in-place edit).
 */
export const FIXTURE_MODALITY_BYTE_LENGTHS: Readonly<Record<string, number>> = {
  audio: 3072,
  depth: 1536,
  document: 1024,
  image: 2048,
  measurement: 256,
  video: 4096,
};

/** Default size for unlisted modalities (fixture definition). */
export const FIXTURE_MODALITY_DEFAULT_BYTE_LENGTH = 512;

export function fixtureModalityByteLength(modality: CaptureModality): number {
  return FIXTURE_MODALITY_BYTE_LENGTHS[modality] ?? FIXTURE_MODALITY_DEFAULT_BYTE_LENGTH;
}

/**
 * Deterministic synthetic evidence bytes (docs/you/FIXTURES.md laws 1-2, 7:
 * seed-derived only; no PII, no biometric data — synthetic bytes from the
 * injected RNG). The RNG consumption order (4 bytes per nextUint32,
 * little-endian) is part of the frozen fixture definition.
 */
export function synthesizeFixtureEvidenceBytes(rng: YouRng, modality: CaptureModality): Uint8Array {
  const length = fixtureModalityByteLength(modality);
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

/** Ref format: `you_content_<first 16 hex chars of the sha-256 digest>`. */
export const EVIDENCE_CONTENT_REF_PREFIX = "you_content";

function contentRefFor(contentHash: string): OpaqueId {
  return `${EVIDENCE_CONTENT_REF_PREFIX}_${contentHash.slice(0, 16)}`;
}

/**
 * Deterministic in-memory fixture content store. Content-addressed: the
 * same bytes always map to the same `contentRef` (idempotent puts), and
 * stored bytes are private copies so external mutation cannot desynchronize
 * the ref/hash binding.
 */
export function createFixtureEvidenceContentStore(): EvidenceContentStore {
  const stored = new Map<OpaqueId, Uint8Array>();
  return {
    put(bytes: Uint8Array): EvidenceContentBinding {
      const contentHash = sha256Hex(bytes);
      const contentRef = contentRefFor(contentHash);
      if (!stored.has(contentRef)) {
        stored.set(contentRef, Uint8Array.from(bytes));
      }
      return { contentRef, contentHash, byteLength: bytes.byteLength };
    },
    get(contentRef: OpaqueId): Uint8Array | null {
      const bytes = stored.get(contentRef);
      return bytes === undefined ? null : Uint8Array.from(bytes);
    },
    has(contentRef: OpaqueId): boolean {
      return stored.has(contentRef);
    },
    delete(contentRef: OpaqueId): boolean {
      return stored.delete(contentRef);
    },
    get size(): number {
      return stored.size;
    },
  };
}
