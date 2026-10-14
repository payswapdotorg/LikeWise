// W11B logic tests — Conformance 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、面板 id
// 文案存在、分类学文案存在（三 metrics 来源 / 两 outcome / 两 run kind / 两
// review kind / 两 runbook kind / 两 journey kind / 六门 reason / 三 pass state）、
// typed 错误面板文案存在（五个验收 code + UNEXPECTED，en 解释 > 40 字符）、
// 占位符语义与回退行为。
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatConformanceMessage,
  resolveConformanceMessages,
} from "./conformanceMessages.js";
import { CONFORMANCE_DEMO_STEPS } from "./conformanceStudioDemo.js";

const PANEL_IDS = [
  "review",
  "load",
  "conformance",
  "journey",
  "runbook",
  "demo",
] as const;

const TYPED_ERROR_CODES = [
  "YOU_SECURITY_REVIEW_INVALID",
  "YOU_LOAD_TEST_INVALID",
  "YOU_CONFORMANCE_AUDIT_INVALID",
  "YOU_E2E_JOURNEY_INVALID",
  "YOU_RUNBOOK_INVALID",
  "UNEXPECTED",
] as const;

const METRICS_SOURCES = ["measured", "simulated", "invented"] as const;

const AUDIT_OUTCOMES = ["full", "partial"] as const;

const RUN_KINDS = ["measured", "simulated"] as const;

const REVIEW_KINDS = ["review", "acceptance"] as const;

const RUNBOOK_KINDS = ["registration", "exercise"] as const;

const JOURNEY_KINDS = ["golden", "failure-injection"] as const;

const GATE_REASONS = [
  "granted",
  "acceptance-without-findings",
  "unknown-review",
  "already-accepted",
  "acceptance-not-acceptable",
  "review-not-selected",
] as const;

const PASS_STATES = ["all-passed", "partial", "none-passed"] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolveConformanceMessages("en-US");
  const zh = resolveConformanceMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  assert.ok(enKeys.length > 200, `expected a full catalog, got ${enKeys.length} keys`);
  // 未知 locale 回退 en-US（与中央 IntlProvider 语义一致）。
  assert.deepEqual(
    Object.keys(resolveConformanceMessages("fr-FR")).sort(),
    enKeys,
  );
});

test("every panel id, taxonomy value, gate reason and pass state has a label in both locales", () => {
  const en = resolveConformanceMessages("en-US");
  const zh = resolveConformanceMessages("zh-CN");
  for (const id of PANEL_IDS) {
    assert.ok(en[`you.conformance.panel.${id}`], `missing en panel label ${id}`);
    assert.ok(zh[`you.conformance.panel.${id}`], `missing zh panel label ${id}`);
  }
  for (const source of METRICS_SOURCES) {
    assert.ok(en[`you.conformance.metrics.${source}`]);
    assert.ok(zh[`you.conformance.metrics.${source}`]);
  }
  for (const outcome of AUDIT_OUTCOMES) {
    assert.ok(en[`you.conformance.outcome.${outcome}`]);
    assert.ok(zh[`you.conformance.outcome.${outcome}`]);
  }
  for (const runKind of RUN_KINDS) {
    assert.ok(en[`you.conformance.runKind.${runKind}`]);
    assert.ok(zh[`you.conformance.runKind.${runKind}`]);
  }
  for (const kind of REVIEW_KINDS) {
    assert.ok(en[`you.conformance.review.kind.${kind}`]);
    assert.ok(zh[`you.conformance.review.kind.${kind}`]);
  }
  for (const kind of RUNBOOK_KINDS) {
    assert.ok(en[`you.conformance.runbook.kind.${kind}`]);
    assert.ok(zh[`you.conformance.runbook.kind.${kind}`]);
  }
  for (const kind of JOURNEY_KINDS) {
    assert.ok(en[`you.conformance.journey.kind.${kind}`]);
    assert.ok(zh[`you.conformance.journey.kind.${kind}`]);
  }
  for (const reason of GATE_REASONS) {
    assert.ok(en[`you.conformance.review.gate.reason.${reason}`]);
    assert.ok(zh[`you.conformance.review.gate.reason.${reason}`]);
  }
  for (const passState of PASS_STATES) {
    assert.ok(en[`you.conformance.checks.audits.passState.${passState}`]);
    assert.ok(zh[`you.conformance.checks.audits.passState.${passState}`]);
  }
});

test("every demo step message id exists in both locales (titles + descriptions)", () => {
  const en = resolveConformanceMessages("en-US");
  const zh = resolveConformanceMessages("zh-CN");
  for (const demoStep of CONFORMANCE_DEMO_STEPS) {
    assert.ok(en[demoStep.titleMessageId], `missing en ${demoStep.titleMessageId}`);
    assert.ok(zh[demoStep.titleMessageId], `missing zh ${demoStep.titleMessageId}`);
    assert.ok(
      en[demoStep.descriptionMessageId],
      `missing en ${demoStep.descriptionMessageId}`,
    );
    assert.ok(
      zh[demoStep.descriptionMessageId],
      `missing zh ${demoStep.descriptionMessageId}`,
    );
  }
});

test("typed error panels exist for all five v11 codes plus UNEXPECTED with substantive explanations", () => {
  const en = resolveConformanceMessages("en-US");
  const zh = resolveConformanceMessages("zh-CN");
  for (const code of TYPED_ERROR_CODES) {
    const enText = en[`you.conformance.error.${code}`];
    const zhText = zh[`you.conformance.error.${code}`];
    assert.ok(enText, `missing en typed error panel ${code}`);
    assert.ok(zhText, `missing zh typed error panel ${code}`);
    assert.ok(
      enText.length > 40,
      `en typed error panel ${code} too short (${enText.length})`,
    );
    assert.ok(zhText.length > 20, `zh typed error panel ${code} too short`);
  }
  assert.ok(en["you.conformance.error.caption"]);
  assert.ok(zh["you.conformance.error.caption"]);
});

test("placeholder semantics and fallback behavior match the central catalog", () => {
  const en = resolveConformanceMessages("en-US");
  const zh = resolveConformanceMessages("zh-CN");
  assert.equal(
    formatConformanceMessage(en, "you.conformance.load.scenarios.rps", { rps: 240 }),
    "240 rps",
  );
  assert.equal(
    formatConformanceMessage(zh, "you.conformance.journey.runs.durationMs", { ms: 18200 }),
    "18200 毫秒",
  );
  assert.equal(
    formatConformanceMessage(en, "you.conformance.checks.run.projected", {
      passed: 27,
      total: 30,
    }),
    "projected counts: 27/30",
  );
  // 缺失键：回退 en-US，再回退 id。
  assert.equal(formatConformanceMessage({}, "you.conformance.tabTitle"), "Conformance");
  assert.equal(formatConformanceMessage({}, "missing.key.id"), "missing.key.id");
  // 无占位符值时原文返回。
  assert.equal(
    formatConformanceMessage(en, "you.conformance.simulatedNote"),
    en["you.conformance.simulatedNote"],
  );
});
