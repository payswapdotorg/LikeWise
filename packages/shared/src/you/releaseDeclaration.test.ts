import assert from "node:assert/strict";
import test from "node:test";
import type { E2eJourneyRecord, LaunchGateChecklistRecord } from "./contract.js";
import { LAUNCH_GATE_CHECKLIST_LENGTH, constructLaunchGateChecklistRecord } from "./launchGate.js";
import { constructOperatorSignoffRecord } from "./operatorSignoff.js";
import { constructReleaseDeclarationRecord, validateReleaseDeclarationInput } from "./releaseDeclaration.js";

function goldenJourney(index: number): E2eJourneyRecord {
  return {
    id: `you_journey_golden-${String(index + 1).padStart(2, "0")}_0000000000000001`,
    journeyId: `golden-${String(index + 1).padStart(2, "0")}`,
    stepsCompleted: 20,
    failedStep: null,
    durationMs: 120 + index,
    simulated: true,
  };
}

function passingChain(): { readonly checklist: LaunchGateChecklistRecord; readonly signoff: ReturnType<typeof constructOperatorSignoffRecord> } {
  const checklistConstructed = constructLaunchGateChecklistRecord(
    { id: "you_launch-gate_0000000000000001", checkedAt: "2026-01-01T00:00:01.000Z" },
    { journeys: Array.from({ length: LAUNCH_GATE_CHECKLIST_LENGTH }, (_, index) => goldenJourney(index)) },
  );
  if (!checklistConstructed.ok) {
    throw new Error(`fixture checklist construction failed: ${checklistConstructed.refusal.reason}`);
  }
  const signoffConstructed = constructOperatorSignoffRecord(
    {
      id: "you_operator-signoff_000000000001",
      checklistRef: checklistConstructed.record.id,
      signedBy: "you_user_0000000000000001",
      signedAt: "2026-01-01T00:00:02.000Z",
    },
    checklistConstructed.record,
  );
  if (!signoffConstructed.ok) {
    throw new Error(`fixture signoff construction failed: ${signoffConstructed.refusal.reason}`);
  }
  return { checklist: checklistConstructed.record, signoff: signoffConstructed };
}

test("the declaration constructs with the evidence bundle AND rollback evidence (immutable, frozen, simulated)", () => {
  const { checklist, signoff } = passingChain();
  if (!signoff.ok) {
    throw new Error("fixture signoff failed");
  }
  const constructed = constructReleaseDeclarationRecord(
    {
      id: "you_release-declaration_0000001",
      signoffRef: signoff.record.id,
      evidenceBundleRef: "you_evidence-bundle_w12a-fixture01",
      rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01",
      declaredAt: "2026-01-01T00:00:03.000Z",
    },
    signoff.record,
    checklist,
  );
  assert.ok(constructed.ok);
  if (constructed.ok) {
    assert.equal(constructed.record.signoffRef, signoff.record.id);
    assert.equal(constructed.record.evidenceBundleRef, "you_evidence-bundle_w12a-fixture01");
    assert.equal(constructed.record.rollbackEvidenceRef, "you_rollback-evidence_w12a-fixture01");
    assert.equal(constructed.record.declaredAt, "2026-01-01T00:00:03.000Z");
    assert.equal(constructed.record.simulated, true);
    assert.ok(Object.isFrozen(constructed.record));
  }
});

test("THE RELEASE DECLARATION LAW (construct teeth): a declaration without rollback evidence is refused (never recorded)", () => {
  const { checklist, signoff } = passingChain();
  if (!signoff.ok) {
    throw new Error("fixture signoff failed");
  }
  const refused = constructReleaseDeclarationRecord(
    {
      id: "you_release-declaration_0000002",
      signoffRef: signoff.record.id,
      evidenceBundleRef: "you_evidence-bundle_w12a-fixture01",
      rollbackEvidenceRef: "",
      declaredAt: "2026-01-01T00:00:03.000Z",
    },
    signoff.record,
    checklist,
  );
  assert.ok(!refused.ok);
  if (!refused.ok) {
    assert.equal(refused.refusal.reason, "rollback-evidence-ref-empty");
  }
});

test("THE RELEASE DECLARATION LAW (construct teeth): a declaration without its evidence bundle is refused", () => {
  const { checklist, signoff } = passingChain();
  if (!signoff.ok) {
    throw new Error("fixture signoff failed");
  }
  const refused = constructReleaseDeclarationRecord(
    {
      id: "you_release-declaration_0000003",
      signoffRef: signoff.record.id,
      evidenceBundleRef: "",
      rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01",
      declaredAt: "2026-01-01T00:00:03.000Z",
    },
    signoff.record,
    checklist,
  );
  assert.ok(!refused.ok);
  if (!refused.ok) {
    assert.equal(refused.refusal.reason, "evidence-bundle-ref-empty");
  }
});

test("THE RELEASE DECLARATION LAW (chain teeth): no signoff, mismatched refs, broken chains — all refused", () => {
  const { checklist, signoff } = passingChain();
  if (!signoff.ok) {
    throw new Error("fixture signoff failed");
  }
  // No signoff at all.
  const withoutSignoff = constructReleaseDeclarationRecord(
    {
      id: "x",
      signoffRef: signoff.record.id,
      evidenceBundleRef: "you_evidence-bundle_w12a-fixture01",
      rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01",
      declaredAt: "2026-01-01T00:00:03.000Z",
    },
    null,
    checklist,
  );
  assert.ok(!withoutSignoff.ok);
  if (!withoutSignoff.ok) {
    assert.equal(withoutSignoff.refusal.reason, "declaration-without-signoff");
  }
  // The referenced signoff is not the one supplied.
  const mismatchedSignoff = constructReleaseDeclarationRecord(
    {
      id: "x",
      signoffRef: "you_operator-signoff_someothersignof",
      evidenceBundleRef: "you_evidence-bundle_w12a-fixture01",
      rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01",
      declaredAt: "2026-01-01T00:00:03.000Z",
    },
    signoff.record,
    checklist,
  );
  assert.ok(!mismatchedSignoff.ok);
  if (!mismatchedSignoff.ok) {
    assert.equal(mismatchedSignoff.refusal.reason, "signoff-ref-mismatch");
  }
  // The signoff's checklist is missing (chain verification impossible).
  const withoutChecklist = constructReleaseDeclarationRecord(
    {
      id: "x",
      signoffRef: signoff.record.id,
      evidenceBundleRef: "you_evidence-bundle_w12a-fixture01",
      rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01",
      declaredAt: "2026-01-01T00:00:03.000Z",
    },
    signoff.record,
    null,
  );
  assert.ok(!withoutChecklist.ok);
  if (!withoutChecklist.ok) {
    assert.equal(withoutChecklist.refusal.reason, "signoff-without-checklist");
  }
  // The supplied checklist is not the one the signoff signed.
  const otherChecklist = constructLaunchGateChecklistRecord(
    { id: "you_launch-gate_0000000000000009", checkedAt: "2026-01-01T00:00:09.000Z" },
    { journeys: Array.from({ length: LAUNCH_GATE_CHECKLIST_LENGTH }, (_, index) => goldenJourney(index)) },
  );
  if (!otherChecklist.ok) {
    throw new Error("fixture other checklist failed");
  }
  const mismatchedChecklist = constructReleaseDeclarationRecord(
    {
      id: "x",
      signoffRef: signoff.record.id,
      evidenceBundleRef: "you_evidence-bundle_w12a-fixture01",
      rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01",
      declaredAt: "2026-01-01T00:00:03.000Z",
    },
    signoff.record,
    otherChecklist.record,
  );
  assert.ok(!mismatchedChecklist.ok);
  if (!mismatchedChecklist.ok) {
    assert.equal(mismatchedChecklist.refusal.reason, "checklist-ref-mismatch");
  }
});

test("THE RELEASE DECLARATION LAW (chain teeth): a declaration over a non-passing gate is refused", () => {
  const { signoff } = passingChain();
  if (!signoff.ok) {
    throw new Error("fixture signoff failed");
  }
  // Hand-forge a complete-but-failing checklist carrying the signoff's checklistRef.
  const failing = constructLaunchGateChecklistRecord(
    { id: signoff.record.checklistRef, checkedAt: "2026-01-01T00:00:01.000Z" },
    {
      journeys: Array.from({ length: LAUNCH_GATE_CHECKLIST_LENGTH }, (_, index) =>
        index === LAUNCH_GATE_CHECKLIST_LENGTH - 1 ? null : goldenJourney(index),
      ),
    },
  );
  if (!failing.ok) {
    throw new Error("fixture failing checklist failed");
  }
  const refused = constructReleaseDeclarationRecord(
    {
      id: "x",
      signoffRef: signoff.record.id,
      evidenceBundleRef: "you_evidence-bundle_w12a-fixture01",
      rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01",
      declaredAt: "2026-01-01T00:00:03.000Z",
    },
    signoff.record,
    failing.record,
  );
  assert.ok(!refused.ok);
  if (!refused.ok) {
    assert.equal(refused.refusal.reason, "checklist-not-passing");
  }
});

test("declaration intake refusals: typed, never silent", () => {
  for (const [input, reason] of [
    [{ evidenceBundleRef: "", rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01" }, "evidence-bundle-ref-empty"],
    [{ evidenceBundleRef: "you_evidence-bundle_w12a-fixture01", rollbackEvidenceRef: "" }, "rollback-evidence-ref-empty"],
    [{ evidenceBundleRef: "  ", rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01" }, "evidence-bundle-ref-empty"],
  ] as const) {
    const refusal = validateReleaseDeclarationInput(input);
    assert.ok(refusal !== null, reason);
    assert.equal(refusal?.reason, reason, reason);
  }
  const { checklist, signoff } = passingChain();
  if (!signoff.ok) {
    throw new Error("fixture signoff failed");
  }
  const noTimestamp = constructReleaseDeclarationRecord(
    {
      id: "x",
      signoffRef: signoff.record.id,
      evidenceBundleRef: "you_evidence-bundle_w12a-fixture01",
      rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01",
      declaredAt: "",
    },
    signoff.record,
    checklist,
  );
  assert.ok(!noTimestamp.ok);
  if (!noTimestamp.ok) {
    assert.equal(noTimestamp.refusal.reason, "declared-at-missing");
  }
});
