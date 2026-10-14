// W12B logic tests — 确定性模拟控制器（node:test，无 DOM）。
//
// 覆盖：LAUNCH GATE LAW（逐点证据派生——无证据点绝不通过；golden 20/20 与
// partial 16/20 诚实落账；未注册 journey typed 拒绝）、OPERATOR SIGNOFF LAW
//（无 checklist / 未过门 / 重复签署 / 未知 operator 的 typed 拒绝；signoff 落账
// 的 signed-by / signed-at / checklistRef；事件账本）、RELEASE DECLARATION LAW
//（无 signoff / 空 bundle / 缺 rollback / 重复声明的 typed 拒绝；declaration
// 落账的 bundle + rollback 链接）、字节级确定性、load 前操作 fail closed。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedReleaseStudioController } from "./releaseSimulatedController.js";
import {
  ReleaseStudioError,
  releaseChecklistGatePasses,
} from "./releaseController.js";

async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<ReleaseStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof ReleaseStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected a typed ReleaseStudioError");
}

function driveGoldenScript(controller: ReturnType<
  typeof createSimulatedReleaseStudioController
>) {
  return controller.load({ workspaceKey: "you-w12b-test" });
}

test("load is idempotent and bootstraps the launch-gate registries into the snapshot", async () => {
  const controller = createSimulatedReleaseStudioController();
  const first = await driveGoldenScript(controller);
  assert.equal(first.studioId, "fx-release-studio-001");
  assert.equal(first.simulated, true);
  assert.equal(controller.backing, "fixture-simulated");
  assert.equal(first.journeys.length, 3);
  assert.equal(first.operators.length, 2);
  assert.equal(first.evidenceBundles.length, 3);
  assert.equal(first.rollbackEvidence.length, 2);
  assert.equal(first.checklists.length, 0);
  assert.equal(first.signoffs.length, 0);
  assert.equal(first.declarations.length, 0);
  // bootstrap 事件（solution-created）落账。
  assert.equal(first.events[0]?.type, "solution-created");

  // 幂等：再次 load 返回同一平面状态（不重建）。
  const second = await controller.load({ workspaceKey: "you-w12b-test" });
  assert.equal(second.checklists.length, 0);
  assert.equal(second.events.length, first.events.length);
});

test("LAUNCH GATE LAW: a point passes ONLY with journey evidence — never a bare assertion", async () => {
  const controller = createSimulatedReleaseStudioController();
  await driveGoldenScript(controller);

  // partial journey：16/20 诚实落账（无证据点 passed=false 且 ref null）。
  const partial = await controller.runLaunchGateCheck({
    journeyId: "journey-gate-partial",
  });
  assert.equal(partial.points.length, 20);
  assert.equal(partial.points.filter((p) => p.passed).length, 16);
  for (const point of partial.points) {
    // 法则核：passed 当且仅当 evidence ref 在场——bare assertion 永不落账。
    assert.equal(point.passed, point.journeyEvidenceRef !== null);
  }
  const point17 = partial.points[16]!;
  assert.equal(point17.journeyEvidenceRef, null);
  assert.equal(point17.passed, false);
  assert.equal(releaseChecklistGatePasses(partial), false);
  assert.equal(partial.simulated, true);
  // 点描述与点号一一对应（1..20）。
  assert.equal(partial.points[0]!.point, 1);
  assert.equal(partial.points[19]!.point, 20);
  assert.ok(partial.points[0]!.description.length > 0);

  // golden journey：20/20 全过 + 每点携带 evidence ref。
  const golden = await controller.runLaunchGateCheck({
    journeyId: "journey-gate-golden",
  });
  assert.equal(golden.points.length, 20);
  assert.equal(golden.points.every((p) => p.passed), true);
  assert.equal(golden.points.every((p) => p.journeyEvidenceRef !== null), true);
  assert.equal(releaseChecklistGatePasses(golden), true);

  // launch-gate-checked 事件 verbatim 落账（两次检查）。
  const snapshot = await controller.refresh();
  const gateEvents = snapshot.events.filter(
    (event) => event.type === "launch-gate-checked",
  );
  assert.equal(gateEvents.length, 2);
  assert.equal(gateEvents[1]?.payload["pointsPassed"], 20);
  assert.equal(gateEvents[1]?.payload["pointsTotal"], 20);
  assert.equal(gateEvents[1]?.payload["gatePassed"], true);
  assert.equal(gateEvents[0]?.payload["pointsPassed"], 16);
  assert.equal(gateEvents[0]?.payload["gatePassed"], false);
});

test("LAUNCH GATE LAW refusal path: unregistered journey is a typed YOU_LAUNCH_GATE_INVALID", async () => {
  const controller = createSimulatedReleaseStudioController();
  await driveGoldenScript(controller);
  const error = await expectTypedError(() =>
    controller.runLaunchGateCheck({ journeyId: "journey-unknown-legacy" }),
  );
  assert.equal(error.youError.code, "YOU_LAUNCH_GATE_INVALID");
  assert.equal(error.youError.details["reason"], "unknown-journey");
  assert.equal(error.youError.simulated, true);
  // 拒绝后无 checklist 落账（fail closed）。
  const snapshot = await controller.refresh();
  assert.equal(snapshot.checklists.length, 0);
});

test("OPERATOR SIGNOFF LAW: the sign-off lands on the passing checklist with signed-by / signed-at / checklistRef", async () => {
  const controller = createSimulatedReleaseStudioController();
  await driveGoldenScript(controller);
  const golden = await controller.runLaunchGateCheck({
    journeyId: "journey-gate-golden",
  });

  const signoff = await controller.recordOperatorSignoff({
    operatorId: "operator-aria",
  });
  assert.equal(signoff.checklistRef, golden.id);
  // signedBy 是 operator 的内容寻址标签（从注册面解析，绝不硬编码哈希）。
  const snapshot = await controller.refresh();
  const ariaOperator = snapshot.operators.find(
    (entry) => entry.id === "operator-aria",
  );
  assert.ok(ariaOperator);
  assert.equal(signoff.signedBy, ariaOperator.operatorRef);
  assert.ok(signoff.signedBy.startsWith("fx-content-"));
  assert.ok(signoff.signedAt.endsWith("Z"));
  assert.equal(signoff.simulated, true);

  // operator-signoff-recorded 事件落账。
  const signoffEvents = snapshot.events.filter(
    (event) => event.type === "operator-signoff-recorded",
  );
  assert.equal(signoffEvents.length, 1);
  assert.equal(signoffEvents[0]?.payload["signoffId"], signoff.id);
  assert.equal(signoffEvents[0]?.payload["checklistRef"], golden.id);
  assert.equal(signoffEvents[0]?.payload["signedBy"], ariaOperator.operatorRef);
});

test("OPERATOR SIGNOFF LAW refusal paths: no-checklist, gate-not-passing, duplicate sign-off, unknown operator", async () => {
  // 无 checklist。
  const noChecklist = createSimulatedReleaseStudioController();
  await driveGoldenScript(noChecklist);
  const errorNoChecklist = await expectTypedError(() =>
    noChecklist.recordOperatorSignoff({ operatorId: "operator-aria" }),
  );
  assert.equal(errorNoChecklist.youError.code, "YOU_OPERATOR_SIGNOFF_INVALID");
  assert.equal(errorNoChecklist.youError.details["reason"], "no-checklist");

  // 最新 checklist 未过门（16/20 partial）。
  const partialOnly = createSimulatedReleaseStudioController();
  await driveGoldenScript(partialOnly);
  await partialOnly.runLaunchGateCheck({ journeyId: "journey-gate-partial" });
  const errorNotPassing = await expectTypedError(() =>
    partialOnly.recordOperatorSignoff({ operatorId: "operator-aria" }),
  );
  assert.equal(errorNotPassing.youError.code, "YOU_OPERATOR_SIGNOFF_INVALID");
  assert.equal(errorNotPassing.youError.details["reason"], "gate-not-passing");

  // checklist 已被签署（一次性最终决定——immutable 法则显示面）。
  const signed = createSimulatedReleaseStudioController();
  await driveGoldenScript(signed);
  await signed.runLaunchGateCheck({ journeyId: "journey-gate-golden" });
  await signed.recordOperatorSignoff({ operatorId: "operator-aria" });
  const errorDuplicate = await expectTypedError(() =>
    signed.recordOperatorSignoff({ operatorId: "operator-aria" }),
  );
  assert.equal(errorDuplicate.youError.code, "YOU_OPERATOR_SIGNOFF_INVALID");
  assert.equal(
    errorDuplicate.youError.details["reason"],
    "checklist-already-signed",
  );

  // 未注册 operator（fail closed）。
  const unknownOperator = createSimulatedReleaseStudioController();
  await driveGoldenScript(unknownOperator);
  await unknownOperator.runLaunchGateCheck({ journeyId: "journey-gate-golden" });
  const errorUnknown = await expectTypedError(() =>
    unknownOperator.recordOperatorSignoff({
      operatorId: "operator-unknown-legacy",
    }),
  );
  assert.equal(errorUnknown.youError.code, "YOU_OPERATOR_SIGNOFF_INVALID");
  assert.equal(errorUnknown.youError.details["reason"], "unknown-operator");
  // 未知 operator 路径无 signoff 落账。
  assert.equal((await unknownOperator.refresh()).signoffs.length, 0);
});

test("RELEASE DECLARATION LAW: the declaration carries the evidence bundle AND rollback evidence", async () => {
  const controller = createSimulatedReleaseStudioController();
  await driveGoldenScript(controller);
  await controller.runLaunchGateCheck({ journeyId: "journey-gate-golden" });
  const signoff = await controller.recordOperatorSignoff({
    operatorId: "operator-aria",
  });

  const declaration = await controller.declareRelease({
    evidenceBundleId: "bundle-golden-journey-set",
    rollbackEvidenceId: "rollback-dr-verified",
  });
  assert.equal(declaration.signoffRef, signoff.id);
  // bundle / rollback 引用是内容寻址标签（从注册面解析，绝不硬编码哈希）。
  const snapshot = await controller.refresh();
  const goldenBundle = snapshot.evidenceBundles.find(
    (entry) => entry.id === "bundle-golden-journey-set",
  );
  assert.ok(goldenBundle);
  const drRollback = snapshot.rollbackEvidence.find(
    (entry) => entry.id === "rollback-dr-verified",
  );
  assert.ok(drRollback);
  assert.equal(declaration.evidenceBundleRef, goldenBundle.bundleRef);
  assert.equal(declaration.rollbackEvidenceRef, drRollback.rollbackRef);
  assert.ok(declaration.evidenceBundleRef.startsWith("fx-content-"));
  assert.ok(declaration.rollbackEvidenceRef.startsWith("fx-content-"));
  assert.ok(declaration.declaredAt.endsWith("Z"));
  assert.equal(declaration.simulated, true);

  // release-declared 事件落账。
  const declaredEvents = snapshot.events.filter(
    (event) => event.type === "release-declared",
  );
  assert.equal(declaredEvents.length, 1);
  assert.equal(declaredEvents[0]?.payload["declarationId"], declaration.id);
  assert.equal(
    declaredEvents[0]?.payload["evidenceBundleRef"],
    goldenBundle.bundleRef,
  );
  assert.equal(
    declaredEvents[0]?.payload["rollbackEvidenceRef"],
    drRollback.rollbackRef,
  );
});

test("RELEASE DECLARATION LAW refusal paths: no-signoff, unknown-bundle, empty-bundle, missing-rollback, duplicate declaration", async () => {
  // 无 signoff（即使 bundle / rollback 齐全）。
  const noSignoff = createSimulatedReleaseStudioController();
  await driveGoldenScript(noSignoff);
  await noSignoff.runLaunchGateCheck({ journeyId: "journey-gate-golden" });
  const errorNoSignoff = await expectTypedError(() =>
    noSignoff.declareRelease({
      evidenceBundleId: "bundle-golden-journey-set",
      rollbackEvidenceId: "rollback-dr-verified",
    }),
  );
  assert.equal(errorNoSignoff.youError.code, "YOU_RELEASE_DECLARATION_INVALID");
  assert.equal(errorNoSignoff.youError.details["reason"], "no-signoff");

  // 未注册 bundle。
  const unknownBundle = createSimulatedReleaseStudioController();
  await driveGoldenScript(unknownBundle);
  await unknownBundle.runLaunchGateCheck({ journeyId: "journey-gate-golden" });
  await unknownBundle.recordOperatorSignoff({ operatorId: "operator-aria" });
  const errorUnknownBundle = await expectTypedError(() =>
    unknownBundle.declareRelease({
      evidenceBundleId: "bundle-unregistered",
      rollbackEvidenceId: "rollback-dr-verified",
    }),
  );
  assert.equal(
    errorUnknownBundle.youError.code,
    "YOU_RELEASE_DECLARATION_INVALID",
  );
  assert.equal(
    errorUnknownBundle.youError.details["reason"],
    "unknown-evidence-bundle",
  );

  // 空 bundle（FULL evidence bundle 法则）。
  const emptyBundle = createSimulatedReleaseStudioController();
  await driveGoldenScript(emptyBundle);
  await emptyBundle.runLaunchGateCheck({ journeyId: "journey-gate-golden" });
  await emptyBundle.recordOperatorSignoff({ operatorId: "operator-aria" });
  const errorEmptyBundle = await expectTypedError(() =>
    emptyBundle.declareRelease({
      evidenceBundleId: "bundle-empty",
      rollbackEvidenceId: "rollback-dr-verified",
    }),
  );
  assert.equal(
    errorEmptyBundle.youError.code,
    "YOU_RELEASE_DECLARATION_INVALID",
  );
  assert.equal(
    errorEmptyBundle.youError.details["reason"],
    "empty-evidence-bundle",
  );

  // 缺 rollback evidence。
  const missingRollback = createSimulatedReleaseStudioController();
  await driveGoldenScript(missingRollback);
  await missingRollback.runLaunchGateCheck({ journeyId: "journey-gate-golden" });
  await missingRollback.recordOperatorSignoff({ operatorId: "operator-aria" });
  const errorMissingRollback = await expectTypedError(() =>
    missingRollback.declareRelease({
      evidenceBundleId: "bundle-golden-journey-set",
      rollbackEvidenceId: "rollback-unregistered",
    }),
  );
  assert.equal(
    errorMissingRollback.youError.code,
    "YOU_RELEASE_DECLARATION_INVALID",
  );
  assert.equal(
    errorMissingRollback.youError.details["reason"],
    "missing-rollback-evidence",
  );

  // 重复声明（one release declaration per signoff）。
  const duplicate = createSimulatedReleaseStudioController();
  await driveGoldenScript(duplicate);
  await duplicate.runLaunchGateCheck({ journeyId: "journey-gate-golden" });
  await duplicate.recordOperatorSignoff({ operatorId: "operator-aria" });
  await duplicate.declareRelease({
    evidenceBundleId: "bundle-golden-journey-set",
    rollbackEvidenceId: "rollback-dr-verified",
  });
  const errorDuplicate = await expectTypedError(() =>
    duplicate.declareRelease({
      evidenceBundleId: "bundle-golden-journey-set",
      rollbackEvidenceId: "rollback-dr-verified",
    }),
  );
  assert.equal(errorDuplicate.youError.code, "YOU_RELEASE_DECLARATION_INVALID");
  assert.equal(
    errorDuplicate.youError.details["reason"],
    "signoff-already-declared",
  );
  // 重复声明后仍只有一份 declaration 落账。
  assert.equal((await duplicate.refresh()).declarations.length, 1);
});

test("a second passing checklist allows a second independent sign-off + declaration (append-only)", async () => {
  const controller = createSimulatedReleaseStudioController();
  await driveGoldenScript(controller);
  const first = await controller.runLaunchGateCheck({
    journeyId: "journey-gate-golden",
  });
  const firstSignoff = await controller.recordOperatorSignoff({
    operatorId: "operator-aria",
  });
  await controller.declareRelease({
    evidenceBundleId: "bundle-golden-journey-set",
    rollbackEvidenceId: "rollback-dr-verified",
  });

  // 新的过门 checklist 是新的签署对象（append-only 账本；每个 signoff 一次声明）。
  const second = await controller.runLaunchGateCheck({
    journeyId: "journey-gate-golden",
  });
  assert.notEqual(second.id, first.id);
  const secondSignoff = await controller.recordOperatorSignoff({
    operatorId: "operator-aria",
  });
  assert.notEqual(secondSignoff.id, firstSignoff.id);
  assert.equal(secondSignoff.checklistRef, second.id);
  const secondDeclaration = await controller.declareRelease({
    evidenceBundleId: "bundle-golden-journey-set",
    rollbackEvidenceId: "rollback-dr-verified",
  });
  assert.equal(secondDeclaration.signoffRef, secondSignoff.id);

  const snapshot = await controller.refresh();
  assert.equal(snapshot.checklists.length, 2);
  assert.equal(snapshot.signoffs.length, 2);
  assert.equal(snapshot.declarations.length, 2);
});

test("byte-level determinism: two controllers driven by the same script produce identical snapshots", async () => {
  const runScript = async () => {
    const controller = createSimulatedReleaseStudioController();
    await controller.load({ workspaceKey: "you-w12b-determinism" });
    await controller.runLaunchGateCheck({ journeyId: "journey-gate-partial" });
    await controller.runLaunchGateCheck({ journeyId: "journey-gate-golden" });
    await controller.recordOperatorSignoff({ operatorId: "operator-aria" });
    await controller.declareRelease({
      evidenceBundleId: "bundle-golden-journey-set",
      rollbackEvidenceId: "rollback-dr-verified",
    });
    return controller.refresh();
  };
  const [first, second] = await Promise.all([runScript(), runScript()]);
  assert.deepEqual(first, second);
});

test("operations before load fail closed with a truthful invalid-state error", async () => {
  const controller = createSimulatedReleaseStudioController();
  for (const operation of [
    () => controller.refresh(),
    () =>
      controller.runLaunchGateCheck({ journeyId: "journey-gate-golden" }),
    () => controller.recordOperatorSignoff({ operatorId: "operator-aria" }),
    () =>
      controller.declareRelease({
        evidenceBundleId: "bundle-golden-journey-set",
        rollbackEvidenceId: "rollback-dr-verified",
      }),
  ]) {
    const error = await expectTypedError(operation);
    assert.equal(error.youError.code, "YOU_INVALID_STATE");
    assert.equal(error.youError.details["reason"], "release-not-loaded");
  }
});
