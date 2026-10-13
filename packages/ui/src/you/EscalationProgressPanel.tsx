// YOU Escalation Studio — 升级进度面板（W8B）。
//
// 验收要求：progress surface——escalation 状态阶梯（requested -> authorized ->
// in-progress -> delivered -> applied | rejected | cancelled）由投影事件渲染
//（current 来自服务端投影头；visited 由事件流派生——绝非 UI 本地状态）+ run 阶梯
//（append-only 尝试）+ 生命周期动作（启动 run / 使 run 失败 / 调用 provider / 取消
//——全部经 controller 端口的投射意图；授权门在服务端独立强制）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEscalationMessages } from "@/you/useEscalationMessages.js";
import type { UseEscalationStudioBinding } from "@/you/useEscalationStudio.js";
import {
  escalationById,
  escalationGapById,
  orderedEscalations,
  runsOfGap,
} from "@/you/escalationController.js";
import {
  clampEscalationIndex,
  projectArenaRunRows,
  projectEscalationLadder,
  projectListRegionView,
  resolveEscalationKeyboardTransition,
  ladderVisitedCount,
} from "@/you/escalationStudioProjection.js";
import { ESCALATION_STORYBOARD_PROVIDERS } from "@/you/escalationStoryboard.js";

export function EscalationProgressPanel({ binding }: { binding: UseEscalationStudioBinding }) {
  const { formatMessage } = useEscalationMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedEscalationId = useStore(binding.store, (state) => state.selectedEscalationId);
  const escalationIndex = useStore(binding.store, (state) => state.escalationIndex);
  const [busy, setBusy] = useState(false);
  const [providerId, setProviderId] = useState<string>(
    ESCALATION_STORYBOARD_PROVIDERS[0]?.id ?? "",
  );

  const escalations = useMemo(() => orderedEscalations(snapshot), [snapshot]);
  const inspected = useMemo(
    () =>
      escalationById(snapshot, selectedEscalationId) ??
      escalations.at(-1) ??
      null,
    [snapshot, escalations, selectedEscalationId],
  );
  const ladder = useMemo(
    () =>
      inspected
        ? projectEscalationLadder(inspected, snapshot?.events ?? [], inspected.escalationId)
        : [],
    [inspected, snapshot],
  );
  const gap = useMemo(
    () => (inspected ? escalationGapById(snapshot, inspected.gapId) : null),
    [snapshot, inspected],
  );
  const runRows = useMemo(
    () => projectArenaRunRows(inspected ? runsOfGap(snapshot, inspected.gapId) : []),
    [snapshot, inspected],
  );
  const activeRun = useMemo(
    () => runRows.find((row) => row.status === "started") ?? null,
    [runRows],
  );
  const escalationRegion = projectListRegionView(snapshot !== null, escalations.length);

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!inspected) return;
    const action = resolveEscalationKeyboardTransition(event.key, {
      totalEscalations: escalations.length,
    });
    if (action.kind === "move") {
      event.preventDefault();
      binding.store.getState().moveEscalationIndex(action.delta);
    } else if (action.kind === "select") {
      event.preventDefault();
      binding.store.getState().selectEscalation(inspected.escalationId);
    }
  };

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-escalation-progress"
      tabIndex={0}
      onKeyDown={onListKeyDown}
    >
      <section aria-label={formatMessage({ id: "you.escalation.progress.title" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.escalation.progress.title" })}
        </h3>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.escalation.progress.caption" })}
        </p>
        <p className="mt-1 font-mono text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.escalation.gaps.keyboardHint" })}
        </p>
      </section>

      {escalationRegion === "empty" ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-escalation-progress-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.escalation.progress.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.escalation.progress.emptyHint" })}
          </p>
        </div>
      ) : (
        <section>
          <div className="flex flex-wrap items-center gap-1" data-testid="you-escalation-list">
            {escalations.map((escalation, index) => {
              const selected = escalation.escalationId === inspected?.escalationId;
              return (
                <Button
                  key={escalation.escalationId}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 font-mono text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                    index === escalationIndex && !selected && "ring-1 ring-brand/30",
                  )}
                  data-testid="you-escalation-list-item"
                  data-you-escalation-id={escalation.escalationId}
                  data-you-escalation-status={escalation.status}
                  aria-pressed={selected}
                  onClick={() => binding.store.getState().selectEscalation(escalation.escalationId)}
                >
                  {escalation.escalationId} ·{" "}
                  {formatMessage({ id: `you.escalation.progress.status.${escalation.status}` })}
                </Button>
              );
            })}
          </div>
        </section>
      )}

      {inspected ? (
        <>
          <section aria-label={formatMessage({ id: "you.escalation.progress.ladder.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.escalation.progress.ladder.title" })}{" "}
              <span className="font-mono text-foreground-subtle">
                {inspected.escalationId} ({ladderVisitedCount(ladder)}/{ladder.length})
              </span>
            </h4>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.progress.ladder.terminalHint" })}
            </p>
            <ol className="mt-2 flex flex-wrap gap-1.5" data-testid="you-escalation-ladder">
              {ladder.map((step) => (
                <li
                  key={step.status}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-ui-xs",
                    step.current
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : step.reached
                        ? "border-success/30 bg-success/5 text-foreground-subtle"
                        : "border-border bg-surface text-foreground-subtlest",
                  )}
                  data-testid="you-escalation-ladder-step"
                  data-you-escalation-ladder-status={step.status}
                  data-you-escalation-ladder-current={step.current ? "true" : "false"}
                  data-you-escalation-ladder-reached={step.reached ? "true" : "false"}
                  data-you-escalation-ladder-terminal={step.terminal ? "true" : "false"}
                  data-you-escalation-ladder-at={step.at ?? ""}
                  title={step.at ?? undefined}
                >
                  <span className="sr-only">
                    {step.current
                      ? `${step.status} (current)`
                      : step.reached
                        ? `${step.status} (reached${step.at ? ` at ${step.at}` : ""})`
                        : `${step.status} (not reached)`}
                  </span>
                  {formatMessage({ id: `you.escalation.progress.status.${step.status}` })}
                  {step.terminal ? (
                    <span aria-hidden="true" className="text-foreground-subtlest">
                      ▪
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="mt-1 font-mono text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.progress.minimumContext" })}:{" "}
              {inspected.minimumContext.join(", ")}
            </p>
            {inspected.rejectionReason !== null ? (
              <p className="mt-1 font-mono text-ui-xs text-warning" data-testid="you-escalation-rejection-reason">
                {formatMessage({ id: "you.escalation.progress.rejectionReason" })}:{" "}
                {inspected.rejectionReason}
              </p>
            ) : null}
            {gap ? (
              <p className="mt-1 font-mono text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.escalation.gate.escalation" })}: {inspected.escalationId}{" "}
                · {formatMessage({ id: "you.escalation.gaps.row.escalation" })}: {gap.id} (
                {gap.category})
              </p>
            ) : null}
          </section>

          <section aria-label={formatMessage({ id: "you.escalation.progress.actions.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.escalation.progress.actions.title" })}
            </h4>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                data-testid="you-escalation-start-run"
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.startArenaRun({
                      escalationId: inspected.escalationId,
                    }),
                  )
                }
              >
                {formatMessage({ id: "you.escalation.progress.actions.startRun" })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || activeRun === null}
                title={activeRun === null ? formatMessage({ id: "you.escalation.progress.actions.failRunDisabled" }) : undefined}
                data-testid="you-escalation-fail-run"
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.completeArenaRun({
                      runId: activeRun?.runId ?? "",
                      outcome: "failed",
                    }),
                  )
                }
              >
                {formatMessage({ id: "you.escalation.progress.actions.failRun" })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                data-testid="you-escalation-invoke-provider"
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.invokeArenaProvider({
                      escalationId: inspected.escalationId,
                      providerId,
                    }),
                  )
                }
              >
                {formatMessage({ id: "you.escalation.progress.actions.invoke" })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                data-testid="you-escalation-cancel"
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.cancelEscalation({
                      escalationId: inspected.escalationId,
                    }),
                  )
                }
              >
                {formatMessage({ id: "you.escalation.progress.actions.cancel" })}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1" data-testid="you-escalation-provider-options">
              <span className="text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.escalation.progress.actions.provider" })}:
              </span>
              {snapshot.providers.map((provider) => {
                const selected = provider.id === providerId;
                return (
                  <Button
                    key={provider.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-6 px-2 font-mono text-ui-xs",
                      selected && "border-primary/60 bg-primary/10 text-primary",
                    )}
                    data-testid="you-escalation-provider-option"
                    data-you-escalation-provider={provider.id}
                    aria-pressed={selected}
                    onClick={() => setProviderId(provider.id)}
                  >
                    {provider.id}
                  </Button>
                );
              })}
            </div>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.progress.actions.startRunCaption" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.progress.actions.invokeCaption" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.progress.actions.cancelCaption" })}
            </p>
          </section>

          <section aria-label={formatMessage({ id: "you.escalation.progress.runs.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.escalation.progress.runs.title" })}
            </h4>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.progress.runs.caption" })}
            </p>
            {runRows.length === 0 ? (
              <p className="mt-2 text-ui-xs text-foreground-subtlest" data-testid="you-escalation-runs-empty">
                {formatMessage({ id: "you.escalation.progress.runs.empty" })}
              </p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1.5" data-testid="you-escalation-runs">
                {runRows.map((row) => (
                  <li
                    key={row.runId}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border p-2",
                      row.status === "completed"
                        ? "border-success/40 bg-success/5"
                        : row.status === "failed"
                          ? "border-destructive/40 bg-destructive/5"
                          : row.status === "aborted"
                            ? "border-warning/40 bg-warning/5"
                            : "border-border bg-surface",
                    )}
                    data-testid="you-escalation-run-row"
                    data-you-escalation-run-id={row.runId}
                    data-you-escalation-run-status={row.status}
                    data-you-escalation-run-attempt={row.attempt}
                  >
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="font-mono text-ui-xs text-foreground">{row.runId}</span>
                      <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
                        {formatMessage({ id: "you.escalation.progress.runs.attempt" })} {row.attempt}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-ui-xs",
                          row.status === "completed"
                            ? "border-success/40 text-success"
                            : row.status === "failed"
                              ? "border-destructive/40 text-destructive"
                              : "border-border text-foreground-subtle",
                        )}
                      >
                        {formatMessage({ id: `you.escalation.progress.runs.status.${row.status}` })}
                      </Badge>
                      <span className="font-mono text-ui-xs text-foreground-subtle">
                        {row.strategy}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                      <span>
                        {formatMessage({ id: "you.escalation.progress.runs.startedAt" })}:{" "}
                        {row.startedAt}
                      </span>
                      <span>
                        {formatMessage({ id: "you.escalation.progress.runs.completedAt" })}:{" "}
                        {row.completedAt ?? "—"}
                      </span>
                      <span className="min-w-0 truncate">
                        {formatMessage({ id: "you.escalation.progress.runs.outcomeEvidence" })}:{" "}
                        {row.outcomeEvidenceRef ?? "—"}
                      </span>
                    </span>
                    <span className="sr-only">{row.accessibleLabel}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.progress.actions.failRunCaption" })}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
