// Provider-neutral capture adapter seam (W2C).
//
// Capture providers (MediaPipe, OpenPose, TF.js pose models, YOLO-seg, SAM,
// Depth-Anything, SMPL/X, MMPose, ...) are replaceable adapters, never
// authorities (docs/you/ARCHITECTURE.md §3 Technology plane, CONTRACTS.md
// error semantics). This seam defines the neutral interchange surface: an
// input modality plus a deterministic synthetic capture payload flows IN, and
// TYPED capture observations (segmentation regions / pose landmarks) flow out.
// The neutral shapes are owned by you-lab; mapping onto the frozen
// @zcode/shared YOU contract v2 (EvidenceRecord, qualityObservations) happens
// ONLY in src/contractSeam.ts.
//
// Determinism: adapters are pure functions of (payload, seed) — no clock, no
// randomness, no network (docs/you/FIXTURES.md). The payload itself is
// synthetic (seed-generated block descriptors, never real pixels) and stays
// labeled `simulated: true`.

import { roundTo } from "../determinism.js";

// ---------------------------------------------------------------------------
// Modality / capability vocabulary (neutral; no provider semantics)
// ---------------------------------------------------------------------------

/**
 * Neutral capture modality vocabulary. Structurally aligned with the frozen
 * contract `CaptureModality` closed literals by design (the seam maps 1:1);
 * the neutral type is you-lab-owned and never redeclares the frozen type.
 */
export type NeutralCaptureModality =
  | "image"
  | "video"
  | "depth"
  | "audio"
  | "measurement"
  | "document";

/** Neutral capture capability vocabulary (no provider semantics). */
export type CaptureCapability =
  | "person-segmentation"
  | "object-segmentation"
  | "pose-estimation"
  | "face-landmarks"
  | "hand-landmarks"
  | "depth-estimation"
  | "body-mesh-reconstruction";

/** Runtime class of an adapter deployment (engineering assessment). */
export type RuntimeClass =
  | "browser-js"
  | "local-cpu"
  | "local-gpu"
  | "server-api"
  | "desktop-native";

// ---------------------------------------------------------------------------
// Synthetic capture payload (input side of the seam)
// ---------------------------------------------------------------------------

/**
 * One synthetic block descriptor — the observable neutral "features" of a
 * grid cell. Never real pixels; generated from a seed by
 * capture/syntheticPayload.ts.
 */
export interface NeutralBlock {
  readonly blockId: string;
  readonly gx: number;
  readonly gy: number;
  /** Observable synthetic chroma feature in [0, 1]. */
  readonly chroma: number;
  /** Observable synthetic luminance feature in [0, 1]. */
  readonly luminance: number;
  /** Observable synthetic depth feature in [0, 1] (1 = far). */
  readonly depth: number;
}

export interface NeutralCaptureFrame {
  readonly frameId: string;
  readonly index: number;
  readonly width: number;
  readonly height: number;
  readonly blocks: readonly NeutralBlock[];
}

export interface NeutralCapturePayload {
  /** Deterministic digest id (fnv1a32 of the canonical payload content). */
  readonly payloadId: string;
  readonly modality: NeutralCaptureModality;
  /** Truth law: synthetic payloads stay labeled (docs/you/FIXTURES.md law 6). */
  readonly simulated: true;
  readonly frames: readonly NeutralCaptureFrame[];
}

// ---------------------------------------------------------------------------
// Typed capture observations (output side of the seam)
// ---------------------------------------------------------------------------

export interface SegmentedRegion {
  /** Deterministic digest id of the region (fnv1a32 of the region core). */
  readonly regionId: string;
  readonly label: "person" | "prop" | "background";
  /** Region area as a fraction of the frame grid, rounded to 4 decimals. */
  readonly areaRatio: number;
  /** Normalized [x0, y0, x1, y1] bounding box within [0, 1]. */
  readonly boundingBox: readonly [number, number, number, number];
  readonly confidence: number;
  /** Sorted block ids covered by the region. */
  readonly blockIds: readonly string[];
}

export interface SegmentationObservation {
  readonly kind: "segmentation";
  readonly frameId: string;
  readonly regions: readonly SegmentedRegion[];
}

export interface PoseLandmark {
  readonly landmarkId: number;
  readonly name: string;
  /** Normalized coordinates in [0, 1]. */
  readonly x: number;
  readonly y: number;
  /** Normalized depth axis in [0, 1] (not metric depth). */
  readonly z: number;
  readonly visibility: number;
}

export interface PoseObservation {
  readonly kind: "pose";
  readonly frameId: string;
  readonly skeletonModel: string;
  readonly landmarks: readonly PoseLandmark[];
}

export type CaptureObservation = SegmentationObservation | PoseObservation;

export interface CaptureObservationBatch<O extends CaptureObservation = CaptureObservation> {
  /** Adapter that produced the observations. */
  readonly adapterId: string;
  readonly payloadId: string;
  readonly observations: readonly O[];
  /** Sorted human-readable warnings; empty when clean. */
  readonly warnings: readonly string[];
  /** Truth law: mock adapter output stays labeled simulated. */
  readonly simulated: true;
}

// ---------------------------------------------------------------------------
// Neutral skeleton (shared structural vocabulary)
// ---------------------------------------------------------------------------

/**
 * The neutral 17-joint skeleton used by synthetic ground-truth generation and
 * by pose adapters. Anatomical names only — deliberately provider-neutral
 * (not COCO, not BlazePose, not OpenPose layouts; any provider adapter maps
 * ITS skeleton onto these ids at its own boundary).
 */
export const NEUTRAL_SKELETON_MODEL = "you-neutral-17";

export interface SkeletonJointSpec {
  readonly landmarkId: number;
  readonly name: string;
  /** Structural anchor relative to the person bounding box, in [0, 1]. */
  readonly rx: number;
  readonly ry: number;
  /** Structural depth anchor in [0, 1]. */
  readonly rz: number;
}

export const NEUTRAL_SKELETON: readonly SkeletonJointSpec[] = [
  { landmarkId: 0, name: "nose", rx: 0.5, ry: 0.08, rz: 0.35 },
  { landmarkId: 1, name: "neck", rx: 0.5, ry: 0.18, rz: 0.35 },
  { landmarkId: 2, name: "left-shoulder", rx: 0.34, ry: 0.22, rz: 0.35 },
  { landmarkId: 3, name: "right-shoulder", rx: 0.66, ry: 0.22, rz: 0.35 },
  { landmarkId: 4, name: "left-elbow", rx: 0.26, ry: 0.36, rz: 0.38 },
  { landmarkId: 5, name: "right-elbow", rx: 0.74, ry: 0.36, rz: 0.38 },
  { landmarkId: 6, name: "left-wrist", rx: 0.22, ry: 0.5, rz: 0.4 },
  { landmarkId: 7, name: "right-wrist", rx: 0.78, ry: 0.5, rz: 0.4 },
  { landmarkId: 8, name: "pelvis", rx: 0.5, ry: 0.55, rz: 0.35 },
  { landmarkId: 9, name: "left-hip", rx: 0.42, ry: 0.57, rz: 0.35 },
  { landmarkId: 10, name: "right-hip", rx: 0.58, ry: 0.57, rz: 0.35 },
  { landmarkId: 11, name: "left-knee", rx: 0.42, ry: 0.75, rz: 0.36 },
  { landmarkId: 12, name: "right-knee", rx: 0.58, ry: 0.75, rz: 0.36 },
  { landmarkId: 13, name: "left-ankle", rx: 0.42, ry: 0.93, rz: 0.37 },
  { landmarkId: 14, name: "right-ankle", rx: 0.58, ry: 0.93, rz: 0.37 },
  { landmarkId: 15, name: "left-eye", rx: 0.44, ry: 0.06, rz: 0.34 },
  { landmarkId: 16, name: "right-eye", rx: 0.56, ry: 0.06, rz: 0.34 },
];

/** Person-label decision threshold on observable mean chroma. */
export const PERSON_LABEL_CHROMA_THRESHOLD = 0.65;

/** Prop-label decision threshold on observable mean chroma. */
export const PROP_LABEL_CHROMA_THRESHOLD = 0.4;

// ---------------------------------------------------------------------------
// Adapter profile + interface
// ---------------------------------------------------------------------------

/**
 * Adapter-facing candidate profile. `technologyId` is null for pure mocks —
 * a mock profile NEVER claims facts about a real technology (truth law).
 */
export interface CaptureAdapterProfile {
  /** Stable adapter id, e.g. "mock-seg-precise". */
  readonly id: string;
  /** Backing registry technology id, or null for pure mock candidates. */
  readonly technologyId: string | null;
  readonly capabilities: readonly CaptureCapability[];
  readonly supportedModalities: readonly NeutralCaptureModality[];
  readonly runtimeClass: RuntimeClass;
  /** Whether the adapter implementation itself is bit-deterministic. */
  readonly deterministic: boolean;
  readonly determinismNote: string;
}

/**
 * Provider-neutral capture adapter: input modality + synthetic payload ->
 * typed capture observations (and, through capture/captureEvaluation.ts,
 * capture technology candidates). Pure function of (payload, seed).
 */
export interface CaptureAdapter<O extends CaptureObservation = CaptureObservation> {
  readonly profile: CaptureAdapterProfile;
  readonly observationKind: O["kind"];
  observe(payload: NeutralCapturePayload, seed: string): CaptureObservationBatch<O>;
}

/** Clamp into [0, 1] and round to 6 decimals (deterministic normalization). */
export function clamp01(value: number): number {
  return roundTo(Math.min(1, Math.max(0, value)), 6);
}

/** Label a detected region from its observable mean chroma (neutral rule). */
export function labelForMeanChroma(meanChroma: number): SegmentedRegion["label"] {
  if (meanChroma >= PERSON_LABEL_CHROMA_THRESHOLD) return "person";
  if (meanChroma >= PROP_LABEL_CHROMA_THRESHOLD) return "prop";
  return "background";
}
