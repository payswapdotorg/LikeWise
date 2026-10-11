// W5B logic tests — 确定性模拟控制器（node:test，无 DOM）。
//
// 覆盖：session 生命周期（open → committed | abandoned；终态锁定；未知 id typed
// 拒绝）、editor 注册面（YOU_EDITOR_UNSUPPORTED）、change-set 校验（YOU_CHANGESET_INVALID：
// 空 op 列表 / 空 kind / 缺 payload 寻址）、候选应用与谱系（parent → candidate
// append-only；候选可作 parent）、候选解决恰一次（v1 change-accepted / change-rejected
// 事件纪律）、Tier-4 交换（格式支持矩阵 / 确定性导出 / round-trip 恒等 / 损坏导入
// failed 结果入账 + typed 拒绝）、external launch 与 manual takeover 的同意门
//（YOU_CONSENT_REQUIRED）、快照只读性、事件词汇、字节一致重放（FIXTURES 法则）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedEditingStudioController } from "./editingSimulatedController.js";
import { EditingStudioError, type EditingStudioController } from "./editingController.js";
import { buildStoryboardEditOp } from "./editingStoryboard.js";

async function newLoadedController(): Promise<EditingStudioController> {
  const controller = createSimulatedEditingStudioController();
  await controller.load({ workspaceKey: "test-workspace" });
  return controller;
}

async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<EditingStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof EditingStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("test: expected a typed EditingStudioError");
}

test("load is idempotent (one plane per controller) and the snapshot is simulated", async () => {
  const controller = await newLoadedController();
  const first = await controller.refresh();
  const second = await controller.load({ workspaceKey: "test-workspace" });
  assert.equal(second.studioId, first.studioId);
  assert.equal(second.simulated, true);
  assert.equal(second.subjects.length, 2);
  assert.equal(second.editorProfiles.length, 3);
  // subject 内容寻址（contentRef + contentHash；绝不内联）。
  for (const subject of second.subjects) {
    assert.ok(subject.contentRef.startsWith("fx-content-"));
    assert.ok(subject.contentHash.startsWith("sha256-fixture-"));
  }
  // EditorKind 分类学三成员齐全（native / embedded / external）。
  assert.deepEqual(
    second.editorProfiles.map((profile) => profile.editorKind),
    ["native", "embedded", "external"],
  );
});

test("session lifecycle: open -> committed | abandoned with terminals locked", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });
  assert.equal(session.status, "open");

  // 终态迁移合法：open → committed。
  const committed = await controller.commitSession({ sessionId: session.id });
  assert.equal(committed.status, "committed");
  assert.equal(committed.id, session.id);

  // 终态锁定：committed 再迁移（commit/abandon）都是 typed 拒绝。
  const againError = await expectTypedError(() =>
    controller.commitSession({ sessionId: session.id }),
  );
  assert.equal(againError.youError.code, "YOU_INVALID_STATE");
  const abandonError = await expectTypedError(() =>
    controller.abandonSession({ sessionId: session.id }),
  );
  assert.equal(abandonError.youError.code, "YOU_INVALID_STATE");
  // 拒绝不落账：状态保持 committed（append-only；拒绝无副作用）。
  const refreshed = await controller.refresh();
  assert.equal(refreshed.sessions[0]!.status, "committed");

  // 第二会话走 abandoned 终态。
  const second = await controller.openSession({
    subjectArtifactId: snapshot.subjects[1]!.id,
    editorKind: "embedded",
  });
  const abandoned = await controller.abandonSession({ sessionId: second.id });
  assert.equal(abandoned.status, "abandoned");
});

test("unknown session ids are typed YOU_EDIT_SESSION_NOT_FOUND refusals", async () => {
  const controller = await newLoadedController();
  const error = await expectTypedError(() =>
    controller.commitSession({ sessionId: "fx-editsession-999" }),
  );
  assert.equal(error.youError.code, "YOU_EDIT_SESSION_NOT_FOUND");
  assert.equal(error.youError.details["editingSessionId"], "fx-editsession-999");
});

test("unregistered editor kinds are typed YOU_EDITOR_UNSUPPORTED (never a silent fallback)", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const error = await expectTypedError(() =>
    controller.openSession({
      subjectArtifactId: snapshot.subjects[0]!.id,
      editorKind: "hologram-suite" as never,
    }),
  );
  assert.equal(error.youError.code, "YOU_EDITOR_UNSUPPORTED");
  assert.equal(error.youError.details["editorKind"], "hologram-suite");
});

test("unknown subjects are typed refusals on session open", async () => {
  const controller = await newLoadedController();
  const error = await expectTypedError(() =>
    controller.openSession({ subjectArtifactId: "fx-editsubject-999", editorKind: "native" }),
  );
  assert.equal(error.youError.code, "YOU_INVALID_STATE");
});

test("change-set validation: empty op list, empty kind and missing payload addressing are typed refusals", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });

  // 空 op 列表。
  const emptyError = await expectTypedError(() =>
    controller.proposeChangeSet({ sessionId: session.id, ops: [] }),
  );
  assert.equal(emptyError.youError.code, "YOU_CHANGESET_INVALID");
  assert.equal(emptyError.youError.details["reason"], "empty-op-list");

  // 空 kind。
  const emptyKindError = await expectTypedError(() =>
    controller.proposeChangeSet({
      sessionId: session.id,
      ops: [{ ...buildStoryboardEditOp("transform", "x-1"), kind: "  " }],
    }),
  );
  assert.equal(emptyKindError.youError.code, "YOU_CHANGESET_INVALID");
  assert.equal(emptyKindError.youError.details["reason"], "empty-op-kind");

  // 缺 payload 寻址。
  const payloadError = await expectTypedError(() =>
    controller.proposeChangeSet({
      sessionId: session.id,
      ops: [{ ...buildStoryboardEditOp("transform", "x-2"), payloadRef: "" }],
    }),
  );
  assert.equal(payloadError.youError.code, "YOU_CHANGESET_INVALID");
  assert.equal(payloadError.youError.details["reason"], "missing-payload-addressing");

  // 校验拒绝不落账。
  const refreshed = await controller.refresh();
  assert.equal(refreshed.changeSets.length, 0);
});

test("proposal requires an open session (terminal sessions refuse new change sets)", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });
  await controller.commitSession({ sessionId: session.id });
  const error = await expectTypedError(() =>
    controller.proposeChangeSet({
      sessionId: session.id,
      ops: [buildStoryboardEditOp("transform", "y-1")],
    }),
  );
  assert.equal(error.youError.code, "YOU_INVALID_STATE");
});

test("apply produces an immutable content-addressed candidate and registers the lineage", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });
  const changeSet = await controller.proposeChangeSet({
    sessionId: session.id,
    ops: [buildStoryboardEditOp("transform", "a-1"), buildStoryboardEditOp("material", "a-2")],
  });
  const candidate = await controller.applyChangeSet({
    changeSetId: changeSet.id,
    parentVersionId: snapshot.subjects[0]!.id,
  });
  assert.equal(candidate.parentVersionId, snapshot.subjects[0]!.id);
  assert.equal(candidate.changeSetId, changeSet.id);
  assert.ok(candidate.contentRef.startsWith("fx-content-"));
  assert.ok(candidate.contentHash.startsWith("sha256-fixture-"));
  assert.equal(candidate.simulated, true);

  // 候选可作 parent（嵌套谱系）。
  const nestedChangeSet = await controller.proposeChangeSet({
    sessionId: session.id,
    ops: [buildStoryboardEditOp("geometry", "b-1")],
  });
  const nested = await controller.applyChangeSet({
    changeSetId: nestedChangeSet.id,
    parentVersionId: candidate.id,
  });
  assert.equal(nested.parentVersionId, candidate.id);

  // 未知 parent ⇒ typed 拒绝。
  const parentError = await expectTypedError(() =>
    controller.applyChangeSet({
      changeSetId: nestedChangeSet.id,
      parentVersionId: "fx-unknown-parent",
    }),
  );
  assert.equal(parentError.youError.code, "YOU_INVALID_STATE");
});

test("candidate preview is a pure deterministic projection (same inputs, same digest)", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const ops = [buildStoryboardEditOp("transform", "p-1")];
  const first = await controller.previewCandidate({
    parentVersionId: snapshot.subjects[0]!.id,
    ops,
  });
  const second = await controller.previewCandidate({
    parentVersionId: snapshot.subjects[0]!.id,
    ops,
  });
  assert.equal(first.previewDigest, second.previewDigest);
  assert.equal(first.parentContentHash, snapshot.subjects[0]!.contentHash);
  assert.deepEqual(
    first.opRows.map((row) => row.kind),
    ["transform"],
  );
  // 预览不落账：无候选、无事件追加。
  const after = await controller.refresh();
  assert.equal(after.candidates.length, 0);
  assert.equal(after.events.length, snapshot.events.length);
  // 不同 parent → 不同 digest（内容派生）。
  const otherParent = await controller.previewCandidate({
    parentVersionId: snapshot.subjects[1]!.id,
    ops,
  });
  assert.notEqual(first.previewDigest, otherParent.previewDigest);
});

test("candidate resolution is exactly-once and routes through the v1 change-accepted / change-rejected events", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });
  const changeSet = await controller.proposeChangeSet({
    sessionId: session.id,
    ops: [buildStoryboardEditOp("transform", "r-1")],
  });
  const candidate = await controller.applyChangeSet({
    changeSetId: changeSet.id,
    parentVersionId: snapshot.subjects[0]!.id,
  });

  const accepted = await controller.resolveCandidate({
    candidateId: candidate.id,
    outcome: "accepted",
    reason: "test: accepted",
  });
  assert.equal(accepted.outcome, "accepted");
  assert.equal(accepted.candidate.id, candidate.id);

  // 恰一次：再次解决（含反向）typed 拒绝。
  const twiceError = await expectTypedError(() =>
    controller.resolveCandidate({
      candidateId: candidate.id,
      outcome: "rejected",
      reason: "test: rejected attempt",
    }),
  );
  assert.equal(twiceError.youError.code, "YOU_INVALID_STATE");

  // v1 事件恰各一条（append-only；无第二条权威路径）。
  const events = (await controller.refresh()).events.filter(
    (event) => event.type === "change-accepted" || event.type === "change-rejected",
  );
  assert.deepEqual(
    events.map((event) => event.type),
    ["change-accepted"],
  );
  assert.equal(events[0]!.subjectRef, candidate.id);
});

test("tier-4 export: unsupported formats and editor-format mismatches are typed refusals", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });

  // 引擎不支持的 format。
  const formatError = await expectTypedError(() =>
    controller.exportFromSession({ sessionId: session.id, format: "obj-fbx" as never }),
  );
  assert.equal(formatError.youError.code, "YOU_IMPORT_EXPORT_FAILED");
  assert.equal(formatError.youError.details["reason"], "unsupported-format");

  // editor profile 不支持的 format（embedded 不支持 scene-package）。
  const embeddedSession = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "embedded",
  });
  const mismatchError = await expectTypedError(() =>
    controller.exportFromSession({ sessionId: embeddedSession.id, format: "scene-package" }),
  );
  assert.equal(mismatchError.youError.code, "YOU_IMPORT_EXPORT_FAILED");
  assert.equal(mismatchError.youError.details["reason"], "editor-format-unsupported");
});

test("tier-4 round trip: the same session state exports byte-identical packages; import digests match", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });
  const first = await controller.exportFromSession({
    sessionId: session.id,
    format: "edit-interchange",
  });
  const second = await controller.exportFromSession({
    sessionId: session.id,
    format: "edit-interchange",
  });
  // 确定性组装：同状态 ⇒ 同字节。
  assert.deepEqual(first.packageBytes, second.packageBytes);
  assert.equal(first.packageDigest, second.packageDigest);

  // 导入导出字节：round-trip 恒等。
  const imported = await controller.importEditPackage({
    bytes: first.packageBytes,
    format: "edit-interchange",
    sessionId: session.id,
  });
  assert.equal(imported.result.status, "succeeded");
  assert.equal(imported.packageDigest, first.packageDigest);
  assert.ok(imported.result.contentRef!.startsWith("fx-content-"));
});

test("tier-4 import: corrupt bytes journal a failed result and refuse typed", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });
  const before = await controller.refresh();
  const error = await expectTypedError(() =>
    controller.importEditPackage({
      bytes: new TextEncoder().encode("not-a-you-interchange-package"),
      format: "edit-interchange",
      sessionId: session.id,
    }),
  );
  assert.equal(error.youError.code, "YOU_IMPORT_EXPORT_FAILED");
  // failed 结果诚实入账（truth law：失败也是事实）。
  const after = await controller.refresh();
  assert.equal(after.importExports.length, before.importExports.length + 1);
  const failedResult = after.importExports.at(-1)!;
  assert.equal(failedResult.status, "failed");
  assert.equal(failedResult.contentRef, null);
  assert.equal(error.youError.details["recordedResultId"], failedResult.id);
});

test("tier-4 import: session-bound manifest mismatch refuses typed (never silently rebound)", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  // 会话 A（subject 1）导出的包，导入绑定到会话 B（subject 2）⇒ manifest 不匹配。
  const sessionA = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });
  const sessionB = await controller.openSession({
    subjectArtifactId: snapshot.subjects[1]!.id,
    editorKind: "native",
  });
  const exportOutcome = await controller.exportFromSession({
    sessionId: sessionA.id,
    format: "edit-interchange",
  });
  const error = await expectTypedError(() =>
    controller.importEditPackage({
      bytes: exportOutcome.packageBytes,
      format: "edit-interchange",
      sessionId: sessionB.id,
    }),
  );
  assert.equal(error.youError.code, "YOU_IMPORT_EXPORT_FAILED");
  assert.equal(error.youError.details["reason"], "invalid-package");
});

test("external editor launch is consent-gated and projected (no process control in the port)", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "external",
  });

  // 无许可 ⇒ 不处理（服务端式强制）。
  const gateError = await expectTypedError(() =>
    controller.requestExternalEditorLaunch({ sessionId: session.id }),
  );
  assert.equal(gateError.youError.code, "YOU_CONSENT_REQUIRED");

  // 授予 export 用途同意后：投射 launch 意图 + 携带 Tier-4 导出包。
  await controller.decideConsent({
    policyId: snapshot.consent.policy.id,
    purpose: "export",
    decision: "grant",
  });
  const launch = await controller.requestExternalEditorLaunch({ sessionId: session.id });
  assert.equal(launch.sessionId, session.id);
  assert.equal(launch.editorKind, "external");
  assert.ok(launch.launchId.startsWith("fx-editlaunch-"));
  // 意图携带的交换包真实入账（内容寻址结果存在）。
  const refreshed = await controller.refresh();
  const packageResult = refreshed.importExports.find(
    (result) => result.id === launch.packageResultId,
  );
  assert.ok(packageResult);
  assert.equal(packageResult.status, "succeeded");
  // 撤回后再次请求：再次阻断（withdrawn ⇒ 不处理）。
  await controller.withdrawConsent({ policyId: snapshot.consent.policy.id });
  const withdrawnError = await expectTypedError(() =>
    controller.requestExternalEditorLaunch({ sessionId: session.id }),
  );
  assert.equal(withdrawnError.youError.code, "YOU_CONSENT_REQUIRED");
  assert.equal(withdrawnError.youError.details["consentState"], "withdrawn");
});

test("manual takeover confirmation is consent-gated and append-only", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });

  // 无许可 ⇒ 拒绝（不隐藏）。
  const gateError = await expectTypedError(() =>
    controller.requestTakeoverConfirmation({ sessionId: session.id }),
  );
  assert.equal(gateError.youError.code, "YOU_CONSENT_REQUIRED");

  // 授予 manual-takeover 用途同意后确认成功。
  await controller.decideConsent({
    policyId: snapshot.consent.policy.id,
    purpose: "manual-takeover",
    decision: "grant",
  });
  const takeover = await controller.requestTakeoverConfirmation({ sessionId: session.id });
  assert.equal(takeover.sessionId, session.id);
  assert.equal(takeover.subjectArtifactId, session.subjectArtifactId);

  const refreshed = await controller.refresh();
  assert.equal(refreshed.takeovers.length, 1);
  // 撤回后：再次确认被阻断（许可不可回滚已发生的确认，但阻止新的）。
  await controller.withdrawConsent({ policyId: snapshot.consent.policy.id });
  const blocked = await expectTypedError(() =>
    controller.requestTakeoverConfirmation({ sessionId: session.id }),
  );
  assert.equal(blocked.youError.code, "YOU_CONSENT_REQUIRED");
  assert.equal(refreshed.takeovers.length, 1);
});

test("the event ledger covers the frozen editing vocabulary (append-only)", async () => {
  const controller = await newLoadedController();
  const snapshot = await controller.refresh();
  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });
  const changeSet = await controller.proposeChangeSet({
    sessionId: session.id,
    ops: [buildStoryboardEditOp("transform", "v-1")],
  });
  const candidate = await controller.applyChangeSet({
    changeSetId: changeSet.id,
    parentVersionId: snapshot.subjects[0]!.id,
  });
  await controller.resolveCandidate({
    candidateId: candidate.id,
    outcome: "accepted",
    reason: "test",
  });
  await controller.commitSession({ sessionId: session.id });

  const types = (await controller.refresh()).events.map((event) => event.type);
  assert.ok(types.includes("edit-session-opened"));
  assert.ok(types.includes("change-proposed"));
  assert.ok(types.includes("change-set-applied"));
  assert.ok(types.includes("candidate-version-proposed"));
  assert.ok(types.includes("change-accepted"));
  assert.ok(types.includes("edit-session-closed"));
  // append-only：事件只增不减（replay 覆盖于 determinism 测试）。
  const beforeCount = types.length;
  const beforeIds = (await controller.refresh()).events.map((event) => event.id);
  await controller.openSession({
    subjectArtifactId: snapshot.subjects[1]!.id,
    editorKind: "embedded",
  });
  const after = (await controller.refresh()).events;
  assert.equal(after.length, beforeCount + 1); // edit-session-opened
  // 既有事件 id/序保持不变（append-only：只追加，不重排）。
  assert.deepEqual(
    after.slice(0, beforeCount).map((event) => event.id),
    beforeIds,
  );
});

test("determinism: two fresh controllers replay the same scripted flow byte-identically", async () => {
  async function scripted(controller: EditingStudioController) {
    const snapshot = await controller.load({ workspaceKey: "det-test" });
    const session = await controller.openSession({
      subjectArtifactId: snapshot.subjects[0]!.id,
      editorKind: "native",
    });
    const changeSet = await controller.proposeChangeSet({
      sessionId: session.id,
      ops: [buildStoryboardEditOp("transform", "d-1"), buildStoryboardEditOp("annotation", "d-2")],
    });
    const candidate = await controller.applyChangeSet({
      changeSetId: changeSet.id,
      parentVersionId: snapshot.subjects[0]!.id,
    });
    await controller.resolveCandidate({
      candidateId: candidate.id,
      outcome: "rejected",
      reason: "det-test",
    });
    const exportOutcome = await controller.exportFromSession({
      sessionId: session.id,
      format: "json",
    });
    await controller.importEditPackage({
      bytes: exportOutcome.packageBytes,
      format: "json",
      sessionId: session.id,
    });
    await controller.decideConsent({
      policyId: snapshot.consent.policy.id,
      purpose: "manual-takeover",
      decision: "grant",
    });
    await controller.requestTakeoverConfirmation({ sessionId: session.id });
    await controller.commitSession({ sessionId: session.id });
    return await controller.refresh();
  }

  const first = await scripted(createSimulatedEditingStudioController());
  const second = await scripted(createSimulatedEditingStudioController());
  // 字节一致（FIXTURES 法则 2/8：golden 期望——同一剧本同一输出）。
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
