// YOU Editing Studio — Editing 表面根组件（W5B）。
//
// 作为 native side pane tab 内容挂载（AnimatedSidePanePanel 的 editing 分支）。
// 职责：加载/错误/就绪三态、面板切换（Tabs）、把 per-workspace 的 store/controller
// 绑定分发给各面板。所有面板文案经 useEditingMessages；处处标注 deterministic
// simulated。操作级 typed 错误（含 YOU_EDIT_SESSION_NOT_FOUND / YOU_CHANGESET_INVALID /
// YOU_EDITOR_UNSUPPORTED / YOU_IMPORT_EXPORT_FAILED）以专属 typed 错误面板呈现
//（code 驱动文案）。
import { memo } from "react";
import { FilePenLineIcon, FlaskConicalIcon, TriangleAlertIcon } from "lucide-react";
import type { EditingStudioSidePaneTab } from "@/lib/workspaceSidePane.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Spinner } from "@/components/ui/spinner.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { cn } from "@/components/lib/utils.js";
import { useStore } from "zustand";
import { useEditingStudioBinding } from "@/you/useEditingStudio.js";
import { useEditingMessages } from "@/you/useEditingMessages.js";
import { EditingSessionsPanel } from "@/you/EditingSessionsPanel.js";
import { EditingChangeSetPanel } from "@/you/EditingChangeSetPanel.js";
import { EditingComparePanel } from "@/you/EditingComparePanel.js";
import { EditingEditorsPanel } from "@/you/EditingEditorsPanel.js";
import { EditingTakeoverPanel } from "@/you/EditingTakeoverPanel.js";
import { EditingDemoPanel } from "@/you/EditingDemoPanel.js";
import type { EditingPanelId } from "@/you/editingStudioStore.js";

const PANEL_IDS: readonly EditingPanelId[] = [
  "sessions",
  "changesets",
  "compare",
  "editors",
  "takeover",
  "demo",
];

/**
 * native Editing tab 正文。tab 由既有 side pane 权威管理（dock/reorder/close/
 * reopen 均走既有机制）；本组件只负责表面内容。
 */
export const EditingStudioSurface = memo(function EditingStudioSurface({
  tab,
  workspaceKey,
  isActive,
}: {
  tab: EditingStudioSidePaneTab;
  /** workspaceIdentity?.trim() || workspacePath（Workspace Identity 统一口径）。 */
  workspaceKey: string;
  isActive: boolean;
}) {
  void tab;
  const { formatMessage } = useEditingMessages();
  const binding = useEditingStudioBinding(workspaceKey);
  const status = useStore(binding.store, (state) => state.status);
  const errorMessage = useStore(binding.store, (state) => state.errorMessage);
  const actionError = useStore(binding.store, (state) => state.actionError);
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const panel = useStore(binding.store, (state) => state.panel);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="you-editing-surface"
      data-you-editing-active={isActive ? "true" : "false"}
      data-you-simulated="true"
    >
      <header className="flex shrink-0 flex-col gap-1 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FilePenLineIcon className="size-4 shrink-0 text-foreground-subtle" />
          <span className="truncate text-ui-base font-medium text-foreground">
            {snapshot?.displayName ?? formatMessage({ id: "you.editing.tabTitle" })}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 text-ui-xs text-foreground-subtle"
            data-testid="you-editing-simulated-badge"
          >
            <FlaskConicalIcon className="size-3" />
            {formatMessage({ id: "you.editing.simulatedBadge" })}
          </Badge>
          {snapshot ? (
            <span className="min-w-0 truncate text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.editing.sessions.count" })}:{" "}
              {snapshot.sessions.length} ·{" "}
              {formatMessage({ id: "you.editing.changesets.count" })}:{" "}
              {snapshot.changeSets.length}
            </span>
          ) : null}
        </div>
      </header>

      {status === "loading" || status === "idle" ? (
        <div className="flex flex-1 items-center justify-center gap-2 p-6" data-testid="you-editing-loading">
          <Spinner className="size-4" />
          <span className="text-ui-base text-foreground-subtle">
            {formatMessage({ id: "you.editing.loading" })}
          </span>
        </div>
      ) : status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6" data-testid="you-editing-error">
          <p className="text-ui-base text-foreground">
            {formatMessage({ id: "you.editing.errorTitle" })}
          </p>
          <p className="max-w-[36rem] text-center font-mono text-ui-sm text-foreground-subtle">
            {errorMessage}
          </p>
          <Button type="button" size="sm" onClick={() => void binding.ensureLoaded()}>
            {formatMessage({ id: "you.editing.retry" })}
          </Button>
        </div>
      ) : (
        <Tabs
          value={panel}
          onValueChange={(value) => binding.store.getState().setPanel(value as EditingPanelId)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-2 mt-2 flex h-auto shrink-0 flex-wrap justify-start gap-0.5 rounded-lg p-0.5">
            {PANEL_IDS.map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                title={formatMessage({ id: `you.editing.panel.${id}` })}
                className="min-w-0 truncate px-1.5 text-ui-xs"
                data-testid={`you-editing-tab-${id}`}
              >
                {formatMessage({ id: `you.editing.panel.${id}` })}
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
                <EditingPanelBody panelId={id} binding={binding} />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}

      {actionError ? (
        <div
          className="flex shrink-0 items-start gap-2 border-t border-destructive/40 bg-destructive/5 px-3 py-1.5"
          role="alert"
          data-testid="you-editing-action-error"
          data-you-editing-error-code={actionError.code}
        >
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <Badge
                variant="outline"
                className="border-destructive/40 font-mono text-ui-xs text-destructive"
                data-testid="you-editing-action-error-code"
              >
                {actionError.code}
              </Badge>
              <span className="text-ui-xs font-medium text-foreground">
                {formatMessage({ id: "you.editing.error.caption" })}
              </span>
            </div>
            <p className="break-all font-mono text-ui-xs text-foreground-subtle">
              {actionError.message}
            </p>
            {/* typed 错误专属解释（code 驱动；四个验收 code 各有专属文案）。 */}
            <p
              className="mt-0.5 text-ui-xs text-foreground-subtle"
              data-testid="you-editing-action-error-explanation"
            >
              {formatMessage({ id: `you.editing.error.${actionError.code}` }) !==
              `you.editing.error.${actionError.code}`
                ? formatMessage({ id: `you.editing.error.${actionError.code}` })
                : formatMessage({ id: "you.editing.error.UNEXPECTED" })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-5 shrink-0 px-1.5 text-ui-xs")}
            onClick={() => binding.store.getState().clearActionError()}
          >
            {formatMessage({ id: "you.editing.actionErrorDismiss" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
});

function EditingPanelBody({
  panelId,
  binding,
}: {
  panelId: EditingPanelId;
  binding: ReturnType<typeof useEditingStudioBinding>;
}) {
  switch (panelId) {
    case "sessions":
      return <EditingSessionsPanel binding={binding} />;
    case "changesets":
      return <EditingChangeSetPanel binding={binding} />;
    case "compare":
      return <EditingComparePanel binding={binding} />;
    case "editors":
      return <EditingEditorsPanel binding={binding} />;
    case "takeover":
      return <EditingTakeoverPanel binding={binding} />;
    case "demo":
      return <EditingDemoPanel binding={binding} />;
  }
}
