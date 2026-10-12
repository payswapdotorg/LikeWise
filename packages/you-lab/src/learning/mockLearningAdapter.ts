// Deterministic mock learning adapter (W6C).
//
// Implements the provider-neutral learning seam against pure mock
// candidates. The mock transforms the invocation signal's evidence into
// LearningRecord-shaped candidate results — content-addressed learned
// content (contentRef + contentHash = sha-256 of the canonical payload
// bytes) — with seeded degradation knobs (evidence ingestion dropout,
// learned-value drift, learning-domain folding) so the learning benchmark
// can score different fidelity classes across the order's learner classes.
// PURE MOCKS (technologyId: null): their parameters are fixture inputs
// exercising the seam, NOT assessments of any real learning technology. No
// clock, no Math.random, no network — all degradation is derived from
// hash-keyed streams (unitFrom), so every value is a pure function of
// (adapterId, requestId, evidenceRef).

import { canonicalJson, roundTo } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import {
  assertLearningRequestSupported,
  encodeLearningPayload,
  intendedLearningKeyAt,
  intendedLearningValueAt,
  neutralLearningCandidateId,
  neutralLearningContentRef,
  notMeasuredLearningEffortFields,
  sha256Hex,
  type LearnedContentEntry,
  type LearningAdapter,
  type LearningAdapterProfile,
  type NeutralLearningCandidate,
  type NeutralLearningOutput,
  type NeutralLearningRequest,
  type NeutralLearnerClass,
  type NeutralLearningScope,
  type NeutralLearningSignalKind,
} from "./learningAdapterSeam.js";

const GENERATOR = "you-lab-mock-learning-adapter/1";

/** Mock degradation configuration (fixture input, not a technology assessment). */
export interface MockLearningConfig {
  readonly id: string;
  readonly learnerClass: NeutralLearnerClass;
  readonly supportedSignalKinds: readonly NeutralLearningSignalKind[];
  readonly supportedScopes: readonly NeutralLearningScope[];
  /** Seeded per-evidence ingestion probability (0..1): fraction of the signal's evidence actually learned from. */
  readonly evidenceIngestRate: number;
  /** Seeded relative drift applied to learned values (0..1). */
  readonly valueDrift: number;
  /** Whether distinct learning key domains survive (false: every entry folds into one over-general baseline). */
  readonly preservesDomains: boolean;
}

export function createMockLearningAdapter(config: MockLearningConfig): LearningAdapter {
  const profile: LearningAdapterProfile = {
    id: config.id,
    technologyId: null,
    learnerClass: config.learnerClass,
    supportedSignalKinds: config.supportedSignalKinds,
    supportedScopes: config.supportedScopes,
    adapterKind: "mock",
    deterministic: true,
    determinismNote: "pure mock: all degradation is seed-derived (unitFrom keyed streams); byte-identical replay from the seed",
    productionEligible: null,
    eligibilityBasis: "pure mock candidate — no registry backing, no eligibility claim",
  };
  return {
    profile,
    learn(request: NeutralLearningRequest): NeutralLearningOutput {
      assertLearningRequestSupported(profile, request);
      const entries = buildLearnedEntries(config, request);
      const candidates: NeutralLearningCandidate[] = [];
      const payloads: Record<string, Record<string, unknown>> = {};
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        if (!entry) continue;
        const payload = encodeLearningPayload(entry, request);
        const payloadHash = sha256Hex(canonicalJson(payload));
        const candidateId = neutralLearningCandidateId(config.id, request.requestId, entry.evidenceRef);
        candidates.push({
          id: candidateId,
          signalId: request.signal.id,
          status: "candidate",
          scope: request.scope,
          contentRef: neutralLearningContentRef(config.id, request.requestId, index),
          contentHash: payloadHash,
          rights: request.rights, // RIGHTS LAW: threaded from the injected context — never minted
          validatedAt: request.submittedAt,
          supersededById: null,
          simulated: true,
        });
        payloads[candidateId] = payload;
      }
      const warnings: string[] = [];
      if (!config.preservesDomains) {
        warnings.push("learning key domains folded into a single organization baseline (over-generalization)");
      }
      const dropped = request.signal.evidenceRefs.length - entries.length;
      if (dropped > 0) {
        warnings.push(`${dropped} evidence ref(s) not ingested by the mock learner (seeded coverage loss)`);
      }
      return {
        adapterId: config.id,
        requestId: request.requestId,
        candidates,
        payloads,
        learnedContentHash: learnedContentDigest(entries),
        warnings: [...new Set(warnings)].sort(),
        effort: notMeasuredLearningEffortFields(),
        simulated: true,
      };
    },
  };
}

/** Build the degraded learned-content entries for (config, request). */
function buildLearnedEntries(config: MockLearningConfig, request: NeutralLearningRequest): LearnedContentEntry[] {
  const entries: LearnedContentEntry[] = [];
  for (let index = 0; index < request.signal.evidenceRefs.length; index++) {
    const evidenceRef = request.signal.evidenceRefs[index];
    if (!evidenceRef) continue;
    const ingested = unitFrom(config.id, request.requestId, evidenceRef, "ingest") < config.evidenceIngestRate;
    if (!ingested) continue;
    const drift = 1 + (unitFrom(config.id, request.requestId, evidenceRef, "drift") * 2 - 1) * config.valueDrift;
    entries.push({
      key: config.preservesDomains ? intendedLearningKeyAt(index) : "organization-baseline",
      value: roundTo(intendedLearningValueAt(evidenceRef) * drift, 4),
      evidenceRef,
    });
  }
  return entries;
}

/** Canonical-JSON digest over the learned-content entries (deterministic). */
function learnedContentDigest(entries: readonly LearnedContentEntry[]): string {
  return sha256Hex(
    canonicalJson(entries.map((entry) => ({ key: entry.key, value: entry.value, evidenceRef: entry.evidenceRef }))),
  );
}

/** Generator label for provenance wiring (honest mock scope). */
export function mockLearningGenerator(): string {
  return GENERATOR;
}
