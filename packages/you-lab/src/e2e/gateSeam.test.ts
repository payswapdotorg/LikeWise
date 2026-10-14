// Contract seam v12 tests (W12C) — coverage: the launch-gate shapes
// construct VALID frozen v12 shapes through the single seam module
// (LaunchGateChecklistRecord / OperatorSignoffRecord /
// ReleaseDeclarationRecord), mapping 1:1 field-for-field from the
// neutral gate-evidence outputs, and the LAUNCH GATE / OPERATOR SIGNOFF
// / RELEASE DECLARATION laws are enforced fail-closed at the frozen
// boundary (wrong-size or reordered tables, bare-assertion points,
// cited-but-failed points, empty refs and unlabelled records are all
// typed rejections). Also: the full golden gate run maps
// deterministically through the seam, and its bundle records are
// frozen-valid v11 E2eJourneyRecords.
import assert from "node:assert/strict";
import test from "node:test";
import {
  toFrozenE2eJourneyRecord,
  toFrozenLaunchGateChecklistPoint,
  toFrozenLaunchGateChecklistRecord,
  toFrozenOperatorSignoffRecord,
  toFrozenReleaseDeclarationRecord,
} from "../contractSeam.js";
import type { NeutralLaunchGateChecklistRecord } from "./gateChecklist.js";
import { deriveLaunchGateChecklist, type NeutralLaunchGateChecklistPoint } from "./gateChecklist.js";
import { runTerminalJourneys } from "./failureInjection.js";
import { runGoldenGateRun } from "./releaseGate.js";

const RUN = runGoldenGateRun();

function terminalChecklist(): NeutralLaunchGateChecklistRecord {
  // a derivation including failed points (from the real terminal fixture) —
  // used to exercise the point-level law checks on non-passing points
  const [terminalEvidence] = runTerminalJourneys();
  if (!terminalEvidence) throw new Error("terminal fixture missing");
  return deriveLaunchGateChecklist([terminalEvidence], { checkedAt: "2026-10-15T13:30:00Z" });
}

test("contract seam v12: toFrozenLaunchGateChecklistRecord maps the golden gate checklist 1:1", () => {
  const frozen = toFrozenLaunchGateChecklistRecord(RUN.checklist);
  assert.equal(frozen.id, RUN.checklist.id);
  assert.equal(frozen.checkedAt, RUN.checklist.checkedAt);
  assert.equal(frozen.simulated, true, "truth law: the derived checklist stays labelled at the frozen boundary");
  assert.equal(frozen.points.length, 20);
  frozen.points.forEach((point, i) => {
    const neutral = RUN.checklist.points[i]!;
    assert.equal(point.point, neutral.point);
    assert.equal(point.description, neutral.description);
    assert.equal(point.journeyEvidenceRef, neutral.journeyEvidenceRef);
    assert.equal(point.passed, neutral.passed);
  });
  // a red checklist maps too — the failed points carry null evidence refs
  const terminal = terminalChecklist();
  const frozenTerminal = toFrozenLaunchGateChecklistRecord(terminal);
  assert.equal(frozenTerminal.points.filter((point) => point.passed).length, 5);
  assert.equal(frozenTerminal.points[5]!.passed, false);
  assert.equal(frozenTerminal.points[5]!.journeyEvidenceRef, null);
});

test("contract seam v12: toFrozenLaunchGateChecklistRecord enforces the LAUNCH GATE LAW fail-closed", () => {
  const checklist = RUN.checklist;
  assert.throws(() => toFrozenLaunchGateChecklistRecord({ ...checklist, id: "" }), /empty id/);
  assert.throws(() => toFrozenLaunchGateChecklistRecord({ ...checklist, checkedAt: "" }), /empty checkedAt/);
  // the gate is the 20-point table — a 19-point table is not the launch gate
  assert.throws(
    () => toFrozenLaunchGateChecklistRecord({ ...checklist, points: checklist.points.slice(0, 19) }),
    /the launch gate is the 20-point checklist \(got 19\)/,
  );
  // a reordered table is not the launch gate
  assert.throws(
    () => toFrozenLaunchGateChecklistRecord({ ...checklist, points: [...checklist.points.slice(1), checklist.points[0]!] }),
    /point at position 1 carries number 2 \(the authored table order\)/,
  );
  // a bare assertion (a passed point with no evidence) is never mapped
  const bare: NeutralLaunchGateChecklistRecord = {
    ...checklist,
    points: [
      ...checklist.points.slice(0, 6),
      { ...checklist.points[6]!, journeyEvidenceRef: null },
      ...checklist.points.slice(7),
    ],
  };
  assert.throws(() => toFrozenLaunchGateChecklistRecord(bare), /point 7 passes with no journey evidence — never a bare assertion/);
  // an unlabelled checklist is a truth-law fabrication at this seam
  assert.throws(
    () => toFrozenLaunchGateChecklistRecord({ ...checklist, simulated: false }),
    /simulated must be true at this seam/,
  );
});

test("contract seam v12: toFrozenLaunchGateChecklistPoint enforces the point law (pass iff evidence)", () => {
  const passing: NeutralLaunchGateChecklistPoint = RUN.checklist.points[0]!;
  const frozen = toFrozenLaunchGateChecklistPoint(passing);
  assert.deepEqual(frozen, { point: 1, description: passing.description, journeyEvidenceRef: passing.journeyEvidenceRef, passed: true });
  // the failed-point shape (null ref, passed false) maps 1:1
  const failed: NeutralLaunchGateChecklistPoint = { point: 20, description: "d", journeyEvidenceRef: null, passed: false };
  assert.equal(toFrozenLaunchGateChecklistPoint(failed).passed, false);
  // refusals: out-of-table numbers, empty descriptions, bare assertions, cited failures, empty refs
  assert.throws(() => toFrozenLaunchGateChecklistPoint({ ...passing, point: 0 }), /outside the 20-point launch-gate table/);
  assert.throws(() => toFrozenLaunchGateChecklistPoint({ ...passing, point: 21 }), /outside the 20-point launch-gate table/);
  assert.throws(() => toFrozenLaunchGateChecklistPoint({ ...passing, point: 1.5 }), /outside the 20-point launch-gate table/);
  assert.throws(() => toFrozenLaunchGateChecklistPoint({ ...passing, description: "" }), /empty description/);
  assert.throws(
    () => toFrozenLaunchGateChecklistPoint({ ...failed, passed: true }),
    /passes with no journey evidence — never a bare assertion/,
  );
  assert.throws(
    () => toFrozenLaunchGateChecklistPoint({ ...passing, passed: false }),
    /cites journey evidence but does not pass on it/,
  );
  assert.throws(
    () => toFrozenLaunchGateChecklistPoint({ ...passing, journeyEvidenceRef: "" }),
    /empty journeyEvidenceRef/,
  );
});

test("contract seam v12: toFrozenOperatorSignoffRecord maps the golden signoff 1:1 and enforces the field law", () => {
  const frozen = toFrozenOperatorSignoffRecord(RUN.signoff);
  assert.equal(frozen.id, RUN.signoff.id);
  assert.equal(frozen.checklistRef, RUN.signoff.checklistRef);
  assert.equal(frozen.signedBy, RUN.signoff.signedBy);
  assert.equal(frozen.signedAt, RUN.signoff.signedAt);
  assert.equal(frozen.simulated, true);
  assert.equal(frozen.checklistRef, RUN.checklist.id, "the signoff references the golden checklist");
  // the refusals
  assert.throws(() => toFrozenOperatorSignoffRecord({ ...RUN.signoff, id: "" }), /empty id/);
  assert.throws(() => toFrozenOperatorSignoffRecord({ ...RUN.signoff, checklistRef: "" }), /empty checklistRef/);
  assert.throws(() => toFrozenOperatorSignoffRecord({ ...RUN.signoff, signedBy: "" }), /empty signedBy/);
  assert.throws(() => toFrozenOperatorSignoffRecord({ ...RUN.signoff, signedAt: "" }), /empty signedAt/);
  assert.throws(
    () => toFrozenOperatorSignoffRecord({ ...RUN.signoff, simulated: false }),
    /simulated must be true at this seam/,
  );
});

test("contract seam v12: toFrozenReleaseDeclarationRecord maps the golden declaration 1:1 and requires bundle + rollback refs", () => {
  const frozen = toFrozenReleaseDeclarationRecord(RUN.declaration);
  assert.equal(frozen.id, RUN.declaration.id);
  assert.equal(frozen.signoffRef, RUN.declaration.signoffRef);
  assert.equal(frozen.evidenceBundleRef, RUN.declaration.evidenceBundleRef);
  assert.equal(frozen.rollbackEvidenceRef, RUN.declaration.rollbackEvidenceRef);
  assert.equal(frozen.declaredAt, RUN.declaration.declaredAt);
  assert.equal(frozen.simulated, true);
  assert.equal(frozen.evidenceBundleRef, RUN.bundle.id, "the declaration references the content-addressed bundle");
  // the RELEASE DECLARATION LAW's refusals — a missing bundle or rollback ref is never mapped
  assert.throws(() => toFrozenReleaseDeclarationRecord({ ...RUN.declaration, id: "" }), /empty id/);
  assert.throws(() => toFrozenReleaseDeclarationRecord({ ...RUN.declaration, signoffRef: "" }), /empty signoffRef/);
  assert.throws(
    () => toFrozenReleaseDeclarationRecord({ ...RUN.declaration, evidenceBundleRef: "" }),
    /empty evidenceBundleRef — the declaration carries the full evidence bundle/,
  );
  assert.throws(
    () => toFrozenReleaseDeclarationRecord({ ...RUN.declaration, rollbackEvidenceRef: "" }),
    /empty rollbackEvidenceRef — the declaration carries rollback evidence/,
  );
  assert.throws(() => toFrozenReleaseDeclarationRecord({ ...RUN.declaration, declaredAt: "" }), /empty declaredAt/);
  assert.throws(
    () => toFrozenReleaseDeclarationRecord({ ...RUN.declaration, simulated: false }),
    /simulated must be true at this seam/,
  );
});

test("contract seam v12: the full golden gate run maps deterministically through the seam", () => {
  const first = {
    checklist: toFrozenLaunchGateChecklistRecord(RUN.checklist),
    signoff: toFrozenOperatorSignoffRecord(RUN.signoff),
    declaration: toFrozenReleaseDeclarationRecord(RUN.declaration),
    bundleRecords: RUN.bundle.journeyRecords.map((record) => toFrozenE2eJourneyRecord(record)),
  };
  const replayRun = runGoldenGateRun();
  const second = {
    checklist: toFrozenLaunchGateChecklistRecord(replayRun.checklist),
    signoff: toFrozenOperatorSignoffRecord(replayRun.signoff),
    declaration: toFrozenReleaseDeclarationRecord(replayRun.declaration),
    bundleRecords: replayRun.bundle.journeyRecords.map((record) => toFrozenE2eJourneyRecord(record)),
  };
  assert.deepEqual(first, second, "the seam-mapped golden gate run is byte-identical on replay");
  // the bundle's 24 records are all frozen-valid v11 E2eJourneyRecords
  assert.equal(first.bundleRecords.length, 24);
  assert.equal(first.bundleRecords.filter((record) => record.failedStep === null).length, 4);
  assert.ok(first.bundleRecords.every((record) => record.simulated === true));
});
