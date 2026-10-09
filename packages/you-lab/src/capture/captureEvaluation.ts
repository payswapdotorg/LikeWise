// Capture candidate profiles + evaluation criteria (W2C).
//
// Derives structured evaluation criteria for the researched capture
// technology candidates (segmentation / pose / reconstruction families) as a
// deterministic function of the technology registry:
// - capability coverage vs modality (authored assessment tables);
// - determinism (engineering assessment — never a verified claim);
// - licensing (registry-backed: the researched SPDX + source URL facts);
// - runtime class (authored assessment table);
// - effort / latency / cost: explicit "not-measured (simulated)" markers —
//   no measurement was performed and none is implied (truth law).
//
// These criteria are a PAPER evaluation for candidate shortlisting; the
// benchmark harness (captureRunner) separately scores deterministic simulated
// adapters on the quality of typed observations. Neither implies anything
// measured about the real technologies.

import { sortedUnique } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import type { CaptureCapability, NeutralCaptureModality, RuntimeClass } from "./captureAdapterSeam.js";

export type CaptureCandidateFamily = "segmentation" | "pose" | "reconstruction";

const DERIVATION_TABLE = "you-lab capture-candidate table/1 (engineering assessment)";

/** Authored capability coverage per technology id (assessment, not external claim). */
const CAPABILITY_COVERAGE: Readonly<Record<string, readonly CaptureCapability[]>> = {
  mediapipe: ["pose-estimation", "face-landmarks", "hand-landmarks", "person-segmentation"],
  openpose: ["pose-estimation", "face-landmarks", "hand-landmarks"],
  "tfjs-pose": ["pose-estimation"],
  "yolo-seg": ["person-segmentation", "object-segmentation"],
  "segment-anything": ["person-segmentation", "object-segmentation"],
  "depth-anything": ["depth-estimation"],
  smplx: ["body-mesh-reconstruction"],
  mmpose: ["pose-estimation", "face-landmarks", "hand-landmarks"],
};

/** Authored modality coverage per technology id (assessment). */
const MODALITY_COVERAGE: Readonly<Record<string, readonly NeutralCaptureModality[]>> = {
  mediapipe: ["image", "video"],
  openpose: ["image", "video"],
  "tfjs-pose": ["image", "video"],
  "yolo-seg": ["image", "video"],
  "segment-anything": ["image", "video"],
  "depth-anything": ["image", "video", "depth"],
  smplx: ["image", "video", "depth"],
  mmpose: ["image", "video"],
};

/** Authored runtime class per technology id (assessment). */
const RUNTIME_CLASS: Readonly<Record<string, RuntimeClass>> = {
  mediapipe: "browser-js",
  openpose: "local-gpu",
  "tfjs-pose": "browser-js",
  "yolo-seg": "local-gpu",
  "segment-anything": "local-gpu",
  "depth-anything": "local-gpu",
  smplx: "local-cpu",
  mmpose: "local-gpu",
};

/**
 * Determinism assessment per technology id. Real neural inference is NOT
 * bit-deterministic in general (GPU float nondeterminism, backend dispatch);
 * the adapters YOU ship around them must restore determinism at the seam
 * (fixture mode) or disclose it.
 */
const DETERMINISM: Readonly<Record<string, { deterministic: boolean; basis: string }>> = {
  mediapipe: {
    deterministic: false,
    basis: "GPU/accelerator float inference is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode",
  },
  openpose: {
    deterministic: false,
    basis: "CUDA float inference is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode",
  },
  "tfjs-pose": {
    deterministic: false,
    basis: "WebGL/WASM float inference varies across backends/devices; deterministic only in fixture (mock) mode",
  },
  "yolo-seg": {
    deterministic: false,
    basis: "CUDA float inference is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode",
  },
  "segment-anything": {
    deterministic: false,
    basis: "CUDA float inference is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode",
  },
  "depth-anything": {
    deterministic: false,
    basis: "GPU float inference is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode",
  },
  smplx: {
    deterministic: true,
    basis: "deterministic linear-blend-skinning math on CPU given fixed inputs (assessment; not verified by execution during W2C)",
  },
  mmpose: {
    deterministic: false,
    basis: "GPU float inference is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode",
  },
};

/** Primary candidate family per technology id (assessment). */
const FAMILY: Readonly<Record<string, CaptureCandidateFamily>> = {
  mediapipe: "pose",
  openpose: "pose",
  "tfjs-pose": "pose",
  "yolo-seg": "segmentation",
  "segment-anything": "segmentation",
  "depth-anything": "reconstruction",
  smplx: "reconstruction",
  mmpose: "pose",
};

const ALL_CAPABILITIES: readonly CaptureCapability[] = [
  "body-mesh-reconstruction",
  "depth-estimation",
  "face-landmarks",
  "hand-landmarks",
  "object-segmentation",
  "person-segmentation",
  "pose-estimation",
];

const ALL_MODALITIES: readonly NeutralCaptureModality[] = ["depth", "image", "video"];

/** SPDX ids considered production-friendly without bespoke legal review. */
const PRODUCTION_FRIENDLY_SPDX = new Set(["MIT", "Apache-2.0"]);

export interface CaptureEvaluationCriteria {
  readonly capabilityCoverage: readonly { readonly capability: CaptureCapability; readonly covered: boolean }[];
  readonly modalityCoverage: readonly { readonly modality: NeutralCaptureModality; readonly covered: boolean }[];
  readonly determinism: {
    readonly deterministic: boolean;
    readonly basis: string;
    readonly assessmentBasis: "engineering-assessment";
  };
  readonly licensing: {
    readonly spdxId: string | null;
    readonly productionFriendly: boolean;
    readonly sourceUrl: string;
    readonly note: string;
  };
  readonly runtimeClass: RuntimeClass;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

export interface CaptureCandidateProfile {
  readonly technologyId: string;
  readonly name: string;
  readonly family: CaptureCandidateFamily;
  readonly evaluation: CaptureEvaluationCriteria;
  readonly derivedFrom: string;
}

export function deriveCaptureCandidateProfiles(registry: TechnologyRegistry): readonly CaptureCandidateProfile[] {
  const profiles: CaptureCandidateProfile[] = [];
  for (const technology of registry.profiles) {
    const capabilities = CAPABILITY_COVERAGE[technology.id];
    if (!capabilities) continue; // not a capture candidate
    const coveredCapabilities = new Set(capabilities);
    const coveredModalities = new Set(MODALITY_COVERAGE[technology.id] ?? []);
    const determinism = DETERMINISM[technology.id];
    const runtimeClass = RUNTIME_CLASS[technology.id];
    if (!determinism || !runtimeClass) continue;
    const family = FAMILY[technology.id];
    if (!family) continue;
    profiles.push({
      technologyId: technology.id,
      name: technology.name,
      family,
      evaluation: {
        capabilityCoverage: ALL_CAPABILITIES.map((capability) => ({
          capability,
          covered: coveredCapabilities.has(capability),
        })),
        modalityCoverage: ALL_MODALITIES.map((modality) => ({ modality, covered: coveredModalities.has(modality) })),
        determinism: { ...determinism, assessmentBasis: "engineering-assessment" },
        licensing: {
          spdxId: technology.license.spdxId,
          productionFriendly: technology.license.spdxId !== null && PRODUCTION_FRIENDLY_SPDX.has(technology.license.spdxId),
          sourceUrl: technology.license.sourceUrl,
          note: technology.license.note,
        },
        runtimeClass,
        effort: notMeasured(),
        latency: notMeasured(),
        cost: notMeasured(),
      },
      derivedFrom: DERIVATION_TABLE,
    });
  }
  return profiles.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/** Candidate ids for a family (sorted) — registry-backed shortlist helper. */
export function captureCandidateIdsForFamily(
  profiles: readonly CaptureCandidateProfile[],
  family: CaptureCandidateFamily,
): readonly string[] {
  return sortedUnique(profiles.filter((profile) => profile.family === family).map((profile) => profile.technologyId));
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
