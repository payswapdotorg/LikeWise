// W3B logic tests — Twin 视图纯投影（node:test，无 DOM）。
//
// 覆盖：质量地图行（可访问：数值 + 文本 level，非仅颜色）、缺陷清单投影
// （class/severity/hint/remediation 链接）、版本对比投影（分数 delta、缺陷
// 解决/新增、溯源变化）、effort 观察的 not-measured 诚实标记、同意门
// （「无许可 ⇒ 不处理」可见性）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  projectDeficiencyRows,
  projectEffortObservationRows,
  projectQualityMapRows,
  projectTwinVersionCompare,
  resolveQualityScoreLevel,
} from "./twinStudioProjection.js";
import {
  projectTwinBindingGate,
  type TwinConsentProjection,
} from "./twinController.js";
import { createSimulatedTwinStudioController } from "./twinSimulatedController.js";
import {
  notMeasuredStoryboardEffortObservations,
  buildStoryboardReconstructionResult,
} from "./twinStoryboard.js";

function fixtureConsent(
  states: Partial<Record<string, "granted" | "unknown" | "denied" | "expired" | "withdrawn">>,
): TwinConsentProjection {
  return {
    policy: {
      id: "fx-twin-consent-001",
      purposes: ["solution-generation", "quality-improvement"],
      scope: "USER",
      operationalUse: false,
      learningReuse: false,
      retention: { policy: "delete-after-review", deleteAfter: null, reason: "fixture" },
      revocable: true,
    },
    purposeStates: [
      { purpose: "solution-generation", state: states["solution-generation"] ?? "unknown" },
      { purpose: "quality-improvement", state: states["quality-improvement"] ?? "unknown" },
    ],
    reference: { policyId: "fx-twin-consent-001", state: "unknown", learningPermission: false },
  };
}

test("quality map rows are accessible: numeric score, text level, stable ordering", async () => {
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "ws-quality" });
  const version = await controller.publishFixtureVersion({});
  const rows = projectQualityMapRows(version);
  assert.equal(rows.length, 4);
  // 按 domain 稳定排序（FIXTURES 法则 4）。
  assert.deepEqual(
    rows.map((row) => row.domain),
    ["appearance-materials", "geometry-skeleton", "identity-binding", "morphology"],
  );
  for (const row of rows) {
    // 数值 + 文本 level 同时在场（非仅颜色）。
    assert.equal(typeof row.score, "number");
    assert.ok(["strong", "adequate", "low"].includes(row.level));
    assert.ok(row.accessibleLabel.includes(row.domain));
    assert.ok(row.accessibleLabel.includes(row.score.toFixed(2)));
    assert.equal(row.percent, Math.round(row.score * 100));
  }
  // 剧本 v1 分数断言（确定性 fixture 定义）。
  const byDomain = new Map(rows.map((row) => [row.domain, row]));
  assert.equal(byDomain.get("identity-binding")!.score, 0.92);
  assert.equal(byDomain.get("identity-binding")!.level, "strong");
  assert.equal(byDomain.get("geometry-skeleton")!.score, 0.71);
  assert.equal(byDomain.get("geometry-skeleton")!.level, "low");
  assert.equal(byDomain.get("appearance-materials")!.score, 0.68);
  assert.equal(byDomain.get("appearance-materials")!.level, "low");
  // 0.88 ≥ 0.85（strong 阈值）——level 判级与阈值语义可测。
  assert.equal(byDomain.get("morphology")!.level, "strong");
  assert.equal(resolveQualityScoreLevel(0.85), "strong");
  assert.equal(resolveQualityScoreLevel(0.75), "adequate");
  assert.equal(resolveQualityScoreLevel(0.7499), "low");
  // 空入参（未选择版本）。
  assert.deepEqual(projectQualityMapRows(null), []);
});

test("deficiency rows carry class, severity, remediation hint and stable severity ordering", async () => {
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "ws-def" });
  const version = await controller.publishFixtureVersion({});
  const rows = projectDeficiencyRows(version);
  // v1 剧本：geometry 0.71 (geometric-error)、appearance 0.68 (appearance-error)、
  // 无证据绑定 → provenance-missing（severity 1 最高，排首位）。
  assert.equal(rows.length, 3);
  // severity 降序；同 severity 按 class:domain 稳定排序。
  assert.deepEqual(
    rows.map((row) => row.deficiencyClass),
    ["provenance-missing", "appearance-error", "geometric-error"],
  );
  assert.deepEqual(
    rows.map((row) => row.domain),
    ["identity-binding", "appearance-materials", "geometry-skeleton"],
  );
  for (const row of rows) {
    assert.ok(row.severity > 0 && row.severity <= 1);
    assert.ok(row.accessibleLabel.includes(row.deficiencyClass));
    assert.ok(row.accessibleLabel.includes(row.severity.toFixed(2)));
  }
  // severity = 1 - score（fixture 模型；provenance-missing 恒为 1）。
  assert.equal(rows[0]!.severity, 1);
  assert.equal(rows[0]!.severityPercent, 100);
  const appearance = rows[1]!;
  assert.equal(appearance.severity, 0.32);
  assert.equal(appearance.severityPercent, 32);
  // 补救提示在场（含 target domain 语义）。
  assert.ok(appearance.remediationHint!.includes("appearance-materials"));
  // 发布时尚无补救注册 → remediation 链接为 null（诚实）。
  assert.equal(appearance.remediationEvidenceRequestId, null);
  assert.deepEqual(projectDeficiencyRows(null), []);
});

test("version compare projects score deltas, deficiency resolution and provenance change", async () => {
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "ws-compare" });
  const v1 = await controller.publishFixtureVersion({});
  // 同意后跑重建闭环 → v2（证据绑定 + 作业溯源）。
  for (const purpose of ["solution-generation", "quality-improvement"] as const) {
    await controller.decideConsent({
      policyId: "fx-twin-consent-001",
      purpose,
      decision: "grant",
    });
  }
  const spec = await controller.submitReconstructionJob({
    method: "hybrid",
    targetDomains: ["geometry-skeleton", "appearance-materials", "hair"],
    evidenceBound: true,
  });
  await controller.startReconstructionJob({ jobId: spec.id });
  await controller.completeReconstructionJob({ jobId: spec.id });
  const v2 = await controller.publishVersionFromJob({ jobId: spec.id });

  const compare = projectTwinVersionCompare(v1, v2);
  assert.equal(compare.baseVersionNumber, 1);
  assert.equal(compare.targetVersionNumber, 2);
  assert.equal(compare.baseStatus, "candidate");
  assert.equal(compare.targetStatus, "candidate");

  // 分数 delta 行：并集域、稳定排序、hair 为 added。
  const byDomain = new Map(compare.scoreRows.map((row) => [row.domain, row]));
  assert.deepEqual(
    compare.scoreRows.map((row) => row.domain),
    ["appearance-materials", "geometry-skeleton", "hair", "identity-binding", "morphology"],
  );
  const geometry = byDomain.get("geometry-skeleton")!;
  assert.equal(geometry.baseScore, 0.71);
  assert.equal(geometry.targetScore, 0.86);
  assert.equal(geometry.delta, 0.15);
  assert.equal(geometry.change, "improved");
  const hair = byDomain.get("hair")!;
  assert.equal(hair.baseScore, null);
  assert.equal(hair.change, "added");
  assert.equal(hair.delta, null);

  // 缺陷增减：v1 的 geometric-error:geometry-skeleton 被解决；appearance-error 仍在；
  // provenance-missing 被解决（v2 有绑定）；hair 0.79 ≥ 0.75 无新增缺陷。
  assert.ok(compare.resolvedDeficiencyKeys.includes("geometric-error:geometry-skeleton"));
  assert.ok(compare.resolvedDeficiencyKeys.includes("provenance-missing:identity-binding"));
  assert.ok(compare.addedDeficiencyKeys.length === 0);
  assert.ok(compare.unchangedDeficiencyKeys.includes("appearance-error:appearance-materials"));

  // 溯源：v2 来源是重建作业（变化可见）；绑定数变化；版本级 lineage 记录父版本
  //（与 W3A 服务语义一致——作业锚点在 provenanceSource 与块级 lineage）。
  assert.equal(compare.baseEvidenceBindingCount, 0);
  assert.equal(compare.targetEvidenceBindingCount, 1);
  assert.equal(compare.provenanceSourceChanged, true);
  assert.ok(compare.targetProvenance.source.includes("reconstruction"));
  assert.ok(compare.targetProvenance.source.includes(spec.id));
  assert.deepEqual(compare.targetProvenance.lineage, [v1.id]);

  // 同版本对比被调用方约束（这里防御性验证投影自身不崩溃即可——快照层有
  // base.id !== target.id 的门）。投影对同 id 输入也保持确定性输出。
  const selfCompare = projectTwinVersionCompare(v1, v1);
  assert.equal(selfCompare.scoreRows.every((row) => row.change === "unchanged"), true);
});

test("effort observation rows render not-measured markers verbatim, never invented numbers", () => {
  const result = buildStoryboardReconstructionResult({
    jobId: "fx-reconjob-001",
    status: "completed",
    producedDomainBlocks: [],
    evidenceBindingCount: 1,
    completedAt: "2025-06-02T09:00:10.000Z",
  });
  const rows = projectEffortObservationRows(result);
  const byKey = new Map(rows.map((row) => [row.key, row]));

  // 显式 not-measured 标记：`*.measured: false` 布尔 + "not-measured" 字面值。
  const computeEffort = byKey.get("computeEffort")!;
  assert.equal(computeEffort.value, "not-measured (simulated)");
  assert.equal(computeEffort.notMeasured, true);
  const measuredFlag = byKey.get("computeEffort.measured")!;
  assert.equal(measuredFlag.value, "false");
  assert.equal(measuredFlag.notMeasured, true);
  const latency = byKey.get("latencyMs")!;
  assert.equal(latency.notMeasured, true);

  // 真实观察（块/绑定计数、simulated 标注）不带 not-measured 标记。
  assert.equal(byKey.get("domainBlocksProduced")!.notMeasured, false);
  assert.equal(byKey.get("evidenceBindingsProcessed")!.notMeasured, false);
  assert.equal(byKey.get("simulated")!.notMeasured, false);

  // 键序稳定（FIXTURES 法则 4）。
  const sortedKeys = rows.map((row) => row.key).sort((a, b) => (a < b ? -1 : 1));
  assert.deepEqual(
    rows.map((row) => row.key),
    sortedKeys,
  );
  // 可访问标签明确说明「未测量——不编造数字」。
  assert.ok(computeEffort.accessibleLabel.includes("no number invented"));
  // 空结果。
  assert.deepEqual(projectEffortObservationRows(null), []);

  // 与 W3A 冻结 fixture 定义同形状（truth law）。
  const w3aShape = notMeasuredStoryboardEffortObservations(3, 2);
  assert.equal(w3aShape["computeEffort.measured"], false);
  assert.equal(w3aShape.computeEffort, "not-measured (simulated)");
  assert.equal(w3aShape.domainBlocksProduced, 3);
});

test("binding gate visibility: no permission means no processing (all consent states)", () => {
  // 全部 granted ⇒ allowed。
  const granted = projectTwinBindingGate(
    fixtureConsent({ "solution-generation": "granted", "quality-improvement": "granted" }),
  );
  assert.equal(granted.allowed, true);
  assert.equal(granted.state, "granted");
  assert.equal(granted.reason, "granted");

  // 任一用途 unknown ⇒ 不允许（保守聚合）。
  const unknown = projectTwinBindingGate(
    fixtureConsent({ "solution-generation": "granted", "quality-improvement": "unknown" }),
  );
  assert.equal(unknown.allowed, false);
  assert.equal(unknown.state, "unknown");

  // denied / expired / withdrawn 均阻断。
  assert.equal(
    projectTwinBindingGate(
      fixtureConsent({ "solution-generation": "denied", "quality-improvement": "granted" }),
    ).state,
    "denied",
  );
  assert.equal(
    projectTwinBindingGate(
      fixtureConsent({ "solution-generation": "granted", "quality-improvement": "expired" }),
    ).state,
    "expired",
  );
  const withdrawn = projectTwinBindingGate(
    fixtureConsent({ "solution-generation": "withdrawn", "quality-improvement": "granted" }),
  );
  assert.equal(withdrawn.allowed, false);
  assert.equal(withdrawn.state, "withdrawn");
  assert.equal(withdrawn.reason, "withdrawn");
});
