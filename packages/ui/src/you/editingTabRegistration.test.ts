// W5B logic tests — native 注册逻辑（node:test）。
//
// 覆盖：Editing tab 的幂等打开（you/editingTabRegistration，lib seam 委托此纯逻辑）、「+」
// launcher 的项解析（app-shell 纯函数）、以及与 Solution/Capture/Twin/Performance 表面
// 同级的键盘可用性语义（纯转移表）。说明：lib/workspaceSidePane.ts 本体含 `@/` 别名导入，
// 无法在仓库根目录的 `pnpm exec tsx` 下直接加载，因此 lib 侧仅经由委托函数间接覆盖（与
// W1B/W2B/W3B/W4B 注册测试同款做法）。workspace-global 可见性由 lib 既有通用机制承担。
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceSidePaneState } from "../lib/workspaceSidePane.js";
import {
  createEditingSidePaneTab,
  resolveEditingTabState,
  EDITING_SIDE_PANE_TAB_ID,
} from "./editingTabRegistration.js";
import { resolveOpenTabLauncherItemIds } from "../app-shell/animatedSidePanePanelModel.js";
import {
  clampSessionIndex,
  resolveEditingKeyboardTransition,
} from "./editingStudioProjection.js";

test("opening the Editing tab is idempotent: one singleton tab, activated, order preserved", () => {
  const first = resolveEditingTabState(null, { workspaceKey: "ws-a" });
  assert.equal(first.tabs.length, 1);
  assert.equal(first.tabs[0]!.type, "editing");
  assert.equal(first.tabs[0]!.id, EDITING_SIDE_PANE_TAB_ID);
  assert.equal(first.tabs[0]!.workspaceKey, "ws-a");
  assert.equal(first.activeTabId, EDITING_SIDE_PANE_TAB_ID);

  // 幂等：已开时仅聚焦，不新增 tab，不改顺序。
  const second = resolveEditingTabState(first, { workspaceKey: "ws-a" });
  assert.equal(second.tabs.length, 1);
  assert.equal(second.activeTabId, EDITING_SIDE_PANE_TAB_ID);

  // 已聚焦时为 no-op（返回同一引用）。
  const third = resolveEditingTabState(second, { workspaceKey: "ws-a" });
  assert.equal(third, second);

  // 与其它 tab 共存：追加并激活，不破坏既有顺序（关闭/重开走 shell 既有机制）。
  const withTerminal: WorkspaceSidePaneState = {
    tabs: [
      { id: "terminal:1", type: "terminal", title: "bash", openedAt: 1 },
      ...first.tabs,
    ],
    activeTabId: "terminal:1",
  };
  const next = resolveEditingTabState(withTerminal, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 2);
  assert.equal(next.tabs[0]!.id, "terminal:1");
  assert.equal(next.activeTabId, EDITING_SIDE_PANE_TAB_ID);
});

test("editing, solution, capture, twin and performance tabs coexist as independent singleton surfaces", () => {
  const withSiblings: WorkspaceSidePaneState = {
    tabs: [
      { id: "solution", type: "solution", openedAt: 1 },
      { id: "capture", type: "capture", openedAt: 2 },
      { id: "twin", type: "twin", openedAt: 3 },
      { id: "performance", type: "performance", openedAt: 4 },
    ],
    activeTabId: "solution",
  };
  const next = resolveEditingTabState(withSiblings, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 5);
  assert.equal(next.activeTabId, EDITING_SIDE_PANE_TAB_ID);
  // 既有 tab 顺序不变（editing 追加在末位）。
  assert.deepEqual(
    next.tabs.map((tab) => tab.type),
    ["solution", "capture", "twin", "performance", "editing"],
  );
});

test("the tab stamps workspace ownership for workspace isolation", () => {
  const tab = createEditingSidePaneTab({ workspaceKey: "ws-key-1" });
  assert.equal(tab.workspaceKey, "ws-key-1");
  assert.equal(tab.type, "editing");
  assert.equal(typeof tab.openedAt, "number");
  // 缺省不写 workspaceKey（跟随宿主 scope 冻结，与兄弟 tab 语义一致）。
  assert.equal("workspaceKey" in createEditingSidePaneTab({}), false);
});

test("launcher offers editing only when the tab is not open", () => {
  const base = {
    developerToolsEnabled: false,
    hasReviewTab: false,
    hasSolutionTab: false,
    hasCaptureTab: false,
    hasTwinTab: false,
  };
  assert.deepEqual(resolveOpenTabLauncherItemIds(base), [
    "review",
    "terminal",
    "browser",
    "solution",
    "capture",
    "twin",
    "performance",
    "editing",
  ]);

  assert.deepEqual(
    resolveOpenTabLauncherItemIds({ ...base, hasEditingTab: true }),
    ["review", "terminal", "browser", "solution", "capture", "twin", "performance"],
  );

  // 既有行为不受影响：developer tools / review / 无浏览器环境 / 缺省参数向后兼容。
  assert.deepEqual(
    resolveOpenTabLauncherItemIds({
      developerToolsEnabled: true,
      hasReviewTab: true,
      hasSolutionTab: false,
      hasCaptureTab: false,
      supportsEmbeddedBrowser: false,
    }),
    ["terminal", "developer-tools", "solution", "capture", "twin", "performance", "editing"],
  );

  // 未传 hasEditingTab 时缺省 false（既有调用点零行为变化，editing 入口照常出现）。
  assert.deepEqual(
    resolveOpenTabLauncherItemIds({
      developerToolsEnabled: false,
      hasReviewTab: false,
      hasSolutionTab: false,
      hasCaptureTab: false,
    }),
    ["review", "terminal", "browser", "solution", "capture", "twin", "performance", "editing"],
  );

  assert.deepEqual(
    resolveOpenTabLauncherItemIds({
      canOpenSelectionSideConversation: true,
      developerToolsEnabled: false,
      hasReviewTab: false,
      hasSolutionTab: false,
      hasCaptureTab: false,
      hasTwinTab: false,
    }),
    [
      "selection-side-conversation",
      "review",
      "terminal",
      "browser",
      "solution",
      "capture",
      "twin",
      "performance",
      "editing",
    ],
  );
});

test("keyboard parity with the Solution/Capture/Twin/Performance surfaces: session list is fully keyboard-navigable", () => {
  // 与 Twin 版本列表同款语义：方向键移动、Home/End 首末、Enter 主操作（选中检视）。
  const state = { totalSessions: 3 };
  assert.deepEqual(resolveEditingKeyboardTransition("ArrowUp", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveEditingKeyboardTransition("ArrowDown", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveEditingKeyboardTransition("ArrowLeft", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveEditingKeyboardTransition("ArrowRight", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveEditingKeyboardTransition("Home", state), {
    kind: "move",
    delta: -3,
  });
  assert.deepEqual(resolveEditingKeyboardTransition("End", state), {
    kind: "move",
    delta: 3,
  });
  assert.deepEqual(resolveEditingKeyboardTransition("Enter", state), { kind: "select" });
  assert.deepEqual(resolveEditingKeyboardTransition("Escape", state), { kind: "none" });

  // 光标夹紧保证键盘导航不会越界（与 Twin 版本光标夹紧同款防御）。
  assert.equal(clampSessionIndex(-1, 3), 0);
  assert.equal(clampSessionIndex(99, 3), 2);
  assert.equal(clampSessionIndex(0, 0), 0);
});
