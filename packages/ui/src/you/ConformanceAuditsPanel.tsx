// YOU Conformance Studio — conformance audits 面板（W11B）。
//
// 验收要求：audits 携 checks-total / checks-passed verbatim（CONFORMANCE LAW
// 显示面——绝不 bare pass）。零 UI 业务逻辑；loading/error/empty 齐全。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { ListChecksIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useConformanceMessages } from "@/you/useConformanceMessages.js";
import type { UseConformanceStudioBinding } from "@/you/useConformanceStudio.js";
import { orderedConformanceAudits } from "@/you/conformanceController.js";
import {
  projectAuditDraftView,
  projectConformanceAuditRows,
  projectConformanceListRegionView,
} from "@/you/conformanceStudioProjection.js";

const AUDIT_OUTCOMES: readonly ("full" | "partial")[] = ["full", "partial"];

export function ConformanceAuditsPanel({
  binding,
}: {
  binding: UseConformanceStudioBinding;
}) {
  const { formatMessage } = useConformanceMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const auditDraftStandardId = useStore(
    binding.store,
    (state) => state.auditDraftStandardId,
  );
  const auditDraftOutcome = useStore(
    binding.store,
    (state) => state.auditDraftOutcome,
  );
  const selectedAuditId = useStore(binding.store, (state) => state.selectedAuditId);
  const [busy, setBusy] = useState(false);

  const standards = snapshot?.standards ?? [];
  const draftView = useMemo(
    () =>
      projectAuditDraftView(
        { standardId: auditDraftStandardId, outcome: auditDraftOutcome },
        standards,
      ),
    [auditDraftStandardId, auditDraftOutcome, standards],
  );
  const auditRows = useMemo(
    () => projectConformanceAuditRows(orderedConformanceAudits(snapshot)),
    [snapshot],
  );
  const auditsRegion = projectConformanceListRegionView(
    snapshot !== null,
    auditRows.length,
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
      data-testid="you-conformance-checks"
    >
      <section aria-label={formatMessage({ id: "you.conformance.checks.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <ListChecksIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.conformance.checks.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {auditRows.length} {formatMessage({ id: "you.conformance.checks.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.checks.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.checks.standards.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.checks.standards.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.checks.standards.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-checks-standards">
          {standards.map((entry) => {
            const selected = entry.id === auditDraftStandardId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-conformance-checks-standard"
                data-you-conformance-checks-standard-id={entry.id}
                data-you-conformance-checks-total={entry.checksTotal}
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() =>
                    binding.store.getState().setAuditDraftStandard(entry.id)
                  }
                >
                  <span className="text-foreground">{entry.standard}</span>
                </button>
                <span className="text-foreground-subtlest">
                  {formatMessage({ id: "you.conformance.checks.standards.checks" })}:{" "}
                  {entry.checksTotal} · {formatMessage({ id: "you.conformance.contentRef" })}:{" "}
                  {entry.scopeRef}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.checks.run.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.checks.run.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.checks.run.caption" })}
        </p>
        <div className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-checks-outcomes">
          <span className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.conformance.checks.run.outcome" })}
          </span>
          <div className="flex flex-wrap gap-1">
            {AUDIT_OUTCOMES.map((outcome) => {
              const selected = outcome === auditDraftOutcome;
              return (
                <Button
                  key={outcome}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                  )}
                  data-testid="you-conformance-checks-outcome-option"
                  data-you-conformance-checks-outcome={outcome}
                  aria-pressed={selected}
                  onClick={() =>
                    binding.store.getState().setAuditDraftOutcome(outcome)
                  }
                >
                  {formatMessage({ id: `you.conformance.outcome.${outcome}` })}
                </Button>
              );
            })}
          </div>
          {draftView.checksTotal === 0 && draftView.disabledReason === null ? (
            <p
              className="text-ui-xs text-warning"
              data-testid="you-conformance-checks-zero-note"
            >
              {formatMessage({ id: "you.conformance.checks.run.zeroNote" })}
            </p>
          ) : null}
          {draftView.projectedChecksPassed !== null &&
          draftView.checksTotal !== null ? (
            <p className="font-mono text-ui-xs text-foreground-subtlest">
              {formatMessage(
                { id: "you.conformance.checks.run.projected" },
                {
                  passed: draftView.projectedChecksPassed,
                  total: draftView.checksTotal,
                },
              )}
            </p>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || draftView.disabledReason !== null}
            data-testid="you-conformance-checks-run"
            data-you-conformance-checks-run-disabled-reason={draftView.disabledReason ?? ""}
            onClick={() =>
              void withBusy(() =>
                binding.controller.runConformanceAudit({
                  standardId: auditDraftStandardId,
                  outcome: auditDraftOutcome,
                }),
              )
            }
          >
            <ListChecksIcon className="size-3.5" />
            {formatMessage({ id: "you.conformance.checks.run.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.conformance.checks.run.disabled" })}
            </span>
          ) : null}
        </div>
      </section>

      {auditsRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-conformance-checks-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.conformance.checks.audits.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.checks.audits.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.conformance.checks.audits.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.conformance.checks.audits.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.checks.audits.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-checks-audits">
            {auditRows.map((row) => {
              const selected = row.auditId === selectedAuditId;
              return (
                <li
                  key={row.auditId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-conformance-checks-audit"
                  data-you-conformance-audit-id={row.auditId}
                  data-you-conformance-audit-passed={row.checksPassed}
                  data-you-conformance-audit-total={row.checksTotal}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() => binding.store.getState().selectAudit(row.auditId)}
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.auditId}
                    </span>
                    {/* CONFORMANCE LAW 显示面：counts verbatim 同框——绝不 bare pass。 */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono text-ui-xs",
                        row.passState === "all-passed"
                          ? "border-success/40 text-success"
                          : "border-warning/40 text-warning",
                      )}
                      data-testid="you-conformance-audit-counts"
                    >
                      {row.countsLabel}
                    </Badge>
                    <Badge variant="outline" className="border-border text-ui-xs text-foreground-subtle">
                      {formatMessage({
                        id: `you.conformance.checks.audits.passState.${row.passState}`,
                      })}
                    </Badge>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.conformance.checks.audits.row.standard" })}:{" "}
                      {row.standard}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.checks.audits.row.scope" })}:{" "}
                      {row.scopeRef}
                    </span>
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
