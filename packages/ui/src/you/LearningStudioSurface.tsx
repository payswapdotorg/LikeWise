// YOU Learning Studio — Learning 表面根组件（W6B）。
//
// 作为 native side pane tab 内容挂载（AnimatedSidePanePanel 的 learning 分支）。
// 职责：加载/错误/就绪三态、面板切换（Tabs）、把 per-workspace 的 store/controller
// 绑定分发给各面板。所有面板文案经 useLearningMessages；处处标注 deterministic
// simulated。操作级 typed 错误（含 YOU_LEARNING_SIGNAL_INVALID /
// YOU_LEARNING_RECORD_NOT_FOUND / YOU_LEARNING_RIGHTS_REQUIRED /
// YOU_PREFERENCE_SCOPE_INVALID）以专属 typed 错误面板呈现（code 驱动文案）。
import { memo } from "react";
import { FlaskConicalIcon, GraduationCapIcon, TriangleAlertIcon } from "lucide-react";
import type { LearningStudioSidePaneTab } from "@/lib/workspaceSidePane.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Spinner } from "@/components/ui/spinner.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { cn } from "@/components/lib/utils.js";
import { useStore } from "zustand";
import { useLearningStudioBinding } from "@/you/useLearningStudio.js";
import { useLearningMessages } from "@/you/useLearningMessages.js";
import { LearningSignalsPanel } from "@/you/LearningSignalsPanel.js";
import { LearningLedgerPanel } from "@/you/LearningLedgerPanel.js";
import { LearningRightsPanel } from "@/you/LearningRightsPanel.js";
import { LearningPreferencesPanel } from "@/you/LearningPreferencesPanel.js";
import { LearningReplayPanel } from "@/you/LearningReplayPanel.js";
import { LearningDemoPanel } from "@/you/LearningDemoPanel.js";
import type { LearningPanelId } from "@/you/learningStudioStore.js";

const PANEL_IDS: readonly LearningPanelId[] = [
  "signals",
  "ledger",
  "rights",
  "preferences",
  "replay",
  "demo",
];

/**
 * native Learning tab 正文。tab 由既有 side pane 权威管理（dock/reorder/close/
 * reopen 均走既有机制）；本组件只负责表面内容。
 */
export const LearningStudioSurface = memo(function LearningStudioSurface({
  tab,
  workspaceKey,
  isActive,
}: {
  tab: LearningStudioSidePaneTab;
  /** workspaceIdentity?.trim() || workspacePath（Workspace Identity 统一口径）。 */
  workspaceKey: string;
  isActive: boolean;
}) {
  void tab;
  const { formatMessage } = useLearningMessages();
  const binding = useLearningStudioBinding(workspaceKey);
  const status = useStore(binding.store, (state) => state.status);
  const errorMessage = useStore(binding.store, (state) => state.errorMessage);
  const actionError = useStore(binding.store, (state) => state.actionError);
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const panel = useStore(binding.store, (state) => state.panel);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="you-learning-surface"
      data-you-learning-active={isActive ? "true" : "false"}
      data-you-simulated="true"
    >
      <header className="flex shrink-0 flex-col gap-1 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <GraduationCapIcon className="size-4 shrink-0 text-foreground-subtle" />
          <span className="truncate text-ui-base font-medium text-foreground">
            {snapshot?.displayName ?? formatMessage({ id: "you.learning.tabTitle" })}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 text-ui-xs text-foreground-subtle"
            data-testid="you-learning-simulated-badge"
          >
            <FlaskConicalIcon className="size-3" />
            {formatMessage({ id: "you.learning.simulatedBadge" })}
          </Badge>
          {snapshot ? (
            <span className="min-w-0 truncate text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.learning.signals.count" })}:{" "}
              {snapshot.signals.length} ·{" "}
              {formatMessage({ id: "you.learning.ledger.count" })}:{" "}
              {snapshot.records.length}
            </span>
          ) : null}
        </div>
      </header>

      {status === "loading" || status === "idle" ? (
        <div className="flex flex-1 items-center justify-center gap-2 p-6" data-testid="you-learning-loading">
          <Spinner className="size-4" />
          <span className="text-ui-base text-foreground-subtle">
            {formatMessage({ id: "you.learning.loading" })}
          </span>
        </div>
      ) : status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6" data-testid="you-learning-error">
          <p className="text-ui-base text-foreground">
            {formatMessage({ id: "you.learning.errorTitle" })}
          </p>
          <p className="max-w-[36rem] text-center font-mono text-ui-sm text-foreground-subtle">
            {errorMessage}
          </p>
          <Button type="button" size="sm" onClick={() => void binding.ensureLoaded()}>
            {formatMessage({ id: "you.learning.retry" })}
          </Button>
        </div>
      ) : (
        <Tabs
          value={panel}
          onValueChange={(value) => binding.store.getState().setPanel(value as LearningPanelId)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-2 mt-2 flex h-auto shrink-0 flex-wrap justify-start gap-0.5 rounded-lg p-0.5">
            {PANEL_IDS.map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                title={formatMessage({ id: `you.learning.panel.${id}` })}
                className="min-w-0 truncate px-1.5 text-ui-xs"
                data-testid={`you-learning-tab-${id}`}
              >
                {formatMessage({ id: `you.learning.panel.${id}` })}
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
                <LearningPanelBody panelId={id} binding={binding} />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}

      {actionError ? (
        <div
          className="flex shrink-0 items-start gap-2 border-t border-destructive/40 bg-destructive/5 px-3 py-1.5"
          role="alert"
          data-testid="you-learning-action-error"
          data-you-learning-error-code={actionError.code}
        >
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <Badge
                variant="outline"
                className="border-destructive/40 font-mono text-ui-xs text-destructive"
                data-testid="you-learning-action-error-code"
              >
                {actionError.code}
              </Badge>
              <span className="text-ui-xs font-medium text-foreground">
                {formatMessage({ id: "you.learning.error.caption" })}
              </span>
            </div>
            <p className="break-all font-mono text-ui-xs text-foreground-subtle">
              {actionError.message}
            </p>
            {/* typed 错误专属解释（code 驱动；四个验收 code 各有专属文案）。 */}
            <p
              className="mt-0.5 text-ui-xs text-foreground-subtle"
              data-testid="you-learning-action-error-explanation"
            >
              {formatMessage({ id: `you.learning.error.${actionError.code}` }) !==
              `you.learning.error.${actionError.code}`
                ? formatMessage({ id: `you.learning.error.${actionError.code}` })
                : formatMessage({ id: "you.learning.error.UNEXPECTED" })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-5 shrink-0 px-1.5 text-ui-xs")}
            onClick={() => binding.store.getState().clearActionError()}
          >
            {formatMessage({ id: "you.learning.actionErrorDismiss" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
});

function LearningPanelBody({
  panelId,
  binding,
}: {
  panelId: LearningPanelId;
  binding: ReturnType<typeof useLearningStudioBinding>;
}) {
  switch (panelId) {
    case "signals":
      return <LearningSignalsPanel binding={binding} />;
    case "ledger":
      return <LearningLedgerPanel binding={binding} />;
    case "rights":
      return <LearningRightsPanel binding={binding} />;
    case "preferences":
      return <LearningPreferencesPanel binding={binding} />;
    case "replay":
      return <LearningReplayPanel binding={binding} />;
    case "demo":
      return <LearningDemoPanel binding={binding} />;
  }
}
