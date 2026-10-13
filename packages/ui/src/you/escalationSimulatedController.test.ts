// W8B logic tests — 确定性模拟控制器（node:test，无 DOM）。
//
// 覆盖：load 幂等 + 确定性引导；gap 记录（资格计算/事件/不可变/未知规格 typed
// 拒绝）；升级生命周期 happy path（v1 阶梯 requested → authorized → in-progress →
// delivered → applied；事件词汇 + gap 引用同步）；非法迁移 typed 拒绝（转移表
// 抽样 + 终态锁定）；ESCALATION AUTHORIZATION LAW（missing/withdrawn/expired/
// scope-mismatch 四路 fail closed + 求值固定序）；授权账本（不可变 grant/撤回新
// 记录/撤回的撤回拒绝/已撤回再撤回拒绝/撤回后重授予/过期后续期即新记录）；
// ARENA LEARNING PERMISSION LAW（learning-permission-recorded 落账：grant 与
// withdrawal 双路径）；run 阶梯（append-only 尝试/终态锁定/未知 run/重试耗尽）；
// provider fail-closed；gap 投影（合法发布 + 双 malformed typed 拒绝）；policy
// 校验器（合法 + 各违例 reason）；重试策略边界；确定性（两个新控制器同操作序 ⇒
// 快照字节一致）；registry 独立性。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedEscalationStudioController } from "./escalationSimulatedController.js";
import { EscalationStudioError } from "./escalationController.js";
import { resetEscalationStudioRegistryForTests, acquireEscalationStudio } from "./escalationStudioRegistry.js";
import { isLegalStoryboardEscalationTransition } from "./escalationStoryboardLaws.js";
import type { EscalationStudioController } from "./escalationController.js";
import type { ArenaEscalationStatus } from "@zcode/shared";

async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<EscalationStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof EscalationStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("test: expected a typed EscalationStudioError");
}

/** 走完 TOOL gap 的 happy path：gap → escalation → grant → run → deliver → apply。 */
async function walkHappyPath(controller: EscalationStudioController) {
  await controller.load({ workspaceKey: "ws" });
  const gap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-001" });
  const requested = await controller.requestEscalation({ gapId: gap.id });
  const granted = await controller.grantAuthorization({
    escalationId: requested.escalation.escalationId,
    scope: requested.escalation.requiredScope,
    expiresAt: null,
    learningPermission: "aggregate",
  });
  const started = await controller.startArenaRun({
    escalationId: requested.escalation.escalationId,
  });
  const delivered = await controller.invokeArenaProvider({
    escalationId: requested.escalation.escalationId,
    providerId: "fx-arena-provider-001",
  });
  const applied = await controller.applyExpertResult({
    escalationId: requested.escalation.escalationId,
  });
  return { gap, requested, granted, started, delivered, applied };
}

test("load is idempotent and bootstraps a deterministic empty escalation plane", async () => {
  const controller = createSimulatedEscalationStudioController();
  const first = await controller.load({ workspaceKey: "ws-a" });
  assert.equal(first.studioId, "fx-escalation-studio-001");
  assert.equal(first.simulated, true);
  assert.equal(first.gaps.length, 0);
  assert.equal(first.escalations.length, 0);
  assert.equal(first.runs.length, 0);
  assert.equal(first.authorizationLedger.length, 0);
  assert.equal(first.categories.length, 7);
  assert.deepEqual(first.learningPermissions, ["none", "aggregate", "full"]);
  assert.equal(first.retryPolicy.maxAttempts, 3);
  assert.equal(first.providers.length, 2);

  // 幂等：再次 load 返回同一平面（不重建——solution-created 只有一条）。
  const second = await controller.load({ workspaceKey: "ws-a" });
  assert.equal(second.events.filter((event) => event.type === "solution-created").length, 1);
  // 幂等 load 不新增事件。
  assert.equal(second.events.length, first.events.length);
});

test("gap recording: eligibility computed, events journaled, records immutable, unknown spec refused", async () => {
  const controller = createSimulatedEscalationStudioController();
  const snapshot0 = await controller.load({ workspaceKey: "ws" });
  const gap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-001" });
  assert.equal(gap.category, "TOOL_GAP");
  assert.equal(gap.escalationEligibility, "eligible");
  assert.equal(gap.attemptedStrategies.length, 2);
  assert.ok(gap.failureEvidence.length >= 1);
  assert.ok(gap.failureEvidence.every((ref) => ref.startsWith("fx-content-")));
  assert.equal(gap.arenaEscalationRef, null);

  const snapshot = await controller.refresh();
  // capability-gap-detected 落账（payload 携带 gap-opened 链接事实）。
  const gapEvent = snapshot.events.find((event) => event.type === "capability-gap-detected");
  assert.ok(gapEvent);
  assert.equal(gapEvent.payload.gapId, gap.id);
  assert.equal(gapEvent.payload.eligibility, "eligible");
  assert.equal(gapEvent.payload.requiredScope, "solution:fx-portrait-001");
  // 既有 gap 记录不被后续记录改写（不可变——同 id 原引用保持）。
  const before = snapshot.gaps.find((entry) => entry.id === gap.id);
  await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-002" });
  const after = (await controller.refresh()).gaps.find((entry) => entry.id === gap.id);
  assert.deepEqual(before, after);

  // 未知规格：typed 拒绝（注册面 miss——YOU_INVALID_STATE 类）。
  const error = await expectTypedError(() =>
    controller.openCapabilityGap({ gapSpecId: "fx-gapspec-999" }),
  );
  assert.equal(error.youError.code, "YOU_INVALID_STATE");
  assert.equal(error.youError.details.reason, "unknown-gap-spec");

  // 低置信度规格落账为合法的 not-eligible 记录（持久化从不拒绝）。
  const ineligible = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-008" });
  assert.equal(ineligible.escalationEligibility, "not-eligible");
  assert.equal(snapshot0.gapSpecs.length, 8);
});

test("escalation lifecycle happy path: the v1 ladder walks to applied with the frozen event vocabulary", async () => {
  const controller = createSimulatedEscalationStudioController();
  const walked = await walkHappyPath(controller);
  const snapshot = await controller.refresh();

  // 阶梯到达 applied 终态；专家结果带 appliesAsChangeSetId。
  assert.equal(walked.applied.escalation.status, "applied");
  assert.ok(walked.applied.escalation.expertResult?.appliesAsChangeSetId);
  assert.equal(walked.delivered.result.resultType, "typed-payload");
  assert.equal(walked.started.run.attempt, 1);
  assert.equal(walked.started.run.status, "started");

  // gap 的 v1 ArenaEscalationRef 同步到 applied（不可变替换）。
  const gap = snapshot.gaps.find((entry) => entry.id === walked.gap.id);
  assert.equal(gap?.escalationEligibility, "escalated");
  assert.equal(gap?.arenaEscalationRef?.status, "applied");
  assert.equal(gap?.arenaEscalationRef?.expertResult?.appliesAsChangeSetId, walked.applied.escalation.expertResult?.appliesAsChangeSetId);

  // 事件词汇（frozen wave-8 + v1 arena-*）：全部出现且 payload 完整。
  const types = snapshot.events.map((event) => event.type);
  for (const expected of [
    "capability-gap-detected",
    "arena-escalation-requested",
    "escalation-authorized",
    "learning-permission-recorded",
    "arena-run-recorded",
    "arena-result-applied",
  ] as const) {
    assert.ok(types.includes(expected), `missing event ${expected}`);
  }
  const authorized = snapshot.events.find((event) => event.type === "escalation-authorized");
  assert.equal(authorized?.payload.learningPermission, "aggregate");
  const permission = snapshot.events.find(
    (event) => event.type === "learning-permission-recorded",
  );
  assert.equal(permission?.payload.permission, "aggregate");
  assert.equal(permission?.payload.withdrawal, false);
  const appliedEvent = snapshot.events.find((event) => event.type === "arena-result-applied");
  assert.equal(appliedEvent?.payload.statusAfter, "applied");
  // 每条事件携带 simulated: true（truth law）。
  assert.ok(snapshot.events.every((event) => event.payload.simulated === true));
});

test("escalation refusals: ineligible gap, unknown escalation, illegal transitions, terminal locks", async () => {
  const controller = createSimulatedEscalationStudioController();
  await controller.load({ workspaceKey: "ws" });
  const ineligible = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-008" });
  const notEligible = await expectTypedError(() =>
    controller.requestEscalation({ gapId: ineligible.id }),
  );
  assert.equal(notEligible.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(notEligible.youError.details.reason, "not-escalation-eligible");

  // 未知升级 id ⇒ YOU_ESCALATION_NOT_FOUND。
  const unknown = await expectTypedError(() =>
    controller.applyExpertResult({ escalationId: "fx-escalation-999" }),
  );
  assert.equal(unknown.youError.code, "YOU_ESCALATION_NOT_FOUND");

  // 转移表（W8A 镜像）：合法边全覆盖；非法边 typed 拒绝。
  const legal: readonly (readonly [ArenaEscalationStatus, ArenaEscalationStatus])[] = [
    ["requested", "authorized"],
    ["requested", "cancelled"],
    ["authorized", "in-progress"],
    ["authorized", "cancelled"],
    ["in-progress", "delivered"],
    ["in-progress", "cancelled"],
    ["delivered", "applied"],
    ["delivered", "rejected"],
    ["delivered", "cancelled"],
  ];
  for (const [from, to] of legal) {
    assert.ok(isLegalStoryboardEscalationTransition(from, to), `${from} -> ${to} must be legal`);
  }
  for (const from of ["requested", "authorized", "in-progress"] as const) {
    assert.equal(isLegalStoryboardEscalationTransition(from, "applied"), false);
  }
  for (const terminal of ["applied", "rejected", "cancelled"] as const) {
    for (const to of ["requested", "authorized", "in-progress", "delivered"] as const) {
      assert.equal(isLegalStoryboardEscalationTransition(terminal, to), false);
    }
  }

  // 通过控制器抽样两条非法边：apply 于 requested；cancel 于 applied。
  const walked = await (async () => {
    const gap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-001" });
    const requested = await controller.requestEscalation({ gapId: gap.id });
    return requested.escalation.escalationId;
  })();
  const earlyApply = await expectTypedError(() =>
    controller.applyExpertResult({ escalationId: walked }),
  );
  assert.equal(earlyApply.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(earlyApply.youError.details.reason, "apply-illegal-status");

  // 未授权即申请取消是合法路径（escalation-cancelled）。
  const cancelled = await controller.cancelEscalation({ escalationId: walked });
  assert.equal(cancelled.escalation.status, "cancelled");
  const reCancel = await expectTypedError(() =>
    controller.cancelEscalation({ escalationId: walked }),
  );
  assert.equal(reCancel.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(reCancel.youError.details.reason, "cancel-on-terminal");
});

test("ESCALATION AUTHORIZATION LAW: missing / scope-mismatch / expired / withdrawn all fail closed in fixed order", async () => {
  const controller = createSimulatedEscalationStudioController();
  await controller.load({ workspaceKey: "ws" });
  const gap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-001" });
  const { escalation } = await controller.requestEscalation({ gapId: gap.id });

  // missing：无任何授权 ⇒ 拒绝。
  const missing = await expectTypedError(() =>
    controller.startArenaRun({ escalationId: escalation.escalationId }),
  );
  assert.equal(missing.youError.code, "YOU_ESCALATION_AUTHORIZATION_REQUIRED");
  assert.equal(missing.youError.details.reason, "authorization-missing");

  // scope-mismatch：越界授权可落账但永不生效。
  await controller.grantAuthorization({
    escalationId: escalation.escalationId,
    scope: "workspace:wrong-scope",
    expiresAt: null,
    learningPermission: "aggregate",
  });
  const mismatch = await expectTypedError(() =>
    controller.startArenaRun({ escalationId: escalation.escalationId }),
  );
  assert.equal(mismatch.youError.code, "YOU_ESCALATION_AUTHORIZATION_REQUIRED");
  assert.equal(mismatch.youError.details.reason, "authorization-scope-mismatch");

  // expired：过去时刻授权（合法落账）⇒ 拒绝。
  const expiredGrant = await controller.grantAuthorization({
    escalationId: escalation.escalationId,
    scope: escalation.requiredScope,
    expiresAt: "2024-01-01T00:00:00.000Z",
    learningPermission: "aggregate",
  });
  assert.equal(expiredGrant.entry.record.expiresAt, "2024-01-01T00:00:00.000Z");
  const expired = await expectTypedError(() =>
    controller.startArenaRun({ escalationId: escalation.escalationId }),
  );
  assert.equal(expired.youError.code, "YOU_ESCALATION_AUTHORIZATION_REQUIRED");
  assert.equal(expired.youError.details.reason, "authorization-expired");

  // 续期即新记录（最新 grant 为 live；无任何原地改写）。
  const renewed = await controller.grantAuthorization({
    escalationId: escalation.escalationId,
    scope: escalation.requiredScope,
    expiresAt: null,
    learningPermission: "full",
  });
  const ledgerAfterRenewal = (await controller.refresh()).authorizationLedger.filter(
    (entry) => entry.record.escalationId === escalation.escalationId,
  );
  assert.equal(ledgerAfterRenewal.length, 3);
  // 续期不回退阶梯（authorized 停留）。
  assert.equal(renewed.escalation.status, "authorized");
  const started = await controller.startArenaRun({ escalationId: escalation.escalationId });
  assert.equal(started.escalation.status, "in-progress");

  // withdrawn：撤回后 live 门立即拒绝（撤回记录顶替 live grant）。
  const withdrawal = await controller.withdrawAuthorization({
    authorizationId: renewed.entry.record.id,
  });
  assert.equal(withdrawal.kind, "withdrawal");
  assert.equal(withdrawal.supersedesRecordId, renewed.entry.record.id);
  assert.equal(withdrawal.record.learningPermission, "none");
  const withdrawn = await expectTypedError(() =>
    controller.invokeArenaProvider({
      escalationId: escalation.escalationId,
      providerId: "fx-arena-provider-001",
    }),
  );
  assert.equal(withdrawn.youError.code, "YOU_ESCALATION_AUTHORIZATION_REQUIRED");
  assert.equal(withdrawn.youError.details.reason, "authorization-withdrawn");
});

test("authorization ledger: immutable records, withdrawal refusals, learning-permission events", async () => {
  const controller = createSimulatedEscalationStudioController();
  await controller.load({ workspaceKey: "ws" });
  const gap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-005" });
  const { escalation } = await controller.requestEscalation({ gapId: gap.id });

  // grant 形状校验最先：空 scope / 非法 permission / 非法 expiry ⇒ typed 拒绝。
  const emptyScope = await expectTypedError(() =>
    controller.grantAuthorization({
      escalationId: escalation.escalationId,
      scope: " ",
      expiresAt: null,
      learningPermission: "none",
    }),
  );
  assert.equal(emptyScope.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(emptyScope.youError.details.reason, "empty-scope");

  const badPermission = await expectTypedError(() =>
    controller.grantAuthorization({
      escalationId: escalation.escalationId,
      scope: escalation.requiredScope,
      expiresAt: null,
      learningPermission: "sometimes" as never,
    }),
  );
  assert.equal(badPermission.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(badPermission.youError.details.reason, "invalid-learning-permission");

  const badExpiry = await expectTypedError(() =>
    controller.grantAuthorization({
      escalationId: escalation.escalationId,
      scope: escalation.requiredScope,
      expiresAt: "not-a-date",
      learningPermission: "none",
    }),
  );
  assert.equal(badExpiry.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(badExpiry.youError.details.reason, "invalid-expiry");

  const granted = await controller.grantAuthorization({
    escalationId: escalation.escalationId,
    scope: escalation.requiredScope,
    expiresAt: null,
    learningPermission: "none",
  });
  // 撤回的撤回：withdrawal 记录不可再撤。
  const withdrawal = await controller.withdrawAuthorization({
    authorizationId: granted.entry.record.id,
  });
  const withdrawWithdrawal = await expectTypedError(() =>
    controller.withdrawAuthorization({ authorizationId: withdrawal.record.id }),
  );
  assert.equal(withdrawWithdrawal.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(withdrawWithdrawal.youError.details.reason, "withdrawal-of-withdrawal");

  // 已撤回的 grant 再撤 ⇒ typed 拒绝。
  const doubleWithdraw = await expectTypedError(() =>
    controller.withdrawAuthorization({ authorizationId: granted.entry.record.id }),
  );
  assert.equal(doubleWithdraw.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(doubleWithdraw.youError.details.reason, "already-withdrawn");

  // 未知授权 id ⇒ YOU_ESCALATION_NOT_FOUND。
  const unknownAuth = await expectTypedError(() =>
    controller.withdrawAuthorization({ authorizationId: "fx-auth-999" }),
  );
  assert.equal(unknownAuth.youError.code, "YOU_ESCALATION_NOT_FOUND");

  // learning-permission-recorded 双路径（grant 与 withdrawal 各一条，后者带标记）。
  const snapshot = await controller.refresh();
  const permissionEvents = snapshot.events.filter(
    (event) => event.type === "learning-permission-recorded",
  );
  assert.equal(permissionEvents.length, 2);
  assert.equal(permissionEvents[0]?.payload.permission, "none");
  assert.equal(permissionEvents[0]?.payload.withdrawal, false);
  assert.equal(permissionEvents[1]?.payload.permission, "none");
  assert.equal(permissionEvents[1]?.payload.withdrawal, true);
  assert.equal(permissionEvents[1]?.payload.supersedesAuthorizationId, granted.entry.record.id);

  // 撤回后 live 投影：withdrawn=true 且有效许可为 none。
  const live = snapshot.liveAuthorizations.find(
    (entry) => entry.escalationId === escalation.escalationId,
  );
  assert.equal(live?.withdrawn, true);
  assert.equal(live?.learningPermission, "none");

  // 撤回后重授予：新 grant 记录，live 恢复。
  const regranted = await controller.grantAuthorization({
    escalationId: escalation.escalationId,
    scope: escalation.requiredScope,
    expiresAt: null,
    learningPermission: "aggregate",
  });
  assert.equal(regranted.entry.kind, "grant");
  const liveAfter = (await controller.refresh()).liveAuthorizations.find(
    (entry) => entry.escalationId === escalation.escalationId,
  );
  assert.equal(liveAfter?.withdrawn, false);
  assert.equal(liveAfter?.learningPermission, "aggregate");
  assert.equal(liveAfter?.record?.id, regranted.entry.record.id);
});

test("run ladder: append-only attempts, terminal locks, unknown run, retry exhaustion", async () => {
  const controller = createSimulatedEscalationStudioController();
  await controller.load({ workspaceKey: "ws" });
  const gap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-001" });
  const { escalation } = await controller.requestEscalation({ gapId: gap.id });
  await controller.grantAuthorization({
    escalationId: escalation.escalationId,
    scope: escalation.requiredScope,
    expiresAt: null,
    learningPermission: "aggregate",
  });

  // 未知 run ⇒ YOU_ARENA_RUN_NOT_FOUND。
  const unknownRun = await expectTypedError(() =>
    controller.completeArenaRun({ runId: "fx-run-999", outcome: "failed" }),
  );
  assert.equal(unknownRun.youError.code, "YOU_ARENA_RUN_NOT_FOUND");

  // 三次尝试全部失败（maxAttempts=3）；第四次 ⇒ 重试阶梯耗尽（typed 拒绝）。
  const first = await controller.startArenaRun({ escalationId: escalation.escalationId });
  assert.equal(first.run.attempt, 1);
  await controller.completeArenaRun({ runId: first.run.id, outcome: "failed" });
  const second = await controller.startArenaRun({ escalationId: escalation.escalationId });
  assert.equal(second.run.attempt, 2);
  await controller.completeArenaRun({ runId: second.run.id, outcome: "failed" });
  const third = await controller.startArenaRun({ escalationId: escalation.escalationId });
  assert.equal(third.run.attempt, 3);
  await controller.completeArenaRun({ runId: third.run.id, outcome: "failed" });
  const exhausted = await expectTypedError(() =>
    controller.startArenaRun({ escalationId: escalation.escalationId }),
  );
  assert.equal(exhausted.youError.code, "YOU_RETRY_POLICY_INVALID");
  assert.equal(exhausted.youError.details.reason, "retry-ladder-exhausted");

  // 终态锁定：完成记录不可再迁移。
  const terminalLock = await expectTypedError(() =>
    controller.completeArenaRun({ runId: first.run.id, outcome: "completed" }),
  );
  assert.equal(terminalLock.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(terminalLock.youError.details.reason, "run-terminal-locked");

  // 阶梯 append-only：三条 run 记录（attempt 1..3，全部 failed 终态）。
  const snapshot = await controller.refresh();
  const runs = snapshot.runs.filter((run) => run.gapId === gap.id);
  assert.equal(runs.length, 3);
  assert.deepEqual(
    runs.map((run) => run.status),
    ["failed", "failed", "failed"],
  );
  assert.ok(runs.every((run) => run.completedAt !== null));
  // 失败 run 不带 outcome evidence；完成 run 带（内容寻址标签）。
  assert.ok(runs.every((run) => run.outcomeEvidenceRef === null));
  // 每次 run 迁移都落 arena-run-recorded（启动×3 + 完成×3 = 6 条）。
  const runEvents = snapshot.events.filter(
    (event) => event.type === "arena-run-recorded" && event.payload.gapId === gap.id,
  );
  assert.equal(runEvents.length, 6);
});

test("provider-neutral seam: unknown providers fail closed; delivery completes the active run", async () => {
  const controller = createSimulatedEscalationStudioController();
  await controller.load({ workspaceKey: "ws" });
  const gap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-001" });
  const { escalation } = await controller.requestEscalation({ gapId: gap.id });
  await controller.grantAuthorization({
    escalationId: escalation.escalationId,
    scope: escalation.requiredScope,
    expiresAt: null,
    learningPermission: "aggregate",
  });
  await controller.startArenaRun({ escalationId: escalation.escalationId });

  // fail closed：未知 provider ⇒ YOU_ARENA_ADAPTER_UNSUPPORTED（绝不静默回退）。
  const unsupported = await expectTypedError(() =>
    controller.invokeArenaProvider({
      escalationId: escalation.escalationId,
      providerId: "fx-arena-provider-999",
    }),
  );
  assert.equal(unsupported.youError.code, "YOU_ARENA_ADAPTER_UNSUPPORTED");
  assert.equal(unsupported.youError.details.reason, "unknown-arena-provider");

  // 合法调用：typed 结果返回 + 活跃 run completed + 阶梯 delivered。
  const delivered = await controller.invokeArenaProvider({
    escalationId: escalation.escalationId,
    providerId: "fx-arena-provider-001",
  });
  assert.equal(delivered.escalation.status, "delivered");
  assert.equal(delivered.run.status, "completed");
  assert.ok(delivered.run.outcomeEvidenceRef?.startsWith("fx-content-"));
  assert.equal(delivered.result.resultType, "typed-payload");
  assert.ok(Object.keys(delivered.result.payload).includes("replacementTool"));

  // artifact 类别（EXPERT_GAP）走内容寻址标签。
  const expertGap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-007" });
  const expertEscalation = await controller.requestEscalation({ gapId: expertGap.id });
  await controller.grantAuthorization({
    escalationId: expertEscalation.escalation.escalationId,
    scope: expertEscalation.escalation.requiredScope,
    expiresAt: null,
    learningPermission: "full",
  });
  await controller.startArenaRun({ escalationId: expertEscalation.escalation.escalationId });
  const artifact = await controller.invokeArenaProvider({
    escalationId: expertEscalation.escalation.escalationId,
    providerId: "fx-arena-provider-001",
  });
  assert.equal(artifact.result.resultType, "artifact");
  assert.ok(String(artifact.result.payload.artifactRef).startsWith("fx-content-"));
  assert.ok(String(artifact.result.payload.artifactHash).startsWith("sha256-fixture-"));

  // 无活跃 run 时调用 ⇒ typed 拒绝（in-progress 但活跃 run 已 failed 终态）。
  const knowledgeGap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-005" });
  const knowledgeEscalation = await controller.requestEscalation({ gapId: knowledgeGap.id });
  await controller.grantAuthorization({
    escalationId: knowledgeEscalation.escalation.escalationId,
    scope: knowledgeEscalation.escalation.requiredScope,
    expiresAt: null,
    learningPermission: "none",
  });
  const knowledgeRun = await controller.startArenaRun({
    escalationId: knowledgeEscalation.escalation.escalationId,
  });
  await controller.completeArenaRun({ runId: knowledgeRun.run.id, outcome: "failed" });
  const noRun = await expectTypedError(() =>
    controller.invokeArenaProvider({
      escalationId: knowledgeEscalation.escalation.escalationId,
      providerId: "fx-arena-provider-001",
    }),
  );
  assert.equal(noRun.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(noRun.youError.details.reason, "no-active-run");
});

test("gap projections: tool and knowledge publish + malformed requests typed-refused", async () => {
  const controller = createSimulatedEscalationStudioController();
  await controller.load({ workspaceKey: "ws" });
  const gap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-001" });

  const tool = await controller.publishGapProjection({ gapId: gap.id, kind: "tool" });
  assert.equal(tool.kind, "tool");
  assert.ok(tool.tool?.toolId?.startsWith("fx-content-"));
  assert.equal(tool.tool?.requiredCapability, gap.suggestedNextAction);

  const knowledge = await controller.publishGapProjection({ gapId: gap.id, kind: "knowledge" });
  assert.equal(knowledge.kind, "knowledge");
  assert.equal(knowledge.knowledge?.domain, "tool-operations");
  assert.ok(knowledge.knowledge?.missingKnowledgeRef?.startsWith("fx-content-"));

  // gap-projection-published 事件落账 ×2。
  const snapshot = await controller.refresh();
  const projectionEvents = snapshot.events.filter(
    (event) => event.type === "gap-projection-published",
  );
  assert.equal(projectionEvents.length, 2);

  // malformed：未知投影类型 / 未知 gap ⇒ YOU_GAP_PROJECTION_INVALID。
  const badKind = await expectTypedError(() =>
    controller.publishGapProjection({ gapId: gap.id, kind: "process" as never }),
  );
  assert.equal(badKind.youError.code, "YOU_GAP_PROJECTION_INVALID");
  assert.equal(badKind.youError.details.reason, "unknown-projection-kind");

  const badGap = await expectTypedError(() =>
    controller.publishGapProjection({ gapId: "fx-gap-999", kind: "tool" }),
  );
  assert.equal(badGap.youError.code, "YOU_GAP_PROJECTION_INVALID");
  assert.equal(badGap.youError.details.reason, "unknown-gap-record");
});

test("retry policy validator: valid drafts pass, every violation reason typed-refused", async () => {
  const controller = createSimulatedEscalationStudioController();
  await controller.load({ workspaceKey: "ws" });
  const eventsBefore = (await controller.refresh()).events.length;
  const valid = await controller.validateRetryPolicy({
    maxAttempts: 5,
    backoffClass: "exponential",
    eligibilityCategories: ["TOOL_GAP", "EXPERT_GAP"],
    requiresAuthorization: false,
  });
  assert.deepEqual(valid, {
    maxAttempts: 5,
    backoffClass: "exponential",
    eligibilityCategories: ["TOOL_GAP", "EXPERT_GAP"],
    requiresAuthorization: false,
  });

  const cases: readonly [string, Record<string, unknown>, string][] = [
    [
      "invalid-max-attempts",
      { maxAttempts: 0, backoffClass: "exponential", eligibilityCategories: ["TOOL_GAP"], requiresAuthorization: true },
      "YOU_RETRY_POLICY_INVALID",
    ],
    [
      "invalid-backoff-class",
      { maxAttempts: 3, backoffClass: "aggressive", eligibilityCategories: ["TOOL_GAP"], requiresAuthorization: true },
      "YOU_RETRY_POLICY_INVALID",
    ],
    [
      "invalid-eligibility-categories",
      { maxAttempts: 3, backoffClass: "exponential", eligibilityCategories: [], requiresAuthorization: true },
      "YOU_RETRY_POLICY_INVALID",
    ],
  ];
  for (const [reason, draft] of cases) {
    const error = await expectTypedError(() =>
      controller.validateRetryPolicy(draft as never),
    );
    assert.equal(error.youError.code, "YOU_RETRY_POLICY_INVALID");
    assert.equal(error.youError.details.reason, reason);
  }
  // 校验是纯接缝：不落账任何事件（快照事件数不变）。
  const snapshot = await controller.refresh();
  assert.equal(snapshot.events.length, eventsBefore);
});

test("cancel closes a started run as aborted and journals escalation-cancelled", async () => {
  const controller = createSimulatedEscalationStudioController();
  await controller.load({ workspaceKey: "ws" });
  const gap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-005" });
  const { escalation } = await controller.requestEscalation({ gapId: gap.id });
  await controller.grantAuthorization({
    escalationId: escalation.escalationId,
    scope: escalation.requiredScope,
    expiresAt: null,
    learningPermission: "none",
  });
  const started = await controller.startArenaRun({ escalationId: escalation.escalationId });
  const cancelled = await controller.cancelEscalation({ escalationId: escalation.escalationId });
  assert.equal(cancelled.escalation.status, "cancelled");

  const snapshot = await controller.refresh();
  const run = snapshot.runs.find((entry) => entry.id === started.run.id);
  assert.equal(run?.status, "aborted");
  assert.ok(run?.completedAt);
  const cancelledEvent = snapshot.events.find(
    (event) => event.type === "escalation-cancelled",
  );
  assert.equal(cancelledEvent?.payload.statusAfter, "cancelled");
  const abortedEvent = snapshot.events.find(
    (event) => event.type === "arena-run-recorded" && event.payload.statusAfter === "aborted",
  );
  assert.ok(abortedEvent);

  // 终态上的授权申请 ⇒ typed 拒绝（cancelled 无需授权）。
  const grantOnCancelled = await expectTypedError(() =>
    controller.grantAuthorization({
      escalationId: escalation.escalationId,
      scope: escalation.requiredScope,
      expiresAt: null,
      learningPermission: "aggregate",
    }),
  );
  assert.equal(grantOnCancelled.youError.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(grantOnCancelled.youError.details.reason, "grant-on-closed-escalation");
});

test("determinism: two fresh controllers replayed through the same operations produce identical snapshots", async () => {
  const runScript = async (controller: EscalationStudioController) => {
    await controller.load({ workspaceKey: "determinism" });
    const gapA = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-001" });
    const gapB = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-007" });
    const escalationA = await controller.requestEscalation({ gapId: gapA.id });
    await controller.grantAuthorization({
      escalationId: escalationA.escalation.escalationId,
      scope: escalationA.escalation.requiredScope,
      expiresAt: null,
      learningPermission: "aggregate",
    });
    await controller.startArenaRun({ escalationId: escalationA.escalation.escalationId });
    await controller.invokeArenaProvider({
      escalationId: escalationA.escalation.escalationId,
      providerId: "fx-arena-provider-001",
    });
    await controller.applyExpertResult({ escalationId: escalationA.escalation.escalationId });
    const escalationB = await controller.requestEscalation({ gapId: gapB.id });
    await controller.grantAuthorization({
      escalationId: escalationB.escalation.escalationId,
      scope: escalationB.escalation.requiredScope,
      expiresAt: null,
      learningPermission: "none",
    });
    await controller.startArenaRun({ escalationId: escalationB.escalation.escalationId });
    await controller.publishGapProjection({ gapId: gapA.id, kind: "tool" });
    await controller.publishGapProjection({ gapId: gapB.id, kind: "knowledge" });
    return controller.refresh();
  };
  const left = await runScript(createSimulatedEscalationStudioController());
  const right = await runScript(createSimulatedEscalationStudioController());
  assert.equal(JSON.stringify(left), JSON.stringify(right));
});

test("per-workspace registry instances are independent and reusable", async () => {
  resetEscalationStudioRegistryForTests();
  const first = acquireEscalationStudio("ws-a");
  const firstAgain = acquireEscalationStudio("ws-a");
  assert.equal(first, firstAgain);
  const second = acquireEscalationStudio("ws-b");
  assert.notEqual(first, second);
  await first.controller.load({ workspaceKey: "ws-a" });
  await first.controller.openCapabilityGap({ gapSpecId: "fx-gapspec-001" });
  // 独立实例：ws-b 平面不受 ws-a 操作影响。
  const secondSnapshot = await second.controller.load({ workspaceKey: "ws-b" });
  assert.equal(secondSnapshot.gaps.length, 0);
  const firstSnapshot = await first.controller.refresh();
  assert.equal(firstSnapshot.gaps.length, 1);
  resetEscalationStudioRegistryForTests();
});
