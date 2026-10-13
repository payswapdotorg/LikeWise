/* oxlint-disable eslint(max-lines) -- run 面板是「阶梯列表 + 状态阶梯（事件流投影）+ 生命周期动作 + 搜索阶梯 + 提交挑选器」的单面板聚合（每段都消费同一 controller 投影的同一选择器族；拆分只会让同一表面的成段 JSX/文案跨文件碎片化，增加 T9 换绑时的对照成本——W8B max-lines 文件的既定 disable header 先例）。 */
// YOU Lab Studio — run 阶梯面板（W9B）。
//
// 验收要求：run surface——LabRun 状态阶梯（submitted -> running ->
// succeeded | failed | retired）由投影的 lab-run-recorded 事件渲染——绝非 UI 本地
// 状态；searched 臂提交的搜索阶梯（SEARCH BUDGET LAW 显示面：每步 append 的
// SearchLadderStep + recorded exhaustion terminal）；生命周期动作全部经 controller
// 端口投射意图（提交/启动/成功/失败/退役）；预算耗尽是 recorded terminal 后的
// typed YOU_SEARCH_LADDER_INVALID 拒绝。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { CircleDotIcon, ListOrderedIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useLabMessages } from "@/you/useLabMessages.js";
import type { UseLabStudioBinding } from "@/you/useLabStudio.js";
import {
  labRunById,
  labRunsOfExperiment,
  labSearchLadderOfExperiment,
  labExperimentById,
} from "@/you/labController.js";
import {
  projectLabListRegionView,
  projectLabRunLadder,
  projectLabRunRows,
  projectSearchLadderRows,
  projectRunDraftView,
} from "@/you/labStudioProjection.js";
import type { LabArmKind } from "@zcode/shared";

const ARM_OPTIONS: readonly LabArmKind[] = [
  "generalist-baseline",
  "hand-designed",
  "searched",
];

export function LabRunsPanel({ binding }: { binding: UseLabStudioBinding }) {
  const { formatMessage } = useLabMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedExperimentId = useStore(binding.store, (state) => state.selectedExperimentId);
  const selectedRunId = useStore(binding.store, (state) => state.selectedRunId);
  const runDraftArm = useStore(binding.store, (state) => state.runDraftArm);
  const [busy, setBusy] = useState(false);

  const experiment = useMemo(
    () => labExperimentById(snapshot, selectedExperimentId),
    [snapshot, selectedExperimentId],
  );
  const runs = useMemo(
    () => labRunsOfExperiment(snapshot, selectedExperimentId),
    [snapshot, selectedExperimentId],
  );
  const runRows = useMemo(() => projectLabRunRows(runs), [runs]);
  const selectedRun = useMemo(
    () => labRunById(snapshot, selectedRunId),
    [snapshot, selectedRunId],
  );
  const selectedRunLadder = useMemo(
    () =>
      selectedRun && snapshot
        ? projectLabRunLadder(selectedRun, snapshot.events, selectedRun.id)
        : [],
    [selectedRun, snapshot],
  );
  const searchRows = useMemo(
    () =>
      projectSearchLadderRows(labSearchLadderOfExperiment(snapshot, selectedExperimentId)),
    [snapshot, selectedExperimentId],
  );
  const draftView = useMemo(
    () => projectRunDraftView(runDraftArm, experiment),
    [runDraftArm, experiment],
  );
  const region = projectLabListRegionView(snapshot !== null, runs.length);
  const searchExhausted = searchRows.some((row) => row.exhaustedTerminal);

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
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
      data-testid="you-lab-runs"
    >
      <section aria-label={formatMessage({ id: "you.lab.runs.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <ListOrderedIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.lab.runs.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {experiment ? `${experiment.id} · ${runs.length} ${formatMessage({ id: "you.lab.runs.count" })}` : "—"}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.runs.caption" })}
        </p>
      </section>

      {region === "empty" ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-lab-runs-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.lab.runs.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.lab.runs.emptyHint" })}
          </p>
        </div>
      ) : (
        <section>
          <ol className="flex flex-col gap-1.5" data-testid="you-lab-runs-list">
            {runRows.map((row) => {
              const selected = row.runId === selectedRunId;
              return (
                <li
                  key={row.runId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-lab-run-row"
                  data-you-lab-run-id={row.runId}
                  data-you-lab-run-arm={row.arm}
                  data-you-lab-run-status={row.status}
                  data-you-lab-run-selected={selected ? "true" : "false"}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() => binding.store.getState().selectRun(row.runId)}
                  >
                    <CircleDotIcon
                      className={cn(
                        "size-3 shrink-0 self-center",
                        row.status === "succeeded"
                          ? "text-success"
                          : row.status === "failed"
                            ? "text-destructive"
                            : row.status === "retired"
                              ? "text-foreground-subtlest"
                              : "text-warning",
                      )}
                    />
                    <span className="font-mono text-ui-xs text-foreground">{row.runId}</span>
                    <span className="text-ui-xs text-foreground-subtle">
                      {formatMessage({ id: `you.lab.arm.${row.arm}` })}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.status === "succeeded"
                          ? "border-success/40 text-success"
                          : row.status === "failed"
                            ? "border-destructive/40 text-destructive"
                            : row.status === "running"
                              ? "border-warning/40 text-warning"
                              : "border-border text-foreground-subtle",
                      )}
                    >
                      {formatMessage({ id: `you.lab.runs.status.${row.status}` })}
                    </Badge>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.lab.runs.row.plan" })}: {row.planHash.slice(0, 22)}…
                    </span>
                    <span>
                      {formatMessage({ id: "you.lab.runs.row.submittedAt" })}: {row.submittedAt}
                    </span>
                    {row.completedAt !== null ? (
                      <span>
                        {formatMessage({ id: "you.lab.runs.row.completedAt" })}: {row.completedAt}
                      </span>
                    ) : null}
                    <span>
                      {formatMessage({ id: "you.lab.runs.row.evidence" })}:{" "}
                      {row.evidenceManifestRef ??
                        formatMessage({ id: "you.lab.runs.row.evidenceNone" })}
                    </span>
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {selectedRun ? (
        <section
          aria-label={formatMessage({ id: "you.lab.runs.ladder.title" })}
          data-testid="you-lab-run-ladder"
          data-you-lab-run-ladder-run-id={selectedRun.id}
        >
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.lab.runs.ladder.title" })} — {selectedRun.id}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.lab.runs.ladder.terminalHint" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1">
            {selectedRunLadder.map((step) => (
              <li
                key={step.status}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1",
                  step.current
                    ? "border-primary/40 bg-primary/5"
                    : step.reached
                      ? "border-border bg-card"
                      : "border-border/60 bg-surface opacity-60",
                )}
                data-testid="you-lab-run-ladder-step"
                data-you-lab-ladder-status={step.status}
                data-you-lab-ladder-reached={step.reached ? "true" : "false"}
                data-you-lab-ladder-current={step.current ? "true" : "false"}
                data-you-lab-ladder-terminal={step.terminal ? "true" : "false"}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    step.current
                      ? "bg-primary"
                      : step.reached
                        ? "bg-success"
                        : "bg-border",
                  )}
                />
                <span className="text-ui-xs font-medium text-foreground">
                  {formatMessage({ id: `you.lab.runs.status.${step.status}` })}
                </span>
                {step.at ? (
                  <span className="font-mono text-ui-xs text-foreground-subtlest">{step.at}</span>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || selectedRun.status !== "submitted"}
              data-testid="you-lab-run-start"
              onClick={() => void withBusy(() => binding.controller.startLabRun({ runId: selectedRun.id }))}
            >
              {formatMessage({ id: "you.lab.runs.actions.start" })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || selectedRun.status !== "running"}
              data-testid="you-lab-run-succeed"
              onClick={() =>
                void withBusy(() =>
                  binding.controller.completeLabRun({ runId: selectedRun.id, outcome: "succeeded" }),
                )
              }
            >
              {formatMessage({ id: "you.lab.runs.actions.succeed" })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || selectedRun.status !== "running"}
              data-testid="you-lab-run-fail"
              onClick={() =>
                void withBusy(() =>
                  binding.controller.completeLabRun({ runId: selectedRun.id, outcome: "failed" }),
                )
              }
            >
              {formatMessage({ id: "you.lab.runs.actions.fail" })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || selectedRun.status === "succeeded" || selectedRun.status === "failed" || selectedRun.status === "retired"}
              data-testid="you-lab-run-retire"
              onClick={() => void withBusy(() => binding.controller.retireLabRun({ runId: selectedRun.id }))}
            >
              {formatMessage({ id: "you.lab.runs.actions.retire" })}
            </Button>
          </div>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {selectedRun.status === "submitted"
              ? formatMessage({ id: "you.lab.runs.actions.startCaption" })
              : selectedRun.status === "running"
                ? formatMessage({ id: "you.lab.runs.actions.succeedCaption" })
                : formatMessage({ id: "you.lab.runs.actions.terminalDisabled" })}
          </p>
        </section>
      ) : null}

      <section aria-label={formatMessage({ id: "you.lab.search.title" })} data-testid="you-lab-search-ladder">
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.lab.search.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.search.caption" })}
        </p>
        {searchRows.length === 0 ? (
          <p className="mt-1 text-ui-xs text-foreground-subtle">
            {formatMessage({ id: "you.lab.search.empty" })}
          </p>
        ) : (
          <ol className="mt-1.5 flex flex-col gap-1">
            {searchRows.map((row) => (
              <li
                key={row.stepId}
                className={cn(
                  "flex flex-wrap items-baseline gap-x-2 rounded-md border px-2 py-1 font-mono text-ui-xs",
                  row.exhaustedTerminal
                    ? "border-warning/40 bg-warning/5 text-warning"
                    : "border-border bg-surface text-foreground-subtle",
                )}
                data-testid="you-lab-search-step"
                data-you-lab-search-step={row.step}
                data-you-lab-search-strategy={row.strategy}
                data-you-lab-search-exhausted={row.exhaustedTerminal ? "true" : "false"}
              >
                <span className="text-foreground">
                  {formatMessage({ id: "you.lab.search.step" })} {row.step}/{row.cumulativeBudget}
                </span>
                <span>{row.strategy}</span>
                <span>
                  {formatMessage({ id: "you.lab.search.exploredNodes" })}: {row.exploredNodes}
                </span>
                <span>
                  {formatMessage({ id: "you.lab.search.bestScore" })}: {row.bestScore}
                </span>
                {row.exhaustedTerminal ? (
                  <span>{formatMessage({ id: "you.lab.search.exhausted" })}</span>
                ) : null}
                <span className="sr-only">{row.accessibleLabel}</span>
              </li>
            ))}
          </ol>
        )}
        {searchExhausted ? (
          <p
            className="mt-1 rounded-md border border-warning/40 bg-warning/5 p-1.5 text-ui-xs text-foreground"
            data-testid="you-lab-search-exhausted-notice"
            role="note"
          >
            {formatMessage({ id: "you.lab.search.exhaustedNotice" })}
          </p>
        ) : null}
      </section>

      <section aria-label={formatMessage({ id: "you.lab.runs.submit.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.lab.runs.submit.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.runs.submit.caption" })}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1" data-testid="you-lab-run-arm-options">
          {ARM_OPTIONS.map((arm) => {
            const selected = arm === runDraftArm;
            return (
              <Button
                key={arm}
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className={cn(
                  "h-6 px-2 text-ui-xs",
                  selected && "border-primary/60 bg-primary/10 text-primary",
                )}
                data-testid="you-lab-run-arm-option"
                data-you-lab-run-arm={arm}
                aria-pressed={selected}
                onClick={() => binding.store.getState().setRunDraftArm(arm)}
              >
                {formatMessage({ id: `you.lab.arm.${arm}` })}
              </Button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || draftView.disabledReason !== null}
            data-testid="you-lab-run-submit"
            data-you-lab-run-submit-disabled-reason={draftView.disabledReason ?? ""}
            onClick={() =>
              void withBusy(() =>
                binding.controller.submitLabRun({
                  experimentId: selectedExperimentId ?? "",
                  arm: runDraftArm,
                }),
              )
            }
          >
            {formatMessage({ id: "you.lab.runs.submit.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.lab.runs.submit.disabled" })}
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
