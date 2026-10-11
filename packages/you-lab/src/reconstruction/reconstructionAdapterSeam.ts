// Provider-neutral reconstruction adapter seam (W3C).
//
// Reconstruction providers (COLMAP, OpenMVS, Open3D, SMPL/X, PIFu/PIFuHD,
// ICON/ECON, gaussian-splatting avatar approaches, InstantAvatar-class,
// NeRF-human-class, ...) are replaceable adapters, never authorities
// (docs/you/CONTRACTS.md "Reconstruction is provider-neutral and
// method-plural"). This seam defines the neutral interchange surface: a typed
// job request (method, target domains, resolved synthetic capture evidence)
// flows IN, and TYPED domain-block outputs flow OUT. The neutral shapes are
// you-lab-owned and structurally aligned 1:1 with the frozen v3 interchange
// (the closed literal sets of the reconstruction method / HTIR domain /
// job status unions); mapping onto the frozen contract happens ONLY in
// src/contractSeam.ts.
//
// Determinism: adapters are pure functions of the request — no clock, no
// randomness, no network (docs/you/FIXTURES.md). Evidence payloads are
// synthetic (seed-generated descriptors from the W2C capture machinery, never
// real pixels) and outputs stay labeled `simulated: true` (truth law).

import { createHash } from "node:crypto";
import { canonicalJson, fnv1a32, roundTo } from "../determinism.js";
import { createDeterministicRng } from "../capture/deterministicRng.js";
import type { NeutralCaptureModality } from "../capture/captureAdapterSeam.js";
import type { MetricField } from "../benchmarks/runner.js";

// ---------------------------------------------------------------------------
// Method / domain vocabulary (neutral; no provider semantics)
// ---------------------------------------------------------------------------

/**
 * Neutral reconstruction method vocabulary. Structurally aligned with the
 * frozen v3 closed literals ("explicit-geometry" | "neural-appearance" |
 * "hybrid"); the neutral type is you-lab-owned and never redeclares the
 * frozen type. Method extensions are legal (open vocabulary).
 */
export type NeutralReconstructionMethod =
  | "explicit-geometry"
  | "neural-appearance"
  | "hybrid"
  | (string & {});

/**
 * Neutral HTIR domain vocabulary. Structurally aligned with the frozen v3
 * closed literals of the domain union; you-lab-owned, open for extensions.
 */
export type NeutralHtirDomain =
  | "identity-binding"
  | "morphology"
  | "geometry-skeleton"
  | "face-hands"
  | "appearance-materials"
  | "hair"
  | "articulation-blendshapes"
  | "neural-appearance"
  | "motion-profile"
  | "voice"
  | "style"
  | (string & {});

// ---------------------------------------------------------------------------
// Resolved synthetic evidence (input side of the seam)
// ---------------------------------------------------------------------------

/**
 * One resolved evidence descriptor: the synthetic capture payload features a
 * reconstruction adapter may observe (derived deterministically from the W2C
 * capture machinery by reconstruction/reconstructionEvidence.ts). The content
 * hash binds the descriptor to the synthetic payload bytes (sha-256 hex).
 */
export interface NeutralReconstructionEvidence {
  readonly evidenceId: string;
  readonly contentHash: string;
  readonly modality: NeutralCaptureModality;
  readonly frames: number;
  readonly width: number;
  readonly height: number;
  /** Fraction of the frame grid covered by the person region (mean across frames). */
  readonly personCoverage: number;
  /** 1 - mean person depth (1 = far): observable nearness/clarity of the capture. */
  readonly depthCoverage: number;
  /** Synthetic multi-view count observed for this evidence (>= frames). */
  readonly viewCount: number;
}

export interface NeutralReconstructionRequest {
  /** Job identity (maps 1:1 onto the frozen spec id at the seam). */
  readonly requestId: string;
  readonly twinVersionId: string;
  readonly method: NeutralReconstructionMethod;
  readonly targetDomains: readonly NeutralHtirDomain[];
  /** Resolved evidence descriptors (one per binding; validated at the seam). */
  readonly evidence: readonly NeutralReconstructionEvidence[];
  /** Mirrors the frozen spec createdAt (fixed fixture constant in fixture mode). */
  readonly submittedAt: string;
}

// ---------------------------------------------------------------------------
// Typed domain-block outputs (output side of the seam)
// ---------------------------------------------------------------------------

/**
 * Neutral typed domain block: structurally aligned 1:1 with the frozen v3
 * domain-block shape (id / domain / contentRef / contentHash / confidence /
 * simulated / provenance). The synthetic payload bytes travel WITH the neutral
 * block so callers can store them; the seam DROPS the bytes when constructing
 * frozen blocks (content is referenced, never inlined past the seam).
 */
export interface NeutralDomainBlock {
  readonly blockId: string;
  readonly domain: NeutralHtirDomain;
  readonly contentRef: string;
  /** sha-256 hex of the synthetic payload bytes (content-addressed law). */
  readonly contentHash: string;
  /** Deterministic 0..1 confidence (fixture arithmetic, never a scientific claim). */
  readonly confidence: number;
  readonly simulated: true;
  /** Provenance generator label, e.g. "you-lab-mock-reconstruction-adapter/1". */
  readonly generator: string;
  /** Synthetic domain payload bytes (seed-derived; dropped at the contract seam). */
  readonly payload: Uint8Array;
}

export type NeutralReconstructionStatus = "completed" | "failed";

/** Structured effort/latency/cost fields with honest markers (truth law). */
export interface ReconstructionEffortFields {
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

export interface ReconstructionOutput {
  readonly adapterId: string;
  readonly requestId: string;
  readonly status: NeutralReconstructionStatus;
  readonly failureReason: string | null;
  readonly producedBlocks: readonly NeutralDomainBlock[];
  /** Sorted human-readable warnings; empty when clean. */
  readonly warnings: readonly string[];
  readonly effort: ReconstructionEffortFields;
  /** Truth law: adapter output stays labeled simulated. */
  readonly simulated: true;
}

// ---------------------------------------------------------------------------
// Adapter profile + interface
// ---------------------------------------------------------------------------

/** Runtime class of an adapter deployment (engineering assessment). */
export type ReconstructionRuntimeClass = "browser-js" | "local-cpu" | "local-gpu" | "server-api" | "desktop-native";

/**
 * Adapter-facing candidate profile. `technologyId` is null for pure mocks —
 * a mock profile NEVER claims facts about a real technology (truth law).
 */
export interface ReconstructionAdapterProfile {
  readonly id: string;
  /** Backing registry technology id, or null for pure mock candidates. */
  readonly technologyId: string | null;
  /** Methods the adapter implements (primary = first). */
  readonly methods: readonly NeutralReconstructionMethod[];
  /** Domains the adapter can produce blocks for (union over methods). */
  readonly supportedDomains: readonly NeutralHtirDomain[];
  readonly runtimeClass: ReconstructionRuntimeClass;
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
 * Provider-neutral reconstruction adapter: typed job request -> typed
 * domain-block outputs. Pure function of the request.
 */
export interface ReconstructionAdapter {
  readonly profile: ReconstructionAdapterProfile;
  reconstruct(request: NeutralReconstructionRequest): ReconstructionOutput;
}

// ---------------------------------------------------------------------------
// Support matrix + typed refusals (neutral mirror of the fixture definition)
// ---------------------------------------------------------------------------

/**
 * Neutral reconstruction support matrix (you-lab engineering table, aligned
 * 1:1 with the W3A fixture definition): method -> supported target domains.
 * "hybrid" is the union of the explicit-geometry and neural-appearance sets.
 * "voice" is audio capture material, never a reconstruction OUTPUT domain.
 */
export const NEUTRAL_RECONSTRUCTION_SUPPORT: Readonly<Record<string, readonly NeutralHtirDomain[]>> = {
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

/** Canonical benchmark domain set per method (the runner requests these). */
export const RECONSTRUCTION_BENCHMARK_DOMAINS: Readonly<Record<string, readonly NeutralHtirDomain[]>> =
  NEUTRAL_RECONSTRUCTION_SUPPORT;

/** Returns the unsupported domains of a method/target combination ([] when supported). */
export function unsupportedReconstructionDomains(
  method: NeutralReconstructionMethod,
  targetDomains: readonly NeutralHtirDomain[],
): NeutralHtirDomain[] {
  const supported = NEUTRAL_RECONSTRUCTION_SUPPORT[method];
  if (supported === undefined) {
    return [...targetDomains].sort();
  }
  return targetDomains.filter((domain) => !supported.includes(domain)).sort();
}

/** Error code aligned with the frozen v3 typed error literal (you-lab-owned). */
export const RECONSTRUCTION_UNSUPPORTED_CODE = "YOU_RECONSTRUCTION_UNSUPPORTED";

/** Typed refusal thrown when an adapter is invoked with an unsupported combination. */
export class UnsupportedReconstructionCombinationError extends Error {
  readonly code = RECONSTRUCTION_UNSUPPORTED_CODE;
  constructor(
    readonly method: NeutralReconstructionMethod,
    readonly unsupportedDomains: readonly NeutralHtirDomain[],
  ) {
    super(
      `${RECONSTRUCTION_UNSUPPORTED_CODE}: method "${method}" does not support target domain(s): ${unsupportedDomains.join(", ")}`,
    );
    this.name = "UnsupportedReconstructionCombinationError";
  }
}

/** Typed refusal thrown when the adapter does not implement the request's method at all. */
export class UnimplementedReconstructionMethodError extends Error {
  readonly code = RECONSTRUCTION_UNSUPPORTED_CODE;
  constructor(
    readonly adapterId: string,
    readonly method: NeutralReconstructionMethod,
  ) {
    super(`${RECONSTRUCTION_UNSUPPORTED_CODE}: adapter "${adapterId}" does not implement method "${method}"`);
    this.name = "UnimplementedReconstructionMethodError";
  }
}

/**
 * Shared adapter guard: refuse requests whose method the adapter does not
 * implement, and requests whose (method, domains) combination is unsupported
 * by the neutral support matrix. Typed refusals only — never a silent
 * fallback to another method (truth law).
 */
export function assertRequestSupported(
  profile: ReconstructionAdapterProfile,
  request: NeutralReconstructionRequest,
): void {
  if (!profile.methods.includes(request.method)) {
    throw new UnimplementedReconstructionMethodError(profile.id, request.method);
  }
  const unsupported = unsupportedReconstructionDomains(request.method, request.targetDomains);
  if (unsupported.length > 0) {
    throw new UnsupportedReconstructionCombinationError(request.method, unsupported);
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
 * Fixed synthetic payload sizes per domain (fixture definition, aligned 1:1
 * with the W3A fixture byte-length table).
 */
export const NEUTRAL_HTIR_DOMAIN_BYTE_LENGTHS: Readonly<Record<string, number>> = {
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
export const NEUTRAL_HTIR_DOMAIN_DEFAULT_BYTE_LENGTH = 512;

export function neutralHtirDomainByteLength(domain: NeutralHtirDomain): number {
  return NEUTRAL_HTIR_DOMAIN_BYTE_LENGTHS[domain] ?? NEUTRAL_HTIR_DOMAIN_DEFAULT_BYTE_LENGTH;
}

/**
 * Deterministic synthetic domain payload bytes: pure function of
 * (adapterId, requestId, domain). One byte per rng draw keeps consumption
 * order part of the frozen fixture definition.
 */
export function synthesizeNeutralDomainBytes(
  adapterId: string,
  requestId: string,
  domain: NeutralHtirDomain,
): Uint8Array {
  const rng = createDeterministicRng(`recon-payload|${adapterId}|${requestId}|${domain}`);
  const length = neutralHtirDomainByteLength(domain);
  const bytes = new Uint8Array(length);
  for (let offset = 0; offset < length; offset++) {
    bytes[offset] = Math.floor(rng.next() * 256);
  }
  return bytes;
}

/** Opaque deterministic block id for (adapterId, requestId, domain). */
export function neutralDomainBlockId(adapterId: string, requestId: string, domain: NeutralHtirDomain): string {
  return `recon-block-${fnv1a32(canonicalJson({ adapterId, requestId, domain }))}`;
}

/** Opaque content-store reference for (adapterId, requestId, domain). */
export function neutralDomainContentRef(adapterId: string, requestId: string, domain: NeutralHtirDomain): string {
  return `content-store://you-lab/reconstruction/${adapterId}/${requestId}/${domain}`;
}

/** Clamp into [0, 1] and round to 6 decimals (deterministic normalization). */
export function clampConfidence(value: number): number {
  return roundTo(Math.min(1, Math.max(0, value)), 6);
}

/** Not-measured effort field set (truth law: never invented numbers). */
export function notMeasuredEffortFields(): ReconstructionEffortFields {
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
