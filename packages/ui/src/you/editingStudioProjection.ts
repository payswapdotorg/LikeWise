// YOU Editing Studio — 视图纯投影（W5B）。
//
// 只做确定性视图数学：session 状态阶梯（open/committed/abandoned——终态互斥锁定）、
// op 列表行（内容寻址 payload 标签——绝不内联内容）、候选 vs parent 对比行、
// root → leaf 谱系链投影、import/export 结果行、导出草稿转移、键盘转移（与
// Solution/Capture/Twin/Performance 表面同级的键盘可用性）。无 DOM、无随机、
// 无计时器（FIXTURES 法则 1/2）。
import type {
  EditChangeSet,
  EditChangeSetOp,
  EditingSessionStatus,
  ImportExportResult,
} from "@zcode/shared";
import type { EditingStudioSnapshot } from "./editingController.js";

// ---------------------------------------------------------------------------
// Session 状态阶梯（open → committed | abandoned；终态互斥锁定）
// ---------------------------------------------------------------------------

export interface SessionLadderStep {
  readonly status: EditingSessionStatus;
  readonly reached: boolean;
  readonly current: boolean;
}

/**
 * 状态阶梯投影：open 为过程步（恒已过）；committed 与 abandoned 是互斥终态——
 * 只有当前态算 reached（与 W4B 渲染作业阶梯同款语义，但终态互斥）。
 */
export function projectSessionLadder(
  status: EditingSessionStatus,
): readonly SessionLadderStep[] {
  const order: readonly EditingSessionStatus[] = ["open", "committed", "abandoned"];
  const reached = new Set<EditingSessionStatus>(["open", status]);
  return order.map((step) => ({
    status: step,
    reached: reached.has(step),
    current: step === status,
  }));
}

// ---------------------------------------------------------------------------
// 变更集 op 行（内容寻址 payload 标签；顺序 = 提议序 = 权威序）
// ---------------------------------------------------------------------------

export interface ChangeSetOpRow {
  readonly index: number;
  readonly opId: string;
  readonly kind: string;
  readonly payloadRef: string;
  readonly payloadHash: string;
  /** 供 aria / 纯文本消费的确定性描述（非仅颜色）。 */
  readonly accessibleLabel: string;
}

/** ops → 展示行（原样顺序——顺序是提议者的权威）。 */
export function projectOpRows(ops: readonly EditChangeSetOp[]): readonly ChangeSetOpRow[] {
  return ops.map((op, index) => ({
    index,
    opId: op.id,
    kind: op.kind,
    payloadRef: op.payloadRef,
    payloadHash: op.payloadHash,
    accessibleLabel: `op ${index + 1}: ${op.kind} ${op.id}, payload ${op.payloadRef} (${op.payloadHash})`,
  }));
}

// ---------------------------------------------------------------------------
// 变更集 / 候选对比行（deterministic preview of candidate against parent）
// ---------------------------------------------------------------------------

export interface ChangeSetSummaryRow {
  readonly changeSetId: string;
  readonly sessionId: string;
  readonly opCount: number;
  readonly createdAt: string;
  /** 首个 op kind（列表摘要；确定性）。 */
  readonly firstOpKind: string | null;
}

export function projectChangeSetRow(
  changeSet: EditChangeSet,
): ChangeSetSummaryRow {
  return {
    changeSetId: changeSet.id,
    sessionId: changeSet.sessionId,
    opCount: changeSet.ops.length,
    createdAt: changeSet.createdAt,
    firstOpKind: changeSet.ops[0]?.kind ?? null,
  };
}

/** 候选 vs parent 对比行（谱系链上相邻两环的确定性对比视图）。 */
export interface CandidateCompareRow {
  readonly candidateId: string;
  readonly parentVersionId: string;
  readonly changeSetId: string;
  readonly parentContentHash: string | null;
  readonly candidateContentRef: string;
  readonly candidateContentHash: string;
  readonly proposedAt: string;
  readonly accessibleLabel: string;
}

export function projectCandidateCompareRow(
  input: {
    readonly id: string;
    readonly changeSetId: string;
    readonly parentVersionId: string;
    readonly contentRef: string;
    readonly contentHash: string;
    readonly proposedAt: string;
  },
  parentContentHash: string | null,
): CandidateCompareRow {
  return {
    candidateId: input.id,
    parentVersionId: input.parentVersionId,
    changeSetId: input.changeSetId,
    parentContentHash,
    candidateContentRef: input.contentRef,
    candidateContentHash: input.contentHash,
    proposedAt: input.proposedAt,
    accessibleLabel: `candidate ${input.id} from ${input.parentVersionId} (change set ${input.changeSetId}), content ${input.contentRef} (${input.contentHash}), proposed ${input.proposedAt}`,
  };
}

// ---------------------------------------------------------------------------
// 谱系链投影（root → leaf；每环来自 append-only 账本事实）
// ---------------------------------------------------------------------------

export interface LineageNodeRow {
  readonly versionId: string;
  /** subject 根（origin plane 语义）或候选节点。 */
  readonly kind: "subject-root" | "candidate";
  readonly label: string;
  readonly contentHash: string | null;
  readonly depth: number;
}

/**
 * 谱系链 → 展示行（root 在首、目标在末；subject 根带来源平面标注，候选带
 * parent 深度。确定性：链序即追加事实序）。
 */
export function projectLineageRows(
  snapshot: EditingStudioSnapshot | null,
  chain: readonly string[],
): readonly LineageNodeRow[] {
  if (!snapshot) return [];
  const subjectById = new Map(snapshot.subjects.map((subject) => [subject.id, subject]));
  const candidateById = new Map(
    snapshot.candidates.map((candidate) => [candidate.id, candidate]),
  );
  return chain.map((versionId, depth) => {
    const subject = subjectById.get(versionId);
    if (subject) {
      return {
        versionId,
        kind: "subject-root" as const,
        label: subject.displayName,
        contentHash: subject.contentHash,
        depth,
      };
    }
    const candidate = candidateById.get(versionId);
    return {
      versionId,
      kind: "candidate" as const,
      label: candidate ? `candidate ${candidate.id}` : versionId,
      contentHash: candidate?.contentHash ?? null,
      depth,
    };
  });
}

// ---------------------------------------------------------------------------
// Import/export 结果行（succeeded 内容寻址 / failed 无绑定——truth law）
// ---------------------------------------------------------------------------

export interface ImportExportRow {
  readonly resultId: string;
  readonly sessionId: string | null;
  readonly format: string;
  readonly status: "succeeded" | "failed";
  readonly contentRef: string | null;
  readonly contentHash: string | null;
  readonly completedAt: string;
  readonly accessibleLabel: string;
}

export function projectImportExportRows(
  results: readonly ImportExportResult[],
): readonly ImportExportRow[] {
  return results.map((result) => ({
    resultId: result.id,
    sessionId: result.sessionId,
    format: String(result.format),
    status: result.status,
    contentRef: result.contentRef,
    contentHash: result.contentHash,
    completedAt: result.completedAt,
    accessibleLabel: `import/export ${result.id}: ${String(result.format)} ${result.status}${result.contentRef ? `, content ${result.contentRef}` : ", no content binding"}`,
  }));
}

// ---------------------------------------------------------------------------
// 键盘转移（与 Solution/Capture/Twin/Performance 表面一致的键盘导航可用性）
// ---------------------------------------------------------------------------

export type EditingListKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "select" }
  | { readonly kind: "none" };

/**
 * 会话列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末项；Enter：选中当前会话（检视详情）；
 * - 其余键 no-op。
 */
export function resolveEditingKeyboardTransition(
  key: string,
  state: { readonly totalSessions: number },
): EditingListKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalSessions };
    case "End":
      return { kind: "move", delta: state.totalSessions };
    case "Enter":
      return { kind: "select" };
    default:
      return { kind: "none" };
  }
}

/** 会话光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampSessionIndex(index: number, totalSessions: number): number {
  if (totalSessions <= 0) return 0;
  return Math.min(totalSessions - 1, Math.max(0, index));
}

// ---------------------------------------------------------------------------
// 提案目标草稿（parent 版本选择 + format 选择的纯转移）
// ---------------------------------------------------------------------------

/** 导出草稿（format 选择；来自快照 supportedFormats——非 UI 硬编码）。 */
export interface ExportDraft {
  readonly format: string | null;
}

export const EXPORT_DRAFT_EMPTY: ExportDraft = { format: null };

export function setExportDraftFormat(draft: ExportDraft, format: string): ExportDraft {
  return { ...draft, format };
}
