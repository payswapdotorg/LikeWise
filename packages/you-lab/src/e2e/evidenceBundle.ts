// Evidence bundle builder (W12C).
//
// RELEASE DECLARATION LAW (docs/you/CONTRACTS.md "Wave-12 contract freeze
// (v12)"): the declaration carries the full evidence bundle AND rollback
// evidence — the production-eligibility law carried to the release.
//
// This module assembles the E2eJourneyRecord set — the 20-point golden
// journey runs plus the failure-injection recovery runs (the W11C journey
// harness outputs) — into the CONTENT-ADDRESSED evidence bundle the
// release declaration references: the bundle id is the sha256 digest over
// the canonical JSON of the versioned record set, so any change to any
// record, the record set or the bundle version is a DIFFERENT bundle
// (content addressing — an id is never asserted over different contents).
//
// Assembly is fail-closed: an empty run set, duplicate journeys, a record
// that disagrees with its own step evidence, or an unlabelled
// (simulated !== true) record are typed YOU_RELEASE_DECLARATION_INVALID
// rejections — the declaration plane never carries evidence it cannot
// verify. The standard gate evidence bundle (golden + injection-recovery)
// is the fixture set the golden gate run declares against; the terminal
// failed-at fixtures are deliberately NOT part of it (they are the honest
// failure demonstrations for the W11C conformance audit, not the
// passing-path evidence a release declares against).
//
// The neutral bundle shape is owned by you-lab (the frozen v12
// ReleaseDeclarationRecord references it by opaque id only); mapping onto
// the frozen contract happens ONLY in src/contractSeam.ts. No clock, no
// Math.random, no network.

import { canonicalJson } from "../determinism.js";
import { sha256Hex } from "../arena/arenaAdapterSeam.js";
import { JOURNEY_STEP_IDS, LAUNCH_GATE_JOURNEY_LENGTH } from "./journeySteps.js";
import { type NeutralE2eJourneyRecord, type NeutralJourneyOutcome, runGoldenJourneys } from "./journeyHarness.js";
import { runInjectionCoverageJourneys } from "./failureInjection.js";

/** Error code aligned with the frozen v12 typed error literal (the RELEASE DECLARATION LAW's evidence clause). */
export const RELEASE_EVIDENCE_INVALID_CODE = "YOU_RELEASE_DECLARATION_INVALID";

/** Typed rejection thrown when a bundle assembly/verification violates the evidence law (fail-closed). */
export class ReleaseEvidenceInvalidError extends Error {
  readonly code = RELEASE_EVIDENCE_INVALID_CODE;
  constructor(detail: string) {
    super(`${RELEASE_EVIDENCE_INVALID_CODE}: ${detail}`);
  }
}

/** The W12C gate evidence bundle fixture-set version (a version change re-addresses every bundle). */
export const GATE_EVIDENCE_BUNDLE_VERSION = "you-lab-gate-evidence-bundle/1";

/** One manifest entry: the journey record's identity plus its per-record content digest. */
export interface EvidenceBundleManifestEntry {
  readonly journeyId: string;
  readonly recordId: string;
  /** sha256 over the canonical JSON of the journey record (the per-record content address). */
  readonly contentDigest: string;
}

/**
 * The neutral content-addressed evidence bundle — the E2eJourneyRecord
 * set the release declaration references by its id. Owned by you-lab
 * (the frozen v12 ReleaseDeclarationRecord carries the opaque bundle ref
 * only); the records are the frozen-shape-aligned neutral journey
 * records in canonical order (sorted by journeyId, then record id).
 */
export interface NeutralEvidenceBundle {
  /** Content address — you_evidence_<16hex> (the sha256 digest over the canonical versioned record set). */
  readonly id: string;
  readonly bundleVersion: string;
  /** The manifest in canonical order — one entry per record (the record set's digest index). */
  readonly manifest: readonly EvidenceBundleManifestEntry[];
  /** The journey records in canonical order. */
  readonly journeyRecords: readonly NeutralE2eJourneyRecord[];
  readonly simulated: boolean;
}

/** Per-record content digest (sha256 over the canonical JSON of the record). */
export function journeyRecordContentDigest(record: NeutralE2eJourneyRecord): string {
  return sha256Hex(canonicalJson(record));
}

/** The canonical record order (sorted by journeyId, then record id — stable for any input order). */
function canonicalRecordOrder(records: readonly NeutralE2eJourneyRecord[]): readonly NeutralE2eJourneyRecord[] {
  return [...records].sort((a, b) =>
    a.journeyId < b.journeyId ? -1 : a.journeyId > b.journeyId ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

/**
 * The content address of a record set — you_evidence_<16hex>. A pure
 * function of the versioned record SET (input order never matters).
 */
export function evidenceBundleId(records: readonly NeutralE2eJourneyRecord[]): string {
  const ordered = canonicalRecordOrder(records);
  return `you_evidence_${sha256Hex(canonicalJson({ bundleVersion: GATE_EVIDENCE_BUNDLE_VERSION, records: ordered })).slice(0, 16)}`;
}

/** Recompute the completed-step count from the outcome's step records (the assembly check's ground truth). */
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

/** Fail-closed assembly validation of one outcome (the record must agree with its own step evidence). */
function assertOutcomeAssemblable(outcome: NeutralJourneyOutcome): void {
  if (outcome.spec.journeyId.length === 0 || outcome.journeyRecord.id.length === 0 || outcome.journeyRecord.journeyId.length === 0) {
    throw new ReleaseEvidenceInvalidError("journey identity fields are empty (an evidence record names itself)");
  }
  if (outcome.journeyRecord.journeyId !== outcome.spec.journeyId) {
    throw new ReleaseEvidenceInvalidError(
      `journey record '${outcome.journeyRecord.id}' names journey '${outcome.journeyRecord.journeyId}' but the run is '${outcome.spec.journeyId}' (identity law)`,
    );
  }
  if (outcome.steps.length === 0) {
    throw new ReleaseEvidenceInvalidError(
      `journey '${outcome.spec.journeyId}' has zero step records (the harness records every step — never an empty run)`,
    );
  }
  if (
    !Number.isInteger(outcome.journeyRecord.stepsCompleted) ||
    outcome.journeyRecord.stepsCompleted < 0 ||
    outcome.journeyRecord.stepsCompleted > LAUNCH_GATE_JOURNEY_LENGTH
  ) {
    throw new ReleaseEvidenceInvalidError(
      `journey '${outcome.spec.journeyId}': stepsCompleted ${outcome.journeyRecord.stepsCompleted} is outside [0, ${LAUNCH_GATE_JOURNEY_LENGTH}]`,
    );
  }
  const recomputed = recomputedCompletedCount(outcome);
  if (outcome.journeyRecord.stepsCompleted !== recomputed || outcome.stepsCompleted !== recomputed) {
    throw new ReleaseEvidenceInvalidError(
      `journey '${outcome.spec.journeyId}': the record claims ${outcome.journeyRecord.stepsCompleted} completed steps but its step evidence recomputes ${recomputed} — the bundle never assembles a record that disagrees with its own evidence`,
    );
  }
  if (outcome.journeyRecord.failedStep !== null && !JOURNEY_STEP_IDS.includes(outcome.journeyRecord.failedStep)) {
    throw new ReleaseEvidenceInvalidError(
      `journey '${outcome.spec.journeyId}': failedStep '${outcome.journeyRecord.failedStep}' is outside the frozen 20-point launch-gate vocabulary`,
    );
  }
  const durationSum = outcome.steps.reduce((sum, record) => sum + record.durationMs, 0);
  if (outcome.journeyRecord.durationMs !== durationSum || outcome.durationMs !== durationSum) {
    throw new ReleaseEvidenceInvalidError(
      `journey '${outcome.spec.journeyId}': the record claims durationMs ${outcome.journeyRecord.durationMs} but its step durations sum to ${durationSum}`,
    );
  }
  if (outcome.journeyRecord.simulated !== true || outcome.simulated !== true) {
    throw new ReleaseEvidenceInvalidError(
      `journey '${outcome.spec.journeyId}': simulated must be true (an unlabelled run is a truth-law fabrication — the bundle never carries it)`,
    );
  }
}

/**
 * Build the content-addressed evidence bundle from journey harness
 * outcomes. Deterministic: the same run SET assembles the byte-identical
 * bundle regardless of input order (canonical ordering + content
 * addressing); every record is validated against its own step evidence
 * before it enters the bundle.
 */
export function buildEvidenceBundle(outcomes: readonly NeutralJourneyOutcome[]): NeutralEvidenceBundle {
  if (outcomes.length === 0) {
    throw new ReleaseEvidenceInvalidError(
      "zero journeys to bundle — a declaration without journey evidence is a pass without the runs (refused)",
    );
  }
  const records: NeutralE2eJourneyRecord[] = [];
  const seenJourneyIds = new Set<string>();
  const seenRecordIds = new Set<string>();
  for (const outcome of outcomes) {
    assertOutcomeAssemblable(outcome);
    if (seenJourneyIds.has(outcome.spec.journeyId)) {
      throw new ReleaseEvidenceInvalidError(
        `duplicate journey '${outcome.spec.journeyId}' in the bundle input (each journey appears once)`,
      );
    }
    if (seenRecordIds.has(outcome.journeyRecord.id)) {
      throw new ReleaseEvidenceInvalidError(
        `duplicate journey record '${outcome.journeyRecord.id}' in the bundle input (the harness mints unique ids)`,
      );
    }
    seenJourneyIds.add(outcome.spec.journeyId);
    seenRecordIds.add(outcome.journeyRecord.id);
    records.push(outcome.journeyRecord);
  }
  const ordered = canonicalRecordOrder(records);
  const manifest = ordered.map((record) =>
    Object.freeze({
      journeyId: record.journeyId,
      recordId: record.id,
      contentDigest: journeyRecordContentDigest(record),
    } satisfies EvidenceBundleManifestEntry),
  );
  return Object.freeze({
    id: evidenceBundleId(ordered),
    bundleVersion: GATE_EVIDENCE_BUNDLE_VERSION,
    manifest: Object.freeze(manifest),
    journeyRecords: Object.freeze(ordered),
    simulated: true,
  } satisfies NeutralEvidenceBundle);
}

/**
 * Content-address verification (fail-closed): the bundle id must
 * recompute from its own contents, the manifest must index the record
 * set exactly, and every per-record digest must recompute — a tampered
 * bundle (edited record, swapped manifest entry, asserted id) is a typed
 * rejection, never carried evidence.
 */
export function assertBundleContentAddressed(bundle: NeutralEvidenceBundle): void {
  if (bundle.id.length === 0) {
    throw new ReleaseEvidenceInvalidError("empty bundle id (a bundle is content-addressed — never anonymous)");
  }
  if (bundle.bundleVersion !== GATE_EVIDENCE_BUNDLE_VERSION) {
    throw new ReleaseEvidenceInvalidError(
      `bundle '${bundle.id}' carries version '${bundle.bundleVersion}' but this builder addresses '${GATE_EVIDENCE_BUNDLE_VERSION}' (a version change is a different bundle)`,
    );
  }
  if (bundle.journeyRecords.length === 0) {
    throw new ReleaseEvidenceInvalidError(
      `bundle '${bundle.id}' carries zero journey records — the declaration's evidence is the record set (refused)`,
    );
  }
  if (bundle.manifest.length !== bundle.journeyRecords.length) {
    throw new ReleaseEvidenceInvalidError(
      `bundle '${bundle.id}': the manifest lists ${bundle.manifest.length} entries but the bundle carries ${bundle.journeyRecords.length} records (the manifest is the record set's index)`,
    );
  }
  for (let i = 1; i < bundle.journeyRecords.length; i += 1) {
    const previous = bundle.journeyRecords[i - 1]!;
    const current = bundle.journeyRecords[i]!;
    if (
      !(previous.journeyId < current.journeyId || (previous.journeyId === current.journeyId && previous.id < current.id))
    ) {
      throw new ReleaseEvidenceInvalidError(
        `bundle '${bundle.id}': journey records are not in canonical order at index ${i} (deterministic addressing requires the canonical order)`,
      );
    }
  }
  const recomputedId = evidenceBundleId(bundle.journeyRecords);
  if (bundle.id !== recomputedId) {
    throw new ReleaseEvidenceInvalidError(
      `bundle '${bundle.id}' fails its content address (the contents recompute to '${recomputedId}') — an id asserted over different contents is a fabrication (refused)`,
    );
  }
  bundle.manifest.forEach((entry, i) => {
    const record = bundle.journeyRecords[i]!;
    if (entry.recordId !== record.id || entry.journeyId !== record.journeyId) {
      throw new ReleaseEvidenceInvalidError(
        `bundle '${bundle.id}': manifest entry ${i + 1} does not index record '${record.id}' (the manifest is the record set's index)`,
      );
    }
    const digest = journeyRecordContentDigest(record);
    if (entry.contentDigest !== digest) {
      throw new ReleaseEvidenceInvalidError(
        `bundle '${bundle.id}': record '${record.id}' fails its manifest digest (recomputes to '${digest}') — tampered evidence is never carried`,
      );
    }
  });
}

/** The bundle's journey-record ids (canonical manifest order). */
export function bundleRecordIds(bundle: NeutralEvidenceBundle): readonly string[] {
  return bundle.manifest.map((entry) => entry.recordId);
}

/**
 * The standard gate evidence journey set: the golden reference journeys
 * (the 20-point path with the built-in step-20 drill) plus the exhaustive
 * recover-mode injection coverage (one recovered failure per launch-gate
 * step). The terminal failed-at fixtures are the W11C conformance
 * audit's honest failure demonstrations — NOT this set.
 */
export function runGateEvidenceJourneys(): readonly NeutralJourneyOutcome[] {
  return [...runGoldenJourneys(), ...runInjectionCoverageJourneys()];
}

/** The standard gate evidence bundle (golden + injection-recovery; 24 records). */
export function buildStandardGateEvidenceBundle(): NeutralEvidenceBundle {
  return buildEvidenceBundle(runGateEvidenceJourneys());
}

/** Digest label for the neutral evidence bundle (honest provenance wiring). */
export function gateEvidenceBundleVersion(): string {
  return "you-lab-gate-evidence-bundle/1 (content-addressed journey-record sets — the RELEASE DECLARATION LAW's evidence clause)";
}
