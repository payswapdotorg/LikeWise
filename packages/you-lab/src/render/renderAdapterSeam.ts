// Provider-neutral render adapter seam (W4C).
//
// Render providers (MediaPipe/mmpose/VIBE-class motion extraction,
// Rokoko/Rigify/libigl-class retargeting, diffusion-class image pipelines,
// animated-diffusion/frame-interpolation video chains, Blender/three.js/
// Gaussian-splatting 3D renderers, ...) are replaceable adapters, never
// authorities (docs/you/CONTRACTS.md "Performance / render is
// provider-neutral and method-plural"). This seam defines the neutral
// interchange surface: a typed render job request (method, output kinds,
// plain parameters, the CONSUMED performance timeline) flows IN, and typed
// content-addressed artifact outputs flow OUT. The neutral shapes are
// you-lab-owned and structurally aligned 1:1 with the frozen v4 interchange
// (the closed literal sets of the RenderMethod / RenderOutputKind /
// RenderJobStatus unions and the RenderJobSpec / RenderArtifact /
// RenderJobResult shapes); mapping onto the frozen contract happens ONLY in
// src/contractSeam.ts.
//
// Determinism: adapters are pure functions of the request — no clock, no
// randomness, no network (docs/you/FIXTURES.md). Performance timelines are
// synthetic (seed-generated cue payloads, never real captures) and outputs
// stay labeled `simulated: true` (truth law).

import { createHash } from "node:crypto";
import { canonicalJson, fnv1a32, roundTo } from "../determinism.js";
import { createDeterministicRng } from "../capture/deterministicRng.js";
import type { MetricField } from "../benchmarks/runner.js";

// ---------------------------------------------------------------------------
// Method / output-kind vocabulary (neutral; no provider semantics)
// ---------------------------------------------------------------------------

/**
 * Neutral render method vocabulary. Structurally aligned with the frozen v4
 * closed literals ("motion-extraction" | "retargeting" | "image-render" |
 * "video-render" | "3d-render"); the neutral type is you-lab-owned and never
 * redeclares the frozen type. Method extensions are legal (open vocabulary).
 */
export type NeutralRenderMethod =
  | "motion-extraction"
  | "retargeting"
  | "image-render"
  | "video-render"
  | "3d-render"
  | (string & {});

/**
 * Neutral render output-kind vocabulary. Structurally aligned with the frozen
 * v4 closed literals ("image" | "video" | "mesh" | "animation");
 * you-lab-owned, open for extensions.
 */
export type NeutralRenderOutputKind =
  | "image"
  | "video"
  | "mesh"
  | "animation"
  | (string & {});

/** Neutral performance track kind (aligned 1:1 with the frozen v4 taxonomy). */
export type NeutralPerformanceTrackKind = "motion" | "cue" | "layer" | (string & {});

// ---------------------------------------------------------------------------
// Performance timeline consumption (input side of the seam)
// ---------------------------------------------------------------------------

/** One timed cue of the consumed performance timeline (content-addressed). */
export interface NeutralPerformanceCue {
  readonly id: string;
  readonly track: NeutralPerformanceTrackKind;
  readonly startMs: number;
  readonly endMs: number;
  readonly payloadRef: string;
  /** sha-256 hex of the cue payload bytes (content-addressed law). */
  readonly payloadHash: string;
}

/**
 * The performance timeline a render job consumes. Structurally aligned 1:1
 * with the frozen v4 PerformanceTimeline (id / durationMs / cues sorted by
 * startMs); the neutral shape is you-lab-owned so adapter code never touches
 * the frozen contract.
 */
export interface NeutralPerformanceTimeline {
  readonly id: string;
  readonly durationMs: number;
  readonly cues: readonly NeutralPerformanceCue[];
}

// ---------------------------------------------------------------------------
// Typed job request (input side of the seam)
// ---------------------------------------------------------------------------

export interface NeutralRenderRequest {
  /** Job identity (maps 1:1 onto the frozen spec id at the seam). */
  readonly requestId: string;
  /** The performance the job renders (maps onto the frozen spec performanceId). */
  readonly performanceId: string;
  readonly method: NeutralRenderMethod;
  readonly outputKinds: readonly NeutralRenderOutputKind[];
  /** Plain typed parameters (string | number | boolean records; no nesting). */
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
  /** The consumed performance timeline (content-addressed cue payloads). */
  readonly timeline: NeutralPerformanceTimeline;
  /** Mirrors the frozen spec createdAt (fixed fixture constant in fixture mode). */
  readonly submittedAt: string;
}

// ---------------------------------------------------------------------------
// Typed artifact outputs (output side of the seam)
// ---------------------------------------------------------------------------

/**
 * Neutral typed render artifact: structurally aligned 1:1 with the frozen v4
 * RenderArtifact shape (id / jobId / kind / contentRef / contentHash /
 * createdAt / simulated). The synthetic payload bytes travel WITH the neutral
 * artifact so callers can store them; the seam DROPS the bytes (and the
 * fixture-only fidelity field) when constructing frozen artifacts — content
 * is referenced, never inlined past the seam.
 */
export interface NeutralRenderArtifact {
  readonly artifactId: string;
  readonly kind: NeutralRenderOutputKind;
  readonly contentRef: string;
  /** sha-256 hex of the synthetic payload bytes (content-addressed law). */
  readonly contentHash: string;
  /** Deterministic 0..1 fidelity (fixture arithmetic, never a scientific claim). */
  readonly fidelity: number;
  readonly simulated: true;
  /** Provenance generator label, e.g. "you-lab-mock-render-adapter/1". */
  readonly generator: string;
  /** Synthetic artifact payload bytes (seed-derived; dropped at the contract seam). */
  readonly payload: Uint8Array;
}

export type NeutralRenderStatus = "completed" | "failed";

/** Structured effort/latency/cost fields with honest markers (truth law). */
export interface RenderEffortFields {
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

export interface RenderOutput {
  readonly adapterId: string;
  readonly requestId: string;
  readonly status: NeutralRenderStatus;
  readonly failureReason: string | null;
  readonly producedArtifacts: readonly NeutralRenderArtifact[];
  /** Sorted human-readable warnings; empty when clean. */
  readonly warnings: readonly string[];
  readonly effort: RenderEffortFields;
  /** Truth law: adapter output stays labeled simulated. */
  readonly simulated: true;
}

// ---------------------------------------------------------------------------
// Adapter profile + interface
// ---------------------------------------------------------------------------

/** Runtime class of an adapter deployment (engineering assessment). */
export type RenderRuntimeClass = "browser-js" | "local-cpu" | "local-gpu" | "server-api" | "desktop-native";

/**
 * Adapter-facing candidate profile. `technologyId` is null for pure mocks —
 * a mock profile NEVER claims facts about a real technology (truth law).
 */
export interface RenderAdapterProfile {
  readonly id: string;
  /** Backing registry technology id, or null for pure mock candidates. */
  readonly technologyId: string | null;
  /** Methods the adapter implements (primary = first). */
  readonly methods: readonly NeutralRenderMethod[];
  /** Output kinds the adapter can produce (union over methods). */
  readonly supportedOutputKinds: readonly NeutralRenderOutputKind[];
  readonly runtimeClass: RenderRuntimeClass;
  /** Whether the adapter implementation itself is bit-deterministic. */
  readonly deterministic: boolean;
  readonly determinismNote: string;
  /**
   * Registry-derived production eligibility (license + maintenance). Null for
   * pure mocks; for profile-backed adapters this is DERIVED from registry
   * facts, never asserted by hand.
   */
  readonly productionEligible: boolean | null;
  /** Honest basis for the eligibility flag (or "pure mock" note for mocks). */
  readonly eligibilityBasis: string;
}

/**
 * Provider-neutral render adapter: typed job request -> typed artifact
 * outputs. Pure function of the request.
 */
export interface RenderAdapter {
  readonly profile: RenderAdapterProfile;
  render(request: NeutralRenderRequest): RenderOutput;
}

// ---------------------------------------------------------------------------
// Support matrix + typed refusals (neutral mirror of the W4A fixture matrix)
// ---------------------------------------------------------------------------

/**
 * Neutral render support matrix (you-lab engineering table, aligned 1:1 with
 * the W4A fixture definition FIXTURE_RENDER_SUPPORT): method -> supported
 * output kinds. A video render also emits a poster image; all other
 * registered methods produce exactly their natural output kind. Real
 * adapters (this lane) register behind the same support law; the adapter
 * never silently falls back to another method (truth law).
 */
export const NEUTRAL_RENDER_SUPPORT: Readonly<Record<string, readonly NeutralRenderOutputKind[]>> = {
  "3d-render": ["mesh"],
  "image-render": ["image"],
  "motion-extraction": ["animation"],
  retargeting: ["animation"],
  "video-render": ["video", "image"],
};

/** Canonical benchmark output-kind set per method (the runner requests these). */
export const RENDER_BENCHMARK_OUTPUT_KINDS: Readonly<Record<string, readonly NeutralRenderOutputKind[]>> =
  NEUTRAL_RENDER_SUPPORT;

/** Returns the unsupported output kinds of a registered method ([] when supported). */
export function unsupportedRenderOutputKinds(
  method: NeutralRenderMethod,
  outputKinds: readonly NeutralRenderOutputKind[],
): NeutralRenderOutputKind[] {
  const supported = NEUTRAL_RENDER_SUPPORT[method];
  if (supported === undefined) {
    return [...outputKinds].sort();
  }
  return outputKinds.filter((kind) => !supported.includes(kind)).sort();
}

/** Error code aligned with the frozen v4 typed error literal (you-lab-owned). */
export const RENDER_UNSUPPORTED_CODE = "YOU_RENDER_UNSUPPORTED";

/** Typed refusal thrown when an adapter is invoked with an unsupported method/output-kind combination. */
export class UnsupportedRenderOutputKindsError extends Error {
  readonly code = RENDER_UNSUPPORTED_CODE;
  constructor(
    readonly method: NeutralRenderMethod,
    readonly unsupportedKinds: readonly NeutralRenderOutputKind[],
  ) {
    super(
      `${RENDER_UNSUPPORTED_CODE}: method "${method}" does not support output kind(s): ${unsupportedKinds.join(", ")}`,
    );
    this.name = "UnsupportedRenderOutputKindsError";
  }
}

/** Typed refusal thrown when the adapter does not implement the request's method at all. */
export class UnimplementedRenderMethodError extends Error {
  readonly code = RENDER_UNSUPPORTED_CODE;
  constructor(
    readonly adapterId: string,
    readonly method: NeutralRenderMethod,
  ) {
    super(`${RENDER_UNSUPPORTED_CODE}: adapter "${adapterId}" does not implement method "${method}"`);
    this.name = "UnimplementedRenderMethodError";
  }
}

/**
 * Shared adapter guard: refuse requests whose method the adapter does not
 * implement, and requests whose (method, outputKinds) combination is
 * unsupported by the neutral support matrix. Typed refusals only — never a
 * silent fallback to another method (truth law).
 */
export function assertRenderRequestSupported(
  profile: RenderAdapterProfile,
  request: NeutralRenderRequest,
): void {
  if (!profile.methods.includes(request.method)) {
    throw new UnimplementedRenderMethodError(profile.id, request.method);
  }
  const unsupported = unsupportedRenderOutputKinds(request.method, request.outputKinds);
  if (unsupported.length > 0) {
    throw new UnsupportedRenderOutputKindsError(request.method, unsupported);
  }
}

// ---------------------------------------------------------------------------
// Deterministic fixture arithmetic (shared by mock + evaluation adapters)
// ---------------------------------------------------------------------------

/** sha-256 hex digest of string/bytes input (deterministic, no clock). */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Fixed synthetic payload sizes per output kind (fixture definition, aligned
 * 1:1 with the W4A fixture byte-length law: image 4096, video 8192, mesh
 * 3072, animation 2048).
 */
export const NEUTRAL_RENDER_KIND_BYTE_LENGTHS: Readonly<Record<string, number>> = {
  animation: 2048,
  image: 4096,
  mesh: 3072,
  video: 8192,
};

/** Default size for output-kind extensions (fixture definition). */
export const NEUTRAL_RENDER_KIND_DEFAULT_BYTE_LENGTH = 512;

export function neutralRenderKindByteLength(kind: NeutralRenderOutputKind): number {
  return NEUTRAL_RENDER_KIND_BYTE_LENGTHS[kind] ?? NEUTRAL_RENDER_KIND_DEFAULT_BYTE_LENGTH;
}

/**
 * Deterministic synthetic artifact payload bytes: pure function of
 * (adapterId, requestId, kind). One byte per rng draw keeps consumption
 * order part of the frozen fixture definition.
 */
export function synthesizeNeutralRenderBytes(
  adapterId: string,
  requestId: string,
  kind: NeutralRenderOutputKind,
): Uint8Array {
  const rng = createDeterministicRng(`render-payload|${adapterId}|${requestId}|${kind}`);
  const length = neutralRenderKindByteLength(kind);
  const bytes = new Uint8Array(length);
  for (let offset = 0; offset < length; offset++) {
    bytes[offset] = Math.floor(rng.next() * 256);
  }
  return bytes;
}

/** Opaque deterministic artifact id for (adapterId, requestId, kind). */
export function neutralRenderArtifactId(adapterId: string, requestId: string, kind: NeutralRenderOutputKind): string {
  return `render-artifact-${fnv1a32(canonicalJson({ adapterId, requestId, kind }))}`;
}

/** Opaque content-store reference for (adapterId, requestId, kind). */
export function neutralRenderContentRef(adapterId: string, requestId: string, kind: NeutralRenderOutputKind): string {
  return `content-store://you-lab/render/${adapterId}/${requestId}/${kind}`;
}

/** Clamp into [0, 1] and round to 6 decimals (deterministic normalization). */
export function clampFidelity(value: number): number {
  return roundTo(Math.min(1, Math.max(0, value)), 6);
}

/** Not-measured effort field set (truth law: never invented numbers). */
export function notMeasuredRenderEffortFields(): RenderEffortFields {
  return {
    effort: { kind: "not-measured", marker: "not-measured (simulated)" },
    latency: { kind: "not-measured", marker: "not-measured (simulated)" },
    cost: { kind: "not-measured", marker: "not-measured (simulated)" },
  };
}

/** Validate a sha-256 hex content hash (64 lowercase hex chars). */
export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
