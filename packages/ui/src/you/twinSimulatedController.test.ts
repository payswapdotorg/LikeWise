// W3B logic tests — Twin 确定性模拟控制器（node:test，无 DOM）。
//
// 覆盖：确定性（两个 fresh 实例逐步重放 → 字节一致的快照）、不可变版本语义
//（版本号单调、candidate→canonical→superseded 记录替换、append-only 链接）、
// binding-time 同意强制（无许可 ⇒ YOU_CONSENT_REQUIRED；withdrawal 阻断新绑定，
// 已派生版本保留溯源）、重建支持矩阵（不支持 ⇒ YOU_RECONSTRUCTION_UNSUPPORTED，
// 绝不静默回退）、诚实 effort 观察（not-measured 标记）、补救请求幂等
//（deficiency key 注册表）、事件账本词汇（frozen wave-3 类型）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedTwinStudioController } from "./twinSimulatedController.js";
import {
  TwinStudioError,
  canonicalVersionOf,
  orderedTwinVersions,
  projectTwinBindingGate,
} from "./twinController.js";

const CONSENT_POLICY_ID = "fx-twin-consent-001";

async function grantAllPurposes(controller: ReturnType<typeof createSimulatedTwinStudioController>) {
  const snapshot = await controller.refresh();
  for (const purpose of snapshot.consent.policy.purposes) {
    await controller.decideConsent({
      policyId: CONSENT_POLICY_ID,
      purpose,
      decision: "grant",
    });
  }
}

test("load is idempotent and bootstraps a deterministic empty twin plane", async () => {
  const controller = createSimulatedTwinStudioController();
  const first = await controller.load({ workspaceKey: "ws-a" });
  const second = await controller.load({ workspaceKey: "ws-b" });
  // 幂等：重复 load 不重建状态（结构一致；同一个 twin plane）。
  assert.deepEqual(first, second);
  // Truth law：快照带 simulated 标记（绝不伪装真实 provider）。
  assert.equal(first.simulated, true);
  assert.equal(first.versions.length, 0);
  assert.equal(first.canonicalVersionId, null);
  assert.equal(first.evidenceRequests.length, 0);
  assert.equal(first.jobs.length, 0);
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0]!.type, "solution-created");
  // 事件账本只在首次 load 引导时创建一次（第二次 load 不追加）。
  const third = await controller.load({ workspaceKey: "ws-c" });
  assert.equal(third.events.length, 1);
  // 「未加载即操作」是诚实错误（truthful error）。
  const cold = createSimulatedTwinStudioController();
  await assert.rejects(() => cold.refresh(), (error: unknown) => {
    assert.ok(error instanceof TwinStudioError);
    assert.equal(error.youError.code, "YOU_INVALID_STATE");
    return true;
  });
});

test("publishing is monotonic, immutable and journals the frozen wave-3 events", async () => {
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "ws" });
  const v1 = await controller.publishFixtureVersion({});
  assert.equal(v1.version, 1);
  assert.equal(v1.status, "candidate");
  assert.equal(v1.domainBlocks.length, 4);
  assert.equal(v1.evidenceBindings.length, 0);
  assert.ok(v1.domainBlocks.every((block) => block.simulated === true));

  const v2 = await controller.publishFixtureVersion({});
  assert.equal(v2.version, 2);
  // 不可变：先前版本记录不被后续发布改动（内容字段字节一致）。
  const snapshot = await controller.refresh();
  const rereadV1 = snapshot.versions.find((version) => version.id === v1.id)!;
  assert.deepEqual(rereadV1.domainBlocks, v1.domainBlocks);
  assert.equal(rereadV1.status, v1.status);

  // 版本号单调递增。
  assert.deepEqual(
    orderedTwinVersions(snapshot).map((version) => version.version),
    [1, 2],
  );

  // 事件词汇（frozen additive wave-3）。
  const types = snapshot.events.map((event) => event.type);
  assert.equal(types.includes("twin-version-published"), true);
  assert.equal(types.includes("twin-quality-assessed"), true);
  const publication = snapshot.events.find(
    (event) => event.type === "twin-version-published",
  )!;
  assert.equal(publication.payload["kind"], "publication");
});

test("promotion supersedes the previous canonical through append-only linkage", async () => {
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "ws" });
  const v1 = await controller.publishFixtureVersion({});
  // 首次晋升：无前任 canonical，无取代。
  const firstPromotion = await controller.promoteVersion({ versionId: v1.id });
  assert.equal(firstPromotion.status, "canonical");
  let snapshot = await controller.refresh();
  assert.equal(snapshot.canonicalVersionId, v1.id);
  assert.equal(Object.keys(snapshot.supersededBy).length, 0);

  const v2 = await controller.publishFixtureVersion({});
  const promoted = await controller.promoteVersion({ versionId: v2.id });
  assert.equal(promoted.status, "canonical");
  assert.equal(promoted.id, v2.id);

  snapshot = await controller.refresh();
  assert.equal(snapshot.canonicalVersionId, v2.id);
  assert.equal(snapshot.supersededBy[v1.id], v2.id);
  assert.equal(
    snapshot.versions.find((version) => version.id === v1.id)!.status,
    "superseded",
  );
  assert.equal(canonicalVersionOf(snapshot)!.id, v2.id);

  // 重复晋升被拒绝（canonical 不能再晋升；不可变语义）。
  await assert.rejects(() => controller.promoteVersion({ versionId: v2.id }), (error: unknown) => {
    assert.ok(error instanceof TwinStudioError);
    assert.equal(error.youError.code, "YOU_IMMUTABLE_VIOLATION");
    return true;
  });

  // 晋升 v1（已 superseded）同样被拒绝。
  await assert.rejects(() => controller.promoteVersion({ versionId: v1.id }), (error: unknown) => {
    assert.ok(error instanceof TwinStudioError);
    assert.equal(error.youError.code, "YOU_IMMUTABLE_VIOLATION");
    return true;
  });

  // promotion 事件以 payload.kind 记录（同 W3A 事件词汇；第二次带取代链接）。
  snapshot = await controller.refresh();
  const promotions = snapshot.events.filter(
    (event) =>
      event.type === "twin-version-published" && event.payload["kind"] === "promotion",
  );
  assert.equal(promotions.length, 2);
  assert.equal(promotions[1]!.payload["supersededVersionId"], v1.id);
});

test("binding-time consent enforcement: no permission means no processing", async () => {
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "ws" });

  // 门可见性：初始 unknown ⇒ 不允许（快照投影可测）。
  let snapshot = await controller.refresh();
  assert.equal(projectTwinBindingGate(snapshot.consent).allowed, false);

  // 证据绑定发布在未同意时被服务端拒绝（UI 禁用只是投影；这里直接走端口）。
  await assert.rejects(
    () => controller.publishFixtureVersion({ evidenceBound: true }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_CONSENT_REQUIRED");
      assert.ok(error.youError.message.includes("solution-generation"));
      return true;
    },
  );

  // 部分同意（一个用途）仍拒绝。
  await controller.decideConsent({
    policyId: CONSENT_POLICY_ID,
    purpose: "solution-generation",
    decision: "grant",
  });
  await assert.rejects(
    () => controller.publishFixtureVersion({ evidenceBound: true }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_CONSENT_REQUIRED");
      return true;
    },
  );

  // 全部授予后：门允许且证据绑定发布成功。
  await grantAllPurposes(controller);
  snapshot = await controller.refresh();
  assert.equal(projectTwinBindingGate(snapshot.consent).allowed, true);
  const bound = await controller.publishFixtureVersion({ evidenceBound: true });
  assert.equal(bound.evidenceBindings.length, 1);
  assert.equal(bound.evidenceBindings[0]!.consent.state, "granted");
  // provenance-missing 缺陷消失（绑定在场）。
  assert.equal(
    bound.quality.deficiencies.some(
      (deficiency) => deficiency.deficiencyClass === "provenance-missing",
    ),
    false,
  );

  // 撤回：阻断新绑定；已派生的不可变版本保留（溯源不受影响）。
  await controller.withdrawConsent({ policyId: CONSENT_POLICY_ID });
  snapshot = await controller.refresh();
  const gate = projectTwinBindingGate(snapshot.consent);
  assert.equal(gate.allowed, false);
  assert.equal(gate.state, "withdrawn");
  await assert.rejects(
    () => controller.publishFixtureVersion({ evidenceBound: true }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_CONSENT_REQUIRED");
      return true;
    },
  );
  const after = await controller.refresh();
  const kept = after.versions.find((version) => version.id === bound.id)!;
  assert.deepEqual(kept.evidenceBindings, bound.evidenceBindings);
  assert.equal(kept.provenance, bound.provenance);
});

test("remediation requests are idempotent per deficiency key and feed the next publication", async () => {
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "ws" });
  const v1 = await controller.publishFixtureVersion({});
  const deficiency = v1.quality.deficiencies.find(
    (candidate) => candidate.deficiencyClass === "geometric-error",
  )!;
  assert.ok(deficiency);

  const request = await controller.openRemediation({
    versionId: v1.id,
    deficiencyId: deficiency.id,
  });
  // W2 consent UX 字段逐字在场（reason / privacy / retention）。
  assert.ok(request.reason.length > 0);
  assert.ok(request.privacyRequirements.length > 0);
  assert.ok(request.retention.length > 0);
  assert.equal(request.status, "requested");
  assert.equal(request.targetDeficiency, "geometric-error:geometry-skeleton");

  // 幂等：同一缺陷再次打开返回同一请求（不产生重复）。
  const again = await controller.openRemediation({
    versionId: v1.id,
    deficiencyId: deficiency.id,
  });
  assert.equal(again.id, request.id);
  let snapshot = await controller.refresh();
  assert.equal(snapshot.evidenceRequests.length, 1);

  // 已发布版本不被改动：v1 的 deficiency 记录仍无 remediation 链接
  //（链接是注册表事实，下一次发布才回填）。
  const reread = snapshot.versions.find((version) => version.id === v1.id)!;
  assert.equal(
    reread.quality.deficiencies.find((entry) => entry.id === deficiency.id)!
      .remediationEvidenceRequestId,
    null,
  );

  // 下一版发布回填链接（quality 改进的可解释入口）。
  const v2 = await controller.publishFixtureVersion({});
  const geometryV2 = v2.quality.deficiencies.find(
    (entry) => entry.domain === "geometry-skeleton",
  );
  // v2 剧本分数 0.71（同 v1 模板）——仍低分，但带上了补救链接。
  assert.ok(geometryV2);
  assert.equal(geometryV2.remediationEvidenceRequestId, request.id);

  // 未知缺陷 id 是诚实错误。
  await assert.rejects(
    () => controller.openRemediation({ versionId: v1.id, deficiencyId: "fx-twdef-999" }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );
  // 事件词汇：复用 evidence-requested（W1A 类型，同语义）。
  snapshot = await controller.refresh();
  assert.equal(
    snapshot.events.some((event) => event.type === "evidence-requested"),
    true,
  );
});

test("reconstruction jobs: lifecycle, honest effort observations, no silent fallback", async () => {
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "ws" });
  const v1 = await controller.publishFixtureVersion({});
  await grantAllPurposes(controller);

  // 支持矩阵：不支持的组合被拒绝（绝不静默改道）。
  await assert.rejects(
    () =>
      controller.submitReconstructionJob({
        method: "explicit-geometry",
        targetDomains: ["voice"],
      }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_RECONSTRUCTION_UNSUPPORTED");
      assert.ok(error.youError.message.includes("voice"));
      return true;
    },
  );
  // 未知方法同样拒绝（开放联合的诚实边界）。
  await assert.rejects(
    () =>
      controller.submitReconstructionJob({
        method: "photogrammetry-magic" as never,
        targetDomains: ["morphology"],
      }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_RECONSTRUCTION_UNSUPPORTED");
      return true;
    },
  );
  // 空目标域拒绝。
  await assert.rejects(
    () => controller.submitReconstructionJob({ method: "hybrid", targetDomains: [] }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_RECONSTRUCTION_UNSUPPORTED");
      return true;
    },
  );

  // 正常生命周期：queued → running → completed。
  const spec = await controller.submitReconstructionJob({
    method: "hybrid",
    targetDomains: ["geometry-skeleton", "appearance-materials"],
    evidenceBound: true,
  });
  assert.equal(spec.method, "hybrid");
  assert.deepEqual(spec.targetDomains, ["appearance-materials", "geometry-skeleton"]);
  assert.equal(spec.twinVersionId, v1.id);
  assert.equal(spec.evidenceBindings.length, 1);

  let snapshot = await controller.refresh();
  assert.equal(snapshot.jobs[0]!.status, "queued");

  // 越级完成被拒绝（必须先 running）。
  await assert.rejects(
    () => controller.completeReconstructionJob({ jobId: spec.id }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );

  await controller.startReconstructionJob({ jobId: spec.id });
  snapshot = await controller.refresh();
  assert.equal(snapshot.jobs[0]!.status, "running");

  const result = await controller.completeReconstructionJob({ jobId: spec.id });
  assert.equal(result.status, "completed");
  assert.equal(result.simulated, true);
  assert.ok(result.producedDomainBlocks.length > 0);
  // 诚实 effort 观察：not-measured 标记原样在场。
  assert.equal(result.effortObservations["computeEffort.measured"], false);
  assert.equal(result.effortObservations["computeEffort"], "not-measured (simulated)");
  assert.equal(result.effortObservations["latencyMs.measured"], false);
  assert.equal(
    result.effortObservations["domainBlocksProduced"],
    result.producedDomainBlocks.length,
  );

  // 从结果发布：v2 候选（consent re-enforced；带证据绑定与作业溯源）。
  const v2 = await controller.publishVersionFromJob({ jobId: spec.id });
  assert.equal(v2.version, 2);
  assert.equal(v2.evidenceBindings.length, 1);
  assert.ok(v2.provenance.source.includes(spec.id));

  // 失败路径：诚实 typed 终态 + failureReason。
  const spec2 = await controller.submitReconstructionJob({
    method: "explicit-geometry",
    targetDomains: ["morphology"],
  });
  await controller.startReconstructionJob({ jobId: spec2.id });
  const failed = await controller.failReconstructionJob({
    jobId: spec2.id,
    reason: "fixture: operator invoked the honest failure path",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.effortObservations["failureReason"], "fixture: operator invoked the honest failure path");
  // 失败作业不能发布版本。
  await assert.rejects(
    () => controller.publishVersionFromJob({ jobId: spec2.id }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );
  // 未知作业是诚实错误。
  await assert.rejects(
    () => controller.startReconstructionJob({ jobId: "fx-reconjob-999" }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );
  // 事件词汇：reconstruction-job-submitted / reconstruction-job-completed。
  snapshot = await controller.refresh();
  const types = snapshot.events.map((event) => event.type);
  assert.equal(types.includes("reconstruction-job-submitted"), true);
  assert.equal(types.includes("reconstruction-job-completed"), true);
});

test("quality re-assessment is deterministic and never mutates the published version", async () => {
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "ws" });
  const v1 = await controller.publishFixtureVersion({});
  const before = JSON.stringify(v1.quality);
  const snapshotAfterAssess = await controller.assessQuality({ versionId: v1.id });
  const reread = snapshotAfterAssess.versions.find((version) => version.id === v1.id)!;
  assert.equal(JSON.stringify(reread.quality), before);
  // 评估事件追加（append-only 账本）。
  assert.equal(
    snapshotAfterAssess.events.filter((event) => event.type === "twin-quality-assessed").length,
    2,
  );
  // 未知版本是诚实错误。
  await assert.rejects(
    () => controller.assessQuality({ versionId: "fx-twver-999" }),
    (error: unknown) => {
      assert.ok(error instanceof TwinStudioError);
      assert.equal(error.youError.code, "YOU_VERSION_NOT_FOUND");
      return true;
    },
  );
});

test("determinism: two fresh controllers replayed through the same operations produce identical snapshots", async () => {
  const run = async () => {
    const controller = createSimulatedTwinStudioController();
    await controller.load({ workspaceKey: "ws-determinism" });
    const v1 = await controller.publishFixtureVersion({});
    await controller.openRemediation({
      versionId: v1.id,
      deficiencyId: v1.quality.deficiencies[0]!.id,
    });
    await grantAllPurposes(controller);
    const spec = await controller.submitReconstructionJob({
      method: "hybrid",
      targetDomains: ["geometry-skeleton", "hair"],
      evidenceBound: true,
    });
    await controller.startReconstructionJob({ jobId: spec.id });
    await controller.completeReconstructionJob({ jobId: spec.id });
    const v2 = await controller.publishVersionFromJob({ jobId: spec.id });
    await controller.promoteVersion({ versionId: v2.id });
    return controller.refresh();
  };
  const [a, b] = await Promise.all([run(), run()]);
  assert.deepEqual(a, b);
});

test("per-workspace registry instances are independent and reusable", async () => {
  // 两个 controller 实例互不串状态（registry 的 per-workspace 语义）。
  const first = createSimulatedTwinStudioController();
  const second = createSimulatedTwinStudioController();
  await first.load({ workspaceKey: "ws-1" });
  await first.publishFixtureVersion({});
  const secondSnapshot = await second.load({ workspaceKey: "ws-2" });
  assert.equal(secondSnapshot.versions.length, 0);
  const firstSnapshot = await first.refresh();
  assert.equal(firstSnapshot.versions.length, 1);
});
