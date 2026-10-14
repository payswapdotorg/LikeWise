// YOU Conformance Studio — security review status 面板（W11B）。
//
// 验收要求：security review 记录（findings、acceptance 态）来自 controller 投影
// ——SECURITY REVIEW LAW：findings verbatim；acceptance 是引用 finding set 的
// 独立不可变决定。零 UI 业务逻辑；loading/error/empty 齐全。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { ShieldCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useConformanceMessages } from "@/you/useConformanceMessages.js";
import type { UseConformanceStudioBinding } from "@/you/useConformanceStudio.js";
import {
  orderedConformanceReviews,
  projectConformanceAcceptanceGate,
} from "@/you/conformanceController.js";
import {
  projectConformanceListRegionView,
  projectConformanceReviewRows,
} from "@/you/conformanceStudioProjection.js";

export function ConformanceReviewPanel({
  binding,
}: {
  binding: UseConformanceStudioBinding;
}) {
  const { formatMessage } = useConformanceMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const reviewDraftScopeId = useStore(
    binding.store,
    (state) => state.reviewDraftScopeId,
  );
  const selectedReviewId = useStore(
    binding.store,
    (state) => state.selectedReviewId,
  );
  const [busy, setBusy] = useState(false);

  const scopes = snapshot?.reviewScopes ?? [];
  const reviewRows = useMemo(
    () => projectConformanceReviewRows(orderedConformanceReviews(snapshot)),
    [snapshot],
  );
  const ledgerRegion = projectConformanceListRegionView(
    snapshot !== null,
    reviewRows.length,
  );
  // acceptance 门视图（独立呈现——服务端独立强制；selection 为当前检视行）。
  const gate = useMemo(
    () => projectConformanceAcceptanceGate(snapshot, selectedReviewId),
    [snapshot, selectedReviewId],
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

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-conformance-review"
    >
      <section aria-label={formatMessage({ id: "you.conformance.review.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheckIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.conformance.review.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {reviewRows.length} {formatMessage({ id: "you.conformance.review.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.review.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.review.scopes.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.review.scopes.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.review.scopes.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-review-scopes">
          {scopes.map((entry) => {
            const selected = entry.id === reviewDraftScopeId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-conformance-review-scope"
                data-you-conformance-review-scope-id={entry.id}
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() =>
                    binding.store.getState().setReviewDraftScope(entry.id)
                  }
                >
                  <span className="text-foreground">{entry.scopeRef}</span>
                </button>
                <span className="text-foreground-subtlest">
                  {formatMessage({ id: "you.conformance.review.scopes.findings" })}:{" "}
                  {entry.findingsCount}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.review.record.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.review.record.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.review.record.caption" })}
        </p>
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || !scopes.some((entry) => entry.id === reviewDraftScopeId)}
            data-testid="you-conformance-review-record"
            onClick={() =>
              void withBusy(() =>
                binding.controller.recordSecurityReview({
                  scopeId: reviewDraftScopeId,
                }),
              )
            }
          >
            <ShieldCheckIcon className="size-3.5" />
            {formatMessage({ id: "you.conformance.review.record.apply" })}
          </Button>
        </div>
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.review.accept.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.review.accept.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.review.accept.caption" })}
        </p>
        <div
          className={cn(
            "mt-1.5 rounded-lg border p-2 text-ui-xs",
            gate.allowed
              ? "border-success/40 bg-success/5 text-foreground"
              : "border-warning/40 bg-warning/5 text-foreground",
          )}
          data-testid="you-conformance-review-gate"
          data-you-conformance-review-gate-reason={gate.reason}
        >
          <span className="font-medium">
            {formatMessage({
              id: gate.allowed
                ? "you.conformance.review.gate.allowed"
                : "you.conformance.review.gate.blocked",
            })}
          </span>
          <span className="ml-1.5 text-foreground-subtle">
            {formatMessage({
              id: `you.conformance.review.gate.reason.${gate.reason}`,
            })}
          </span>
        </div>
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            data-testid="you-conformance-review-accept"
            onClick={() =>
              void withBusy(() =>
                binding.controller.acceptSecurityReview({
                  reviewId: selectedReviewId ?? "",
                }),
              )
            }
          >
            {formatMessage({ id: "you.conformance.review.accept.apply" })}
          </Button>
        </div>
      </section>

      {ledgerRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-conformance-review-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.conformance.review.ledger.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.review.ledger.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.conformance.review.ledger.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.conformance.review.ledger.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.review.ledger.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-review-ledger">
            {reviewRows.map((row) => {
              const selected = row.reviewId === selectedReviewId;
              return (
                <li
                  key={row.reviewId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-conformance-review-record-row"
                  data-you-conformance-review-id={row.reviewId}
                  data-you-conformance-review-kind={row.kind}
                  data-you-conformance-review-accepted={row.accepted ? "true" : "false"}
                  data-you-conformance-review-findings={row.findingsCount}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store.getState().selectReview(row.reviewId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.reviewId}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.kind === "acceptance"
                          ? "border-success/40 text-success"
                          : "border-border text-foreground-subtle",
                      )}
                    >
                      {formatMessage({ id: `you.conformance.review.kind.${row.kind}` })}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.accepted
                          ? "border-success/40 text-success"
                          : "border-warning/40 text-warning",
                      )}
                    >
                      {formatMessage({
                        id: row.accepted
                          ? "you.conformance.review.ledger.row.accepted"
                          : "you.conformance.review.ledger.row.notAccepted",
                      })}
                    </Badge>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.conformance.review.ledger.row.findings" })}:{" "}
                      {row.findingsCount}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.contentRef" })}: {row.scopeRef}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.review.ledger.row.reviewedAt" })}:{" "}
                      {row.reviewedAt}
                    </span>
                    {row.supersedesReviewId !== null ? (
                      <span>
                        {formatMessage({ id: "you.conformance.review.ledger.row.supersedes" })}:{" "}
                        {row.supersedesReviewId}
                      </span>
                    ) : null}
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
