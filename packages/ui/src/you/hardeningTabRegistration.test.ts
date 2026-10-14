// W10B logic tests — native 注册逻辑（node:test）。
//
// 覆盖：Hardening tab 的幂等打开（you/hardeningTabRegistration，lib seam 委托此
// 纯逻辑）、「+」launcher 的项解析（app-shell 纯函数——hardening 位列 LAST，在
// lab 之后）、以及与 Solution/Capture/Twin/Performance/Editing/Learning/Avatar/
// Escalation/Lab 表面同级的键盘可用性语义（纯转移表）。说明：
// lib/workspaceSidePane.ts 本体含 `@/` 别名导入，无法在仓库根目录的
// `pnpm exec tsx` 下直接加载，因此 lib 侧仅经由委托函数间接覆盖（与 W1B–W9B
// 注册测试同款做法）。workspace-global 可见性由 lib 既有通用机制承担。
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceSidePaneState } from "../lib/workspaceSidePane.js";
import {
  createHardeningSidePaneTab,
  resolveHardeningTabState,
  HARDENING_SIDE_PANE_TAB_ID,
} from "./hardeningTabRegistration.js";
import { resolveOpenTabLauncherItemIds } from "../app-shell/animatedSidePanePanelModel.js";
import {
  clampHardeningIndex,
  resolveHardeningKeyboardTransition,
} from "./hardeningStudioProjection.js";

test("opening the Hardening tab is idempotent: one singleton tab, activated, order preserved", () => {
  const first = resolveHardeningTabState(null, { workspaceKey: "ws-a" });
  assert.equal(first.tabs.length, 1);
  assert.equal(first.tabs[0]!.type, "hardening");
  assert.equal(first.tabs[0]!.id, HARDENING_SIDE_PANE_TAB_ID);
  assert.equal(first.tabs[0]!.workspaceKey, "ws-a");
  assert.equal(first.activeTabId, HARDENING_SIDE_PANE_TAB_ID);

  // 幂等：已开时仅聚焦，不新增 tab，不改顺序。
  const second = resolveHardeningTabState(first, { workspaceKey: "ws-a" });
  assert.equal(second.tabs.length, 1);
  assert.equal(second.activeTabId, HARDENING_SIDE_PANE_TAB_ID);

  // 已聚焦时为 no-op（返回同一引用）。
  const third = resolveHardeningTabState(second, { workspaceKey: "ws-a" });
  assert.equal(third, second);

  // 与其它 tab 共存：追加并激活，不破坏既有顺序（关闭/重开走 shell 既有机制）。
  const withTerminal: WorkspaceSidePaneState = {
    tabs: [
      { id: "terminal:1", type: "terminal", title: "bash", openedAt: 1 },
      ...first.tabs,
    ],
    activeTabId: "terminal:1",
  };
  const next = resolveHardeningTabState(withTerminal, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 2);
  assert.equal(next.tabs[0]!.id, "terminal:1");
  assert.equal(next.activeTabId, HARDENING_SIDE_PANE_TAB_ID);
});

test("hardening coexists with all nine sibling YOU surfaces as independent singletons", () => {
  const withSiblings: WorkspaceSidePaneState = {
    tabs: [
      { id: "solution", type: "solution", openedAt: 1 },
      { id: "capture", type: "capture", openedAt: 2 },
      { id: "twin", type: "twin", openedAt: 3 },
      { id: "performance", type: "performance", openedAt: 4 },
      { id: "editing", type: "editing", openedAt: 5 },
      { id: "learning", type: "learning", openedAt: 6 },
      { id: "avatar", type: "avatar", openedAt: 7 },
      { id: "escalation", type: "escalation", openedAt: 8 },
      { id: "lab", type: "lab", openedAt: 9 },
    ],
    activeTabId: "solution",
  };
  const next = resolveHardeningTabState(withSiblings, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 10);
  assert.equal(next.activeTabId, HARDENING_SIDE_PANE_TAB_ID);
  // 既有 tab 顺序不变（hardening 追加在末位）。
  assert.deepEqual(
    next.tabs.map((tab) => tab.type),
    [
      "solution",
      "capture",
      "twin",
      "performance",
      "editing",
      "learning",
      "avatar",
      "escalation",
      "lab",
      "hardening",
    ],
  );
});

test("the tab stamps workspace ownership for workspace isolation", () => {
  const tab = createHardeningSidePaneTab({ workspaceKey: "ws-key-1" });
  assert.equal(tab.workspaceKey, "ws-key-1");
  assert.equal(tab.type, "hardening");
  assert.equal(typeof tab.openedAt, "number");
  // 缺省不写 workspaceKey（跟随宿主 scope 冻结，与兄弟 tab 语义一致）。
  assert.equal("workspaceKey" in createHardeningSidePaneTab({}), false);
});

test("launcher offers hardening only when the tab is not open (hardening is LAST, after lab)", () => {
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
    "learning",
    "avatar",
    "escalation",
    "lab",
    "hardening",
    "conformance",
    "release",
  ]);

  assert.deepEqual(
    resolveOpenTabLauncherItemIds({ ...base, hasHardeningTab: true }),
    [
      "review",
      "terminal",
      "browser",
      "solution",
      "capture",
      "twin",
      "performance",
      "editing",
      "learning",
      "avatar",
      "escalation",
      "lab",
      "conformance",
      "release",
    ],
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
    [
      "terminal",
      "developer-tools",
      "solution",
      "capture",
      "twin",
      "performance",
      "editing",
      "learning",
      "avatar",
      "escalation",
      "lab",
      "hardening",
      "conformance",
      "release",
    ],
  );

  // 未传 hasHardeningTab 时缺省 false（既有调用点零行为变化，入口照常出现）。
  assert.deepEqual(
    resolveOpenTabLauncherItemIds({
      developerToolsEnabled: false,
      hasReviewTab: false,
      hasSolutionTab: false,
      hasCaptureTab: false,
    }),
    [
      "review",
      "terminal",
      "browser",
      "solution",
      "capture",
      "twin",
      "performance",
      "editing",
      "learning",
      "avatar",
      "escalation",
      "lab",
      "hardening",
      "conformance",
      "release",
    ],
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
      "learning",
      "avatar",
      "escalation",
      "lab",
      "hardening",
      "conformance",
      "release",
    ],
  );
});

test("keyboard parity with the sibling surfaces: the enforcement ledger is fully keyboard-navigable", () => {
  // 与 Twin 版本列表 / Learning 信号列表 / Escalation 列表同款语义：方向键移动、
  // Home/End 首末、Enter 主操作。
  const state = { totalEnforcements: 3 };
  assert.deepEqual(resolveHardeningKeyboardTransition("ArrowUp", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveHardeningKeyboardTransition("ArrowDown", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveHardeningKeyboardTransition("Home", state), {
    kind: "move",
    delta: -3,
  });
  assert.deepEqual(resolveHardeningKeyboardTransition("End", state), {
    kind: "move",
    delta: 3,
  });
  assert.deepEqual(resolveHardeningKeyboardTransition("Enter", state), {
    kind: "select",
  });
  assert.deepEqual(resolveHardeningKeyboardTransition("Escape", state), {
    kind: "none",
  });

  // 光标夹紧保证键盘导航不会越界（与兄弟表面光标夹紧同款防御）。
  assert.equal(clampHardeningIndex(-1, 3), 0);
  assert.equal(clampHardeningIndex(99, 3), 2);
  assert.equal(clampHardeningIndex(0, 0), 0);
});
