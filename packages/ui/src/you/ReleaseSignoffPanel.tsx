// YOU Release Studio — operator sign-off 面板（W12B）。
//
// 验收要求：signoff surface——operator sign-off 状态（signed-by、signed-at、
// 被引用 checklist）来自 controller 投影（OPERATOR SIGNOFF LAW：signoff 引用
// COMPLETE passing checklist；不可变；one release declaration per signoff）。
// 零 UI 业务逻辑；loading/error/empty 齐全。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { PenLineIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useReleaseMessages } from "@/you/useReleaseMessages.js";
import type { UseReleaseStudioBinding } from "@/you/useReleaseStudio.js";
import {
  orderedReleaseSignoffs,
  projectReleaseSignoffGate,
} from "@/you/releaseController.js";
import {
  projectReleaseListRegionView,
  projectReleaseSignoffRows,
} from "@/you/releaseStudioProjection.js";

export function ReleaseSignoffPanel({
  binding,
}: {
  binding: UseReleaseStudioBinding;
}) {
  const { formatMessage } = useReleaseMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const signoffDraftOperatorId = useStore(
    binding.store,
    (state) => state.signoffDraftOperatorId,
  );
  const selectedSignoffId = useStore(
    binding.store,
    (state) => state.selectedSignoffId,
  );
  const [busy, setBusy] = useState(false);

  const operators = snapshot?.operators ?? [];
  const signoffRows = useMemo(
    () => projectReleaseSignoffRows(snapshot, orderedReleaseSignoffs(snapshot)),
    [snapshot],
  );
  const ledgerRegion = projectReleaseListRegionView(
    snapshot !== null,
    signoffRows.length,
  );
  // signoff 门视图（独立呈现——服务端独立强制；selection 为当前草稿 operator）。
  const gate = useMemo(
    () => projectReleaseSignoffGate(snapshot, signoffDraftOperatorId),
    [snapshot, signoffDraftOperatorId],
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
      data-testid="you-release-signoff"
    >
      <section aria-label={formatMessage({ id: "you.release.signoff.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <PenLineIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.release.signoff.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {signoffRows.length} {formatMessage({ id: "you.release.signoff.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.release.signoff.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.release.signoff.operators.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.release.signoff.operators.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.release.signoff.operators.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-release-signoff-operators">
          {operators.map((entry) => {
            const selected = entry.id === signoffDraftOperatorId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-release-signoff-operator"
                data-you-release-signoff-operator-id={entry.id}
                data-you-release-signoff-operator-valid={entry.valid ? "true" : "false"}
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() =>
                    binding.store.getState().setSignoffDraftOperator(entry.id)
                  }
                >
                  <span className="text-foreground">{entry.displayName}</span>
                </button>
                <span className="text-foreground-subtlest">
                  {formatMessage({ id: "you.release.contentRef" })}: {entry.operatorRef}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.release.signoff.record.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.release.signoff.record.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.release.signoff.record.caption" })}
        </p>
        <div
          className={cn(
            "mt-1.5 rounded-lg border p-2 text-ui-xs",
            gate.allowed
              ? "border-success/40 bg-success/5 text-foreground"
              : "border-warning/40 bg-warning/5 text-foreground",
          )}
          data-testid="you-release-signoff-gate"
          data-you-release-signoff-gate-reason={gate.reason}
        >
          <span className="font-medium">
            {formatMessage({
              id: gate.allowed
                ? "you.release.signoff.gate.allowed"
                : "you.release.signoff.gate.blocked",
            })}
          </span>
          <span className="ml-1.5 text-foreground-subtle">
            {formatMessage({
              id: `you.release.signoff.gate.reason.${gate.reason}`,
            })}
          </span>
        </div>
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            data-testid="you-release-signoff-record"
            onClick={() =>
              void withBusy(() =>
                binding.controller.recordOperatorSignoff({
                  operatorId: signoffDraftOperatorId,
                }),
              )
            }
          >
            <PenLineIcon className="size-3.5" />
            {formatMessage({ id: "you.release.signoff.record.apply" })}
          </Button>
        </div>
      </section>

      {ledgerRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-release-signoff-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.release.signoff.ledger.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.release.signoff.ledger.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.release.signoff.ledger.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.release.signoff.ledger.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.release.signoff.ledger.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-release-signoff-ledger">
            {signoffRows.map((row) => {
              const selected = row.signoffId === selectedSignoffId;
              return (
                <li
                  key={row.signoffId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-release-signoff-record-row"
                  data-you-release-signoff-id={row.signoffId}
                  data-you-release-signoff-checklist-ref={row.checklistRef}
                  data-you-release-signoff-declared={row.declared ? "true" : "false"}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store.getState().selectSignoff(row.signoffId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.signoffId}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.declared
                          ? "border-success/40 text-success"
                          : "border-border text-foreground-subtle",
                      )}
                    >
                      {formatMessage({
                        id: row.declared
                          ? "you.release.signoff.ledger.row.declared"
                          : "you.release.signoff.ledger.row.notDeclared",
                      })}
                    </Badge>
                  </button>
                  {/* OPERATOR SIGNOFF LAW 显示面：signed-by / signed-at / 被引用
                      checklist（含 counts 与门态——账本解析，绝不猜测）。 */}
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.release.signoff.ledger.row.signedBy" })}:{" "}
                      {row.signedBy}
                      {row.signedByDisplayName !== null
                        ? ` (${row.signedByDisplayName})`
                        : ""}
                    </span>
                    <span>
                      {formatMessage({ id: "you.release.signoff.ledger.row.signedAt" })}:{" "}
                      {row.signedAt}
                    </span>
                    <span>
                      {formatMessage({ id: "you.release.signoff.ledger.row.checklist" })}:{" "}
                      {row.checklistRef}
                    </span>
                    <span>
                      {formatMessage({ id: "you.release.signoff.ledger.row.checklistCounts" })}:{" "}
                      {row.checklistCountsLabel ??
                        formatMessage({ id: "you.release.signoff.ledger.row.unknown" })}
                    </span>
                    <span>
                      {formatMessage({ id: "you.release.signoff.ledger.row.checklistGate" })}:{" "}
                      {row.checklistGatePasses === null
                        ? formatMessage({ id: "you.release.signoff.ledger.row.unknown" })
                        : row.checklistGatePasses
                          ? formatMessage({
                              id: "you.release.checklist.gateState.all-points-passed",
                            })
                          : formatMessage({
                              id: "you.release.checklist.gateState.incomplete",
                            })}
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
