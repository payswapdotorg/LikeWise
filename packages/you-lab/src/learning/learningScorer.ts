// Deterministic learning-fidelity scorer (W6C).
//
// The learning-fidelity score is a COMPUTED fixture objective (deterministic
// arithmetic over the intended learned content — the canonical model applied
// to the invocation signal's evidence — and the adapter's candidate records)
// — it is explicitly not a user study, not a live measurement, and not a
// scientific claim about any real learning technology. Effort, latency and
// cost are recorded by the runner as "not-measured (simulated)" markers;
// they are never faked here.

import { canonicalJson, roundTo } from "../determinism.js";
import {
  decodeLearnedContent,
  intendedLearningKeyAt,
  intendedLearningValueAt,
  sha256Hex,
  type NeutralLearningOutput,
  type NeutralLearningRequest,
  type NeutralLearningSignal,
} from "./learningAdapterSeam.js";

/** Score weights (authored fixture definition — asserted in tests; the W5C 0.6/0.2/0.2 shape). */
export const LEARNING_FIDELITY_WEIGHTS = { signalCoverage: 0.6, preferenceFaithfulness: 0.2, recordIntegrity: 0.2 } as const;

export const SCORER_LEARNING_VERSION =
  "you-lab-learning-scorer/1 (deterministic fixture objective — computed, not measured)";

/** One intended learned-content entry (the fixture objective over an evidence ref). */
export interface IntendedLearningEntry {
  /** Learning key domain (e.g. "preferred-tool"). */
  readonly key: string;
  /** Canonical learned value for the evidence ref (deterministic model, [0.5, 1.0]). */
  readonly value: number;
  /** The evidence ref the entry is intended to be learned from. */
  readonly evidenceRef: string;
}

export interface LearningFidelityParts {
  /** Fraction of the invocation signal's evidence refs backing at least one candidate record. */
  readonly signalCoverage: number;
  /** Fraction of learned key/value pairs recovered exactly (key match + value match, half credit each). */
  readonly preferenceFaithfulness: number;
  /** Fraction of candidate records that are structurally valid content-addressed v6-shaped results. */
  readonly recordIntegrity: number;
  readonly fidelityScore: number;
}

/**
 * The intended learned content for an invocation signal: one entry per
 * evidence ref under the canonical synthetic learning model (the same
 * seeded model simulated adapters derive from — computed, not measured).
 */
export function intendedLearningForSignal(signal: NeutralLearningSignal): readonly IntendedLearningEntry[] {
  return signal.evidenceRefs.map((evidenceRef, index) => ({
    key: intendedLearningKeyAt(index),
    value: intendedLearningValueAt(evidenceRef),
    evidenceRef,
  }));
}

/** Deterministic digest over the intended learned content (golden fixture objective). */
export function intendedLearningDigest(signal: NeutralLearningSignal): string {
  return sha256Hex(
    canonicalJson(
      intendedLearningForSignal(signal).map((entry) => ({
        key: entry.key,
        value: entry.value,
        evidenceRef: entry.evidenceRef,
      })),
    ),
  );
}

/**
 * Score a learning invocation: compare the adapter's candidate records
 * against the intended learned content (the canonical model applied to the
 * same signal), and verify every produced record is a structurally valid
 * content-addressed v6 shape (contentHash binds the payload; rights
 * threaded from the injected context).
 */
export function scoreLearningFidelity(
  request: NeutralLearningRequest,
  output: NeutralLearningOutput,
): LearningFidelityParts {
  const intended = intendedLearningForSignal(request.signal);
  const intendedByRef = new Map(intended.map((entry) => [entry.evidenceRef, entry]));

  // Signal coverage: fraction of evidence refs backing at least one candidate.
  const coveredRefs = new Set(
    output.candidates.map((candidate) => decodeLearnedContent(output.payloads[candidate.id] ?? {}).evidenceRef),
  );
  let coveredCount = 0;
  for (const entry of intended) {
    if (coveredRefs.has(entry.evidenceRef)) coveredCount += 1;
  }
  const signalCoverage = intended.length === 0 ? 1 : coveredCount / intended.length;

  // Preference faithfulness: over candidates matched to an intended entry by
  // evidence ref, half credit for the key match and half for the value match.
  let compared = 0;
  let credit = 0;
  for (const candidate of output.candidates) {
    const entry = decodeLearnedContent(output.payloads[candidate.id] ?? {});
    const intendedEntry = intendedByRef.get(entry.evidenceRef);
    if (!intendedEntry) continue;
    compared += 1;
    if (entry.key === intendedEntry.key) credit += 0.5;
    if (entry.value === intendedEntry.value) credit += 0.5;
  }
  const preferenceFaithfulness = compared === 0 ? 1 : credit / compared;

  // Record integrity: fraction of candidates that are structurally valid
  // content-addressed v6-shaped candidate records (hash binds the payload,
  // refs address the content store, rights threaded from the injected
  // context, status/scope/simulated laws hold).
  let valid = 0;
  for (const candidate of output.candidates) {
    const payload = output.payloads[candidate.id];
    if (!payload) continue;
    const validShape =
      /^[0-9a-f]{64}$/.test(candidate.contentHash) &&
      candidate.contentHash === sha256Hex(canonicalJson(payload)) &&
      candidate.contentRef.startsWith("content-store://you-lab/learning/") &&
      candidate.status === "candidate" &&
      candidate.supersededById === null &&
      candidate.signalId === request.signal.id &&
      candidate.scope === request.scope &&
      canonicalJson(candidate.rights) === canonicalJson(request.rights) &&
      candidate.simulated === true;
    if (validShape) valid += 1;
  }
  const recordIntegrity = output.candidates.length === 0 ? 1 : valid / output.candidates.length;

  return {
    signalCoverage: roundTo(signalCoverage, 4),
    preferenceFaithfulness: roundTo(preferenceFaithfulness, 4),
    recordIntegrity: roundTo(recordIntegrity, 4),
    fidelityScore: roundTo(
      LEARNING_FIDELITY_WEIGHTS.signalCoverage * signalCoverage +
        LEARNING_FIDELITY_WEIGHTS.preferenceFaithfulness * preferenceFaithfulness +
        LEARNING_FIDELITY_WEIGHTS.recordIntegrity * recordIntegrity,
      4,
    ),
  };
}
