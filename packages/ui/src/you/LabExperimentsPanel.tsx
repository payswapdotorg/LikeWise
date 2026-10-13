/* oxlint-disable eslint(max-lines) -- 实验面板是「声明挑选器（规格/世界/预算三段）+ 不可变记录列表 + 三臂比较 + 世界上下文」的单面板聚合（每段都消费同一 controller 投影的同一选择器族；拆分只会让同一表面的成段 JSX/文案跨文件碎片化，增加 T9 换绑时的对照成本——W8B max-lines 文件的既定 disable header 先例）。 */
// YOU Lab Studio — 实验面板（W9B）。
//
// 验收要求：experiment surface——LabExperiment 声明（规格 + 世界预设 + 预算预设
// 挑选）+ 三臂比较显示（generalist baseline / hand-designed / searched）从
// controller 投影渲染——UI 零业务逻辑（W1B–W8B controller 模式；T9 换绑前由模拟
// 控制器支撑）。世界/预算 intake 的诚实拒绝路径以 typed error panel 呈现（
// YOU_LAB_WORLD_INVALID / YOU_SEARCH_LADDER_INVALID）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { FlaskConicalIcon, MicroscopeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useLabMessages } from "@/you/useLabMessages.js";
import type { UseLabStudioBinding } from "@/you/useLabStudio.js";
import { labArmScoresOfExperiment, labExperimentContextOf, orderedLabExperiments } from "@/you/labController.js";
import {
  projectExperimentDraftView,
  projectExperimentRows,
  projectLabListRegionView,
  projectThreeArmComparison,
} from "@/you/labStudioProjection.js";

export function LabExperimentsPanel({ binding }: { binding: UseLabStudioBinding }) {
  const { formatMessage } = useLabMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedExperimentId = useStore(binding.store, (state) => state.selectedExperimentId);
  const selectedSpecId = useStore(binding.store, (state) => state.selectedSpecId);
  const worldPresetDraftId = useStore(binding.store, (state) => state.worldPresetDraftId);
  const budgetPresetDraftId = useStore(binding.store, (state) => state.budgetPresetDraftId);
  const [busy, setBusy] = useState(false);

  const experiments = useMemo(() => orderedLabExperiments(snapshot), [snapshot]);
  const experimentRows = useMemo(
    () =>
      projectExperimentRows(
        experiments,
        snapshot?.experimentContexts ?? [],
        snapshot?.runs ?? [],
      ),
    [experiments, snapshot],
  );
  const selectedExperiment = useMemo(
    () => experiments.find((experiment) => experiment.id === selectedExperimentId) ?? null,
    [experiments, selectedExperimentId],
  );
  const selectedContext = useMemo(
    () => labExperimentContextOf(snapshot, selectedExperimentId),
    [snapshot, selectedExperimentId],
  );
  const comparison = useMemo(
    () => projectThreeArmComparison(labArmScoresOfExperiment(snapshot, selectedExperimentId)),
    [snapshot, selectedExperimentId],
  );
  const draftView = useMemo(
    () =>
      projectExperimentDraftView(
        {
          specId: selectedSpecId,
          worldPresetId: worldPresetDraftId,
          budgetPresetId: budgetPresetDraftId,
        },
        {
          worldPresets: snapshot?.worldPresets ?? [],
          budgetPresets: snapshot?.budgetPresets ?? [],
        },
      ),
    [selectedSpecId, worldPresetDraftId, budgetPresetDraftId, snapshot],
  );
  const region = projectLabListRegionView(snapshot !== null, experiments.length);

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
      data-testid="you-lab-experiments"
    >
      <section aria-label={formatMessage({ id: "you.lab.experiments.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <MicroscopeIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.lab.experiments.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {snapshot.experiments.length} {formatMessage({ id: "you.lab.experiments.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.experiments.caption" })}
        </p>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.experiments.keyboardHint" })}
        </p>
      </section>

      {region === "empty" ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-lab-experiments-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.lab.experiments.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.lab.experiments.emptyHint" })}
          </p>
        </div>
      ) : (
        <section>
          <ol className="flex flex-col gap-1.5" data-testid="you-lab-experiments-list">
            {experimentRows.map((row) => {
              const selected = row.experimentId === selectedExperimentId;
              return (
                <li
                  key={row.experimentId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-lab-experiment-row"
                  data-you-lab-experiment-id={row.experimentId}
                  data-you-lab-experiment-selected={selected ? "true" : "false"}
                  data-you-lab-search-exhausted={row.searchExhausted ? "true" : "false"}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() => binding.store.getState().selectExperiment(row.experimentId)}
                  >
                    <span className="font-mono text-ui-xs text-foreground">{row.experimentId}</span>
                    <span className="text-ui-xs text-foreground-subtle">
                      {formatMessage({ id: "you.lab.experiments.row.objective" })}: {row.objective}
                    </span>
                    <span className="font-mono text-ui-xs text-foreground-subtlest">
                      {formatMessage({ id: "you.lab.experiments.row.constraints" })}:{" "}
                      {row.constraintsHash.slice(0, 24)}…
                    </span>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                    <span>
                      {formatMessage({ id: "you.lab.experiments.row.arms" })}: {row.armCount}
                    </span>
                    <span>
                      {formatMessage({ id: "you.lab.experiments.row.world" })}: {row.worldSeed} (
                      {row.worldActorCount})
                    </span>
                    <span>
                      {formatMessage({ id: "you.lab.experiments.row.budget" })}: {row.searchBudget}
                      {row.searchExhausted
                        ? ` · ${formatMessage({ id: "you.lab.search.exhausted" })}`
                        : ""}
                    </span>
                    <span>
                      {formatMessage({ id: "you.lab.experiments.row.runs" })}: {row.runCount}
                    </span>
                    <span>
                      {formatMessage({ id: "you.lab.experiments.row.promotion" })}:{" "}
                      {row.promotionRef === null
                        ? formatMessage({ id: "you.lab.experiments.row.promotionNone" })
                        : row.promotionRef}
                    </span>
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {selectedExperiment ? (
        <section
          aria-label={formatMessage({ id: "you.lab.comparison.title" })}
          data-testid="you-lab-comparison"
        >
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.lab.comparison.title" })}
          </h4>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.lab.comparison.caption" })}
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {comparison.arms.map((arm) => (
              <div
                key={arm.arm}
                className="flex flex-wrap items-baseline gap-x-2 rounded-md border border-border bg-surface p-1.5"
                data-testid="you-lab-comparison-arm"
                data-you-lab-comparison-arm={arm.arm}
                data-you-lab-comparison-score={arm.score ?? ""}
              >
                <span className="text-ui-xs font-medium text-foreground">
                  {formatMessage({ id: `you.lab.arm.${arm.arm}` })}
                </span>
                <span className="font-mono text-ui-xs text-foreground-subtle">
                  {formatMessage({ id: "you.lab.comparison.score" })}:{" "}
                  {arm.score ?? formatMessage({ id: "you.lab.comparison.scorePending" })}
                </span>
                <span className="font-mono text-ui-xs text-foreground-subtlest">
                  {formatMessage({ id: "you.lab.comparison.succeeded" })} {arm.succeededCount}/
                  {arm.runCount} {formatMessage({ id: "you.lab.comparison.runs" })}
                </span>
                <span className="font-mono text-ui-xs text-foreground-subtlest">
                  {formatMessage({ id: "you.lab.comparison.evidence" })}:{" "}
                  {arm.evidenceManifestId ?? formatMessage({ id: "you.lab.comparison.evidenceNone" })}
                </span>
              </div>
            ))}
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-md border p-1.5",
                comparison.verdict === "beats"
                  ? "border-success/40 bg-success/5"
                  : comparison.verdict === "pending"
                    ? "border-border bg-surface"
                    : "border-warning/40 bg-warning/5",
              )}
              data-testid="you-lab-comparison-verdict"
              data-you-lab-comparison-verdict={comparison.verdict}
            >
              <span className="text-ui-xs font-medium text-foreground">
                {formatMessage({ id: "you.lab.comparison.verdict.title" })}:
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-ui-xs",
                  comparison.verdict === "beats"
                    ? "border-success/40 text-success"
                    : comparison.verdict === "pending"
                      ? "border-border text-foreground-subtle"
                      : "border-warning/40 text-warning",
                )}
              >
                {formatMessage({ id: `you.lab.comparison.verdict.${comparison.verdict}` })}
              </Badge>
              {comparison.searchedScore !== null && comparison.baselineScore !== null ? (
                <span className="font-mono text-ui-xs text-foreground-subtle">
                  {comparison.searchedScore} vs {comparison.baselineScore}
                </span>
              ) : null}
            </div>
            <p className="text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.lab.comparison.verdictCaption" })}
            </p>
          </div>
          {selectedContext ? (
            <div
              className="mt-2 rounded-md border border-border bg-surface p-1.5"
              data-testid="you-lab-world-context"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <FlaskConicalIcon className="size-3.5 text-foreground-subtle" />
                <span className="text-ui-xs font-medium text-foreground">
                  {formatMessage({ id: "you.lab.world.title" })}
                </span>
              </div>
              <span className="mt-1 flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                <span>
                  {formatMessage({ id: "you.lab.world.seed" })}: {selectedContext.world.seed}
                </span>
                <span>
                  {formatMessage({ id: "you.lab.world.actorCount" })}:{" "}
                  {selectedContext.world.actorCount}
                </span>
                <span>
                  {formatMessage({ id: "you.lab.world.groundTruth" })}:{" "}
                  {selectedContext.world.groundTruthRef ??
                    formatMessage({ id: "you.lab.world.groundTruthNone" })}
                </span>
              </span>
              <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.lab.world.caption" })}{" "}
                {formatMessage({ id: "you.lab.world.simulatedNote" })}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-label={formatMessage({ id: "you.lab.experiments.record.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.lab.experiments.record.title" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.experiments.record.caption" })}
        </p>
        <div className="mt-2 flex flex-wrap gap-1" data-testid="you-lab-spec-options">
          {snapshot.experimentSpecs.map((spec) => {
            const selected = spec.id === selectedSpecId;
            return (
              <Button
                key={spec.id}
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className={cn(
                  "h-6 max-w-full truncate px-2 font-mono text-ui-xs",
                  selected && "border-primary/60 bg-primary/10 text-primary",
                )}
                data-testid="you-lab-spec-option"
                data-you-lab-spec-id={spec.id}
                aria-pressed={selected}
                title={`${formatMessage({ id: "you.lab.experiments.spec.objective" })}: ${spec.objective}`}
                onClick={() => binding.store.getState().selectSpec(spec.id)}
              >
                {spec.id} · {spec.armScores.map((entry) => `${entry.arm.split("-")[0]}:${entry.score}`).join(" ")}
              </Button>
            );
          })}
        </div>
        <div className="mt-2" data-testid="you-lab-world-options">
          <p className="text-ui-xs font-medium text-foreground">
            {formatMessage({ id: "you.lab.experiments.world.title" })}
          </p>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.lab.experiments.world.hint" })}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {snapshot.worldPresets.map((preset) => {
              const selected = preset.id === worldPresetDraftId;
              return (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className={cn(
                    "h-6 px-2 font-mono text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                    !preset.valid && "border-warning/40 text-warning",
                  )}
                  data-testid="you-lab-world-option"
                  data-you-lab-world-preset={preset.id}
                  data-you-lab-world-valid={preset.valid ? "true" : "false"}
                  aria-pressed={selected}
                  onClick={() => binding.store.getState().setDraftWorldPreset(preset.id)}
                >
                  {preset.id} · {preset.seed || "∅"} · {preset.actorCount}{" "}
                  {formatMessage({
                    id: preset.valid
                      ? "you.lab.experiments.world.valid"
                      : "you.lab.experiments.world.invalid",
                  })}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="mt-2" data-testid="you-lab-budget-options">
          <p className="text-ui-xs font-medium text-foreground">
            {formatMessage({ id: "you.lab.experiments.budget.title" })}
          </p>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.lab.experiments.budget.hint" })}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {snapshot.budgetPresets.map((preset) => {
              const selected = preset.id === budgetPresetDraftId;
              return (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className={cn(
                    "h-6 px-2 font-mono text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                    !preset.valid && "border-warning/40 text-warning",
                  )}
                  data-testid="you-lab-budget-option"
                  data-you-lab-budget-preset={preset.id}
                  data-you-lab-budget-valid={preset.valid ? "true" : "false"}
                  aria-pressed={selected}
                  onClick={() => binding.store.getState().setDraftBudgetPreset(preset.id)}
                >
                  {preset.id} · {preset.cumulativeBudget}{" "}
                  {formatMessage({
                    id: preset.valid
                      ? "you.lab.experiments.budget.valid"
                      : "you.lab.experiments.budget.invalid",
                  })}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || draftView.disabledReason !== null}
            data-testid="you-lab-declare"
            data-you-lab-declare-disabled-reason={draftView.disabledReason ?? ""}
            onClick={() =>
              void withBusy(() =>
                binding.controller.declareExperiment({
                  specId: selectedSpecId ?? "",
                  worldPresetId: worldPresetDraftId,
                  budgetPresetId: budgetPresetDraftId,
                }),
              )
            }
          >
            {formatMessage({ id: "you.lab.experiments.record.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {draftView.disabledReason === "no-spec" ? (
                formatMessage({ id: "you.lab.experiments.record.disabled" })
              ) : draftView.disabledReason === "invalid-world" ? (
                formatMessage({ id: "you.lab.error.YOU_LAB_WORLD_INVALID" })
              ) : (
                formatMessage({ id: "you.lab.error.YOU_SEARCH_LADDER_INVALID" })
              )}
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
