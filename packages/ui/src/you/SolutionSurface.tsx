// YOU Solution Studio — Solution 表面根组件（W1B）。
//
// 作为 native side pane tab 内容挂载（AnimatedSidePanePanel 的 solution 分支）。
// 职责：加载/错误/就绪三态、面板切换（Tabs）、把 per-workspace 的 store/controller
// 绑定分发给各面板。所有面板文案经 useYouMessages；处处标注 deterministic simulated。
import { memo } from "react";
import { FlaskConicalIcon } from "lucide-react";
import type { SolutionSidePaneTab } from "@/lib/workspaceSidePane.js";
import { cn } from "@/components/lib/utils.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Spinner } from "@/components/ui/spinner.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { useStore } from "zustand";
import { currentSolutionVersion } from "@/you/solutionController.js";
import { useSolutionSurfaceBinding } from "@/you/useSolutionSurface.js";
import { useYouMessages } from "@/you/youMessages.js";
import { SolutionViewportPanel } from "@/you/SolutionViewport.js";
import { SolutionInspectorPanel } from "@/you/SolutionInspector.js";
import { SolutionFeedbackPanel } from "@/you/SolutionFeedback.js";
import { SolutionComparePanel } from "@/you/SolutionCompare.js";
import { SolutionExportPanel } from "@/you/SolutionExport.js";
import { SolutionTakeoverPanel } from "@/you/SolutionTakeover.js";
import { SolutionDemoPanel } from "@/you/SolutionDemoPanel.js";
import type { SolutionPanelId } from "@/you/solutionStore.js";

const PANEL_IDS: readonly SolutionPanelId[] = [
  "viewport",
  "inspector",
  "feedback",
  "compare",
  "export",
  "takeover",
  "demo",
];

/**
 * native Solution tab 正文。tab 由既有 side pane 权威管理（dock/reorder/close/reopen
 * 均走既有机制）；本组件只负责表面内容。
 */
export const SolutionSurface = memo(function SolutionSurface({
  tab,
  workspaceKey,
  isActive,
}: {
  tab: SolutionSidePaneTab;
  /** workspaceIdentity?.trim() || workspacePath（Workspace Identity 统一口径）。 */
  workspaceKey: string;
  isActive: boolean;
}) {
  void tab;
  const { formatMessage } = useYouMessages();
  const binding = useSolutionSurfaceBinding(workspaceKey);
  const status = useStore(binding.store, (state) => state.status);
  const errorMessage = useStore(binding.store, (state) => state.errorMessage);
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const panel = useStore(binding.store, (state) => state.panel);
  const currentVersion = snapshot ? currentSolutionVersion(snapshot) : null;

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="you-solution-surface"
      data-you-solution-active={isActive ? "true" : "false"}
      data-you-simulated="true"
    >
      <header className="flex shrink-0 flex-col gap-1 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-ui-base font-medium text-foreground">
            {snapshot?.identity.displayName ?? formatMessage({ id: "you.solution.tabTitle" })}
          </span>
          {currentVersion ? (
            <Badge variant="secondary" className="shrink-0 font-mono text-ui-xs">
              {formatMessage({ id: "you.solution.version" }, { version: currentVersion.version })}
            </Badge>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 text-ui-xs text-foreground-subtle"
            data-testid="you-solution-simulated-badge"
          >
            <FlaskConicalIcon className="size-3" />
            {formatMessage({ id: "you.solution.simulatedBadge" })}
          </Badge>
          {snapshot ? (
            <span className="min-w-0 truncate text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.solution.intent" })}: {snapshot.intentSummary}
            </span>
          ) : null}
        </div>
      </header>

      {status === "loading" || status === "idle" ? (
        <div className="flex flex-1 items-center justify-center gap-2 p-6" data-testid="you-solution-loading">
          <Spinner className="size-4" />
          <span className="text-ui-base text-foreground-subtle">
            {formatMessage({ id: "you.solution.loading" })}
          </span>
        </div>
      ) : status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6" data-testid="you-solution-error">
          <p className="text-ui-base text-foreground">{formatMessage({ id: "you.solution.errorTitle" })}</p>
          <p className="max-w-[36rem] text-center font-mono text-ui-sm text-foreground-subtle">
            {errorMessage}
          </p>
          <Button type="button" size="sm" onClick={() => void binding.ensureLoaded()}>
            {formatMessage({ id: "you.solution.retry" })}
          </Button>
        </div>
      ) : (
        <Tabs
          value={panel}
          onValueChange={(value) => binding.store.getState().setPanel(value as SolutionPanelId)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-2 mt-2 flex h-auto shrink-0 flex-wrap justify-start gap-0.5 rounded-lg p-0.5">
            {PANEL_IDS.map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                title={formatMessage({ id: `you.solution.panel.${id}` })}
                className="min-w-0 truncate px-1.5 text-ui-xs"
                data-testid={`you-solution-tab-${id}`}
              >
                {formatMessage({ id: `you.solution.panel.${id}` })}
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
                <SolutionPanelBody panelId={id} binding={binding} />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}
    </div>
  );
});

function SolutionPanelBody({
  panelId,
  binding,
  className,
}: {
  panelId: SolutionPanelId;
  binding: ReturnType<typeof useSolutionSurfaceBinding>;
  className?: string;
}) {
  const body = (() => {
    switch (panelId) {
      case "viewport":
        return <SolutionViewportPanel binding={binding} />;
      case "inspector":
        return <SolutionInspectorPanel binding={binding} />;
      case "feedback":
        return <SolutionFeedbackPanel binding={binding} />;
      case "compare":
        return <SolutionComparePanel binding={binding} />;
      case "export":
        return <SolutionExportPanel binding={binding} />;
      case "takeover":
        return <SolutionTakeoverPanel binding={binding} />;
      case "demo":
        return <SolutionDemoPanel binding={binding} />;
    }
  })();
  return <div className={cn("h-full min-h-0", className)}>{body}</div>;
}
