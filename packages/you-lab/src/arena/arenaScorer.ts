// Deterministic arena fidelity scorer (W8C).
//
// The arena fidelity score is a COMPUTED fixture objective (deterministic
// arithmetic over the intended run-ladder model — the canonical
// category-ladder/class-dependent synthetic model applied to the
// invocation's gap record and retry ladder — and the adapter's run records
// and expert-result payloads) — it is explicitly not a user study, not a
// live measurement, and not a scientific claim about any real arena
// provider or retry library. Effort, latency and cost are recorded by the
// runner as "not-measured (simulated)" markers; they are never faked here.

import { roundTo } from "../determinism.js";
import {
  aggregateContentDigest,
  decodeArenaExpertResult,
  encodeArenaExpertResult,
  intendedFindingFor,
  intendedRecoveryAt,
  intendedResultTypeFor,
  intendedRunStatusAt,
  intendedStrategyAt,
  type NeutralArenaInvocation,
  type NeutralArenaOutput,
  type NeutralArenaRunRecord,
} from "./arenaAdapterSeam.js";

/** Score weights (authored fixture definition — asserted in tests; the W5C/W6C/W7C 0.6/0.2/0.2 shape). */
export const ARENA_FIDELITY_WEIGHTS = { evidenceCoverage: 0.6, outcomeFaithfulness: 0.2, recordIntegrity: 0.2 } as const;

export const SCORER_ARENA_VERSION =
  "you-lab-arena-scorer/1 (deterministic fixture objective — computed, not measured)";

/** One intended run-ladder entry (the fixture objective over an attempt). */
export interface IntendedArenaRunEntry {
  readonly attempt: number;
  readonly strategy: string;
  readonly status: "completed" | "failed";
}

/**
 * The intended run ladder for (gap, retry ladder): attempts 1..maxAttempts
 * under the canonical intended model, stopping at the first completed
 * attempt (the same seeded model simulated adapters derive from — computed,
 * not measured).
 */
export function intendedRunLadderFor(
  gap: NeutralArenaInvocation["gap"],
  retryLadder: NeutralArenaInvocation["retryLadder"],
): readonly IntendedArenaRunEntry[] {
  const entries: IntendedArenaRunEntry[] = [];
  for (let attempt = 1; attempt <= retryLadder.maxAttempts; attempt++) {
    const status = intendedRunStatusAt(gap.id, attempt);
    entries.push({ attempt, strategy: intendedStrategyAt(gap.category, attempt), status });
    if (status === "completed") break;
  }
  return entries;
}

/**
 * The intended expert-result entry for the first completed attempt under
 * the REQUESTED backoff class (the canonical class-dependent synthetic
 * model — full evidence coverage, authored result type, exact recovery).
 */
export function intendedExpertResultFor(
  request: NeutralArenaInvocation,
): { readonly entry: ReturnType<typeof intendedEntry> | null; readonly attempt: number | null } {
  const intended = intendedRunLadderFor(request.gap, request.retryLadder);
  const completed = intended.find((entry) => entry.status === "completed");
  if (!completed) return { entry: null, attempt: null };
  return { entry: intendedEntry(request, completed.attempt, completed.strategy), attempt: completed.attempt };
}

function intendedEntry(
  request: NeutralArenaInvocation,
  attempt: number,
  strategy: string,
): {
  readonly resultType: "typed-payload" | "artifact" | "guidance";
  readonly finding: string;
  readonly recovery: number;
  readonly evidenceRefs: readonly string[];
  readonly strategy: string;
  readonly attempt: number;
  readonly deliveredAt: string;
} {
  return {
    resultType: intendedResultTypeFor(request.gap.category),
    finding: intendedFindingFor(request.gap, strategy),
    recovery: intendedRecoveryAt(request.gap.id, request.retryLadder.backoffClass),
    evidenceRefs: [...request.gap.failureEvidence],
    strategy,
    attempt,
    deliveredAt: request.submittedAt,
  };
}

/** Deterministic digest over the intended expert result under the requested class (golden fixture objective). */
export function intendedExpertResultDigest(request: NeutralArenaInvocation): string {
  const { entry } = intendedExpertResultFor(request);
  if (entry === null) {
    return aggregateContentDigest(null, request.retryLadder.backoffClass);
  }
  const payload = encodeArenaExpertResult(entry, request, request.retryLadder.backoffClass);
  return aggregateContentDigest(payload, request.retryLadder.backoffClass);
}

export interface ArenaFidelityParts {
  /** Fraction of the gap's failure-evidence refs addressed by the expert result. */
  readonly evidenceCoverage: number;
  /**
   * Fraction of expert-result content recovered exactly (thirds: strategy
   * match, recovery match, result-type match — matched against the
   * intended model under the REQUESTED backoff class).
   */
  readonly outcomeFaithfulness: number;
  /** Fraction of run records that are structurally valid content-addressed v8-shaped ladder entries. */
  readonly recordIntegrity: number;
  readonly fidelityScore: number;
}

/**
 * Score an arena invocation: compare the adapter's run records and
 * expert-result payload against the intended run-ladder model (the
 * canonical category-ladder/class-dependent model applied to the same gap
 * and retry ladder), and verify every produced record is a structurally
 * valid content-addressed shape (append-only ladder semantics; the
 * aggregate digest binds the payload; the record threads the gap's
 * identity).
 */
export function scoreArenaInvocation(
  request: NeutralArenaInvocation,
  output: NeutralArenaOutput,
): ArenaFidelityParts {
  // Evidence coverage: fraction of the gap's failure-evidence refs
  // addressed by the expert result payload.
  const completed = output.runRecords.find((record) => record.status === "completed");
  const payload = completed ? output.payloads[completed.id] : undefined;
  const decoded = payload === undefined ? null : decodeArenaExpertResult(payload);
  const addressed = new Set(decoded?.evidenceRefs ?? []);
  let coveredCount = 0;
  for (const evidenceRef of request.gap.failureEvidence) {
    if (addressed.has(evidenceRef)) coveredCount += 1;
  }
  const evidenceCoverage = request.gap.failureEvidence.length === 0 ? 1 : coveredCount / request.gap.failureEvidence.length;

  // Outcome faithfulness: thirds over strategy match, recovery match and
  // result-type match against the intended model under the REQUESTED class
  // (a misderiving adapter answers under a different class and loses
  // recovery credit — visible, never rewritten).
  let faithfulness = 0;
  if (decoded !== null) {
    const intended = intendedExpertResultFor(request);
    let credit = 0;
    if (intended.entry !== null) {
      if (decoded.strategy === intended.entry.strategy) credit += 1 / 3;
      if (decoded.recovery === intended.entry.recovery) credit += 1 / 3;
      if (decoded.resultType === intended.entry.resultType) credit += 1 / 3;
    }
    faithfulness = credit;
  }

  // Record integrity: fraction of run records that are structurally valid
  // content-addressed v8-shaped ladder entries (append-only ladder
  // semantics, id format, gap identity threading, payload binding via the
  // aggregate digest — a broken aggregate digest voids all integrity).
  let valid = 0;
  let seenCompleted = false;
  for (let index = 0; index < output.runRecords.length; index++) {
    const record: NeutralArenaRunRecord = output.runRecords[index]!;
    const validShape =
      /^you_arena-run_[0-9a-f]{16}$/.test(record.id) &&
      record.gapId === request.gap.id &&
      record.attempt === index + 1 &&
      (record.status === "completed" || record.status === "failed") &&
      !seenCompleted &&
      record.completedAt !== null &&
      record.startedAt.length > 0 &&
      record.simulated === true &&
      (record.status === "completed"
        ? record.outcomeEvidenceRef !== null && record.outcomeEvidenceRef.startsWith("content-store://you-lab/arena/")
        : record.outcomeEvidenceRef === null || record.outcomeEvidenceRef.startsWith("content-store://you-lab/arena/"));
    if (validShape) valid += 1;
    if (record.status === "completed") seenCompleted = true;
  }
  const validFraction = output.runRecords.length === 0 ? 1 : valid / output.runRecords.length;
  const hashBinds = output.resultContentHash === aggregateDigest(output);
  const recordIntegrity = hashBinds ? validFraction : 0;

  return {
    evidenceCoverage: roundTo(evidenceCoverage, 4),
    outcomeFaithfulness: roundTo(faithfulness, 4),
    recordIntegrity: roundTo(recordIntegrity, 4),
    fidelityScore: roundTo(
      ARENA_FIDELITY_WEIGHTS.evidenceCoverage * evidenceCoverage +
        ARENA_FIDELITY_WEIGHTS.outcomeFaithfulness * faithfulness +
        ARENA_FIDELITY_WEIGHTS.recordIntegrity * recordIntegrity,
      4,
    ),
  };
}

/**
 * Recompute the aggregate content digest from an output's payloads
 * (content-addressing law): the envelope uses the backoff class the
 * payload itself declares it ran under (a misderivation stays visible in
 * the payload — it never breaks the hash binding; the W7C misroute
 * precedent).
 */
function aggregateDigest(output: NeutralArenaOutput): string {
  const completed = output.runRecords.find((record) => record.status === "completed");
  const payload = completed === undefined ? null : (output.payloads[completed.id] ?? null);
  const declaredClass = payload === null ? "" : String(payload.backoffClass ?? "");
  return aggregateContentDigest(payload, declaredClass);
}
