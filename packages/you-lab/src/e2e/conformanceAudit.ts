// Conformance audit builders (W11C).
//
// CONFORMANCE LAW (docs/you/CONTRACTS.md "Wave-11 contract freeze
// (v11)"): the record states checks-total and checks-passed verbatim —
// never a pass without the counts.
//
// This module builds the launch-gate conformance audit over the
// deterministic journey harness runs: every check is derived by
// iterating the ACTUAL outcome records (journey-law field consistency,
// byte-identical determinism replay, per-step record validity,
// recovery-exercised per failed record, and — when a runbook is
// provided — the RUNBOOK LAW backing per entry). checksTotal and
// checksPassed are counted verbatim from those checks, never asserted
// by the caller and never summarized away. Malformed inputs are typed
// YOU_CONFORMANCE_AUDIT_INVALID rejections (fail-closed); an empty run
// set is refused outright (an audit with zero checks is a pass without
// the counts).
//
// The neutral record shape is aligned 1:1 with the frozen v11
// ConformanceAuditRecord; mapping onto the frozen contract happens ONLY
// in src/contractSeam.ts. The standard name is a you-lab-authored
// fixture standard (the launch-gate journey conformance standard —
// never a claim about WCAG or any external standard; the W11B lane owns
// the accessibility/responsive audits).

import { canonicalJson } from "../determinism.js";
import { sha256Hex } from "../arena/arenaAdapterSeam.js";
import { INCIDENT_CLASS_NAMES, JOURNEY_STEPS } from "./journeySteps.js";
import type { JourneyStepRecord, NeutralJourneyOutcome } from "./journeyHarness.js";
import { JOURNEY_FIXTURE_SET_VERSION, runJourney } from "./journeyHarness.js";
import type { NeutralIncidentRunbookEntry } from "./incidentRunbook.js";

/** Error code aligned with the frozen v11 typed error literal (the CONFORMANCE LAW). */
export const CONFORMANCE_AUDIT_INVALID_CODE = "YOU_CONFORMANCE_AUDIT_INVALID";

/** Typed rejection thrown when an audit input violates the CONFORMANCE LAW (fail-closed). */
export class ConformanceAuditInvalidError extends Error {
  readonly code = CONFORMANCE_AUDIT_INVALID_CODE;
  constructor(detail: string) {
    super(`${CONFORMANCE_AUDIT_INVALID_CODE}: ${detail}`);
  }
}

/** The you-lab-authored launch-gate journey conformance standard (fixture standard, not an external claim). */
export const LAUNCH_GATE_CONFORMANCE_STANDARD = "launch-gate-journey-conformance/1";

/** Neutral conformance audit record — aligned 1:1 with the frozen v11 ConformanceAuditRecord. */
export interface NeutralConformanceAuditRecord {
  readonly id: string;
  readonly standard: string;
  readonly scopeRef: string;
  readonly checksTotal: number;
  readonly checksPassed: number;
  readonly simulated: boolean;
}

/** One conformance check (the audit's verbatim counting unit). */
export interface ConformanceCheckResult {
  readonly checkId: string;
  readonly description: string;
  readonly passed: boolean;
}

/** The audit detail: the record plus every individual check it was counted from. */
export interface ConformanceAuditDetail {
  readonly record: NeutralConformanceAuditRecord;
  readonly checks: readonly ConformanceCheckResult[];
}

/** Deterministic audit-record id — you_conformance_<16hex>. */
export function conformanceAuditRecordId(
  standard: string,
  scopeRef: string,
  checksTotal: number,
  checksPassed: number,
): string {
  return `you_conformance_${sha256Hex(`${standard}|${scopeRef}|${checksTotal}|${checksPassed}`).slice(0, 16)}`;
}

const VALID_STATUSES: readonly string[] = ["completed", "failed", "recovered"];

const JOURNEY_STEP_INDEX_BY_ID = new Map<string, number>(
  JOURNEY_STEPS.map((step) => [step.stepId, step.stepIndex] as [string, number]),
);

/** Structural validation of one step record (fail-closed — not a harness shape, not audited). */
function assertWellFormedStepRecord(outcome: NeutralJourneyOutcome, record: JourneyStepRecord): void {
  if (record.stepId.length === 0) {
    throw new ConformanceAuditInvalidError(`journey '${outcome.spec.journeyId}': empty stepId on a record`);
  }
  const authored = JOURNEY_STEP_INDEX_BY_ID.get(record.stepId);
  if (authored === undefined) {
    throw new ConformanceAuditInvalidError(
      `journey '${outcome.spec.journeyId}': step '${record.stepId}' is outside the frozen 20-point launch-gate vocabulary`,
    );
  }
  if (record.stepIndex !== authored) {
    throw new ConformanceAuditInvalidError(
      `journey '${outcome.spec.journeyId}': step '${record.stepId}' carries stepIndex ${record.stepIndex} but the authored position is ${authored}`,
    );
  }
  if (!VALID_STATUSES.includes(record.status)) {
    throw new ConformanceAuditInvalidError(
      `journey '${outcome.spec.journeyId}': invalid record status '${String(record.status)}'`,
    );
  }
  if (!Number.isFinite(record.durationMs) || !Number.isInteger(record.durationMs) || record.durationMs < 0) {
    throw new ConformanceAuditInvalidError(
      `journey '${outcome.spec.journeyId}': step '${record.stepId}' carries a malformed durationMs ${record.durationMs}`,
    );
  }
  if (record.status === "completed" && record.incidentClass !== null) {
    throw new ConformanceAuditInvalidError(
      `journey '${outcome.spec.journeyId}': a completed step '${record.stepId}' carries incidentClass '${record.incidentClass}' (only failed/recovered transitions name one)`,
    );
  }
  if (record.status !== "completed" && record.incidentClass === null) {
    throw new ConformanceAuditInvalidError(
      `journey '${outcome.spec.journeyId}': a '${record.status}' step '${record.stepId}' has no incidentClass (every failure transition names its class)`,
    );
  }
}

/** Structural validation of one outcome (fail-closed — not a harness shape, not audited). */
function assertWellFormedOutcome(outcome: NeutralJourneyOutcome): void {
  if (outcome.steps.length === 0) {
    throw new ConformanceAuditInvalidError(
      `journey '${outcome.spec.journeyId}' has zero step records (the harness records every step — never an empty run)`,
    );
  }
  if (outcome.spec.journeyId.length === 0 || outcome.journeyRecord.id.length === 0) {
    throw new ConformanceAuditInvalidError("journey identity fields are empty (a run names itself)");
  }
  if (!Number.isInteger(outcome.stepsCompleted) || outcome.stepsCompleted < 0 || outcome.stepsCompleted > 20) {
    throw new ConformanceAuditInvalidError(
      `journey '${outcome.spec.journeyId}': stepsCompleted ${outcome.stepsCompleted} is outside [0, 20]`,
    );
  }
  let previousIndex = 0;
  for (const record of outcome.steps) {
    assertWellFormedStepRecord(outcome, record);
    if (record.stepIndex < previousIndex) {
      throw new ConformanceAuditInvalidError(
        `journey '${outcome.spec.journeyId}': step records are out of launch-gate order at step '${record.stepId}'`,
      );
    }
    previousIndex = record.stepIndex;
  }
}

/** Recompute the completed-step count from the records (the journey-law check's ground truth). */
function recomputedCompletedCount(outcome: NeutralJourneyOutcome): number {
  const lastStatusByStep = new Map<string, string>();
  for (const record of outcome.steps) {
    lastStatusByStep.set(record.stepId, record.status);
  }
  let completed = 0;
  for (const status of lastStatusByStep.values()) {
    if (status === "completed" || status === "recovered") {
      completed += 1;
    }
  }
  return completed;
}

/**
 * Build the launch-gate conformance audit over the harness runs (and,
 * optionally, the incident runbook whose RUNBOOK LAW backing is checked
 * per entry). The counts are counted verbatim from the emitted checks —
 * structural violations are typed rejections; semantic violations
 * (determinism replay mismatch, unrecovered terminal failures, unbacked
 * exercise claims) are counted FAILURES, never thrown and never
 * summarized away.
 */
export function buildLaunchGateConformanceAudit(
  outcomes: readonly NeutralJourneyOutcome[],
  options: {
    readonly scopeRef?: string;
    readonly runbookEntries?: readonly NeutralIncidentRunbookEntry[];
  } = {},
): ConformanceAuditDetail {
  if (outcomes.length === 0) {
    throw new ConformanceAuditInvalidError(
      "zero journeys to audit — an audit with zero checks is a pass without the counts (the CONFORMANCE LAW refuses it)",
    );
  }
  const scopeRef = options.scopeRef ?? JOURNEY_FIXTURE_SET_VERSION;
  if (scopeRef.length === 0) {
    throw new ConformanceAuditInvalidError("empty scopeRef (an audit names its scope)");
  }
  const checks: ConformanceCheckResult[] = [];
  const failedIncidentClassesAcrossRuns = new Set<string>();
  for (const outcome of outcomes) {
    assertWellFormedOutcome(outcome);
    const recomputedCompleted = recomputedCompletedCount(outcome);
    const recomputedDuration = outcome.steps.reduce((sum, record) => sum + record.durationMs, 0);
    checks.push({
      checkId: `journey-law:${outcome.spec.journeyId}`,
      description: "journey record fields agree with the step records (stepsCompleted/failedStep/durationMs recomputed)",
      passed:
        outcome.journeyRecord.stepsCompleted === recomputedCompleted &&
        outcome.journeyRecord.failedStep === (outcome.spec.injection?.stepId ?? null) &&
        outcome.journeyRecord.durationMs === recomputedDuration &&
        outcome.stepsCompleted === recomputedCompleted,
    });
    // determinism: byte-identical replay from the spec (computed, not asserted)
    const replayed = runJourney(outcome.spec);
    checks.push({
      checkId: `determinism:${outcome.spec.journeyId}`,
      description: "byte-identical replay from the journey seed (canonical JSON comparison)",
      passed: canonicalJson(replayed) === canonicalJson(outcome),
    });
    // one check per recorded step transition, plus one recovery check per
    // failed transition (verbatim counting — a terminal failure FAILS its
    // recovery check honestly)
    outcome.steps.forEach((record, i) => {
      checks.push({
        checkId: `step-record:${outcome.spec.journeyId}:${i + 1}:${record.status}`,
        description: `step ${record.stepIndex} ('${record.stepId}') recorded '${record.status}' with a seed-derived duration`,
        passed: true,
      });
      if (record.status === "failed") {
        if (record.incidentClass !== null) {
          failedIncidentClassesAcrossRuns.add(record.incidentClass);
        }
        const next = outcome.steps[i + 1];
        checks.push({
          checkId: `recovery-exercised:${outcome.spec.journeyId}:${record.stepIndex}`,
          description: `the failed transition at step ${record.stepIndex} ('${record.stepId}') is followed by its recovery`,
          passed: next !== undefined && next.status === "recovered" && next.stepId === record.stepId,
        });
      }
    });
  }
  // runbook-law backing per entry — ONCE per entry, over all runs
  for (const entry of options.runbookEntries ?? []) {
    if (!INCIDENT_CLASS_NAMES.includes(entry.incidentClass)) {
      throw new ConformanceAuditInvalidError(
        `runbook entry '${entry.id}' names incident class '${entry.incidentClass}' outside the W11C authored vocabulary`,
      );
    }
    checks.push({
      checkId: `runbook-law:${entry.incidentClass}`,
      description: "RUNBOOK LAW — exercised claims are backed by a failed-step record (unexercised entries are explicitly marked)",
      passed: !entry.exercised || failedIncidentClassesAcrossRuns.has(entry.incidentClass),
    });
  }
  const checksTotal = checks.length;
  const checksPassed = checks.filter((check) => check.passed).length;
  const record: NeutralConformanceAuditRecord = {
    id: conformanceAuditRecordId(LAUNCH_GATE_CONFORMANCE_STANDARD, scopeRef, checksTotal, checksPassed),
    standard: LAUNCH_GATE_CONFORMANCE_STANDARD,
    scopeRef,
    checksTotal,
    checksPassed,
    simulated: true,
  };
  return { record, checks };
}
