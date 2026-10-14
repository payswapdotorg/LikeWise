// YOU Release Studio — release declaration 面板（W12B）。
//
// 验收要求：declaration surface——release declaration（evidence bundle + rollback
// 链接）来自 controller 投影（RELEASE DECLARATION LAW：declaration 携带 full
// evidence bundle 与 rollback evidence——production-eligibility 法则延伸到
// release）。零 UI 业务逻辑；loading/error/empty 齐全。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { PackageCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useReleaseMessages } from "@/you/useReleaseMessages.js";
import type { UseReleaseStudioBinding } from "@/you/useReleaseStudio.js";
import {
  orderedReleaseDeclarations,
  projectReleaseDeclarationGate,
} from "@/you/releaseController.js";
import {
  projectReleaseDeclarationRows,
  projectReleaseListRegionView,
} from "@/you/releaseStudioProjection.js";

export function ReleaseDeclarationPanel({
  binding,
}: {
  binding: UseReleaseStudioBinding;
}) {
  const { formatMessage } = useReleaseMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const declarationDraftEvidenceBundleId = useStore(
    binding.store,
    (state) => state.declarationDraftEvidenceBundleId,
  );
  const declarationDraftRollbackEvidenceId = useStore(
    binding.store,
    (state) => state.declarationDraftRollbackEvidenceId,
  );
  const selectedDeclarationId = useStore(
    binding.store,
    (state) => state.selectedDeclarationId,
  );
  const [busy, setBusy] = useState(false);

  const bundles = snapshot?.evidenceBundles ?? [];
  const rollbackEvidence = snapshot?.rollbackEvidence ?? [];
  const declarationRows = useMemo(
    () =>
      projectReleaseDeclarationRows(
        snapshot,
        orderedReleaseDeclarations(snapshot),
      ),
    [snapshot],
  );
  const ledgerRegion = projectReleaseListRegionView(
    snapshot !== null,
    declarationRows.length,
  );
  // declaration 门视图（独立呈现——服务端独立强制；selection 为当前草稿两端）。
  const gate = useMemo(
    () =>
      projectReleaseDeclarationGate(
        snapshot,
        declarationDraftEvidenceBundleId,
        declarationDraftRollbackEvidenceId,
      ),
    [snapshot, declarationDraftEvidenceBundleId, declarationDraftRollbackEvidenceId],
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
      data-testid="you-release-declaration"
    >
      <section aria-label={formatMessage({ id: "you.release.declaration.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <PackageCheckIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.release.declaration.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {declarationRows.length}{" "}
            {formatMessage({ id: "you.release.declaration.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.release.declaration.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.release.declaration.bundles.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.release.declaration.bundles.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.release.declaration.bundles.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-release-declaration-bundles">
          {bundles.map((entry) => {
            const selected = entry.id === declarationDraftEvidenceBundleId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-release-declaration-bundle"
                data-you-release-declaration-bundle-id={entry.id}
                data-you-release-declaration-bundle-valid={entry.valid ? "true" : "false"}
                data-you-release-declaration-bundle-journeys={entry.journeyCount}
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() =>
                    binding.store
                      .getState()
                      .setDeclarationDraftEvidenceBundle(entry.id)
                  }
                >
                  <span className="text-foreground">{entry.bundleRef}</span>
                </button>
                <span className="text-foreground-subtlest">
                  {entry.journeyCount}{" "}
                  {formatMessage({ id: "you.release.declaration.bundles.journeys" })}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.release.declaration.rollback.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.release.declaration.rollback.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.release.declaration.rollback.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-release-declaration-rollback">
          {rollbackEvidence.map((entry) => {
            const selected = entry.id === declarationDraftRollbackEvidenceId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-release-declaration-rollback-entry"
                data-you-release-declaration-rollback-id={entry.id}
                data-you-release-declaration-rollback-valid={entry.valid ? "true" : "false"}
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() =>
                    binding.store
                      .getState()
                      .setDeclarationDraftRollbackEvidence(entry.id)
                  }
                >
                  <span className="text-foreground">{entry.rollbackRef}</span>
                </button>
                {entry.drill.length > 0 ? (
                  <span className="text-foreground-subtlest">{entry.drill}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.release.declaration.declare.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.release.declaration.declare.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.release.declaration.declare.caption" })}
        </p>
        <div
          className={cn(
            "mt-1.5 rounded-lg border p-2 text-ui-xs",
            gate.allowed
              ? "border-success/40 bg-success/5 text-foreground"
              : "border-warning/40 bg-warning/5 text-foreground",
          )}
          data-testid="you-release-declaration-gate"
          data-you-release-declaration-gate-reason={gate.reason}
        >
          <span className="font-medium">
            {formatMessage({
              id: gate.allowed
                ? "you.release.declaration.gate.allowed"
                : "you.release.declaration.gate.blocked",
            })}
          </span>
          <span className="ml-1.5 text-foreground-subtle">
            {formatMessage({
              id: `you.release.declaration.gate.reason.${gate.reason}`,
            })}
          </span>
        </div>
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            data-testid="you-release-declaration-declare"
            onClick={() =>
              void withBusy(() =>
                binding.controller.declareRelease({
                  evidenceBundleId: declarationDraftEvidenceBundleId,
                  rollbackEvidenceId: declarationDraftRollbackEvidenceId,
                }),
              )
            }
          >
            <PackageCheckIcon className="size-3.5" />
            {formatMessage({ id: "you.release.declaration.declare.apply" })}
          </Button>
        </div>
      </section>

      {ledgerRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-release-declaration-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.release.declaration.ledger.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.release.declaration.ledger.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.release.declaration.ledger.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.release.declaration.ledger.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.release.declaration.ledger.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-release-declaration-ledger">
            {declarationRows.map((row) => {
              const selected = row.declarationId === selectedDeclarationId;
              return (
                <li
                  key={row.declarationId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-release-declaration-record-row"
                  data-you-release-declaration-id={row.declarationId}
                  data-you-release-declaration-signoff-ref={row.signoffRef}
                  data-you-release-declaration-bundle-ref={row.evidenceBundleRef}
                  data-you-release-declaration-rollback-ref={row.rollbackEvidenceRef}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store.getState().selectDeclaration(row.declarationId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.declarationId}
                    </span>
                  </button>
                  {/* RELEASE DECLARATION LAW 显示面：signoff 链接 + evidence bundle
                      链接 + rollback 链接 verbatim（对注册面解析，绝不猜测）。 */}
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.release.declaration.ledger.row.signoff" })}:{" "}
                      {row.signoffRef}
                    </span>
                    <span>
                      {formatMessage({ id: "you.release.declaration.ledger.row.bundle" })}:{" "}
                      {row.evidenceBundleRef}
                      {row.evidenceBundleJourneyCount !== null
                        ? ` (${row.evidenceBundleJourneyCount} ${formatMessage({
                            id: "you.release.declaration.ledger.row.bundleJourneys",
                          })})`
                        : ""}
                    </span>
                    <span>
                      {formatMessage({ id: "you.release.declaration.ledger.row.rollback" })}:{" "}
                      {row.rollbackEvidenceRef}
                    </span>
                    <span>
                      {formatMessage({ id: "you.release.declaration.ledger.row.declaredAt" })}:{" "}
                      {row.declaredAt}
                    </span>
                  </span>
                  {row.rollbackDrill !== null && row.rollbackDrill.length > 0 ? (
                    <span className="font-mono text-ui-xs text-foreground-subtlest">
                      {formatMessage({ id: "you.release.declaration.ledger.row.rollbackDrill" })}:{" "}
                      {row.rollbackDrill}
                    </span>
                  ) : null}
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
