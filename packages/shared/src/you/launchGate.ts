// YOU LaunchGateChecklistRecord machinery (W12A — docs/you/CONTRACTS.md
// "Wave-12 contract freeze (v12)": "LaunchGateChecklistRecord"; the LAUNCH
// GATE LAW: a checklist point passes ONLY with a successful
// E2eJourneyRecord reference — never a bare assertion; the gate passes
// ONLY when all 20 points pass (YOU_LAUNCH_GATE_INVALID)).
//
// This module owns the STATELESS validators, the canonical 20-point
// launch-gate table and the immutable checklist constructor
// (WORK_ORDERS.md W12A: "the 20-point checklist built from
// E2eJourneyRecord evidence (a point passes ONLY with a successful
// journey reference — the LAUNCH GATE LAW)"). Validation is pure: no
// clock, no rng, no store — the service maps refusals to typed
// YOU_LAUNCH_GATE_INVALID errors at its seam.
//
// THE LAUNCH GATE LAW's construct-time teeth (the DR LAW's
// verified-without-evidence precedent, carried to the gate):
//   - the checklist intake carries ONLY journey evidence — one
//     E2eJourneyRecord (or null) per point, in point order. There is NO
//     passed flag to assert: `passed` is DERIVED inside this single
//     authority from the evidence (a successful journey record:
//     stepsCompleted === 20 with failedStep null — the clean golden
//     path; a recovered journey that names its failed-at step is honest
//     recovery evidence, not a clean gate pass), so a bare assertion is
//     structurally impossible;
//   - the checklist is exactly the canonical 20 points (wrong count =>
//     refusal "checklist-incomplete"; the point numbers and
//     descriptions come from the frozen table below, never from the
//     caller);
//   - a point with an unsuccessful (or absent) journey reference
//     records passed: false honestly — the failing evidence reference
//     is preserved on the point (never summarized away).
//
// The canonical table is authored here as the launch-gate authority's
// own frozen vocabulary, aligned 1:1 with the W11C journey step table
// (packages/you-lab/src/e2e/journeySteps.ts — the same 20 points, the
// same order, the same stepIds and descriptions). The shared authority
// cannot import you-lab (the dependency arrow points the other way);
// the alignment is test-pinned on the you-lab side by W12C's seam.
//
// Phase 0: every constructed record stays `simulated: true` (the truth
// law); journey evidence arrives as record VALUES (the W11C harness
// domain), never as wall-clock claims.

import type { E2eJourneyRecord, LaunchGateChecklistPoint, LaunchGateChecklistRecord, OpaqueId } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** The launch-gate checklist length (frozen: the 20-point gate). */
export const LAUNCH_GATE_CHECKLIST_LENGTH = 20;

/**
 * The launch-gate journey length a successful evidence record must have
 * completed (frozen: the 20-point journey — mirrors the W11C
 * LAUNCH_GATE_JOURNEY_LENGTH).
 */
export const LAUNCH_GATE_JOURNEY_LENGTH = 20;

/** One point of the canonical 20-point launch-gate table. */
export interface LaunchGatePointSpec {
  /** 1-based position in the frozen launch-gate order. */
  readonly point: number;
  /** Stable step id (kebab-case; aligned 1:1 with the W11C journey vocabulary). */
  readonly stepId: string;
  /** One-line authored description of what the point covers. */
  readonly description: string;
}

/**
 * The canonical 20-point launch-gate table — the W12A authority's frozen
 * checklist vocabulary, in the exact order of the work order (the W11C
 * journey table mirrored on the shared side). The checklist constructor
 * copies point numbers and descriptions from here; callers never supply
 * their own points.
 */
export const LAUNCH_GATE_POINTS: readonly LaunchGatePointSpec[] = [
  { point: 1, stepId: "workspace-creation", description: "the workspace is created for the journey actor" },
  { point: 2, stepId: "intent", description: "the actor's intent is captured and validated" },
  { point: 3, stepId: "solution", description: "the first Solution version is composed from the intent" },
  { point: 4, stepId: "inspect", description: "the actor inspects the Solution state snapshot" },
  { point: 5, stepId: "feedback", description: "the actor submits a feedback request on the inspected state" },
  { point: 6, stepId: "evidence", description: "evidence is captured for the open feedback request" },
  { point: 7, stepId: "twin", description: "the Twin version is published from the bound evidence" },
  { point: 8, stepId: "improve", description: "the Twin is improved from its recorded deficiencies" },
  { point: 9, stepId: "performance", description: "the Performance timeline is published from the improved Twin" },
  { point: 10, stepId: "render", description: "the render job produces its reviewed artifact" },
  { point: 11, stepId: "edit", description: "the edit session proposes a change set on the rendered state" },
  { point: 12, stepId: "import-export", description: "the editing round-trip import/export completes" },
  { point: 13, stepId: "version-accept", description: "the candidate version is accepted as the new canonical version" },
  { point: 14, stepId: "learn-with-permission", description: "learning records are validated under the recorded learning rights" },
  { point: 15, stepId: "repeat", description: "the improved path is re-run end-to-end (the repeat point)" },
  { point: 16, stepId: "capability-gap", description: "a capability gap is detected and recorded on the repeat path" },
  { point: 17, stepId: "arena-escalation", description: "the recorded gap escalates to the Arena under its authorization" },
  { point: 18, stepId: "expert-result", description: "the Arena expert result is delivered and applied" },
  { point: 19, stepId: "provenance-consent", description: "provenance and consent are verified across the whole journey record" },
  { point: 20, stepId: "injected-failure-recovery", description: "the injected-failure recovery drill (the journey's own recovery exercise)" },
];

/** A refusal returned by the stateless validators (never an exception). */
export interface LaunchGateRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * True when the journey record is a SUCCESSFUL launch-gate journey: all
 * 20 steps completed with no failed step (the clean golden path — the
 * JOURNEY LAW's success form). A recovered journey that names its
 * failed-at step (failedStep non-null) is honest recovery evidence for
 * the runbook plane, NOT a clean gate pass; a partial journey
 * (stepsCompleted < 20) stopped early and is not a pass either.
 */
export function isSuccessfulJourneyRecord(journey: E2eJourneyRecord): boolean {
  return journey.failedStep === null && journey.stepsCompleted === LAUNCH_GATE_JOURNEY_LENGTH;
}

/**
 * The stateless journey-evidence validator (the single evidence-shape
 * authority): id a non-empty opaque id, journeyId a non-empty string,
 * stepsCompleted an integer within [0, 20], failedStep null or a
 * non-empty step id (an empty string is a lie — null is the honest
 * no-failure form), durationMs a finite non-negative number.
 */
export function validateJourneyEvidence(journey: E2eJourneyRecord | null): LaunchGateRefusal | null {
  if (journey === null) {
    return null;
  }
  if (typeof journey !== "object") {
    return { reason: "journey-evidence-malformed", detail: "journey evidence must be an E2eJourneyRecord or null" };
  }
  if (typeof journey.id !== "string" || journey.id.trim().length === 0) {
    return { reason: "journey-record-id-empty", detail: "the journey record's id must be a non-empty opaque id" };
  }
  if (typeof journey.journeyId !== "string" || journey.journeyId.trim().length === 0) {
    return { reason: "journey-id-empty", detail: "journeyId must be a non-empty string (a journey names itself)" };
  }
  if (!Number.isSafeInteger(journey.stepsCompleted) || journey.stepsCompleted < 0 || journey.stepsCompleted > LAUNCH_GATE_JOURNEY_LENGTH) {
    return {
      reason: "steps-completed-invalid",
      detail: `stepsCompleted must be an integer within [0, ${LAUNCH_GATE_JOURNEY_LENGTH}] (the honest completed-or-failed-at prefix)`,
    };
  }
  if (journey.failedStep !== null && (typeof journey.failedStep !== "string" || journey.failedStep.length === 0)) {
    return { reason: "failed-step-invalid", detail: "failedStep must be null (no failure) or a non-empty step id" };
  }
  if (!Number.isFinite(journey.durationMs) || journey.durationMs < 0) {
    return { reason: "duration-ms-invalid", detail: "durationMs must be a finite non-negative number of milliseconds" };
  }
  return null;
}

/**
 * The checklist intake: ONLY journey evidence, one entry per point, in
 * point order (entry i evidences point i+1). A null entry records a
 * point with no evidence yet (passed: false, journeyEvidenceRef: null —
 * the honest unevidenced form). There is no passed flag to assert —
 * THE LAUNCH GATE LAW's never-a-bare-assertion clause is structural.
 */
export interface LaunchGateChecklistIntake {
  readonly journeys: readonly (E2eJourneyRecord | null)[];
}

/**
 * The stateless checklist-intake validator: exactly 20 evidence entries
 * (wrong count => "checklist-incomplete" — the gate is the FULL 20
 * points, never a prefix or an extension), each entry null or a
 * well-formed E2eJourneyRecord.
 */
export function validateLaunchGateChecklistIntake(intake: LaunchGateChecklistIntake): LaunchGateRefusal | null {
  if (intake === null || typeof intake !== "object" || !Array.isArray(intake.journeys)) {
    return { reason: "journeys-malformed", detail: "journeys must be a list of E2eJourneyRecord-or-null evidence entries" };
  }
  if (intake.journeys.length !== LAUNCH_GATE_CHECKLIST_LENGTH) {
    return {
      reason: "checklist-incomplete",
      detail: `the launch-gate checklist is exactly ${LAUNCH_GATE_CHECKLIST_LENGTH} points (received ${intake.journeys.length} evidence entries — the gate is the full table, never a prefix or an extension)`,
    };
  }
  for (const journey of intake.journeys) {
    const refusal = validateJourneyEvidence(journey ?? null);
    if (refusal !== null) {
      return refusal;
    }
  }
  return null;
}

/**
 * Constructs the immutable, deep-frozen checklist record — THE LAUNCH
 * GATE LAW's teeth: the 20 points come from the canonical table (point
 * number + description), `passed` is DERIVED from each point's journey
 * evidence (true ONLY for a successful journey record — never a bare
 * assertion), and the evidence reference is preserved verbatim (null
 * stays null; an unsuccessful journey's ref stays on its failing point,
 * never summarized away).
 */
export function constructLaunchGateChecklistRecord(
  input: {
    readonly id: OpaqueId;
    readonly checkedAt: string;
  },
  intake: LaunchGateChecklistIntake,
): { readonly ok: true; readonly record: LaunchGateChecklistRecord } | { readonly ok: false; readonly refusal: LaunchGateRefusal } {
  if (typeof input.checkedAt !== "string" || input.checkedAt.length === 0) {
    return { ok: false, refusal: { reason: "checked-at-missing", detail: "checkedAt must be a non-empty ISO-8601 string" } };
  }
  const validated = validateLaunchGateChecklistIntake(intake);
  if (validated !== null) {
    return { ok: false, refusal: validated };
  }
  const points: LaunchGateChecklistPoint[] = [];
  for (let index = 0; index < LAUNCH_GATE_CHECKLIST_LENGTH; index += 1) {
    const spec = LAUNCH_GATE_POINTS[index];
    if (spec === undefined) {
      return { ok: false, refusal: { reason: "checklist-incomplete", detail: "the canonical launch-gate table is inconsistent" } };
    }
    const journey = intake.journeys[index] ?? null;
    points.push({
      point: spec.point,
      description: spec.description,
      journeyEvidenceRef: journey === null ? null : journey.id,
      passed: journey !== null && isSuccessfulJourneyRecord(journey),
    });
  }
  return {
    ok: true,
    record: deepFreeze({
      id: input.id,
      points,
      checkedAt: input.checkedAt,
      simulated: true,
    }),
  };
}

/** The number of points that passed (0..20). */
export function launchGatePassedCount(record: LaunchGateChecklistRecord): number {
  let passedCount = 0;
  for (const point of record.points) {
    if (point.passed) {
      passedCount += 1;
    }
  }
  return passedCount;
}

/**
 * True when the gate PASSES: all 20 points passed (the LAUNCH GATE LAW's
 * gate-passes-only-when-all-20-pass clause). The operator signoff
 * requires this.
 */
export function launchGatePasses(record: LaunchGateChecklistRecord): boolean {
  return isCompleteLaunchGateChecklist(record) && launchGatePassedCount(record) === LAUNCH_GATE_CHECKLIST_LENGTH;
}

/**
 * True when the record is a COMPLETE checklist: exactly 20 points with
 * point numbers 1..20 in ascending order (the OPERATOR SIGNOFF LAW's
 * complete-checklist requirement). Records constructed by the single
 * authority are complete by construction; this check re-verifies the
 * shape for records that arrive from outside (replayed or handed over).
 */
export function isCompleteLaunchGateChecklist(record: LaunchGateChecklistRecord | null): boolean {
  if (record === null || typeof record !== "object" || !Array.isArray(record.points)) {
    return false;
  }
  if (record.points.length !== LAUNCH_GATE_CHECKLIST_LENGTH) {
    return false;
  }
  for (let index = 0; index < LAUNCH_GATE_CHECKLIST_LENGTH; index += 1) {
    const point = record.points[index];
    if (point === undefined || point.point !== index + 1) {
      return false;
    }
  }
  return true;
}
