// YOU Editing Studio — 变更集提议面板（W5B）。
//
// 验收要求：op 列表带内容寻址 payload 标签（绝不内联内容）+ 候选版本对 parent 的
// 确定性预览 + 提议/应用操作。全部操作走 controller 端口（服务端校验 ⇒ typed 错误
// 面板）；草稿是纯视图模型（editingOpDraftModel）。提议目标 parent 可选（subject 根
// 或先前候选——谱系嵌套）。
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { PlusIcon, TrashIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEditingMessages } from "@/you/useEditingMessages.js";
import type { UseEditingStudioBinding } from "@/you/useEditingStudio.js";
import { orderedEditingSessions, type CandidatePreview } from "@/you/editingController.js";
import { projectOpRows } from "@/you/editingStudioProjection.js";
import {
  appendDraftOp,
  opKindOptions,
  removeLastDraftOp,
  setPendingOpKind,
} from "@/you/editingOpDraftModel.js";

export function EditingChangeSetPanel({ binding }: { binding: UseEditingStudioBinding }) {
  const { formatMessage } = useEditingMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedSessionId = useStore(binding.store, (state) => state.selectedSessionId);
  const opDraft = useStore(binding.store, (state) => state.opDraft);
  const parentVersionId = useStore(binding.store, (state) => state.parentVersionId);
  const selectedChangeSetId = useStore(binding.store, (state) => state.selectedChangeSetId);
  const [busy, setBusy] = useState(false);

  const sessions = useMemo(() => orderedEditingSessions(snapshot), [snapshot]);
  const inspectedSession = useMemo(
    () =>
      sessions.find((session) => session.id === selectedSessionId) ??
      sessions.at(-1) ??
      null,
    [sessions, selectedSessionId],
  );
  const inspectedChangeSet = useMemo(
    () =>
      snapshot?.changeSets.find((changeSet) => changeSet.id === selectedChangeSetId) ??
      snapshot?.changeSets.at(-1) ??
      null,
    [snapshot, selectedChangeSetId],
  );

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  // parent 候选项：subject 根 + 已有候选（谱系嵌套；确定性：subject 先、候选按追加序）。
  const parentOptions = [
    ...(snapshot?.subjects ?? []).map((subject) => ({
      id: subject.id,
      label: subject.displayName,
      kind: "subject-root" as const,
    })),
    ...(snapshot?.candidates ?? []).map((candidate) => ({
      id: candidate.id,
      label: `candidate ${candidate.id}`,
      kind: "candidate" as const,
    })),
  ];
  const effectiveParent = parentVersionId ?? snapshot?.subjects[0]?.id ?? null;

  // 确定性候选预览：纯投影（不分配 id、不推进时钟、不落账）——草稿/parent 变化即
  // 重算（异步端口调用，取消安全）。
  const [preview, setPreview] = useState<CandidatePreview | null>(null);
  const opsForPreview = opDraft.ops;
  useEffect(() => {
    let cancelled = false;
    if (opsForPreview.length === 0 || !effectiveParent || !snapshot) {
      setPreview(null);
      return () => {
        cancelled = true;
      };
    }
    void binding.controller
      .previewCandidate({ parentVersionId: effectiveParent, ops: opsForPreview })
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [binding.controller, opsForPreview, effectiveParent, snapshot]);

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  const draftOpRows = projectOpRows(opDraft.ops);
  const proposeDisabledReason =
    opDraft.ops.length === 0
      ? formatMessage({ id: "you.editing.changesets.proposeDisabledNoOps" })
      : !inspectedSession || inspectedSession.status !== "open"
        ? formatMessage({ id: "you.editing.changesets.proposeDisabledNoSession" })
        : null;
  const applyDisabledReason = !inspectedChangeSet
    ? formatMessage({ id: "you.editing.changesets.applyDisabledNoChangeSet" })
    : null;

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-editing-changesets"
    >
      <section aria-label={formatMessage({ id: "you.editing.changesets.composer.title" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.editing.changesets.composer.title" })}
        </h3>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.editing.changesets.composer.hint" })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="you-editing-op-composer">
          <div className="flex flex-wrap gap-1" data-testid="you-editing-op-kind-options">
            {opKindOptions().map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-6 px-2 text-ui-xs",
                  opDraft.pendingKind === kind && "border-primary/60 bg-primary/10 text-primary",
                )}
                data-testid="you-editing-op-kind-option"
                data-you-editing-op-kind={kind}
                aria-pressed={opDraft.pendingKind === kind}
                onClick={() =>
                  binding.store.getState().replaceOpDraft(setPendingOpKind(opDraft, kind))
                }
              >
                {kind}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            className="h-6 px-2 text-ui-xs"
            disabled={opDraft.pendingKind === null}
            data-testid="you-editing-op-append"
            onClick={() => binding.store.getState().replaceOpDraft(appendDraftOp(opDraft))}
          >
            <PlusIcon className="size-3" />
            {formatMessage({ id: "you.editing.changesets.composer.add" })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-ui-xs"
            disabled={opDraft.ops.length === 0}
            data-testid="you-editing-op-remove"
            onClick={() => binding.store.getState().replaceOpDraft(removeLastDraftOp(opDraft))}
          >
            <TrashIcon className="size-3" />
            {formatMessage({ id: "you.editing.changesets.composer.remove" })}
          </Button>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-editing-op-count">
            {opDraft.ops.length} {formatMessage({ id: "you.editing.changesets.composer.opCount" })}
          </Badge>
        </div>
      </section>

      <section aria-label={formatMessage({ id: "you.editing.changesets.ops.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.editing.changesets.ops.title" })}
        </h4>
        {draftOpRows.length === 0 ? (
          <p className="mt-1 text-ui-xs text-foreground-subtle" data-testid="you-editing-op-list-empty">
            {formatMessage({ id: "you.editing.changesets.ops.empty" })}
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1" data-testid="you-editing-op-list">
            {draftOpRows.map((row) => (
              <li
                key={row.opId}
                className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-2"
                data-testid="you-editing-op-row"
                data-you-editing-op-id={row.opId}
                data-you-editing-op-kind={row.kind}
              >
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-mono text-ui-xs text-foreground-subtlest">#{row.index + 1}</span>
                  <Badge variant="secondary" className="text-ui-xs">{row.kind}</Badge>
                  <span className="font-mono text-ui-xs text-foreground-subtle">{row.opId}</span>
                </span>
                {/* 内容寻址 payload 标签（payloadRef + payloadHash）——内容绝不内联。 */}
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                  <span>
                    {formatMessage({ id: "you.editing.changesets.ops.payload" })}: {row.payloadRef}
                  </span>
                  <span>
                    {formatMessage({ id: "you.editing.changesets.ops.payloadHash" })}: {row.payloadHash}
                  </span>
                </span>
                <span className="sr-only">{row.accessibleLabel}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label={formatMessage({ id: "you.editing.changesets.preview.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.editing.changesets.preview.title" })}
        </h4>
        {preview ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-2" data-testid="you-editing-candidate-preview">
            <p className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
              <span>
                {formatMessage({ id: "you.editing.changesets.preview.parentHash" })}:{" "}
                {preview.parentContentHash ?? "unknown"}
              </span>
              <span>
                {formatMessage({ id: "you.editing.changesets.preview.digest" })}: {preview.previewDigest}
              </span>
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.editing.changesets.preview.caption" })}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-ui-xs text-foreground-subtle" data-testid="you-editing-candidate-preview-empty">
            {formatMessage({ id: "you.editing.changesets.preview.empty" })}
          </p>
        )}
      </section>

      <section aria-label={formatMessage({ id: "you.editing.changesets.parent" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.editing.changesets.parent" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.editing.changesets.parentHint" })}
        </p>
        <div className="mt-2 flex flex-wrap gap-1" data-testid="you-editing-parent-options">
          {parentOptions.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-6 max-w-64 truncate px-2 text-ui-xs",
                effectiveParent === option.id && "border-primary/60 bg-primary/10 text-primary",
              )}
              data-testid="you-editing-parent-option"
              data-you-editing-parent-id={option.id}
              data-you-editing-parent-kind={option.kind}
              aria-pressed={effectiveParent === option.id}
              onClick={() => binding.store.getState().setParentVersionId(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </section>

      <section aria-label={formatMessage({ id: "you.editing.changesets.propose" })}>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-6 px-2 text-ui-xs"
            disabled={busy || proposeDisabledReason !== null}
            title={proposeDisabledReason ?? undefined}
            data-testid="you-editing-changeset-propose"
            onClick={() => {
              if (!inspectedSession) return;
              void withBusy(() =>
                binding.controller.proposeChangeSet({
                  sessionId: inspectedSession.id,
                  ops: opDraft.ops,
                }),
              );
            }}
          >
            {formatMessage({ id: "you.editing.changesets.propose" })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-ui-xs"
            disabled={busy || applyDisabledReason !== null || !effectiveParent}
            title={applyDisabledReason ?? undefined}
            data-testid="you-editing-changeset-apply"
            onClick={() => {
              if (!inspectedChangeSet || !effectiveParent) return;
              void withBusy(() =>
                binding.controller.applyChangeSet({
                  changeSetId: inspectedChangeSet.id,
                  parentVersionId: effectiveParent,
                }),
              );
            }}
          >
            {formatMessage({ id: "you.editing.changesets.apply" })}
          </Button>
        </div>
        {inspectedChangeSet ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-2" data-testid="you-editing-changeset-inspected">
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-ui-xs text-foreground-subtle">
              <span className="font-mono text-foreground">{inspectedChangeSet.id}</span>
              <span>
                · {inspectedChangeSet.ops.length}{" "}
                {formatMessage({ id: "you.editing.changesets.composer.opCount" })}
              </span>
              <span>· {inspectedChangeSet.createdAt}</span>
            </p>
            <p className="mt-1 text-ui-xs font-medium text-foreground-subtle">
              {formatMessage({ id: "you.editing.changesets.opsOfSelected" })}
            </p>
            <ol className="mt-1 flex flex-col gap-0.5">
              {projectOpRows(inspectedChangeSet.ops).map((row) => (
                <li
                  key={row.opId}
                  className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle"
                  data-testid="you-editing-recorded-op-row"
                >
                  <span>
                    #{row.index + 1} {row.kind}
                  </span>
                  <span>{row.payloadRef}</span>
                  <span>({row.payloadHash})</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-editing-changesets-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.editing.changesets.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.editing.changesets.emptyHint" })}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
