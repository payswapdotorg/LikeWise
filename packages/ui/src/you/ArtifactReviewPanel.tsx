// YOU Performance Studio — 产物评审面板（W4B）。
//
// 验收要求：artifact 清单带 lineage（job → artifacts）、内容寻址 artifact 卡片、
// 评审动作（accept/reject/supersede）经评审状态机投影渲染；consent-gated 输入由
// consent-state 投影渲染（无第二条同意路径）。评审 append-only：有效评审 =
// 最新非 superseded 记录；未知 artifact ⇒ typed YOU_RENDER_ARTIFACT_NOT_FOUND 面板。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import {
  CheckIcon,
  FileDigitIcon,
  PackageIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { usePerformanceMessages } from "@/you/usePerformanceMessages.js";
import type { UsePerformanceStudioBinding } from "@/you/usePerformanceStudio.js";
import { projectRenderConsentGate } from "@/you/performanceController.js";
import { projectArtifactLineageRows } from "@/you/performanceStudioProjection.js";

export function ArtifactReviewPanel({ binding }: { binding: UsePerformanceStudioBinding }) {
  const { formatMessage } = usePerformanceMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedArtifactId = useStore(binding.store, (state) => state.selectedArtifactId);
  const [busy, setBusy] = useState(false);

  const artifactRows = useMemo(
    () => projectArtifactLineageRows(snapshot),
    [snapshot],
  );
  const consentGate = snapshot ? projectRenderConsentGate(snapshot.consent) : null;

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
      data-testid="you-performance-review"
    >
      <section aria-label={formatMessage({ id: "you.performance.review.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.performance.review.title" })}
          </h3>
          <Badge
            variant="outline"
            className="gap-1 text-ui-xs text-foreground-subtle"
            data-testid="you-performance-artifact-count"
          >
            <PackageIcon className="size-3" />
            {artifactRows.length} {formatMessage({ id: "you.performance.review.artifactCount" })}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.performance.review.reviewCaption" })}
        </p>
        {artifactRows.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-performance-review-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.performance.review.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.performance.review.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-2" data-testid="you-performance-artifact-list">
            {artifactRows.map((row) => (
              <ArtifactCard
                key={row.artifact.id}
                row={row}
                selected={selectedArtifactId === row.artifact.id}
                busy={busy}
                formatMessage={formatMessage}
                onSelect={() => binding.store.getState().selectArtifact(row.artifact.id)}
                onReview={(decision) =>
                  void withBusy(() =>
                    binding.controller.reviewArtifact({
                      artifactId: row.artifact.id,
                      decision,
                      notes: `fixture: operator ${decision}ed artifact ${row.artifact.id}`,
                    }),
                  )
                }
              />
            ))}
          </ol>
        )}
      </section>

      {consentGate ? (
        <section aria-label={formatMessage({ id: "you.performance.review.consentTitle" })}>
          <div className="rounded-lg border border-border bg-card p-2.5" data-testid="you-performance-consent">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheckIcon className="size-4 shrink-0 text-foreground-subtle" />
              <h4 className="text-ui-sm font-medium text-foreground">
                {formatMessage({ id: "you.performance.review.consentTitle" })}
              </h4>
              <Badge
                variant={consentGate.allowed ? "secondary" : "outline"}
                className={cn(
                  "font-mono text-ui-xs",
                  consentGate.allowed
                    ? "text-success"
                    : "border-warning/40 text-warning",
                )}
                data-testid="you-performance-consent-gate"
                data-you-performance-consent-allowed={consentGate.allowed ? "true" : "false"}
              >
                {consentGate.allowed
                  ? formatMessage({ id: "you.performance.review.gateAllowed" })
                  : formatMessage({ id: "you.performance.review.gateBlocked" })}
              </Badge>
            </div>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.performance.review.gateCaption" })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {snapshot.consent.purposeStates.map((entry) => (
                <Badge
                  key={entry.purpose}
                  variant="outline"
                  className="font-mono text-ui-xs text-foreground-subtle"
                  data-testid="you-performance-consent-purpose"
                  data-you-performance-purpose={entry.purpose}
                  data-you-performance-purpose-state={entry.state}
                >
                  {entry.purpose}: {entry.state}
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy || consentGate.allowed}
                data-testid="you-performance-consent-grant"
                onClick={() => {
                  void withBusy(async () => {
                    for (const purpose of snapshot.consent.policy.purposes) {
                      await binding.controller.decideConsent({
                        policyId: snapshot.consent.policy.id,
                        purpose,
                        decision: "grant",
                      });
                    }
                  });
                }}
              >
                {formatMessage({ id: "you.performance.review.grantConsent" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy || consentGate.state === "withdrawn"}
                data-testid="you-performance-consent-withdraw"
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.withdrawConsent({
                      policyId: snapshot.consent.policy.id,
                    }),
                  )
                }
              >
                {formatMessage({ id: "you.performance.review.withdrawConsent" })}
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ArtifactCard({
  row,
  selected,
  busy,
  formatMessage,
  onSelect,
  onReview,
}: {
  row: ReturnType<typeof projectArtifactLineageRows>[number];
  selected: boolean;
  busy: boolean;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
  onSelect: () => void;
  onReview: (decision: "accept" | "reject" | "supersede") => void;
}) {
  const { artifact, jobId, jobStatus, review } = row;
  return (
    <li
      className={cn(
        "rounded-lg border bg-card p-2.5",
        selected ? "border-brand/40" : "border-border",
      )}
      data-testid="you-performance-artifact"
      data-you-performance-artifact-id={artifact.id}
      data-you-performance-review-status={review.status}
      onClick={onSelect}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <FileDigitIcon className="size-3.5 shrink-0 text-foreground-subtle" />
        <span className="font-mono text-ui-xs text-foreground">{artifact.id}</span>
        <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
          {artifact.kind}
        </Badge>
        <Badge
          variant={review.status === "accepted" ? "secondary" : "outline"}
          className={cn(
            "font-mono text-ui-xs",
            review.status === "accepted" && "text-success",
            review.status === "rejected" && "text-destructive",
            review.status === "superseded" && "border-warning/40 text-warning",
          )}
          data-testid="you-performance-artifact-review-status"
        >
          {formatMessage({ id: `you.performance.review.status.${review.status}` })}
        </Badge>
        {artifact.simulated ? (
          <Badge variant="outline" className="border-warning/40 font-mono text-ui-xs text-warning">
            {formatMessage({ id: "you.performance.review.simulated" })}
          </Badge>
        ) : null}
      </div>
      {/* lineage：job → artifacts（谱系链接原样呈现）。 */}
      <dl className="mt-1 flex flex-col gap-0.5">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.performance.review.lineage" })}:
          </dt>
          <dd className="break-all font-mono text-ui-xs text-foreground" data-testid="you-performance-artifact-lineage">
            {jobId} ({formatMessage({ id: `you.performance.jobs.status.${jobStatus}` })})
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.performance.review.contentRef" })}:
          </dt>
          <dd className="min-w-0 break-all font-mono text-ui-xs text-foreground" data-testid="you-performance-artifact-content-ref">
            {artifact.contentRef}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.performance.review.contentHash" })}:
          </dt>
          <dd className="min-w-0 break-all font-mono text-ui-xs text-foreground-subtle" data-testid="you-performance-artifact-content-hash">
            {artifact.contentHash}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.performance.review.reviewStatus" })}:
          </dt>
          <dd className="font-mono text-ui-xs text-foreground-subtle" data-testid="you-performance-artifact-review-count">
            {review.reviewCount} {formatMessage({ id: "you.performance.review.reviewCount" })}
            {review.reviewedAt ? ` · ${review.reviewedAt}` : ""}
          </dd>
        </div>
      </dl>
      <span className="sr-only" data-testid="you-performance-artifact-label">
        {row.accessibleLabel}
      </span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-6 gap-1 px-2 text-ui-xs"
          disabled={busy || review.status === "accepted"}
          data-testid="you-performance-artifact-accept"
          data-you-performance-artifact-id={artifact.id}
          onClick={(event) => {
            event.stopPropagation();
            onReview("accept");
          }}
        >
          <CheckIcon className="size-3" />
          {formatMessage({ id: "you.performance.review.accept" })}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 gap-1 px-2 text-ui-xs text-destructive"
          disabled={busy || review.status === "rejected"}
          data-testid="you-performance-artifact-reject"
          data-you-performance-artifact-id={artifact.id}
          onClick={(event) => {
            event.stopPropagation();
            onReview("reject");
          }}
        >
          <XIcon className="size-3" />
          {formatMessage({ id: "you.performance.review.reject" })}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 gap-1 px-2 text-ui-xs"
          disabled={busy || review.status === "superseded" || review.reviewCount === 0}
          title={
            review.reviewCount === 0
              ? formatMessage({ id: "you.performance.review.reviewCaption" })
              : undefined
          }
          data-testid="you-performance-artifact-supersede"
          data-you-performance-artifact-id={artifact.id}
          onClick={(event) => {
            event.stopPropagation();
            onReview("supersede");
          }}
        >
          <TriangleAlertIcon className="size-3" />
          {formatMessage({ id: "you.performance.review.supersede" })}
        </Button>
      </div>
    </li>
  );
}
