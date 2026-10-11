// YOU Performance Studio — 时间线草稿编辑器组件（W4B）。
//
// 只做确定性草稿变换（平移/末端调整/追加/移除——纯记录变换）；业务校验留在服务端：
// 非法草稿以 typed YOU_TIMELINE_INVALID 面板拒绝，绝不静默修复。发布产出新的
// 不可变 Performance（append-only；源记录不被改动）。从 PerformanceTimelinePanel
// 按模块内聚拆分（保持仓库 400 行纪律）。
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { FileDigitIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { usePerformanceMessages } from "@/you/usePerformanceMessages.js";
import type { UsePerformanceStudioBinding } from "@/you/usePerformanceStudio.js";
import {
  addDraftCue,
  draftToTimeline,
  projectDraftTimeline,
  removeDraftCue,
  setDraftCueEnd,
  shiftDraftCue,
  type TimelineDraft,
} from "@/you/performanceTimelineDraftModel.js";

/** 时间线草稿编辑器（确定性操作；发布走服务端校验）。 */
export function PerformanceTimelineEditor({
  binding,
  busy,
  withBusy,
  draft,
}: {
  binding: UsePerformanceStudioBinding;
  busy: boolean;
  withBusy: (operation: () => Promise<unknown>) => Promise<void>;
  draft: TimelineDraft;
}) {
  const { formatMessage } = usePerformanceMessages();
  const draftProjection = projectDraftTimeline(draft);
  return (
    <section
      aria-label={formatMessage({ id: "you.performance.timeline.editor.title" })}
      data-testid="you-performance-timeline-editor"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.performance.timeline.editor.title" })}
        </h4>
        <Badge variant="outline" className="border-warning/40 font-mono text-ui-xs text-warning">
          {formatMessage({ id: "you.performance.timeline.editor.draftBadge" })}
        </Badge>
        <Badge variant="secondary" className="font-mono text-ui-xs" data-testid="you-performance-draft-duration">
          {formatMessage({ id: "you.performance.timeline.duration" })}: {draftProjection.durationLabel}
        </Badge>
      </div>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.performance.timeline.editor.caption" })}
      </p>
      <ol className="mt-2 flex flex-col gap-1.5">
        {draft.cues.map((cue) => (
          <li
            key={cue.id}
            className="rounded-md border border-border bg-card px-2 py-1.5"
            data-testid="you-performance-draft-cue"
            data-you-performance-cue-id={cue.id}
          >
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
              <span className="font-mono text-ui-xs text-foreground">{cue.id}</span>
              <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
                {cue.track}
              </Badge>
              <span className="font-mono text-ui-xs text-foreground-subtle">
                {cue.startMs}–{cue.endMs} ms
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 px-1.5 text-ui-xs"
                onClick={() =>
                  binding.store.getState().replaceTimelineDraft(shiftDraftCue(draft, cue.id, -100))
                }
                data-testid="you-performance-draft-shift-earlier"
              >
                <MinusIcon className="size-3" />
                {formatMessage({ id: "you.performance.timeline.editor.shiftEarlier" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 px-1.5 text-ui-xs"
                onClick={() =>
                  binding.store.getState().replaceTimelineDraft(shiftDraftCue(draft, cue.id, 100))
                }
                data-testid="you-performance-draft-shift-later"
              >
                <PlusIcon className="size-3" />
                {formatMessage({ id: "you.performance.timeline.editor.shiftLater" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 px-1.5 text-ui-xs"
                onClick={() =>
                  binding.store
                    .getState()
                    .replaceTimelineDraft(setDraftCueEnd(draft, cue.id, Math.max(0, cue.endMs - 100)))
                }
                data-testid="you-performance-draft-end-earlier"
              >
                {formatMessage({ id: "you.performance.timeline.editor.endEarlier" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 px-1.5 text-ui-xs"
                onClick={() =>
                  binding.store
                    .getState()
                    .replaceTimelineDraft(setDraftCueEnd(draft, cue.id, cue.endMs + 100))
                }
                data-testid="you-performance-draft-end-later"
              >
                {formatMessage({ id: "you.performance.timeline.editor.endLater" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 px-1.5 text-ui-xs text-destructive"
                onClick={() =>
                  binding.store.getState().replaceTimelineDraft(removeDraftCue(draft, cue.id))
                }
                data-testid="you-performance-draft-remove"
              >
                <Trash2Icon className="size-3" />
                {formatMessage({ id: "you.performance.timeline.editor.remove" })}
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-ui-xs"
          onClick={() => binding.store.getState().replaceTimelineDraft(addDraftCue(draft, "motion"))}
          data-testid="you-performance-draft-add-motion"
        >
          {formatMessage({ id: "you.performance.timeline.editor.addMotion" })}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-ui-xs"
          onClick={() => binding.store.getState().replaceTimelineDraft(addDraftCue(draft, "cue"))}
          data-testid="you-performance-draft-add-cue"
        >
          {formatMessage({ id: "you.performance.timeline.editor.addCue" })}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-ui-xs"
          onClick={() => binding.store.getState().replaceTimelineDraft(addDraftCue(draft, "layer"))}
          data-testid="you-performance-draft-add-layer"
        >
          {formatMessage({ id: "you.performance.timeline.editor.addLayer" })}
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          data-testid="you-performance-draft-publish"
          onClick={() =>
            void withBusy(() =>
              binding.controller.publishPerformance({
                timeline: draftToTimeline(
                  draft,
                  `fx-timeline-edited-${draft.sourcePerformanceId}`,
                ),
              }),
            )
          }
        >
          <FileDigitIcon className="size-3.5" />
          {formatMessage({ id: "you.performance.timeline.editor.publish" })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          data-testid="you-performance-draft-discard"
          onClick={() => binding.store.getState().discardTimelineDraft()}
        >
          {formatMessage({ id: "you.performance.timeline.editor.discard" })}
        </Button>
      </div>
    </section>
  );
}
