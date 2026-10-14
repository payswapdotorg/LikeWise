// W10B logic tests — Hardening 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、面板 id
// 文案存在、分类学文案存在（三 action / 三 verdict / 五 consent / 两 verification /
// 两 integrity / 两 kind / 六门 reason）、typed 错误面板文案存在（六个验收 code +
// UNEXPECTED，en 解释 > 40 字符）、占位符语义与回退行为。
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatHardeningMessage,
  resolveHardeningMessages,
} from "./hardeningMessages.js";
import { HARDENING_DEMO_STEPS } from "./hardeningStudioDemo.js";

const PANEL_IDS = ["limits", "imports", "retention", "dr", "release", "demo"] as const;

const TYPED_ERROR_CODES = [
  "YOU_RATE_LIMIT_EXCEEDED",
  "YOU_IMPORT_QUARANTINED",
  "YOU_RETENTION_ENFORCEMENT_INVALID",
  "YOU_DR_RESTORE_INVALID",
  "YOU_PROVIDER_MATRIX_INVALID",
  "YOU_PRODUCTION_ELIGIBILITY_INVALID",
  "UNEXPECTED",
] as const;

const RATE_LIMIT_ACTIONS = ["deny", "defer", "shed"] as const;

const IMPORT_VERDICTS = ["clean", "quarantined", "rejected"] as const;

const CONSENT_STATES = [
  "unknown",
  "granted",
  "denied",
  "expired",
  "withdrawn",
] as const;

const DR_VERIFICATIONS = ["verified", "unverified"] as const;

const DR_INTEGRITIES = ["honest", "corrupted"] as const;

const RELEASE_KINDS = ["decision", "reversal"] as const;

const GATE_REASONS = [
  "granted",
  "unknown-provider-matrix-ref",
  "missing-rollback-evidence",
  "unknown-evidence-preset",
  "unknown-rollback-evidence",
  "matrix-entry-not-selected",
] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolveHardeningMessages("en-US");
  const zh = resolveHardeningMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  assert.ok(enKeys.length > 200, `expected a full catalog, got ${enKeys.length} keys`);
});

test("every catalog value is a non-empty string with only whitelisted placeholders", () => {
  // 占位符白名单（格式化时填充的具名参数）；白名单之外的 `{...}` 是文案笔误。
  const PLACEHOLDER_NAMES = new Set([
    "current",
    "total",
    "seconds",
    "remaining",
    "burst",
    "windowS",
  ]);
  for (const locale of ["en-US", "zh-CN"] as const) {
    const messages = resolveHardeningMessages(locale);
    for (const [key, value] of Object.entries(messages)) {
      assert.equal(typeof value, "string", `${locale} ${key}`);
      assert.ok(value.trim().length > 0, `${locale} ${key} empty`);
      for (const match of value.matchAll(/\{(\w+)\}/g)) {
        const name = match[1]!;
        assert.ok(
          PLACEHOLDER_NAMES.has(name),
          `${locale} ${key} carries an unknown placeholder {${name}}`,
        );
      }
    }
  }
});

test("panel ids and every taxonomy value have labels", () => {
  const en = resolveHardeningMessages("en-US");
  const zh = resolveHardeningMessages("zh-CN");
  for (const id of PANEL_IDS) {
    assert.ok(en[`you.hardening.panel.${id}`]);
    assert.ok(zh[`you.hardening.panel.${id}`]);
  }
  for (const action of RATE_LIMIT_ACTIONS) {
    assert.ok(en[`you.hardening.limits.action.${action}`]);
    assert.ok(zh[`you.hardening.limits.action.${action}`]);
    assert.ok(en[`you.hardening.limits.guidance.${action}`]);
    assert.ok(zh[`you.hardening.limits.guidance.${action}`]);
  }
  for (const verdict of IMPORT_VERDICTS) {
    assert.ok(en[`you.hardening.import.verdict.${verdict}`]);
    assert.ok(zh[`you.hardening.import.verdict.${verdict}`]);
  }
  for (const consent of CONSENT_STATES) {
    assert.ok(en[`you.hardening.retention.consent.${consent}`]);
    assert.ok(zh[`you.hardening.retention.consent.${consent}`]);
  }
  for (const verification of DR_VERIFICATIONS) {
    assert.ok(en[`you.hardening.dr.verification.${verification}`]);
    assert.ok(zh[`you.hardening.dr.verification.${verification}`]);
  }
  for (const integrity of DR_INTEGRITIES) {
    assert.ok(en[`you.hardening.dr.integrity.${integrity}`]);
    assert.ok(zh[`you.hardening.dr.integrity.${integrity}`]);
  }
  for (const kind of RELEASE_KINDS) {
    assert.ok(en[`you.hardening.release.kind.${kind}`]);
    assert.ok(zh[`you.hardening.release.kind.${kind}`]);
  }
  for (const reason of GATE_REASONS) {
    assert.ok(en[`you.hardening.release.gate.reason.${reason}`]);
    assert.ok(zh[`you.hardening.release.gate.reason.${reason}`]);
  }
});

test("typed error panels exist for every acceptance code with substantive explanations", () => {
  const en = resolveHardeningMessages("en-US");
  const zh = resolveHardeningMessages("zh-CN");
  for (const code of TYPED_ERROR_CODES) {
    assert.ok(en[`you.hardening.error.${code}`], `missing en copy for ${code}`);
    assert.ok(zh[`you.hardening.error.${code}`], `missing zh copy for ${code}`);
    // 解释须实质（> 40 字符）——typed 错误面板的说明不能是占位符。
    assert.ok(
      en[`you.hardening.error.${code}`]!.length > 40,
      `en copy too thin for ${code}`,
    );
  }
});

test("demo step copy exists for every step in the golden sequence (both locales)", () => {
  const en = resolveHardeningMessages("en-US");
  const zh = resolveHardeningMessages("zh-CN");
  assert.ok(HARDENING_DEMO_STEPS.length >= 20);
  for (const demoStep of HARDENING_DEMO_STEPS) {
    assert.ok(en[demoStep.titleMessageId], `missing en title ${demoStep.id}`);
    assert.ok(en[demoStep.descriptionMessageId], `missing en description ${demoStep.id}`);
    assert.ok(zh[demoStep.titleMessageId], `missing zh title ${demoStep.id}`);
    assert.ok(zh[demoStep.descriptionMessageId], `missing zh description ${demoStep.id}`);
  }
});

test("formatHardeningMessage resolves {key} placeholders and falls back en-US then id", () => {
  const en = resolveHardeningMessages("en-US");
  assert.equal(
    formatHardeningMessage(en, "you.hardening.demo.step", { current: 2, total: 24 }),
    "Step 2 / 24",
  );
  const zh = resolveHardeningMessages("zh-CN");
  assert.equal(
    formatHardeningMessage(zh, "you.hardening.demo.step", { current: 2, total: 24 }),
    "步骤 2 / 24",
  );
  // 缺失键：zh 表回退 en 表；两表皆缺 → 原样返回 id（与中央 IntlProvider 同款）。
  assert.equal(
    formatHardeningMessage(zh, "you.hardening.missing.key"),
    "you.hardening.missing.key",
  );
  assert.equal(formatHardeningMessage({}, "you.hardening.tabTitle"), "Hardening");
  // 未知 locale 回退 en-US。
  assert.equal(
    resolveHardeningMessages("fr-FR"),
    resolveHardeningMessages("en-US"),
  );
});
