// YOU Avatar Studio — Realtime 信道面板（W7B）。
//
// 验收要求：RealtimeChannelDescriptor 面板（内容寻址流标签 + latency class）。
// 流内容绝不内联——仅 streamRef/streamHash 标签；真实信道构造归 W7C 车道
//（此处为确定性 fixture 派生的只读投影）。
import { useMemo } from "react";
import { useStore } from "zustand";
import { RadioIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { cn } from "@/components/lib/utils.js";
import { useAvatarMessages } from "@/you/useAvatarMessages.js";
import type { UseAvatarStudioBinding } from "@/you/useAvatarStudio.js";
import {
  avatarChannelsOfSession,
  avatarSessionById,
  orderedAvatarSessions,
} from "@/you/avatarController.js";
import {
  projectChannelPanelRows,
  projectListRegionView,
  projectSessionRows,
} from "@/you/avatarStudioProjection.js";

export function AvatarRealtimePanel({ binding }: { binding: UseAvatarStudioBinding }) {
  const { formatMessage } = useAvatarMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedSessionId = useStore(binding.store, (state) => state.selectedSessionId);

  const sessions = useMemo(() => orderedAvatarSessions(snapshot), [snapshot]);
  const rows = useMemo(() => projectSessionRows(sessions), [sessions]);
  const inspected = useMemo(
    () => avatarSessionById(snapshot, selectedSessionId) ?? sessions.at(-1) ?? null,
    [snapshot, selectedSessionId, sessions],
  );
  const channels = useMemo(
    () => avatarChannelsOfSession(snapshot, inspected?.id ?? null),
    [snapshot, inspected],
  );
  const channelRows = useMemo(() => projectChannelPanelRows(channels), [channels]);
  const region = projectListRegionView(snapshot !== null, channelRows.length);

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
      data-testid="you-avatar-realtime"
    >
      <section aria-label={formatMessage({ id: "you.avatar.realtime.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <RadioIcon className="size-4 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.avatar.realtime.title" })}
          </h3>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-avatar-channel-count">
            {channelRows.length} {formatMessage({ id: "you.avatar.realtime.count" })}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.realtime.caption" })}
        </p>
      </section>

      {inspected ? (
        <section aria-label={formatMessage({ id: "you.avatar.realtime.ofSession" })}>
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.avatar.realtime.ofSession" })}
            </h4>
            <span className="font-mono text-ui-xs text-foreground-subtle">{inspected.id}</span>
            <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
              {inspected.status}
            </Badge>
          </div>
          <ol className="mt-1.5 flex flex-wrap gap-1" data-testid="you-avatar-session-picker">
            {rows.map((row) => (
              <li key={row.sessionId}>
                <button
                  type="button"
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 font-mono text-ui-xs transition-colors",
                    row.sessionId === inspected.id
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border bg-surface text-foreground-subtle hover:bg-surface-hover",
                  )}
                  data-testid="you-avatar-realtime-session-chip"
                  data-you-avatar-session-id={row.sessionId}
                  onClick={() => binding.store.getState().selectSession(row.sessionId)}
                >
                  {row.sessionId}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {region === "empty" ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-avatar-realtime-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.avatar.realtime.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.avatar.realtime.emptyHint" })}
          </p>
          {inspected ? (
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.avatar.realtime.noneForSession" })}
            </p>
          ) : null}
        </div>
      ) : (
        <ol className="flex flex-col gap-2" data-testid="you-avatar-channel-list">
          {channelRows.map((row) => (
            <li key={row.channelId}>
              <div
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-2"
                data-testid="you-avatar-channel-panel"
                data-you-avatar-channel-id={row.channelId}
                data-you-avatar-latency-class={row.latencyClass}
              >
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="font-mono text-ui-xs text-foreground">{row.channelId}</span>
                  <Badge variant="outline" className="border-primary/40 text-ui-xs text-primary">
                    {row.kind}
                  </Badge>
                  <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
                    {row.latencyClass}
                  </Badge>
                </span>
                <span className="break-all font-mono text-ui-xs text-foreground-subtle">
                  {formatMessage({ id: "you.avatar.realtime.channel.streamRef" })}: {row.streamRef}
                </span>
                <span className="break-all font-mono text-ui-xs text-foreground-subtlest">
                  {formatMessage({ id: "you.avatar.realtime.channel.streamHash" })}: {row.streamHash}
                </span>
                <span className="sr-only">{row.accessibleLabel}</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.avatar.realtime.latencyNote" })}
      </p>
    </div>
  );
}
