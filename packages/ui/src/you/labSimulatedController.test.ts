// W9B logic tests — 确定性模拟控制器（node:test，无 DOM）。
//
// 覆盖（W9A 服务语义的 UI 侧镜像——全部从 LabStudioController 端口驱动）：
// 实验声明（三臂法则 + 世界/预算 intake 的六个 v9 typed 错误码全覆盖 + 防御
// 分支）、run 阶梯（append-only、终态锁定、非法迁移、YOU_LAB_RUN_NOT_FOUND、
// plan hash 确定性）、搜索阶梯（searched 提交追加步、预算耗尽 = recorded terminal
// + YOU_SEARCH_LADDER_INVALID、后续提交持续拒绝）、manifest（内容寻址发布、
// honest 校验通过、tampered 校验 hash mismatch fail closed + 状态落账、未知 id、
// 非终态 run 发布拒绝、run 的 evidenceManifestRef 不可变替换）、promotion gate
//（固定求值序全拒绝路径 + 授予路径 + already-decided + reversal 新记录与账本）、
// 不可变纪律（记录绝不原地改写）、事件账本（lab-run-recorded /
// lab-evidence-published / lab-promotion-decided；无伪造的
// lab-experiment-declared）、确定性（两个控制器同剧本 → 字节一致快照）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedLabStudioController } from "./labSimulatedController.js";
import { LabStudioError } from "./labController.js";

async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<LabStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof LabStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected a typed LabStudioError, but the operation succeeded");
}

function declare(controller: Parameters<typeof runArm>[0], specId = "fx-labspec-001") {
  return controller.declareExperiment({
    specId,
    worldPresetId: "world-alpha",
    budgetPresetId: "budget-standard",
  });
}

async function runArm(
  controller: ReturnType<typeof createSimulatedLabStudioController>,
  experimentId: string,
  arm: "generalist-baseline" | "hand-designed" | "searched",
  outcome: "succeeded" | "failed" = "succeeded",
) {
  const submitted = await controller.submitLabRun({ experimentId, arm });
  const started = await controller.startLabRun({ runId: submitted.id });
  return controller.completeLabRun({ runId: started.id, outcome });
}

async function declareWithArmsSucceeded(
  controller: ReturnType<typeof createSimulatedLabStudioController>,
  specId: string,
) {
  const experiment = await declare(controller, specId);
  for (const arm of ["generalist-baseline", "hand-designed", "searched"] as const) {
    await runArm(controller, experiment.id, arm);
  }
  return experiment;
}

test("load is idempotent and the snapshot exposes the frozen taxonomies and registries", async () => {
  const controller = createSimulatedLabStudioController();
  const first = await controller.load({ workspaceKey: "ws-a" });
  const second = await controller.load({ workspaceKey: "ws-b" });
  assert.equal(first.studioId, second.studioId);
  assert.equal(first.simulated, true);
  assert.deepEqual(first.armKinds, ["generalist-baseline", "hand-designed", "searched"]);
  assert.deepEqual(first.runStatuses, ["submitted", "running", "succeeded", "failed", "retired"]);
  assert.equal(first.experimentSpecs.length, 3);
  assert.equal(first.worldPresets.length, 4);
  assert.equal(first.budgetPresets.length, 3);
  assert.deepEqual(first.manifestIntegrities, ["honest", "tampered"]);
  // refresh 不重建（幂等平面）。
  const refreshed = await controller.refresh();
  assert.equal(refreshed.studioId, first.studioId);
  assert.equal(refreshed.experiments.length, 0);
  // 未加载的控制器 refresh ⇒ typed invalid-state（诚实拒绝）。
  const unloaded = createSimulatedLabStudioController();
  const error = await expectTypedError(() => unloaded.refresh());
  assert.equal(error.youError.code, "YOU_INVALID_STATE");
});

test("world and budget intake refuse malformed presets with the typed v9 codes (never silently repaired)", async () => {
  const controller = createSimulatedLabStudioController();
  await controller.load({ workspaceKey: "ws" });
  // 空 seed 世界 ⇒ YOU_LAB_WORLD_INVALID（LAB DETERMINISM LAW）。
  const worldError = await expectTypedError(() =>
    controller.declareExperiment({
      specId: "fx-labspec-001",
      worldPresetId: "world-empty-seed",
      budgetPresetId: "budget-standard",
    }),
  );
  assert.equal(worldError.youError.code, "YOU_LAB_WORLD_INVALID");
  assert.equal(worldError.youError.simulated, true);
  // 越界 actor 数（512 > 64）⇒ 同码。
  const crowdError = await expectTypedError(() =>
    controller.declareExperiment({
      specId: "fx-labspec-001",
      worldPresetId: "world-overcrowded",
      budgetPresetId: "budget-standard",
    }),
  );
  assert.equal(crowdError.youError.code, "YOU_LAB_WORLD_INVALID");
  // 零预算 ⇒ YOU_SEARCH_LADDER_INVALID（SEARCH BUDGET LAW）。
  const budgetError = await expectTypedError(() =>
    controller.declareExperiment({
      specId: "fx-labspec-001",
      worldPresetId: "world-alpha",
      budgetPresetId: "budget-zero",
    }),
  );
  assert.equal(budgetError.youError.code, "YOU_SEARCH_LADDER_INVALID");
  // 未知预设/规格 ⇒ 防御性 invalid-state（UI 挑选面只提供注册项）。
  const specError = await expectTypedError(() =>
    controller.declareExperiment({
      specId: "fx-labspec-999",
      worldPresetId: "world-alpha",
      budgetPresetId: "budget-standard",
    }),
  );
  assert.equal(specError.youError.code, "YOU_INVALID_STATE");
  const presetError = await expectTypedError(() =>
    controller.declareExperiment({
      specId: "fx-labspec-001",
      worldPresetId: "world-unknown",
      budgetPresetId: "budget-standard",
    }),
  );
  assert.equal(presetError.youError.code, "YOU_INVALID_STATE");
  // 拒绝后平面保持零实验（typed 拒绝不留半成品记录）。
  const snapshot = await controller.refresh();
  assert.equal(snapshot.experiments.length, 0);
});

test("declareExperiment records an immutable three-arm experiment with world/budget context (no fabricated event)", async () => {
  const controller = createSimulatedLabStudioController();
  await controller.load({ workspaceKey: "ws" });
  const experiment = await declare(controller);
  assert.equal(experiment.arms.length, 3);
  assert.deepEqual(experiment.arms, ["generalist-baseline", "hand-designed", "searched"]);
  assert.equal(experiment.promotionRef, null);
  assert.equal(experiment.simulated, true);
  assert.ok(experiment.objective.includes("human-realism"));
  assert.ok(experiment.constraintsHash.startsWith("sha256-fixture-"));

  const snapshot = await controller.refresh();
  assert.equal(snapshot.experiments.length, 1);
  const context = snapshot.experimentContexts[0]!;
  assert.equal(context.experimentId, experiment.id);
  assert.equal(context.specId, "fx-labspec-001");
  assert.equal(context.world.seed, "you-w9b-world-alpha");
  assert.equal(context.world.actorCount, 4);
  assert.ok(context.world.groundTruthRef!.startsWith("fx-content-"));
  assert.equal(context.world.simulated, true);
  assert.equal(context.searchBudget, 6);
  assert.equal(context.searchExhausted, false);
  // 世界注册面收录声明的确定性世界。
  assert.equal(snapshot.worlds.length, 1);
  // frozen v9 词汇无 lab-experiment-declared —— 声明不伪造事件（如实披露）。
  assert.equal(
    snapshot.events.filter((event) => (event.type as string) === "lab-experiment-declared")
      .length,
    0,
  );
  // 同世界再声明 ⇒ 世界注册面幂等（同 id 不重复）。
  await declare(controller);
  const next = await controller.refresh();
  assert.equal(next.worlds.length, 1);
  assert.equal(next.experiments.length, 2);
});

test("the run ladder is append-only with locked terminals, deterministic plan hashes and typed not-found", async () => {
  const controller = createSimulatedLabStudioController();
  await controller.load({ workspaceKey: "ws" });
  const experiment = await declare(controller);
  const run = await controller.submitLabRun({
    experimentId: experiment.id,
    arm: "generalist-baseline",
  });
  assert.equal(run.status, "submitted");
  assert.equal(run.completedAt, null);
  assert.equal(run.evidenceManifestRef, null);
  assert.equal(run.simulated, true);
  assert.ok(run.planHash.startsWith("sha256-fixture-"));
  // plan hash 确定性：同实验同臂同尝试 ⇒ 同 hash。
  const replay = createSimulatedLabStudioController();
  await replay.load({ workspaceKey: "ws" });
  const replayExperiment = await declare(replay);
  const replayRun = await replay.submitLabRun({
    experimentId: replayExperiment.id,
    arm: "generalist-baseline",
  });
  assert.equal(replayRun.planHash, run.planHash);

  // submitted -> running -> succeeded。
  const started = await controller.startLabRun({ runId: run.id });
  assert.equal(started.status, "running");
  const succeeded = await controller.completeLabRun({ runId: run.id, outcome: "succeeded" });
  assert.equal(succeeded.status, "succeeded");
  assert.ok(succeeded.completedAt !== null);

  // 终态锁定：succeeded 上的任何迁移 ⇒ invalid-state（run-terminal-locked）。
  const locked = await expectTypedError(() =>
    controller.completeLabRun({ runId: run.id, outcome: "failed" }),
  );
  assert.equal(locked.youError.code, "YOU_INVALID_STATE");
  assert.equal(locked.youError.details.reason, "run-terminal-locked");
  const retireLocked = await expectTypedError(() =>
    controller.retireLabRun({ runId: run.id }),
  );
  assert.equal(retireLocked.youError.code, "YOU_INVALID_STATE");

  // 非法迁移：submitted 之外启动；running 之外完成。
  const run2 = await controller.submitLabRun({
    experimentId: experiment.id,
    arm: "hand-designed",
  });
  const started2 = await controller.startLabRun({ runId: run2.id });
  const startFromRunning = await expectTypedError(() =>
    controller.startLabRun({ runId: started2.id }),
  );
  assert.equal(startFromRunning.youError.code, "YOU_INVALID_STATE");
  const freshSubmitted = await controller.submitLabRun({
    experimentId: experiment.id,
    arm: "hand-designed",
  });
  const completeFromSubmitted = await expectTypedError(() =>
    controller.completeLabRun({ runId: freshSubmitted.id, outcome: "succeeded" }),
  );
  assert.equal(completeFromSubmitted.youError.code, "YOU_INVALID_STATE");

  // 未知 run ⇒ YOU_LAB_RUN_NOT_FOUND。
  const unknownRun = await expectTypedError(() =>
    controller.startLabRun({ runId: "fx-run-999" }),
  );
  assert.equal(unknownRun.youError.code, "YOU_LAB_RUN_NOT_FOUND");

  // 未知实验 ⇒ YOU_LAB_EXPERIMENT_NOT_FOUND；臂不在三臂之内 ⇒ 防御拒绝。
  const unknownExperiment = await expectTypedError(() =>
    controller.submitLabRun({ experimentId: "fx-experiment-999", arm: "searched" }),
  );
  assert.equal(unknownExperiment.youError.code, "YOU_LAB_EXPERIMENT_NOT_FOUND");
  const badArm = await expectTypedError(() =>
    controller.submitLabRun({
      experimentId: experiment.id,
      arm: "cross-validated" as "searched",
    }),
  );
  assert.equal(badArm.youError.code, "YOU_INVALID_STATE");

  // submitted -> retired（优雅移除终态）。
  const retiredRun = await controller.submitLabRun({
    experimentId: experiment.id,
    arm: "hand-designed",
  });
  const retired = await controller.retireLabRun({ runId: retiredRun.id });
  assert.equal(retired.status, "retired");
  assert.ok(retired.completedAt !== null);

  // 每次 run 迁移都落 lab-run-recorded 事件（statusBefore/statusAfter 携带）。
  const snapshot = await controller.refresh();
  const runEvents = snapshot.events.filter(
    (event) => event.type === "lab-run-recorded" && event.payload.runId === run.id,
  );
  assert.equal(runEvents.length, 3);
  assert.equal(runEvents[0]!.payload.statusAfter, "submitted");
  assert.equal(runEvents[1]!.payload.statusAfter, "running");
  assert.equal(runEvents[2]!.payload.statusAfter, "succeeded");
  // run 记录不可变：旧引用的 status 不被后续迁移改写。
  assert.equal(run.status, "submitted");
  assert.equal(started.status, "running");
});

test("searched-arm submissions append SearchLadderSteps; budget exhaustion is a recorded terminal followed by typed refusals", async () => {
  const controller = createSimulatedLabStudioController();
  await controller.load({ workspaceKey: "ws" });
  const experiment = await declare(controller);
  // 第一次 searched 提交 ⇒ 阶梯步 1（strategy 轮换起点 beam-search）。
  const first = await controller.submitLabRun({
    experimentId: experiment.id,
    arm: "searched",
  });
  let snapshot = await controller.refresh();
  let steps = snapshot.searchLadder.filter(
    (step) => step.experimentId === experiment.id,
  );
  assert.equal(steps.length, 1);
  assert.equal(steps[0]!.step, 1);
  assert.equal(steps[0]!.strategy, "beam-search");
  assert.equal(steps[0]!.cumulativeBudget, 6);
  assert.equal(steps[0]!.simulated, true);
  // 非 searched 臂提交不追加阶梯步。
  await controller.submitLabRun({ experimentId: experiment.id, arm: "generalist-baseline" });
  snapshot = await controller.refresh();
  assert.equal(snapshot.searchLadder.length, 1);

  // 耗尽路径：紧预算实验（cumulativeBudget 1）。
  const tight = await controller.declareExperiment({
    specId: "fx-labspec-003",
    worldPresetId: "world-alpha",
    budgetPresetId: "budget-tight",
  });
  await controller.submitLabRun({ experimentId: tight.id, arm: "searched" });
  const exhausted = await expectTypedError(() =>
    controller.submitLabRun({ experimentId: tight.id, arm: "searched" }),
  );
  assert.equal(exhausted.youError.code, "YOU_SEARCH_LADDER_INVALID");
  assert.equal(exhausted.youError.details.reason, "budget-exhausted");
  snapshot = await controller.refresh();
  const terminalSteps = snapshot.searchLadder.filter(
    (step) => step.experimentId === tight.id && step.strategy === "budget-exhausted",
  );
  // recorded terminal：耗尽被落账为终态步（SEARCH BUDGET LAW——绝不静默停止）。
  assert.equal(terminalSteps.length, 1);
  assert.equal(terminalSteps[0]!.exploredNodes, 0);
  const context = snapshot.experimentContexts.find(
    (entry) => entry.experimentId === tight.id,
  )!;
  assert.equal(context.searchExhausted, true);
  // 后续提交持续拒绝（阶梯已终态；不再重复落账）。
  const again = await expectTypedError(() =>
    controller.submitLabRun({ experimentId: tight.id, arm: "searched" }),
  );
  assert.equal(again.youError.code, "YOU_SEARCH_LADDER_INVALID");
  snapshot = await controller.refresh();
  assert.equal(
    snapshot.searchLadder.filter(
      (step) => step.experimentId === tight.id && step.strategy === "budget-exhausted",
    ).length,
    1,
  );
  // 非 searched 臂不受搜索预算限制。
  const baselineRun = await controller.submitLabRun({
    experimentId: tight.id,
    arm: "generalist-baseline",
  });
  assert.equal(baselineRun.status, "submitted");
  void first;
});

test("manifests are content-addressed; honest verifies, tampered fails closed with mismatch recorded, unknown ids refuse", async () => {
  const controller = createSimulatedLabStudioController();
  await controller.load({ workspaceKey: "ws" });
  const experiment = await declare(controller);
  const succeeded = await runArm(controller, experiment.id, "searched");
  // 非终态 run 发布 ⇒ typed 拒绝（manifest intake）。
  const submittedRun = await controller.submitLabRun({
    experimentId: experiment.id,
    arm: "generalist-baseline",
  });
  const intakeError = await expectTypedError(() =>
    controller.publishEvidenceManifest({ runId: submittedRun.id, integrity: "honest" }),
  );
  assert.equal(intakeError.youError.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");

  // honest 发布：内容寻址 bundle + run 回链（不可变替换）。
  const published = await controller.publishEvidenceManifest({
    runId: succeeded.id,
    integrity: "honest",
  });
  assert.equal(published.verification, "unverified");
  assert.ok(published.manifest.contentHash.startsWith("sha256-fixture-"));
  assert.equal(published.manifest.artifactRefs.length, 3);
  assert.ok(published.manifest.artifactRefs[0]!.startsWith("fx-content-"));
  assert.equal(published.manifest.simulated, true);
  let snapshot = await controller.refresh();
  const linkedRun = snapshot.runs.find((run) => run.id === succeeded.id)!;
  assert.equal(linkedRun.evidenceManifestRef, published.manifest.id);

  // 校验：重算匹配 ⇒ verified。
  const verified = await controller.verifyEvidenceManifest({
    manifestId: published.manifest.id,
  });
  assert.equal(verified.verification, "verified");
  snapshot = await controller.refresh();
  assert.equal(
    snapshot.manifests.find((entry) => entry.manifest.id === published.manifest.id)!
      .verification,
    "verified",
  );

  // tampered 发布：合法落账 + 校验 fail closed（mismatch 状态落账）。
  const baselineSucceeded = await runArm(
    controller,
    experiment.id,
    "generalist-baseline",
  );
  const tampered = await controller.publishEvidenceManifest({
    runId: baselineSucceeded.id,
    integrity: "tampered",
  });
  assert.ok(tampered.manifest.contentHash.includes("tampered"));
  const mismatchError = await expectTypedError(() =>
    controller.verifyEvidenceManifest({ manifestId: tampered.manifest.id }),
  );
  assert.equal(mismatchError.youError.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  assert.equal(mismatchError.youError.details.reason, "hash-mismatch");
  snapshot = await controller.refresh();
  assert.equal(
    snapshot.manifests.find((entry) => entry.manifest.id === tampered.manifest.id)!
      .verification,
    "mismatch",
  );
  // manifest 记录本身未被校验失败改写（contentHash 保持落账值）。
  assert.equal(
    snapshot.manifests.find((entry) => entry.manifest.id === tampered.manifest.id)!.manifest
      .contentHash,
    tampered.manifest.contentHash,
  );

  // 未知 manifest ⇒ 同码 typed 拒绝。
  const unknownError = await expectTypedError(() =>
    controller.verifyEvidenceManifest({ manifestId: "fx-manifest-999" }),
  );
  assert.equal(unknownError.youError.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  assert.equal(unknownError.youError.details.reason, "unknown-manifest");

  // 事件：lab-evidence-published per 发布。
  const publishEvents = snapshot.events.filter(
    (event) => event.type === "lab-evidence-published",
  );
  assert.equal(publishEvents.length, 2);
});

test("the promotion gate enforces the LAB PROMOTION LAW: searched-only, strict improvement, verified evidence, one live decision", async () => {
  const controller = createSimulatedLabStudioController();
  await controller.load({ workspaceKey: "ws" });
  const experiment = await declareWithArmsSucceeded(controller, "fx-labspec-001");
  const snapshot = await controller.refresh();
  const searchedRun = snapshot.runs.find(
    (run) => run.experimentId === experiment.id && run.arm === "searched",
  )!;
  const published = await controller.publishEvidenceManifest({
    runId: searchedRun.id,
    integrity: "honest",
  });

  // 未知实验 ⇒ YOU_LAB_EXPERIMENT_NOT_FOUND。
  const unknownExperiment = await expectTypedError(() =>
    controller.decidePromotion({
      experimentId: "fx-experiment-999",
      candidateArm: "searched",
      evidenceManifestRef: published.manifest.id,
    }),
  );
  assert.equal(unknownExperiment.youError.code, "YOU_LAB_EXPERIMENT_NOT_FOUND");

  // 非 searched winner ⇒ YOU_LAB_PROMOTION_INVALID（non-searched-winner）。
  const baselineWinner = await expectTypedError(() =>
    controller.decidePromotion({
      experimentId: experiment.id,
      candidateArm: "generalist-baseline",
      evidenceManifestRef: published.manifest.id,
    }),
  );
  assert.equal(baselineWinner.youError.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(baselineWinner.youError.details.reason, "non-searched-winner");

  // 未校验证据 ⇒ evidence-unverified。
  const unverified = await expectTypedError(() =>
    controller.decidePromotion({
      experimentId: experiment.id,
      candidateArm: "searched",
      evidenceManifestRef: published.manifest.id,
    }),
  );
  assert.equal(unverified.youError.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(unverified.youError.details.reason, "evidence-unverified");

  // 未知证据 ⇒ unknown-evidence-manifest。
  const unknownEvidence = await expectTypedError(() =>
    controller.decidePromotion({
      experimentId: experiment.id,
      candidateArm: "searched",
      evidenceManifestRef: "fx-manifest-999",
    }),
  );
  assert.equal(unknownEvidence.youError.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(unknownEvidence.youError.details.reason, "unknown-evidence-manifest");

  // 校验后授予：winner searched、objective 0.78 > baseline 0.62、promotionRef 不可变替换。
  await controller.verifyEvidenceManifest({ manifestId: published.manifest.id });
  const decided = await controller.decidePromotion({
    experimentId: experiment.id,
    candidateArm: "searched",
    evidenceManifestRef: published.manifest.id,
  });
  assert.equal(decided.kind, "promotion");
  assert.equal(decided.record.winnerArm, "searched");
  assert.equal(decided.record.objectiveScore, 0.78);
  assert.equal(decided.record.baselineScore, 0.62);
  assert.equal(decided.record.evidenceManifestRef, published.manifest.id);
  assert.equal(decided.record.simulated, true);
  let next = await controller.refresh();
  const promotedExperiment = next.experiments.find(
    (candidate) => candidate.id === experiment.id,
  )!;
  assert.equal(promotedExperiment.promotionRef, decided.record.id);
  // 原实验记录引用不被改写（不可变替换：同 id 新记录）。
  assert.equal(experiment.promotionRef, null);

  // already-decided：live promotion 存在 ⇒ 拒绝。
  const again = await expectTypedError(() =>
    controller.decidePromotion({
      experimentId: experiment.id,
      candidateArm: "searched",
      evidenceManifestRef: published.manifest.id,
    }),
  );
  assert.equal(again.youError.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(again.youError.details.reason, "already-decided");

  // reversal：新账本记录 + 实验引用再替换 + 事件带 reversal 标记。
  const reversed = await controller.reversePromotion({ promotionId: decided.record.id });
  assert.equal(reversed.kind, "reversal");
  assert.equal(reversed.supersedesRecordId, decided.record.id);
  next = await controller.refresh();
  const reversedExperiment = next.experiments.find(
    (candidate) => candidate.id === experiment.id,
  )!;
  assert.equal(reversedExperiment.promotionRef, reversed.record.id);
  const reversalEvent = next.events.find(
    (event) => event.type === "lab-promotion-decided" && event.payload.reversal === true,
  );
  assert.ok(reversalEvent !== undefined);
  assert.equal(reversalEvent!.payload.supersedesPromotionId, decided.record.id);
  // 反转后再晋升（新决定合法——reversal 打开了门）。
  const redecided = await controller.decidePromotion({
    experimentId: experiment.id,
    candidateArm: "searched",
    evidenceManifestRef: published.manifest.id,
  });
  assert.equal(redecided.kind, "promotion");
  // reversal 的防御路径：未知 promotion / reversal-of-reversal / not-live。
  const unknownPromotion = await expectTypedError(() =>
    controller.reversePromotion({ promotionId: "fx-promotion-999" }),
  );
  assert.equal(unknownPromotion.youError.code, "YOU_LAB_PROMOTION_INVALID");
  const doubleReverse = await expectTypedError(() =>
    controller.reversePromotion({ promotionId: reversed.record.id }),
  );
  assert.equal(doubleReverse.youError.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(doubleReverse.youError.details.reason, "reversal-of-reversal");
  const staleReverse = await expectTypedError(() =>
    controller.reversePromotion({ promotionId: decided.record.id }),
  );
  assert.equal(staleReverse.youError.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(staleReverse.youError.details.reason, "promotion-not-live");
});

test("losing and tying searched arms never promote (the strict-inequality core)", async () => {
  const controller = createSimulatedLabStudioController();
  await controller.load({ workspaceKey: "ws" });
  // 落败：0.74 <= 0.80。
  const losing = await declareWithArmsSucceeded(controller, "fx-labspec-002");
  let snapshot = await controller.refresh();
  const losingRun = snapshot.runs.find(
    (run) => run.experimentId === losing.id && run.arm === "searched",
  )!;
  const losingManifest = await controller.publishEvidenceManifest({
    runId: losingRun.id,
    integrity: "honest",
  });
  await controller.verifyEvidenceManifest({ manifestId: losingManifest.manifest.id });
  const losingError = await expectTypedError(() =>
    controller.decidePromotion({
      experimentId: losing.id,
      candidateArm: "searched",
      evidenceManifestRef: losingManifest.manifest.id,
    }),
  );
  assert.equal(losingError.youError.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(losingError.youError.details.reason, "no-improvement");

  // 持平：0.66 === 0.66（严格不等式——相等不是改进）。
  const tie = await declareWithArmsSucceeded(controller, "fx-labspec-003");
  snapshot = await controller.refresh();
  const tieRun = snapshot.runs.find(
    (run) => run.experimentId === tie.id && run.arm === "searched",
  )!;
  const tieManifest = await controller.publishEvidenceManifest({
    runId: tieRun.id,
    integrity: "honest",
  });
  await controller.verifyEvidenceManifest({ manifestId: tieManifest.manifest.id });
  const tieError = await expectTypedError(() =>
    controller.decidePromotion({
      experimentId: tie.id,
      candidateArm: "searched",
      evidenceManifestRef: tieManifest.manifest.id,
    }),
  );
  assert.equal(tieError.youError.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(tieError.youError.details.reason, "no-improvement");

  // 三臂比较投影的 armScores：succeeded 后分数可见；无 succeeded run 的臂为 null。
  const fresh = await declare(controller);
  const freshSnapshot = await controller.refresh();
  const freshScores = freshSnapshot.armScores.filter(
    (entry) => entry.experimentId === fresh.id,
  );
  assert.equal(freshScores.length, 3);
  assert.ok(freshScores.every((entry) => entry.score === null));
});

test("no-benchmark-evidence refusal when the searched arm has no succeeded run", async () => {
  const controller = createSimulatedLabStudioController();
  await controller.load({ workspaceKey: "ws" });
  const experiment = await declareWithArmsSucceeded(controller, "fx-labspec-001");
  // 新实验（无任何 run）+ 已校验 manifest（来自另一实验的 run —— 未知证据面）。
  const noRuns = await declare(controller);
  const noRunsError = await expectTypedError(() =>
    controller.decidePromotion({
      experimentId: noRuns.id,
      candidateArm: "searched",
      evidenceManifestRef: "fx-manifest-999",
    }),
  );
  assert.equal(noRunsError.youError.details.reason, "no-benchmark-evidence");
  void experiment;
});

test("byte-identical determinism: two controllers driven by the same script yield identical snapshots", async () => {
  const script = async (
    controller: ReturnType<typeof createSimulatedLabStudioController>,
  ) => {
    await controller.load({ workspaceKey: "ws-determinism" });
    const experiment = await controller.declareExperiment({
      specId: "fx-labspec-001",
      worldPresetId: "world-alpha",
      budgetPresetId: "budget-standard",
    });
    for (const arm of ["generalist-baseline", "hand-designed", "searched"] as const) {
      await runArm(controller, experiment.id, arm);
    }
    const snapshot = await controller.refresh();
    const searchedRun = snapshot.runs.find(
      (run) => run.experimentId === experiment.id && run.arm === "searched",
    )!;
    const manifest = await controller.publishEvidenceManifest({
      runId: searchedRun.id,
      integrity: "honest",
    });
    await controller.verifyEvidenceManifest({ manifestId: manifest.manifest.id });
    await controller.decidePromotion({
      experimentId: experiment.id,
      candidateArm: "searched",
      evidenceManifestRef: manifest.manifest.id,
    });
    return controller.refresh();
  };
  const left = await script(createSimulatedLabStudioController());
  const right = await script(createSimulatedLabStudioController());
  assert.equal(JSON.stringify(left), JSON.stringify(right));
});
