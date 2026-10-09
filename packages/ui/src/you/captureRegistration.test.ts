// W2B logic tests — native 注册逻辑（node:test）。
//
// 覆盖：Capture tab 的幂等打开（you/captureTabRegistration，lib seam 委托此纯逻辑）、
// 「+」launcher 的项解析（app-shell 纯函数）、以及与 Solution 表面同级的键盘可用性
// 语义（纯转移表）。说明：lib/workspaceSidePane.ts 本体含 `@/` 别名导入，无法在仓库
// 根目录的 `pnpm exec tsx` 下直接加载，因此 lib 侧仅经由委托函数间接覆盖（与 W1B
// 注册测试同款做法）。workspace-global 可见性由 lib 既有通用机制承担。
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceSidePaneState } from "../lib/workspaceSidePane.js";
import {
  createCaptureSidePaneTab,
  resolveCaptureTabState,
  CAPTURE_SIDE_PANE_TAB_ID,
} from "./captureTabRegistration.js";
import { resolveOpenTabLauncherItemIds } from "../app-shell/animatedSidePanePanelModel.js";
import {
  resolveCaptureGuideKeyboardTransition,
  clampGuideStepIndex,
} from "./captureStudioProjection.js";

test("opening the Capture tab is idempotent: one singleton tab, activated, order preserved", () => {
  const first = resolveCaptureTabState(null, { workspaceKey: "ws-a" });
  assert.equal(first.tabs.length, 1);
  assert.equal(first.tabs[0]!.type, "capture");
  assert.equal(first.tabs[0]!.id, CAPTURE_SIDE_PANE_TAB_ID);
  assert.equal(first.tabs[0]!.workspaceKey, "ws-a");
  assert.equal(first.activeTabId, CAPTURE_SIDE_PANE_TAB_ID);

  // 幂等：已开时仅聚焦，不新增 tab，不改顺序。
  const second = resolveCaptureTabState(first, { workspaceKey: "ws-a" });
  assert.equal(second.tabs.length, 1);
  assert.equal(second.activeTabId, CAPTURE_SIDE_PANE_TAB_ID);

  // 已聚焦时为 no-op（返回同一引用）。
  const third = resolveCaptureTabState(second, { workspaceKey: "ws-a" });
  assert.equal(third, second);

  // 与其它 tab 共存：追加并激活，不破坏既有顺序（关闭/重开走 shell 既有机制）。
  const withTerminal: WorkspaceSidePaneState = {
    tabs: [
      { id: "terminal:1", type: "terminal", title: "bash", openedAt: 1 },
      ...first.tabs,
    ],
    activeTabId: "terminal:1",
  };
  const next = resolveCaptureTabState(withTerminal, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 2);
  assert.equal(next.tabs[0]!.id, "terminal:1");
  assert.equal(next.activeTabId, CAPTURE_SIDE_PANE_TAB_ID);
});

test("capture and solution tabs coexist as independent singleton surfaces", () => {
  const withSolution: WorkspaceSidePaneState = {
    tabs: [{ id: "solution", type: "solution", openedAt: 1 }],
    activeTabId: "solution",
  };
  const next = resolveCaptureTabState(withSolution, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 2);
  assert.equal(next.tabs.map((tab) => tab.type).includes("solution"), true);
  assert.equal(next.tabs.map((tab) => tab.type).includes("capture"), true);
  assert.equal(next.activeTabId, CAPTURE_SIDE_PANE_TAB_ID);
});

test("the tab stamps workspace ownership for workspace isolation", () => {
  const tab = createCaptureSidePaneTab({ workspaceKey: "ws-key-1" });
  assert.equal(tab.workspaceKey, "ws-key-1");
  assert.equal(tab.type, "capture");
  assert.equal(typeof tab.openedAt, "number");
  // 缺省不写 workspaceKey（跟随宿主 scope 冻结，与兄弟 tab 语义一致）。
  assert.equal("workspaceKey" in createCaptureSidePaneTab({}), false);
});

test("launcher offers capture only when the tab is not open", () => {
  const base = {
    developerToolsEnabled: false,
    hasReviewTab: false,
    hasSolutionTab: false,
    hasCaptureTab: false,
  };
  assert.deepEqual(resolveOpenTabLauncherItemIds(base), [
    "review",
    "terminal",
    "browser",
    "solution",
    "capture",
  ]);

  assert.deepEqual(
    resolveOpenTabLauncherItemIds({ ...base, hasCaptureTab: true }),
    ["review", "terminal", "browser", "solution"],
  );

  // 既有行为不受影响：developer tools / review / 无浏览器环境。
  assert.deepEqual(
    resolveOpenTabLauncherItemIds({
      developerToolsEnabled: true,
      hasReviewTab: true,
      hasSolutionTab: false,
      hasCaptureTab: false,
      supportsEmbeddedBrowser: false,
    }),
    ["terminal", "developer-tools", "solution", "capture"],
  );

  assert.deepEqual(
    resolveOpenTabLauncherItemIds({
      canOpenSelectionSideConversation: true,
      developerToolsEnabled: false,
      hasReviewTab: false,
      hasSolutionTab: false,
      hasCaptureTab: false,
    }),
    ["selection-side-conversation", "review", "terminal", "browser", "solution", "capture"],
  );
});

test("keyboard parity with the Solution surface: guide list is fully keyboard-navigable", () => {
  // 与 Solution 视口同款语义：方向键移动、Home/End 首末、Enter 主操作。
  const active = { sessionActive: true, totalSteps: 3 };
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("ArrowUp", active), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("ArrowDown", active), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("Enter", active), { kind: "capture" });

  // 光标夹紧保证键盘导航不会越界（与 Solution 相机夹紧同款防御）。
  assert.equal(clampGuideStepIndex(-1, 3), 0);
  assert.equal(clampGuideStepIndex(99, 3), 2);
});
