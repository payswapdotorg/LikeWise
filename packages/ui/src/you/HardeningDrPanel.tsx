// YOU Hardening Studio — DR status 面板（W10B）。
//
// 验收要求：restore records 携 verification states——verification 从
// dr-restore-recorded 事件流的 check evidence 派生（DR LAW 显示面：verified flag
// 绝不在无证据时显示为 verified）。零 UI 业务逻辑；loading/error/empty 齐全。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { DatabaseBackupIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useHardeningMessages } from "@/you/useHardeningMessages.js";
import type { UseHardeningStudioBinding } from "@/you/useHardeningStudio.js";
import { orderedDrRestores } from "@/you/hardeningController.js";
import {
  projectDrDraftView,
  projectDrRestoreRows,
  projectHardeningListRegionView,
} from "@/you/hardeningStudioProjection.js";

const DR_INTEGRITIES: readonly ("honest" | "corrupted")[] = ["honest", "corrupted"];

export function HardeningDrPanel({
  binding,
}: {
  binding: UseHardeningStudioBinding;
}) {
  const { formatMessage } = useHardeningMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const drDraftSnapshotId = useStore(
    binding.store,
    (state) => state.drDraftSnapshotId,
  );
  const drIntegrity = useStore(binding.store, (state) => state.drIntegrity);
  const selectedDrRestoreId = useStore(
    binding.store,
    (state) => state.selectedDrRestoreId,
  );
  const [busy, setBusy] = useState(false);

  const snapshots = snapshot?.drSnapshots ?? [];
  const draftView = useMemo(
    () =>
      projectDrDraftView(
        { snapshotId: drDraftSnapshotId, integrity: drIntegrity },
        snapshots,
      ),
    [drDraftSnapshotId, drIntegrity, snapshots],
  );
  const restoreRows = useMemo(
    () => projectDrRestoreRows(orderedDrRestores(snapshot), snapshot?.events ?? []),
    [snapshot],
  );
  const recordRegion = projectHardeningListRegionView(
    snapshot !== null,
    restoreRows.length,
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
      data-testid="you-hardening-dr"
    >
      <section aria-label={formatMessage({ id: "you.hardening.dr.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <DatabaseBackupIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.hardening.dr.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {restoreRows.length} {formatMessage({ id: "you.hardening.dr.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.dr.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.hardening.dr.snapshots.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.dr.snapshots.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.dr.snapshots.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-dr-snapshots">
          {snapshots.map((entry) => {
            const selected = entry.id === drDraftSnapshotId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-hardening-dr-snapshot"
                data-you-hardening-dr-snapshot-id={entry.id}
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() => binding.store.getState().setDrDraftSnapshot(entry.id)}
                >
                  <span className="text-foreground">{entry.snapshotRef}</span>
                </button>
                <span className="text-foreground-subtlest">
                  {formatMessage({ id: "you.hardening.dr.snapshots.expectedHash" })}:{" "}
                  {entry.expectedHash}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.hardening.dr.restore.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.dr.restore.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.dr.restore.caption" })}
        </p>
        <div className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-dr-integrities">
          <span className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.hardening.dr.restore.integrity" })}
          </span>
          <div className="flex flex-wrap gap-1">
            {DR_INTEGRITIES.map((integrity) => {
              const selected = integrity === drIntegrity;
              return (
                <Button
                  key={integrity}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                    integrity === "corrupted" && "border-warning/40 text-warning",
                  )}
                  data-testid="you-hardening-dr-integrity-option"
                  data-you-hardening-dr-integrity={integrity}
                  aria-pressed={selected}
                  onClick={() => binding.store.getState().setDrIntegrity(integrity)}
                >
                  {formatMessage({ id: `you.hardening.dr.integrity.${integrity}` })}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || draftView.disabledReason !== null}
            data-testid="you-hardening-dr-restore"
            data-you-hardening-dr-restore-disabled-reason={draftView.disabledReason ?? ""}
            onClick={() =>
              void withBusy(() =>
                binding.controller.runDrRestore({
                  snapshotId: drDraftSnapshotId,
                  integrity: drIntegrity,
                }),
              )
            }
          >
            <DatabaseBackupIcon className="size-3.5" />
            {formatMessage({ id: "you.hardening.dr.restore.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.hardening.dr.restore.disabled" })}
            </span>
          ) : null}
        </div>
      </section>

      {recordRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-hardening-dr-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.hardening.dr.records.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.dr.records.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.hardening.dr.records.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.hardening.dr.records.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.dr.records.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-dr-restores">
            {restoreRows.map((row) => {
              const selected = row.restoreId === selectedDrRestoreId;
              return (
                <li
                  key={row.restoreId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-hardening-dr-restore-record"
                  data-you-hardening-dr-restore-id={row.restoreId}
                  data-you-hardening-dr-verification={row.verification}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store.getState().selectDrRestore(row.restoreId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.restoreId}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.verification === "verified"
                          ? "border-success/40 text-success"
                          : "border-warning/40 text-warning",
                      )}
                    >
                      {formatMessage({ id: `you.hardening.dr.verification.${row.verification}` })}
                    </Badge>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.hardening.dr.records.row.snapshot" })}:{" "}
                      {row.snapshotRef}
                    </span>
                    <span>
                      {formatMessage({ id: "you.hardening.dr.records.row.checkHash" })}:{" "}
                      {row.checkHash ?? "—"}
                    </span>
                    <span>
                      {formatMessage({ id: "you.hardening.dr.records.row.restoredAt" })}:{" "}
                      {row.restoredAt}
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
