// W1B logic tests — native 注册逻辑（node:test）。
//
// 覆盖：Solution tab 的幂等打开（you/solutionTabRegistration，lib seam 委托此纯逻辑）
// 与「+」launcher 的项解析（app-shell 纯函数）。
// 说明：lib/workspaceSidePane.ts 本体含 `@/` 别名导入，无法在仓库根目录的
// `pnpm exec tsx` 下直接加载，因此 lib 侧仅经由委托函数间接覆盖（见交付报告
// 的 deviations/limitations）。workspace-global 可见性由 lib 既有通用机制承担。
import assert from "node:assert/strict";
import test from "node:test";
import {
  createSolutionSidePaneTab,
  resolveSolutionTabState,
  SOLUTION_SIDE_PANE_TAB_ID,
} from "./solutionTabRegistration.js";
import { resolveOpenTabLauncherItemIds } from "../app-shell/animatedSidePanePanelModel.js";

test("opening the Solution tab is idempotent: one singleton tab, activated, order preserved", () => {
  const first = resolveSolutionTabState(null, { workspaceKey: "ws-a" });
  assert.equal(first.tabs.length, 1);
  assert.equal(first.tabs[0]!.type, "solution");
  assert.equal(first.tabs[0]!.id, SOLUTION_SIDE_PANE_TAB_ID);
  assert.equal(first.tabs[0]!.workspaceKey, "ws-a");
  assert.equal(first.activeTabId, SOLUTION_SIDE_PANE_TAB_ID);

  // 幂等：已开时仅聚焦，不新增 tab，不改顺序。
  const second = resolveSolutionTabState(first, { workspaceKey: "ws-a" });
  assert.equal(second.tabs.length, 1);
  assert.equal(second.activeTabId, SOLUTION_SIDE_PANE_TAB_ID);

  // 已聚焦时为 no-op（返回同一引用）。
  const third = resolveSolutionTabState(second, { workspaceKey: "ws-a" });
  assert.equal(third, second);

  // 与其它 tab 共存：追加并激活，不破坏既有顺序。
  const withTerminal = {
    tabs: [
      { id: "terminal:1", type: "terminal" as const, title: "bash", openedAt: 1 },
      ...first.tabs,
    ],
    activeTabId: "terminal:1",
  };
  const next = resolveSolutionTabState(withTerminal, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 2);
  assert.equal(next.tabs[0]!.id, "terminal:1");
  assert.equal(next.activeTabId, SOLUTION_SIDE_PANE_TAB_ID);
});

test("the tab stamps workspace ownership for workspace isolation", () => {
  const tab = createSolutionSidePaneTab({ workspaceKey: "ws-key-1" });
  assert.equal(tab.workspaceKey, "ws-key-1");
  assert.equal(tab.type, "solution");
  assert.equal(typeof tab.openedAt, "number");
  // 缺省不写 workspaceKey（跟随宿主 scope 冻结，与兄弟 tab 语义一致）。
  assert.equal("workspaceKey" in createSolutionSidePaneTab({}), false);
});

test("launcher offers solution only when the tab is not open", () => {
  const base = {
    developerToolsEnabled: false,
    hasReviewTab: false,
    hasSolutionTab: false,
  };
  assert.deepEqual(resolveOpenTabLauncherItemIds(base), [
    "review",
    "terminal",
    "browser",
    "solution",
  ]);

  assert.deepEqual(
    resolveOpenTabLauncherItemIds({ ...base, hasSolutionTab: true }),
    ["review", "terminal", "browser"],
  );

  // 既有行为不受影响：developer tools / review / 无浏览器环境。
  assert.deepEqual(
    resolveOpenTabLauncherItemIds({
      developerToolsEnabled: true,
      hasReviewTab: true,
      hasSolutionTab: false,
      supportsEmbeddedBrowser: false,
    }),
    ["terminal", "developer-tools", "solution"],
  );

  assert.deepEqual(
    resolveOpenTabLauncherItemIds({
      canOpenSelectionSideConversation: true,
      developerToolsEnabled: false,
      hasReviewTab: false,
      hasSolutionTab: false,
    }),
    ["selection-side-conversation", "review", "terminal", "browser", "solution"],
  );
});
