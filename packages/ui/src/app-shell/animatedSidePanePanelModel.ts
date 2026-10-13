const MIN_PREVIEW_PANE_HEAVY_CONTENT_VISIBLE_INLINE_SIZE_PX = 96;

export type OpenTabLauncherItemId =
  | "selection-side-conversation"
  | "review"
  | "terminal"
  | "browser"
  | "developer-tools"
  | "solution"
  | "capture"
  | "twin"
  | "performance"
  | "editing"
  | "learning"
  | "avatar"
  | "escalation";

export function resolveOpenTabLauncherItemIds({
  developerToolsEnabled,
  hasReviewTab,
  hasSolutionTab,
  hasCaptureTab = false,
  hasTwinTab = false,
  hasPerformanceTab = false,
  hasEditingTab = false,
  hasLearningTab = false,
  hasAvatarTab = false,
  hasEscalationTab = false,
  canOpenSelectionSideConversation = false,
  supportsEmbeddedBrowser = true,
}: {
  developerToolsEnabled: boolean;
  hasReviewTab: boolean;
  /** YOU Solution tab 已开时不再提供入口（幂等聚焦语义）。 */
  hasSolutionTab: boolean;
  /** YOU Capture tab 已开时不再提供入口（W2B，同幂等聚焦语义）。缺省 false。 */
  hasCaptureTab?: boolean;
  /** YOU Twin tab 已开时不再提供入口（W3B，同幂等聚焦语义）。缺省 false。 */
  hasTwinTab?: boolean;
  /** YOU Performance tab 已开时不再提供入口（W4B，同幂等聚焦语义）。缺省 false。 */
  hasPerformanceTab?: boolean;
  /** YOU Editing tab 已开时不再提供入口（W5B，同幂等聚焦语义）。缺省 false。 */
  hasEditingTab?: boolean;
  /** YOU Learning tab 已开时不再提供入口（W6B，同幂等聚焦语义）。缺省 false。 */
  hasLearningTab?: boolean;
  /** YOU Avatar tab 已开时不再提供入口（W7B，同幂等聚焦语义）。缺省 false。 */
  hasAvatarTab?: boolean;
  /** YOU Escalation tab 已开时不再提供入口（W8B，同幂等聚焦语义）。缺省 false。 */
  hasEscalationTab?: boolean;
  canOpenSelectionSideConversation?: boolean;
  supportsEmbeddedBrowser?: boolean;
}): OpenTabLauncherItemId[] {
  const itemIds: OpenTabLauncherItemId[] = [];

  if (canOpenSelectionSideConversation) {
    itemIds.push("selection-side-conversation");
  }

  if (!hasReviewTab) {
    itemIds.push("review");
  }

  itemIds.push("terminal");

  if (supportsEmbeddedBrowser) {
    itemIds.push("browser");
  }

  if (developerToolsEnabled) {
    itemIds.push("developer-tools");
  }

  if (!hasSolutionTab) {
    itemIds.push("solution");
  }

  if (!hasCaptureTab) {
    itemIds.push("capture");
  }

  if (!hasTwinTab) {
    itemIds.push("twin");
  }

  if (!hasPerformanceTab) {
    itemIds.push("performance");
  }

  if (!hasEditingTab) {
    itemIds.push("editing");
  }

  if (!hasLearningTab) {
    itemIds.push("learning");
  }

  if (!hasAvatarTab) {
    itemIds.push("avatar");
  }

  if (!hasEscalationTab) {
    itemIds.push("escalation");
  }

  return itemIds;
}

export function shouldOfferSelectionSideConversation({
  activeTaskId,
}: {
  activeTaskId: string | null;
}): boolean {
  return Boolean(activeTaskId);
}

export function resolveAnimatedSidePanePanelLayout() {
  return {
    collapsedSize: "0px",
    defaultSize: "0px",
    maxSize: "65%",
    minSize: "240px",
    useResizablePanel: true,
  };
}

export function shouldRenderPreviewPaneHeavyContent({
  isActiveTab,
  isMediaPreview = false,
  isResizeSettling = false,
  isSidePaneVisible,
  minVisibleInlineSizePx = MIN_PREVIEW_PANE_HEAVY_CONTENT_VISIBLE_INLINE_SIZE_PX,
  visibleInlineSizePx,
}: {
  isActiveTab: boolean;
  isMediaPreview?: boolean;
  isResizeSettling?: boolean;
  isSidePaneVisible: boolean;
  minVisibleInlineSizePx?: number;
  visibleInlineSizePx: number | null;
}) {
  if (!isSidePaneVisible || !isActiveTab) {
    return false;
  }

  if (isResizeSettling) {
    // 原生 video/audio 进入 HTML fullscreen 时会触发 resize；如果此时卸载
    // 媒体节点，浏览器会因 fullscreen 元素消失而立即退出全屏。
    return isMediaPreview;
  }

  if (visibleInlineSizePx === null) {
    return true;
  }

  return visibleInlineSizePx >= minVisibleInlineSizePx;
}
