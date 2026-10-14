// E2E journey step vocabulary (W11C).
//
// Authority: docs/you/WORK_ORDERS.md W11C — the 20-point launch-gate
// journey (workspace creation -> intent -> Solution -> inspect -> feedback
// -> evidence -> Twin -> improve -> Performance -> render -> edit ->
// import/export -> version accept -> learn with permission -> repeat ->
// capability gap -> Arena escalation -> expert result -> provenance/
// consent -> injected-failure recovery) and the JOURNEY LAW
// (docs/you/CONTRACTS.md "Wave-11 contract freeze (v11)"): the 20-point
// launch-gate journey records every step (completed or failed-at) with
// measured duration; simulated runs stay labeled.
//
// This module owns the AUTHORED journey vocabulary: the 20 step ids in
// their frozen launch-gate order, the incident-class vocabulary (one
// class per step plus the two DR-plane classes the deterministic journey
// harness cannot exercise), and the shared validation helpers. Pure
// tables and pure functions — no clock, no randomness, no network. The
// step description strings are authored you-lab fixture descriptions
// aligned with the frozen YOU contract vocabulary (Solution, Twin,
// Performance, Arena, capability gap, provenance/consent) — never claims
// about a real product deployment.

/** Error code aligned with the frozen v11 typed error literal (the JOURNEY LAW). */
export const E2E_JOURNEY_INVALID_CODE = "YOU_E2E_JOURNEY_INVALID";

/** Typed rejection thrown when a journey spec/record violates the JOURNEY LAW (fail-closed). */
export class E2eJourneyInvalidError extends Error {
  readonly code = E2E_JOURNEY_INVALID_CODE;
  constructor(detail: string) {
    super(`${E2E_JOURNEY_INVALID_CODE}: ${detail}`);
  }
}

/** The launch-gate journey length (frozen: the 20-point path). */
export const LAUNCH_GATE_JOURNEY_LENGTH = 20;

/** One step of the authored 20-point launch-gate journey. */
export interface JourneyStepSpec {
  /** 1-based position in the frozen launch-gate order. */
  readonly stepIndex: number;
  /** Stable authored step id (kebab-case, frozen at W11C). */
  readonly stepId: string;
  /** One-line authored description of what the point covers. */
  readonly description: string;
}

/**
 * The 20-point launch-gate journey — the authored W11C fixture table, in
 * the exact order of the work order. The final point
 * (injected-failure-recovery) is the journey's own recovery drill: every
 * journey run through the harness exercises an injected failure there.
 */
export const JOURNEY_STEPS: readonly JourneyStepSpec[] = [
  { stepIndex: 1, stepId: "workspace-creation", description: "the workspace is created for the journey actor" },
  { stepIndex: 2, stepId: "intent", description: "the actor's intent is captured and validated" },
  { stepIndex: 3, stepId: "solution", description: "the first Solution version is composed from the intent" },
  { stepIndex: 4, stepId: "inspect", description: "the actor inspects the Solution state snapshot" },
  { stepIndex: 5, stepId: "feedback", description: "the actor submits a feedback request on the inspected state" },
  { stepIndex: 6, stepId: "evidence", description: "evidence is captured for the open feedback request" },
  { stepIndex: 7, stepId: "twin", description: "the Twin version is published from the bound evidence" },
  { stepIndex: 8, stepId: "improve", description: "the Twin is improved from its recorded deficiencies" },
  { stepIndex: 9, stepId: "performance", description: "the Performance timeline is published from the improved Twin" },
  { stepIndex: 10, stepId: "render", description: "the render job produces its reviewed artifact" },
  { stepIndex: 11, stepId: "edit", description: "the edit session proposes a change set on the rendered state" },
  { stepIndex: 12, stepId: "import-export", description: "the editing round-trip import/export completes" },
  { stepIndex: 13, stepId: "version-accept", description: "the candidate version is accepted as the new canonical version" },
  { stepIndex: 14, stepId: "learn-with-permission", description: "learning records are validated under the recorded learning rights" },
  { stepIndex: 15, stepId: "repeat", description: "the improved path is re-run end-to-end (the repeat point)" },
  { stepIndex: 16, stepId: "capability-gap", description: "a capability gap is detected and recorded on the repeat path" },
  { stepIndex: 17, stepId: "arena-escalation", description: "the recorded gap escalates to the Arena under its authorization" },
  { stepIndex: 18, stepId: "expert-result", description: "the Arena expert result is delivered and applied" },
  { stepIndex: 19, stepId: "provenance-consent", description: "provenance and consent are verified across the whole journey record" },
  { stepIndex: 20, stepId: "injected-failure-recovery", description: "the injected-failure recovery drill (the journey's own recovery exercise)" },
];

/** The authored step ids in launch-gate order. */
export const JOURNEY_STEP_IDS: readonly string[] = JOURNEY_STEPS.map((step) => step.stepId);

/** The final launch-gate point — the injected-failure recovery drill step. */
export const JOURNEY_DRILL_STEP_ID = "injected-failure-recovery";

/** Look up a step spec by id (null when unknown — callers throw their own typed errors). */
export function journeyStepById(stepId: string): JourneyStepSpec | null {
  return JOURNEY_STEPS.find((step) => step.stepId === stepId) ?? null;
}

/** 1-based launch-gate index for a step id (0 when unknown). */
export function journeyStepIndex(stepId: string): number {
  return journeyStepById(stepId)?.stepIndex ?? 0;
}

/** Fail-closed step-id validation (JOURNEY LAW — unknown steps are never guessed). */
export function assertKnownJourneyStep(stepId: string): JourneyStepSpec {
  const step = journeyStepById(stepId);
  if (step === null) {
    throw new E2eJourneyInvalidError(
      `unknown journey step '${stepId}' (the 20-point launch-gate vocabulary is frozen; extension requires a W11C table update)`,
    );
  }
  return step;
}

// ---------------------------------------------------------------------------
// Incident classes (the runbook vocabulary)
// ---------------------------------------------------------------------------

/**
 * One incident class of the W11C incident vocabulary. Every class maps
 * 1:1 onto a launch-gate step (the failure mode of that point), EXCEPT
 * the DR-plane classes whose `stepId` is null: those incidents belong to
 * the wave-9/10 hardening planes and the deterministic journey harness
 * cannot inject them — their runbook entries stay explicitly marked
 * unexercised (the RUNBOOK LAW's honest branch).
 */
export interface IncidentClassSpec {
  readonly incidentClass: string;
  /** The launch-gate step whose failure mode this class names (null for DR-plane classes). */
  readonly stepId: string | null;
}

/**
 * The W11C incident-class vocabulary — one failure class per launch-gate
 * point (20 classes) plus two DR-plane classes the journey harness
 * cannot exercise (provider-region-outage belongs to the W10 provider
 * matrix plane; retention-expiry-breach to the W9 retention plane).
 */
export const INCIDENT_CLASSES: readonly IncidentClassSpec[] = [
  { incidentClass: "workspace-creation-failed", stepId: "workspace-creation" },
  { incidentClass: "intent-capture-failed", stepId: "intent" },
  { incidentClass: "solution-creation-failed", stepId: "solution" },
  { incidentClass: "solution-inspect-failed", stepId: "inspect" },
  { incidentClass: "feedback-submission-failed", stepId: "feedback" },
  { incidentClass: "evidence-capture-failed", stepId: "evidence" },
  { incidentClass: "twin-publication-failed", stepId: "twin" },
  { incidentClass: "twin-improvement-failed", stepId: "improve" },
  { incidentClass: "performance-publication-failed", stepId: "performance" },
  { incidentClass: "render-job-failed", stepId: "render" },
  { incidentClass: "edit-session-failed", stepId: "edit" },
  { incidentClass: "import-export-failed", stepId: "import-export" },
  { incidentClass: "version-acceptance-failed", stepId: "version-accept" },
  { incidentClass: "learning-permission-failed", stepId: "learn-with-permission" },
  { incidentClass: "repeat-run-failed", stepId: "repeat" },
  { incidentClass: "capability-gap-detected", stepId: "capability-gap" },
  { incidentClass: "arena-escalation-failed", stepId: "arena-escalation" },
  { incidentClass: "expert-result-failed", stepId: "expert-result" },
  { incidentClass: "provenance-consent-failed", stepId: "provenance-consent" },
  { incidentClass: "recovery-drill-failed", stepId: "injected-failure-recovery" },
  { incidentClass: "provider-region-outage", stepId: null },
  { incidentClass: "retention-expiry-breach", stepId: null },
];

/** The authored incident-class names in table order. */
export const INCIDENT_CLASS_NAMES: readonly string[] = INCIDENT_CLASSES.map((entry) => entry.incidentClass);

/** Look up an incident class spec (null when unknown). */
export function incidentClassSpec(incidentClass: string): IncidentClassSpec | null {
  return INCIDENT_CLASSES.find((entry) => entry.incidentClass === incidentClass) ?? null;
}

/** The incident class naming a launch-gate step's failure mode (null when the step has none/unknown). */
export function incidentClassForStep(stepId: string): string | null {
  return INCIDENT_CLASSES.find((entry) => entry.stepId === stepId)?.incidentClass ?? null;
}

/**
 * The DR-plane incident classes — the classes the deterministic journey
 * harness CANNOT exercise (their runbook entries stay explicitly marked
 * unexercised per the RUNBOOK LAW).
 */
export const UNEXERCISABLE_INCIDENT_CLASSES: readonly string[] = INCIDENT_CLASSES
  .filter((entry) => entry.stepId === null)
  .map((entry) => entry.incidentClass);
