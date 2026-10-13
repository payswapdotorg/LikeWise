// W8B logic tests — Escalation 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、面板 id 文案
// 存在、分类学文案存在（七 gap 分类/三 permission/七状态/四 run 状态）、typed 错误
// 面板文案存在（七个验收 code + UNEXPECTED，en 解释 >40 字符）、占位符语义与回退
// 行为。
import assert from "node:assert/strict";
import test from "node:test";
import { formatEscalationMessage, resolveEscalationMessages } from "./escalationMessages.js";
import { ESCALATION_DEMO_STEPS } from "./escalationStudioDemo.js";

const PANEL_IDS = ["gaps", "gate", "progress", "results", "permissions", "demo"] as const;

const TYPED_ERROR_CODES = [
  "YOU_ESCALATION_NOT_FOUND",
  "YOU_ESCALATION_STATE_INVALID",
  "YOU_ESCALATION_AUTHORIZATION_REQUIRED",
  "YOU_ARENA_RUN_NOT_FOUND",
  "YOU_RETRY_POLICY_INVALID",
  "YOU_ARENA_ADAPTER_UNSUPPORTED",
  "YOU_GAP_PROJECTION_INVALID",
  "UNEXPECTED",
] as const;

const GAP_CATEGORIES = [
  "TOOL_GAP",
  "EDITOR_GAP",
  "MODEL_GAP",
  "SKILL_GAP",
  "KNOWLEDGE_GAP",
  "DATA_GAP",
  "EXPERT_GAP",
] as const;

const LEARNING_PERMISSIONS = ["none", "aggregate", "full"] as const;

const ESCALATION_STATUSES = [
  "requested",
  "authorized",
  "in-progress",
  "delivered",
  "applied",
  "rejected",
  "cancelled",
] as const;

const RUN_STATUSES = ["started", "completed", "failed", "aborted"] as const;

const GATE_REASONS = [
  "granted",
  "missing",
  "withdrawn",
  "expired",
  "scope-mismatch",
] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolveEscalationMessages("en-US");
  const zh = resolveEscalationMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  // 键集非空且都带 you.escalation. 前缀（you 子树文案表口径）。
  assert.ok(enKeys.length > 200);
  for (const key of enKeys) {
    assert.match(key, /^you\.escalation\./);
  }
});

test("unknown locale falls back to en-US", () => {
  const en = resolveEscalationMessages("en-US");
  const fallback = resolveEscalationMessages("fr-FR");
  assert.deepEqual(fallback, en);
});

test("every demo step message id exists in both catalogs", () => {
  const en = resolveEscalationMessages("en-US");
  const zh = resolveEscalationMessages("zh-CN");
  for (const demoStep of ESCALATION_DEMO_STEPS) {
    assert.ok(en[demoStep.titleMessageId], `missing en title ${demoStep.titleMessageId}`);
    assert.ok(en[demoStep.descriptionMessageId], `missing en description ${demoStep.descriptionMessageId}`);
    assert.ok(zh[demoStep.titleMessageId], `missing zh title ${demoStep.titleMessageId}`);
    assert.ok(zh[demoStep.descriptionMessageId], `missing zh description ${demoStep.descriptionMessageId}`);
  }
});

test("panel, category, permission, status and run-status labels exist in both catalogs", () => {
  const en = resolveEscalationMessages("en-US");
  const zh = resolveEscalationMessages("zh-CN");
  for (const panel of PANEL_IDS) {
    assert.ok(en[`you.escalation.panel.${panel}`], `missing en panel ${panel}`);
    assert.ok(zh[`you.escalation.panel.${panel}`], `missing zh panel ${panel}`);
  }
  for (const category of GAP_CATEGORIES) {
    assert.ok(en[`you.escalation.gaps.category.${category}`]);
    assert.ok(zh[`you.escalation.gaps.category.${category}`]);
  }
  for (const permission of LEARNING_PERMISSIONS) {
    assert.ok(en[`you.escalation.gate.permission.${permission}`]);
    assert.ok(zh[`you.escalation.gate.permission.${permission}`]);
    assert.ok(en[`you.escalation.permissions.permission.${permission}`]);
    assert.ok(zh[`you.escalation.permissions.permission.${permission}`]);
  }
  for (const status of ESCALATION_STATUSES) {
    assert.ok(en[`you.escalation.progress.status.${status}`]);
    assert.ok(zh[`you.escalation.progress.status.${status}`]);
  }
  for (const status of RUN_STATUSES) {
    assert.ok(en[`you.escalation.progress.runs.status.${status}`]);
    assert.ok(zh[`you.escalation.progress.runs.status.${status}`]);
  }
  for (const reason of GATE_REASONS) {
    assert.ok(en[`you.escalation.gate.live.reason.${reason}`]);
    assert.ok(zh[`you.escalation.gate.live.reason.${reason}`]);
  }
  for (const resultType of ["typed-payload", "artifact", "guidance"] as const) {
    assert.ok(en[`you.escalation.results.resultType.${resultType}`]);
    assert.ok(zh[`you.escalation.results.resultType.${resultType}`]);
  }
  for (const eligibility of ["not-eligible", "eligible", "escalated"] as const) {
    assert.ok(en[`you.escalation.gaps.eligibility.${eligibility}`]);
    assert.ok(zh[`you.escalation.gaps.eligibility.${eligibility}`]);
  }
});

test("typed error panel explanations exist for every acceptance code and are substantive", () => {
  const en = resolveEscalationMessages("en-US");
  const zh = resolveEscalationMessages("zh-CN");
  for (const code of TYPED_ERROR_CODES) {
    const enExplanation = en[`you.escalation.error.${code}`];
    const zhExplanation = zh[`you.escalation.error.${code}`];
    assert.ok(enExplanation, `missing en error explanation ${code}`);
    assert.ok(zhExplanation, `missing zh error explanation ${code}`);
    // en 解释有实质内容（> 40 字符——与 W6B 同款纪律）。
    assert.ok(enExplanation.length > 40, `en explanation too short for ${code}`);
  }
  assert.ok(en["you.escalation.error.caption"]);
  assert.ok(zh["you.escalation.error.caption"]);
});

test("placeholder semantics and fallback behavior match the central intl contract", () => {
  const en = resolveEscalationMessages("en-US");
  const zh = resolveEscalationMessages("zh-CN");
  // {current}/{total} 占位符替换。
  assert.equal(
    formatEscalationMessage(en, "you.escalation.demo.step", { current: 3, total: 32 }),
    "Step 3 / 32",
  );
  assert.equal(
    formatEscalationMessage(zh, "you.escalation.demo.step", { current: 3, total: 32 }),
    "步骤 3 / 32",
  );
  // {permission} 占位符替换（许可门显示）。
  assert.equal(
    formatEscalationMessage(en, "you.escalation.permissions.gate.allowed", {
      permission: "aggregate",
    }),
    "learning permitted (aggregate)",
  );
  // 缺失键回退 en-US，再回退 id。
  assert.equal(formatEscalationMessage(zh, "you.escalation.missing-key"), "you.escalation.missing-key");
  assert.equal(formatEscalationMessage({}, "you.escalation.tabTitle"), "Escalation");
  // 无 values 时不做替换。
  assert.equal(
    formatEscalationMessage(en, "you.escalation.demo.step"),
    "Step {current} / {total}",
  );
});
