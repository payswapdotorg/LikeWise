// Production eligibility ledger tests (W10C) — coverage: the PRODUCTION
// ELIGIBILITY LAW — eligibility requires rollback evidence (fail-closed
// refusal paths: empty evidence, unresolvable evidence, empty subject,
// empty decidedAt), decisions are immutable (a record never mutates in
// place — the deep-frozen record law), reversals append NEW records that
// cite the reversed record (subject identity law), the latest decision
// wins by append order, and record ids derive deterministically.
import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_ELIGIBILITY_INVALID_CODE,
  ProductionEligibilityInvalidError,
  assertRecordIntact,
  createProductionEligibilityLedger,
  createRollbackEvidenceRegistry,
  eligibilityLedgerVersion,
  eligibilityRecordId,
  type EligibilityDecisionInput,
} from "./eligibilityLedger.js";

const EVIDENCE_REFS = [
  "content-store://you-lab/ecosystem/rollback/model-viewer-ar-lane",
  "content-store://you-lab/ecosystem/rollback/babylonjs-game-export-lane",
];
const EVIDENCE = createRollbackEvidenceRegistry(EVIDENCE_REFS);
const DECIDED_AT = "2026-10-14T12:00:00Z";

function ledgerFixture(seedDecisions: readonly EligibilityDecisionInput[] = []) {
  return createProductionEligibilityLedger(EVIDENCE, seedDecisions);
}

test("eligibility ledger: an eligible decision requires resolvable rollback evidence (the law)", () => {
  const ledger = ledgerFixture([
    {
      subjectRef: "model-viewer",
      eligible: true,
      rollbackEvidenceRef: EVIDENCE_REFS[0]!,
      decidedAt: DECIDED_AT,
    },
  ]);
  assert.equal(ledger.size(), 1);
  const latest = ledger.latestDecisionFor("model-viewer");
  assert.ok(latest);
  assert.equal(latest.eligible, true);
  assert.equal(latest.rollbackEvidenceRef, EVIDENCE_REFS[0]!);
  assert.equal(latest.reversalOf, null);
  assert.equal(latest.simulated, true, "truth law: fixture decisions stay simulated");
  assert.equal(latest.id, eligibilityRecordId("model-viewer", DECIDED_AT, 1));
  assert.match(latest.id, /^you_eligibility_[0-9a-f]{16}$/);
});

test("eligibility ledger: refusal paths — empty/unresolvable evidence and malformed decisions", () => {
  assert.throws(
    () => ledgerFixture([{ subjectRef: "model-viewer", eligible: true, rollbackEvidenceRef: "", decidedAt: DECIDED_AT }]),
    (error: unknown) => error instanceof ProductionEligibilityInvalidError &&
      error.code === PRODUCTION_ELIGIBILITY_INVALID_CODE &&
      /empty rollbackEvidenceRef.*PRODUCTION ELIGIBILITY LAW requires rollback evidence/.test(error.message),
  );
  assert.throws(
    () => ledgerFixture([{ subjectRef: "model-viewer", eligible: true, rollbackEvidenceRef: "content-store://not-in-registry", decidedAt: DECIDED_AT }]),
    /does not resolve in the evidence registry/,
  );
  assert.throws(
    () => ledgerFixture([{ subjectRef: "", eligible: true, rollbackEvidenceRef: EVIDENCE_REFS[0]!, decidedAt: DECIDED_AT }]),
    /empty subjectRef/,
  );
  assert.throws(
    () => ledgerFixture([{ subjectRef: "model-viewer", eligible: true, rollbackEvidenceRef: EVIDENCE_REFS[0]!, decidedAt: "" }]),
    /empty decidedAt/,
  );
  // a REVERSAL record also requires rollback evidence (the law covers every decision)
  const ledger = ledgerFixture([{ subjectRef: "model-viewer", eligible: true, rollbackEvidenceRef: EVIDENCE_REFS[0]!, decidedAt: DECIDED_AT }]);
  assert.throws(
    () => ledger.decide({ subjectRef: "model-viewer", eligible: false, rollbackEvidenceRef: "", decidedAt: DECIDED_AT }),
    /empty rollbackEvidenceRef/,
  );
});

test("eligibility ledger: a reversal is a NEW record that cites the reversed record (never a mutation)", () => {
  const ledger = ledgerFixture([
    { subjectRef: "model-viewer", eligible: true, rollbackEvidenceRef: EVIDENCE_REFS[0]!, decidedAt: DECIDED_AT },
  ]);
  const original = ledger.latestDecisionFor("model-viewer")!;
  const reversal = ledger.decide({
    subjectRef: "model-viewer",
    eligible: false,
    rollbackEvidenceRef: EVIDENCE_REFS[1]!,
    decidedAt: DECIDED_AT,
    reversalOf: original.id,
  });
  assert.equal(ledger.size(), 2);
  assert.notEqual(reversal.id, original.id);
  assert.equal(reversal.reversalOf, original.id);
  assert.equal(reversal.eligible, false);
  // the ORIGINAL record is intact (immutability law — append-only ledger)
  assert.deepEqual(ledger.byId(original.id), original);
  assert.equal(original.eligible, true);
  // the latest decision is the reversal
  assert.equal(ledger.latestDecisionFor("model-viewer")?.id, reversal.id);
  // reversing the reversal appends a THIRD record
  const rereversal = ledger.decide({
    subjectRef: "model-viewer",
    eligible: true,
    rollbackEvidenceRef: EVIDENCE_REFS[0]!,
    decidedAt: DECIDED_AT,
    reversalOf: reversal.id,
  });
  assert.equal(ledger.size(), 3);
  assert.equal(ledger.latestDecisionFor("model-viewer")?.id, rereversal.id);
  assert.deepEqual(ledger.decisions.map((record) => record.eligible), [true, false, true]);
});

test("eligibility ledger: reversal refusal paths (unknown record, subject mismatch)", () => {
  const ledger = ledgerFixture([
    { subjectRef: "model-viewer", eligible: true, rollbackEvidenceRef: EVIDENCE_REFS[0]!, decidedAt: DECIDED_AT },
  ]);
  assert.throws(
    () => ledger.decide({
      subjectRef: "model-viewer",
      eligible: false,
      rollbackEvidenceRef: EVIDENCE_REFS[0]!,
      decidedAt: DECIDED_AT,
      reversalOf: "you_eligibility_0000000000000000",
    }),
    /which is not in the ledger/,
  );
  assert.throws(
    () => ledger.decide({
      subjectRef: "babylonjs",
      eligible: false,
      rollbackEvidenceRef: EVIDENCE_REFS[0]!,
      decidedAt: DECIDED_AT,
      reversalOf: ledger.latestDecisionFor("model-viewer")!.id,
    }),
    /subject identity law/,
  );
});

test("eligibility ledger: records are immutable — a mutated copy is refused by the integrity check", () => {
  const ledger = ledgerFixture([
    { subjectRef: "model-viewer", eligible: true, rollbackEvidenceRef: EVIDENCE_REFS[0]!, decidedAt: DECIDED_AT },
  ]);
  const record = ledger.latestDecisionFor("model-viewer")!;
  assertRecordIntact(ledger, record);
  // the frozen record refuses in-place mutation
  assert.throws(() => {
    (record as { eligible: boolean }).eligible = false;
  }, /Cannot assign to read only property|not extensible|read only/i);
  // a fabricated record (not in the ledger) is refused
  assert.throws(
    () => assertRecordIntact(ledger, { ...record, id: "you_eligibility_ffffffffffffffff" }),
    /is not in the ledger/,
  );
  // a diverging copy of a real record is refused (immutability law)
  assert.throws(
    () => assertRecordIntact(ledger, { ...record, eligible: false }),
    /diverges from the ledger's stored copy/,
  );
});

test("eligibility ledger: the evidence registry deduplicates and sorts deterministically", () => {
  const registry = createRollbackEvidenceRegistry(["b-ref", "a-ref", "b-ref"]);
  assert.deepEqual(registry.refs, ["a-ref", "b-ref"]);
  assert.equal(registry.has("a-ref"), true);
  assert.equal(registry.has("z-ref"), false);
});

test("eligibility ledger: ids derive deterministically from (subject, decidedAt, sequence)", () => {
  assert.equal(
    eligibilityRecordId("model-viewer", DECIDED_AT, 1),
    eligibilityRecordId("model-viewer", DECIDED_AT, 1),
  );
  assert.notEqual(
    eligibilityRecordId("model-viewer", DECIDED_AT, 1),
    eligibilityRecordId("model-viewer", DECIDED_AT, 2),
  );
  assert.match(eligibilityLedgerVersion(), /you-lab-eligibility-ledger\/1/);
});

test("eligibility ledger: an empty ledger reports no latest decision", () => {
  const ledger = ledgerFixture();
  assert.equal(ledger.size(), 0);
  assert.equal(ledger.latestDecisionFor("model-viewer"), null);
  assert.equal(ledger.byId("you_eligibility_0000000000000000"), null);
});
