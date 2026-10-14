// YOU Hardening Studio — W10B 确定性剧本数据。
//
// 边界（docs/you/WORK_ORDERS.md W10B / docs/you/CONTRACTS.md "Wave-10 contract
// freeze (v10)"）：
// - Worker A（W10A）拥有 platform hardening 权威（rate-limit policies + enforcement
//   records、import security verdicts + quarantine、retention enforcement、DR restore
//   verification）；Worker C（W10C）拥有 ecosystem hardening 权威（provider matrix
//   registry、cost/latency budgets、production eligibility + rollback evidence）。
//   B **不新增 fixture 生成器**。本文件是「剧本」（storyboard）：契约形状的固定
//   字面量记录 + 声明式表，供 `hardeningSimulatedController.ts` 驱动确定性演示；
//   所有记录 simulated: true。W10C 的 provider matrix 在此仅以 release-readiness
//   决定的 subject 注册面镜像（声明侧镜像——与 W9B 世界/预算 intake 镜像 W9C
//   同款先例；T10 换绑时逐方法对位）。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v10 `you/contract.ts`），禁止本地
//   重声明。
// - TODO(T10): Worker A 的 platform hardening 服务与 Worker C 的 ecosystem
//   hardening 服务合入后，由 TL 把 UI 端口换绑到真实服务；本剧本届时随模拟控制器
//   整体退役。
//
// 确定性法则（docs/you/FIXTURES.md）：不调用 Date.now/Math.random/网络；一切输出
// 排序稳定（按 id / 追加序）。内容寻址：artifact / snapshot / rollback-evidence
// 标签一律 contentRef/contentHash 风格标签，绝不内联。
import type { ConsentState, RateLimitAction } from "@zcode/shared";
import { computeCaptureFixtureHash } from "./captureStoryboard.js";

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const HARDENING_STORYBOARD_SEED = "you-w10b-hardening-studio-001";

export const HARDENING_STORYBOARD_DISPLAY_NAME = "Hardening Studio — Aria";

export const HARDENING_STORYBOARD_SOLUTION_ID = "fx-hardening-studio";

// ---------------------------------------------------------------------------
// 分类学（frozen v10：3 rate-limit action / 3 import verdict / 5 consent
// state —— RATE LIMIT / IMPORT SECURITY / RETENTION 法则的显示面）
// ---------------------------------------------------------------------------

export const HARDENING_STORYBOARD_RATE_LIMIT_ACTIONS: readonly RateLimitAction[] = [
  "deny",
  "defer",
  "shed",
];

export const HARDENING_STORYBOARD_IMPORT_VERDICTS: readonly string[] = [
  "clean",
  "quarantined",
  "rejected",
];

export const HARDENING_STORYBOARD_CONSENT_STATES: readonly ConsentState[] = [
  "unknown",
  "granted",
  "denied",
  "expired",
  "withdrawn",
];

/** 稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
export function compareHardeningStoryboardId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 内容寻址（artifact / snapshot / rollback-evidence 标签；绝不内联）
// ---------------------------------------------------------------------------

export interface HardeningContentBinding {
  readonly contentRef: string;
  readonly contentHash: string;
}

/** 依据键文本派生确定性内容绑定（fixture 哈希；simulated 全程标注）。 */
export function hardeningContentBinding(key: string): HardeningContentBinding {
  return {
    contentRef: `fx-content-${computeCaptureFixtureHash(`${HARDENING_STORYBOARD_SEED}:${key}`)}`,
    contentHash: `sha256-fixture-${computeCaptureFixtureHash(`${HARDENING_STORYBOARD_SEED}:${key}:content`)}`,
  };
}

// ---------------------------------------------------------------------------
// Rate limit policy 预设（enforce 动作的挑选数据源；RATE LIMIT LAW：enforce
// BEFORE effect；每次 enforcement append 不可变记录；throttling 绝不静默）
// ---------------------------------------------------------------------------

export interface StoryboardRateLimitPolicy {
  readonly id: string;
  readonly scope: string;
  readonly windowS: number;
  readonly burst: number;
  readonly action: RateLimitAction;
}

/**
 * 三条策略覆盖 frozen v10 全部三个 action（deny = fail-closed；defer = 可排队
 * 工作专用；shed = 削峰丢弃）。窗内配额耗尽 ⇒ enforcement 记录 + typed
 * YOU_RATE_LIMIT_EXCEEDED（携带 window 与 retry 指引——绝不静默）。
 */
export const HARDENING_STORYBOARD_RATE_LIMIT_POLICIES: readonly StoryboardRateLimitPolicy[] = [
  {
    id: "policy-render-submit",
    scope: "render.submit",
    windowS: 60,
    burst: 3,
    action: "deny",
  },
  {
    id: "policy-import-scan",
    scope: "import.scan",
    windowS: 300,
    burst: 2,
    action: "defer",
  },
  {
    id: "policy-export-peak",
    scope: "export.render",
    windowS: 30,
    burst: 1,
    action: "shed",
  },
];

export function storyboardRateLimitPolicyById(
  id: string,
): StoryboardRateLimitPolicy | null {
  return (
    HARDENING_STORYBOARD_RATE_LIMIT_POLICIES.find((policy) => policy.id === id) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Import scan class 预设（IMPORT SECURITY LAW：unscanned imports never enter
// evidence——未注册 scan class 是诚实 typed 拒绝路径，绝不静默放行）
// ---------------------------------------------------------------------------

export interface StoryboardImportScanClass {
  readonly id: string;
  readonly scanClass: string;
  /** 形状是否合法（未注册 class = fail-closed typed 拒绝路径）。 */
  readonly valid: boolean;
}

export const HARDENING_STORYBOARD_IMPORT_SCAN_CLASSES: readonly StoryboardImportScanClass[] = [
  { id: "scan-class-media-upload", scanClass: "media-upload", valid: true },
  { id: "scan-class-package-bundle", scanClass: "package-bundle", valid: true },
  { id: "scan-class-model-weights", scanClass: "model-weights", valid: true },
  { id: "scan-class-unregistered", scanClass: "unregistered-scanner", valid: false },
];

export function storyboardImportScanClassById(
  id: string,
): StoryboardImportScanClass | null {
  return (
    HARDENING_STORYBOARD_IMPORT_SCAN_CLASSES.find((entry) => entry.id === id) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Import artifact 预设（被扫描对象；确定性 finding 决定 verdict——clean /
// quarantined / rejected 三路全覆盖，IMPORT SECURITY LAW 的可测面）
// ---------------------------------------------------------------------------

/** 扫描器 finding（fixture 确定性字面量；非真实扫描结果——truth law）。 */
export type StoryboardImportFinding = "clean" | "signature-hit" | "license-forbidden";

export interface StoryboardImportArtifact {
  readonly id: string;
  readonly artifactKey: string;
  readonly finding: StoryboardImportFinding;
}

export const HARDENING_STORYBOARD_IMPORT_ARTIFACTS: readonly StoryboardImportArtifact[] = [
  { id: "import-artifact-portrait", artifactKey: "portrait-frame-001", finding: "clean" },
  { id: "import-artifact-bundle-sig", artifactKey: "asset-bundle-042", finding: "signature-hit" },
  { id: "import-artifact-model-license", artifactKey: "vrm-model-007", finding: "license-forbidden" },
];

export function storyboardImportArtifactById(
  id: string,
): StoryboardImportArtifact | null {
  return (
    HARDENING_STORYBOARD_IMPORT_ARTIFACTS.find((entry) => entry.id === id) ?? null
  );
}

/** finding → frozen v10 verdict（确定性映射；无猜测）。 */
export function storyboardImportVerdictOfFinding(
  finding: StoryboardImportFinding,
): "clean" | "quarantined" | "rejected" {
  if (finding === "clean") return "clean";
  if (finding === "signature-hit") return "quarantined";
  return "rejected";
}

// ---------------------------------------------------------------------------
// Retention class 预设（RETENTION LAW：enforcement 记录不可变可审计；
// retention class 绝不覆盖 active consent——consent 法律优先）
// ---------------------------------------------------------------------------

export interface StoryboardRetentionClass {
  readonly id: string;
  readonly retentionClass: string;
  /** 窗口描述（显示面；服务端拥有真实到期数学）。 */
  readonly windowLabel: string;
}

export const HARDENING_STORYBOARD_RETENTION_CLASSES: readonly StoryboardRetentionClass[] = [
  { id: "retention-class-evidence-raw", retentionClass: "evidence-raw", windowLabel: "90d" },
  { id: "retention-class-telemetry", retentionClass: "telemetry", windowLabel: "30d" },
  { id: "retention-class-render-cache", retentionClass: "render-cache", windowLabel: "7d" },
];

export function storyboardRetentionClassById(
  id: string,
): StoryboardRetentionClass | null {
  return (
    HARDENING_STORYBOARD_RETENTION_CLASSES.find((entry) => entry.id === id) ?? null
  );
}

// ---------------------------------------------------------------------------
// Retention subject 预设（携带 wave-2 consent 状态投影——consent-protected
// 指示器的数据源；granted = active consent，enforcement 被 typed 拒绝）
// ---------------------------------------------------------------------------

export interface StoryboardRetentionSubject {
  readonly id: string;
  readonly subjectKey: string;
  readonly consentState: ConsentState;
}

/**
 * 四条 subject 覆盖 consent 法律的关键分支：granted（active——RETENTION LAW
// 拒绝路径）、withdrawn（同意已撤回——enforcement 放行）、expired（同意过期——
// 放行）、denied（同意拒绝——放行）。
 */
export const HARDENING_STORYBOARD_RETENTION_SUBJECTS: readonly StoryboardRetentionSubject[] = [
  { id: "subject-evidence-granted", subjectKey: "evidence-session-001", consentState: "granted" },
  { id: "subject-evidence-withdrawn", subjectKey: "evidence-session-002", consentState: "withdrawn" },
  { id: "subject-evidence-expired", subjectKey: "evidence-session-003", consentState: "expired" },
  { id: "subject-telemetry-denied", subjectKey: "telemetry-stream-004", consentState: "denied" },
];

export function storyboardRetentionSubjectById(
  id: string,
): StoryboardRetentionSubject | null {
  return (
    HARDENING_STORYBOARD_RETENTION_SUBJECTS.find((entry) => entry.id === id) ??
    null
  );
}

// ---------------------------------------------------------------------------
// DR snapshot 预设（DR LAW：restore 在 activation 前校验 content hash；
// verified flag 绝不在无 check evidence 时断言）
// ---------------------------------------------------------------------------

export interface StoryboardDrSnapshot {
  readonly id: string;
  readonly snapshotKey: string;
}

export const HARDENING_STORYBOARD_DR_SNAPSHOTS: readonly StoryboardDrSnapshot[] = [
  { id: "dr-snapshot-primary", snapshotKey: "workspace-snapshot-001" },
  { id: "dr-snapshot-secondary", snapshotKey: "workspace-snapshot-002" },
];

export function storyboardDrSnapshotById(id: string): StoryboardDrSnapshot | null {
  return (
    HARDENING_STORYBOARD_DR_SNAPSHOTS.find((entry) => entry.id === id) ?? null
  );
}

/** snapshot 的确定性 content hash（restore 前校验的期望值——绝不内联内容）。 */
export function storyboardDrSnapshotHash(snapshotKey: string): string {
  return `sha256-fixture-${computeCaptureFixtureHash(
    `${HARDENING_STORYBOARD_SEED}:dr-snapshot:${snapshotKey}`,
  )}`;
}

/** DR integrity 预设（与 W8B/W9B 过期/污染预设同款诚实路径）。 */
export const HARDENING_STORYBOARD_DR_INTEGRITIES: readonly ("honest" | "corrupted")[] = [
  "honest",
  "corrupted",
];

// ---------------------------------------------------------------------------
// Provider matrix 注册面（W10C ecosystem gate 的声明侧镜像——release-readiness
// 决定的 subject 数据源；unknown matrix ref ⇒ typed
// YOU_PROVIDER_MATRIX_INVALID，ECOSYSTEM GATE LAW 显示面）
// ---------------------------------------------------------------------------

export interface StoryboardMatrixEntry {
  readonly id: string;
  readonly matrixRef: string;
  readonly providerKind: string;
  readonly region: string;
  readonly capabilityClasses: readonly string[];
  /** 注册面 eligible（生态门准入——与 production eligibility 是两回事）。 */
  readonly eligible: boolean;
  /** 形状是否合法（未注册 ref = typed 拒绝路径，fail closed）。 */
  readonly valid: boolean;
}

export const HARDENING_STORYBOARD_MATRIX_ENTRIES: readonly StoryboardMatrixEntry[] = [
  {
    id: "matrix-render-eu",
    matrixRef: "fx-matrix-render-eu",
    providerKind: "render",
    region: "eu-central",
    capabilityClasses: ["render", "timeline"],
    eligible: true,
    valid: true,
  },
  {
    id: "matrix-telepresence-us",
    matrixRef: "fx-matrix-telepresence-us",
    providerKind: "telepresence",
    region: "us-west",
    capabilityClasses: ["realtime", "webrtc"],
    eligible: true,
    valid: true,
  },
  {
    id: "matrix-render-audit",
    matrixRef: "fx-matrix-render-audit",
    providerKind: "render",
    region: "ap-south",
    capabilityClasses: ["render"],
    eligible: false,
    valid: true,
  },
  {
    id: "matrix-unknown-legacy",
    matrixRef: "fx-matrix-unknown-legacy",
    providerKind: "legacy",
    region: "unknown",
    capabilityClasses: [],
    eligible: false,
    valid: false,
  },
];

export function storyboardMatrixEntryById(id: string): StoryboardMatrixEntry | null {
  return (
    HARDENING_STORYBOARD_MATRIX_ENTRIES.find((entry) => entry.id === id) ?? null
  );
}

// ---------------------------------------------------------------------------
// Rollback evidence 预设（PRODUCTION ELIGIBILITY LAW：eligibility requires
// rollback evidence——无证据的 eligible 决定是 typed 拒绝路径）
// ---------------------------------------------------------------------------

export interface StoryboardRollbackEvidence {
  readonly id: string;
  readonly evidenceKey: string;
  /** 是否携带真实回滚演练证据（none = 诚实拒绝路径）。 */
  readonly present: boolean;
}

export const HARDENING_STORYBOARD_ROLLBACK_EVIDENCE: readonly StoryboardRollbackEvidence[] = [
  { id: "rollback-drill-render-eu", evidenceKey: "drill-render-eu-2025-06", present: true },
  { id: "rollback-drill-telepresence", evidenceKey: "drill-telepresence-2025-06", present: true },
  { id: "rollback-evidence-none", evidenceKey: "none", present: false },
];

export function storyboardRollbackEvidenceById(
  id: string,
): StoryboardRollbackEvidence | null {
  return (
    HARDENING_STORYBOARD_ROLLBACK_EVIDENCE.find((entry) => entry.id === id) ??
    null
  );
}
