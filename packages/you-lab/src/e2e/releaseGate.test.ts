// Release gate tests (W12C) — coverage: the OPERATOR SIGNOFF LAW (the
// signoff references a COMPLETE passing checklist — a red gate is never
// signed; the record is immutable) and the RELEASE DECLARATION LAW (one
// declaration per signoff through the append-only registry; the
// declaration carries the content-addressed evidence bundle AND rollback
// evidence derived from the W10C production-eligibility machinery —
// unbacked, stale or tampered inputs are typed refusals). The golden
// gate run composes the deterministic full-gate scenario with pinned
// golden ids and byte-identical replay from the W11C fixture seeds.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { createProductionEligibilityLedger, createRollbackEvidenceRegistry } from "../ecosystem/eligibilityLedger.js";
import { runTerminalJourneys } from "./failureInjection.js";
import { buildEvidenceBundle, runGateEvidenceJourneys, type NeutralEvidenceBundle } from "./evidenceBundle.js";
import { deriveLaunchGateChecklist, type NeutralLaunchGateChecklistRecord } from "./gateChecklist.js";
import {
  GOLDEN_GATE_BUNDLE_ID,
  GOLDEN_GATE_CHECKLIST_ID,
  GOLDEN_GATE_DECLARATION_ID,
  GOLDEN_GATE_OPERATOR,
  GOLDEN_GATE_RUN_VERSION,
  GOLDEN_GATE_SIGNOFF_ID,
  OPERATOR_SIGNOFF_INVALID_CODE,
  OperatorSignoffInvalidError,
  RELEASE_DECLARATION_INVALID_CODE,
  RELEASE_DECLARED_AT,
  RELEASE_ELIGIBILITY_DECIDED_AT,
  RELEASE_ELIGIBILITY_SUBJECT,
  RELEASE_ROLLBACK_EVIDENCE_REF,
  ReleaseDeclarationInvalidError,
  assertRollbackEvidenceBacked,
  createReleaseDeclarationRegistry,
  createStandardReleaseEligibilityLedger,
  deriveReleaseRollbackEvidence,
  operatorSignoffId,
  recordOperatorSignoff,
  runGoldenGateRun,
  type NeutralOperatorSignoffRecord,
} from "./releaseGate.js";

const STANDARD_JOURNEYS = runGateEvidenceJourneys();
const STANDARD_BUNDLE: NeutralEvidenceBundle = buildEvidenceBundle(STANDARD_JOURNEYS);
const STANDARD_CHECKLIST: NeutralLaunchGateChecklistRecord = deriveLaunchGateChecklist(STANDARD_JOURNEYS, {
  bundle: STANDARD_BUNDLE,
});

test("operator signoff: recorded over an evidence-true passing gate (deterministic, immutable)", () => {
  const signoff = recordOperatorSignoff(STANDARD_CHECKLIST, STANDARD_JOURNEYS, {
    signedBy: GOLDEN_GATE_OPERATOR,
    bundle: STANDARD_BUNDLE,
  });
  assert.match(signoff.id, /^you_signoff_[0-9a-f]{16}$/);
  assert.equal(signoff.id, operatorSignoffId(STANDARD_CHECKLIST.id, GOLDEN_GATE_OPERATOR, signoff.signedAt));
  assert.equal(signoff.checklistRef, STANDARD_CHECKLIST.id);
  assert.equal(signoff.signedBy, GOLDEN_GATE_OPERATOR);
  assert.equal(signoff.simulated, true, "truth law: the signoff fixture stays labelled");
  // determinism: double recording is byte-identical
  const again = recordOperatorSignoff(STANDARD_CHECKLIST, STANDARD_JOURNEYS, {
    signedBy: GOLDEN_GATE_OPERATOR,
    bundle: STANDARD_BUNDLE,
  });
  assert.deepEqual(again, signoff);
  // immutability (the OPERATOR SIGNOFF LAW): the record is frozen at construction
  assert.throws(
    () => {
      (signoff as { checklistRef?: string }).checklistRef = "you_gate_tampered";
    },
    TypeError,
    "a frozen signoff record never mutates in place",
  );
  assert.equal(signoff.checklistRef, STANDARD_CHECKLIST.id);
});

test("operator signoff: refusal paths — a red gate is never signed; a detached checklist is never signed; no anonymous operator", () => {
  const [terminalEvidence] = runTerminalJourneys();
  assert.ok(terminalEvidence);
  // a red (5/20) checklist derived from a terminal journey is honestly refused
  const redChecklist = deriveLaunchGateChecklist([terminalEvidence]);
  assert.throws(
    () => recordOperatorSignoff(redChecklist, [terminalEvidence], { signedBy: GOLDEN_GATE_OPERATOR }),
    (error: unknown) =>
      error instanceof OperatorSignoffInvalidError &&
      error.code === OPERATOR_SIGNOFF_INVALID_CODE &&
      /COMPLETE passing checklist/.test(error.message),
  );
  // a detached checklist (a bare-assertion point) is refused by the LAUNCH GATE LAW re-check at signoff time
  const doctored: NeutralLaunchGateChecklistRecord = {
    ...STANDARD_CHECKLIST,
    points: Object.freeze([
      Object.freeze({ ...STANDARD_CHECKLIST.points[0]!, journeyEvidenceRef: null }),
      ...STANDARD_CHECKLIST.points.slice(1),
    ]),
  };
  assert.throws(
    () => recordOperatorSignoff(doctored, STANDARD_JOURNEYS, { signedBy: GOLDEN_GATE_OPERATOR, bundle: STANDARD_BUNDLE }),
    /passes with no journey evidence/,
  );
  // an empty operator identity is refused
  assert.throws(
    () => recordOperatorSignoff(STANDARD_CHECKLIST, STANDARD_JOURNEYS, { signedBy: "" }),
    /empty signedBy/,
  );
  assert.throws(
    () => recordOperatorSignoff(STANDARD_CHECKLIST, STANDARD_JOURNEYS, { signedBy: GOLDEN_GATE_OPERATOR, signedAt: "" }),
    /empty signedAt/,
  );
});

test("rollback evidence: derives from the W10C production-eligibility machinery (the eligible decision's rollback ref)", () => {
  const ledger = createStandardReleaseEligibilityLedger();
  const rollback = deriveReleaseRollbackEvidence(ledger, RELEASE_ELIGIBILITY_SUBJECT);
  assert.equal(rollback.subjectRef, RELEASE_ELIGIBILITY_SUBJECT);
  assert.equal(rollback.rollbackEvidenceRef, RELEASE_ROLLBACK_EVIDENCE_REF);
  assert.equal(rollback.decidedAt, RELEASE_ELIGIBILITY_DECIDED_AT);
  assert.equal(rollback.simulated, true);
  // the derivation is the ledger's own latest eligible decision, verbatim
  const decision = ledger.latestDecisionFor(RELEASE_ELIGIBILITY_SUBJECT);
  assert.ok(decision);
  assert.equal(rollback.eligibilityRecordId, decision.id);
  assert.equal(decision.eligible, true);
  assert.equal(decision.rollbackEvidenceRef, rollback.rollbackEvidenceRef);
  // the backing check accepts the fresh derivation
  assert.ok(assertRollbackEvidenceBacked(rollback, ledger) === undefined);
  // refusals: an unknown subject carries no decision — an unbacked release
  assert.throws(
    () => deriveReleaseRollbackEvidence(ledger, "never-decided-lane"),
    (error: unknown) =>
      error instanceof ReleaseDeclarationInvalidError &&
      error.code === RELEASE_DECLARATION_INVALID_CODE &&
      /no production-eligibility decision/.test(error.message),
  );
  assert.throws(() => deriveReleaseRollbackEvidence(ledger, ""), /empty subjectRef/);
  // a reversed (not-eligible) latest decision never releases
  const evidence = createRollbackEvidenceRegistry([RELEASE_ROLLBACK_EVIDENCE_REF, "content-store://you-lab/gate/rollback/second-lane"]);
  const reversedLedger = createProductionEligibilityLedger(evidence, [
    { subjectRef: "reversed-lane", eligible: true, rollbackEvidenceRef: RELEASE_ROLLBACK_EVIDENCE_REF, decidedAt: "2026-10-15T10:00:00Z" },
  ]);
  reversedLedger.decide({
    subjectRef: "reversed-lane",
    eligible: false,
    rollbackEvidenceRef: "content-store://you-lab/gate/rollback/second-lane",
    decidedAt: "2026-10-15T10:30:00Z",
    reversalOf: reversedLedger.latestDecisionFor("reversed-lane")!.id,
  });
  assert.throws(
    () => deriveReleaseRollbackEvidence(reversedLedger, "reversed-lane"),
    /is NOT eligible.*never releases/,
  );
  // a stale rollback ref (an older decision's) fails the backing re-check
  const staleLedger = createProductionEligibilityLedger(evidence, [
    { subjectRef: "stale-lane", eligible: true, rollbackEvidenceRef: RELEASE_ROLLBACK_EVIDENCE_REF, decidedAt: "2026-10-15T10:00:00Z" },
    { subjectRef: "stale-lane", eligible: true, rollbackEvidenceRef: "content-store://you-lab/gate/rollback/second-lane", decidedAt: "2026-10-15T10:30:00Z" },
  ]);
  const staleRef = deriveReleaseRollbackEvidence(staleLedger, "stale-lane");
  const olderDecision = staleLedger.decisions.find(
    (record) => record.subjectRef === "stale-lane" && record.decidedAt === "2026-10-15T10:00:00Z",
  );
  assert.ok(olderDecision);
  assert.throws(
    () =>
      assertRollbackEvidenceBacked(
        { ...staleRef, eligibilityRecordId: olderDecision.id, rollbackEvidenceRef: olderDecision.rollbackEvidenceRef },
        staleLedger,
      ),
    /diverges from the ledger's latest eligible decision/,
  );
});

test("release declaration: appended once per signoff through the registry (the single-release clause)", () => {
  const signoff = recordOperatorSignoff(STANDARD_CHECKLIST, STANDARD_JOURNEYS, {
    signedBy: GOLDEN_GATE_OPERATOR,
    bundle: STANDARD_BUNDLE,
  });
  const ledger = createStandardReleaseEligibilityLedger();
  const rollback = deriveReleaseRollbackEvidence(ledger, RELEASE_ELIGIBILITY_SUBJECT);
  const registry = createReleaseDeclarationRegistry();
  const declaration = registry.declare({ signoff, bundle: STANDARD_BUNDLE, rollbackEvidence: rollback, ledger });
  assert.match(declaration.id, /^you_release_[0-9a-f]{16}$/);
  assert.equal(declaration.signoffRef, signoff.id);
  assert.equal(declaration.evidenceBundleRef, STANDARD_BUNDLE.id);
  assert.equal(declaration.rollbackEvidenceRef, RELEASE_ROLLBACK_EVIDENCE_REF);
  assert.equal(declaration.declaredAt, RELEASE_DECLARED_AT);
  assert.equal(declaration.simulated, true);
  assert.equal(registry.size(), 1);
  assert.equal(registry.bySignoff(signoff.id)?.id, declaration.id);
  assert.equal(registry.byId(declaration.id)?.id, declaration.id);
  // ONE release declaration per signoff — the second append is a typed refusal
  assert.throws(
    () => registry.declare({ signoff, bundle: STANDARD_BUNDLE, rollbackEvidence: rollback, ledger }),
    (error: unknown) =>
      error instanceof ReleaseDeclarationInvalidError &&
      error.code === RELEASE_DECLARATION_INVALID_CODE &&
      /one release declaration per signoff/.test(error.message),
  );
  assert.equal(registry.size(), 1, "the refused append left the registry untouched");
  // a DIFFERENT signoff may declare (a new signoff is a new release thread)
  const secondSignoff = recordOperatorSignoff(STANDARD_CHECKLIST, STANDARD_JOURNEYS, {
    signedBy: "you-lab-gate-operator-beta",
    bundle: STANDARD_BUNDLE,
  });
  const second = registry.declare({ signoff: secondSignoff, bundle: STANDARD_BUNDLE, rollbackEvidence: rollback, ledger });
  assert.equal(registry.size(), 2);
  assert.notEqual(second.id, declaration.id);
  // the declaration record is immutable (frozen at construction)
  assert.throws(
    () => {
      (declaration as { declaredAt?: string }).declaredAt = "2020-01-01T00:00:00Z";
    },
    TypeError,
  );
});

test("release declaration: refusal paths — tampered bundles, malformed signoffs and unbacked rollback evidence", () => {
  const signoff = recordOperatorSignoff(STANDARD_CHECKLIST, STANDARD_JOURNEYS, {
    signedBy: GOLDEN_GATE_OPERATOR,
    bundle: STANDARD_BUNDLE,
  });
  const ledger = createStandardReleaseEligibilityLedger();
  const rollback = deriveReleaseRollbackEvidence(ledger, RELEASE_ELIGIBILITY_SUBJECT);
  const registry = createReleaseDeclarationRegistry();
  // a tampered bundle under the same id fails its content address — never declared
  const tamperedBundle: NeutralEvidenceBundle = {
    ...STANDARD_BUNDLE,
    journeyRecords: Object.freeze([
      { ...STANDARD_BUNDLE.journeyRecords[0]!, durationMs: STANDARD_BUNDLE.journeyRecords[0]!.durationMs + 1 },
      ...STANDARD_BUNDLE.journeyRecords.slice(1),
    ]),
  };
  assert.throws(
    () => registry.declare({ signoff, bundle: tamperedBundle, rollbackEvidence: rollback, ledger }),
    /fails its content address/,
  );
  // a malformed signoff is never referenced
  const anonSignoff: NeutralOperatorSignoffRecord = { ...signoff, signedBy: "" };
  assert.throws(
    () => registry.declare({ signoff: anonSignoff, bundle: STANDARD_BUNDLE, rollbackEvidence: rollback }),
    /signoff's identity fields are empty/,
  );
  const unlabelledSignoff: NeutralOperatorSignoffRecord = { ...signoff, simulated: false };
  assert.throws(
    () => registry.declare({ signoff: unlabelledSignoff, bundle: STANDARD_BUNDLE, rollbackEvidence: rollback }),
    /signoff must carry simulated: true/,
  );
  // unbacked / malformed rollback evidence is refused
  assert.throws(
    () => registry.declare({ signoff, bundle: STANDARD_BUNDLE, rollbackEvidence: { ...rollback, rollbackEvidenceRef: "" } }),
    /rollback evidence's fields are empty/,
  );
  assert.throws(
    () => registry.declare({ signoff, bundle: STANDARD_BUNDLE, rollbackEvidence: { ...rollback, simulated: false } }),
    /rollback evidence must carry simulated: true/,
  );
  // a rollback ref that no longer matches the ledger's latest eligible decision is refused
  assert.throws(
    () =>
      registry.declare({
        signoff,
        bundle: STANDARD_BUNDLE,
        rollbackEvidence: { ...rollback, eligibilityRecordId: "you_eligibility_fabricated0000" },
        ledger,
      }),
    /diverges from the ledger's latest eligible decision/,
  );
  assert.throws(
    () => registry.declare({ signoff, bundle: STANDARD_BUNDLE, rollbackEvidence: rollback, declaredAt: "" }),
    /empty declaredAt/,
  );
  assert.equal(registry.size(), 0, "every refused append left the registry empty");
});

test("golden gate run: the deterministic full-gate scenario — all 20 green, signoff, declaration (pinned ids, byte-identical replay)", () => {
  const run = runGoldenGateRun();
  assert.equal(run.runVersion, GOLDEN_GATE_RUN_VERSION);
  assert.equal(run.simulated, true);
  // stage 1: the evidence journey set (golden + injection-recovery)
  assert.equal(run.journeys.length, 24);
  // stage 2: the content-addressed bundle (pinned golden id)
  assert.equal(run.bundle.id, GOLDEN_GATE_BUNDLE_ID);
  assert.equal(run.bundle.journeyRecords.length, 24);
  assert.equal(run.declaration.evidenceBundleRef, run.bundle.id);
  // stage 3: the 20-point checklist, all green (pinned golden id)
  assert.equal(run.checklist.id, GOLDEN_GATE_CHECKLIST_ID);
  assert.equal(run.checklist.points.filter((point) => point.passed).length, 20);
  // stage 4: the operator signoff over the complete passing checklist (pinned golden id)
  assert.equal(run.signoff.id, GOLDEN_GATE_SIGNOFF_ID);
  assert.equal(run.signoff.checklistRef, run.checklist.id);
  assert.equal(run.signoff.signedBy, GOLDEN_GATE_OPERATOR);
  // stage 5: the release declaration with the W10C-derived rollback evidence (pinned golden id)
  assert.equal(run.declaration.id, GOLDEN_GATE_DECLARATION_ID);
  assert.equal(run.declaration.signoffRef, run.signoff.id);
  assert.equal(run.rollbackEvidence.rollbackEvidenceRef, RELEASE_ROLLBACK_EVIDENCE_REF);
  assert.equal(run.declaration.rollbackEvidenceRef, run.rollbackEvidence.rollbackEvidenceRef);
  // the rollback derivation is the W10C ledger's own eligible decision
  const standardLedger = createStandardReleaseEligibilityLedger();
  assert.ok(assertRollbackEvidenceBacked(run.rollbackEvidence, standardLedger) === undefined);
  // byte-identical replay from the W11C fixture seeds
  const replay = runGoldenGateRun();
  assert.equal(canonicalJson(replay), canonicalJson(run), "the golden gate run replays byte-identically");
  assert.deepEqual(replay, run);
  // honest notes: simulated fixtures, never a real deployment claim
  assert.ok(run.notes.some((note) => note.includes("never a claim about a real product deployment")));
  assert.ok(run.notes.some((note) => note.includes("content-addressed")));
});

test("golden gate run: the full chain re-verifies through the public law checks (fail-closed from the outside)", () => {
  const run = runGoldenGateRun();
  // the checklist IS the derivation over the run's own journey set
  assert.ok(
    deriveLaunchGateChecklist(run.journeys, { bundle: run.bundle }).id === run.checklist.id,
  );
  // the declaration resolves back through the registry wiring
  const registry = createReleaseDeclarationRegistry();
  const redeclared = registry.declare({
    signoff: run.signoff,
    bundle: run.bundle,
    rollbackEvidence: run.rollbackEvidence,
    ledger: createStandardReleaseEligibilityLedger(),
  });
  assert.equal(redeclared.id, run.declaration.id, "a fresh registry re-declares the identical record (determinism)");
  assert.equal(registry.bySignoff(run.signoff.id)?.id, run.declaration.id);
});
