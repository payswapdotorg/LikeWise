// YOU Hardening Studio — Hardening tab 注册纯逻辑（W10B）。
//
// 「open/聚焦 Hardening tab」的状态转移放在 you/ 子树（保持子树可被
// `pnpm exec tsx --test packages/ui/src/you` 直接加载：本文件只含 type-only 的
// lib 导入，运行时零依赖）。lib/workspaceSidePane.ts 的 registration-only seam
// 委托到这里；tab 类型与 union 仍归 lib 所有（与 W1B–W9B 同款）。
import type {
  HardeningStudioSidePaneTab,
  WorkspaceSidePaneState,
} from "../lib/workspaceSidePane.js";

/** Hardening tab 固定单例 id（一个 workspace 一个 Hardening 表面）。 */
export const HARDENING_SIDE_PANE_TAB_ID = "hardening" as const;

export function createHardeningSidePaneTab(options: {
  workspaceKey?: string | null;
}): HardeningStudioSidePaneTab {
  return {
    id: HARDENING_SIDE_PANE_TAB_ID,
    type: "hardening",
    ...(options.workspaceKey !== undefined ? { workspaceKey: options.workspaceKey } : {}),
    openedAt: Date.now(),
  };
}

/**
 * 打开（或幂等聚焦）Hardening tab：
 * - 已存在 → 仅激活（不重复开新 tab，不改动既有 tabs 顺序）；
 * - 不存在 → 追加并激活。
 * 纯函数；输入不被修改。
 */
export function resolveHardeningTabState(
  current: WorkspaceSidePaneState | null,
  options: {
    workspaceKey?: string | null;
  },
): WorkspaceSidePaneState {
  const existing = current?.tabs.find(
    (tab): tab is HardeningStudioSidePaneTab =>
      tab.type === HARDENING_SIDE_PANE_TAB_ID,
  );
  if (existing && current) {
    if (current.activeTabId === existing.id) {
      return current;
    }
    return { tabs: current.tabs, activeTabId: existing.id };
  }
  const tab = createHardeningSidePaneTab(options);
  if (!current) {
    return { tabs: [tab], activeTabId: tab.id };
  }
  return { tabs: [...current.tabs, tab], activeTabId: tab.id };
}
