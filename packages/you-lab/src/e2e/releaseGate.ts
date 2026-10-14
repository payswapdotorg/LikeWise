// Release gate: operator signoff + release declaration + the golden gate run (W12C).
//
// OPERATOR SIGNOFF LAW (docs/you/CONTRACTS.md "Wave-12 contract freeze
// (v12)"): the signoff references a COMPLETE passing checklist; it is
// immutable; one release declaration per signoff
// (YOU_OPERATOR_SIGNOFF_INVALID).
//
// RELEASE DECLARATION LAW (ibid.): the declaration carries the full
// evidence bundle AND rollback evidence — the production-eligibility law
// carried to the release (YOU_RELEASE_DECLARATION_INVALID).
//
// This module binds the W11C journey harness outputs to the launch
// gate: the operator signoff is recorded only over an evidence-true
// passing checklist (the LAUNCH GATE LAW derivation re-checked at
// signoff time); the declaration is appended only ONCE per signoff
// through an append-only registry, only over a content-addressed
// evidence bundle, and only with rollback evidence DERIVED from the
// W10C production-eligibility machinery (the ledger's fail-closed
// decision law carried forward to the release plane — the release lane's
// eligible decision carries the rollback ref). The golden gate run
// composes the deterministic full-gate scenario end-to-end: journeys ->
// bundle -> 20-point checklist -> signoff -> declaration, byte-identical
// on replay (every constituent is a pure function of the W11C fixture
// seeds).
//
// The neutral shapes are aligned 1:1 with the frozen v12
// OperatorSignoffRecord/ReleaseDeclarationRecord; mapping onto the
// frozen contract happens ONLY in src/contractSeam.ts. No clock, no
// Math.random, no network; every record stays simulated: true (the
// fixture law — never a claim about a real product deployment).
//
// HONEST MODEL: the registry is the deterministic fixture harness for
// the laws (records supplied by the golden gate run composition, not by
// a live authority); the operator identity is an authored station label,
// never a person.

import { sha256Hex } from "../arena/arenaAdapterSeam.js";
import {
  type ProductionEligibilityLedger,
  createProductionEligibilityLedger,
  createRollbackEvidenceRegistry,
} from "../ecosystem/eligibilityLedger.js";
import { type NeutralJourneyOutcome, runGoldenJourneys } from "./journeyHarness.js";
import { runInjectionCoverageJourneys } from "./failureInjection.js";
import { type NeutralEvidenceBundle, assertBundleContentAddressed, buildEvidenceBundle } from "./evidenceBundle.js";
import {
  assertLaunchGateChecklistLaw,
  deriveLaunchGateChecklist,
  gatePasses,
  type NeutralLaunchGateChecklistRecord,
} from "./gateChecklist.js";

/** Error code aligned with the frozen v12 typed error literal (the OPERATOR SIGNOFF LAW). */
export const OPERATOR_SIGNOFF_INVALID_CODE = "YOU_OPERATOR_SIGNOFF_INVALID";

/** Typed rejection thrown when a signoff violates the OPERATOR SIGNOFF LAW (fail-closed). */
export class OperatorSignoffInvalidError extends Error {
  readonly code = OPERATOR_SIGNOFF_INVALID_CODE;
  constructor(detail: string) {
    super(`${OPERATOR_SIGNOFF_INVALID_CODE}: ${detail}`);
  }
}

/** Error code aligned with the frozen v12 typed error literal (the RELEASE DECLARATION LAW). */
export const RELEASE_DECLARATION_INVALID_CODE = "YOU_RELEASE_DECLARATION_INVALID";

/** Typed rejection thrown when a declaration violates the RELEASE DECLARATION LAW (fail-closed). */
export class ReleaseDeclarationInvalidError extends Error {
  readonly code = RELEASE_DECLARATION_INVALID_CODE;
  constructor(detail: string) {
    super(`${RELEASE_DECLARATION_INVALID_CODE}: ${detail}`);
  }
}

/** Fixed fixture-mode signoff timestamp (FIXTURES.md law: no clock; the gate was checked at 13:00). */
export const OPERATOR_SIGNOFF_SIGNED_AT = "2026-10-15T14:00:00Z";

/** Fixed fixture-mode declaration timestamp (FIXTURES.md law: no clock; the signoff was recorded at 14:00). */
export const RELEASE_DECLARED_AT = "2026-10-15T15:00:00Z";

/** The fixture operator identity for the golden gate run (an authored station label, never a person). */
export const GOLDEN_GATE_OPERATOR = "you-lab-gate-operator-alpha";

// ---------------------------------------------------------------------------
// Operator signoff (the OPERATOR SIGNOFF LAW)
// ---------------------------------------------------------------------------

/** Neutral operator signoff — aligned 1:1 with the frozen v12 OperatorSignoffRecord. */
export interface NeutralOperatorSignoffRecord {
  readonly id: string;
  readonly checklistRef: string;
  readonly signedBy: string;
  readonly signedAt: string;
  readonly simulated: boolean;
}

/** Deterministic signoff id — you_signoff_<16hex>. */
export function operatorSignoffId(checklistRef: string, signedBy: string, signedAt: string): string {
  return `you_signoff_${sha256Hex(`${checklistRef}|${signedBy}|${signedAt}`).slice(0, 16)}`;
}

/** Options for the signoff recording. */
export interface OperatorSignoffOptions {
  readonly signedBy: string;
  /** The evidence bundle the checklist's evidence refs must resolve inside (verified when provided). */
  readonly bundle?: NeutralEvidenceBundle;
  readonly signedAt?: string;
}

/**
 * Record the operator's signoff over a launch-gate checklist. OPERATOR
 * SIGNOFF LAW fail-closed: the checklist must be the evidence-true
 * derivation over the provided journeys (the LAUNCH GATE LAW re-checked
 * at signoff time — a detached checklist is never signed) and must be
 * COMPLETE and passing — a red gate is never signed. The record is
 * immutable (frozen at construction; a reversal would be a new record,
 * never a mutation).
 */
export function recordOperatorSignoff(
  checklist: NeutralLaunchGateChecklistRecord,
  journeys: readonly NeutralJourneyOutcome[],
  options: OperatorSignoffOptions,
): NeutralOperatorSignoffRecord {
  if (options.signedBy.length === 0) {
    throw new OperatorSignoffInvalidError("empty signedBy (a signoff names its operator)");
  }
  const signedAt = options.signedAt ?? OPERATOR_SIGNOFF_SIGNED_AT;
  if (signedAt.length === 0) {
    throw new OperatorSignoffInvalidError("empty signedAt (a signoff names its instant)");
  }
  assertLaunchGateChecklistLaw(
    checklist,
    journeys,
    options.bundle !== undefined ? { bundle: options.bundle } : {},
  );
  if (!gatePasses(checklist)) {
    throw new OperatorSignoffInvalidError(
      `the signoff references a COMPLETE passing checklist — checklist '${checklist.id}' does not pass all 20 points (a red gate is never signed)`,
    );
  }
  return Object.freeze({
    id: operatorSignoffId(checklist.id, options.signedBy, signedAt),
    checklistRef: checklist.id,
    signedBy: options.signedBy,
    signedAt,
    simulated: true,
  } satisfies NeutralOperatorSignoffRecord);
}

// ---------------------------------------------------------------------------
// Rollback evidence — the W10C production-eligibility machinery carried
// forward to the release plane (the RELEASE DECLARATION LAW)
// ---------------------------------------------------------------------------

/** The release-plane rollback-evidence derivation (the W10C machinery carried forward). */
export interface NeutralReleaseRollbackEvidence {
  readonly subjectRef: string;
  /** The W10C production-eligibility decision backing the release (its ledger record id). */
  readonly eligibilityRecordId: string;
  /** The rollback artifact ref the eligible decision carries (resolves in the ledger's evidence registry by W10C law). */
  readonly rollbackEvidenceRef: string;
  readonly decidedAt: string;
  readonly simulated: boolean;
}

/**
 * Derive the release's rollback evidence from the W10C
 * production-eligibility machinery: the subject's LATEST ledger decision
 * must exist and be eligible, and the release carries THAT decision's
 * rollback evidence ref (the ledger already guarantees the ref resolves
 * in its evidence registry — the W10C fail-closed law). An unbacked
 * release (no decision, or a not-eligible latest decision) is a typed
 * refusal — the PRODUCTION ELIGIBILITY LAW carried to the release.
 */
export function deriveReleaseRollbackEvidence(
  ledger: ProductionEligibilityLedger,
  subjectRef: string,
): NeutralReleaseRollbackEvidence {
  if (subjectRef.length === 0) {
    throw new ReleaseDeclarationInvalidError(
      "empty subjectRef (the release's rollback evidence names its subject)",
    );
  }
  const latest = ledger.latestDecisionFor(subjectRef);
  if (latest === null) {
    throw new ReleaseDeclarationInvalidError(
      `no production-eligibility decision for subject '${subjectRef}' — the release carries the W10C eligibility machinery's rollback evidence (an unbacked release is refused)`,
    );
  }
  if (!latest.eligible) {
    throw new ReleaseDeclarationInvalidError(
      `the latest production-eligibility decision for subject '${subjectRef}' is NOT eligible (record '${latest.id}') — a reversed or ineligible subject never releases`,
    );
  }
  return Object.freeze({
    subjectRef,
    eligibilityRecordId: latest.id,
    rollbackEvidenceRef: latest.rollbackEvidenceRef,
    decidedAt: latest.decidedAt,
    simulated: true,
  } satisfies NeutralReleaseRollbackEvidence);
}

/**
 * RELEASE DECLARATION LAW fail-closed check: the rollback evidence still
 * matches the ledger's latest eligible decision for its subject (the
 * derivation re-run — a stale or fabricated ref is a typed rejection,
 * never carried evidence).
 */
export function assertRollbackEvidenceBacked(
  rollbackEvidence: NeutralReleaseRollbackEvidence,
  ledger: ProductionEligibilityLedger,
): void {
  const derived = deriveReleaseRollbackEvidence(ledger, rollbackEvidence.subjectRef);
  if (
    derived.eligibilityRecordId !== rollbackEvidence.eligibilityRecordId ||
    derived.rollbackEvidenceRef !== rollbackEvidence.rollbackEvidenceRef ||
    derived.decidedAt !== rollbackEvidence.decidedAt
  ) {
    throw new ReleaseDeclarationInvalidError(
      `the rollback evidence (record '${rollbackEvidence.eligibilityRecordId}') diverges from the ledger's latest eligible decision for subject '${rollbackEvidence.subjectRef}' (record '${derived.eligibilityRecordId}') — a stale or fabricated rollback ref is never carried`,
    );
  }
}

// ---------------------------------------------------------------------------
// Release declaration + the append-only registry (one per signoff)
// ---------------------------------------------------------------------------

/** Neutral release declaration — aligned 1:1 with the frozen v12 ReleaseDeclarationRecord. */
export interface NeutralReleaseDeclarationRecord {
  readonly id: string;
  readonly signoffRef: string;
  readonly evidenceBundleRef: string;
  readonly rollbackEvidenceRef: string;
  readonly declaredAt: string;
  readonly simulated: boolean;
}

/** Deterministic declaration id — you_release_<16hex>. */
export function releaseDeclarationId(
  signoffRef: string,
  evidenceBundleRef: string,
  rollbackEvidenceRef: string,
  declaredAt: string,
): string {
  return `you_release_${sha256Hex(`${signoffRef}|${evidenceBundleRef}|${rollbackEvidenceRef}|${declaredAt}`).slice(0, 16)}`;
}

/** Construction input for a release declaration (the registry mints the id and enforces the laws). */
export interface ReleaseDeclarationInput {
  readonly signoff: NeutralOperatorSignoffRecord;
  readonly bundle: NeutralEvidenceBundle;
  readonly rollbackEvidence: NeutralReleaseRollbackEvidence;
  /** When provided, the rollback evidence is re-derived from the ledger and compared (fail-closed). */
  readonly ledger?: ProductionEligibilityLedger;
  readonly declaredAt?: string;
}

/** The append-only release-declaration registry (one declaration per signoff — the OPERATOR SIGNOFF LAW). */
export interface ReleaseDeclarationRegistry {
  /** All declarations in append order (immutable records). */
  readonly declarations: readonly NeutralReleaseDeclarationRecord[];
  bySignoff(signoffRef: string): NeutralReleaseDeclarationRecord | null;
  byId(id: string): NeutralReleaseDeclarationRecord | null;
  /** Append a new declaration (the registry mints the id; the laws are enforced fail-closed). */
  declare(input: ReleaseDeclarationInput): NeutralReleaseDeclarationRecord;
  /** The current declaration count (fixture bookkeeping). */
  size(): number;
}

/**
 * Build the release-declaration registry (the deterministic fixture
 * harness for the RELEASE DECLARATION LAW). Declarations are append-only
 * immutable records; a second declaration for the same signoff is a
 * typed refusal (one release declaration per signoff).
 */
export function createReleaseDeclarationRegistry(): ReleaseDeclarationRegistry {
  const declarations: NeutralReleaseDeclarationRecord[] = [];
  const byIdMap = new Map<string, NeutralReleaseDeclarationRecord>();
  const bySignoffMap = new Map<string, NeutralReleaseDeclarationRecord>();
  const append = (input: ReleaseDeclarationInput): NeutralReleaseDeclarationRecord => {
    if (
      input.signoff.id.length === 0 ||
      input.signoff.checklistRef.length === 0 ||
      input.signoff.signedBy.length === 0 ||
      input.signoff.signedAt.length === 0
    ) {
      throw new ReleaseDeclarationInvalidError(
        "the signoff's identity fields are empty (a declaration references a real signoff)",
      );
    }
    if (input.signoff.simulated !== true) {
      throw new ReleaseDeclarationInvalidError(
        "the signoff must carry simulated: true (an unlabelled signoff is a truth-law fabrication)",
      );
    }
    // the evidence bundle: content-addressed and non-empty (the RELEASE DECLARATION LAW's evidence clause)
    assertBundleContentAddressed(input.bundle);
    if (
      input.rollbackEvidence.subjectRef.length === 0 ||
      input.rollbackEvidence.eligibilityRecordId.length === 0 ||
      input.rollbackEvidence.rollbackEvidenceRef.length === 0 ||
      input.rollbackEvidence.decidedAt.length === 0
    ) {
      throw new ReleaseDeclarationInvalidError(
        "the rollback evidence's fields are empty (a declaration names its rollback backing)",
      );
    }
    if (input.rollbackEvidence.simulated !== true) {
      throw new ReleaseDeclarationInvalidError(
        "the rollback evidence must carry simulated: true (an unlabelled derivation is a truth-law fabrication)",
      );
    }
    if (input.ledger !== undefined) {
      assertRollbackEvidenceBacked(input.rollbackEvidence, input.ledger);
    }
    const existing = bySignoffMap.get(input.signoff.id);
    if (existing !== undefined) {
      throw new ReleaseDeclarationInvalidError(
        `signoff '${input.signoff.id}' already carries declaration '${existing.id}' — one release declaration per signoff (the OPERATOR SIGNOFF LAW)`,
      );
    }
    const declaredAt = input.declaredAt ?? RELEASE_DECLARED_AT;
    if (declaredAt.length === 0) {
      throw new ReleaseDeclarationInvalidError("empty declaredAt (a declaration names its instant)");
    }
    const id = releaseDeclarationId(
      input.signoff.id,
      input.bundle.id,
      input.rollbackEvidence.rollbackEvidenceRef,
      declaredAt,
    );
    if (byIdMap.has(id)) {
      throw new ReleaseDeclarationInvalidError(`declaration id '${id}' already exists (the registry mints unique ids)`);
    }
    const record = Object.freeze({
      id,
      signoffRef: input.signoff.id,
      evidenceBundleRef: input.bundle.id,
      rollbackEvidenceRef: input.rollbackEvidence.rollbackEvidenceRef,
      declaredAt,
      simulated: true,
    } satisfies NeutralReleaseDeclarationRecord);
    declarations.push(record);
    byIdMap.set(record.id, record);
    bySignoffMap.set(record.signoffRef, record);
    return record;
  };
  return {
    declarations,
    bySignoff(signoffRef: string): NeutralReleaseDeclarationRecord | null {
      return bySignoffMap.get(signoffRef) ?? null;
    },
    byId(id: string): NeutralReleaseDeclarationRecord | null {
      return byIdMap.get(id) ?? null;
    },
    declare: append,
    size(): number {
      return declarations.length;
    },
  };
}

// ---------------------------------------------------------------------------
// The standard release rollback machinery — the W10C production-
// eligibility plane carried forward (W12C)
// ---------------------------------------------------------------------------

/** The release subject: the YOU launch lane this gate declares for (an authored fixture subject). */
export const RELEASE_ELIGIBILITY_SUBJECT = "you-release-lane";

/** The release lane's rollback-evidence ref (a content-addressed fixture artifact — never a claim about a real rollback). */
export const RELEASE_ROLLBACK_EVIDENCE_REF = "content-store://you-lab/gate/rollback/you-release-lane";

/** Fixed fixture-mode eligibility timestamp — the rollback decision PRECEDES the gate run (journeys at 12:00). */
export const RELEASE_ELIGIBILITY_DECIDED_AT = "2026-10-15T11:00:00Z";

/**
 * The standard release eligibility ledger: the release lane's eligible
 * decision, appended THROUGH the W10C production-eligibility machinery
 * (createProductionEligibilityLedger — its fail-closed law requires the
 * rollback ref to resolve in the evidence registry; the decision is an
 * immutable ledger record). This is the W10C machinery carried forward,
 * not a reimplementation.
 */
export function createStandardReleaseEligibilityLedger(): ProductionEligibilityLedger {
  const evidence = createRollbackEvidenceRegistry([RELEASE_ROLLBACK_EVIDENCE_REF]);
  return createProductionEligibilityLedger(evidence, [
    {
      subjectRef: RELEASE_ELIGIBILITY_SUBJECT,
      eligible: true,
      rollbackEvidenceRef: RELEASE_ROLLBACK_EVIDENCE_REF,
      decidedAt: RELEASE_ELIGIBILITY_DECIDED_AT,
    },
  ]);
}

// ---------------------------------------------------------------------------
// The golden gate run — the deterministic full-gate scenario
// ---------------------------------------------------------------------------

/** The golden gate run fixture-set version. */
export const GOLDEN_GATE_RUN_VERSION = "you-lab-golden-gate-run/1";

/**
 * Golden: the standard gate evidence bundle id (24 records: golden +
 * injection-recovery), recorded from the shipped composition on
 * 2026-10-15. An intentional change to any constituent is a NEW run
 * version with provenance — never an in-place edit.
 */
export const GOLDEN_GATE_BUNDLE_ID = "you_evidence_7ee620daf7a25960";

/** Golden: the 20-point checklist id derived from the standard evidence set. */
export const GOLDEN_GATE_CHECKLIST_ID = "you_gate_219e6beda58125b7";

/** Golden: the operator signoff id over the golden checklist. */
export const GOLDEN_GATE_SIGNOFF_ID = "you_signoff_8bd234ba7dbfaf47";

/** Golden: the release declaration id over the golden signoff + bundle + rollback evidence. */
export const GOLDEN_GATE_DECLARATION_ID = "you_release_f35c174400b2d1b8";

/** The full outcome of one golden gate run (every stage record is the evidence). */
export interface GoldenGateRunOutcome {
  readonly runVersion: string;
  /** The evidence journey set (golden + injection-recovery; 24 seed-derived runs). */
  readonly journeys: readonly NeutralJourneyOutcome[];
  readonly bundle: NeutralEvidenceBundle;
  readonly checklist: NeutralLaunchGateChecklistRecord;
  readonly signoff: NeutralOperatorSignoffRecord;
  readonly rollbackEvidence: NeutralReleaseRollbackEvidence;
  readonly declaration: NeutralReleaseDeclarationRecord;
  readonly notes: readonly string[];
  readonly simulated: boolean;
}

/**
 * The golden gate run: the deterministic full-gate scenario — the
 * standard evidence journeys (golden + injection-recovery) -> the
 * content-addressed evidence bundle -> the 20-point checklist (all
 * green) -> the operator signoff -> the release declaration (rollback
 * evidence derived from the W10C machinery). Byte-identical replay:
 * every constituent is a pure function of the W11C fixture seeds (no
 * clock, no randomness, no network).
 */
export function runGoldenGateRun(): GoldenGateRunOutcome {
  const journeys = [...runGoldenJourneys(), ...runInjectionCoverageJourneys()];
  const bundle = buildEvidenceBundle(journeys);
  const checklist = deriveLaunchGateChecklist(journeys, { bundle });
  const signoff = recordOperatorSignoff(checklist, journeys, {
    signedBy: GOLDEN_GATE_OPERATOR,
    bundle,
  });
  const ledger = createStandardReleaseEligibilityLedger();
  const rollbackEvidence = deriveReleaseRollbackEvidence(ledger, RELEASE_ELIGIBILITY_SUBJECT);
  const registry = createReleaseDeclarationRegistry();
  const declaration = registry.declare({ signoff, bundle, rollbackEvidence, ledger });
  const notes = [
    "the gate evidence journeys are deterministic seed-derived simulations (the W11C harness: no clock, no Math.random, no network)",
    "the evidence bundle is content-addressed: the id is the sha256 digest over the canonical versioned record set (the golden + injection-recovery runs)",
    "every checklist point passes only with point-N journey evidence (the LAUNCH GATE LAW at the compute plane — never a bare assertion)",
    "the signoff references the complete passing 20-point checklist; the declaration carries the evidence bundle and rollback evidence derived from the W10C production-eligibility machinery",
    "the whole scenario is a you-lab fixture (simulated: true throughout) — never a claim about a real product deployment",
  ];
  return Object.freeze({
    runVersion: GOLDEN_GATE_RUN_VERSION,
    journeys: Object.freeze(journeys),
    bundle,
    checklist,
    signoff,
    rollbackEvidence,
    declaration,
    notes: Object.freeze(notes),
    simulated: true,
  } satisfies GoldenGateRunOutcome);
}
