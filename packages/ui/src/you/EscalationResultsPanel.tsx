// YOU Escalation Studio — 专家结果审阅面板（W8B）。
//
// 验收要求：ArenaExpertResult 面板（typed-payload / artifact / guidance；内容寻址
// artifact 标签；applies-as-changeset 动作作为投射意图）。应用走 applyExpertResult
//（arena-result-applied 落账 + 确定性变更集 id）；拒绝走 rejectExpertResult
//（delivered → rejected 终态，显式理由）。全部行来自纯投影；零业务逻辑。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { PackageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEscalationMessages } from "@/you/useEscalationMessages.js";
import type { UseEscalationStudioBinding } from "@/you/useEscalationStudio.js";
import { escalationById, orderedEscalations } from "@/you/escalationController.js";
import { projectExpertResultView } from "@/you/escalationStudioProjection.js";

export function EscalationResultsPanel({ binding }: { binding: UseEscalationStudioBinding }) {
  const { formatMessage } = useEscalationMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedEscalationId = useStore(binding.store, (state) => state.selectedEscalationId);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const escalations = useMemo(() => orderedEscalations(snapshot), [snapshot]);
  const inspected = useMemo(
    () =>
      escalationById(snapshot, selectedEscalationId) ??
      escalations.at(-1) ??
      null,
    [snapshot, escalations, selectedEscalationId],
  );
  const resultView = useMemo(
    () => (inspected ? projectExpertResultView(inspected) : null),
    [inspected],
  );
  const reviewable =
    inspected !== null && inspected.status === "delivered" && resultView !== null;

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

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-escalation-results"
    >
      <section aria-label={formatMessage({ id: "you.escalation.results.title" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.escalation.results.title" })}
        </h3>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.escalation.results.caption" })}
        </p>
      </section>

      {inspected === null || resultView === null ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-escalation-results-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.escalation.results.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.escalation.results.emptyHint" })}
          </p>
        </div>
      ) : (
        <section>
          <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-ui-xs text-foreground-subtle">
            <span>
              {formatMessage({ id: "you.escalation.gate.escalation" })}:{" "}
              {inspected.escalationId}
            </span>
            <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: `you.escalation.progress.status.${inspected.status}` })}
            </Badge>
          </div>

          <div
            className={cn(
              "mt-2 flex flex-col gap-2 rounded-lg border p-2",
              inspected.status === "applied"
                ? "border-success/40 bg-success/5"
                : inspected.status === "rejected"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border bg-surface",
            )}
            data-testid="you-escalation-expert-result"
            data-you-escalation-result-type={resultView.resultType}
            data-you-escalation-result-applied={
              resultView.appliesAsChangeSetId !== null ? "true" : "false"
            }
          >
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <PackageIcon className="size-3.5 shrink-0 text-foreground-subtle" />
              <Badge variant="outline" className="border-primary/30 text-ui-xs text-primary">
                {formatMessage({
                  id: `you.escalation.results.resultType.${resultView.resultType}`,
                })}
              </Badge>
              <span className="font-mono text-ui-xs text-foreground-subtle">
                {formatMessage({ id: "you.escalation.results.deliveredAt" })}:{" "}
                {resultView.deliveredAt}
              </span>
            </div>

            <div>
              <h5 className="text-ui-xs font-medium text-foreground">
                {formatMessage({ id: "you.escalation.results.payload.title" })}
              </h5>
              <dl
                className="mt-1 flex flex-col gap-0.5 font-mono text-ui-xs"
                data-testid="you-escalation-result-payload"
              >
                {resultView.payloadRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex min-w-0 flex-wrap gap-x-1.5"
                    data-testid="you-escalation-result-payload-row"
                    data-you-escalation-payload-key={row.key}
                  >
                    <dt className="text-foreground-subtlest">{row.key}:</dt>
                    <dd className="min-w-0 break-all text-foreground-subtle">{row.value}</dd>
                    <span className="sr-only">{row.accessibleLabel}</span>
                  </div>
                ))}
              </dl>
            </div>

            {resultView.resultType === "artifact" ? (
              <div>
                <h5 className="text-ui-xs font-medium text-foreground">
                  {formatMessage({ id: "you.escalation.results.artifact.title" })}
                </h5>
                <dl
                  className="mt-1 flex flex-col gap-0.5 font-mono text-ui-xs"
                  data-testid="you-escalation-result-artifact"
                >
                  <div className="flex min-w-0 flex-wrap gap-x-1.5">
                    <dt className="text-foreground-subtlest">
                      {formatMessage({ id: "you.escalation.results.artifact.ref" })}:
                    </dt>
                    <dd className="min-w-0 break-all text-foreground-subtle">
                      {resultView.artifactRef ?? "—"}
                    </dd>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-x-1.5">
                    <dt className="text-foreground-subtlest">
                      {formatMessage({ id: "you.escalation.results.artifact.hash" })}:
                    </dt>
                    <dd className="min-w-0 break-all text-foreground-subtle">
                      {resultView.artifactHash ?? "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 font-mono text-ui-xs">
              <span className="text-foreground-subtlest">
                {formatMessage({ id: "you.escalation.results.appliesAsChangeSet" })}:
              </span>
              <span
                className={
                  resultView.appliesAsChangeSetId !== null
                    ? "break-all text-success"
                    : "text-foreground-subtlest"
                }
                data-testid="you-escalation-applies-as-changeset"
              >
                {resultView.appliesAsChangeSetId ??
                  formatMessage({ id: "you.escalation.results.appliesAsChangeSet.none" })}
              </span>
            </div>

            {inspected.rejectionReason !== null ? (
              <p
                className="font-mono text-ui-xs text-destructive"
                data-testid="you-escalation-result-rejection-reason"
              >
                {formatMessage({ id: "you.escalation.results.rejectionReason" })}:{" "}
                {inspected.rejectionReason}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || !reviewable}
                title={!reviewable ? formatMessage({ id: "you.escalation.results.applyDisabled" }) : undefined}
                data-testid="you-escalation-apply-result"
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.applyExpertResult({
                      escalationId: inspected.escalationId,
                    }),
                  )
                }
              >
                {formatMessage({ id: "you.escalation.results.apply" })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !reviewable}
                title={!reviewable ? formatMessage({ id: "you.escalation.results.rejectDisabled" }) : undefined}
                data-testid="you-escalation-reject-result"
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.rejectExpertResult({
                      escalationId: inspected.escalationId,
                      reason: rejectReason.trim() === "" ? "reviewed and declined" : rejectReason.trim(),
                    }),
                  )
                }
              >
                {formatMessage({ id: "you.escalation.results.reject" })}
              </Button>
              <label
                className="text-ui-xs text-foreground-subtlest"
                htmlFor="you-escalation-reject-reason"
              >
                {formatMessage({ id: "you.escalation.results.rejectReason" })}
              </label>
              <input
                id="you-escalation-reject-reason"
                className="h-6 w-48 rounded-md border border-border bg-surface px-1.5 font-mono text-ui-xs text-foreground"
                placeholder={formatMessage({ id: "you.escalation.results.rejectPlaceholder" })}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                data-testid="you-escalation-reject-reason-input"
              />
            </div>
            <p className="text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.results.applyCaption" })}
            </p>
            <p className="text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.results.rejectCaption" })}
            </p>
            <span className="sr-only">{resultView.accessibleLabel}</span>
          </div>
        </section>
      )}
    </div>
  );
}
