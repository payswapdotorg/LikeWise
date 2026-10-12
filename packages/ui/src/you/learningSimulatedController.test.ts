// W6B logic tests — 确定性模拟控制器（node:test，无 DOM）。
//
// 覆盖：signal 捕获校验（YOU_LEARNING_SIGNAL_INVALID：未知 kind / 未知 scope /
// 空 evidence / 非法 evidence 引用）、内容合成、rights 签发即强制
//（YOU_LEARNING_RIGHTS_REQUIRED：consent-unknown / 撤回后 consent-withdrawn）、
// 记录阶梯（candidate → validated | rejected；终态锁定；supersession 链接；
// 未知记录 YOU_LEARNING_RECORD_NOT_FOUND）、惰性记录（rights-inert）、授予外使用
//（usage-not-granted）、偏好（派生 lineage / 范围法则 YOU_PREFERENCE_SCOPE_INVALID /
// operator 种子与清除投射意图 / 派生清除 typed 拒绝）、trajectory（合成/记录/
// 字节一致重放 + 同摘要）、快照只读性（simulated + 内容寻址）、事件词汇、
// 字节一致重放（FIXTURES 法则：JSON.stringify 恒等）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedLearningStudioController } from "./learningSimulatedController.js";
import {
  LearningStudioError,
  type LearningStudioController,
} from "./learningController.js";
import type { LearningRecord, LearningSignal } from "@zcode/shared";

async function newLoadedController(): Promise<LearningStudioController> {
  const controller = createSimulatedLearningStudioController();
  await controller.load({ workspaceKey: "test-workspace" });
  return controller;
}

async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<LearningStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof LearningStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("test: expected a typed LearningStudioError");
}

const FEEDBACK_EVIDENCE = ["fx-content-feedback-ref-a", "fx-content-feedback-ref-b"];

async function captureFeedbackSignal(
  controller: LearningStudioController,
): Promise<LearningSignal> {
  return controller.captureSignal({
    kind: "feedback",
    scope: "USER",
    subjectRef: "fx-learnevidence-001",
    evidenceRefs: FEEDBACK_EVIDENCE,
  });
}

async function validatedFeedbackRecord(
  controller: LearningStudioController,
): Promise<{ record: LearningRecord; superseded: LearningRecord | null }> {
  const signal = await captureFeedbackSignal(controller);
  const content = await controller.synthesizeLearningContent({
    seedText: "test-content-feedback",
  });
  await controller.decideConsent({
    policyId: "fx-learning-consent-001",
    purpose: "learning",
    decision: "grant",
  });
  const rights = await controller.issueRights({
    usage: ["personalization", "tool-selection"],
  });
  const candidate = await controller.openCandidateRecord({
    signalId: signal.id,
    contentRef: content.contentRef,
    contentHash: content.contentHash,
    rights,
  });
  return controller.validateRecord({ recordId: candidate.id });
}

test("load is idempotent (one plane per controller) and the snapshot is simulated", async () => {
  const controller = await newLoadedController();
  const first = await controller.refresh();
  const second = await controller.load({ workspaceKey: "test-workspace" });
  assert.equal(second.studioId, first.studioId);
  assert.equal(second.simulated, true);
  // 注册面投影：六种 kind / 八种 scope / 六种 usage class / evidence 注册表。
  assert.equal(second.kindRegistry.length, 6);
  assert.equal(second.scopes.length, 8);
  assert.equal(second.rightUsages.length, 6);
  assert.equal(second.evidence.length, 3);
  // evidence 内容寻址（contentRef + contentHash；绝不内联）。
  for (const evidence of second.evidence) {
    assert.ok(evidence.contentRef.startsWith("fx-content-"));
    assert.ok(evidence.contentHash.startsWith("sha256-fixture-"));
  }
});

test("signal capture: kind, scope and evidence intake violations are typed YOU_LEARNING_SIGNAL_INVALID", async () => {
  const controller = await newLoadedController();

  // 未知 kind。
  const kindError = await expectTypedError(() =>
    controller.captureSignal({
      kind: "telepathy" as never,
      scope: "USER",
      evidenceRefs: FEEDBACK_EVIDENCE,
    }),
  );
  assert.equal(kindError.youError.code, "YOU_LEARNING_SIGNAL_INVALID");
  assert.equal(kindError.youError.details["reason"], "invalid-kind");

  // 未知 scope（小写字面量不是 frozen 成员）。
  const scopeError = await expectTypedError(() =>
    controller.captureSignal({
      kind: "feedback",
      scope: "user" as never,
      evidenceRefs: FEEDBACK_EVIDENCE,
    }),
  );
  assert.equal(scopeError.youError.code, "YOU_LEARNING_SIGNAL_INVALID");
  assert.equal(scopeError.youError.details["reason"], "invalid-scope");

  // 空 evidence 列表。
  const emptyError = await expectTypedError(() =>
    controller.captureSignal({
      kind: "feedback",
      scope: "USER",
      evidenceRefs: [],
    }),
  );
  assert.equal(emptyError.youError.code, "YOU_LEARNING_SIGNAL_INVALID");
  assert.equal(emptyError.youError.details["reason"], "empty-evidence-refs");

  // 非法 evidence 引用（首尾空白）。
  const refError = await expectTypedError(() =>
    controller.captureSignal({
      kind: "feedback",
      scope: "USER",
      evidenceRefs: [" fx-content-ref"],
    }),
  );
  assert.equal(refError.youError.code, "YOU_LEARNING_SIGNAL_INVALID");
  assert.equal(refError.youError.details["reason"], "invalid-evidence-ref");
  assert.equal(refError.youError.details["refIndex"], 0);

  // 拒绝不落账：信号列表保持为空（stateless 校验，无副作用）。
  const snapshot = await controller.refresh();
  assert.equal(snapshot.signals.length, 0);
});

test("signal capture appends the learning-signal-captured event with content-addressed labels", async () => {
  const controller = await newLoadedController();
  const signal = await captureFeedbackSignal(controller);
  assert.equal(signal.kind, "feedback");
  assert.equal(signal.scope, "USER");
  assert.equal(signal.simulated, true);
  assert.deepEqual(signal.evidenceRefs, FEEDBACK_EVIDENCE);

  const snapshot = await controller.refresh();
  assert.equal(snapshot.signals.length, 1);
  assert.equal(snapshot.signals[0]!.id, signal.id);
  const event = snapshot.events.find((entry) => entry.type === "learning-signal-captured");
  assert.ok(event);
  assert.equal(event.subjectRef, signal.id);
  assert.equal(event.payload["kind"], "feedback");
  assert.equal(event.payload["evidenceCount"], 2);
  assert.equal(event.payload["evidenceRef.0"], FEEDBACK_EVIDENCE[0]);
  assert.equal(event.payload["evidenceRef.1"], FEEDBACK_EVIDENCE[1]);
  // 证据内容绝不内联——payload 只带标签。
  assert.equal("evidenceRefs" in event.payload, false);
});

test("rights issuance is enforcement: without granted learning consent it is a typed refusal", async () => {
  const controller = await newLoadedController();
  const error = await expectTypedError(() =>
    controller.issueRights({ usage: ["personalization"] }),
  );
  assert.equal(error.youError.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(error.youError.details["reason"], "consent-unknown");

  // 授予后签发成功：consentRef + consentHash 绑定 wave-2 权威。
  await controller.decideConsent({
    policyId: "fx-learning-consent-001",
    purpose: "learning",
    decision: "grant",
  });
  const rights = await controller.issueRights({ usage: ["personalization", "tool-selection"] });
  assert.equal(rights.consentRef, "fx-learning-consent-001");
  assert.ok(rights.consentHash.startsWith("sha256-fixture-"));
  assert.deepEqual(rights.usage, ["personalization", "tool-selection"]);
  assert.equal(rights.expiresAt, null);
});

test("record ladder: candidate -> validated | rejected with terminals locked", async () => {
  const controller = await newLoadedController();
  const signal = await captureFeedbackSignal(controller);
  const content = await controller.synthesizeLearningContent({ seedText: "ladder" });
  const candidate = await controller.openCandidateRecord({
    signalId: signal.id,
    contentRef: content.contentRef,
    contentHash: content.contentHash,
  });
  assert.equal(candidate.status, "candidate");
  assert.equal(candidate.scope, signal.scope); // scope 继承自 signal
  assert.equal(candidate.supersededById, null);
  // candidate 是 pre-validation 服务状态——不落事件。
  let snapshot = await controller.refresh();
  assert.equal(
    snapshot.events.some((entry) => entry.type.startsWith("learning-record-")),
    false,
  );

  const validated = await controller.validateRecord({ recordId: candidate.id });
  assert.equal(validated.record.status, "validated");
  assert.equal(validated.superseded, null);
  snapshot = await controller.refresh();
  const validatedEvent = snapshot.events.find(
    (entry) => entry.type === "learning-record-validated",
  );
  assert.ok(validatedEvent);
  assert.equal(validatedEvent.payload["statusAfter"], "validated");
  assert.equal(validatedEvent.payload["supersedesRecordId"], "");

  // 终态锁定：validated 不能再 validate / reject（非法迁移 typed 拒绝）。
  const revalidateError = await expectTypedError(() =>
    controller.validateRecord({ recordId: candidate.id }),
  );
  assert.equal(revalidateError.youError.code, "YOU_INVALID_STATE");
  assert.equal(revalidateError.youError.details["reason"], "record-not-candidate");
  const rejectError = await expectTypedError(() =>
    controller.rejectRecord({ recordId: candidate.id, reason: "late" }),
  );
  assert.equal(rejectError.youError.details["reason"], "record-not-candidate");
  // 拒绝无副作用：状态保持 validated。
  snapshot = await controller.refresh();
  assert.equal(snapshot.records[0]!.status, "validated");
});

test("reject path: candidate -> rejected terminal with the reason journaled", async () => {
  const controller = await newLoadedController();
  const signal = await captureFeedbackSignal(controller);
  const content = await controller.synthesizeLearningContent({ seedText: "reject" });
  const candidate = await controller.openCandidateRecord({
    signalId: signal.id,
    contentRef: content.contentRef,
    contentHash: content.contentHash,
  });
  const rejected = await controller.rejectRecord({
    recordId: candidate.id,
    reason: "",
  });
  assert.equal(rejected.status, "rejected");
  const snapshot = await controller.refresh();
  const event = snapshot.events.find((entry) => entry.type === "learning-record-rejected");
  assert.ok(event);
  assert.equal(event.payload["reason"], "unspecified"); // 空 reason 折叠为 unspecified
});

test("supersession is append-only linkage: the superseded record keeps its id and validation moment", async () => {
  const controller = await newLoadedController();
  await controller.decideConsent({
    policyId: "fx-learning-consent-001",
    purpose: "learning",
    decision: "grant",
  });
  const rights = await controller.issueRights({ usage: ["personalization"] });
  const signal = await captureFeedbackSignal(controller);
  const content = await controller.synthesizeLearningContent({ seedText: "supersede" });
  const first = await controller.openCandidateRecord({
    signalId: signal.id,
    contentRef: content.contentRef,
    contentHash: content.contentHash,
    rights,
  });
  const second = await controller.openCandidateRecord({
    signalId: signal.id,
    contentRef: content.contentRef,
    contentHash: content.contentHash,
    rights,
  });
  const firstValidated = await controller.validateRecord({ recordId: first.id });
  const firstMoment = firstValidated.record.validatedAt;
  const outcome = await controller.validateRecord({
    recordId: second.id,
    supersedesRecordId: first.id,
  });
  assert.equal(outcome.record.status, "validated");
  assert.equal(outcome.superseded!.id, first.id);
  assert.equal(outcome.superseded!.status, "superseded");
  assert.equal(outcome.superseded!.supersededById, second.id);
  // 保留自己的验证时刻（只有 status + supersededById 移动）。
  assert.equal(outcome.superseded!.validatedAt, firstMoment);
  // 链接事实落在后继者的 validated 事件载荷里。
  const snapshot = await controller.refresh();
  const events = snapshot.events.filter(
    (entry) => entry.type === "learning-record-validated",
  );
  assert.equal(events.length, 2);
  assert.equal(events[1]!.payload["supersedesRecordId"], first.id);
  assert.equal(events[1]!.subjectRef, second.id);
});

test("supersession guards: self-supersession and non-validated targets are typed refusals", async () => {
  const controller = await newLoadedController();
  await controller.decideConsent({
    policyId: "fx-learning-consent-001",
    purpose: "learning",
    decision: "grant",
  });
  const rights = await controller.issueRights({ usage: ["personalization"] });
  const signal = await captureFeedbackSignal(controller);
  const content = await controller.synthesizeLearningContent({ seedText: "guards" });
  const first = await controller.openCandidateRecord({
    signalId: signal.id,
    contentRef: content.contentRef,
    contentHash: content.contentHash,
    rights,
  });
  const second = await controller.openCandidateRecord({
    signalId: signal.id,
    contentRef: content.contentRef,
    contentHash: content.contentHash,
    rights,
  });

  const selfError = await expectTypedError(() =>
    controller.validateRecord({ recordId: first.id, supersedesRecordId: first.id }),
  );
  assert.equal(selfError.youError.details["reason"], "self-supersession");

  // 目标必须 validated：candidate 目标是 typed 拒绝。
  const targetError = await expectTypedError(() =>
    controller.validateRecord({ recordId: second.id, supersedesRecordId: first.id }),
  );
  assert.equal(targetError.youError.details["reason"], "record-not-validated");
});

test("unknown record ids are typed YOU_LEARNING_RECORD_NOT_FOUND refusals everywhere", async () => {
  const controller = await newLoadedController();
  for (const operation of [
    () => controller.validateRecord({ recordId: "fx-learnrecord-999" }),
    () => controller.rejectRecord({ recordId: "fx-learnrecord-999", reason: "x" }),
    () => controller.useRecord({ recordId: "fx-learnrecord-999", usage: "personalization" }),
    () =>
      controller.derivePreference({
        recordId: "fx-learnrecord-999",
        key: "k",
        value: "v",
      }),
  ]) {
    const error = await expectTypedError(operation);
    assert.equal(error.youError.code, "YOU_LEARNING_RECORD_NOT_FOUND");
    assert.equal(error.youError.details["reason"], "unknown-learning-record");
    assert.equal(error.youError.details["recordId"], "fx-learnrecord-999");
  }
});

test("useRecord: only validated records are usable and the eight-step rights evaluation is enforced", async () => {
  const controller = await newLoadedController();
  const signal = await captureFeedbackSignal(controller);
  const content = await controller.synthesizeLearningContent({ seedText: "use" });

  // candidate 记录不可使用。
  await controller.decideConsent({
    policyId: "fx-learning-consent-001",
    purpose: "learning",
    decision: "grant",
  });
  const rights = await controller.issueRights({ usage: ["personalization"] });
  const candidate = await controller.openCandidateRecord({
    signalId: signal.id,
    contentRef: content.contentRef,
    contentHash: content.contentHash,
    rights,
  });
  const candidateError = await expectTypedError(() =>
    controller.useRecord({ recordId: candidate.id, usage: "personalization" }),
  );
  assert.equal(candidateError.youError.code, "YOU_INVALID_STATE");
  assert.equal(candidateError.youError.details["reason"], "record-not-validated");

  await controller.validateRecord({ recordId: candidate.id });

  // 授予内使用成功。
  const used = await controller.useRecord({
    recordId: candidate.id,
    usage: "personalization",
  });
  assert.equal(used.record.id, candidate.id);
  assert.equal(used.usage, "personalization");

  // 授予外使用 ⇒ usage-not-granted（RIGHTS LAW）。
  const outsideError = await expectTypedError(() =>
    controller.useRecord({ recordId: candidate.id, usage: "pipeline-improvement" }),
  );
  assert.equal(outsideError.youError.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(outsideError.youError.details["reason"], "usage-not-granted");
  assert.equal(outsideError.youError.details["usage"], "pipeline-improvement");
  assert.equal(outsideError.youError.details["consentRef"], "fx-learning-consent-001");
});

test("inert records: no rights on intake, climb the ladder, but every use is refused (rights-inert)", async () => {
  const controller = await newLoadedController();
  const signal = await captureFeedbackSignal(controller);
  const content = await controller.synthesizeLearningContent({ seedText: "inert" });
  const inert = await controller.openCandidateRecord({
    signalId: signal.id,
    contentRef: content.contentRef,
    contentHash: content.contentHash,
  });
  assert.equal(inert.rights.usage.length, 0);
  assert.equal(inert.rights.consentRef, "");

  const validated = await controller.validateRecord({ recordId: inert.id });
  assert.equal(validated.record.status, "validated");

  const useError = await expectTypedError(() =>
    controller.useRecord({ recordId: inert.id, usage: "personalization" }),
  );
  assert.equal(useError.youError.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(useError.youError.details["reason"], "rights-inert");

  // 派生偏好同样被拒（惰性记录的一切使用）。
  const deriveError = await expectTypedError(() =>
    controller.derivePreference({
      recordId: inert.id,
      key: "preferred-editor",
      value: "x",
    }),
  );
  assert.equal(deriveError.youError.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(deriveError.youError.details["reason"], "rights-inert");
});

test("openCandidateRecord: unknown signal is a typed refusal; bad content binding is refused", async () => {
  const controller = await newLoadedController();
  const signalError = await expectTypedError(() =>
    controller.openCandidateRecord({
      signalId: "fx-learnsignal-999",
      contentRef: "fx-content-x",
      contentHash: "sha256-fixture-x",
    }),
  );
  assert.equal(signalError.youError.code, "YOU_INVALID_STATE");
  assert.equal(signalError.youError.details["reason"], "unknown-signal");

  const signal = await captureFeedbackSignal(controller);
  const bindingError = await expectTypedError(() =>
    controller.openCandidateRecord({
      signalId: signal.id,
      contentRef: "fx-content-x",
      contentHash: "not-a-fixture-hash",
    }),
  );
  assert.equal(bindingError.youError.details["reason"], "invalid-content-binding");
});

test("consent withdrawal fails usage closed live (state check before hash check)", async () => {
  const controller = await newLoadedController();
  const validated = await validatedFeedbackRecord(controller);

  // 撤回前可用。
  await controller.useRecord({
    recordId: validated.record.id,
    usage: "personalization",
  });

  await controller.withdrawConsent({ policyId: "fx-learning-consent-001" });

  // 撤回后：记录的 consentHash 仍匹配，但 live 状态检查先于哈希检查 ⇒ 拒绝。
  const useError = await expectTypedError(() =>
    controller.useRecord({ recordId: validated.record.id, usage: "personalization" }),
  );
  assert.equal(useError.youError.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(useError.youError.details["reason"], "consent-withdrawn");

  const deriveError = await expectTypedError(() =>
    controller.derivePreference({
      recordId: validated.record.id,
      key: "preferred-editor",
      value: "x",
    }),
  );
  assert.equal(deriveError.youError.details["reason"], "consent-withdrawn");

  // 撤回后也无法再签发新 rights（consent-withdrawn）。
  const issueError = await expectTypedError(() =>
    controller.issueRights({ usage: ["personalization"] }),
  );
  assert.equal(issueError.youError.details["reason"], "consent-withdrawn");
});

test("preferences: derivation lineage, upsert semantics and the scoping law", async () => {
  const controller = await newLoadedController();
  const validated = await validatedFeedbackRecord(controller);

  // 派生偏好带 lineage；记录保持真相源。
  const derived = await controller.derivePreference({
    recordId: validated.record.id,
    key: "preferred-editor",
    value: "fixture-external-editor",
  });
  assert.equal(derived.preference.derivedFromRecordId, validated.record.id);
  assert.equal(derived.preference.scope, "USER"); // 缺省取记录 scope
  assert.equal(derived.previous, null);

  // 同投影键 upsert：previous 返回旧值，id 每次新。
  const again = await controller.derivePreference({
    recordId: validated.record.id,
    key: "preferred-editor",
    value: "fixture-external-editor-2",
  });
  assert.equal(again.previous!.id, derived.preference.id);
  assert.notEqual(again.preference.id, derived.preference.id);
  // 投影里每键只剩最新。
  const snapshot = await controller.refresh();
  assert.equal(snapshot.preferences.length, 1);
  assert.equal(snapshot.preferences[0]!.value, "fixture-external-editor-2");

  // 范围法则：派生不得扩缩（scope-mismatch ⇒ YOU_PREFERENCE_SCOPE_INVALID）。
  const mismatchError = await expectTypedError(() =>
    controller.derivePreference({
      recordId: validated.record.id,
      key: "preferred-editor",
      value: "x",
      scope: "TENANT",
    }),
  );
  assert.equal(mismatchError.youError.code, "YOU_PREFERENCE_SCOPE_INVALID");
  assert.equal(mismatchError.youError.details["reason"], "scope-mismatch");
  assert.equal(mismatchError.youError.details["recordScope"], "USER");

  // 非法字面量 scope ⇒ invalid-scope。
  const literalError = await expectTypedError(() =>
    controller.setOperatorPreference({
      scope: "org" as never,
      key: "baseline",
      value: "x",
    }),
  );
  assert.equal(literalError.youError.code, "YOU_PREFERENCE_SCOPE_INVALID");
  assert.equal(literalError.youError.details["reason"], "invalid-scope");

  // 偏好事件以 preference-updated 落账（含 lineage 载荷）。
  const events = snapshot.events.filter((entry) => entry.type === "preference-updated");
  assert.equal(events.length, 2);
  assert.equal(events[0]!.payload["derivedFromRecordId"], validated.record.id);
});

test("operator preferences: seed, adjust and clear as projected intents; derived clearing is refused", async () => {
  const controller = await newLoadedController();
  const validated = await validatedFeedbackRecord(controller);
  await controller.derivePreference({
    recordId: validated.record.id,
    key: "preferred-editor",
    value: "fixture-external-editor",
  });

  // operator 种子（无 rights 门；derivedFromRecordId null）。
  const seeded = await controller.setOperatorPreference({
    scope: "GLOBAL",
    key: "organization-baseline",
    value: "fixture-baseline",
  });
  assert.equal(seeded.preference.derivedFromRecordId, null);
  assert.equal(seeded.previous, null);

  // 调整即再次 upsert：previous 返回旧种子。
  const adjusted = await controller.setOperatorPreference({
    scope: "GLOBAL",
    key: "organization-baseline",
    value: "fixture-baseline-2",
  });
  assert.equal(adjusted.previous!.value, "fixture-baseline");

  // 清除 operator 种子：live 投影移除 + cleared 标记事件落账。
  const cleared = await controller.clearOperatorPreference({
    scope: "GLOBAL",
    key: "organization-baseline",
  });
  assert.equal(cleared.value, "fixture-baseline-2");
  const snapshot = await controller.refresh();
  const keys = snapshot.preferences.map(
    (preference) => `${preference.scope}::${preference.key}`,
  );
  assert.deepEqual(keys, ["USER::preferred-editor"]);
  const clearedEvent = snapshot.events
    .filter((entry) => entry.type === "preference-updated")
    .find((entry) => entry.payload["cleared"] === true);
  assert.ok(clearedEvent);
  assert.equal(clearedEvent.payload["value"], "");

  // 派生偏好是投影：手工清除被 typed 拒绝。
  const derivedClearError = await expectTypedError(() =>
    controller.clearOperatorPreference({ scope: "USER", key: "preferred-editor" }),
  );
  assert.equal(derivedClearError.youError.code, "YOU_INVALID_STATE");
  assert.equal(derivedClearError.youError.details["reason"], "derived-preference-projection");

  // 未知偏好键清除也是 typed 拒绝。
  const unknownError = await expectTypedError(() =>
    controller.clearOperatorPreference({ scope: "GLOBAL", key: "missing" }),
  );
  assert.equal(unknownError.youError.details["reason"], "unknown-preference");
});

test("trajectories: seed-derived steps, byte-identical replay and the same replay hash", async () => {
  const controller = await newLoadedController();
  const steps = await controller.synthesizeTrajectorySteps({
    seedText: "test-trajectory",
    stepCount: 3,
  });
  assert.equal(steps.stepRefs.length, 3);
  for (const ref of steps.stepRefs) {
    assert.ok(ref.startsWith("fx-content-"));
  }

  const trajectory = await controller.recordTrajectory({
    scope: "USER",
    stepRefs: [...steps.stepRefs],
  });
  assert.equal(trajectory.stepRefs.length, 3);
  assert.equal(trajectory.simulated, true);
  // trajectory 是注册面服务状态——不落事件。
  const snapshot = await controller.refresh();
  assert.equal(
    snapshot.events.some((entry) => entry.payload["stepRefs"] !== undefined),
    false,
  );

  const first = await controller.replayTrajectory({ trajectoryId: trajectory.id });
  const second = await controller.replayTrajectory({ trajectoryId: trajectory.id });
  assert.equal(first.stepCount, 3);
  assert.equal(first.bytes.length, second.bytes.length);
  assert.ok(first.bytes.every((byte, index) => byte === second.bytes[index]));
  assert.equal(first.replayHash, second.replayHash);
  assert.ok(first.replayHash.startsWith("sha256-fixture-"));

  // 不同 seed ⇒ 不同步骤与不同重放摘要。
  const otherSteps = await controller.synthesizeTrajectorySteps({
    seedText: "test-trajectory-other",
    stepCount: 3,
  });
  const other = await controller.recordTrajectory({
    scope: "USER",
    stepRefs: [...otherSteps.stepRefs],
  });
  const otherReplay = await controller.replayTrajectory({ trajectoryId: other.id });
  assert.notEqual(otherReplay.replayHash, first.replayHash);
  assert.notDeepEqual(otherSteps.stepRefs, steps.stepRefs);

  // 合成守卫：空 seed / 非法 stepCount / 未知 trajectory id 是 typed 拒绝。
  const emptySeedError = await expectTypedError(() =>
    controller.synthesizeTrajectorySteps({ seedText: "  ", stepCount: 2 }),
  );
  assert.equal(emptySeedError.youError.details["reason"], "empty-seed-text");
  const stepCountError = await expectTypedError(() =>
    controller.synthesizeTrajectorySteps({ seedText: "x", stepCount: 0 }),
  );
  assert.equal(stepCountError.youError.details["reason"], "invalid-step-count");
  const unknownTrajectoryError = await expectTypedError(() =>
    controller.replayTrajectory({ trajectoryId: "fx-traj-999" }),
  );
  assert.equal(unknownTrajectoryError.youError.details["reason"], "unknown-trajectory");
  const emptyRefsError = await expectTypedError(() =>
    controller.recordTrajectory({ scope: "USER", stepRefs: [] }),
  );
  assert.equal(emptyRefsError.youError.details["reason"], "empty-step-refs");
});

test("determinism: two fresh controllers replay the same script byte-identically (JSON.stringify)", async () => {
  async function runScript(controller: LearningStudioController): Promise<unknown> {
    await controller.load({ workspaceKey: "determinism" });
    const validated = await validatedFeedbackRecord(controller);
    await controller.useRecord({
      recordId: validated.record.id,
      usage: "personalization",
    });
    await controller.derivePreference({
      recordId: validated.record.id,
      key: "preferred-editor",
      value: "fixture-external-editor",
    });
    await controller.setOperatorPreference({
      scope: "GLOBAL",
      key: "organization-baseline",
      value: "fixture-baseline",
    });
    const steps = await controller.synthesizeTrajectorySteps({
      seedText: "determinism-trajectory",
      stepCount: 4,
    });
    const trajectory = await controller.recordTrajectory({
      scope: "USER",
      stepRefs: [...steps.stepRefs],
    });
    const replay = await controller.replayTrajectory({ trajectoryId: trajectory.id });
    await controller.withdrawConsent({ policyId: "fx-learning-consent-001" });
    await expectTypedError(() =>
      controller.useRecord({ recordId: validated.record.id, usage: "personalization" }),
    ).catch(() => {
      throw new Error("test: expected withdrawal refusal");
    });
    return {
      snapshot: await controller.refresh(),
      replay: {
        stepCount: replay.stepCount,
        replayHash: replay.replayHash,
        byteLength: replay.bytes.length,
        bytes: Array.from(replay.bytes),
      },
    };
  }
  const first = await runScript(createSimulatedLearningStudioController());
  const second = await runScript(createSimulatedLearningStudioController());
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
