// Deterministic soul response-fidelity scorer (W7C).
//
// The soul fidelity score is a COMPUTED fixture objective (deterministic
// arithmetic over the intended response content — the canonical
// route-dependent model applied to the invocation's routed prompt context —
// and the adapter's response records) — it is explicitly not a user study,
// not a live measurement, and not a scientific claim about any real LLM/VLM
// provider. Effort, latency and cost are recorded by the runner as
// "not-measured (simulated)" markers; they are never faked here.

import { canonicalJson, roundTo } from "../determinism.js";
import {
  decodeResponseContent,
  intendedResponseTopicAt,
  intendedResponseValueAt,
  sha256Hex,
  type NeutralSoulModality,
  type NeutralSoulOutput,
  type NeutralSoulRequest,
  type NeutralSoulRoutingProfile,
} from "./soulAdapterSeam.js";

/** Score weights (authored fixture definition — asserted in tests; the W5C/W6C 0.6/0.2/0.2 shape). */
export const SOUL_FIDELITY_WEIGHTS = { contextCoverage: 0.6, responseFaithfulness: 0.2, recordIntegrity: 0.2 } as const;

export const SCORER_SOUL_VERSION =
  "you-lab-soul-scorer/1 (deterministic fixture objective — computed, not measured)";

/** One intended response-content entry (the fixture objective over a context ref under the requested route). */
export interface IntendedResponseEntry {
  /** Response topic domain (e.g. "answer"). */
  readonly topic: string;
  /** Canonical response value for the context ref under the requested route (deterministic model). */
  readonly value: number;
  /** The context ref the entry responds to. */
  readonly contextRef: string;
  /** The intended output modality for the entry's index (requested modalities cycle). */
  readonly modality: NeutralSoulModality;
}

/**
 * The intended response content for a routed prompt context: one entry per
 * context ref under the canonical route-dependent synthetic model (the same
 * seeded model simulated adapters derive from — computed, not measured).
 */
export function intendedResponsesForPrompt(prompt: {
  readonly routingProfile: NeutralSoulRoutingProfile;
  readonly contextRefs: readonly string[];
  readonly requestedModalities: readonly NeutralSoulModality[];
}): readonly IntendedResponseEntry[] {
  if (prompt.requestedModalities.length === 0) {
    throw new Error("intendedResponsesForPrompt: a soul invocation requests at least one modality");
  }
  return prompt.contextRefs.map((contextRef, index) => ({
    topic: intendedResponseTopicAt(index),
    value: intendedResponseValueAt(contextRef, prompt.routingProfile),
    contextRef,
    modality: prompt.requestedModalities[index % prompt.requestedModalities.length] ?? prompt.requestedModalities[0]!,
  }));
}

/** Deterministic digest over the intended response content (golden fixture objective). */
export function intendedResponseDigest(prompt: {
  readonly routingProfile: NeutralSoulRoutingProfile;
  readonly contextRefs: readonly string[];
  readonly requestedModalities: readonly NeutralSoulModality[];
}): string {
  return sha256Hex(
    canonicalJson(
      intendedResponsesForPrompt(prompt).map((entry) => ({
        topic: entry.topic,
        value: entry.value,
        contextRef: entry.contextRef,
        modality: entry.modality,
      })),
    ),
  );
}

export interface SoulFidelityParts {
  /** Fraction of the prompt's context refs addressed by at least one response record. */
  readonly contextCoverage: number;
  /**
   * Fraction of response content recovered exactly over records matched to
   * an intended entry by context ref (thirds: topic match, value match,
   * modality match).
   */
  readonly responseFaithfulness: number;
  /** Fraction of response records that are structurally valid content-addressed v7-shaped results. */
  readonly recordIntegrity: number;
  readonly fidelityScore: number;
}

/**
 * Score a soul invocation: compare the adapter's response records against
 * the intended response content (the canonical route-dependent model
 * applied to the same routed prompt), and verify every produced record is a
 * structurally valid content-addressed shape (contentHash binds the payload;
 * the record carries a valid frozen v7 routing literal and responds in a
 * requested modality).
 */
export function scoreSoulResponse(
  request: NeutralSoulRequest,
  output: NeutralSoulOutput,
): SoulFidelityParts {
  const intended = intendedResponsesForPrompt(request.prompt);
  const intendedByRef = new Map(intended.map((entry) => [entry.contextRef, entry]));

  // Context coverage: fraction of context refs addressed by at least one record.
  const coveredRefs = new Set(
    output.records.map((record) => decodeResponseContent(output.payloads[record.id] ?? {}).contextRef),
  );
  let coveredCount = 0;
  for (const entry of intended) {
    if (coveredRefs.has(entry.contextRef)) coveredCount += 1;
  }
  const contextCoverage = intended.length === 0 ? 1 : coveredCount / intended.length;

  // Response faithfulness: over records matched to an intended entry by
  // context ref, thirds credit for topic match, value match and modality
  // match (the W6C half/half precedent extended to the modality dimension).
  let compared = 0;
  let credit = 0;
  for (const record of output.records) {
    const entry = decodeResponseContent(output.payloads[record.id] ?? {});
    const intendedEntry = intendedByRef.get(entry.contextRef);
    if (!intendedEntry) continue;
    compared += 1;
    if (entry.topic === intendedEntry.topic) credit += 1 / 3;
    if (entry.value === intendedEntry.value) credit += 1 / 3;
    if (entry.modality === intendedEntry.modality) credit += 1 / 3;
  }
  const responseFaithfulness = compared === 0 ? 1 : credit / compared;

  // Record integrity: fraction of records that are structurally valid
  // content-addressed v7-shaped response records (hash binds the payload,
  // refs address the content store, ids thread the request, a valid frozen
  // v7 routing literal is carried, the modality was requested, simulated
  // law holds).
  let valid = 0;
  for (const record of output.records) {
    const payload = output.payloads[record.id];
    if (!payload) continue;
    const validShape =
      /^you_soul-response_[0-9a-f]{16}$/.test(record.id) &&
      /^[0-9a-f]{64}$/.test(record.contentHash) &&
      record.contentHash === sha256Hex(canonicalJson(payload)) &&
      record.contentRef.startsWith("content-store://you-lab/soul/") &&
      record.bindingId === request.binding.id &&
      record.requestId === request.requestId &&
      (record.routingProfile === "system-one" || record.routingProfile === "system-two") &&
      request.prompt.requestedModalities.includes(record.modality) &&
      record.simulated === true;
    if (validShape) valid += 1;
  }
  const recordIntegrity = output.records.length === 0 ? 1 : valid / output.records.length;

  return {
    contextCoverage: roundTo(contextCoverage, 4),
    responseFaithfulness: roundTo(responseFaithfulness, 4),
    recordIntegrity: roundTo(recordIntegrity, 4),
    fidelityScore: roundTo(
      SOUL_FIDELITY_WEIGHTS.contextCoverage * contextCoverage +
        SOUL_FIDELITY_WEIGHTS.responseFaithfulness * responseFaithfulness +
        SOUL_FIDELITY_WEIGHTS.recordIntegrity * recordIntegrity,
      4,
    ),
  };
}
