// YOU Performance Studio — 时间线面板（W4B）。
//
// 验收要求：cue track 可视化（motion/cue/layer 分类学）、时长显示、逐 cue 的
// payload 引用（内容寻址标签，绝不内联内容）。性能列表 role=listbox 键盘完全可用
// （↑/↓/Home/End/Enter，与 Solution/Capture/Twin 表面同级语义）。时间线编辑器
// 只做确定性草稿变换；业务校验留在服务端（非法草稿 ⇒ typed YOU_TIMELINE_INVALID
// 面板，绝不静默修复）。
import { useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useStore } from "zustand";
import {
  ClapperboardIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { cn } from "@/components/lib/utils.js";
import { usePerformanceMessages } from "@/you/usePerformanceMessages.js";
import type { UsePerformanceStudioBinding } from "@/you/usePerformanceStudio.js";
import { orderedPerformances, performanceById } from "@/you/performanceController.js";
import { PerformanceTimelineInspector } from "@/you/PerformanceTimelineInspector.js";
import { PerformanceTimelineEditor } from "@/you/PerformanceTimelineEditor.js";
import {
  clampPerformanceIndex,
  resolvePerformanceKeyboardTransition,
} from "@/you/performanceStudioProjection.js";
import type { Performance } from "@zcode/shared";

export function PerformanceTimelinePanel({ binding }: { binding: UsePerformanceStudioBinding }) {
  const { formatMessage } = usePerformanceMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedPerformanceId = useStore(binding.store, (state) => state.selectedPerformanceId);
  const performanceIndex = useStore(binding.store, (state) => state.performanceIndex);
  const timelineDraft = useStore(binding.store, (state) => state.timelineDraft);
  const [busy, setBusy] = useState(false);

  const performances = useMemo(() => orderedPerformances(snapshot), [snapshot]);
  const selected = useMemo(
    () =>
      performanceById(snapshot, selectedPerformanceId) ??
      performances.at(-1) ??
      null,
    [snapshot, selectedPerformanceId, performances],
  );

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!snapshot || snapshot.performances.length === 0) return;
      const action = resolvePerformanceKeyboardTransition(event.key, {
        totalPerformances: snapshot.performances.length,
      });
      if (action.kind === "none") return;
      event.preventDefault();
      if (action.kind === "move") {
        binding.store.getState().movePerformanceIndex(action.delta);
        return;
      }
      const store = binding.store.getState();
      store.selectPerformance(store.snapshot?.performances[store.performanceIndex]?.id ?? null);
    },
    [binding, snapshot],
  );

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  const clampedIndex = clampPerformanceIndex(performanceIndex, performances.length);
  const inspected = timelineDraft ? null : selected;

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-performance-timeline"
    >
      <section aria-label={formatMessage({ id: "you.performance.timeline.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.performance.timeline.title" })}
          </h3>
          <Badge
            variant="outline"
            className="gap-1 text-ui-xs text-foreground-subtle"
            data-testid="you-performance-count"
          >
            <ClapperboardIcon className="size-3" />
            {performances.length}
          </Badge>
        </div>
        {performances.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-performance-timeline-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.performance.timeline.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.performance.timeline.emptyHint" })}
            </p>
          </div>
        ) : (
          <div
            role="listbox"
            aria-label={formatMessage({ id: "you.performance.timeline.title" })}
            tabIndex={0}
            className="mt-2 flex flex-col gap-1 outline-none focus-visible:ring-1 focus-visible:ring-brand"
            onKeyDown={handleKeyDown}
            data-testid="you-performance-list"
          >
            {performances.map((performance, index) => (
              <PerformanceRow
                key={performance.id}
                performance={performance}
                selected={selected?.id === performance.id}
                cursor={index === clampedIndex}
                onInspect={() => binding.store.getState().selectPerformance(performance.id)}
              />
            ))}
          </div>
        )}
        <p className="mt-1.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.performance.timeline.keyboardHint" })}
        </p>
      </section>

      {timelineDraft ? (
        <PerformanceTimelineEditor
          binding={binding}
          busy={busy}
          withBusy={withBusy}
          draft={timelineDraft}
        />
      ) : inspected ? (
        <PerformanceTimelineInspector
          performance={inspected}
          binding={binding}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

function PerformanceRow({
  performance,
  selected,
  cursor,
  onInspect,
}: {
  performance: Performance;
  selected: boolean;
  cursor: boolean;
  onInspect: () => void;
}) {
  const { formatMessage } = usePerformanceMessages();
  const cueCount = performance.timeline.cues.length;
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      className={cn(
        "flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border px-2 py-1.5 text-ui-xs",
        selected ? "border-brand/40 bg-brand/5" : "border-border bg-card",
        cursor && "ring-1 ring-brand/30",
      )}
      data-testid="you-performance-row"
      data-you-performance-id={performance.id}
      data-you-performance-selected={selected ? "true" : "false"}
      onClick={onInspect}
    >
      <span className="font-mono text-foreground">{performance.id}</span>
      <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
        {performance.timeline.cues.length} {formatMessage({ id: "you.performance.timeline.cues" })}
      </Badge>
      <Badge
        variant="outline"
        className="font-mono text-ui-xs text-foreground-subtle"
        data-testid="you-performance-duration"
      >
        {(performance.timeline.durationMs / 1000).toFixed(2)}s
      </Badge>
      {performance.basedOnTemplateId ? (
        <span className="text-foreground-subtlest">
          {formatMessage({ id: "you.performance.timeline.basedOnTemplate" })}:{" "}
          <span className="font-mono">{performance.basedOnTemplateId}</span>
        </span>
      ) : (
        <span className="text-foreground-subtlest">
          {formatMessage({ id: "you.performance.timeline.handEdited" })}
        </span>
      )}
      <span className="sr-only" data-testid="you-performance-row-label">
        {`${performance.id}: ${cueCount} cues, ${performance.timeline.durationMs} ms, bound to twin version ${performance.twinVersionId}`}
      </span>
    </div>
  );
}

