// YOU render job machinery (W4A — docs/you/CONTRACTS.md "Performance /
// render", frozen v4 contracts).
//
// Render jobs turn performances into reviewed artifacts. The state truth
// is the performance/render application service (Worker A lane); adapters
// (Worker C lane, W4C) register render methods behind a registry seam and
// are never authorities. This module owns the pure machinery: the legal
// status transition table, spec construction/validation, the fixture
// support matrix (frozen fixture definition), deterministic fixture
// artifact synthesis and the honest terminal result builder.
//
// Job lifecycle (the W3A reconstruction precedent under identical
// phrasing — "queued → running → completed | failed, terminals locked"):
//   queued   -> running | failed
//   running  -> completed | failed
//   completed / failed are terminal.
// Illegal transitions are typed YOU_INVALID_STATE refusals at the service
// (no state change); an unregistered method or an unsupported
// method/outputKinds combination is a typed YOU_RENDER_UNSUPPORTED
// refusal — never a silent fallback to another method.
//
// Truth law: fixture artifacts stay `simulated: true`; effort/latency/
// cost observations carry explicit not-measured markers — never invented
// numbers. Artifact content is NEVER inlined: `contentRef` + sha-256
// `contentHash` on the wave-2 content-store abstraction.

import type {
  OpaqueId,
  Performance,
  RenderArtifact,
  RenderJobResult,
  RenderJobSpec,
  RenderJobStatus,
  RenderMethod,
  RenderOutputKind,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import type { EvidenceContentStore } from "./evidenceStore.js";
import type { ParameterRecord } from "./performanceTemplate.js";
import { validatePlainParameterRecord } from "./performanceTemplate.js";
import { createDeterministicRng, seedFromString, type YouRng } from "./rng.js";
import { deepFreeze } from "./serialize.js";

/** Legal render job status transitions (terminals locked). */
export const RENDER_JOB_TRANSITIONS: Readonly<Record<RenderJobStatus, readonly RenderJobStatus[]>> = {
  queued: ["running", "failed"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

export function isLegalRenderJobTransition(from: RenderJobStatus, to: RenderJobStatus): boolean {
  return RENDER_JOB_TRANSITIONS[from].includes(to);
}

export function isTerminalRenderJobStatus(status: RenderJobStatus): boolean {
  return RENDER_JOB_TRANSITIONS[status].length === 0;
}

/**
 * Fixture render support matrix (frozen fixture definition): method ->
 * supported output kinds. A video render also emits a poster image; all
 * other registered methods produce exactly their natural output kind.
 * Real adapters (Worker C lane) register behind the same seam; the
 * fixture never silently falls back to another method.
 */
export const FIXTURE_RENDER_SUPPORT: Readonly<Record<string, readonly RenderOutputKind[]>> = {
  "3d-render": ["mesh"],
  "image-render": ["image"],
  "motion-extraction": ["animation"],
  retargeting: ["animation"],
  "video-render": ["video", "image"],
};

/** Returns the unsupported output kinds of a registered method ([] when supported). */
export function unsupportedRenderOutputKinds(
  method: RenderMethod,
  outputKinds: readonly RenderOutputKind[],
  supportedOutputKinds: readonly RenderOutputKind[],
): RenderOutputKind[] {
  return outputKinds.filter((kind) => !supportedOutputKinds.includes(kind)).sort();
}

export interface RenderJobSpecIntake {
  readonly performanceId: OpaqueId;
  readonly method: RenderMethod;
  readonly outputKinds: readonly RenderOutputKind[];
  readonly parameters?: ParameterRecord;
}

export type RenderJobSpecRefusalCode =
  | "empty-output-kinds"
  | "unregistered-method"
  | "unsupported-output-kinds"
  | "invalid-parameters";

export type RenderJobSpecRefusal =
  | { readonly ok: false; readonly code: "empty-output-kinds"; readonly detail: string }
  | { readonly ok: false; readonly code: "unregistered-method"; readonly detail: string; readonly method: RenderMethod }
  | {
      readonly ok: false;
      readonly code: "unsupported-output-kinds";
      readonly detail: string;
      readonly method: RenderMethod;
      readonly unsupportedKinds: RenderOutputKind[];
    }
  | { readonly ok: false; readonly code: "invalid-parameters"; readonly detail: string };

/**
 * Creates the immutable, deep-frozen RenderJobSpec (status is service
 * state). The method must be registered with its support record resolved
 * by the caller (registry seam); unsupported combinations are typed
 * refusals, never a fallback. outputKinds are canonicalized to the
 * sorted unique set (FIXTURES.md law 4: stable ordering).
 */
export function createRenderJobSpec(
  intake: RenderJobSpecIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
  methodSupport: { readonly registered: boolean; readonly supportedOutputKinds: readonly RenderOutputKind[] },
): { readonly ok: true; readonly spec: RenderJobSpec } | RenderJobSpecRefusal {
  if (!methodSupport.registered) {
    return {
      ok: false,
      code: "unregistered-method",
      detail: `render method "${intake.method}" is not registered`,
      method: intake.method,
    };
  }
  if (intake.outputKinds.length === 0) {
    return { ok: false, code: "empty-output-kinds", detail: "a render job requires at least one output kind" };
  }
  const unsupported = unsupportedRenderOutputKinds(intake.method, intake.outputKinds, methodSupport.supportedOutputKinds);
  if (unsupported.length > 0) {
    return {
      ok: false,
      code: "unsupported-output-kinds",
      detail: `render method "${intake.method}" does not support output kind(s): ${unsupported.join(", ")}`,
      method: intake.method,
      unsupportedKinds: unsupported,
    };
  }
  const parameters = intake.parameters ?? {};
  const parameterReason = validatePlainParameterRecord(parameters);
  if (parameterReason !== null) {
    return { ok: false, code: "invalid-parameters", detail: `invalid render parameters: ${parameterReason}` };
  }
  const createdAt = deps.clock.now();
  const spec: RenderJobSpec = deepFreeze({
    id: deps.ids.next("render-job"),
    performanceId: intake.performanceId,
    method: intake.method,
    outputKinds: Object.freeze([...new Set(intake.outputKinds)].sort()),
    parameters: deepFreeze({ ...parameters }),
    createdAt,
  });
  return { ok: true, spec };
}

/**
 * Honest effort observations (truth law): every effort/latency/cost field
 * carries an explicit not-measured marker; nothing is invented. Only the
 * artifact/cue counts are real observations.
 */
export function notMeasuredRenderEffortObservations(
  producedArtifactCount: number,
  timelineCueCount: number,
): Readonly<Record<string, string | number | boolean>> {
  return deepFreeze({
    "computeEffort.measured": false,
    computeEffort: "not-measured (simulated)",
    "latencyMs.measured": false,
    latencyMs: "not-measured (simulated)",
    "costUnits.measured": false,
    costUnits: "not-measured (simulated)",
    artifactsProduced: producedArtifactCount,
    timelineCuesProcessed: timelineCueCount,
    simulated: true,
  });
}

/**
 * Fixed synthetic artifact byte sizes per output kind (fixture
 * definition — part of the frozen fixture contract; changing any size
 * changes every golden expectation and requires a new fixture version).
 */
export const FIXTURE_RENDER_KIND_BYTE_LENGTHS: Readonly<Record<string, number>> = {
  animation: 4096,
  image: 2048,
  mesh: 3072,
  video: 4096,
};

/** Default size for output-kind extensions (fixture definition). */
export const FIXTURE_RENDER_KIND_DEFAULT_BYTE_LENGTH = 512;

export function fixtureRenderKindByteLength(kind: RenderOutputKind): number {
  return FIXTURE_RENDER_KIND_BYTE_LENGTHS[kind] ?? FIXTURE_RENDER_KIND_DEFAULT_BYTE_LENGTH;
}

/**
 * Deterministic synthetic render artifact bytes (FIXTURES.md laws 1-2, 7).
 * The RNG consumption order (4 bytes per nextUint32, little-endian) is
 * part of the frozen fixture definition and mirrors the wave-2/wave-3
 * synthesizers.
 */
export function synthesizeFixtureRenderBytes(rng: YouRng, kind: RenderOutputKind): Uint8Array {
  const length = fixtureRenderKindByteLength(kind);
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

export interface FixtureRenderInput {
  readonly spec: RenderJobSpec;
  readonly performance: Performance;
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
  readonly store: EvidenceContentStore;
}

/**
 * Deterministic fixture render: produces one RenderArtifact per requested
 * output kind (sorted order — part of the frozen fixture definition). The
 * per-artifact RNG seed derives from the spec id, method, output kind,
 * performance id AND the timeline cue payload hashes, so artifact bytes
 * are a deterministic function of the job and its performed timeline.
 * Every artifact stays `simulated: true` (truth law).
 */
export function fixtureRenderArtifacts(input: FixtureRenderInput): readonly RenderArtifact[] {
  const { spec, performance } = input;
  const payloadHashes = performance.timeline.cues.map((cue) => cue.payloadHash);
  const artifacts: RenderArtifact[] = [];
  for (const kind of [...spec.outputKinds].sort()) {
    const seedText = [
      "you-w4a-fixture-render",
      spec.id,
      spec.method,
      kind,
      performance.id,
      performance.timeline.id,
      ...payloadHashes,
    ].join(":");
    const rng: YouRng = createDeterministicRng(seedFromString(seedText));
    const bytes = synthesizeFixtureRenderBytes(rng, kind);
    const binding = input.store.put(bytes);
    artifacts.push(
      deepFreeze({
        id: input.ids.next("render-artifact"),
        jobId: spec.id,
        kind,
        contentRef: binding.contentRef,
        contentHash: binding.contentHash,
        createdAt: input.clock.now(),
        simulated: true,
      }),
    );
  }
  return Object.freeze(artifacts);
}

/** Builds the terminal RenderJobResult (completed or failed). */
export function buildRenderJobResult(
  input: {
    readonly spec: RenderJobSpec;
    readonly status: "completed" | "failed";
    readonly artifacts: readonly RenderArtifact[];
    readonly timelineCueCount: number;
    readonly failureReason?: string;
    readonly completedAt: string;
  },
): RenderJobResult {
  const observations: Record<string, string | number | boolean> = {
    ...notMeasuredRenderEffortObservations(input.artifacts.length, input.timelineCueCount),
  };
  if (input.status === "failed") {
    observations["failureReason"] = input.failureReason ?? "unspecified";
  }
  return deepFreeze({
    jobId: input.spec.id,
    status: input.status,
    artifacts: Object.freeze([...input.artifacts]),
    effortObservations: observations,
    completedAt: input.completedAt,
    simulated: true,
  });
}
