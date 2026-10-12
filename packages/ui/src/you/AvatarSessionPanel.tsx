// YOU Avatar Studio — 会话控制面板（W7B）。
//
// 验收要求：open/suspend/resume/close 是投射意图；再附身（soul-reassign）流保持
// Body 契约显示（Body 记录跨再附身不变——body/soul 分离法则）。控件禁用是显示
// 投影（服务端独立拒绝——fail closed）；最近再附身显示 from/to Soul 对与不变 Body。
import { useMemo } from "react";
import { useStore } from "zustand";
import {
  DoorOpenIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SquareIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useAvatarMessages } from "@/you/useAvatarMessages.js";
import type { UseAvatarStudioBinding } from "@/you/useAvatarStudio.js";
import {
  avatarSessionById,
  avatarSoulBindingById,
  bodyOfSession,
  orderedAvatarSessions,
  orderedAvatarSoulBindings,
  soulBindingOfSession,
} from "@/you/avatarController.js";
import {
  projectBodyOptionRows,
  projectListRegionView,
  projectReassignmentDraftView,
  projectSessionControlAvailability,
  projectSessionRows,
  projectSoulOptionRows,
} from "@/you/avatarStudioProjection.js";

export function AvatarSessionPanel({ binding }: { binding: UseAvatarStudioBinding }) {
  const { formatMessage } = useAvatarMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedSessionId = useStore(binding.store, (state) => state.selectedSessionId);
  const reassignmentDraft = useStore(binding.store, (state) => state.reassignmentDraft);
  const lastReassignment = useStore(binding.store, (state) => state.lastReassignment);

  const sessions = useMemo(() => orderedAvatarSessions(snapshot), [snapshot]);
  const rows = useMemo(() => projectSessionRows(sessions), [sessions]);
  const inspected = useMemo(
    () => avatarSessionById(snapshot, selectedSessionId) ?? sessions.at(-1) ?? null,
    [snapshot, selectedSessionId, sessions],
  );
  const inspectedBody = useMemo(
    () => bodyOfSession(snapshot, inspected),
    [snapshot, inspected],
  );
  const currentSoul = useMemo(
    () => soulBindingOfSession(snapshot, inspected),
    [snapshot, inspected],
  );
  const souls = useMemo(() => orderedAvatarSoulBindings(snapshot), [snapshot]);
  const soulRows = useMemo(() => projectSoulOptionRows(souls), [souls]);
  const bodyRow = useMemo(
    () => (inspectedBody ? projectBodyOptionRows([inspectedBody])[0] ?? null : null),
    [inspectedBody],
  );
  const availability = useMemo(
    () => projectSessionControlAvailability(inspected),
    [inspected],
  );
  const reassignView = useMemo(
    () =>
      projectReassignmentDraftView(reassignmentDraft, currentSoul?.id ?? null),
    [reassignmentDraft, currentSoul],
  );
  const region = projectListRegionView(snapshot !== null, rows.length);
  const targetSoul = useMemo(
    () => avatarSoulBindingById(snapshot, reassignmentDraft.toSoulBindingId),
    [snapshot, reassignmentDraft],
  );

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  const runControl = (operation: () => Promise<unknown>) => {
    if (!inspected) return;
    void binding.run(operation);
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-avatar-session"
    >
      <section aria-label={formatMessage({ id: "you.avatar.session.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <DoorOpenIcon className="size-4 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.avatar.session.title" })}
          </h3>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.session.caption" })}
        </p>
      </section>

      {region === "empty" ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-avatar-session-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.avatar.session.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.avatar.session.emptyHint" })}
          </p>
        </div>
      ) : inspected ? (
        <>
          <section aria-label={formatMessage({ id: "you.avatar.session.controls" })}>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-mono text-ui-sm font-medium text-foreground">{inspected.id}</h4>
              <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
                {inspected.status}
              </Badge>
              <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
                {formatMessage({ id: `you.avatar.embodiment.state.${inspected.state}` })}
              </Badge>
            </div>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.avatar.session.controls" })}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" data-testid="you-avatar-session-controls">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-ui-xs"
                disabled={!availability.canSuspend}
                data-testid="you-avatar-suspend"
                onClick={() =>
                  runControl(() =>
                    binding.controller.suspendSession({ sessionId: inspected.id }),
                  )
                }
              >
                <PauseIcon className="size-3" />
                {formatMessage({ id: "you.avatar.session.suspend" })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-ui-xs"
                disabled={!availability.canResume}
                data-testid="you-avatar-resume"
                onClick={() =>
                  runControl(() =>
                    binding.controller.resumeSession({ sessionId: inspected.id }),
                  )
                }
              >
                <PlayIcon className="size-3" />
                {formatMessage({ id: "you.avatar.session.resume" })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-ui-xs"
                disabled={!availability.canClose}
                data-testid="you-avatar-close"
                onClick={() =>
                  runControl(() =>
                    binding.controller.closeSession({ sessionId: inspected.id }),
                  )
                }
              >
                <SquareIcon className="size-3" />
                {formatMessage({ id: "you.avatar.session.close" })}
              </Button>
            </div>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.avatar.session.suspendCaption" })}{" "}
              {formatMessage({ id: "you.avatar.session.resumeCaption" })}{" "}
              {formatMessage({ id: "you.avatar.session.closeCaption" })}
            </p>
          </section>

          {/* -- re-possession (soul reassign) -- */}
          <section aria-label={formatMessage({ id: "you.avatar.session.reassign.title" })}>
            <div className="flex flex-wrap items-center gap-2">
              <RepeatIcon className="size-4 text-foreground-subtle" />
              <h4 className="text-ui-sm font-medium text-foreground">
                {formatMessage({ id: "you.avatar.session.reassign.title" })}
              </h4>
            </div>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.avatar.session.reassign.caption" })}
            </p>
            <div className="mt-2 flex flex-col gap-1.5" data-testid="you-avatar-reassign-form">
              <select
                className="h-7 rounded-md border border-border bg-surface px-2 font-mono text-ui-xs text-foreground"
                value={reassignmentDraft.sessionId ?? ""}
                onChange={(event) =>
                  binding.store.getState().beginReassignment(event.target.value || null)
                }
                data-testid="you-avatar-reassign-session-select"
              >
                <option value="">
                  {formatMessage({ id: "you.avatar.session.reassign.disabled.no-session" })}
                </option>
                {rows.map((row) => (
                  <option key={row.sessionId} value={row.sessionId}>
                    {row.sessionId} ({row.status})
                  </option>
                ))}
              </select>
              <select
                className="h-7 rounded-md border border-border bg-surface px-2 font-mono text-ui-xs text-foreground"
                value={reassignmentDraft.toSoulBindingId ?? ""}
                onChange={(event) =>
                  binding.store
                    .getState()
                    .setReassignmentSoul(event.target.value || null)
                }
                data-testid="you-avatar-reassign-soul-select"
              >
                <option value="">
                  {formatMessage({ id: "you.avatar.session.reassign.disabled.no-soul" })}
                </option>
                {soulRows.map((row) => (
                  <option key={row.soulBindingId} value={row.soulBindingId}>
                    {row.soulBindingId} ({row.routingProfile})
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2.5 text-ui-xs"
                disabled={reassignView.disabledReason !== null}
                data-testid="you-avatar-reassign"
                onClick={() => {
                  if (!reassignmentDraft.sessionId || !reassignmentDraft.toSoulBindingId) {
                    return;
                  }
                  const sessionId = reassignmentDraft.sessionId;
                  void binding.run(async () => {
                    const session = await binding.controller.reassignSoul({
                      sessionId,
                      toSoulBindingId: reassignmentDraft.toSoulBindingId!,
                    });
                    // 操作性视图：from/to 事实读自最近一条 soul-reassigned 事件载荷。
                    const refreshed = await binding.controller.refresh();
                    const reassignEvent = [...refreshed.events]
                      .reverse()
                      .find(
                        (event) =>
                          event.type === "soul-reassigned" &&
                          event.subjectRef === sessionId,
                      );
                    const fromSoulBindingId = reassignEvent?.payload.fromSoulBindingId;
                    binding.store.getState().setReassignment({
                      sessionId: session.id,
                      bodyId: session.bodyId,
                      fromSoulBindingId:
                        typeof fromSoulBindingId === "string" ? fromSoulBindingId : "",
                      toSoulBindingId: session.soulBindingId,
                    });
                    binding.store.getState().beginReassignment(null);
                    return session;
                  });
                }}
              >
                <RepeatIcon className="size-3" />
                {formatMessage({ id: "you.avatar.session.reassign.apply" })}
              </Button>
              {reassignView.disabledReason !== null ? (
                <p className="text-ui-xs text-foreground-subtlest">
                  {formatMessage({
                    id: `you.avatar.session.reassign.disabled.${reassignView.disabledReason}`,
                  })}
                </p>
              ) : null}
              {reassignmentDraft.toSoulBindingId !== null && targetSoul !== null ? (
                <p className="font-mono text-ui-xs text-foreground-subtlest">
                  {formatMessage({ id: "you.avatar.session.reassign.pick" })}:{" "}
                  {targetSoul.providerKind} / {targetSoul.modelRef} /{" "}
                  {targetSoul.routingProfile}
                </p>
              ) : null}
            </div>
          </section>

          {/* -- Body contract (preserved across re-possession) -- */}
          {bodyRow ? (
            <section aria-label={formatMessage({ id: "you.avatar.session.bodyContract.title" })}>
              <h4 className="text-ui-sm font-medium text-foreground">
                {formatMessage({ id: "you.avatar.session.bodyContract.title" })}
              </h4>
              <p className="mt-1 text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.avatar.session.bodyContract.caption" })}
              </p>
              <dl
                className="mt-2 flex flex-col gap-1 rounded-lg border border-border bg-surface p-2 font-mono text-ui-xs text-foreground-subtle"
                data-testid="you-avatar-body-contract"
                data-you-avatar-body-id={bodyRow.bodyId}
              >
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.configuration.bodies.role" })}:
                  </dt>
                  <dd>{bodyRow.role}</dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.configuration.bodies.capabilities" })}:
                  </dt>
                  <dd>{bodyRow.capabilities.join(", ")}</dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.configuration.bodies.tools" })}:
                  </dt>
                  <dd>{bodyRow.tools.join(", ")}</dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.session.bodyContract.appearance" })}:
                  </dt>
                  <dd className="break-all">
                    {bodyRow.appearanceRef ?? formatMessage({ id: "you.avatar.session.bodyContract.appearanceNone" })}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.configuration.bodies.memoryContract" })}:
                  </dt>
                  <dd className="break-all">{bodyRow.memoryContractRef}</dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.configuration.bodies.evaluatorContract" })}:
                  </dt>
                  <dd className="break-all">{bodyRow.evaluatorContractRef}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {/* -- last re-possession view -- */}
          <section aria-label={formatMessage({ id: "you.avatar.session.reassignment.last.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.avatar.session.reassignment.last.title" })}
            </h4>
            {lastReassignment ? (
              <dl
                className="mt-2 flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/5 p-2 font-mono text-ui-xs text-foreground-subtle"
                data-testid="you-avatar-last-reassignment"
              >
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.session.reassignment.last.session" })}:
                  </dt>
                  <dd>{lastReassignment.sessionId}</dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.session.reassignment.last.body" })}:
                  </dt>
                  <dd>{lastReassignment.bodyId}</dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.session.reassignment.last.from" })}:
                  </dt>
                  <dd>{lastReassignment.fromSoulBindingId}</dd>
                </div>
                <div className="flex flex-wrap gap-x-1.5">
                  <dt className="text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.session.reassignment.last.to" })}:
                  </dt>
                  <dd>{lastReassignment.toSoulBindingId}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-1 text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.avatar.session.reassignment.last.none" })}
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.session.noneSelected" })}
        </p>
      )}
      <span className={cn("sr-only")} data-testid="you-avatar-session-panel-quiet">
        {currentSoul?.id ?? ""}
      </span>
    </div>
  );
}
