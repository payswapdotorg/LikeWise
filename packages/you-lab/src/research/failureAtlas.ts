// Failure Atlas — immutable failure observations with evidence refs (W9C).
//
// Authority: docs/you/LAB.md "Failure Atlas" (capture repeatable failures:
// inputs, conditions, organization, pipeline, technology versions,
// artifacts, suspected causes, confidence, remediation, whether user
// takeover occurred, whether Arena intervention was required) and the
// FAILURE ATLAS LAW (docs/you/CONTRACTS.md "Wave-9 contract freeze
// (v9)"): FailureAtlasEntry records are immutable observations with
// evidence refs — never authoritative conclusions; the atlas informs, the
// promotion gate decides.
//
// This module owns the ENTRY builders from world-run outcomes: a failing
// LabWorldRunOutcome becomes one immutable entry whose identity is a pure
// function of (world, run, failure class) — replaying the same outcome
// mints the identical entry. The atlas ledger is append-only (duplicate
// observations are typed rejections, never silently skipped). The summary
// is a derived PROJECTION (counting only) — it informs and never decides.
// Entry shapes are neutral, aligned 1:1 with the frozen v9
// FailureAtlasEntry; mapping onto the frozen contract happens ONLY in
// src/contractSeam.ts.

import { sha256Hex } from "../arena/arenaAdapterSeam.js";
import { LAB_FAILURE_CLASSES, type LabWorldRunOutcome } from "./worlds.js";

/** Error code aligned with the frozen v9 typed error literal (you-lab-owned). */
export const FAILURE_ATLAS_INVALID_CODE = "YOU_FAILURE_ATLAS_INVALID";

/** Typed rejection thrown when an atlas entry or ledger append violates the laws. */
export class FailureAtlasInvalidError extends Error {
  readonly code = FAILURE_ATLAS_INVALID_CODE;
  constructor(detail: string) {
    super(`${FAILURE_ATLAS_INVALID_CODE}: ${detail}`);
  }
}

/**
 * Neutral Failure Atlas entry — aligned 1:1 with the frozen v9
 * FailureAtlasEntry: an immutable OBSERVATION with an evidence ref (never
 * an authoritative conclusion — no remediation, confidence or decision
 * fields live on the entry; those belong to the consuming authorities).
 */
export interface NeutralFailureAtlasEntry {
  readonly id: string;
  readonly worldRef: string;
  readonly runRef: string;
  readonly failureClass: string;
  readonly evidenceRef: string;
  readonly firstObservedAt: string;
  readonly simulated: boolean;
}

/** Deterministic entry id for (world, run, failure class) — the observation identity. */
export function failureAtlasEntryId(worldRef: string, runRef: string, failureClass: string): string {
  return `you_atlas_${sha256Hex(`${worldRef}|${runRef}|${failureClass}`).slice(0, 16)}`;
}

/**
 * Collect the failing outcomes from a world-run batch (the explicit,
 * named selection — the atlas records only observed failures; filtering a
 * non-failure is selection, not silence).
 */
export function collectFailureObservations(
  outcomes: readonly LabWorldRunOutcome[],
): readonly LabWorldRunOutcome[] {
  return outcomes.filter((outcome) => outcome.failureClass !== null);
}

/**
 * Build the immutable atlas entry from a FAILING world-run outcome
 * (FAILURE ATLAS LAW: every entry carries an evidence ref). The entry is
 * an observation of what the run produced — never a conclusion about
 * cause or remediation. Replaying the same outcome mints the identical
 * entry (deterministic identity). Non-failing outcomes and outcomes whose
 * failure class is outside the world model's authored vocabulary are
 * typed YOU_FAILURE_ATLAS_INVALID rejections — never guessed.
 */
export function buildFailureAtlasEntry(
  outcome: LabWorldRunOutcome,
  observedAt: string,
): NeutralFailureAtlasEntry {
  if (outcome.runId.length === 0) {
    throw new FailureAtlasInvalidError("outcome runId is empty (an observation names its run)");
  }
  if (outcome.worldId.length === 0) {
    throw new FailureAtlasInvalidError(`outcome ${outcome.runId}: worldId is empty`);
  }
  if (outcome.failureClass === null) {
    throw new FailureAtlasInvalidError(
      `outcome ${outcome.runId} observed no failure (failureClass null — there is nothing to record; pass only failing outcomes)`,
    );
  }
  if (!(LAB_FAILURE_CLASSES as readonly string[]).includes(outcome.failureClass)) {
    throw new FailureAtlasInvalidError(
      `outcome ${outcome.runId}: failure class '${outcome.failureClass}' is outside the world model's authored vocabulary`,
    );
  }
  if (outcome.evidenceRef.length === 0) {
    throw new FailureAtlasInvalidError(
      `outcome ${outcome.runId}: evidenceRef is empty (the FAILURE ATLAS LAW requires an evidence ref on every entry)`,
    );
  }
  if (observedAt.length === 0 || Number.isNaN(Date.parse(observedAt))) {
    throw new FailureAtlasInvalidError(`observedAt '${observedAt}' is not a parseable ISO timestamp (injected clock only)`);
  }
  return {
    id: failureAtlasEntryId(outcome.worldId, outcome.runId, outcome.failureClass),
    worldRef: outcome.worldId,
    runRef: outcome.runId,
    failureClass: outcome.failureClass,
    evidenceRef: outcome.evidenceRef,
    firstObservedAt: observedAt,
    simulated: true,
  };
}

/**
 * Append an entry to the atlas ledger (append-only, immutable): duplicate
 * ids are typed rejections — the same observation is already recorded and
 * a replay must check, not double-record. Returns a NEW array; the input
 * ledger is untouched.
 */
export function appendAtlasEntry(
  entries: readonly NeutralFailureAtlasEntry[],
  entry: NeutralFailureAtlasEntry,
): readonly NeutralFailureAtlasEntry[] {
  if (entry.id.length === 0) {
    throw new FailureAtlasInvalidError("entry id is empty");
  }
  if (entry.worldRef.length === 0 || entry.runRef.length === 0) {
    throw new FailureAtlasInvalidError(`entry ${entry.id}: worldRef/runRef is empty`);
  }
  if (entry.failureClass.length === 0) {
    throw new FailureAtlasInvalidError(`entry ${entry.id}: failureClass is empty`);
  }
  if (entry.evidenceRef.length === 0) {
    throw new FailureAtlasInvalidError(`entry ${entry.id}: evidenceRef is empty (the FAILURE ATLAS LAW requires an evidence ref)`);
  }
  if (entry.firstObservedAt.length === 0 || Number.isNaN(Date.parse(entry.firstObservedAt))) {
    throw new FailureAtlasInvalidError(`entry ${entry.id}: firstObservedAt is not a parseable ISO timestamp`);
  }
  if (entries.some((existing) => existing.id === entry.id)) {
    throw new FailureAtlasInvalidError(
      `entry '${entry.id}' is already recorded (observations are immutable and append-once — replay must deduplicate, never double-record)`,
    );
  }
  return [...entries, { ...entry }];
}

/** Derived atlas summary — counting only, deterministic key order (informs, never decides). */
export interface FailureAtlasSummary {
  readonly totalEntries: number;
  readonly byFailureClass: Readonly<Record<string, number>>;
  readonly worldsCovered: number;
  readonly runsCovered: number;
}

/** Summarize an atlas ledger (a derived projection — never an authority). */
export function summarizeFailureAtlas(entries: readonly NeutralFailureAtlasEntry[]): FailureAtlasSummary {
  const byFailureClass: Record<string, number> = {};
  const worlds = new Set<string>();
  const runs = new Set<string>();
  for (const entry of entries) {
    byFailureClass[entry.failureClass] = (byFailureClass[entry.failureClass] ?? 0) + 1;
    worlds.add(entry.worldRef);
    runs.add(entry.runRef);
  }
  const sorted: Record<string, number> = {};
  for (const key of Object.keys(byFailureClass).sort()) {
    sorted[key] = byFailureClass[key]!;
  }
  return { totalEntries: entries.length, byFailureClass: sorted, worldsCovered: worlds.size, runsCovered: runs.size };
}
