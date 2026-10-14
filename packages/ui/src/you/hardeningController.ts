// YOU Hardening Studio — HardeningStudioController 端口（W10B）。
//
// 边界（docs/you/WORK_ORDERS.md W10B / docs/you/CONTRACTS.md "Wave-10 contract
// freeze (v10)"）：
// - 本文件只定义 UI 消费的服务端口；product/platform hardening 的 canonical
//   truth 属于 Worker A 的 platform hardening 服务（W10A：rate-limit policies +
//   enforcement records、import security verdicts + quarantine、retention
//   enforcement、DR restore verification）与 Worker C 的 ecosystem hardening
//   服务（W10C：provider matrix、production eligibility + rollback evidence）。
//   UI 不实现领域逻辑。
// - 端口形状镜像 W10A/W10C 服务接缝 1:1（rate-limit enforce / import scan 与
//   release / retention enforce / DR restore / eligibility decide 与 reverse；
//   provider matrix 注册面为 W10C 接缝的声明侧镜像——T10 换绑时逐方法对位，
//   W8B/W9B 先例同款）。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v10 `you/contract.ts`），禁止本地
//   重声明。
// - Phase 0 的实现是 `hardeningSimulatedController.ts` 的确定性剧本；
//   TODO(T10): bind to Worker A/C 的 hardening 服务（TL 在 T10 换绑本端口）。
// - RATE LIMIT LAW：limits enforce BEFORE the effect；每次 enforcement append
//   不可变记录；throttling 绝不静默（deny/defer/shed 皆携 window 与 retry
//   指引；YOU_RATE_LIMIT_EXCEEDED）。
// - IMPORT SECURITY LAW：unscanned imports never enter evidence；quarantine
//   fail-closed 且仅经显式 release record 可逆（YOU_IMPORT_QUARANTINED）。
// - RETENTION LAW：enforcement 记录不可变可审计；retention class 绝不覆盖
//   active consent（wave-2 consent 法律保持；YOU_RETENTION_ENFORCEMENT_INVALID）。
// - DR LAW：restore 在 activation 前校验 content hash；verified flag 绝不在
//   无 check evidence 时断言（YOU_DR_RESTORE_INVALID）。
// - ECOSYSTEM GATE LAW：一切 ecosystem addition 经 ProviderMatrix 进入；
//   unknown matrix ref 是 typed 错误（YOU_PROVIDER_MATRIX_INVALID——本表面经
//   release-readiness 决定的 subject 注册面镜像该门）。
// - PRODUCTION ELIGIBILITY LAW：eligibility requires rollback evidence；决定
//   不可变；reversal 是新记录（YOU_PRODUCTION_ELIGIBILITY_INVALID）。
// - 事件词汇（frozen additive wave-10）：rate-limit-enforced /
//   import-quarantined / retention-enforced / dr-restore-recorded /
//   production-eligibility-decided + solution-created。frozen 词汇无
//   import-released / rate-limit-allowed 类型——release 与放行是 durable 记录
//   （不伪造事件，与 W9B lab-experiment-declared 无事件类型同款披露）。
import type {
  ConsentState,
  DrRestoreRecord,
  OpaqueId,
  ProductionEligibilityRecord,
  RateLimitAction,
  RateLimitPolicy,
  RetentionEnforcementRecord,
  SolutionEvent,
  YouError,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 记录）
// ---------------------------------------------------------------------------

export interface HardeningStudioLoadRequest {
  readonly workspaceKey: string;
}

/** 依策略发起一次限流下的操作尝试（enforce BEFORE effect）。 */
export interface EnforceRateLimitInput {
  readonly policyId: string;
}

/** 扫描一个 import（unscanned imports never enter evidence）。 */
export interface ScanImportInput {
  readonly artifactId: string;
  readonly scanClassId: string;
}

/** 放行一个 quarantined import（仅经显式 release record 可逆）。 */
export interface ReleaseQuarantinedImportInput {
  readonly verdictId: OpaqueId;
}

/** 对一个 subject 执行一次 retention enforcement pass。 */
export interface EnforceRetentionInput {
  readonly subjectId: string;
  readonly retentionClassId: string;
}

/** 运行一次 DR restore（activation 前校验 content hash）。 */
export interface RunDrRestoreInput {
  readonly snapshotId: string;
  readonly integrity: "honest" | "corrupted";
}

/** 决定 production eligibility（subject 经 provider matrix 注册面引用）。 */
export interface DecideEligibilityInput {
  readonly matrixEntryId: string;
  readonly rollbackEvidenceId: string;
  readonly eligible: boolean;
}

/** 反转一个 eligibility 决定（reversal = 新记录，绝不原地改写）。 */
export interface ReverseEligibilityInput {
  readonly recordId: OpaqueId;
}

// ---------------------------------------------------------------------------
// 快照（服务端事实的只读投影；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** rate-limit policy 注册面视图（frozen RateLimitPolicy 形状不动）。 */
export type HardeningPolicyView = RateLimitPolicy;

/** import scan class 注册面视图。 */
export interface HardeningScanClassView {
  readonly id: string;
  readonly scanClass: string;
  /** 形状合法（未注册 class = 诚实 typed 拒绝路径）。 */
  readonly valid: boolean;
}

/** import artifact 注册面视图（内容寻址标签，绝不内联内容）。 */
export interface HardeningImportArtifactView {
  readonly id: string;
  readonly artifactRef: string;
  readonly artifactKey: string;
}

/** retention class 注册面视图。 */
export interface HardeningRetentionClassView {
  readonly id: string;
  readonly retentionClass: string;
  readonly windowLabel: string;
}

/** retention subject 注册面视图（携带 wave-2 consent 投影与保护指示）。 */
export interface HardeningRetentionSubjectView {
  readonly id: string;
  readonly subjectRef: string;
  readonly consentState: ConsentState;
  /** active consent 保护中（RETENTION LAW：class 绝不覆盖 active consent）。 */
  readonly consentProtected: boolean;
}

/** DR snapshot 注册面视图（内容寻址标签）。 */
export interface HardeningDrSnapshotView {
  readonly id: string;
  readonly snapshotRef: string;
  readonly expectedHash: string;
}

/** provider matrix 注册面视图（W10C 生态门的声明侧镜像）。 */
export interface HardeningMatrixEntryView {
  readonly id: string;
  readonly matrixRef: string;
  readonly providerKind: string;
  readonly region: string;
  readonly capabilityClasses: readonly string[];
  /** 生态门准入（与 production eligibility 是两回事——显示面如实区分）。 */
  readonly eligible: boolean;
  /** 形状合法（未注册 ref = typed 拒绝路径）。 */
  readonly valid: boolean;
}

/** rollback evidence 注册面视图（内容寻址标签）。 */
export interface HardeningRollbackEvidenceView {
  readonly id: string;
  readonly evidenceRef: string;
  /** 是否携带真实回滚演练证据。 */
  readonly present: boolean;
}

/**
 * 一次 rate-limit enforcement 的不可变记录（W10A enforcement record 接缝的
 * 投影形状；frozen v10 词汇无独立 RateLimitEnforcement 合同类型——端口级
 * 视图，服务端拥有权威记录）。deny/defer/shed 皆落账（绝不静默）。
 */
export interface HardeningEnforcementRecordView {
  readonly id: OpaqueId;
  readonly policyId: string;
  readonly scope: string;
  readonly action: RateLimitAction;
  readonly windowS: number;
  readonly burst: number;
  /** retry 指引（秒；窗口剩余）。 */
  readonly retryAfterS: number;
  readonly enforcedAt: string;
  readonly simulated: boolean;
}

/** 一次限流尝试的结果（放行不落 enforcement 记录——放行不是 throttling）。 */
export interface RateLimitAttemptResult {
  readonly allowed: boolean;
  readonly policyId: string;
  readonly scope: string;
  readonly action: RateLimitAction;
  readonly windowS: number;
  readonly remaining: number;
  /** allowed 时为 null（无 enforcement 记录）；enforced 时为记录 id。 */
  readonly enforcementId: OpaqueId | null;
}

/**
 * import verdict + 放行链接的投影视图（frozen ImportSecurityVerdict 形状不动；
 * release 是独立显式记录——IMPORT SECURITY LAW 的可逆面）。
 */
export interface ImportVerdictView {
  readonly verdict: import("@zcode/shared").ImportSecurityVerdict;
  /** 显式 release record 的 id（未放行为 null）。 */
  readonly releaseRecordId: OpaqueId | null;
  /** release 时刻（未放行为 null）。 */
  readonly releasedAt: string | null;
}

/** import release 的显式不可变记录（frozen v10 词汇无事件类型——披露）。 */
export interface ImportReleaseRecordView {
  readonly id: OpaqueId;
  readonly verdictId: OpaqueId;
  readonly artifactRef: OpaqueId;
  readonly releasedAt: string;
  readonly simulated: boolean;
}

/**
 * DR restore + 校验状态的投影视图（frozen DrRestoreRecord 形状不动）。
 * verification 从 dr-restore-recorded 事件流的 check evidence 派生——verified
 * flag 绝不在无 evidence 时显示为 verified（DR LAW 的显示面）。
 */
export interface DrRestoreView {
  readonly record: DrRestoreRecord;
  readonly verification: "verified" | "unverified";
  /** 校验证据哈希（事件携带；无证据为 null）。 */
  readonly checkHash: string | null;
}

/**
 * Eligibility 账本条目（append-only：decision 与 reversal 都是新记录——
 * PRODUCTION ELIGIBILITY LAW「reversal 是新记录，绝非 mutation」的端口级呈现；
 * frozen ProductionEligibilityRecord 形状不动；kind/supersedes 链接是账本语义
 * （W8B authorization / W9B promotion 账本同款先例）。
 */
export interface EligibilityEntry {
  readonly record: ProductionEligibilityRecord;
  readonly kind: "decision" | "reversal";
  /** reversal → 被反转的决定记录 id；decision → null。 */
  readonly supersedesRecordId: string | null;
}

export interface HardeningStudioSnapshot {
  readonly displayName: string;
  /** 表面身份（workspace 级；一个 workspace 一个 hardening 表面）。 */
  readonly studioId: OpaqueId;
  /** rate-limit action 分类学（frozen v10 全集）。 */
  readonly rateLimitActions: readonly RateLimitAction[];
  /** import verdict 分类学（frozen v10 全集）。 */
  readonly importVerdicts: readonly ("clean" | "quarantined" | "rejected")[];
  /** consent 分类学（frozen wave-2 全集——RETENTION LAW 显示面）。 */
  readonly consentStates: readonly ConsentState[];
  /** rate-limit policy 注册面（enforce 动作的数据源）。 */
  readonly policies: readonly HardeningPolicyView[];
  /** import scan class 注册面。 */
  readonly scanClasses: readonly HardeningScanClassView[];
  /** import artifact 注册面（内容寻址标签）。 */
  readonly importArtifacts: readonly HardeningImportArtifactView[];
  /** retention class 注册面。 */
  readonly retentionClasses: readonly HardeningRetentionClassView[];
  /** retention subject 注册面（consent 投影）。 */
  readonly retentionSubjects: readonly HardeningRetentionSubjectView[];
  /** DR snapshot 注册面（内容寻址标签 + 期望哈希）。 */
  readonly drSnapshots: readonly HardeningDrSnapshotView[];
  /** DR integrity 预设（honest / corrupted）。 */
  readonly drIntegrities: readonly ("honest" | "corrupted")[];
  /** provider matrix 注册面（W10C 生态门声明侧镜像）。 */
  readonly matrixEntries: readonly HardeningMatrixEntryView[];
  /** rollback evidence 注册面（内容寻址标签）。 */
  readonly rollbackEvidence: readonly HardeningRollbackEvidenceView[];
  /** rate-limit enforcement 记录（append-only；deny/defer/shed 皆落账）。 */
  readonly enforcements: readonly HardeningEnforcementRecordView[];
  /** import verdict 记录（不可变；id 升序）。 */
  readonly importVerdictRecords: readonly ImportVerdictView[];
  /** import release 记录（append-only）。 */
  readonly importReleases: readonly ImportReleaseRecordView[];
  /** retention enforcement 记录（不可变可审计；id 升序）。 */
  readonly retentionRecords: readonly RetentionEnforcementRecord[];
  /** DR restore 记录（不可变；id 升序）。 */
  readonly drRestores: readonly DrRestoreView[];
  /** eligibility 账本（append-only；追加序）。 */
  readonly eligibilityLedger: readonly EligibilityEntry[];
  /** append-only 事件账本投影（v10 hardening-* 事件）。 */
  readonly events: readonly SolutionEvent[];
  /** 服务端投影时刻（确定性——非 UI 本地时钟）。 */
  readonly projectedAt: string;
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class HardeningStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "HardeningStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Hardening Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T10 换绑
 * Worker A/C 的 hardening 服务。方法走应用服务权威（UI/HTTP/SDK/MCP 同一权威）。
 */
export interface HardeningStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实加固。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：hardening 平面已存在时返回当前快照，不重建。 */
  load(request: HardeningStudioLoadRequest): Promise<HardeningStudioSnapshot>;
  refresh(): Promise<HardeningStudioSnapshot>;

  // -- rate-limit 平面（RATE LIMIT LAW：enforce BEFORE effect） --
  /**
   * 依策略发起一次操作尝试：窗口配额内 ⇒ 放行（无记录——放行不是
   * throttling）；耗尽 ⇒ enforcement 记录 + rate-limit-enforced 事件 +
   * typed YOU_RATE_LIMIT_EXCEEDED（deny/defer/shed 皆携 window 与 retry 指引，
   * 绝不静默）。效果在判定之后才发生（enforce BEFORE effect）。
   */
  enforceRateLimit(input: EnforceRateLimitInput): Promise<RateLimitAttemptResult>;

  // -- import security 平面（IMPORT SECURITY LAW） --
  /**
   * 扫描一个 import：未注册 artifact / 未注册 scan class ⇒ typed
   * YOU_IMPORT_QUARANTINED 拒绝（fail closed——unscanned imports never enter
   * evidence）；clean ⇒ 不可变 verdict（无事件——frozen 词汇披露）；
   * quarantined ⇒ import-quarantined 事件；rejected ⇒ 不可变 verdict（无事件）。
   */
  scanImport(input: ScanImportInput): Promise<ImportVerdictView>;
  /**
   * 放行一个 quarantined import（仅经显式 release record 可逆）：非
   * quarantined / 已放行 / 未知 id ⇒ typed YOU_IMPORT_QUARANTINED 拒绝。
   */
  releaseQuarantinedImport(
    input: ReleaseQuarantinedImportInput,
  ): Promise<ImportVerdictView>;

  // -- retention 平面（RETENTION LAW + wave-2 consent 法律） --
  /**
   * 对 subject 执行一次 retention pass：active consent（granted）保护的
   * subject ⇒ typed YOU_RETENTION_ENFORCEMENT_INVALID 拒绝（class 绝不覆盖
   * consent）；否则 append 不可变记录 + retention-enforced 事件。
   */
  enforceRetention(input: EnforceRetentionInput): Promise<RetentionEnforcementRecord>;

  // -- DR 平面（DR LAW） --
  /**
   * 运行一次 restore：先校验 content hash（corrupted ⇒ typed
   * YOU_DR_RESTORE_INVALID，绝不 activation）；匹配 ⇒ 不可变 DrRestoreRecord
   *（verified: true + check evidence）+ dr-restore-recorded 事件 + activation。
   */
  runDrRestore(input: RunDrRestoreInput): Promise<DrRestoreView>;

  // -- production eligibility 平面（ECOSYSTEM GATE + PRODUCTION ELIGIBILITY LAW） --
  /**
   * 决定 production eligibility：subject 经 provider matrix 注册面引用
   * （unknown matrix ref ⇒ typed YOU_PROVIDER_MATRIX_INVALID）；eligible 决定
   * 必须携带 rollback evidence（缺失 ⇒ typed
   * YOU_PRODUCTION_ELIGIBILITY_INVALID）；通过 ⇒ 不可变记录 +
   * production-eligibility-decided 事件。
   */
  decideEligibility(input: DecideEligibilityInput): Promise<EligibilityEntry>;
  /**
   * 反转一个 eligibility 决定（reversal = 新账本记录，绝不原地改写；事件
   * production-eligibility-decided + reversal 标记）。
   */
  reverseEligibility(input: ReverseEligibilityInput): Promise<EligibilityEntry>;
}

// ---------------------------------------------------------------------------
// Eligibility 决定门纯投影（「matrix-gated + rollback-evidence-required」必须
// 可见且可测；UI 显示面——服务端独立强制）
// ---------------------------------------------------------------------------

export interface HardeningEligibilityGateView {
  readonly allowed: boolean;
  readonly reason:
    | "granted"
    | "unknown-provider-matrix-ref"
    | "missing-rollback-evidence"
    | "unknown-rollback-evidence"
    | "unknown-evidence-preset"
    | "matrix-entry-not-selected";
}

/**
 * 快照事实 + 草稿 → 门视图（求值固定序；fail closed；投影只显示，服务端独立
 * 强制）。blocked 决定不要求 rollback evidence（无可回滚之物）。
 */
export function projectHardeningEligibilityGate(
  snapshot: HardeningStudioSnapshot | null,
  matrixEntryId: string | null,
  rollbackEvidenceId: string | null,
  eligible: boolean,
): HardeningEligibilityGateView {
  if (!snapshot || matrixEntryId === null) {
    return { allowed: false, reason: "matrix-entry-not-selected" };
  }
  const matrixEntry = snapshot.matrixEntries.find(
    (entry) => entry.id === matrixEntryId,
  );
  if (!matrixEntry || !matrixEntry.valid) {
    return { allowed: false, reason: "unknown-provider-matrix-ref" };
  }
  if (eligible) {
    if (rollbackEvidenceId === null) {
      return { allowed: false, reason: "missing-rollback-evidence" };
    }
    const evidence = snapshot.rollbackEvidence.find(
      (entry) => entry.id === rollbackEvidenceId,
    );
    if (!evidence) {
      return { allowed: false, reason: "unknown-evidence-preset" };
    }
    if (!evidence.present) {
      return { allowed: false, reason: "missing-rollback-evidence" };
    }
  }
  return { allowed: true, reason: "granted" };
}

/** subject 的 live eligibility 是否已被 reversal 顶替（账本事实）。 */
export function eligibilityIsReversed(
  snapshot: HardeningStudioSnapshot,
  recordId: string,
): boolean {
  return snapshot.eligibilityLedger.some(
    (entry) =>
      entry.kind === "reversal" && entry.supersedesRecordId === recordId,
  );
}

// ---------------------------------------------------------------------------
// 快照选择器（W1B–W9B currentSolutionVersion 等同款模式）
// ---------------------------------------------------------------------------

/** enforcement 记录列表（追加序；ledger read 语义）。 */
export function orderedHardeningEnforcements(
  snapshot: HardeningStudioSnapshot | null,
): readonly HardeningEnforcementRecordView[] {
  if (!snapshot) return [];
  return snapshot.enforcements;
}

/** 按 id 解析 enforcement 记录（未知 id → null；UI 显式呈现未知态，不猜测）。 */
export function hardeningEnforcementById(
  snapshot: HardeningStudioSnapshot | null,
  enforcementId: string | null,
): HardeningEnforcementRecordView | null {
  if (!snapshot || enforcementId === null) return null;
  return snapshot.enforcements.find((entry) => entry.id === enforcementId) ?? null;
}

/** 按 id 解析 import verdict 视图（未知 id → null）。 */
export function importVerdictById(
  snapshot: HardeningStudioSnapshot | null,
  verdictId: string | null,
): ImportVerdictView | null {
  if (!snapshot || verdictId === null) return null;
  return (
    snapshot.importVerdictRecords.find((entry) => entry.verdict.id === verdictId) ??
    null
  );
}

/** 某个 verdict 的 release 记录（未放行 → null）。 */
export function importReleaseOfVerdict(
  snapshot: HardeningStudioSnapshot | null,
  verdictId: string | null,
): ImportReleaseRecordView | null {
  if (!snapshot || verdictId === null) return null;
  return (
    snapshot.importReleases.find((entry) => entry.verdictId === verdictId) ?? null
  );
}

/** retention enforcement 记录列表（id 升序）。 */
export function orderedRetentionRecords(
  snapshot: HardeningStudioSnapshot | null,
): readonly RetentionEnforcementRecord[] {
  if (!snapshot) return [];
  return snapshot.retentionRecords;
}

/** 按 id 解析 retention 记录（未知 id → null）。 */
export function retentionRecordById(
  snapshot: HardeningStudioSnapshot | null,
  recordId: string | null,
): RetentionEnforcementRecord | null {
  if (!snapshot || recordId === null) return null;
  return snapshot.retentionRecords.find((entry) => entry.id === recordId) ?? null;
}

/** DR restore 记录列表（id 升序）。 */
export function orderedDrRestores(
  snapshot: HardeningStudioSnapshot | null,
): readonly DrRestoreView[] {
  if (!snapshot) return [];
  return snapshot.drRestores;
}

/** 按 id 解析 DR restore 视图（未知 id → null）。 */
export function drRestoreById(
  snapshot: HardeningStudioSnapshot | null,
  restoreId: string | null,
): DrRestoreView | null {
  if (!snapshot || restoreId === null) return null;
  return snapshot.drRestores.find((entry) => entry.record.id === restoreId) ?? null;
}

/** eligibility 账本（追加序）。 */
export function orderedEligibilityLedger(
  snapshot: HardeningStudioSnapshot | null,
): readonly EligibilityEntry[] {
  if (!snapshot) return [];
  return snapshot.eligibilityLedger;
}

/** 按 id 解析账本条目（未知 id → null）。 */
export function eligibilityEntryById(
  snapshot: HardeningStudioSnapshot | null,
  recordId: string | null,
): EligibilityEntry | null {
  if (!snapshot || recordId === null) return null;
  return (
    snapshot.eligibilityLedger.find((entry) => entry.record.id === recordId) ??
    null
  );
}

/** 某 matrix subject 的 live eligibility 记录（无 / 被反转 → null）。 */
export function liveEligibilityOfSubject(
  snapshot: HardeningStudioSnapshot | null,
  matrixRef: string | null,
): ProductionEligibilityRecord | null {
  if (!snapshot || matrixRef === null) return null;
  const entries = snapshot.eligibilityLedger.filter(
    (entry) => entry.record.subjectRef === matrixRef,
  );
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (!eligibilityIsReversed(snapshot, entry.record.id)) {
      return entry.record;
    }
  }
  return null;
}
