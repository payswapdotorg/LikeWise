// YOU provider-neutral reconstruction job machinery (W3A —
// docs/you/CONTRACTS.md "Reconstruction is provider-neutral and
// method-plural: explicit geometry and neural appearance are
// complementary, and no single reconstruction method is canonical.
// Reconstruction jobs are typed specs (method, target domains, evidence
// bindings) with typed results; effort/latency/cost observations are
// structured fields with explicit not-measured markers — never invented
// numbers. Fixture reconstructions stay `simulated: true` and follow the
// same job machinery as real ones — no parallel mock path").
//
// Job lifecycle (state truth = the twin application service; this module
// owns the pure spec construction, the transition table and the
// deterministic fixture reconstruction):
//   queued -> running | failed
//   running -> completed | failed
//   completed / failed are terminal.
//
// Fixture support matrix (frozen fixture definition): the fixture
// reconstruction adapter declares which method/domain combinations it can
// produce. Anything else — including unknown methods and the "voice"
// domain (audio capture material, not reconstruction output) — is
// UNSUPPORTED and maps to the typed YOU_RECONSTRUCTION_UNSUPPORTED error
// at submit time. Real adapters (Worker C lane) register behind the same
// seam; the fixture never silently falls back to another method.

import type {
  AuthorType,
  HtirDomainBlock,
  HtirDomainKind,
  OpaqueId,
  ReconstructionJobResult,
  ReconstructionJobSpec,
  ReconstructionJobStatus,
  ReconstructionMethod,
  TwinEvidenceBinding,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { createHtirDomainBlock } from "./htirDomain.js";
import { evidenceHashesOfBindings } from "./twinBinding.js";
import { seedFromString, type YouRng } from "./rng.js";
import { createDeterministicRng } from "./rng.js";
import { deepFreeze } from "./serialize.js";
import type { EvidenceContentStore } from "./evidenceStore.js";

/** Legal job status transitions. */
export const RECONSTRUCTION_JOB_TRANSITIONS: Readonly<
  Record<ReconstructionJobStatus, readonly ReconstructionJobStatus[]>
> = {
  queued: ["running", "failed"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

export function isLegalReconstructionJobTransition(from: ReconstructionJobStatus, to: ReconstructionJobStatus): boolean {
  return RECONSTRUCTION_JOB_TRANSITIONS[from].includes(to);
}

export function isTerminalReconstructionJobStatus(status: ReconstructionJobStatus): boolean {
  return RECONSTRUCTION_JOB_TRANSITIONS[status].length === 0;
}

/**
 * Fixture reconstruction support matrix (frozen fixture definition):
 * method -> supported target domains. "hybrid" is the union of the
 * explicit-geometry and neural-appearance sets.
 */
export const FIXTURE_RECONSTRUCTION_SUPPORT: Readonly<Record<string, readonly HtirDomainKind[]>> = {
  "explicit-geometry": [
    "articulation-blendshapes",
    "face-hands",
    "geometry-skeleton",
    "identity-binding",
    "morphology",
    "motion-profile",
  ],
  "neural-appearance": [
    "appearance-materials",
    "hair",
    "identity-binding",
    "morphology",
    "neural-appearance",
    "style",
  ],
  hybrid: [
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
  ],
};

/** Returns the unsupported domains of a method/target combination ([] when supported). */
export function unsupportedReconstructionDomains(
  method: ReconstructionMethod,
  targetDomains: readonly HtirDomainKind[],
): HtirDomainKind[] {
  const supported = FIXTURE_RECONSTRUCTION_SUPPORT[method];
  if (supported === undefined) {
    return [...targetDomains].sort();
  }
  return targetDomains.filter((domain) => !supported.includes(domain)).sort();
}

export interface ReconstructionJobSpecIntake {
  readonly twinVersionId: OpaqueId;
  readonly method: ReconstructionMethod;
  readonly targetDomains: readonly HtirDomainKind[];
  readonly evidenceBindings: readonly TwinEvidenceBinding[];
  readonly provenanceSource: string;
  readonly generator?: AuthorType;
}

export type ReconstructionJobSpecRefusal =
  | { readonly ok: false; readonly code: "empty-target-domains"; readonly detail: string }
  | { readonly ok: false; readonly code: "unsupported-combination"; readonly detail: string; readonly unsupportedDomains: HtirDomainKind[] };

/** Creates the immutable, deep-frozen ReconstructionJobSpec (status is service state). */
export function createReconstructionJobSpec(
  intake: ReconstructionJobSpecIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): { readonly ok: true; readonly spec: ReconstructionJobSpec } | ReconstructionJobSpecRefusal {
  if (intake.targetDomains.length === 0) {
    return { ok: false, code: "empty-target-domains", detail: "a reconstruction job requires at least one target domain" };
  }
  const unsupported = unsupportedReconstructionDomains(intake.method, intake.targetDomains);
  if (unsupported.length > 0) {
    return {
      ok: false,
      code: "unsupported-combination",
      detail: `method "${intake.method}" does not support target domain(s): ${unsupported.join(", ")}`,
      unsupportedDomains: unsupported,
    };
  }
  const createdAt = deps.clock.now();
  const spec: ReconstructionJobSpec = deepFreeze({
    id: deps.ids.next("recon-job"),
    twinVersionId: intake.twinVersionId,
    method: intake.method,
    targetDomains: Object.freeze([...intake.targetDomains].sort()),
    evidenceBindings: Object.freeze([...intake.evidenceBindings]),
    createdAt,
  });
  return { ok: true, spec };
}

/**
 * Honest effort observations (truth law): every effort/latency/cost field
 * carries an explicit not-measured marker; nothing is invented. Only the
 * block/binding counts are real observations.
 */
export function notMeasuredEffortObservations(
  producedBlockCount: number,
  evidenceBindingCount: number,
): Readonly<Record<string, string | number | boolean>> {
  return deepFreeze({
    "computeEffort.measured": false,
    computeEffort: "not-measured (simulated)",
    "latencyMs.measured": false,
    latencyMs: "not-measured (simulated)",
    "costUnits.measured": false,
    costUnits: "not-measured (simulated)",
    domainBlocksProduced: producedBlockCount,
    evidenceBindingsProcessed: evidenceBindingCount,
    simulated: true,
  });
}

export interface FixtureReconstructionInput {
  readonly spec: ReconstructionJobSpec;
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
  readonly store: EvidenceContentStore;
}

/**
 * Deterministic fixture reconstruction: produces one HtirDomainBlock per
 * target domain (sorted order — part of the frozen fixture definition).
 * The per-job RNG seed is derived from the spec id, method, target
 * domains AND the bound evidence content hashes, so reconstruction
 * output is a deterministic function of the job and its evidence —
 * different evidence produces different output, same evidence always
 * produces byte-identical blocks. Confidence is the deterministic
 * fixture value derived from each block's stored content hash.
 */
export function fixtureReconstruct(input: FixtureReconstructionInput): readonly HtirDomainBlock[] {
  const { spec } = input;
  const evidenceHashes = evidenceHashesOfBindings(spec.evidenceBindings);
  const seedText = [
    "you-w3a-fixture-reconstruction",
    spec.id,
    spec.method,
    ...spec.targetDomains,
    ...evidenceHashes,
  ].join(":");
  const rng: YouRng = createDeterministicRng(seedFromString(seedText));
  const blocks: HtirDomainBlock[] = [];
  for (const domain of [...spec.targetDomains].sort()) {
    blocks.push(
      createHtirDomainBlock(
        {
          domain,
          rng,
          provenanceSource: `fixture:reconstruction:${spec.id}`,
          generator: "fixture",
          lineage: [spec.id, spec.twinVersionId],
          simulated: true,
        },
        { clock: input.clock, ids: input.ids, store: input.store },
      ),
    );
  }
  return Object.freeze(blocks);
}

/** Builds the terminal ReconstructionJobResult (completed or failed). */
export function buildReconstructionJobResult(
  input: {
    readonly spec: ReconstructionJobSpec;
    readonly status: "completed" | "failed";
    readonly producedDomainBlocks: readonly HtirDomainBlock[];
    readonly failureReason?: string;
    readonly completedAt: string;
  },
): ReconstructionJobResult {
  const observations: Record<string, string | number | boolean> = {
    ...notMeasuredEffortObservations(input.producedDomainBlocks.length, input.spec.evidenceBindings.length),
  };
  if (input.status === "failed") {
    observations["failureReason"] = input.failureReason ?? "unspecified";
  }
  return deepFreeze({
    jobId: input.spec.id,
    status: input.status,
    producedDomainBlocks: Object.freeze([...input.producedDomainBlocks]),
    effortObservations: observations,
    completedAt: input.completedAt,
    simulated: true,
  });
}
