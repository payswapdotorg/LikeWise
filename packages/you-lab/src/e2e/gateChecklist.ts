// Launch-gate checklist derivation (W12C).
//
// LAUNCH GATE LAW (docs/you/CONTRACTS.md "Wave-12 contract freeze
// (v12)"): a checklist point passes ONLY with a successful
// E2eJourneyRecord reference — never a bare assertion; the gate passes
// ONLY when all 20 points pass (YOU_LAUNCH_GATE_INVALID).
//
// This module derives the 20-point LaunchGateChecklist from the W11C
// journey harness outputs: point N passes only with point-N journey
// evidence — a journey run whose step-N record reached completed (or
// recovered through its runbook recovery path) as that step's last
// state. The derivation is a pure function of the provided journey set
// (input order selects the evidence journey deterministically: the
// first covering journey); the points are the authored 20-step table
// verbatim. A detached checklist — one that claims a point without its
// journey evidence, drifts from the derivation, misnames its content,
// or cites evidence outside the referenced bundle — is a typed
// YOU_LAUNCH_GATE_INVALID rejection (fail-closed, the law at the
// compute plane).
//
// The neutral shapes are aligned 1:1 with the frozen v12
// LaunchGateChecklistPoint/LaunchGateChecklistRecord; mapping onto the
// frozen contract happens ONLY in src/contractSeam.ts. No clock, no
// Math.random, no network.

import { canonicalJson } from "../determinism.js";
import { sha256Hex } from "../arena/arenaAdapterSeam.js";
import { JOURNEY_STEPS, LAUNCH_GATE_JOURNEY_LENGTH } from "./journeySteps.js";
import type { JourneyStepRecord, NeutralJourneyOutcome } from "./journeyHarness.js";
import { type NeutralEvidenceBundle, assertBundleContentAddressed, bundleRecordIds } from "./evidenceBundle.js";

/** Error code aligned with the frozen v12 typed error literal (the LAUNCH GATE LAW). */
export const LAUNCH_GATE_INVALID_CODE = "YOU_LAUNCH_GATE_INVALID";

/** Typed rejection thrown when a checklist input violates the LAUNCH GATE LAW (fail-closed). */
export class LaunchGateInvalidError extends Error {
  readonly code = LAUNCH_GATE_INVALID_CODE;
  constructor(detail: string) {
    super(`${LAUNCH_GATE_INVALID_CODE}: ${detail}`);
  }
}

/** Fixed fixture-mode gate-check timestamp (FIXTURES.md law: no clock; the journeys ran at 12:00). */
export const LAUNCH_GATE_CHECKED_AT = "2026-10-15T13:00:00Z";

/** Neutral checklist point — aligned 1:1 with the frozen v12 LaunchGateChecklistPoint. */
export interface NeutralLaunchGateChecklistPoint {
  /** 1-based position in the frozen 20-point launch-gate order (the journey step index). */
  readonly point: number;
  readonly description: string;
  /** The successful journey record evidencing the point (null when the point has no passing evidence). */
  readonly journeyEvidenceRef: string | null;
  readonly passed: boolean;
}

/** Neutral launch-gate checklist record — aligned 1:1 with the frozen v12 LaunchGateChecklistRecord. */
export interface NeutralLaunchGateChecklistRecord {
  readonly id: string;
  readonly points: readonly NeutralLaunchGateChecklistPoint[];
  readonly checkedAt: string;
  readonly simulated: boolean;
}

/**
 * Whether a journey run covers a launch-gate step: the step's LAST record
 * state is completed or recovered (a recovered step counts as covered
 * through its runbook recovery path; a terminally failed step does not).
 */
export function journeyCoversStep(outcome: NeutralJourneyOutcome, stepId: string): boolean {
  let last: JourneyStepRecord | null = null;
  for (const record of outcome.steps) {
    if (record.stepId === stepId) {
      last = record;
    }
  }
  return last !== null && (last.status === "completed" || last.status === "recovered");
}

const VALID_STEP_STATUSES: readonly string[] = ["completed", "failed", "recovered"];
const STEP_INDEX_BY_ID: ReadonlyMap<string, number> = new Map<string, number>(
  JOURNEY_STEPS.map((step) => [step.stepId, step.stepIndex] as [string, number]),
);

/** Fail-closed structural validation of one journey outcome (not a harness shape — never derived from). */
function assertWellFormedOutcome(outcome: NeutralJourneyOutcome): void {
  if (outcome.spec.journeyId.length === 0 || outcome.journeyRecord.id.length === 0) {
    throw new LaunchGateInvalidError("journey identity fields are empty (a checklist derives from named runs)");
  }
  if (outcome.steps.length === 0) {
    throw new LaunchGateInvalidError(
      `journey '${outcome.spec.journeyId}' has zero step records (the gate derives from journey evidence — never from nothing)`,
    );
  }
  let previousIndex = 0;
  for (const record of outcome.steps) {
    const authored = STEP_INDEX_BY_ID.get(record.stepId);
    if (authored === undefined) {
      throw new LaunchGateInvalidError(
        `journey '${outcome.spec.journeyId}': step '${record.stepId}' is outside the frozen 20-point launch-gate vocabulary`,
      );
    }
    if (record.stepIndex !== authored) {
      throw new LaunchGateInvalidError(
        `journey '${outcome.spec.journeyId}': step '${record.stepId}' carries stepIndex ${record.stepIndex} but the authored position is ${authored}`,
      );
    }
    if (!VALID_STEP_STATUSES.includes(record.status)) {
      throw new LaunchGateInvalidError(
        `journey '${outcome.spec.journeyId}': invalid step status '${String(record.status)}'`,
      );
    }
    if (record.stepIndex < previousIndex) {
      throw new LaunchGateInvalidError(
        `journey '${outcome.spec.journeyId}': step records are out of launch-gate order at step '${record.stepId}'`,
      );
    }
    previousIndex = record.stepIndex;
  }
}

/** Deterministic checklist-record id — you_gate_<16hex> (a pure function of the checkedAt + points content). */
export function checklistRecordId(points: readonly NeutralLaunchGateChecklistPoint[], checkedAt: string): string {
  return `you_gate_${sha256Hex(canonicalJson({ checkedAt, points })).slice(0, 16)}`;
}

/** Options for the checklist derivation and the law check. */
export interface LaunchGateChecklistOptions {
  /** The evidence bundle the checklist's evidence refs must resolve inside (verified content-addressed first). */
  readonly bundle?: NeutralEvidenceBundle;
  /** Fixed fixture timestamp (defaults to LAUNCH_GATE_CHECKED_AT; no clock). */
  readonly checkedAt?: string;
}

/**
 * Derive the 20-point launch-gate checklist from the journey harness
 * outputs — the LAUNCH GATE LAW at the compute plane. Point N passes
 * only with point-N journey evidence: the first journey (input order)
 * whose step-N record reached completed-or-recovered; a point with no
 * covering journey fails with a null evidence ref (never a bare
 * assertion). When a bundle is provided, every cited evidence ref must
 * resolve inside it (the checklist's evidence lives in the declaration's
 * referenced bundle — a citation outside it is a typed refusal).
 */
export function deriveLaunchGateChecklist(
  outcomes: readonly NeutralJourneyOutcome[],
  options: LaunchGateChecklistOptions = {},
): NeutralLaunchGateChecklistRecord {
  if (outcomes.length === 0) {
    throw new LaunchGateInvalidError(
      "zero journeys to check — the gate derives from journey evidence, never from nothing (an all-red checklist from an empty run set is refused)",
    );
  }
  for (const outcome of outcomes) {
    assertWellFormedOutcome(outcome);
  }
  const checkedAt = options.checkedAt ?? LAUNCH_GATE_CHECKED_AT;
  if (checkedAt.length === 0) {
    throw new LaunchGateInvalidError("empty checkedAt (a checklist names its check instant)");
  }
  const bundle = options.bundle;
  let bundleIds: readonly string[] | null = null;
  let bundleId = "";
  if (bundle !== undefined) {
    assertBundleContentAddressed(bundle);
    bundleIds = bundleRecordIds(bundle);
    bundleId = bundle.id;
  }
  const points: NeutralLaunchGateChecklistPoint[] = JOURNEY_STEPS.map((step) => {
    const covering = outcomes.find((outcome) => journeyCoversStep(outcome, step.stepId));
    const ref = covering === undefined ? null : covering.journeyRecord.id;
    if (ref !== null && bundleIds !== null && !bundleIds.includes(ref)) {
      throw new LaunchGateInvalidError(
        `point ${step.stepIndex} cites journey evidence '${ref}' outside the referenced bundle '${bundleId}' (the checklist's evidence lives inside the declaration's bundle)`,
      );
    }
    return Object.freeze({
      point: step.stepIndex,
      description: step.description,
      journeyEvidenceRef: ref,
      passed: ref !== null,
    } satisfies NeutralLaunchGateChecklistPoint);
  });
  return Object.freeze({
    id: checklistRecordId(points, checkedAt),
    points: Object.freeze(points),
    checkedAt,
    simulated: true,
  } satisfies NeutralLaunchGateChecklistRecord);
}

/** The gate passes ONLY when all 20 points pass with journey evidence (the LAUNCH GATE LAW). */
export function gatePasses(checklist: NeutralLaunchGateChecklistRecord): boolean {
  return (
    checklist.points.length === LAUNCH_GATE_JOURNEY_LENGTH &&
    checklist.points.every((point) => point.passed && point.journeyEvidenceRef !== null)
  );
}

/** Derived counting projection over a checklist (informs, never decides). */
export interface LaunchGateSummary {
  readonly pointsTotal: number;
  readonly pointsPassed: number;
  readonly pointsFailed: number;
  readonly allPointsPassed: boolean;
}

/** Summarize a checklist (derived counting projection — honest display data). */
export function summarizeLaunchGate(checklist: NeutralLaunchGateChecklistRecord): LaunchGateSummary {
  const passed = checklist.points.filter((point) => point.passed).length;
  return {
    pointsTotal: checklist.points.length,
    pointsPassed: passed,
    pointsFailed: checklist.points.length - passed,
    allPointsPassed: gatePasses(checklist),
  };
}

/**
 * LAUNCH GATE LAW fail-closed check: the checklist must BE the
 * derivation over the provided journeys — the 20-point authored table in
 * order, the id recomputing from its own content, passed iff a
 * journey-evidence ref is present, and every point exactly what the
 * evidence recomputes. A detached or doctored checklist is a typed
 * rejection, never a silent pass (the "refuse construction when the
 * derivation shifts" law).
 */
export function assertLaunchGateChecklistLaw(
  checklist: NeutralLaunchGateChecklistRecord,
  outcomes: readonly NeutralJourneyOutcome[],
  options: LaunchGateChecklistOptions = {},
): void {
  if (checklist.id.length === 0) {
    throw new LaunchGateInvalidError("empty checklist id (a checklist is content-named)");
  }
  if (checklist.checkedAt.length === 0) {
    throw new LaunchGateInvalidError("empty checkedAt (a checklist names its check instant)");
  }
  if (checklist.simulated !== true) {
    throw new LaunchGateInvalidError(
      "simulated must be true (an unlabelled checklist is a truth-law fabrication)",
    );
  }
  if (checklist.points.length !== LAUNCH_GATE_JOURNEY_LENGTH) {
    throw new LaunchGateInvalidError(
      `the launch gate is the ${LAUNCH_GATE_JOURNEY_LENGTH}-point checklist (got ${checklist.points.length}) — the gate passes ONLY when all ${LAUNCH_GATE_JOURNEY_LENGTH} points pass`,
    );
  }
  checklist.points.forEach((point, i) => {
    const step = JOURNEY_STEPS[i]!;
    if (point.point !== i + 1) {
      throw new LaunchGateInvalidError(
        `point at position ${i + 1} carries number ${point.point} (the points are the authored table in order)`,
      );
    }
    if (point.description.length === 0) {
      throw new LaunchGateInvalidError(`point ${point.point} carries an empty description`);
    }
    if (point.description !== step.description) {
      throw new LaunchGateInvalidError(
        `point ${point.point}'s description is not the authored step description (the points are the authored table)`,
      );
    }
    if (point.passed && point.journeyEvidenceRef === null) {
      throw new LaunchGateInvalidError(
        `point ${point.point} passes with no journey evidence — never a bare assertion (the LAUNCH GATE LAW)`,
      );
    }
    if (!point.passed && point.journeyEvidenceRef !== null) {
      throw new LaunchGateInvalidError(
        `point ${point.point} cites journey evidence '${point.journeyEvidenceRef}' but does not pass on it (the ref is the point's passing evidence)`,
      );
    }
  });
  const recomputedId = checklistRecordId(checklist.points, checklist.checkedAt);
  if (checklist.id !== recomputedId) {
    throw new LaunchGateInvalidError(
      `checklist '${checklist.id}' fails its content name (the points recompute to '${recomputedId}') — an id asserted over different points is a fabrication`,
    );
  }
  // the recompute: the checklist must equal the derivation over the evidence
  const derived = deriveLaunchGateChecklist(outcomes, { ...options, checkedAt: checklist.checkedAt });
  checklist.points.forEach((point, i) => {
    const derivedPoint = derived.points[i]!;
    if (point.journeyEvidenceRef !== derivedPoint.journeyEvidenceRef || point.passed !== derivedPoint.passed) {
      throw new LaunchGateInvalidError(
        `point ${point.point} diverges from the journey evidence (checklist: ${
          point.passed ? `passed on '${point.journeyEvidenceRef}'` : "failed with no evidence"
        }; derived: ${
          derivedPoint.passed ? `passed on '${derivedPoint.journeyEvidenceRef}'` : "failed with no evidence"
        }) — the LAUNCH GATE LAW never accepts a detached checklist`,
      );
    }
  });
}
