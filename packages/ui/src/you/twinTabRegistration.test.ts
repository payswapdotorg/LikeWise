// W3B logic tests — native 注册逻辑（node:test）。
//
// 覆盖：Twin tab 的幂等打开（you/twinTabRegistration，lib seam 委托此纯逻辑）、
// 「+」launcher 的项解析（app-shell 纯函数）、以及与 Solution/Capture 表面同级的
// 键盘可用性语义（纯转移表）。说明：lib/workspaceSidePane.ts 本体含 `@/` 别名导入，
// 无法在仓库根目录的 `pnpm exec tsx` 下直接加载，因此 lib 侧仅经由委托函数间接覆盖
// （与 W1B/W2B 注册测试同款做法）。workspace-global 可见性由 lib 既有通用机制承担。
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceSidePaneState } from "../lib/workspaceSidePane.js";
import {
  createTwinSidePaneTab,
  resolveTwinTabState,
  TWIN_SIDE_PANE_TAB_ID,
} from "./twinTabRegistration.js";
import { resolveOpenTabLauncherItemIds } from "../app-shell/animatedSidePanePanelModel.js";
import {
  clampVersionIndex,
  resolveTwinVersionKeyboardTransition,
} from "./twinStudioProjection.js";

test("opening the Twin tab is idempotent: one singleton tab, activated, order preserved", () => {
  const first = resolveTwinTabState(null, { workspaceKey: "ws-a" });
  assert.equal(first.tabs.length, 1);
  assert.equal(first.tabs[0]!.type, "twin");
  assert.equal(first.tabs[0]!.id, TWIN_SIDE_PANE_TAB_ID);
  assert.equal(first.tabs[0]!.workspaceKey, "ws-a");
  assert.equal(first.activeTabId, TWIN_SIDE_PANE_TAB_ID);

  // 幂等：已开时仅聚焦，不新增 tab，不改顺序。
  const second = resolveTwinTabState(first, { workspaceKey: "ws-a" });
  assert.equal(second.tabs.length, 1);
  assert.equal(second.activeTabId, TWIN_SIDE_PANE_TAB_ID);

  // 已聚焦时为 no-op（返回同一引用）。
  const third = resolveTwinTabState(second, { workspaceKey: "ws-a" });
  assert.equal(third, second);

  // 与其它 tab 共存：追加并激活，不破坏既有顺序（关闭/重开走 shell 既有机制）。
  const withTerminal: WorkspaceSidePaneState = {
    tabs: [
      { id: "terminal:1", type: "terminal", title: "bash", openedAt: 1 },
      ...first.tabs,
    ],
    activeTabId: "terminal:1",
  };
  const next = resolveTwinTabState(withTerminal, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 2);
  assert.equal(next.tabs[0]!.id, "terminal:1");
  assert.equal(next.activeTabId, TWIN_SIDE_PANE_TAB_ID);
});

test("twin, solution and capture tabs coexist as independent singleton surfaces", () => {
  const withSiblings: WorkspaceSidePaneState = {
    tabs: [
      { id: "solution", type: "solution", openedAt: 1 },
      { id: "capture", type: "capture", openedAt: 2 },
    ],
    activeTabId: "solution",
  };
  const next = resolveTwinTabState(withSiblings, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 3);
  assert.equal(next.tabs.map((tab) => tab.type).includes("solution"), true);
  assert.equal(next.tabs.map((tab) => tab.type).includes("capture"), true);
  assert.equal(next.tabs.map((tab) => tab.type).includes("twin"), true);
  assert.equal(next.activeTabId, TWIN_SIDE_PANE_TAB_ID);
  // 既有 tab 顺序不变（twin 追加在末位）。
  assert.deepEqual(
    next.tabs.map((tab) => tab.type),
    ["solution", "capture", "twin"],
  );
});

test("the tab stamps workspace ownership for workspace isolation", () => {
  const tab = createTwinSidePaneTab({ workspaceKey: "ws-key-1" });
  assert.equal(tab.workspaceKey, "ws-key-1");
  assert.equal(tab.type, "twin");
  assert.equal(typeof tab.openedAt, "number");
  // 缺省不写 workspaceKey（跟随宿主 scope 冻结，与兄弟 tab 语义一致）。
  assert.equal("workspaceKey" in createTwinSidePaneTab({}), false);
});

test("launcher offers twin only when the tab is not open", () => {
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
    resolveOpenTabLauncherItemIds({ ...base, hasTwinTab: true }),
    ["review", "terminal", "browser", "solution", "capture", "performance", "editing"],
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

  // 未传 hasTwinTab 时缺省 false（既有调用点零行为变化，twin 入口照常出现）。
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

test("keyboard parity with the Solution/Capture surfaces: version list is fully keyboard-navigable", () => {
  // 与 Capture 引导列表同款语义：方向键移动、Home/End 首末、Enter 主操作（选中检视）。
  const state = { totalVersions: 3 };
  assert.deepEqual(resolveTwinVersionKeyboardTransition("ArrowUp", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveTwinVersionKeyboardTransition("ArrowDown", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveTwinVersionKeyboardTransition("ArrowLeft", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveTwinVersionKeyboardTransition("ArrowRight", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveTwinVersionKeyboardTransition("Home", state), {
    kind: "move",
    delta: -3,
  });
  assert.deepEqual(resolveTwinVersionKeyboardTransition("End", state), {
    kind: "move",
    delta: 3,
  });
  assert.deepEqual(resolveTwinVersionKeyboardTransition("Enter", state), { kind: "select" });
  assert.deepEqual(resolveTwinVersionKeyboardTransition("Escape", state), { kind: "none" });

  // 光标夹紧保证键盘导航不会越界（与 Solution 相机夹紧同款防御）。
  assert.equal(clampVersionIndex(-1, 3), 0);
  assert.equal(clampVersionIndex(99, 3), 2);
  assert.equal(clampVersionIndex(0, 0), 0);
});
