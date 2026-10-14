// W11B logic tests — native 注册逻辑（node:test）。
//
// 覆盖：Conformance tab 的幂等打开（you/conformanceTabRegistration，lib seam 委托
// 此纯逻辑）、「+」launcher 的项解析（app-shell 纯函数——conformance 位列 LAST，
// 在 hardening 之后）、以及与 Solution/Capture/Twin/Performance/Editing/Learning/
// Avatar/Escalation/Lab/Hardening 表面同级的键盘可用性语义（纯转移表）。说明：
// lib/workspaceSidePane.ts 本体含 `@/` 别名导入，无法在仓库根目录的
// `pnpm exec tsx` 下直接加载，因此 lib 侧仅经由委托函数间接覆盖（与 W1B–W10B
// 注册测试同款做法）。workspace-global 可见性由 lib 既有通用机制承担。
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceSidePaneState } from "../lib/workspaceSidePane.js";
import {
  createConformanceSidePaneTab,
  resolveConformanceTabState,
  CONFORMANCE_SIDE_PANE_TAB_ID,
} from "./conformanceTabRegistration.js";
import { resolveOpenTabLauncherItemIds } from "../app-shell/animatedSidePanePanelModel.js";
import {
  clampConformanceIndex,
  resolveConformanceKeyboardTransition,
} from "./conformanceStudioProjection.js";

test("opening the Conformance tab is idempotent: one singleton tab, activated, order preserved", () => {
  const first = resolveConformanceTabState(null, { workspaceKey: "ws-a" });
  assert.equal(first.tabs.length, 1);
  assert.equal(first.tabs[0]!.type, "conformance");
  assert.equal(first.tabs[0]!.id, CONFORMANCE_SIDE_PANE_TAB_ID);
  assert.equal(first.tabs[0]!.workspaceKey, "ws-a");
  assert.equal(first.activeTabId, CONFORMANCE_SIDE_PANE_TAB_ID);

  // 幂等：已开时仅聚焦，不新增 tab，不改顺序。
  const second = resolveConformanceTabState(first, { workspaceKey: "ws-a" });
  assert.equal(second.tabs.length, 1);
  assert.equal(second.activeTabId, CONFORMANCE_SIDE_PANE_TAB_ID);

  // 已聚焦时为 no-op（返回同一引用）。
  const third = resolveConformanceTabState(second, { workspaceKey: "ws-a" });
  assert.equal(third, second);

  // 与其它 tab 共存：追加并激活，不破坏既有顺序（关闭/重开走 shell 既有机制）。
  const withTerminal: WorkspaceSidePaneState = {
    tabs: [
      { id: "terminal:1", type: "terminal", title: "bash", openedAt: 1 },
      ...first.tabs,
    ],
    activeTabId: "terminal:1",
  };
  const next = resolveConformanceTabState(withTerminal, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 2);
  assert.equal(next.tabs[0]!.id, "terminal:1");
  assert.equal(next.activeTabId, CONFORMANCE_SIDE_PANE_TAB_ID);
});

test("conformance coexists with all ten sibling YOU surfaces as independent singletons", () => {
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
      { id: "hardening", type: "hardening", openedAt: 10 },
    ],
    activeTabId: "solution",
  };
  const next = resolveConformanceTabState(withSiblings, { workspaceKey: "ws-a" });
  assert.equal(next.tabs.length, 11);
  assert.equal(next.activeTabId, CONFORMANCE_SIDE_PANE_TAB_ID);
  // 既有 tab 顺序不变（conformance 追加在末位）。
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
      "conformance",
    ],
  );
});

test("the tab stamps workspace ownership for workspace isolation", () => {
  const tab = createConformanceSidePaneTab({ workspaceKey: "ws-key-1" });
  assert.equal(tab.workspaceKey, "ws-key-1");
  assert.equal(tab.type, "conformance");
  assert.equal(typeof tab.openedAt, "number");
  // 缺省不写 workspaceKey（跟随宿主 scope 冻结，与兄弟 tab 语义一致）。
  assert.equal("workspaceKey" in createConformanceSidePaneTab({}), false);
});

test("launcher offers conformance only when the tab is not open (conformance is LAST, after hardening)", () => {
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
    resolveOpenTabLauncherItemIds({ ...base, hasConformanceTab: true }),
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

  // 未传 hasConformanceTab 时缺省 false（既有调用点零行为变化，conformance 入口
  // 照常出现）。
  assert.deepEqual(
    resolveOpenTabLauncherItemIds({
      developerToolsEnabled: false,
      hasReviewTab: true,
      hasSolutionTab: false,
      hasCaptureTab: false,
    }),
    [
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

  // 全开时 launcher 仍提供浏览器与终端（既有语义）。
  assert.deepEqual(
    resolveOpenTabLauncherItemIds({
      ...base,
      hasSolutionTab: true,
      hasCaptureTab: true,
      hasTwinTab: true,
      hasPerformanceTab: true,
      hasEditingTab: true,
      hasLearningTab: true,
      hasAvatarTab: true,
      hasEscalationTab: true,
      hasLabTab: true,
      hasHardeningTab: true,
      hasConformanceTab: true,
      hasReleaseTab: true,
    }),
    ["review", "terminal", "browser"],
  );
});

test("keyboard parity with the sibling surfaces: the journey run list is fully keyboard-navigable", () => {
  const state = { totalJourneyRuns: 4 };
  assert.deepEqual(resolveConformanceKeyboardTransition("ArrowUp", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("ArrowLeft", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("ArrowDown", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("ArrowRight", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("Home", state), {
    kind: "move",
    delta: -4,
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("End", state), {
    kind: "move",
    delta: 4,
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("Enter", state), {
    kind: "select",
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("Escape", state), {
    kind: "none",
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("a", state), {
    kind: "none",
  });

  // 光标夹紧：[0, total-1]；total 为 0 时归 0。
  assert.equal(clampConformanceIndex(-3, 4), 0);
  assert.equal(clampConformanceIndex(2, 4), 2);
  assert.equal(clampConformanceIndex(9, 4), 3);
  assert.equal(clampConformanceIndex(0, 0), 0);
  assert.equal(clampConformanceIndex(5, 0), 0);
});
