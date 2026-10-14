/* oxlint-disable eslint(max-lines) -- journey 面板是 20 点 launch-gate 显示的单 switch 组件（注册表 + 草稿 + 20 点步骤分解 + 键盘导航一体的显示面；拆分只会把 JOURNEY LAW 的同一显示面碎片化）；T11 换绑后随 UI 退役。 */
// YOU Conformance Studio — E2E journey reports 面板（W11B）。
//
// 验收要求：E2E journey 记录（steps completed、failed step、duration）——launch-gate
// 20 点 journey 显示（JOURNEY LAW：每一步 completed 或 failed-at + duration；
// simulated runs stay labeled）。零 UI 业务逻辑；loading/error/empty 齐全；键盘
// 导航与兄弟表面同级。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { RouteIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useConformanceMessages } from "@/you/useConformanceMessages.js";
import type { UseConformanceStudioBinding } from "@/you/useConformanceStudio.js";
import { orderedJourneyRuns } from "@/you/conformanceController.js";
import {
  projectConformanceJourneyRunRows,
  projectConformanceListRegionView,
  projectJourneyDraftView,
  resolveConformanceKeyboardTransition,
} from "@/you/conformanceStudioProjection.js";

const RUN_KINDS: readonly ("measured" | "simulated")[] = ["measured", "simulated"];

/** 失败步意图预设（20 点表内步序 + null = 完整跑；演示与手选共用）。 */
const FAIL_AT_PRESETS: readonly (number | null)[] = [
  null,
  4,
  10,
  16,
  20,
];

export function ConformanceJourneyPanel({
  binding,
}: {
  binding: UseConformanceStudioBinding;
}) {
  const { formatMessage } = useConformanceMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const journeyDraftId = useStore(binding.store, (state) => state.journeyDraftId);
  const journeyDraftFailAtStep = useStore(
    binding.store,
    (state) => state.journeyDraftFailAtStep,
  );
  const journeyDraftRunKind = useStore(
    binding.store,
    (state) => state.journeyDraftRunKind,
  );
  const selectedJourneyRunId = useStore(
    binding.store,
    (state) => state.selectedJourneyRunId,
  );
  const [busy, setBusy] = useState(false);

  const journeys = snapshot?.journeys ?? [];
  const draftView = useMemo(
    () =>
      projectJourneyDraftView(
        {
          journeyId: journeyDraftId,
          failAtStep: journeyDraftFailAtStep,
          runKind: journeyDraftRunKind,
        },
        journeys,
      ),
    [journeyDraftId, journeyDraftFailAtStep, journeyDraftRunKind, journeys],
  );
  const selectedJourney = journeys.find((entry) => entry.id === journeyDraftId);
  const steps = selectedJourney?.steps ?? [];
  const runRows = useMemo(
    () => projectConformanceJourneyRunRows(orderedJourneyRuns(snapshot), steps),
    [snapshot, steps],
  );
  const runsRegion = projectConformanceListRegionView(
    snapshot !== null,
    runRows.length,
  );

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
      data-testid="you-conformance-journey"
      tabIndex={0}
      onKeyDown={(event) => {
        // 键盘导航 = 一等交互路径（与 Solution/Capture/…/Hardening 同款）。
        const action = resolveConformanceKeyboardTransition(event.key, {
          totalJourneyRuns: runRows.length,
        });
        if (action.kind === "move") {
          event.preventDefault();
          binding.store.getState().moveJourneyIndex(action.delta);
        } else if (action.kind === "select") {
          event.preventDefault();
          if (selectedJourneyRunId !== null) {
            binding.store.getState().selectJourneyRun(selectedJourneyRunId);
          }
        }
      }}
    >
      <section aria-label={formatMessage({ id: "you.conformance.journey.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <RouteIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.conformance.journey.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {runRows.length} {formatMessage({ id: "you.conformance.journey.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.journey.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.journey.registry.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.journey.registry.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.journey.registry.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-journey-registry">
          {journeys.map((entry) => {
            const selected = entry.id === journeyDraftId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-conformance-journey-entry"
                data-you-conformance-journey-id={entry.id}
                data-you-conformance-journey-valid={entry.valid ? "true" : "false"}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                  onClick={() => binding.store.getState().setJourneyDraft(entry.id)}
                >
                  <span className="text-foreground">{entry.journeyId}</span>
                  <span className="text-foreground-subtlest">
                    {entry.steps.length}{" "}
                    {formatMessage({ id: "you.conformance.journey.registry.steps" })}
                  </span>
                  {!entry.valid ? (
                    <Badge
                      variant="outline"
                      className="border-warning/40 text-ui-xs text-warning"
                    >
                      {formatMessage({ id: "you.conformance.journey.registry.invalid" })}
                    </Badge>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
        {steps.length > 0 ? (
          <ol
            className="mt-1.5 flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-2 font-mono text-ui-xs"
            data-testid="you-conformance-journey-steps"
          >
            {steps.map((stepName, index) => (
              <li
                key={stepName}
                className="flex items-baseline gap-1.5 text-foreground-subtlest"
                data-testid="you-conformance-journey-step"
                data-you-conformance-journey-step-index={index + 1}
              >
                <span className="w-5 shrink-0 text-right text-foreground-subtlest">
                  {index + 1}.
                </span>
                <span>{stepName}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.journey.run.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.journey.run.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.journey.run.caption" })}
        </p>
        <div className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-journey-failat">
          <span className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.conformance.journey.run.failAt" })}
          </span>
          <div className="flex flex-wrap gap-1">
            {FAIL_AT_PRESETS.map((failAtStep) => {
              const selected = failAtStep === journeyDraftFailAtStep;
              const label =
                failAtStep === null
                  ? formatMessage({ id: "you.conformance.journey.run.failAt.full" })
                  : formatMessage(
                      { id: "you.conformance.journey.run.failAt.at" },
                      {
                        index: failAtStep,
                        step: steps[failAtStep - 1] ?? "—",
                      },
                    );
              return (
                <Button
                  key={failAtStep === null ? "full" : `at-${failAtStep}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                  )}
                  data-testid="you-conformance-journey-failat-option"
                  data-you-conformance-journey-failat={failAtStep ?? "full"}
                  aria-pressed={selected}
                  onClick={() =>
                    binding.store.getState().setJourneyDraftFailAtStep(failAtStep)
                  }
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-journey-kinds">
          <span className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.conformance.journey.run.kind" })}
          </span>
          <div className="flex flex-wrap gap-1">
            {RUN_KINDS.map((runKind) => {
              const selected = runKind === journeyDraftRunKind;
              return (
                <Button
                  key={runKind}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                    runKind === "measured" && "border-warning/40 text-warning",
                  )}
                  data-testid="you-conformance-journey-kind-option"
                  data-you-conformance-journey-kind={runKind}
                  aria-pressed={selected}
                  onClick={() =>
                    binding.store.getState().setJourneyDraftRunKind(runKind)
                  }
                >
                  {formatMessage({ id: `you.conformance.runKind.${runKind}` })}
                </Button>
              );
            })}
          </div>
          <p
            className="text-ui-xs text-foreground-subtlest"
            data-testid="you-conformance-journey-kind-note"
          >
            {formatMessage({
              id: `you.conformance.journey.run.kindNote.${journeyDraftRunKind}`,
            })}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || draftView.disabledReason !== null}
            data-testid="you-conformance-journey-record"
            data-you-conformance-journey-disabled-reason={draftView.disabledReason ?? ""}
            onClick={() =>
              void withBusy(() =>
                binding.controller.recordJourneyRun({
                  journeyId: journeyDraftId,
                  failAtStep: journeyDraftFailAtStep,
                  runKind: journeyDraftRunKind,
                }),
              )
            }
          >
            <RouteIcon className="size-3.5" />
            {formatMessage({ id: "you.conformance.journey.run.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.conformance.journey.run.disabled" })}
            </span>
          ) : null}
        </div>
      </section>

      {runsRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-conformance-journey-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.conformance.journey.runs.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.journey.runs.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.conformance.journey.runs.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.conformance.journey.runs.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.journey.runs.caption" })}
          </p>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.journey.keyboardHint" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-journey-runs">
            {runRows.map((row) => {
              const selected = row.runId === selectedJourneyRunId;
              return (
                <li
                  key={row.runId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-conformance-journey-run"
                  data-you-conformance-journey-run-id={row.runId}
                  data-you-conformance-journey-run-kind={row.kind}
                  data-you-conformance-journey-steps-completed={row.stepsCompleted}
                  data-you-conformance-journey-failed-step={row.failedStep ?? ""}
                  data-you-conformance-journey-duration={row.durationMs}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store.getState().selectJourneyRun(row.runId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.runId}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.kind === "failure-injection"
                          ? "border-warning/40 text-warning"
                          : "border-border text-foreground-subtle",
                      )}
                    >
                      {formatMessage({
                        id: `you.conformance.journey.kind.${row.kind}`,
                      })}
                    </Badge>
                    {row.simulated ? (
                      <Badge
                        variant="outline"
                        className="border-warning/40 text-ui-xs text-warning"
                      >
                        {formatMessage({
                          id: "you.conformance.journey.runs.simulatedLabel",
                        })}
                      </Badge>
                    ) : null}
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.conformance.journey.runs.row.steps" })}:{" "}
                      {row.stepsCompleted}/{row.steps.length}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.journey.runs.row.failedStep" })}:{" "}
                      {row.failedStep ??
                        formatMessage({ id: "you.conformance.journey.runs.row.none" })}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.journey.runs.row.duration" })}:{" "}
                      {formatMessage(
                        { id: "you.conformance.journey.runs.durationMs" },
                        { ms: row.durationMs },
                      )}
                    </span>
                  </span>
                  {/* 20 点 launch-gate 步骤分解（JOURNEY LAW 显示面）。 */}
                  <ol
                    className="flex flex-col gap-0.25 pl-1"
                    data-testid="you-conformance-journey-run-steps"
                  >
                    {row.steps.map((step) => (
                      <li
                        key={step.stepName}
                        className={cn(
                          "flex items-baseline gap-1.5 font-mono text-ui-xs",
                          step.state === "completed" && "text-foreground-subtlest",
                          step.state === "failed" && "text-destructive",
                          step.state === "pending" && "text-foreground-subtlest/60",
                        )}
                        data-testid="you-conformance-journey-run-step"
                        data-you-conformance-journey-step-state={step.state}
                      >
                        <span className="w-5 shrink-0 text-right">{step.stepIndex}.</span>
                        <span>{step.stepName}</span>
                        <span className="ml-auto shrink-0">
                          {formatMessage({
                            id: `you.conformance.journey.runs.step.${step.state}`,
                          })}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
