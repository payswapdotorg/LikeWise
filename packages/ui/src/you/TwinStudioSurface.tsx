// YOU Twin Studio — Twin 表面根组件（W3B）。
//
// 作为 native side pane tab 内容挂载（AnimatedSidePanePanel 的 twin 分支）。
// 职责：加载/错误/就绪三态、面板切换（Tabs）、把 per-workspace 的 store/controller
// 绑定分发给各面板。所有面板文案经 useTwinMessages；处处标注 deterministic simulated。
// 键盘/焦点/关闭/重开与 Solution/Capture 表面同级（shell 拥有 tab 生命周期；本表面
// 持有面板内键盘导航，见 TwinVersionsPanel）。改进流程经 onOpenCaptureStudio
// 回调链入既有 Capture 表面（无 UI-only 变更路径）。
import { memo } from "react";
import { FlaskConicalIcon, ScanFaceIcon } from "lucide-react";
import type { TwinStudioSidePaneTab } from "@/lib/workspaceSidePane.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Spinner } from "@/components/ui/spinner.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { useStore } from "zustand";
import { projectTwinBindingGate } from "@/you/twinController.js";
import { useTwinStudioBinding } from "@/you/useTwinStudio.js";
import { useTwinMessages } from "@/you/useTwinMessages.js";
import { TwinVersionsPanel } from "@/you/TwinVersionsPanel.js";
import { TwinQualityPanel } from "@/you/TwinQualityPanel.js";
import { TwinComparePanel } from "@/you/TwinComparePanel.js";
import { TwinRemediationPanel } from "@/you/TwinRemediationPanel.js";
import { TwinReconstructionPanel } from "@/you/TwinReconstructionPanel.js";
import { TwinDemoPanel } from "@/you/TwinDemoPanel.js";
import type { TwinPanelId } from "@/you/twinStudioStore.js";

const PANEL_IDS: readonly TwinPanelId[] = [
  "versions",
  "quality",
  "compare",
  "remediation",
  "reconstruction",
  "demo",
];

/**
 * native Twin tab 正文。tab 由既有 side pane 权威管理（dock/reorder/close/reopen
 * 均走既有机制）；本组件只负责表面内容。
 */
export const TwinStudioSurface = memo(function TwinStudioSurface({
  tab,
  workspaceKey,
  isActive,
  onOpenCaptureStudio,
}: {
  tab: TwinStudioSidePaneTab;
  /** workspaceIdentity?.trim() || workspacePath（Workspace Identity 统一口径）。 */
  workspaceKey: string;
  isActive: boolean;
  /** 改进流程链入 Capture 表面（由 app shell 传入既有 handler）。 */
  onOpenCaptureStudio?: () => void;
}) {
  void tab;
  const { formatMessage } = useTwinMessages();
  const binding = useTwinStudioBinding(workspaceKey);
  const status = useStore(binding.store, (state) => state.status);
  const errorMessage = useStore(binding.store, (state) => state.errorMessage);
  const actionError = useStore(binding.store, (state) => state.actionError);
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const panel = useStore(binding.store, (state) => state.panel);
  const bindingGate = snapshot ? projectTwinBindingGate(snapshot.consent) : null;

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="you-twin-surface"
      data-you-twin-active={isActive ? "true" : "false"}
      data-you-simulated="true"
    >
      <header className="flex shrink-0 flex-col gap-1 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <ScanFaceIcon className="size-4 shrink-0 text-foreground-subtle" />
          <span className="truncate text-ui-base font-medium text-foreground">
            {snapshot?.displayName ?? formatMessage({ id: "you.twin.tabTitle" })}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 text-ui-xs text-foreground-subtle"
            data-testid="you-twin-simulated-badge"
          >
            <FlaskConicalIcon className="size-3" />
            {formatMessage({ id: "you.twin.simulatedBadge" })}
          </Badge>
          {bindingGate ? (
            <Badge
              variant={bindingGate.allowed ? "secondary" : "outline"}
              className={
                bindingGate.allowed
                  ? "text-ui-xs text-success"
                  : "border-warning/40 text-ui-xs text-warning"
              }
              data-testid="you-twin-consent-chip"
              data-you-twin-consent-allowed={bindingGate.allowed ? "true" : "false"}
            >
              {bindingGate.allowed
                ? formatMessage({ id: "you.twin.remediation.gateAllowed" })
                : formatMessage({ id: "you.twin.remediation.gateBlocked" })}
            </Badge>
          ) : null}
          {snapshot ? (
            <span className="min-w-0 truncate text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.twin.versions.lineage" })}: v
              {snapshot.versions.length}
            </span>
          ) : null}
        </div>
      </header>

      {status === "loading" || status === "idle" ? (
        <div className="flex flex-1 items-center justify-center gap-2 p-6" data-testid="you-twin-loading">
          <Spinner className="size-4" />
          <span className="text-ui-base text-foreground-subtle">
            {formatMessage({ id: "you.twin.loading" })}
          </span>
        </div>
      ) : status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6" data-testid="you-twin-error">
          <p className="text-ui-base text-foreground">{formatMessage({ id: "you.twin.errorTitle" })}</p>
          <p className="max-w-[36rem] text-center font-mono text-ui-sm text-foreground-subtle">
            {errorMessage}
          </p>
          <Button type="button" size="sm" onClick={() => void binding.ensureLoaded()}>
            {formatMessage({ id: "you.twin.retry" })}
          </Button>
        </div>
      ) : (
        <Tabs
          value={panel}
          onValueChange={(value) => binding.store.getState().setPanel(value as TwinPanelId)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-2 mt-2 flex h-auto shrink-0 flex-wrap justify-start gap-0.5 rounded-lg p-0.5">
            {PANEL_IDS.map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                title={formatMessage({ id: `you.twin.panel.${id}` })}
                className="min-w-0 truncate px-1.5 text-ui-xs"
                data-testid={`you-twin-tab-${id}`}
              >
                {formatMessage({ id: `you.twin.panel.${id}` })}
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
                <TwinPanelBody panelId={id} binding={binding} onOpenCaptureStudio={onOpenCaptureStudio} />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}

      {actionError ? (
        <div
          className="flex shrink-0 items-start gap-2 border-t border-warning/40 bg-warning/5 px-3 py-1.5"
          role="alert"
          data-testid="you-twin-action-error"
        >
          <div className="min-w-0 flex-1">
            <p className="text-ui-xs font-medium text-foreground">
              {formatMessage({ id: "you.twin.actionErrorTitle" })}
            </p>
            <p className="break-all font-mono text-ui-xs text-foreground-subtle">{actionError}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 shrink-0 px-1.5 text-ui-xs"
            onClick={() => binding.store.getState().clearActionError()}
          >
            {formatMessage({ id: "you.twin.actionErrorDismiss" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
});

function TwinPanelBody({
  panelId,
  binding,
  onOpenCaptureStudio,
}: {
  panelId: TwinPanelId;
  binding: ReturnType<typeof useTwinStudioBinding>;
  onOpenCaptureStudio?: () => void;
}) {
  switch (panelId) {
    case "versions":
      return <TwinVersionsPanel binding={binding} />;
    case "quality":
      return <TwinQualityPanel binding={binding} />;
    case "compare":
      return <TwinComparePanel binding={binding} />;
    case "remediation":
      return <TwinRemediationPanel binding={binding} onOpenCaptureStudio={onOpenCaptureStudio} />;
    case "reconstruction":
      return <TwinReconstructionPanel binding={binding} />;
    case "demo":
      return <TwinDemoPanel binding={binding} />;
  }
}
