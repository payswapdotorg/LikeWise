// YOU deterministic quality-delta model (docs/you/FIXTURES.md law 5).
//
// "Improvement" in Phase 0 is an exact arithmetic delta over
// SolutionQualityMap scores, so before/after comparison and acceptance
// are verifiable numbers, never vibes.

import type { FeedbackCategory, SolutionPatchOperation, SolutionQualityMap } from "./contract.js";

export const QUALITY_SCORE_MIN = 0;
export const QUALITY_SCORE_MAX = 1;

/** Scores are stored with 4 decimal places (fixture precision contract). */
export function roundQualityScore(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function clampQualityScore(value: number): number {
  return Math.min(QUALITY_SCORE_MAX, Math.max(QUALITY_SCORE_MIN, value));
}

/** Returns a new quality map with the delta applied (clamped, rounded). */
export function applyQualityDelta(
  quality: SolutionQualityMap,
  deficiencyClass: string,
  delta: number,
): SolutionQualityMap {
  if (!Number.isFinite(delta)) {
    throw new Error("applyQualityDelta requires a finite delta");
  }
  const base = quality[deficiencyClass];
  const current = base === undefined ? QUALITY_SCORE_MIN : base;
  const next = roundQualityScore(clampQualityScore(current + delta));
  return { ...quality, [deficiencyClass]: next };
}

/** Exact per-class deltas (after - before) over the union of classes. */
export function computeQualityDeltas(
  before: SolutionQualityMap,
  after: SolutionQualityMap,
): Readonly<Record<string, number>> {
  const classes = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const deltas: Record<string, number> = {};
  for (const deficiencyClass of classes) {
    const beforeScore = before[deficiencyClass] ?? QUALITY_SCORE_MIN;
    const afterScore = after[deficiencyClass] ?? QUALITY_SCORE_MIN;
    deltas[deficiencyClass] = roundQualityScore(afterScore - beforeScore);
  }
  return deltas;
}

/**
 * Deterministic feedback-category -> deficiency-class mapping. Every
 * category maps to exactly one fixture deficiency class so the
 * feedback -> evidence -> improvement loop is fully deterministic.
 */
export const FEEDBACK_CATEGORY_TO_DEFICIENCY: Readonly<Record<FeedbackCategory, string>> = {
  identity_mismatch: "identity",
  motion_naturalness: "motion-naturalness",
  geometry: "geometry",
  appearance: "appearance",
  style: "appearance",
  composition: "composition",
  behavior: "motion-naturalness",
  usability: "composition",
  other: "composition",
};

export function deficiencyClassForCategory(category: FeedbackCategory): string {
  return FEEDBACK_CATEGORY_TO_DEFICIENCY[category];
}

/**
 * Base improvement magnitude applied per accepted evidence round in the
 * Phase-0 fixture loop. The delta is clamped by the [0, 1] score bounds.
 */
export const DETERMINISTIC_IMPROVEMENT_BASE_DELTA = 0.15;

/** Weight of a provided fixture evidence item. */
export const FIXTURE_EVIDENCE_WEIGHT = 1;

export interface ImprovementOptions {
  /** Evidence weight in (0, 1]; fixture evidence weighs 1. */
  readonly evidenceWeight?: number;
  /** Override magnitude; defaults to DETERMINISTIC_IMPROVEMENT_BASE_DELTA. */
  readonly magnitude?: number;
}

/**
 * Proposes the exact adjust_quality operations for one deterministic
 * improvement round. Returns an empty list when already at the ceiling.
 */
export function proposeImprovementOperations(
  quality: SolutionQualityMap,
  deficiencyClass: string,
  options: ImprovementOptions = {},
): readonly SolutionPatchOperation[] {
  const evidenceWeight = options.evidenceWeight ?? FIXTURE_EVIDENCE_WEIGHT;
  if (!Number.isFinite(evidenceWeight) || evidenceWeight <= 0 || evidenceWeight > 1) {
    throw new Error("evidenceWeight must be a finite number in (0, 1]");
  }
  const magnitude = options.magnitude ?? DETERMINISTIC_IMPROVEMENT_BASE_DELTA;
  const current = quality[deficiencyClass];
  const base = current === undefined ? QUALITY_SCORE_MIN : current;
  const target = roundQualityScore(clampQualityScore(base + magnitude * evidenceWeight));
  const delta = roundQualityScore(target - base);
  if (delta <= 0) {
    return [];
  }
  return [{ op: "adjust_quality", deficiencyClass, delta }];
}
