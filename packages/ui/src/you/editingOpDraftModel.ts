// YOU Editing Studio — 变更集 op 草稿模型（W5B）。
//
// 纯视图数学（无 DOM、无随机、无计时器——FIXTURES 法则 1/2）：变更集提案流的
// 草稿 = 有序 op 列表；op kind 从剧本分类学挑选；payload 一律确定性内容寻址
// （storyboard 权威合成——UI 绝不内联内容，也绝不自行造 payload 地址）。提交经
// proposeChangeSet 走服务端校验（YOU_CHANGESET_INVALID typed 面板，绝不静默修复）。
import type { EditChangeSetOp } from "@zcode/shared";
import {
  buildStoryboardEditOp,
  EDITING_STORYBOARD_OP_KINDS,
} from "./editingStoryboard.js";

/** op 草稿（有序 op 列表 + 待追加 kind 选择）。 */
export interface OpDraft {
  /** 待追加的 op kind（分类学成员之一；null = 未选择）。 */
  readonly pendingKind: string | null;
  readonly ops: readonly EditChangeSetOp[];
}

export const OP_DRAFT_EMPTY: OpDraft = {
  pendingKind: null,
  ops: [],
};

/** op kind 分类学的展示全集（剧本权威；追加序稳定）。 */
export function opKindOptions(): readonly string[] {
  return EDITING_STORYBOARD_OP_KINDS;
}

/** 选择待追加 kind（确定性转移；不变更既有 ops）。 */
export function setPendingOpKind(draft: OpDraft, kind: string | null): OpDraft {
  return { ...draft, pendingKind: kind };
}

/** 追加一条 op（确定性：kind + 序号派生的内容寻址 payload；id 唯一）。 */
export function appendDraftOp(draft: OpDraft): OpDraft {
  if (draft.pendingKind === null) {
    return draft;
  }
  const ordinal = draft.ops.length + 1;
  const tag = `${String(ordinal).padStart(3, "0")}-${draft.pendingKind}`;
  const op = buildStoryboardEditOp(draft.pendingKind, tag);
  return { ...draft, ops: [...draft.ops, op] };
}

/** 移除末位 op（确定性转移）。 */
export function removeLastDraftOp(draft: OpDraft): OpDraft {
  return { ...draft, ops: draft.ops.slice(0, -1) };
}

/** 草稿 op 行（展示用；payload 标签 = 内容寻址，绝不内联）。 */
export function draftOpRows(
  draft: OpDraft,
): readonly { readonly index: number; readonly op: EditChangeSetOp }[] {
  return draft.ops.map((op, index) => ({ index, op }));
}
