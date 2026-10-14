// Production eligibility ledger — the W10C eligibility plane (W10C).
//
// PRODUCTION ELIGIBILITY LAW (docs/you/CONTRACTS.md "Wave-10 contract
// freeze (v10)"): eligibility REQUIRES rollback evidence; decisions are
// IMMUTABLE; a reversal is a NEW record (never a mutation); violations are
// typed errors (YOU_PRODUCTION_ELIGIBILITY_INVALID).
//
// The neutral ProductionEligibilityRecord shape is owned by you-lab and is
// structurally aligned 1:1 with the frozen v10 ProductionEligibilityRecord
// (id, subjectRef, eligible, rollbackEvidenceRef, decidedAt, simulated);
// mapping onto the frozen contract happens ONLY in src/contractSeam.ts.
//
// Ledger semantics: the ledger is append-only. A subject (provider, lane,
// or artifact class — an opaque ref) may hold any number of decisions; the
// LATEST decision by append order is the current one; reversing an earlier
// decision appends a new record that cites the reversed record id in its
// reversal basis. An in-place "update" of an existing record is refused
// (records are deep-frozen at construction). Eligible decisions require a
// non-empty rollbackEvidenceRef that resolves in the ledger's evidence
// registry (fail-closed — the law's rollback-evidence requirement).
//
// HONEST MODEL: the ledger is the deterministic fixture harness for the
// law (decisions supplied by the benchmark/fixtures, not by a live
// authority); every record stays `simulated: true`. No clock: decidedAt
// comes from the caller's fixture timestamp. No network, no Math.random.

import { sha256Hex } from "../arena/arenaAdapterSeam.js";

/** Error code aligned with the frozen v10 typed error literal (the PRODUCTION ELIGIBILITY LAW). */
export const PRODUCTION_ELIGIBILITY_INVALID_CODE = "YOU_PRODUCTION_ELIGIBILITY_INVALID";

/** Typed refusal thrown when a decision violates the eligibility law (fail-closed). */
export class ProductionEligibilityInvalidError extends Error {
  readonly code = PRODUCTION_ELIGIBILITY_INVALID_CODE;
  constructor(detail: string) {
    super(`${PRODUCTION_ELIGIBILITY_INVALID_CODE}: ${detail}`);
  }
}

/**
 * Neutral production-eligibility record — aligned 1:1 with the frozen v10
 * ProductionEligibilityRecord plus the ledger's reversal linkage (the
 * neutral reversalOf field is ledger-local bookkeeping; the frozen shape
 * carries only the law's own fields).
 */
export interface NeutralProductionEligibilityRecord {
  readonly id: string;
  readonly subjectRef: string;
  readonly eligible: boolean;
  readonly rollbackEvidenceRef: string;
  readonly decidedAt: string;
  /** Ledger-local: the record id this decision reverses (null for non-reversals). */
  readonly reversalOf: string | null;
  readonly simulated: boolean;
}

/** Construction input for a new decision (the ledger mints the id). */
export interface EligibilityDecisionInput {
  readonly subjectRef: string;
  readonly eligible: boolean;
  /** Non-empty rollback evidence ref — REQUIRED for every decision (the law). */
  readonly rollbackEvidenceRef: string;
  readonly decidedAt: string;
  /** When supplied, this decision reverses that record id (must exist; must be for the same subject). */
  readonly reversalOf?: string | null;
}

/** Opaque deterministic record id for (subjectRef, decidedAt, sequence) — you_eligibility_<16hex>. */
export function eligibilityRecordId(subjectRef: string, decidedAt: string, sequence: number): string {
  return `you_eligibility_${sha256Hex(`${subjectRef}|${decidedAt}|${sequence}`).slice(0, 16)}`;
}

/** Deep-freeze a record (immutability law — records never mutate in place). */
function freezeRecord(record: NeutralProductionEligibilityRecord): NeutralProductionEligibilityRecord {
  return Object.freeze({ ...record });
}

/** The append-only production-eligibility ledger (deterministic harness). */
export interface ProductionEligibilityLedger {
  /** All decisions in append order (immutable records). */
  readonly decisions: readonly NeutralProductionEligibilityRecord[];
  /** The latest decision for a subject (append order), or null when none. */
  latestDecisionFor(subjectRef: string): NeutralProductionEligibilityRecord | null;
  byId(id: string): NeutralProductionEligibilityRecord | null;
  /** Append a new decision (the ledger mints the id; the law is enforced fail-closed). */
  decide(input: EligibilityDecisionInput): NeutralProductionEligibilityRecord;
  /** The current decision count (fixture bookkeeping). */
  size(): number;
}

/** The registry of rollback-evidence refs the ledger resolves against (fail-closed evidence law). */
export interface RollbackEvidenceRegistry {
  /** Resolve an evidence ref — true when the ref is a known rollback artifact. */
  has(ref: string): boolean;
  readonly refs: readonly string[];
}

/** A simple fixed evidence registry (deterministic; the fixture harness supplies the refs). */
export function createRollbackEvidenceRegistry(refs: readonly string[]): RollbackEvidenceRegistry {
  const set = new Set(refs);
  return {
    refs: [...set].sort(),
    has(ref: string): boolean {
      return set.has(ref);
    },
  };
}

/**
 * Build the production-eligibility ledger (the deterministic fixture
 * harness for the PRODUCTION ELIGIBILITY LAW). The optional seed
 * decisions append in order BEFORE the ledger is returned (each seed
   * passes the same fail-closed law checks).
 */
export function createProductionEligibilityLedger(
  evidence: RollbackEvidenceRegistry,
  seedDecisions: readonly EligibilityDecisionInput[] = [],
): ProductionEligibilityLedger {
  const decisions: NeutralProductionEligibilityRecord[] = [];
  const byIdMap = new Map<string, NeutralProductionEligibilityRecord>();
  const bySubject = new Map<string, NeutralProductionEligibilityRecord[]>();

  const append = (input: EligibilityDecisionInput): NeutralProductionEligibilityRecord => {
    if (input.subjectRef.length === 0) {
      throw new ProductionEligibilityInvalidError("empty subjectRef (a decision names its subject — provider, lane, or artifact class)");
    }
    if (input.rollbackEvidenceRef.length === 0) {
      throw new ProductionEligibilityInvalidError(
        `decision for subject '${input.subjectRef}' carries an empty rollbackEvidenceRef — the PRODUCTION ELIGIBILITY LAW requires rollback evidence for every decision (both eligible and reversal records)`,
      );
    }
    if (input.decidedAt.length === 0) {
      throw new ProductionEligibilityInvalidError(`decision for subject '${input.subjectRef}' carries an empty decidedAt`);
    }
    if (!evidence.has(input.rollbackEvidenceRef)) {
      throw new ProductionEligibilityInvalidError(
        `decision for subject '${input.subjectRef}' cites rollbackEvidenceRef '${input.rollbackEvidenceRef}' which does not resolve in the evidence registry (fail-closed — never an unbacked decision)`,
      );
    }
    let reversalOf: string | null = null;
    if (input.reversalOf !== null && input.reversalOf !== undefined) {
      const reversed = byIdMap.get(input.reversalOf);
      if (!reversed) {
        throw new ProductionEligibilityInvalidError(
          `reversal cites record '${input.reversalOf}' which is not in the ledger (a reversal threads the record it reverses)`,
        );
      }
      if (reversed.subjectRef !== input.subjectRef) {
        throw new ProductionEligibilityInvalidError(
          `reversal cites record '${input.reversalOf}' for subject '${reversed.subjectRef}' but the new decision is for subject '${input.subjectRef}' (subject identity law)`,
        );
      }
      reversalOf = input.reversalOf;
    }
    const sequence = decisions.length + 1;
    const id = eligibilityRecordId(input.subjectRef, input.decidedAt, sequence);
    if (byIdMap.has(id)) {
      throw new ProductionEligibilityInvalidError(`record id '${id}' already exists (the ledger mints unique ids)`);
    }
    const record = freezeRecord({
      id,
      subjectRef: input.subjectRef,
      eligible: input.eligible,
      rollbackEvidenceRef: input.rollbackEvidenceRef,
      decidedAt: input.decidedAt,
      reversalOf,
      simulated: true,
    });
    decisions.push(record);
    byIdMap.set(record.id, record);
    const subjectDecisions = bySubject.get(record.subjectRef) ?? [];
    subjectDecisions.push(record);
    bySubject.set(record.subjectRef, subjectDecisions);
    return record;
  };

  for (const seed of seedDecisions) {
    append(seed);
  }

  return {
    decisions,
    latestDecisionFor(subjectRef: string): NeutralProductionEligibilityRecord | null {
      const subjectDecisions = bySubject.get(subjectRef);
      return subjectDecisions === undefined || subjectDecisions.length === 0 ? null : subjectDecisions[subjectDecisions.length - 1]!;
    },
    byId(id: string): NeutralProductionEligibilityRecord | null {
      return byIdMap.get(id) ?? null;
    },
    decide: append,
    size(): number {
      return decisions.length;
    },
  };
}

/**
 * Law check for external callers: verify a record still matches the
 * ledger's append-only history (identity + immutability). Used by the seam
 * tests to prove a record cannot be swapped or mutated into the path.
 */
export function assertRecordIntact(
  ledger: ProductionEligibilityLedger,
  record: NeutralProductionEligibilityRecord,
): void {
  const stored = ledger.byId(record.id);
  if (!stored) {
    throw new ProductionEligibilityInvalidError(`record '${record.id}' is not in the ledger (never a fabricated record)`);
  }
  if (
    stored.subjectRef !== record.subjectRef ||
    stored.eligible !== record.eligible ||
    stored.rollbackEvidenceRef !== record.rollbackEvidenceRef ||
    stored.decidedAt !== record.decidedAt ||
    stored.reversalOf !== record.reversalOf ||
    stored.simulated !== record.simulated
  ) {
    throw new ProductionEligibilityInvalidError(
      `record '${record.id}' diverges from the ledger's stored copy (immutability law — a record never mutates in place)`,
    );
  }
}

/** Digest label for the neutral eligibility ledger (honest provenance wiring). */
export function eligibilityLedgerVersion(): string {
  return "you-lab-eligibility-ledger/1 (append-only fixture harness — the PRODUCTION ELIGIBILITY LAW enforced fail-closed)";
}
