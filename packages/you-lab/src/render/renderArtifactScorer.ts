// Deterministic render artifact quality scorer (W4C).
//
// Scores typed render artifacts against the fixture-held ground truth
// (requested output kinds; the timeline-achievable fidelity ceiling). All
// arithmetic is deterministic and explicitly a FIXTURE OBJECTIVE — computed,
// not measured; not a user study and not a claim about any real render
// technology (docs/you/CONTRACTS.md error semantics, docs/you/LAB.md
// "Deterministic benchmark gates remain authoritative").

import { roundTo } from "../determinism.js";
import {
  isSha256Hex,
  sha256Hex,
  type NeutralPerformanceTimeline,
  type NeutralRenderArtifact,
  type NeutralRenderMethod,
  type NeutralRenderOutputKind,
} from "./renderAdapterSeam.js";

// Composite weights (fixture objective definition — authored, versioned).
export const RENDER_ARTIFACT_WEIGHTS = { outputCoverage: 0.5, fidelityCalibration: 0.3, contentAddressing: 0.2 } as const;

export const SCORER_RENDER_VERSION =
  "you-lab-render-artifact-scorer/1 (deterministic fixture objective — computed, not measured)";

export interface RenderArtifactQualityParts {
  /** |produced ∩ requested| / |requested| (1 when all requested kinds produced). */
  readonly outputCoverage: number;
  /** 1 - |meanFidelity - achievable| (clamped at 0) — rewards tracking the timeline ceiling. */
  readonly fidelityCalibration: number;
  /** Fraction of artifacts that are validly content-addressed (sha-256 hex, hash matches payload bytes, non-empty contentRef). */
  readonly contentAddressing: number;
  readonly artifactQualityScore: number;
}

/**
 * Fixture ground truth: the achievable fidelity ceiling for (timeline,
 * method) — deterministic arithmetic over the observable timeline features;
 * never a scientific claim. Cue density is the dominant factor; 3d renders
 * hold a higher base (a rasterizer consumes whatever material it is given)
 * while motion-extraction fidelity is capped lower.
 */
export function achievableRenderFidelity(
  timeline: NeutralPerformanceTimeline,
  method: NeutralRenderMethod,
): number {
  const { cues, durationMs } = timeline;
  if (cues.length === 0 || durationMs <= 0) return 0;
  const base = method === "3d-render" ? 0.78 : method === "motion-extraction" ? 0.5 : 0.55;
  const density = Math.min(1, cues.length / 9);
  const tracks = new Set(cues.map((cue) => cue.track));
  const variety = Math.min(1, tracks.size / 3);
  const lastEndMs = cues[cues.length - 1]?.endMs ?? 0;
  const coverage = Math.min(1, lastEndMs / durationMs);
  return roundTo(Math.min(1, base + 0.16 * density + 0.08 * variety + 0.06 * coverage), 6);
}

/** Score produced artifacts against the requested output kinds + timeline ceiling. */
export function scoreRenderArtifacts(
  artifacts: readonly NeutralRenderArtifact[],
  requestedKinds: readonly NeutralRenderOutputKind[],
  timeline: NeutralPerformanceTimeline,
  method: NeutralRenderMethod,
): RenderArtifactQualityParts {
  const requested = [...requestedKinds].sort();
  const produced = new Set(artifacts.map((artifact) => artifact.kind));
  const covered = requested.filter((kind) => produced.has(kind));
  const outputCoverage = requested.length === 0 ? 0 : roundTo(covered.length / requested.length, 4);

  const achievable = achievableRenderFidelity(timeline, method);
  const meanFidelity =
    artifacts.length === 0
      ? 0
      : roundTo(artifacts.reduce((sum, artifact) => sum + artifact.fidelity, 0) / artifacts.length, 6);
  const fidelityCalibration = roundTo(Math.max(0, 1 - Math.abs(meanFidelity - achievable)), 4);

  const valid = artifacts.filter((artifact) => isValidlyAddressed(artifact));
  const contentAddressing = artifacts.length === 0 ? 0 : roundTo(valid.length / artifacts.length, 4);

  return {
    outputCoverage,
    fidelityCalibration,
    contentAddressing,
    artifactQualityScore: roundTo(
      RENDER_ARTIFACT_WEIGHTS.outputCoverage * outputCoverage +
        RENDER_ARTIFACT_WEIGHTS.fidelityCalibration * fidelityCalibration +
        RENDER_ARTIFACT_WEIGHTS.contentAddressing * contentAddressing,
      4,
    ),
  };
}

/** Valid content addressing: non-empty id/ref, sha-256 hex hash matching the payload bytes, kind present. */
export function isValidlyAddressed(artifact: NeutralRenderArtifact): boolean {
  if (artifact.artifactId.length === 0) return false;
  if (artifact.contentRef.length === 0) return false;
  if (artifact.kind.length === 0) return false;
  if (!isSha256Hex(artifact.contentHash)) return false;
  return sha256Hex(artifact.payload) === artifact.contentHash;
}
