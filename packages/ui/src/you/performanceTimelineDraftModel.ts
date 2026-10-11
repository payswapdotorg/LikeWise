// YOU Performance Studio — 时间线草稿编辑模型（W4B）。
//
// 确定性草稿变换：视图层的时间线编辑（平移/末端调整/追加/移除）全部是纯记录变换，
// 不含业务校验——合法性由服务端 stateless 校验裁决（非法草稿以 typed
// YOU_TIMELINE_INVALID 拒绝，绝不静默修复）。draftToTimeline 产出契约形状的
// PerformanceTimeline（cues 按 startMs 排序；durationMs = 最大 endMs 精确一致）。
import type { Performance, PerformanceTimeline } from "@zcode/shared";
import { projectTimeline, type TimelineProjection } from "./performanceStudioProjection.js";
import { storyboardDraftPayloadAddress } from "./performanceStoryboard.js";

export interface TimelineDraftCue {
  readonly id: string;
  readonly track: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly payloadRef: string;
  readonly payloadHash: string;
}

export interface TimelineDraft {
  readonly cues: readonly TimelineDraftCue[];
  /** 草稿来源性能（发布后生成新的不可变 Performance）。 */
  readonly sourcePerformanceId: string;
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function recomputeDurationMs(cues: readonly TimelineDraftCue[]): number {
  return cues.reduce((max, cue) => Math.max(max, cue.endMs), 0);
}

/** 从性能时间线创建草稿（深拷贝；原记录不被改动）。 */
export function createTimelineDraft(performance: Performance): TimelineDraft {
  return {
    cues: performance.timeline.cues.map((cue) => ({ ...cue })),
    sourcePerformanceId: performance.id,
  };
}

/** 草稿 → 契约时间线（cues 按 startMs 再按 id 排序；durationMs = 最大 endMs）。 */
export function draftToTimeline(
  draft: TimelineDraft,
  timelineId: string,
): PerformanceTimeline {
  const cues = [...draft.cues]
    .sort((a, b) => (a.startMs !== b.startMs ? a.startMs - b.startMs : compareId(a.id, b.id)))
    .map((cue) => ({ ...cue }));
  return {
    id: timelineId,
    cues,
    durationMs: recomputeDurationMs(cues),
  };
}

/** 平移 cue（start/end 同增减；start 夹 ≥ 0；end 随 start 平移保持时长）。 */
export function shiftDraftCue(
  draft: TimelineDraft,
  cueId: string,
  deltaMs: number,
): TimelineDraft {
  return {
    ...draft,
    cues: draft.cues.map((cue) => {
      if (cue.id !== cueId) return cue;
      const nextStart = Math.max(0, cue.startMs + deltaMs);
      const duration = cue.endMs - cue.startMs;
      return { ...cue, startMs: nextStart, endMs: nextStart + duration };
    }),
  };
}

/** 调整 cue 末端（允许任意 ≥ 0 的值——非法时长由服务端 typed 拒绝）。 */
export function setDraftCueEnd(
  draft: TimelineDraft,
  cueId: string,
  endMs: number,
): TimelineDraft {
  return {
    ...draft,
    cues: draft.cues.map((cue) =>
      cue.id === cueId ? { ...cue, endMs: Math.max(0, endMs) } : cue,
    ),
  };
}

/** 追加 cue（确定性：置于该轨道末 cue 之后；payload 内容寻址派生自序号）。 */
export function addDraftCue(
  draft: TimelineDraft,
  track: string,
): TimelineDraft {
  const ordinal = draft.cues.length + 1;
  const trackEnd = draft.cues
    .filter((cue) => cue.track === track)
    .reduce((max, cue) => Math.max(max, cue.endMs), 0);
  const address = storyboardDraftPayloadAddress(track, ordinal);
  const cue: TimelineDraftCue = {
    id: `fx-cue-draft-${ordinal}`,
    track,
    startMs: trackEnd,
    endMs: trackEnd + 1000,
    ...address,
  };
  return { ...draft, cues: [...draft.cues, cue] };
}

/** 移除 cue（幂等：未知 id 无变化）。 */
export function removeDraftCue(
  draft: TimelineDraft,
  cueId: string,
): TimelineDraft {
  return { ...draft, cues: draft.cues.filter((cue) => cue.id !== cueId) };
}

/** 草稿投影（复用 projectTimeline 的轨道视图数学）。 */
export function projectDraftTimeline(draft: TimelineDraft | null): TimelineProjection {
  if (!draft) {
    return projectTimeline(null);
  }
  return projectTimeline(
    draftToTimeline(draft, `fx-timeline-draft-${draft.sourcePerformanceId}`),
  );
}
