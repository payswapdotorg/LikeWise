// YOU Performance Studio — Performance 表面根组件（W4B）。
//
// 作为 native side pane tab 内容挂载（AnimatedSidePanePanel 的 performance 分支）。
// 职责：加载/错误/就绪三态、面板切换（Tabs）、把 per-workspace 的 store/controller
// 绑定分发给各面板。所有面板文案经 usePerformanceMessages；处处标注 deterministic
// simulated。操作级 typed 错误（含 YOU_TIMELINE_INVALID / YOU_RENDER_UNSUPPORTED /
// YOU_RENDER_ARTIFACT_NOT_FOUND）以专属 typed 错误面板呈现（code 驱动文案）。
import { memo } from "react";
import { ClapperboardIcon, FlaskConicalIcon, TriangleAlertIcon } from "lucide-react";
import type { PerformanceStudioSidePaneTab } from "@/lib/workspaceSidePane.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Spinner } from "@/components/ui/spinner.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { cn } from "@/components/lib/utils.js";
import { useStore } from "zustand";
import { usePerformanceStudioBinding } from "@/you/usePerformanceStudio.js";
import { usePerformanceMessages } from "@/you/usePerformanceMessages.js";
import { PerformanceTimelinePanel } from "@/you/PerformanceTimelinePanel.js";
import { PerformanceTemplatesPanel } from "@/you/PerformanceTemplatesPanel.js";
import { RenderJobsPanel } from "@/you/RenderJobsPanel.js";
import { ArtifactReviewPanel } from "@/you/ArtifactReviewPanel.js";
import { PerformanceDemoPanel } from "@/you/PerformanceDemoPanel.js";
import type { PerformancePanelId } from "@/you/performanceStudioStore.js";

const PANEL_IDS: readonly PerformancePanelId[] = [
  "timeline",
  "templates",
  "jobs",
  "review",
  "demo",
];

/**
 * native Performance tab 正文。tab 由既有 side pane 权威管理（dock/reorder/close/
 * reopen 均走既有机制）；本组件只负责表面内容。
 */
export const PerformanceStudioSurface = memo(function PerformanceStudioSurface({
  tab,
  workspaceKey,
  isActive,
}: {
  tab: PerformanceStudioSidePaneTab;
  /** workspaceIdentity?.trim() || workspacePath（Workspace Identity 统一口径）。 */
  workspaceKey: string;
  isActive: boolean;
}) {
  void tab;
  const { formatMessage } = usePerformanceMessages();
  const binding = usePerformanceStudioBinding(workspaceKey);
  const status = useStore(binding.store, (state) => state.status);
  const errorMessage = useStore(binding.store, (state) => state.errorMessage);
  const actionError = useStore(binding.store, (state) => state.actionError);
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const panel = useStore(binding.store, (state) => state.panel);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="you-performance-surface"
      data-you-performance-active={isActive ? "true" : "false"}
      data-you-simulated="true"
    >
      <header className="flex shrink-0 flex-col gap-1 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <ClapperboardIcon className="size-4 shrink-0 text-foreground-subtle" />
          <span className="truncate text-ui-base font-medium text-foreground">
            {snapshot?.displayName ?? formatMessage({ id: "you.performance.tabTitle" })}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 text-ui-xs text-foreground-subtle"
            data-testid="you-performance-simulated-badge"
          >
            <FlaskConicalIcon className="size-3" />
            {formatMessage({ id: "you.performance.simulatedBadge" })}
          </Badge>
          {snapshot ? (
            <span className="min-w-0 truncate text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.performance.timeline.count" })}:{" "}
              {snapshot.performances.length} · {formatMessage({ id: "you.performance.jobs.title" })}
              : {snapshot.jobs.length}
            </span>
          ) : null}
        </div>
      </header>

      {status === "loading" || status === "idle" ? (
        <div className="flex flex-1 items-center justify-center gap-2 p-6" data-testid="you-performance-loading">
          <Spinner className="size-4" />
          <span className="text-ui-base text-foreground-subtle">
            {formatMessage({ id: "you.performance.loading" })}
          </span>
        </div>
      ) : status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6" data-testid="you-performance-error">
          <p className="text-ui-base text-foreground">
            {formatMessage({ id: "you.performance.errorTitle" })}
          </p>
          <p className="max-w-[36rem] text-center font-mono text-ui-sm text-foreground-subtle">
            {errorMessage}
          </p>
          <Button type="button" size="sm" onClick={() => void binding.ensureLoaded()}>
            {formatMessage({ id: "you.performance.retry" })}
          </Button>
        </div>
      ) : (
        <Tabs
          value={panel}
          onValueChange={(value) => binding.store.getState().setPanel(value as PerformancePanelId)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-2 mt-2 flex h-auto shrink-0 flex-wrap justify-start gap-0.5 rounded-lg p-0.5">
            {PANEL_IDS.map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                title={formatMessage({ id: `you.performance.panel.${id}` })}
                className="min-w-0 truncate px-1.5 text-ui-xs"
                data-testid={`you-performance-tab-${id}`}
              >
                {formatMessage({ id: `you.performance.panel.${id}` })}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="relative min-h-0 flex-1">
            {PANEL_IDS.map((id) => (
              <TabsContent
                key={id}
                value={id}
                forceMount
                className="h-full min-h-0 data-[state=inactive]:hidden"
              >
                <PerformancePanelBody panelId={id} binding={binding} />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}

      {actionError ? (
        <div
          className="flex shrink-0 items-start gap-2 border-t border-destructive/40 bg-destructive/5 px-3 py-1.5"
          role="alert"
          data-testid="you-performance-action-error"
          data-you-performance-error-code={actionError.code}
        >
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <Badge
                variant="outline"
                className="border-destructive/40 font-mono text-ui-xs text-destructive"
                data-testid="you-performance-action-error-code"
              >
                {actionError.code}
              </Badge>
              <span className="text-ui-xs font-medium text-foreground">
                {formatMessage({ id: "you.performance.error.caption" })}
              </span>
            </div>
            <p className="break-all font-mono text-ui-xs text-foreground-subtle">
              {actionError.message}
            </p>
            {/* typed 错误专属解释（code 驱动；三个验收 code 各有专属文案）。 */}
            <p
              className="mt-0.5 text-ui-xs text-foreground-subtle"
              data-testid="you-performance-action-error-explanation"
            >
              {formatMessage({ id: `you.performance.error.${actionError.code}` }) !==
              `you.performance.error.${actionError.code}`
                ? formatMessage({ id: `you.performance.error.${actionError.code}` })
                : formatMessage({ id: "you.performance.error.UNEXPECTED" })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-5 shrink-0 px-1.5 text-ui-xs")}
            onClick={() => binding.store.getState().clearActionError()}
          >
            {formatMessage({ id: "you.performance.actionErrorDismiss" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
});

function PerformancePanelBody({
  panelId,
  binding,
}: {
  panelId: PerformancePanelId;
  binding: ReturnType<typeof usePerformanceStudioBinding>;
}) {
  switch (panelId) {
    case "timeline":
      return <PerformanceTimelinePanel binding={binding} />;
    case "templates":
      return <PerformanceTemplatesPanel binding={binding} />;
    case "jobs":
      return <RenderJobsPanel binding={binding} />;
    case "review":
      return <ArtifactReviewPanel binding={binding} />;
    case "demo":
      return <PerformanceDemoPanel binding={binding} />;
  }
}
