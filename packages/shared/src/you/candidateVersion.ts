// YOU candidate-version machinery (W5A — docs/you/CONTRACTS.md "Wave-5
// contract freeze (v5)", frozen CandidateVersion).
//
// Applying a validated EditChangeSet to a parent version (the subject
// artifact root, or an earlier candidate) produces an immutable
// CandidateVersion — the artifact-lineage node (parentVersionId ->
// candidate). Candidate content is content-addressed on the wave-2
// content-store abstraction (contentRef + sha-256 contentHash) and NEVER
// inlined in records or events. The v1 solution-version patch flow stays
// untouched; this is the wave-5 namespaced artifact lineage.
//
// The deterministic fixture application (fixtureApplyEditChangeSet) seeds
// the candidate bytes from the change set + the parent + the ordered ops,
// so candidate content is a deterministic function of its lineage. Fixture
// candidates stay `simulated: true` (truth law).
//
// Fixture laws (docs/you/FIXTURES.md) apply verbatim: injected clock/rng,
// no ambient nondeterminism, byte-identical replays.

import type { CandidateVersion, EditChangeSet, EditChangeSetOp, OpaqueId } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { EvidenceContentStore } from "./evidenceStore.js";
import type { YouIdFactory } from "./ids.js";
import { createDeterministicRng, seedFromString } from "./rng.js";
import { deepFreeze } from "./serialize.js";

/** Fixed synthetic candidate content size (fixture definition). */
export const FIXTURE_CANDIDATE_BYTE_LENGTH = 2048;

/**
 * Deterministic candidate seed text: the change set, the parent version
 * and every ordered op contribute (id, kind, payloadHash) — part of the
 * frozen fixture definition.
 */
export function fixtureCandidateSeedText(input: {
  readonly changeSetId: OpaqueId;
  readonly parentVersionId: OpaqueId;
  readonly parentContentHash: string;
  readonly ops: readonly EditChangeSetOp[];
}): string {
  const opFacts = input.ops.map((op) => `${op.id}:${op.kind}:${op.payloadHash}`);
  return ["you-w5a-fixture-candidate", input.changeSetId, input.parentVersionId, input.parentContentHash, ...opFacts].join(":");
}

/**
 * Deterministic synthetic candidate bytes (FIXTURES.md laws 1-2, 7). The
 * RNG consumption order (4 bytes per nextUint32, little-endian) mirrors
 * the wave-2/wave-3/wave-4 synthesizers.
 */
export function synthesizeFixtureCandidateBytes(rng: { nextUint32(): number }): Uint8Array {
  const bytes = new Uint8Array(FIXTURE_CANDIDATE_BYTE_LENGTH);
  for (let offset = 0; offset < FIXTURE_CANDIDATE_BYTE_LENGTH; offset += 4) {
    const word = rng.nextUint32();
    const remaining = Math.min(4, FIXTURE_CANDIDATE_BYTE_LENGTH - offset);
    for (let byteIndex = 0; byteIndex < remaining; byteIndex += 1) {
      bytes[offset + byteIndex] = (word >>> (byteIndex * 8)) & 0xff;
    }
  }
  return bytes;
}

export interface CandidateApplicationDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
  readonly store: EvidenceContentStore;
}

/**
 * Deterministic fixture application: synthesizes the candidate content
 * (seeded from the change set + parent + ordered ops), stores it through
 * the wave-2 content store and returns the immutable, deep-frozen
 * CandidateVersion (`simulated: true` — truth law).
 */
export function fixtureApplyEditChangeSet(
  input: {
    readonly changeSet: EditChangeSet;
    readonly parentVersionId: OpaqueId;
    readonly parentContentHash: string;
  },
  deps: CandidateApplicationDeps,
): CandidateVersion {
  const rng = createDeterministicRng(
    seedFromString(
      fixtureCandidateSeedText({
        changeSetId: input.changeSet.id,
        parentVersionId: input.parentVersionId,
        parentContentHash: input.parentContentHash,
        ops: input.changeSet.ops,
      }),
    ),
  );
  const bytes = synthesizeFixtureCandidateBytes(rng);
  const binding = deps.store.put(bytes);
  return deepFreeze({
    id: deps.ids.next("candidate-version"),
    changeSetId: input.changeSet.id,
    parentVersionId: input.parentVersionId,
    contentRef: binding.contentRef,
    contentHash: binding.contentHash,
    proposedAt: deps.clock.now(),
    simulated: true,
  });
}
