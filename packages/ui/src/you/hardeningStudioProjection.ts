// YOU Hardening Studio — 视图纯投影（W10B）。
//
// 只做确定性视图数学：rate-limit enforcement 行（deny/defer/shed + window 与
// retry 指引——RATE LIMIT LAW 的可见面）、import verdict 行（scan class + 三
// verdict + release 链接）、retention 行（class + consent 指示器）、DR restore
// 行（verification 从 dr-restore-recorded 事件流的 check evidence 派生——
// verified flag 绝不在无证据时显示为 verified）、eligibility 账本行
//（decision/reversal + rollback evidence 链接）、policy/subject/matrix 注册面
// 行、区域 loading/empty 视图模型、键盘转移（与兄弟表面同级的键盘可用性）、
// 各平面草稿视图模型。无 DOM、无随机、无计时器（FIXTURES 法则 1/2）。
import type {
  DrRestoreRecord,
  RateLimitAction,
  SolutionEvent,
} from "@zcode/shared";
import type {
  DrRestoreView,
  EligibilityEntry,
  HardeningEnforcementRecordView,
  HardeningEligibilityGateView,
  ImportVerdictView,
  ImportReleaseRecordView,
} from "./hardeningController.js";

// ---------------------------------------------------------------------------
// Rate-limit enforcement 显示行（RATE LIMIT LAW：deny/defer/shed 皆落账，
// 每条携 window 与 retry 指引——绝不静默）
// ---------------------------------------------------------------------------

export interface EnforcementRow {
  readonly enforcementId: string;
  readonly policyId: string;
  readonly scope: string;
  readonly action: RateLimitAction;
  readonly windowS: number;
  readonly burst: number;
  readonly retryAfterS: number;
  readonly enforcedAt: string;
  readonly accessibleLabel: string;
}

export function projectEnforcementRows(
  enforcements: readonly HardeningEnforcementRecordView[],
): readonly EnforcementRow[] {
  return enforcements.map((entry) => ({
    enforcementId: entry.id,
    policyId: entry.policyId,
    scope: entry.scope,
    action: entry.action,
    windowS: entry.windowS,
    burst: entry.burst,
    retryAfterS: entry.retryAfterS,
    enforcedAt: entry.enforcedAt,
    accessibleLabel: `rate limit enforcement ${entry.id} on ${entry.scope}: ${entry.action} (window ${entry.windowS}s, burst ${entry.burst}) — retry after ${entry.retryAfterS}s, enforced at ${entry.enforcedAt}`,
  }));
}

/** retry 指引的确定性档位（显示面分类：立即可试 / 窗口后重试）。 */
export function projectRetryGuidanceKind(
  retryAfterS: number,
): "immediate" | "windowed" {
  return retryAfterS <= 0 ? "immediate" : "windowed";
}

// ---------------------------------------------------------------------------
// Import verdict 显示行（scan class + verdict + release 链接）
// ---------------------------------------------------------------------------

export interface ImportVerdictRow {
  readonly verdictId: string;
  readonly artifactRef: string;
  readonly scanClass: string;
  readonly verdict: "clean" | "quarantined" | "rejected";
  readonly quarantinedAt: string | null;
  readonly releaseRecordId: string | null;
  readonly releasedAt: string | null;
  readonly accessibleLabel: string;
}

export function projectImportVerdictRows(
  verdicts: readonly ImportVerdictView[],
): readonly ImportVerdictRow[] {
  return verdicts.map((entry) => ({
    verdictId: entry.verdict.id,
    artifactRef: entry.verdict.artifactRef,
    scanClass: entry.verdict.scanClass,
    verdict: entry.verdict.verdict,
    quarantinedAt: entry.verdict.quarantinedAt,
    releaseRecordId: entry.releaseRecordId,
    releasedAt: entry.releasedAt,
    accessibleLabel: `import verdict ${entry.verdict.id}: artifact ${entry.verdict.artifactRef} scanned as ${entry.verdict.scanClass}, ${entry.verdict.verdict}${entry.verdict.quarantinedAt !== null ? ` at ${entry.verdict.quarantinedAt}` : ""}${entry.releaseRecordId !== null ? `, released by ${entry.releaseRecordId} at ${entry.releasedAt}` : ""}`,
  }));
}

// ---------------------------------------------------------------------------
// Retention 显示行（RETENTION LAW：class + consent 指示器；active consent
// = consent-protected——enforcement 被 typed 拒绝）
// ---------------------------------------------------------------------------

export interface RetentionRecordRow {
  readonly recordId: string;
  readonly retentionClass: string;
  readonly subjectRef: string;
  readonly enforcedAt: string;
  readonly accessibleLabel: string;
}

export function projectRetentionRecordRows(
  records: readonly {
    readonly id: string;
    readonly retentionClass: string;
    readonly subjectRef: string;
    readonly enforcedAt: string;
  }[],
): readonly RetentionRecordRow[] {
  return records.map((entry) => ({
    recordId: entry.id,
    retentionClass: entry.retentionClass,
    subjectRef: entry.subjectRef,
    enforcedAt: entry.enforcedAt,
    accessibleLabel: `retention enforcement ${entry.id}: class ${entry.retentionClass} on subject ${entry.subjectRef}, enforced at ${entry.enforcedAt}`,
  }));
}

// ---------------------------------------------------------------------------
// DR restore 显示行（verification 从事件流 check evidence 派生——DR LAW 的
// 显示面：verified flag 绝不在无证据时显示为 verified）
// ---------------------------------------------------------------------------

export interface DrRestoreRow {
  readonly restoreId: string;
  readonly snapshotRef: string;
  readonly restoredAt: string;
  readonly verified: boolean;
  /** verification 状态（事件证据派生：verified / unverified）。 */
  readonly verification: "verified" | "unverified";
  readonly checkHash: string | null;
  readonly accessibleLabel: string;
}

/**
 * 单条记录的 verification 派生（纯投影）：仅当记录 verified 且事件流携带该
 * restore 的 checkHash 证据时显示 verified；否则 unverified（防御显示——绝不把
 * 无证据的 flag 当 verified 展示）。
 */
export function projectDrRestoreVerification(
  record: DrRestoreRecord,
  events: readonly SolutionEvent[],
): { verification: "verified" | "unverified"; checkHash: string | null } {
  if (!record.verified) {
    return { verification: "unverified", checkHash: null };
  }
  for (const event of events) {
    if (event.type !== "dr-restore-recorded") continue;
    if (event.payload.restoreId !== record.id) continue;
    const checkHash = event.payload.checkHash;
    if (typeof checkHash === "string" && checkHash !== "") {
      return { verification: "verified", checkHash };
    }
  }
  return { verification: "unverified", checkHash: null };
}

export function projectDrRestoreRows(
  restores: readonly DrRestoreView[],
  events: readonly SolutionEvent[],
): readonly DrRestoreRow[] {
  return restores.map((entry) => {
    // 服务端视图已带 verification；本投影以事件证据再推导一次（显示面独立于
    // 服务端 flag——DR LAW 的双重呈现：无证据 ⇒ unverified）。
    const derived = projectDrRestoreVerification(entry.record, events);
    return {
      restoreId: entry.record.id,
      snapshotRef: entry.record.snapshotRef,
      restoredAt: entry.record.restoredAt,
      verified: derived.verification === "verified",
      verification: derived.verification,
      checkHash: derived.checkHash ?? entry.checkHash,
      accessibleLabel: `DR restore ${entry.record.id} of ${entry.record.snapshotRef}: ${derived.verification === "verified" ? `verified (check hash ${derived.checkHash ?? entry.checkHash})` : "unverified (no check evidence displayed)"}, restored at ${entry.record.restoredAt}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Eligibility 账本显示行（decision / reversal 不可变记录 + supersedes 链接 +
// rollback evidence 链接）
// ---------------------------------------------------------------------------

export interface EligibilityRow {
  readonly recordId: string;
  readonly subjectRef: string;
  readonly kind: "decision" | "reversal";
  readonly eligible: boolean;
  readonly rollbackEvidenceRef: string;
  readonly decidedAt: string;
  readonly supersedesRecordId: string | null;
  readonly accessibleLabel: string;
}

export function projectEligibilityRows(
  ledger: readonly EligibilityEntry[],
): readonly EligibilityRow[] {
  return ledger.map((entry) => ({
    recordId: entry.record.id,
    subjectRef: entry.record.subjectRef,
    kind: entry.kind,
    eligible: entry.record.eligible,
    rollbackEvidenceRef: entry.record.rollbackEvidenceRef,
    decidedAt: entry.record.decidedAt,
    supersedesRecordId: entry.supersedesRecordId,
    accessibleLabel: `${entry.kind} ${entry.record.id} for ${entry.record.subjectRef}: ${entry.record.eligible ? "eligible" : "blocked"}${entry.record.rollbackEvidenceRef !== "fx-rollback-none" ? `, rollback evidence ${entry.record.rollbackEvidenceRef}` : ", no rollback evidence cited"}${entry.supersedesRecordId !== null ? `, supersedes ${entry.supersedesRecordId}` : ""}, decided ${entry.record.decidedAt}`,
  }));
}

/** rollback evidence 引用是否是「无证据」占位（blocked 决定的诚实显示）。 */
export function rollbackEvidenceIsPresent(
  rollbackEvidenceRef: string,
): boolean {
  return rollbackEvidenceRef !== "fx-rollback-none" && rollbackEvidenceRef !== "";
}

// ---------------------------------------------------------------------------
// Import release 显示行（显式 release record——IMPORT SECURITY LAW 的可逆面）
// ---------------------------------------------------------------------------

export interface ImportReleaseRow {
  readonly releaseId: string;
  readonly verdictId: string;
  readonly artifactRef: string;
  readonly releasedAt: string;
  readonly accessibleLabel: string;
}

export function projectImportReleaseRows(
  releases: readonly ImportReleaseRecordView[],
): readonly ImportReleaseRow[] {
  return releases.map((entry) => ({
    releaseId: entry.id,
    verdictId: entry.verdictId,
    artifactRef: entry.artifactRef,
    releasedAt: entry.releasedAt,
    accessibleLabel: `import release ${entry.id}: verdict ${entry.verdictId} (artifact ${entry.artifactRef}) released at ${entry.releasedAt} through an explicit release record`,
  }));
}

// ---------------------------------------------------------------------------
// 区域视图模型（每个面板区域的 loading / empty / ready）
// ---------------------------------------------------------------------------

export type HardeningRegionView = "loading" | "empty" | "ready";

/** 列表区域的确定性视图模型（无快照 → loading；有快照无数据 → empty）。 */
export function projectHardeningListRegionView(
  hasSnapshot: boolean,
  count: number,
): HardeningRegionView {
  if (!hasSnapshot) return "loading";
  if (count === 0) return "empty";
  return "ready";
}

// ---------------------------------------------------------------------------
// 键盘转移（与 Solution/Capture/Twin/Performance/Editing/Learning/Avatar/
// Escalation/Lab 表面一致的键盘导航可用性）
// ---------------------------------------------------------------------------

export type HardeningListKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "select" }
  | { readonly kind: "none" };

/**
 * enforcement 记录列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末项；Enter：选中当前记录（检视详情）；
 * - 其余键 no-op。
 */
export function resolveHardeningKeyboardTransition(
  key: string,
  state: { readonly totalEnforcements: number },
): HardeningListKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalEnforcements };
    case "End":
      return { kind: "move", delta: state.totalEnforcements };
    case "Enter":
      return { kind: "select" };
    default:
      return { kind: "none" };
  }
}

/** enforcement 光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampHardeningIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, index));
}

// ---------------------------------------------------------------------------
// 草稿视图（各平面挑选的纯视图模型）
// ---------------------------------------------------------------------------

export interface LimitDraftView {
  readonly policyId: string;
  /** enforce 按钮禁用原因（null = 可执行）。 */
  readonly disabledReason: "unknown-policy" | null;
  readonly action: RateLimitAction | null;
  readonly windowS: number | null;
  readonly burst: number | null;
}

/** policy 草稿 + 注册面 → enforce 确认区视图模型（禁用原因确定性固定序）。 */
export function projectLimitDraftView(
  draft: { readonly policyId: string },
  policies: readonly {
    readonly id: string;
    readonly action: RateLimitAction;
    readonly windowS: number;
    readonly burst: number;
  }[],
): LimitDraftView {
  const policy = policies.find((entry) => entry.id === draft.policyId);
  if (!policy) {
    return {
      policyId: draft.policyId,
      disabledReason: "unknown-policy",
      action: null,
      windowS: null,
      burst: null,
    };
  }
  return {
    policyId: policy.id,
    disabledReason: null,
    action: policy.action,
    windowS: policy.windowS,
    burst: policy.burst,
  };
}

export interface ImportDraftView {
  readonly artifactId: string;
  readonly scanClassId: string;
  /** scan 按钮禁用原因（null = 可扫描）。 */
  readonly disabledReason: "unknown-artifact" | "unregistered-scan-class" | null;
  readonly artifactValid: boolean;
  readonly scanClassValid: boolean;
}

/** import 草稿 + 注册面 → scan 确认区视图模型（禁用原因确定性固定序）。 */
export function projectImportDraftView(
  draft: {
    readonly artifactId: string;
    readonly scanClassId: string;
  },
  registry: {
    readonly artifacts: readonly { readonly id: string }[];
    readonly scanClasses: readonly { readonly id: string; readonly valid: boolean }[];
  },
): ImportDraftView {
  const artifact = registry.artifacts.find((entry) => entry.id === draft.artifactId);
  const scanClass = registry.scanClasses.find(
    (entry) => entry.id === draft.scanClassId,
  );
  const artifactValid = artifact !== undefined;
  const scanClassValid = scanClass !== undefined && scanClass.valid;
  let disabledReason: ImportDraftView["disabledReason"] = null;
  if (!artifactValid) {
    disabledReason = "unknown-artifact";
  } else if (!scanClassValid) {
    disabledReason = "unregistered-scan-class";
  }
  return {
    ...draft,
    disabledReason,
    artifactValid,
    scanClassValid,
  };
}

export interface RetentionDraftView {
  readonly subjectId: string;
  readonly retentionClassId: string;
  /** enforce 按钮禁用原因（null = 可执行——consent-protected 是 typed 拒绝，
   *  非 UI 禁用：让法则路径可见可测）。 */
  readonly disabledReason: "unknown-subject" | "unknown-retention-class" | null;
  /** subject 是否被 active consent 保护（显示面指示器）。 */
  readonly consentProtected: boolean;
  readonly consentState: string | null;
}

/** retention 草稿 + 注册面 → enforce 确认区视图模型。 */
export function projectRetentionDraftView(
  draft: {
    readonly subjectId: string;
    readonly retentionClassId: string;
  },
  registry: {
    readonly subjects: readonly {
      readonly id: string;
      readonly consentProtected: boolean;
      readonly consentState: string;
    }[];
    readonly classes: readonly { readonly id: string }[];
  },
): RetentionDraftView {
  const subject = registry.subjects.find((entry) => entry.id === draft.subjectId);
  const retentionClass = registry.classes.find(
    (entry) => entry.id === draft.retentionClassId,
  );
  let disabledReason: RetentionDraftView["disabledReason"] = null;
  if (!subject) {
    disabledReason = "unknown-subject";
  } else if (!retentionClass) {
    disabledReason = "unknown-retention-class";
  }
  return {
    ...draft,
    disabledReason,
    consentProtected: subject?.consentProtected ?? false,
    consentState: subject?.consentState ?? null,
  };
}

export interface DrDraftView {
  readonly snapshotId: string;
  readonly integrity: "honest" | "corrupted";
  /** restore 按钮禁用原因（null = 可执行——corrupted 是诚实 typed 拒绝路径，
   *  非 UI 禁用）。 */
  readonly disabledReason: "unknown-snapshot" | null;
}

/** DR 草稿 + 注册面 → restore 确认区视图模型。 */
export function projectDrDraftView(
  draft: {
    readonly snapshotId: string;
    readonly integrity: "honest" | "corrupted";
  },
  snapshots: readonly { readonly id: string }[],
): DrDraftView {
  const known = snapshots.some((entry) => entry.id === draft.snapshotId);
  return {
    ...draft,
    disabledReason: known ? null : "unknown-snapshot",
  };
}

export interface ReleaseDraftView {
  readonly matrixEntryId: string;
  readonly rollbackEvidenceId: string;
  readonly eligible: boolean;
  /** 门显示（projectHardeningEligibilityGate 的投影面——服务端独立强制）。 */
  readonly gate: HardeningEligibilityGateView;
}

/** eligibility 草稿 → decide 确认区视图模型（门显示独立呈现）。 */
export function projectReleaseDraftView(
  draft: {
    readonly matrixEntryId: string;
    readonly rollbackEvidenceId: string;
    readonly eligible: boolean;
  },
  gate: HardeningEligibilityGateView,
): ReleaseDraftView {
  return { ...draft, gate };
}
