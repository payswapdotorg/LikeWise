// YOU Conformance Studio — W11B 确定性剧本数据。
//
// 边界（docs/you/WORK_ORDERS.md W11B / docs/you/CONTRACTS.md "Wave-11 contract
// freeze (v11)"）：
// - Worker A（W11A）拥有 security-review / load-test 权威（ThreatModelEntry /
//   SecurityReviewRecord / LoadTestReport 持久化）；Worker C（W11C）拥有 E2E
//   journey harness 与 incident runbook 权威（20 点 launch-gate journey、
//   failure injection、runbook exercising、conformance audit builders）。
//   B **不新增 fixture 生成器**。本文件是「剧本」（storyboard）：契约形状的固定
//   字面量记录 + 声明式表，供 `conformanceSimulatedController.ts` 驱动确定性演示；
//   所有记录 simulated: true。W11A/W11C 的服务接缝在此以声明侧镜像呈现（与
//   W9B 世界/预算 intake 镜像 W9C、W10B matrix 注册面镜像 W10C 同款先例；
//   T11 换绑时逐方法对位）。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v11 `you/contract.ts`），禁止本地
//   重声明。
// - TODO(T11): W11A 的 security authority 服务与 W11C 的 E2E runbook 服务合入后，
//   由 TL 把 UI 端口换绑到真实服务；本剧本届时随模拟控制器整体退役。
//
// 确定性法则（docs/you/FIXTURES.md）：不调用 Date.now/Math.random/网络；一切输出
// 排序稳定（按 id / 追加序）。内容寻址：scope / scenario / journey 标签一律
// contentRef/contentHash 风格标签，绝不内联。
import { computeCaptureFixtureHash } from "./captureStoryboard.js";

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const CONFORMANCE_STORYBOARD_SEED = "you-w11b-conformance-studio-001";

export const CONFORMANCE_STORYBOARD_DISPLAY_NAME = "Conformance Studio — Aria";

export const CONFORMANCE_STORYBOARD_SOLUTION_ID = "fx-conformance-studio";

// ---------------------------------------------------------------------------
// 分类学（端口级显示面：load-test metrics 来源 / audit outcome / journey run
// 种类 —— LOAD TEST / CONFORMANCE / JOURNEY 法则的显示面）
// ---------------------------------------------------------------------------

/**
 * load-test 指标的来源分类（LOAD TEST LAW：peak/p99 measured 或
 * simulated-labeled——invented 是诚实 typed 拒绝路径，绝不落账）。
 */
export const CONFORMANCE_STORYBOARD_METRICS_SOURCES: readonly (
  "measured" | "simulated" | "invented"
)[] = ["measured", "simulated", "invented"];

/** conformance audit 的结果意图（CONFORMANCE LAW：counts 永远 verbatim）。 */
export const CONFORMANCE_STORYBOARD_AUDIT_OUTCOMES: readonly (
  "full" | "partial"
)[] = ["full", "partial"];

/**
 * journey run 的种类（JOURNEY LAW：measured duration；simulated runs stay
 * labeled——fixture 支撑面绝不伪造 measured 数值）。
 */
export const CONFORMANCE_STORYBOARD_RUN_KINDS: readonly (
  "measured" | "simulated"
)[] = ["measured", "simulated"];

/** 稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
export function compareConformanceStoryboardId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 内容寻址（scope / scenario / journey 标签；绝不内联）
// ---------------------------------------------------------------------------

export interface ConformanceContentBinding {
  readonly contentRef: string;
  readonly contentHash: string;
}

/** 依据键文本派生确定性内容绑定（fixture 哈希；simulated 全程标注）。 */
export function conformanceContentBinding(key: string): ConformanceContentBinding {
  return {
    contentRef: `fx-content-${computeCaptureFixtureHash(`${CONFORMANCE_STORYBOARD_SEED}:${key}`)}`,
    contentHash: `sha256-fixture-${computeCaptureFixtureHash(`${CONFORMANCE_STORYBOARD_SEED}:${key}:content`)}`,
  };
}

// ---------------------------------------------------------------------------
// Security review scope 预设（SECURITY REVIEW LAW：findings recorded verbatim；
// acceptance 是引用 finding set 的独立不可变决定）
// ---------------------------------------------------------------------------

export interface StoryboardReviewScope {
  readonly id: string;
  readonly scopeKey: string;
  /** 该 scope 的确定性 finding set 大小（findings verbatim 的计数投影）。 */
  readonly findingsCount: number;
}

/**
 * 三条 scope 覆盖 SECURITY REVIEW LAW 的关键分支：非零 findings（可接受的
// review 路径）、单条 findings（最小非空 finding set）、零 findings（acceptance
// without findings 的诚实 typed 拒绝路径）。
 */
export const CONFORMANCE_STORYBOARD_REVIEW_SCOPES: readonly StoryboardReviewScope[] = [
  {
    id: "review-scope-evidence-plane",
    scopeKey: "evidence-plane-capture-consent",
    findingsCount: 3,
  },
  {
    id: "review-scope-render-pipeline",
    scopeKey: "render-pipeline-adapters",
    findingsCount: 1,
  },
  {
    id: "review-scope-zero-findings",
    scopeKey: "empty-sweep-baseline",
    findingsCount: 0,
  },
];

export function storyboardReviewScopeById(
  id: string,
): StoryboardReviewScope | null {
  return (
    CONFORMANCE_STORYBOARD_REVIEW_SCOPES.find((entry) => entry.id === id) ?? null
  );
}

// ---------------------------------------------------------------------------
// Load test scenario 预设（LOAD TEST LAW：peak/p99 measured 或 simulated-labeled
// —— 绝不 invented；regressions listed verbatim，绝不 summarize away）
// ---------------------------------------------------------------------------

export interface StoryboardLoadScenario {
  readonly id: string;
  readonly scenarioKey: string;
  /** 确定性峰值吞吐（fixture 预设；simulated run 时 simulated: true 落账）。 */
  readonly peakRps: number;
  /** 确定性 p99 延迟（ms）。 */
  readonly p99Ms: number;
  /** 回归清单（verbatim 列出——LOAD TEST LAW 显示面）。 */
  readonly regressions: readonly string[];
  /** 形状是否合法（未注册 scenario = fail-closed typed 拒绝路径）。 */
  readonly valid: boolean;
}

export const CONFORMANCE_STORYBOARD_LOAD_SCENARIOS: readonly StoryboardLoadScenario[] = [
  {
    id: "load-scenario-render-peak",
    scenarioKey: "render-peak-3600s",
    peakRps: 240,
    p99Ms: 420,
    regressions: [
      "export.render p99 +80ms vs baseline",
      "render.queue depth 2.1x baseline",
    ],
    valid: true,
  },
  {
    id: "load-scenario-import-burst",
    scenarioKey: "import-burst-600s",
    peakRps: 95,
    p99Ms: 210,
    regressions: [],
    valid: true,
  },
  {
    id: "load-scenario-unregistered",
    scenarioKey: "unregistered-scanner-profile",
    peakRps: 0,
    p99Ms: 0,
    regressions: [],
    valid: false,
  },
];

export function storyboardLoadScenarioById(
  id: string,
): StoryboardLoadScenario | null {
  return (
    CONFORMANCE_STORYBOARD_LOAD_SCENARIOS.find((entry) => entry.id === id) ?? null
  );
}

// ---------------------------------------------------------------------------
// Conformance standard 预设（CONFORMANCE LAW：checks-total / checks-passed
// stated verbatim —— 绝不 bare pass）
// ---------------------------------------------------------------------------

export interface StoryboardStandard {
  readonly id: string;
  readonly standard: string;
  readonly scopeKey: string;
  /** 标准的检查总数（checks-total 的权威来源）。 */
  readonly checksTotal: number;
  /** partial 结果的确定性通过数（full = checksTotal）。 */
  readonly partialChecksPassed: number;
}

/**
 * 三条 standard 覆盖 CONFORMANCE LAW 的关键分支：partial（27/30——counts
// verbatim 的主路径）、full（12/12——全过仍显示 counts）、零检查（0 检查的
// "pass" 是 typed 拒绝路径——counts 即 conformance 陈述本身）。
 */
export const CONFORMANCE_STORYBOARD_STANDARDS: readonly StoryboardStandard[] = [
  {
    id: "standard-wcag-aa",
    standard: "WCAG 2.2 AA",
    scopeKey: "solution-viewport-surface",
    checksTotal: 30,
    partialChecksPassed: 27,
  },
  {
    id: "standard-viewport-320",
    standard: "responsive-320px",
    scopeKey: "solution-viewport-surface",
    checksTotal: 12,
    partialChecksPassed: 9,
  },
  {
    id: "standard-zero-checks",
    standard: "empty-checklist-baseline",
    scopeKey: "legacy-surface",
    checksTotal: 0,
    partialChecksPassed: 0,
  },
];

export function storyboardStandardById(id: string): StoryboardStandard | null {
  return (
    CONFORMANCE_STORYBOARD_STANDARDS.find((entry) => entry.id === id) ?? null
  );
}

// ---------------------------------------------------------------------------
// E2E journey 预设（JOURNEY LAW：20 点 launch-gate journey 记录每一步
// completed 或 failed-at + measured duration；simulated runs stay labeled）
// ---------------------------------------------------------------------------

/**
 * 20 点 launch-gate journey 的固定步骤表（W11C 工单口径 verbatim：
 * workspace creation -> intent -> Solution -> inspect -> feedback -> evidence ->
 * Twin -> improve -> Performance -> render -> edit -> import/export -> version
 * accept -> learn with permission -> repeat -> capability gap -> Arena
 * escalation -> expert result -> provenance/consent -> injected-failure
 * recovery）。
 */
export const CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS: readonly string[] = [
  "workspace-create",
  "intent-capture",
  "solution-open",
  "solution-inspect",
  "feedback-submit",
  "evidence-record",
  "twin-reconstruct",
  "twin-improve",
  "performance-bind",
  "render-submit",
  "edit-session",
  "import-export",
  "version-accept",
  "learn-with-permission",
  "repeat-loop",
  "capability-gap",
  "arena-escalation",
  "expert-result",
  "provenance-consent",
  "injected-failure-recovery",
];

export const CONFORMANCE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS =
  CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS.length;

export interface StoryboardJourney {
  readonly id: string;
  readonly journeyId: string;
  /** 步骤表（20 点 launch gate）。 */
  readonly steps: readonly string[];
  /** 形状是否合法（未注册 journey = fail-closed typed 拒绝路径）。 */
  readonly valid: boolean;
}

export const CONFORMANCE_STORYBOARD_JOURNEYS: readonly StoryboardJourney[] = [
  {
    id: "journey-launch-gate",
    journeyId: "launch-gate-001",
    steps: CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS,
    valid: true,
  },
  {
    id: "journey-unknown-legacy",
    journeyId: "legacy-journey-000",
    steps: [],
    valid: false,
  },
];

export function storyboardJourneyById(id: string): StoryboardJourney | null {
  return CONFORMANCE_STORYBOARD_JOURNEYS.find((entry) => entry.id === id) ?? null;
}

/**
 * journey run 的确定性时长（JOURNEY LAW「measured duration」的 Phase-0 投影：
// 步数 × 单步开销 + 固定起步开销；failed run 追加恢复尝试开销——simulated run
// 全程 labeled，绝不伪装 measured）。
 */
export function storyboardJourneyDurationMs(
  stepsCompleted: number,
  failed: boolean,
): number {
  return 1200 + stepsCompleted * 850 + (failed ? 400 : 0);
}

// ---------------------------------------------------------------------------
// Incident class 预设（RUNBOOK LAW：每个 entry 被 ≥1 条 failure-injection
// journey 演练，或显式标注 unexercised）
// ---------------------------------------------------------------------------

export interface StoryboardIncidentClass {
  readonly id: string;
  readonly incidentClass: string;
  readonly detection: string;
  readonly containment: string;
  readonly recovery: string;
  /** failure-injection 绑定的步骤序（1-based；演练 journey 在此步失败）。 */
  readonly boundStepIndex: number;
  /** 形状是否合法（未注册 class = fail-closed typed 拒绝路径）。 */
  readonly valid: boolean;
}

/**
 * 四条 incident class 覆盖 RUNBOOK LAW 的关键分支：render 链路（绑 render 步）、
 * import 链路（绑 import-export 步）、恢复校验链路（绑 injected-failure-recovery
 * 步）、consent 链路（绑 provenance-consent 步——初始 unexercised 的诚实显示面，
 * 演练后才 exercised）。
 */
export const CONFORMANCE_STORYBOARD_INCIDENT_CLASSES: readonly StoryboardIncidentClass[] = [
  {
    id: "incident-render-provider-outage",
    incidentClass: "render-provider-outage",
    detection: "render job heartbeat loss beyond 2 windows on the primary provider",
    containment: "fail over to the secondary matrix provider; queue unstarted jobs durably",
    recovery: "re-submit the durable queue on the secondary; reconcile completed artifacts by content hash",
    boundStepIndex: 10,
    valid: true,
  },
  {
    id: "incident-import-quarantine-backlog",
    incidentClass: "import-quarantine-backlog",
    detection: "quarantine queue depth over the shed threshold for 5 consecutive windows",
    containment: "shed non-critical scans (rate-limit shed class); defer queueable work",
    recovery: "drain the backlog with deferred retries; release only through explicit release records",
    boundStepIndex: 12,
    valid: true,
  },
  {
    id: "incident-consent-revocation-lag",
    incidentClass: "consent-revocation-lag",
    detection: "consent ledger divergence scan marks a subject stale beyond the sync window",
    containment: "freeze evidence reads for the affected subject (consent laws hold)",
    recovery: "replay retention enforcement with the updated consent projection",
    boundStepIndex: 19,
    valid: true,
  },
  {
    id: "incident-recovery-verification-failure",
    incidentClass: "recovery-verification-failure",
    detection: "scheduled DR verify reports a content hash mismatch on the snapshot",
    containment: "isolate the corrupted snapshot; block activation (fail closed)",
    recovery: "restore from the secondary snapshot; re-verify before activation",
    boundStepIndex: 20,
    valid: true,
  },
];

export function storyboardIncidentClassById(
  id: string,
): StoryboardIncidentClass | null {
  return (
    CONFORMANCE_STORYBOARD_INCIDENT_CLASSES.find((entry) => entry.id === id) ??
    null
  );
}
