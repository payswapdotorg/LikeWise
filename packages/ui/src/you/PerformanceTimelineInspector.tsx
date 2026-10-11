// YOU Performance Studio — 时间线检视组件（W4B）。
//
// 验收要求：cue track 可视化（motion/cue/layer 分类学）、时长显示、逐 cue 的
// payload 引用（内容寻址标签，绝不内轨内容）+ evidence 派生标记。时长条形可视化
// 用确定性视图数学（startPercent/widthPercent）。从 PerformanceTimelinePanel 按
// 模块内聚拆分（保持仓库 400 行纪律）。
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { usePerformanceMessages } from "@/you/usePerformanceMessages.js";
import type { UsePerformanceStudioBinding } from "@/you/usePerformanceStudio.js";
import { projectTimeline } from "@/you/performanceStudioProjection.js";
import { createTimelineDraft } from "@/you/performanceTimelineDraftModel.js";
import type { Performance } from "@zcode/shared";

/** 时间线检视（轨道分类学 + 时长 + 内容寻址 payload 标签）。 */
export function PerformanceTimelineInspector({
  performance,
  binding,
  busy,
}: {
  performance: Performance;
  binding: UsePerformanceStudioBinding;
  busy: boolean;
}) {
  const { formatMessage } = usePerformanceMessages();
  const projection = projectTimeline(performance.timeline);
  return (
    <section
      aria-label={formatMessage({ id: "you.performance.timeline.tracks" })}
      data-testid="you-performance-timeline-inspector"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.performance.timeline.tracks" })}
        </h4>
        <Badge variant="secondary" className="font-mono text-ui-xs" data-testid="you-performance-timeline-duration">
          {formatMessage({ id: "you.performance.timeline.duration" })}: {projection.durationLabel}
        </Badge>
        <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
          {projection.totalCues} {formatMessage({ id: "you.performance.timeline.cues" })}
        </Badge>
        {projection.evidenceBoundCueCount > 0 ? (
          <Badge
            variant="outline"
            className="border-warning/40 font-mono text-ui-xs text-warning"
            data-testid="you-performance-evidence-count"
          >
            {projection.evidenceBoundCueCount} {formatMessage({ id: "you.performance.timeline.evidenceBound" })}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.performance.timeline.taxonomyHint" })}
      </p>
      <div className="mt-2 flex flex-col gap-2" data-testid="you-performance-track-list">
        {projection.tracks.map((trackRow) => (
          <div
            key={trackRow.track}
            className="rounded-lg border border-border bg-card p-2"
            data-testid="you-performance-track"
            data-you-performance-track={trackRow.track}
          >
            <div className="flex items-baseline gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-ui-xs",
                  trackRow.track === "motion" && "border-brand/40 text-brand",
                  trackRow.track === "cue" && "border-warning/40 text-warning",
                  trackRow.track === "layer" && "text-foreground-subtle",
                )}
                data-testid="you-performance-track-kind"
              >
                {trackRow.track}
              </Badge>
              <span className="text-ui-xs text-foreground-subtlest">
                {trackRow.cueCount} {formatMessage({ id: "you.performance.timeline.cues" })}
              </span>
            </div>
            {/* 时长条形可视化（确定性视图数学：startPercent/widthPercent）。 */}
            <div
              className="relative mt-1.5 h-4 overflow-hidden rounded-sm border border-border bg-surface"
              aria-hidden="true"
              data-testid="you-performance-track-lane"
            >
              {trackRow.cueRows.map((cueRow) => (
                <div
                  key={cueRow.id}
                  className={cn(
                    "absolute inset-y-0.5 rounded-sm",
                    cueRow.evidenceBound ? "bg-warning/50" : "bg-brand/40",
                  )}
                  style={{
                    left: `${cueRow.startPercent}%`,
                    width: `${Math.max(1, cueRow.widthPercent)}%`,
                  }}
                  data-testid="you-performance-cue-bar"
                  data-you-performance-cue-id={cueRow.id}
                />
              ))}
            </div>
            <ol className="mt-1.5 flex flex-col gap-1">
              {trackRow.cueRows.map((cueRow) => (
                <li
                  key={cueRow.id}
                  className="rounded-md border border-border bg-surface px-2 py-1"
                  data-testid="you-performance-cue"
                  data-you-performance-cue-id={cueRow.id}
                  data-you-performance-evidence-bound={cueRow.evidenceBound ? "true" : "false"}
                >
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                    <span className="font-mono text-ui-xs text-foreground">{cueRow.id}</span>
                    <span className="font-mono text-ui-xs text-foreground-subtle">
                      {cueRow.startMs}–{cueRow.endMs} ms
                    </span>
                    {cueRow.evidenceBound ? (
                      <Badge variant="outline" className="border-warning/40 font-mono text-ui-xs text-warning">
                        {formatMessage({ id: "you.performance.timeline.evidenceBound" })}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="min-w-0 break-all font-mono text-ui-xs text-foreground-subtle">
                      {formatMessage({ id: "you.performance.timeline.payloadRef" })}:{" "}
                      <span data-testid="you-performance-cue-payload-ref">{cueRow.payloadRef}</span>
                    </span>
                    <span className="min-w-0 break-all font-mono text-ui-xs text-foreground-subtlest">
                      {formatMessage({ id: "you.performance.timeline.payloadHash" })}:{" "}
                      <span data-testid="you-performance-cue-payload-hash">{cueRow.payloadHash}</span>
                    </span>
                  </div>
                  <span className="sr-only" data-testid="you-performance-cue-label">
                    {cueRow.accessibleLabel}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.performance.timeline.payloadHint" })}
      </p>
      {projection.evidenceBoundCueCount > 0 ? (
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.performance.timeline.evidenceHint" })}
        </p>
      ) : null}
      <div className="mt-2">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          data-testid="you-performance-draft-start"
          onClick={() =>
            binding.store.getState().startTimelineDraft(createTimelineDraft(performance))
          }
        >
          {formatMessage({ id: "you.performance.timeline.editor.start" })}
        </Button>
      </div>
    </section>
  );
}
