// YOU Learning Studio — 视图纯投影（W6B）。
//
// 只做确定性视图数学：记录状态阶梯（candidate/validated/rejected/superseded——
// 终态互斥锁定；supersession 是链接不是阶梯到达）、scope ladder（frozen v1
// LearningScope 分类学）、signal 行（内容寻址 evidence 标签——绝不内联内容）、
// ledger 按状态分组的账本视图、rights 显示行（usage classes + consent 链接）、
// 偏好行（derived-from lineage）、trajectory 步骤行（内容寻址标签 ONLY）、
// kind picker 选项、区域 loading/empty 视图模型、键盘转移（与
// Solution/Capture/Twin/Performance/Editing 表面同级的键盘可用性）。
// 无 DOM、无随机、无计时器（FIXTURES 法则 1/2）。
import type {
  LearningPreference,
  LearningRecord,
  LearningRecordStatus,
  LearningScope,
  LearningSignal,
  TrajectoryReference,
} from "@zcode/shared";
import type { LearningStudioSnapshot } from "./learningController.js";
import type {
  LearningEvidenceView,
  LearningKindView,
} from "./learningStoryboard.js";

// ---------------------------------------------------------------------------
// 记录状态阶梯（candidate → validated | rejected；validated → superseded）
// ---------------------------------------------------------------------------

export interface RecordLadderStep {
  readonly status: LearningRecordStatus;
  readonly reached: boolean;
  readonly current: boolean;
}

/**
 * 状态阶梯投影：candidate 为过程步（恒已过）；validated / rejected / superseded 是
 * 互斥终态——只有当前态算 reached（supersession 是 supersededById 链接，不是从
 * candidate 出发单独到达的阶梯步；与 W5B 会话阶梯同款语义，但终态互斥）。
 */
export function projectRecordLadder(
  status: LearningRecordStatus,
): readonly RecordLadderStep[] {
  const order: readonly LearningRecordStatus[] = [
    "candidate",
    "validated",
    "rejected",
    "superseded",
  ];
  const reached = new Set<LearningRecordStatus>(["candidate", status]);
  return order.map((step) => ({
    status: step,
    reached: reached.has(step),
    current: step === status,
  }));
}

// ---------------------------------------------------------------------------
// Scope ladder（frozen v1 LearningScope 分类学；GLOBAL → TASK）
// ---------------------------------------------------------------------------

export interface ScopeLadderStep {
  readonly scope: LearningScope;
  readonly reached: boolean;
  readonly current: boolean;
}

/**
 * scope 阶梯投影：GLOBAL（最广）→ TASK（最窄）。当前 scope 及其以上（更广的
 * 祖先上下文）算 reached；current 标记生效范围。偏好/信号/记录的 scope 一律
 * 经此投影渲染（数据源是快照的 scopes 分类学，非 UI 硬编码）。
 */
export function projectScopeLadder(
  scope: LearningScope,
  scopes: readonly LearningScope[] = [
    "GLOBAL",
    "TENANT",
    "APPLICATION",
    "PROJECT",
    "USER",
    "TWIN",
    "ASSET",
    "TASK",
  ],
): readonly ScopeLadderStep[] {
  const currentIndex = scopes.indexOf(scope);
  return scopes.map((step, index) => ({
    scope: step,
    reached: index <= currentIndex,
    current: step === scope,
  }));
}

// ---------------------------------------------------------------------------
// Signal 行（teach-me/learn-this 捕获列表；evidence 内容寻址标签）
// ---------------------------------------------------------------------------

export interface SignalRow {
  readonly signalId: string;
  readonly kind: string;
  readonly scope: string;
  readonly subjectRef: string | null;
  readonly evidenceCount: number;
  readonly capturedAt: string;
  readonly accessibleLabel: string;
}

/** signals → 展示行（id 升序；evidence 只显示数量——标签在检视区展开）。 */
export function projectSignalRows(signals: readonly LearningSignal[]): readonly SignalRow[] {
  return signals.map((signal) => ({
    signalId: signal.id,
    kind: signal.kind,
    scope: signal.scope,
    subjectRef: signal.subjectRef,
    evidenceCount: signal.evidenceRefs.length,
    capturedAt: signal.capturedAt,
    accessibleLabel: `signal ${signal.id}: ${signal.kind} at ${signal.scope} scope, ${signal.evidenceRefs.length} content-addressed evidence refs, captured ${signal.capturedAt}`,
  }));
}

/** 检视信号的 evidence 行（内容寻址标签——绝不内联内容）。 */
export interface SignalEvidenceRow {
  readonly index: number;
  readonly evidenceRef: string;
  readonly accessibleLabel: string;
}

export function projectSignalEvidenceRows(
  evidenceRefs: readonly string[],
): readonly SignalEvidenceRow[] {
  return evidenceRefs.map((evidenceRef, index) => ({
    index,
    evidenceRef,
    accessibleLabel: `evidence ${index + 1}: ${evidenceRef}`,
  }));
}

// ---------------------------------------------------------------------------
// Kind picker 选项 + evidence 注册面行（数据源均为快照注册面投影）
// ---------------------------------------------------------------------------

export interface KindOption {
  readonly kind: string;
  readonly displayName: string;
  readonly hint: string;
}

/** kind 注册面 → picker 选项（顺序 = 注册面顺序；六种 frozen kind 全覆盖）。 */
export function projectKindOptions(
  kindRegistry: readonly LearningKindView[],
): readonly KindOption[] {
  return kindRegistry.map((entry) => ({
    kind: entry.kind,
    displayName: entry.displayName,
    hint: entry.hint,
  }));
}

export interface EvidenceOptionRow {
  readonly evidenceId: string;
  readonly displayName: string;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly originPlane: string;
  readonly accessibleLabel: string;
}

/** evidence 注册面 → teach-me 证据挑选行（内容寻址；来源平面保有真相）。 */
export function projectEvidenceOptions(
  evidence: readonly LearningEvidenceView[],
): readonly EvidenceOptionRow[] {
  return evidence.map((entry) => ({
    evidenceId: entry.id,
    displayName: entry.displayName,
    contentRef: entry.contentRef,
    contentHash: entry.contentHash,
    originPlane: entry.originPlane,
    accessibleLabel: `evidence ${entry.displayName} (${entry.id}) from ${entry.originPlane}, content ${entry.contentRef} (${entry.contentHash})`,
  }));
}

// ---------------------------------------------------------------------------
// Ledger 视图（记录按状态阶梯分组；supersession 链接显示）
// ---------------------------------------------------------------------------

export interface LedgerRecordRow {
  readonly recordId: string;
  readonly signalId: string;
  readonly status: LearningRecordStatus;
  readonly scope: string;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly inert: boolean;
  readonly supersededById: string | null;
  readonly validatedAt: string;
  readonly accessibleLabel: string;
}

/** 记录 → ledger 行（惰性标记 = 无 rights；supersededById = 后继者链接）。 */
export function projectLedgerRecordRow(record: LearningRecord): LedgerRecordRow {
  const inert = record.rights.consentRef === "" && record.rights.usage.length === 0;
  return {
    recordId: record.id,
    signalId: record.signalId,
    status: record.status,
    scope: record.scope,
    contentRef: record.contentRef,
    contentHash: record.contentHash,
    inert,
    supersededById: record.supersededById,
    validatedAt: record.validatedAt,
    accessibleLabel: `record ${record.id} from signal ${record.signalId}: ${record.status} at ${record.scope} scope, content ${record.contentRef} (${record.contentHash})${inert ? ", inert (no rights)" : ""}${record.supersededById !== null ? `, superseded by ${record.supersededById}` : ""}, ${record.validatedAt}`,
  };
}

export interface LedgerView {
  readonly candidate: readonly LedgerRecordRow[];
  readonly validated: readonly LedgerRecordRow[];
  readonly rejected: readonly LedgerRecordRow[];
  readonly superseded: readonly LedgerRecordRow[];
  readonly total: number;
}

/** ledger 账本视图：按状态阶梯分组（candidate 也可见——透明性先于可重放投影）。 */
export function projectLedgerView(
  records: readonly LearningRecord[],
): LedgerView {
  const rows = records.map(projectLedgerRecordRow);
  return {
    candidate: rows.filter((row) => row.status === "candidate"),
    validated: rows.filter((row) => row.status === "validated"),
    rejected: rows.filter((row) => row.status === "rejected"),
    superseded: rows.filter((row) => row.status === "superseded"),
    total: rows.length,
  };
}

// ---------------------------------------------------------------------------
// Rights 显示行（usage classes + consent linkage；惰性记录通知）
// ---------------------------------------------------------------------------

export interface RightsRow {
  readonly recordId: string;
  readonly status: LearningRecordStatus;
  readonly usage: readonly string[];
  readonly consentRef: string;
  readonly consentHash: string;
  readonly expiresAt: string | null;
  readonly inert: boolean;
  readonly accessibleLabel: string;
}

/**
 * 记录 → rights 显示行（usage classes 与 consent 链接——RIGHTS LAW 的可见面：
 * consentRef/consentHash 溯源 wave-2 权威；惰性记录 inert=true）。
 */
export function projectRightsRows(
  records: readonly LearningRecord[],
): readonly RightsRow[] {
  return records.map((record) => {
    const inert = record.rights.consentRef === "" && record.rights.usage.length === 0;
    return {
      recordId: record.id,
      status: record.status,
      usage: [...record.rights.usage],
      consentRef: record.rights.consentRef,
      consentHash: record.rights.consentHash,
      expiresAt: record.rights.expiresAt,
      inert,
      accessibleLabel: `rights of record ${record.id}: ${inert ? "inert (no rights grant — every use is refused)" : `usage ${record.rights.usage.join(", ")} under consent ${record.rights.consentRef} (${record.rights.consentHash})${record.rights.expiresAt !== null ? `, expires ${record.rights.expiresAt}` : ""}`}`,
    };
  });
}

/** 全部 usage classes 的显示行（数据源：快照 rightUsages 分类学）。 */
export function projectUsageClassRows(
  usages: readonly string[],
): readonly string[] {
  return [...usages];
}

// ---------------------------------------------------------------------------
// 偏好行（derived-from lineage；`${scope}::${key}` 投影键升序）
// ---------------------------------------------------------------------------

export interface PreferenceRow {
  readonly preferenceId: string;
  readonly scope: string;
  readonly key: string;
  readonly value: string;
  readonly derivedFromRecordId: string | null;
  readonly updatedAt: string;
  readonly accessibleLabel: string;
}

/** 偏好 → 显示行（lineage: derivedFromRecordId null = operator seed）。 */
export function projectPreferenceRows(
  preferences: readonly LearningPreference[],
): readonly PreferenceRow[] {
  return preferences.map((preference) => ({
    preferenceId: preference.id,
    scope: preference.scope,
    key: preference.key,
    value: preference.value,
    derivedFromRecordId: preference.derivedFromRecordId,
    updatedAt: preference.updatedAt,
    accessibleLabel: `preference ${preference.scope}::${preference.key} = ${preference.value}${preference.derivedFromRecordId !== null ? ` (derived from record ${preference.derivedFromRecordId})` : " (operator seed)"}, updated ${preference.updatedAt}`,
  }));
}

// ---------------------------------------------------------------------------
// Trajectory 步骤行（内容寻址标签 ONLY——绝不内联内容）
// ---------------------------------------------------------------------------

export interface TrajectoryStepRow {
  readonly index: number;
  readonly stepRef: string;
  readonly accessibleLabel: string;
}

/** stepRefs → 展示行（原样顺序——顺序即重放序）。 */
export function projectTrajectoryStepRows(
  stepRefs: readonly string[],
): readonly TrajectoryStepRow[] {
  return stepRefs.map((stepRef, index) => ({
    index,
    stepRef,
    accessibleLabel: `step ${index + 1}: ${stepRef}`,
  }));
}

export interface TrajectoryRow {
  readonly trajectoryId: string;
  readonly scope: string;
  readonly stepCount: number;
  readonly createdAt: string;
  readonly accessibleLabel: string;
}

/** trajectories → 列表行。 */
export function projectTrajectoryRows(
  trajectories: readonly TrajectoryReference[],
): readonly TrajectoryRow[] {
  return trajectories.map((trajectory) => ({
    trajectoryId: trajectory.id,
    scope: trajectory.scope,
    stepCount: trajectory.stepRefs.length,
    createdAt: trajectory.createdAt,
    accessibleLabel: `trajectory ${trajectory.id} at ${trajectory.scope} scope, ${trajectory.stepRefs.length} content-addressed steps, recorded ${trajectory.createdAt}`,
  }));
}

// ---------------------------------------------------------------------------
// 区域视图模型（每个面板区域的 loading / empty / ready）
// ---------------------------------------------------------------------------

export type LearningRegionView = "loading" | "empty" | "ready";

/** 列表区域的确定性视图模型（无快照 → loading；有快照无数据 → empty）。 */
export function projectListRegionView(
  hasSnapshot: boolean,
  count: number,
): LearningRegionView {
  if (!hasSnapshot) return "loading";
  if (count === 0) return "empty";
  return "ready";
}

// ---------------------------------------------------------------------------
// 键盘转移（与 Solution/Capture/Twin/Performance/Editing 表面一致的键盘导航可用性）
// ---------------------------------------------------------------------------

export type LearningListKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "select" }
  | { readonly kind: "none" };

/**
 * signal 列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末项；Enter：选中当前信号（检视详情）；
 * - 其余键 no-op。
 */
export function resolveLearningKeyboardTransition(
  key: string,
  state: { readonly totalSignals: number },
): LearningListKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalSignals };
    case "End":
      return { kind: "move", delta: state.totalSignals };
    case "Enter":
      return { kind: "select" };
    default:
      return { kind: "none" };
  }
}

/** signal 光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampSignalIndex(index: number, totalSignals: number): number {
  if (totalSignals <= 0) return 0;
  return Math.min(totalSignals - 1, Math.max(0, index));
}

// ---------------------------------------------------------------------------
// Teach-me 草稿转移（kind/scope/evidence 挑选的纯视图模型）
// ---------------------------------------------------------------------------

export interface SignalDraftView {
  readonly kind: string | null;
  readonly scope: string | null;
  readonly evidenceIds: readonly string[];
  /** 捕获按钮禁用原因（null = 可捕获）。 */
  readonly disabledReason:
    | "no-kind"
    | "no-scope"
    | "no-evidence"
    | null;
}

/** 草稿 → 确认区视图模型（禁用原因确定性：kind → scope → evidence 顺序）。 */
export function projectSignalDraftView(draft: {
  readonly kind: string | null;
  readonly scope: string | null;
  readonly evidenceIds: readonly string[];
}): SignalDraftView {
  let disabledReason: SignalDraftView["disabledReason"] = null;
  if (draft.kind === null) {
    disabledReason = "no-kind";
  } else if (draft.scope === null) {
    disabledReason = "no-scope";
  } else if (draft.evidenceIds.length === 0) {
    disabledReason = "no-evidence";
  }
  return { ...draft, disabledReason };
}

/** 快照中的草稿证据内容寻址标签（选中条目的 contentRef 列表——绝不内联）。 */
export function projectDraftEvidenceRefs(
  snapshot: LearningStudioSnapshot | null,
  evidenceIds: readonly string[],
): readonly string[] {
  if (!snapshot) return [];
  return evidenceIds
    .map((evidenceId) => snapshot.evidence.find((entry) => entry.id === evidenceId))
    .filter((entry): entry is LearningEvidenceView => entry !== undefined)
    .map((entry) => entry.contentRef);
}
