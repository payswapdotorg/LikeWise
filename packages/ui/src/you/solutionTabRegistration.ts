// YOU Solution Studio — Solution tab 注册纯逻辑（W1B）。
//
// 「open/聚焦 Solution tab」的状态转移放在 you/ 子树（保持子树可被
// `pnpm exec tsx --test packages/ui/src/you` 直接加载：本文件只含 type-only 的
// lib 导入，运行时零依赖）。lib/workspaceSidePane.ts 的 registration-only seam
// 委托到这里；tab 类型与 union 仍归 lib 所有。
import type {
  SolutionSidePaneTab,
  WorkspaceSidePaneState,
} from "../lib/workspaceSidePane.js";

/** Solution tab 固定单例 id（一个 workspace 一个 Solution 表面）。 */
export const SOLUTION_SIDE_PANE_TAB_ID = "solution" as const;

export function createSolutionSidePaneTab(options: {
  workspaceKey?: string | null;
}): SolutionSidePaneTab {
  return {
    id: SOLUTION_SIDE_PANE_TAB_ID,
    type: "solution",
    ...(options.workspaceKey !== undefined ? { workspaceKey: options.workspaceKey } : {}),
    openedAt: Date.now(),
  };
}

/**
 * 打开（或幂等聚焦）Solution tab：
 * - 已存在 → 仅激活（不重复开新 tab，不改动既有 tabs 顺序）；
 * - 不存在 → 追加并激活。
 * 纯函数；输入不被修改。
 */
export function resolveSolutionTabState(
  current: WorkspaceSidePaneState | null,
  options: {
    workspaceKey?: string | null;
  },
): WorkspaceSidePaneState {
  const existing = current?.tabs.find(
    (tab): tab is SolutionSidePaneTab => tab.type === SOLUTION_SIDE_PANE_TAB_ID,
  );
  if (existing && current) {
    if (current.activeTabId === existing.id) {
      return current;
    }
    return { tabs: current.tabs, activeTabId: existing.id };
  }
  const tab = createSolutionSidePaneTab(options);
  if (!current) {
    return { tabs: [tab], activeTabId: tab.id };
  }
  return { tabs: [...current.tabs, tab], activeTabId: tab.id };
}
