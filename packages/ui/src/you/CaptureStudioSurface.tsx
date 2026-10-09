// YOU Capture Studio — Capture 表面根组件（W2B）。
//
// 作为 native side pane tab 内容挂载（AnimatedSidePanePanel 的 capture 分支）。
// 职责：加载/错误/就绪三态、面板切换（Tabs）、把 per-workspace 的 store/controller
// 绑定分发给各面板。所有面板文案经 useCaptureMessages；处处标注 deterministic simulated。
// 键盘/焦点/关闭/重开与 Solution 表面同级（shell 拥有 tab 生命周期；本表面持有
// 面板内键盘导航，见 CaptureSessionPanel）。
import { memo } from "react";
import { CameraIcon, FlaskConicalIcon } from "lucide-react";
import type { CaptureStudioSidePaneTab } from "@/lib/workspaceSidePane.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Spinner } from "@/components/ui/spinner.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { useStore } from "zustand";
import { projectOperationalProcessingGate } from "@/you/captureController.js";
import { useCaptureStudioBinding } from "@/you/useCaptureStudio.js";
import { useCaptureMessages } from "@/you/useCaptureMessages.js";
import { CaptureRequestsPanel } from "@/you/CaptureRequestsPanel.js";
import { CaptureSessionPanel } from "@/you/CaptureSessionPanel.js";
import { EvidenceReviewPanel } from "@/you/EvidenceReviewPanel.js";
import { CaptureConsentPanel } from "@/you/CaptureConsentPanel.js";
import { CaptureUploadPanel } from "@/you/CaptureUploadPanel.js";
import { CaptureDemoPanel } from "@/you/CaptureDemoPanel.js";
import type { CapturePanelId } from "@/you/captureStudioStore.js";

const PANEL_IDS: readonly CapturePanelId[] = [
  "requests",
  "capture",
  "review",
  "consent",
  "upload",
  "demo",
];

/**
 * native Capture tab 正文。tab 由既有 side pane 权威管理（dock/reorder/close/reopen
 * 均走既有机制）；本组件只负责表面内容。
 */
export const CaptureStudioSurface = memo(function CaptureStudioSurface({
  tab,
  workspaceKey,
  isActive,
}: {
  tab: CaptureStudioSidePaneTab;
  /** workspaceIdentity?.trim() || workspacePath（Workspace Identity 统一口径）。 */
  workspaceKey: string;
  isActive: boolean;
}) {
  void tab;
  const { formatMessage } = useCaptureMessages();
  const binding = useCaptureStudioBinding(workspaceKey);
  const status = useStore(binding.store, (state) => state.status);
  const errorMessage = useStore(binding.store, (state) => state.errorMessage);
  const actionError = useStore(binding.store, (state) => state.actionError);
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const panel = useStore(binding.store, (state) => state.panel);
  const operationalGate = snapshot ? projectOperationalProcessingGate(snapshot.consent) : null;

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="you-capture-surface"
      data-you-capture-active={isActive ? "true" : "false"}
      data-you-simulated="true"
    >
      <header className="flex shrink-0 flex-col gap-1 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <CameraIcon className="size-4 shrink-0 text-foreground-subtle" />
          <span className="truncate text-ui-base font-medium text-foreground">
            {snapshot?.displayName ?? formatMessage({ id: "you.capture.tabTitle" })}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 text-ui-xs text-foreground-subtle"
            data-testid="you-capture-simulated-badge"
          >
            <FlaskConicalIcon className="size-3" />
            {formatMessage({ id: "you.capture.simulatedBadge" })}
          </Badge>
          {operationalGate ? (
            <Badge
              variant={operationalGate.allowed ? "secondary" : "outline"}
              className={
                operationalGate.allowed
                  ? "text-ui-xs text-success"
                  : "border-warning/40 text-ui-xs text-warning"
              }
              data-testid="you-capture-consent-chip"
              data-you-capture-consent-allowed={operationalGate.allowed ? "true" : "false"}
            >
              {operationalGate.allowed
                ? formatMessage({ id: "you.capture.consent.gateAllowed" })
                : formatMessage({ id: "you.capture.consent.gateBlocked" })}
            </Badge>
          ) : null}
          {snapshot ? (
            <span className="min-w-0 truncate text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.capture.consent.scope" })}:{" "}
              {snapshot.consent.policy.scope}
            </span>
          ) : null}
        </div>
      </header>

      {status === "loading" || status === "idle" ? (
        <div className="flex flex-1 items-center justify-center gap-2 p-6" data-testid="you-capture-loading">
          <Spinner className="size-4" />
          <span className="text-ui-base text-foreground-subtle">
            {formatMessage({ id: "you.capture.loading" })}
          </span>
        </div>
      ) : status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6" data-testid="you-capture-error">
          <p className="text-ui-base text-foreground">{formatMessage({ id: "you.capture.errorTitle" })}</p>
          <p className="max-w-[36rem] text-center font-mono text-ui-sm text-foreground-subtle">
            {errorMessage}
          </p>
          <Button type="button" size="sm" onClick={() => void binding.ensureLoaded()}>
            {formatMessage({ id: "you.capture.retry" })}
          </Button>
        </div>
      ) : (
        <Tabs
          value={panel}
          onValueChange={(value) => binding.store.getState().setPanel(value as CapturePanelId)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-2 mt-2 flex h-auto shrink-0 flex-wrap justify-start gap-0.5 rounded-lg p-0.5">
            {PANEL_IDS.map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                title={formatMessage({ id: `you.capture.panel.${id}` })}
                className="min-w-0 truncate px-1.5 text-ui-xs"
                data-testid={`you-capture-tab-${id}`}
              >
                {formatMessage({ id: `you.capture.panel.${id}` })}
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
                <CapturePanelBody panelId={id} binding={binding} />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}

      {actionError ? (
        <div
          className="flex shrink-0 items-start gap-2 border-t border-warning/40 bg-warning/5 px-3 py-1.5"
          role="alert"
          data-testid="you-capture-action-error"
        >
          <div className="min-w-0 flex-1">
            <p className="text-ui-xs font-medium text-foreground">
              {formatMessage({ id: "you.capture.actionErrorTitle" })}
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
            {formatMessage({ id: "you.capture.actionErrorDismiss" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
});

function CapturePanelBody({
  panelId,
  binding,
}: {
  panelId: CapturePanelId;
  binding: ReturnType<typeof useCaptureStudioBinding>;
}) {
  switch (panelId) {
    case "requests":
      return <CaptureRequestsPanel binding={binding} />;
    case "capture":
      return <CaptureSessionPanel binding={binding} />;
    case "review":
      return <EvidenceReviewPanel binding={binding} />;
    case "consent":
      return <CaptureConsentPanel binding={binding} />;
    case "upload":
      return <CaptureUploadPanel binding={binding} />;
    case "demo":
      return <CaptureDemoPanel binding={binding} />;
  }
}
