// YOU Editing Studio — 会话面板（W5B）。
//
// 验收要求：subject-artifact 选择器 + 会话状态阶梯（open/committed/abandoned）
// 全部由 controller 投影渲染——UI 零业务逻辑（W1B/W2B/W3B/W4B controller 模式；
// T5 换绑前由模拟控制器支撑）。subject/editorKind 选项来自快照注册表投影（非 UI
// 硬编码）；终态锁定、非法迁移 typed 拒绝全部在服务端语义内。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEditingMessages } from "@/you/useEditingMessages.js";
import type { UseEditingStudioBinding } from "@/you/useEditingStudio.js";
import { orderedEditingSessions } from "@/you/editingController.js";
import {
  clampSessionIndex,
  projectSessionLadder,
  resolveEditingKeyboardTransition,
} from "@/you/editingStudioProjection.js";
import type { EditingStudioSnapshot } from "@/you/editingController.js";
import type { EditorKind } from "@zcode/shared";

export function EditingSessionsPanel({ binding }: { binding: UseEditingStudioBinding }) {
  const { formatMessage } = useEditingMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedSessionId = useStore(binding.store, (state) => state.selectedSessionId);
  const sessionIndex = useStore(binding.store, (state) => state.sessionIndex);
  const selectedSubjectId = useStore(binding.store, (state) => state.selectedSubjectId);
  const selectedEditorKind = useStore(binding.store, (state) => state.selectedEditorKind);
  const [busy, setBusy] = useState(false);

  const sessions = useMemo(() => orderedEditingSessions(snapshot), [snapshot]);
  const inspected = useMemo(
    () =>
      sessions.find((session) => session.id === selectedSessionId) ??
      sessions.at(-1) ??
      null,
    [sessions, selectedSessionId],
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

  const openDisabledReason = !selectedSubjectId
    ? formatMessage({ id: "you.editing.sessions.openDisabledNoSubject" })
    : !selectedEditorKind
      ? formatMessage({ id: "you.editing.sessions.openDisabledNoEditor" })
      : null;

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-editing-sessions"
      onKeyDown={(event) => {
        // 键盘导航 = 一等交互路径（与 Solution/Capture/Twin/Performance 表面同款）。
        const action = resolveEditingKeyboardTransition(event.key, {
          totalSessions: sessions.length,
        });
        if (action.kind === "move") {
          event.preventDefault();
          binding.store.getState().moveSessionIndex(action.delta);
        } else if (action.kind === "select" && inspected) {
          event.preventDefault();
          binding.store.getState().selectSession(inspected.id);
        }
      }}
    >
      <SubjectPickerSection
        snapshot={snapshot}
        selectedSubjectId={selectedSubjectId}
        onSelect={(subjectId) => binding.store.getState().selectSubject(subjectId)}
      />
      <EditorKindSection
        snapshot={snapshot}
        selectedEditorKind={selectedEditorKind}
        onSelect={(kind) => binding.store.getState().selectEditorKind(kind)}
      />
      <section aria-label={formatMessage({ id: "you.editing.sessions.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.editing.sessions.title" })}
          </h3>
          <Badge
            variant="outline"
            className="text-ui-xs text-foreground-subtle"
            data-testid="you-editing-sessions-count"
          >
            {sessions.length}
          </Badge>
          <Button
            type="button"
            size="sm"
            className="ml-auto h-6 px-2 text-ui-xs"
            disabled={busy || openDisabledReason !== null}
            title={openDisabledReason ?? undefined}
            data-testid="you-editing-session-open"
            onClick={() => {
              if (!selectedSubjectId || !selectedEditorKind) return;
              void withBusy(() =>
                binding.controller.openSession({
                  subjectArtifactId: selectedSubjectId,
                  editorKind: selectedEditorKind as EditorKind,
                }),
              );
            }}
          >
            {formatMessage({ id: "you.editing.sessions.open" })}
          </Button>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.editing.sessions.terminalHint" })}
        </p>
        {sessions.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-editing-sessions-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.editing.sessions.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.editing.sessions.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol
            className="mt-2 flex flex-col gap-1.5"
            data-testid="you-editing-session-list"
            tabIndex={0}
          >
            {sessions.map((session, index) => {
              const isCursor = index === clampSessionIndex(sessionIndex, sessions.length);
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                      session.id === inspected?.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-surface hover:bg-surface-hover",
                    )}
                    data-testid="you-editing-session-row"
                    data-you-editing-session-id={session.id}
                    data-you-editing-session-status={session.status}
                    data-you-editing-session-cursor={isCursor ? "true" : "false"}
                    onClick={() => binding.store.getState().selectSession(session.id)}
                  >
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="font-mono text-ui-xs text-foreground">{session.id}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-ui-xs",
                          session.status === "open"
                            ? "border-primary/40 text-primary"
                            : session.status === "committed"
                              ? "border-success/40 text-success"
                              : "border-muted-foreground/40 text-foreground-subtle",
                        )}
                      >
                        {formatMessage({ id: `you.editing.sessions.status.${session.status}` })}
                      </Badge>
                      <span className="font-mono text-ui-xs text-foreground-subtlest">
                        {String(session.editorKind)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-baseline gap-x-1.5 text-ui-xs text-foreground-subtle">
                      <span>{formatMessage({ id: "you.editing.sessions.subject" })}:</span>
                      <span className="font-mono">{session.subjectArtifactId}</span>
                      <span>· {formatMessage({ id: "you.editing.sessions.openedAt" })}:</span>
                      <span className="font-mono">{session.openedAt}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.editing.sessions.keyboardHint" })}
        </p>
      </section>
      {inspected ? <SessionLadderSection binding={binding} inspected={inspected} busy={busy} withBusy={withBusy} /> : null}
    </div>
  );
}

function SubjectPickerSection({
  snapshot,
  selectedSubjectId,
  onSelect,
}: {
  snapshot: EditingStudioSnapshot;
  selectedSubjectId: string | null;
  onSelect: (subjectId: string) => void;
}) {
  const { formatMessage } = useEditingMessages();
  return (
    <section aria-label={formatMessage({ id: "you.editing.sessions.subject" })}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.editing.sessions.subject" })}
        </h4>
        <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-editing-subject-count">
          {snapshot.subjects.length}
        </Badge>
      </div>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.editing.sessions.subjectHint" })}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5" data-testid="you-editing-subject-options">
        {snapshot.subjects.map((subject) => {
          const selected = subject.id === selectedSubjectId;
          return (
            <li key={subject.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-lg border p-2 text-left transition-colors",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface hover:bg-surface-hover",
                )}
                data-testid="you-editing-subject-option"
                data-you-editing-subject-id={subject.id}
                aria-pressed={selected}
                onClick={() => onSelect(subject.id)}
              >
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-ui-sm text-foreground">{subject.displayName}</span>
                  <span className="font-mono text-ui-xs text-foreground-subtlest">{subject.id}</span>
                  <Badge variant="outline" className="ml-auto text-ui-xs text-foreground-subtle">
                    {subject.originPlane}
                  </Badge>
                </span>
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                  <span>
                    {formatMessage({ id: "you.editing.sessions.contentRef" })}: {subject.contentRef}
                  </span>
                  <span>
                    {formatMessage({ id: "you.editing.sessions.contentHash" })}: {subject.contentHash}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EditorKindSection({
  snapshot,
  selectedEditorKind,
  onSelect,
}: {
  snapshot: EditingStudioSnapshot;
  selectedEditorKind: string | null;
  onSelect: (kind: string) => void;
}) {
  const { formatMessage } = useEditingMessages();
  return (
    <section aria-label={formatMessage({ id: "you.editing.sessions.editorKind" })}>
      <h4 className="text-ui-sm font-medium text-foreground">
        {formatMessage({ id: "you.editing.sessions.editorKind" })}
      </h4>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.editing.sessions.editorKindHint" })}
      </p>
      <div className="mt-2 flex flex-wrap gap-1" data-testid="you-editing-editor-kind-options">
        {snapshot.editorProfiles.map((profile) => {
          const selected = profile.editorKind === selectedEditorKind;
          return (
            <Button
              key={profile.id}
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-6 px-2 text-ui-xs",
                selected && "border-primary/60 bg-primary/10 text-primary",
              )}
              data-testid="you-editing-editor-kind-option"
              data-you-editing-editor-kind={profile.editorKind}
              aria-pressed={selected}
              onClick={() => onSelect(profile.editorKind)}
            >
              {formatMessage({ id: `you.editing.editors.kind.${profile.editorKind}` }) !==
              `you.editing.editors.kind.${profile.editorKind}`
                ? formatMessage({ id: `you.editing.editors.kind.${profile.editorKind}` })
                : String(profile.editorKind)}
            </Button>
          );
        })}
      </div>
    </section>
  );
}

function SessionLadderSection({
  binding,
  inspected,
  busy,
  withBusy,
}: {
  binding: UseEditingStudioBinding;
  inspected: { readonly id: string; readonly status: "open" | "committed" | "abandoned" };
  busy: boolean;
  withBusy: (operation: () => Promise<unknown>) => Promise<void>;
}) {
  const { formatMessage } = useEditingMessages();
  const ladder = projectSessionLadder(inspected.status);
  return (
    <section aria-label={formatMessage({ id: "you.editing.sessions.ladder" })}>
      <h4 className="text-ui-sm font-medium text-foreground">
        {formatMessage({ id: "you.editing.sessions.ladder" })}
      </h4>
      <ol className="mt-2 flex flex-wrap gap-1.5" data-testid="you-editing-session-ladder">
        {ladder.map((step) => (
          <li
            key={step.status}
            className={cn(
              "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-ui-xs",
              step.current
                ? "border-primary/50 bg-primary/10 text-primary"
                : step.reached
                  ? "border-success/30 bg-success/5 text-foreground-subtle"
                  : "border-border bg-surface text-foreground-subtlest",
            )}
            data-testid="you-editing-session-ladder-step"
            data-you-editing-ladder-status={step.status}
            data-you-editing-ladder-current={step.current ? "true" : "false"}
            data-you-editing-ladder-reached={step.reached ? "true" : "false"}
          >
            {step.reached && !step.current ? (
              step.status === "open" ? (
                <CheckCircle2Icon className="size-3 text-success" />
              ) : null
            ) : null}
            {formatMessage({ id: `you.editing.sessions.status.${step.status}` })}
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-6 px-2 text-ui-xs"
          disabled={busy || inspected.status !== "open"}
          data-testid="you-editing-session-commit"
          onClick={() => void withBusy(() => binding.controller.commitSession({ sessionId: inspected.id }))}
        >
          <CheckCircle2Icon className="size-3" />
          {formatMessage({ id: "you.editing.sessions.commit" })}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-6 px-2 text-ui-xs"
          disabled={busy || inspected.status !== "open"}
          data-testid="you-editing-session-abandon"
          onClick={() => void withBusy(() => binding.controller.abandonSession({ sessionId: inspected.id }))}
        >
          <XCircleIcon className="size-3" />
          {formatMessage({ id: "you.editing.sessions.abandon" })}
        </Button>
      </div>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.editing.sessions.commitCaption" })}
      </p>
    </section>
  );
}
