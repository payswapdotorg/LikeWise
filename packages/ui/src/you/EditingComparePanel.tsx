// YOU Editing Studio — 对比/回退面板（W5B）。
//
// 验收要求：candidate vs parent 谱系视图（root → leaf 链）+ accept/reject 投影走
// v1 change-accepted / change-rejected 事件纪律（append-only；无第二条权威路径）。
// 拒绝即回退语义——parent 保持 canonical，绝不静默变更。全部操作走 controller 端口。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { CheckIcon, GitCompareIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEditingMessages } from "@/you/useEditingMessages.js";
import type { UseEditingStudioBinding } from "@/you/useEditingStudio.js";
import {
  candidateById,
  candidateParentOf,
  candidateResolutionOf,
  lineageChainOfCandidate,
} from "@/you/editingController.js";
import { projectLineageRows } from "@/you/editingStudioProjection.js";
import type { CandidateVersion } from "@zcode/shared";

export function EditingComparePanel({ binding }: { binding: UseEditingStudioBinding }) {
  const { formatMessage } = useEditingMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedCandidateId = useStore(binding.store, (state) => state.selectedCandidateId);
  const [busy, setBusy] = useState(false);

  const inspected = useMemo(
    () =>
      candidateById(snapshot, selectedCandidateId) ??
      snapshot?.candidates.at(-1) ??
      null,
    [snapshot, selectedCandidateId],
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

  const chain = inspected ? lineageChainOfCandidate(snapshot, inspected.id) : [];
  const lineageRows = projectLineageRows(snapshot, chain);
  const resolution = inspected ? candidateResolutionOf(snapshot, inspected.id) : null;
  const parentVersionId = inspected ? candidateParentOf(snapshot, inspected.id) : null;
  const parentContentHash = parentVersionId
    ? (snapshot.subjects.find((subject) => subject.id === parentVersionId)?.contentHash ??
      snapshot.candidates.find((candidate) => candidate.id === parentVersionId)?.contentHash ??
      null)
    : null;
  const sessionOfCandidate = inspected
    ? snapshot.changeSets.find((changeSet) => changeSet.id === inspected.changeSetId)?.sessionId ?? null
    : null;
  const sessionOpen =
    sessionOfCandidate !== null &&
    snapshot.sessions.find((session) => session.id === sessionOfCandidate)?.status === "open";

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-editing-compare"
    >
      <section aria-label={formatMessage({ id: "you.editing.compare.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.editing.compare.title" })}
          </h3>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-editing-candidate-count">
            {snapshot.candidates.length}
          </Badge>
        </div>
        {snapshot.candidates.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-editing-compare-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.editing.compare.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.editing.compare.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-1" data-testid="you-editing-candidate-list">
            {snapshot.candidates.map((candidate) => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                selected={inspected?.id === candidate.id}
                resolution={candidateResolutionOf(snapshot, candidate.id)?.outcome ?? "proposed"}
                onSelect={() => binding.store.getState().selectCandidate(candidate.id)}
              />
            ))}
          </ol>
        )}
      </section>

      {inspected ? (
        <>
          <section aria-label={formatMessage({ id: "you.editing.compare.candidate" })}>
            <h4 className="flex items-center gap-1.5 text-ui-sm font-medium text-foreground">
              <GitCompareIcon className="size-3.5" />
              {formatMessage({ id: "you.editing.compare.candidate" })}: {inspected.id}
            </h4>
            <div className="mt-2 flex flex-col gap-1 rounded-lg border border-border bg-surface p-2" data-testid="you-editing-compare-detail">
              <p className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                <span>
                  {formatMessage({ id: "you.editing.compare.parent" })}: {inspected.parentVersionId}
                </span>
                <span>
                  {formatMessage({ id: "you.editing.compare.changeSet" })}: {inspected.changeSetId}
                </span>
              </p>
              <p className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                <span>
                  {formatMessage({ id: "you.editing.compare.candidateContent" })}: {inspected.contentRef}
                </span>
                <span>
                  {formatMessage({ id: "you.editing.compare.candidateHash" })}: {inspected.contentHash}
                </span>
              </p>
              <p className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                <span>
                  parent {formatMessage({ id: "you.editing.compare.candidateHash" })}:{" "}
                  {parentContentHash ?? "unknown"}
                </span>
                <span>
                  {formatMessage({ id: "you.editing.compare.proposedAt" })}: {inspected.proposedAt}
                </span>
              </p>
            </div>
          </section>

          <section aria-label={formatMessage({ id: "you.editing.compare.lineage.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.editing.compare.lineage.title" })}
            </h4>
            <ol className="mt-2 flex flex-col gap-1" data-testid="you-editing-lineage-chain">
              {lineageRows.map((row) => (
                <li
                  key={row.versionId}
                  className={cn(
                    "flex flex-wrap items-baseline gap-x-1.5 rounded-md border px-2 py-1 font-mono text-ui-xs",
                    row.kind === "subject-root"
                      ? "border-border bg-surface text-foreground-subtle"
                      : row.versionId === inspected.id
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-surface text-foreground-subtle",
                  )}
                  data-testid="you-editing-lineage-node"
                  data-you-editing-lineage-kind={row.kind}
                  data-you-editing-lineage-depth={row.depth}
                >
                  <span className="text-ui-xs">
                    {formatMessage({ id: `you.editing.compare.lineage.${row.kind}` })}
                  </span>
                  <span>{row.versionId}</span>
                  {row.contentHash ? <span className="text-foreground-subtlest">({row.contentHash})</span> : null}
                  <span className="ml-auto text-foreground-subtlest">
                    {formatMessage({ id: "you.editing.compare.lineage.depth" })} {row.depth}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label={formatMessage({ id: "you.editing.compare.resolution" })}>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-ui-sm font-medium text-foreground">
                {formatMessage({ id: "you.editing.compare.resolution" })}
              </h4>
              <Badge
                variant="outline"
                className={cn(
                  "text-ui-xs",
                  resolution?.outcome === "accepted"
                    ? "border-success/40 text-success"
                    : resolution?.outcome === "rejected"
                      ? "border-destructive/40 text-destructive"
                      : "border-muted-foreground/40 text-foreground-subtle",
                )}
                data-testid="you-editing-candidate-resolution"
                data-you-editing-resolution={resolution?.outcome ?? "proposed"}
              >
                {formatMessage({ id: `you.editing.compare.resolution.${resolution?.outcome ?? "proposed"}` })}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy || resolution?.outcome !== null || !sessionOpen}
                data-testid="you-editing-candidate-accept"
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.resolveCandidate({
                      candidateId: inspected.id,
                      outcome: "accepted",
                      reason: "ui: operator accepted the candidate",
                    }),
                  )
                }
              >
                <CheckIcon className="size-3" />
                {formatMessage({ id: "you.editing.compare.accept" })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 px-2 text-ui-xs"
                disabled={busy || resolution?.outcome !== null || !sessionOpen}
                data-testid="you-editing-candidate-reject"
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.resolveCandidate({
                      candidateId: inspected.id,
                      outcome: "rejected",
                      reason: "ui: operator rejected the candidate (revert — parent stays canonical)",
                    }),
                  )
                }
              >
                <XIcon className="size-3" />
                {formatMessage({ id: "you.editing.compare.reject" })}
              </Button>
            </div>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.editing.compare.resolutionCaption" })}
            </p>
          </section>
        </>
      ) : (
        <p className="text-ui-xs text-foreground-subtle" data-testid="you-editing-lineage-empty">
          {formatMessage({ id: "you.editing.compare.lineageEmptyHint" })}
        </p>
      )}
    </div>
  );
}

function CandidateRow({
  candidate,
  selected,
  resolution,
  onSelect,
}: {
  candidate: CandidateVersion;
  selected: boolean;
  resolution: "proposed" | "accepted" | "rejected";
  onSelect: () => void;
}) {
  const { formatMessage } = useEditingMessages();
  return (
    <li>
      <button
        type="button"
        className={cn(
          "flex w-full flex-col gap-0.5 rounded-lg border p-2 text-left transition-colors",
          selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface hover:bg-surface-hover",
        )}
        data-testid="you-editing-candidate-row"
        data-you-editing-candidate-id={candidate.id}
        data-you-editing-candidate-resolution={resolution}
        onClick={onSelect}
      >
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-mono text-ui-xs text-foreground">{candidate.id}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-ui-xs",
              resolution === "accepted"
                ? "border-success/40 text-success"
                : resolution === "rejected"
                  ? "border-destructive/40 text-destructive"
                  : "border-muted-foreground/40 text-foreground-subtle",
            )}
          >
            {formatMessage({ id: `you.editing.compare.resolution.${resolution}` })}
          </Badge>
        </span>
        <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
          <span>← {candidate.parentVersionId}</span>
          <span>{candidate.contentRef}</span>
        </span>
      </button>
    </li>
  );
}
