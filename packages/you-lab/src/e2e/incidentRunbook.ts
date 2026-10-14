// Incident runbook machinery (W11C).
//
// RUNBOOK LAW (docs/you/CONTRACTS.md "Wave-11 contract freeze (v11)"):
// every incident runbook entry is exercised by at least one E2E
// failure-injection journey or explicitly marked unexercised.
//
// This module owns the authored runbook texts (detection / containment /
// recovery per incident class of the W11C vocabulary in
// ./journeySteps.ts) and the entry builders. The `exercised` flag is
// DERIVED, never asserted: an entry counts as exercised only when one of
// the provided journey outcomes carries a failed step record naming that
// incident class — an unbacked exercise claim is a typed
// YOU_RUNBOOK_INVALID rejection (fail-closed, truth law). The two
// DR-plane classes (provider-region-outage, retention-expiry-breach)
// belong to the wave-9/10 hardening planes and CANNOT be injected by the
// deterministic journey harness — their entries stay explicitly marked
// unexercised (the law's honest branch, stated in the entry's own
// containment text).
//
// The neutral entry shape is aligned 1:1 with the frozen v11
// IncidentRunbookEntry; mapping onto the frozen contract happens ONLY in
// src/contractSeam.ts. No clock, no randomness, no network.

import { sha256Hex } from "../arena/arenaAdapterSeam.js";
import {
  INCIDENT_CLASS_NAMES,
  UNEXERCISABLE_INCIDENT_CLASSES,
  incidentClassSpec,
} from "./journeySteps.js";
import type { NeutralJourneyOutcome } from "./journeyHarness.js";

/** Error code aligned with the frozen v11 typed error literal (the RUNBOOK LAW). */
export const RUNBOOK_INVALID_CODE = "YOU_RUNBOOK_INVALID";

/** Typed rejection thrown when a runbook entry violates the RUNBOOK LAW (fail-closed). */
export class RunbookInvalidError extends Error {
  readonly code = RUNBOOK_INVALID_CODE;
  constructor(detail: string) {
    super(`${RUNBOOK_INVALID_CODE}: ${detail}`);
  }
}

/** The authored runbook texts for one incident class. */
export interface IncidentRunbookTexts {
  readonly detection: string;
  readonly containment: string;
  readonly recovery: string;
}

/**
 * The authored W11C runbook table — detection/containment/recovery per
 * incident class. Authored you-lab fixture text describing the
 * deterministic harness's recovery paths (and the two DR-plane classes
 * the harness cannot reach); never claims about a live deployment.
 */
export const INCIDENT_RUNBOOK_TEXTS: Readonly<Record<string, IncidentRunbookTexts>> = {
  "workspace-creation-failed": {
    detection: "the workspace-creation step returns an invalid-state error instead of a workspace id",
    containment: "the half-created workspace draft is quarantined so no later step can reference it",
    recovery: "the workspace is re-created from the journey seed and the step is re-run",
  },
  "intent-capture-failed": {
    detection: "the captured intent fails validation (no parseable objective)",
    containment: "the invalid intent text is parked outside the workspace intent log",
    recovery: "the intent is re-captured from the journey's authored objective and validated again",
  },
  "solution-creation-failed": {
    detection: "the Solution composer emits an empty version envelope",
    containment: "the empty envelope is discarded before any version id is minted",
    recovery: "the composer is re-run over the validated intent and the version envelope rebuilt",
  },
  "solution-inspect-failed": {
    detection: "the inspect step cannot resolve the current Solution state snapshot",
    containment: "the stale snapshot ref is marked unusable for feedback targeting",
    recovery: "the snapshot ref is re-resolved against the published version and the inspect re-run",
  },
  "feedback-submission-failed": {
    detection: "the feedback request is rejected by the open-request gate (no matching request state)",
    containment: "the rejected feedback draft is held out of the feedback ledger",
    recovery: "the feedback request is re-submitted against the re-resolved snapshot",
  },
  "evidence-capture-failed": {
    detection: "the evidence capture session completes with zero observations",
    containment: "the empty capture session is closed without recording evidence",
    recovery: "the capture session is re-opened and the synthetic payload re-observed",
  },
  "twin-publication-failed": {
    detection: "the Twin publication fails its evidence-binding validation",
    containment: "the candidate Twin version is withdrawn before promotion to canonical",
    recovery: "the evidence bindings are re-validated and the Twin version re-published",
  },
  "twin-improvement-failed": {
    detection: "the improvement pass leaves the Twin deficiencies unaddressed",
    containment: "the failed improvement pass is recorded as an attempted strategy on the deficiency ledger",
    recovery: "the improvement pass is re-run over the recorded deficiencies",
  },
  "performance-publication-failed": {
    detection: "the Performance timeline fails its cue-timeline validation",
    containment: "the invalid timeline is held unpublished so no render job can consume it",
    recovery: "the timeline cues are re-derived from the improved Twin and re-validated",
  },
  "render-job-failed": {
    detection: "the render job completes with no content-addressed artifact",
    containment: "the failed render job is recorded and its partial output discarded",
    recovery: "the render job is re-submitted against the published timeline",
  },
  "edit-session-failed": {
    detection: "the edit session cannot propose a change set (the patch operations fail validation)",
    containment: "the invalid change set is rejected before any candidate version is minted",
    recovery: "the edit session is re-opened and the change set re-proposed",
  },
  "import-export-failed": {
    detection: "the editing round-trip import/export reports a content hash mismatch",
    containment: "the mismatched import is quarantined (import-quarantine semantics) pending re-verification",
    recovery: "the export is re-run and the round-trip re-verified against the content hash",
  },
  "version-acceptance-failed": {
    detection: "the version acceptance decision fails its verification checks",
    containment: "the candidate version stays unaccepted (never promoted on a failed check)",
    recovery: "the verification checks are re-run and the acceptance decision re-recorded",
  },
  "learning-permission-failed": {
    detection: "a learning record is validated without the required learning rights",
    containment: "the unpermissioned record is rejected (never silently validated)",
    recovery: "the learning rights are re-confirmed with the actor and the record re-validated",
  },
  "repeat-run-failed": {
    detection: "the repeat pass diverges from the recorded first-pass trajectory",
    containment: "the divergent repeat is held out of the trajectory reference",
    recovery: "the repeat is re-run against the pinned first-pass inputs",
  },
  "capability-gap-detected": {
    detection: "the repeat path records a capability gap after an exhausted strategy attempt",
    containment: "the gap is recorded immutably with its attempted strategies (gap persistence law)",
    recovery: "the gap is projected and routed to the escalation eligibility check",
  },
  "arena-escalation-failed": {
    detection: "the Arena escalation request is refused (missing escalation authorization)",
    containment: "the unauthorized escalation is cancelled and the gap held at not-eligible",
    recovery: "the escalation authorization is re-confirmed and the request re-submitted",
  },
  "expert-result-failed": {
    detection: "the Arena run completes without a delivered expert result",
    containment: "the undelivered run is recorded as failed and its result slot left empty",
    recovery: "the arena invocation is re-run under its retry ladder until the result is delivered",
  },
  "provenance-consent-failed": {
    detection: "the end-of-journey provenance audit finds an unprovenanced record",
    containment: "the unprovenanced record is quarantined from the journey's evidence set",
    recovery: "the record's provenance is re-attached from the journey ledger and re-audited",
  },
  "recovery-drill-failed": {
    detection: "the injected-failure recovery drill itself faults (the recovery path errors out)",
    containment: "the drill's partial recovery state is discarded at the step checkpoint",
    recovery: "the recovery path is re-run from the step checkpoint (the drill's own retry)",
  },
  "provider-region-outage": {
    detection: "the provider matrix health check flips a region's rows to ineligible",
    containment: "journey traffic is pinned to the remaining eligible regions (unexercised by this harness — a wave-10 provider-matrix plane incident, explicitly marked unexercised per the RUNBOOK LAW)",
    recovery: "the region's rows are re-validated once the provider restores service",
  },
  "retention-expiry-breach": {
    detection: "the retention enforcer reports an expired artifact still resolvable",
    containment: "the expired artifact is quarantined pending purge (unexercised by this harness — a wave-9 retention plane incident, explicitly marked unexercised per the RUNBOOK LAW)",
    recovery: "the artifact is purged and its refs re-pointed to the retained set",
  },
};

/** Neutral incident-runbook entry — aligned 1:1 with the frozen v11 IncidentRunbookEntry. */
export interface NeutralIncidentRunbookEntry {
  readonly id: string;
  readonly incidentClass: string;
  readonly detection: string;
  readonly containment: string;
  readonly recovery: string;
  readonly exercised: boolean;
  readonly simulated: boolean;
}

/** Deterministic entry id for an incident class — you_runbook_<16hex>. */
export function incidentRunbookEntryId(incidentClass: string): string {
  return `you_runbook_${sha256Hex(incidentClass).slice(0, 16)}`;
}

/** Deep-freeze an entry (immutability — entries never mutate in place). */
function freezeEntry(entry: NeutralIncidentRunbookEntry): NeutralIncidentRunbookEntry {
  return Object.freeze({ ...entry });
}

/**
 * The exercise evidence map: incident class -> journey ids whose step
 * records carry a failed transition naming that class. This is the ONLY
 * backing the runbook accepts for an exercised flag (derived, never
 * asserted).
 */
export function runbookExerciseEvidence(
  journeys: readonly NeutralJourneyOutcome[],
): ReadonlyMap<string, readonly string[]> {
  const evidence = new Map<string, string[]>();
  for (const journey of journeys) {
    for (const step of journey.steps) {
      if (step.status === "failed" && step.incidentClass !== null) {
        const ids = evidence.get(step.incidentClass) ?? [];
        if (!ids.includes(journey.spec.journeyId)) {
          ids.push(journey.spec.journeyId);
        }
        evidence.set(step.incidentClass, ids);
      }
    }
  }
  for (const [key, ids] of evidence) {
    evidence.set(key, [...ids].sort());
  }
  return evidence;
}

/** Fail-closed incident-class validation (RUNBOOK LAW — unknown classes are never guessed). */
function assertKnownIncidentClass(incidentClass: string): void {
  if (incidentClass.length === 0) {
    throw new RunbookInvalidError("empty incidentClass (a runbook entry names its incident class)");
  }
  if (!INCIDENT_CLASS_NAMES.includes(incidentClass)) {
    throw new RunbookInvalidError(
      `incident class '${incidentClass}' is outside the W11C authored vocabulary (extension requires a W11C table update)`,
    );
  }
}

/**
 * Build one immutable runbook entry for an incident class. The
 * `exercised` flag is DERIVED from the provided journeys (a journey with
 * a failed step record naming the class); the two DR-plane classes stay
 * explicitly unexercised (exercised: false) unless real evidence backs
 * them — the law's honest branch.
 */
export function buildIncidentRunbookEntry(
  incidentClass: string,
  journeys: readonly NeutralJourneyOutcome[] = [],
): NeutralIncidentRunbookEntry {
  assertKnownIncidentClass(incidentClass);
  const texts = INCIDENT_RUNBOOK_TEXTS[incidentClass];
  if (!texts) {
    throw new RunbookInvalidError(`incident class '${incidentClass}' has no authored runbook texts`);
  }
  const evidence = runbookExerciseEvidence(journeys).get(incidentClass) ?? [];
  const exercised = evidence.length > 0;
  return freezeEntry({
    id: incidentRunbookEntryId(incidentClass),
    incidentClass,
    detection: texts.detection,
    containment: texts.containment,
    recovery: texts.recovery,
    exercised,
    simulated: true,
  });
}

/**
 * Build the full runbook over the incident vocabulary (all 22 classes by
 * default), deriving every exercised flag from the provided journeys.
 */
export function buildIncidentRunbook(
  incidentClasses: readonly string[] = INCIDENT_CLASS_NAMES,
  journeys: readonly NeutralJourneyOutcome[] = [],
): readonly NeutralIncidentRunbookEntry[] {
  const seen = new Set<string>();
  const entries: NeutralIncidentRunbookEntry[] = [];
  for (const incidentClass of incidentClasses) {
    if (seen.has(incidentClass)) {
      throw new RunbookInvalidError(`duplicate incident class '${incidentClass}' in the runbook input (entries are append-once per class)`);
    }
    seen.add(incidentClass);
    entries.push(buildIncidentRunbookEntry(incidentClass, journeys));
  }
  return entries;
}

/**
 * RUNBOOK LAW fail-closed check: an entry claiming exercised === true
 * MUST be backed by a failed step record naming its incident class in
 * the provided journeys — an unbacked claim is a typed fabrication
 * rejection, never a silent pass.
 */
export function assertExerciseClaimBacked(
  entry: NeutralIncidentRunbookEntry,
  journeys: readonly NeutralJourneyOutcome[],
): void {
  assertKnownIncidentClass(entry.incidentClass);
  if (entry.exercised) {
    const evidence = runbookExerciseEvidence(journeys).get(entry.incidentClass) ?? [];
    if (evidence.length === 0) {
      throw new RunbookInvalidError(
        `entry '${entry.id}' claims exercised for class '${entry.incidentClass}' with no backing failed-step record in the provided journeys — the RUNBOOK LAW never accepts an unbacked exercise claim`,
      );
    }
  }
}

/**
 * RUNBOOK LAW summary over a complete runbook: every entry is either
 * exercised (with backing journey ids) or explicitly marked unexercised
 * (exercised: false — the boolean has no third state, so the marking is
 * explicit by construction). DR-plane classes are EXPECTED to be
 * unexercised; a step-plane class that is unexercised is reported in
 * `unexercisedStepClasses` so the caller can see the gap honestly.
 */
export interface RunbookLawSummary {
  readonly totalEntries: number;
  readonly exercisedCount: number;
  readonly unexercisedCount: number;
  readonly unexercisedClasses: readonly string[];
  /** Unexercised classes that belong to a launch-gate step (coverage gaps — the DR-plane classes are expected here to be absent). */
  readonly unexercisedStepClasses: readonly string[];
  readonly drPlaneClasses: readonly string[];
}

export function summarizeRunbookLaw(
  entries: readonly NeutralIncidentRunbookEntry[],
): RunbookLawSummary {
  const unexercisedClasses = entries.filter((entry) => !entry.exercised).map((entry) => entry.incidentClass);
  return {
    totalEntries: entries.length,
    exercisedCount: entries.length - unexercisedClasses.length,
    unexercisedCount: unexercisedClasses.length,
    unexercisedClasses: [...unexercisedClasses].sort(),
    unexercisedStepClasses: unexercisedClasses.filter((incidentClass) => {
      const spec = incidentClassSpec(incidentClass);
      return spec !== null && spec.stepId !== null;
    }),
    drPlaneClasses: [...UNEXERCISABLE_INCIDENT_CLASSES],
  };
}

/** Digest label for the neutral runbook (honest provenance wiring). */
export function incidentRunbookVersion(): string {
  return "you-lab-incident-runbook/1 (derived exercise flags — the RUNBOOK LAW enforced fail-closed)";
}
