// YOU Avatar Studio — 具身面板（W7B）。
//
// 验收要求：九级阶梯从投影渲染（状态变化是投影事件，绝非 UI 本地状态）。会话列表
// 键盘可导航（与兄弟表面同级可用性）；visited 档由 embodiment-state-changed 事件流
// 派生；转移按钮是投射意图（服务端独立拒绝——UI 只禁用）；事件尾部显示投影事实。
import { useMemo } from "react";
import { useStore } from "zustand";
import { ActivityIcon, ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useAvatarMessages } from "@/you/useAvatarMessages.js";
import type { UseAvatarStudioBinding } from "@/you/useAvatarStudio.js";
import {
  avatarSessionById,
  orderedAvatarSessions,
} from "@/you/avatarController.js";
import {
  clampSessionIndex,
  ladderVisitedCount,
  projectEmbodimentLadder,
  projectLadderTransitionAvailability,
  projectListRegionView,
  projectSessionEventTail,
  projectSessionRows,
  resolveAvatarKeyboardTransition,
} from "@/you/avatarStudioProjection.js";

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: "border-success/40 text-success",
  suspended: "border-warning/40 text-warning",
  closed: "border-border text-foreground-subtlest",
};

export function AvatarEmbodimentPanel({ binding }: { binding: UseAvatarStudioBinding }) {
  const { formatMessage } = useAvatarMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedSessionId = useStore(binding.store, (state) => state.selectedSessionId);
  const sessionIndex = useStore(binding.store, (state) => state.sessionIndex);

  const sessions = useMemo(() => orderedAvatarSessions(snapshot), [snapshot]);
  const rows = useMemo(() => projectSessionRows(sessions), [sessions]);
  const inspected = useMemo(
    () => avatarSessionById(snapshot, selectedSessionId) ?? sessions.at(-1) ?? null,
    [snapshot, selectedSessionId, sessions],
  );
  const ladder = useMemo(
    () => projectEmbodimentLadder(inspected, snapshot?.events ?? []),
    [inspected, snapshot],
  );
  const transitions = useMemo(
    () => projectLadderTransitionAvailability(inspected),
    [inspected],
  );
  const eventTail = useMemo(
    () => projectSessionEventTail(snapshot?.events ?? [], inspected?.id ?? null, 6),
    [snapshot, inspected],
  );
  const region = projectListRegionView(snapshot !== null, rows.length);

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const action = resolveAvatarKeyboardTransition(event.key, {
      totalSessions: rows.length,
    });
    if (action.kind === "none") return;
    event.preventDefault();
    if (action.kind === "move") {
      binding.store.getState().moveSessionIndex(action.delta);
      return;
    }
    const state = binding.store.getState();
    const target = state.snapshot?.sessions[clampSessionIndex(state.sessionIndex, rows.length)];
    if (target) {
      state.selectSession(target.id);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-avatar-embodiment"
    >
      <section aria-label={formatMessage({ id: "you.avatar.embodiment.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <ActivityIcon className="size-4 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.avatar.embodiment.title" })}
          </h3>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-avatar-session-count">
            {rows.length} {formatMessage({ id: "you.avatar.embodiment.count" })}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.embodiment.caption" })}
        </p>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.embodiment.keyboardHint" })}
        </p>
      </section>

      {region === "empty" ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-avatar-embodiment-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.avatar.embodiment.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.avatar.embodiment.emptyHint" })}
          </p>
        </div>
      ) : (
        <section
          aria-label={formatMessage({ id: "you.avatar.embodiment.sessionList" })}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <ol className="flex flex-col gap-1.5" data-testid="you-avatar-session-list">
            {rows.map((row, index) => (
              <li key={row.sessionId}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                    row.sessionId === inspected?.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-surface hover:bg-surface-hover",
                  )}
                  data-testid="you-avatar-session-row"
                  data-you-avatar-session-id={row.sessionId}
                  data-you-avatar-session-index={index}
                  onClick={() => binding.store.getState().selectSession(row.sessionId)}
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="font-mono text-ui-xs text-foreground">{row.sessionId}</span>
                    <Badge
                      variant="outline"
                      className={cn("text-ui-xs", STATUS_BADGE_CLASS[row.status] ?? "")}
                    >
                      {row.status}
                    </Badge>
                    <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
                      {formatMessage({ id: `you.avatar.embodiment.state.${row.state}` })}
                    </Badge>
                  </span>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                    <span>
                      {formatMessage({ id: "you.avatar.embodiment.bodyLabel" })}: {row.bodyId}
                    </span>
                    <span>
                      {formatMessage({ id: "you.avatar.embodiment.soulLabel" })}: {row.soulBindingId}
                    </span>
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {inspected ? (
        <>
          <section aria-label={formatMessage({ id: "you.avatar.embodiment.ladder" })}>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-mono text-ui-sm font-medium text-foreground">
                {inspected.id} · {formatMessage({ id: "you.avatar.embodiment.ladder" })}
              </h4>
              <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-avatar-ladder-visited-count">
                {ladderVisitedCount(ladder)}/{ladder.length}
              </Badge>
            </div>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.avatar.embodiment.ladderHint" })}
            </p>
            <ol className="mt-2 flex flex-col gap-1" data-testid="you-avatar-ladder">
              {ladder.map((step) => (
                <li
                  key={step.state}
                  className={cn(
                    "flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-ui-xs",
                    step.current
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : step.visited
                        ? "border-border bg-surface text-foreground-subtle"
                        : "border-border/60 bg-surface/50 text-foreground-subtlest",
                  )}
                  data-testid="you-avatar-ladder-step"
                  data-you-avatar-state={step.state}
                  data-you-avatar-current={step.current ? "true" : "false"}
                  data-you-avatar-visited={step.visited ? "true" : "false"}
                >
                  <span className="min-w-0">
                    {formatMessage({ id: `you.avatar.embodiment.state.${step.state}` })}
                  </span>
                  {step.current ? (
                    <Badge variant="outline" className="border-primary/40 text-ui-xs text-primary">
                      {formatMessage({ id: "you.avatar.embodiment.ladderCurrent" })}
                    </Badge>
                  ) : step.visited ? (
                    <Badge variant="outline" className="text-ui-xs text-foreground-subtlest">
                      {formatMessage({ id: "you.avatar.embodiment.ladderVisited" })}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-ui-xs text-foreground-subtlest">
                      {formatMessage({ id: "you.avatar.embodiment.ladderUnvisited" })}
                    </Badge>
                  )}
                  <span className="sr-only">{step.state}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label={formatMessage({ id: "you.avatar.embodiment.transitionCaption" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: `you.avatar.embodiment.state.${inspected.state}` })}
            </h4>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.avatar.embodiment.transitionCaption" })}
            </p>
            <div className="mt-2 flex flex-wrap gap-1" data-testid="you-avatar-transitions">
              {transitions.map((transition) => (
                <Button
                  key={transition.state}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-1.5 font-mono text-ui-xs"
                  disabled={transition.disabled}
                  data-testid="you-avatar-transition-button"
                  data-you-avatar-transition-to={transition.state}
                  onClick={() => {
                    void binding.run(() =>
                      binding.controller.transitionEmbodimentState({
                        sessionId: inspected.id,
                        nextState: transition.state,
                      }),
                    );
                  }}
                >
                  <ArrowRightIcon className="size-3" />
                  {formatMessage({ id: `you.avatar.embodiment.state.${transition.state}` })}
                </Button>
              ))}
            </div>
          </section>

          <section aria-label={formatMessage({ id: "you.avatar.embodiment.events" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.avatar.embodiment.events" })}
            </h4>
            {eventTail.length === 0 ? (
              <p className="mt-1 text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.avatar.embodiment.eventsNone" })}
              </p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1" data-testid="you-avatar-session-events">
                {eventTail.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-ui-xs text-foreground-subtle"
                    data-testid="you-avatar-session-event"
                    data-you-avatar-event-type={event.type}
                  >
                    <span className="text-foreground-subtlest">{event.occurredAt}</span>{" "}
                    {event.type}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
      <span className="sr-only" data-testid="you-avatar-embodiment-cursor">
        {sessionIndex}
      </span>
    </div>
  );
}
