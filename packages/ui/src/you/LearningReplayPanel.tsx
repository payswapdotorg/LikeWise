// YOU Learning Studio — 学习重放面板（W6B）。
//
// 验收要求：TrajectoryReference 步骤列表（内容寻址标签 ONLY——绝不内联内容）+
// 确定性重放投影（重放摘要显示）。重放字节是操作性值——只以摘要与长度显示；
// 同 seed ⇒ 字节一致（恒等可校验，绝不凭空断言）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { FlaskConicalIcon, PlayIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useLearningMessages } from "@/you/useLearningMessages.js";
import type { UseLearningStudioBinding } from "@/you/useLearningStudio.js";
import {
  learningTrajectoryById,
  orderedLearningTrajectories,
} from "@/you/learningController.js";
import {
  projectTrajectoryRows,
  projectTrajectoryStepRows,
} from "@/you/learningStudioProjection.js";

export function LearningReplayPanel({ binding }: { binding: UseLearningStudioBinding }) {
  const { formatMessage } = useLearningMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedTrajectoryId = useStore(
    binding.store,
    (state) => state.selectedTrajectoryId,
  );
  const lastReplay = useStore(binding.store, (state) => state.lastReplay);
  const [busy, setBusy] = useState(false);

  const trajectories = useMemo(
    () => orderedLearningTrajectories(snapshot),
    [snapshot],
  );
  const inspected = useMemo(
    () =>
      learningTrajectoryById(snapshot, selectedTrajectoryId) ??
      trajectories.at(-1) ??
      null,
    [snapshot, selectedTrajectoryId, trajectories],
  );
  const rows = useMemo(() => projectTrajectoryRows(trajectories), [trajectories]);
  const stepRows = useMemo(
    () => (inspected ? projectTrajectoryStepRows(inspected.stepRefs) : []),
    [inspected],
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
      data-testid="you-learning-replay"
    >
      <section aria-label={formatMessage({ id: "you.learning.replay.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <FlaskConicalIcon className="size-4 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.learning.replay.title" })}
          </h3>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-learning-replay-count">
            {rows.length}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.replay.caption" })}
        </p>
        {rows.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-learning-replay-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.learning.replay.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.learning.replay.emptyHint" })}
            </p>
          </div>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <section aria-label={formatMessage({ id: "you.learning.replay.count" })}>
          <ol className="flex flex-col gap-1.5" data-testid="you-learning-trajectory-list">
            {rows.map((row) => (
              <li key={row.trajectoryId}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                    row.trajectoryId === inspected?.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-surface hover:bg-surface-hover",
                  )}
                  data-testid="you-learning-trajectory-row"
                  data-you-learning-trajectory-id={row.trajectoryId}
                  onClick={() =>
                    binding.store.getState().selectTrajectory(row.trajectoryId)
                  }
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="font-mono text-ui-xs text-foreground">{row.trajectoryId}</span>
                    <Badge variant="outline" className="border-primary/40 text-ui-xs text-primary">
                      {row.stepCount}{" "}
                      {formatMessage({ id: "you.learning.replay.stepCount" })}
                    </Badge>
                    <span className="font-mono text-ui-xs text-foreground-subtlest">{row.scope}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                    <span>
                      {formatMessage({ id: "you.learning.replay.recordedAt" })}: {row.createdAt}
                    </span>
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {inspected ? (
        <>
          <section aria-label={formatMessage({ id: "you.learning.replay.steps.title" })}>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-mono text-ui-sm font-medium text-foreground">
                {inspected.id} ·{" "}
                {formatMessage({ id: "you.learning.replay.steps.title" })}
              </h4>
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy}
                data-testid="you-learning-replay-run"
                onClick={() => {
                  void withBusy(async () => {
                    const replay = await binding.controller.replayTrajectory({
                      trajectoryId: inspected.id,
                    });
                    binding.store.getState().setLastReplay({
                      trajectoryId: inspected.id,
                      stepCount: replay.stepCount,
                      replayHash: replay.replayHash,
                      byteLength: replay.bytes.length,
                    });
                  });
                }}
              >
                <PlayIcon className="size-3" />
                {formatMessage({ id: "you.learning.replay.run" })}
              </Button>
            </div>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.learning.replay.runCaption" })}
            </p>
            <ol className="mt-2 flex flex-col gap-1" data-testid="you-learning-replay-steps">
              {stepRows.map((row) => (
                <li
                  key={`${row.index}:${row.stepRef}`}
                  className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-ui-xs text-foreground-subtle"
                  data-testid="you-learning-replay-step"
                  data-you-learning-replay-step-index={row.index}
                >
                  <span className="text-foreground-subtlest">{row.index + 1}.</span> {row.stepRef}
                  <span className="sr-only">{row.accessibleLabel}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label={formatMessage({ id: "you.learning.replay.last.title" })} data-testid="you-learning-replay-result">
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.learning.replay.last.title" })}
            </h4>
            {lastReplay ? (
              <dl className="mt-2 flex flex-col gap-1 text-ui-xs text-foreground-subtle">
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.learning.replay.last.trajectory" })}:
                  </dt>
                  <dd className="font-mono">{lastReplay.trajectoryId}</dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.learning.replay.last.steps" })}:
                  </dt>
                  <dd className="font-mono">{lastReplay.stepCount}</dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.learning.replay.last.bytes" })}:
                  </dt>
                  <dd className="font-mono">{lastReplay.byteLength}</dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.learning.replay.last.hash" })}:
                  </dt>
                  <dd className="font-mono" data-testid="you-learning-replay-hash">
                    {lastReplay.replayHash}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-1 text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.learning.replay.last.none" })}
              </p>
            )}
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.learning.replay.determinismNote" })}
            </p>
          </section>
        </>
      ) : (
        <p className="text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.replay.runDisabled" })}
        </p>
      )}
    </div>
  );
}
