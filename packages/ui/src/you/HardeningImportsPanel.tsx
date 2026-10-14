// YOU Hardening Studio — import statuses 面板（W10B）。
//
// 验收要求：scan classes 与 verdicts（clean / quarantined 以投射意图暴露放行动作 /
// rejected）——零 UI 业务逻辑；loading/error/empty 状态齐全。IMPORT SECURITY LAW
// 的显示面。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { PackageSearchIcon, UnlockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useHardeningMessages } from "@/you/useHardeningMessages.js";
import type { UseHardeningStudioBinding } from "@/you/useHardeningStudio.js";
import {
  projectHardeningListRegionView,
  projectImportDraftView,
  projectImportReleaseRows,
  projectImportVerdictRows,
} from "@/you/hardeningStudioProjection.js";

const VERDICT_TONE: Record<string, string> = {
  clean: "border-success/40 text-success",
  quarantined: "border-warning/40 text-warning",
  rejected: "border-destructive/40 text-destructive",
};

export function HardeningImportsPanel({
  binding,
}: {
  binding: UseHardeningStudioBinding;
}) {
  const { formatMessage } = useHardeningMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const importDraftArtifactId = useStore(
    binding.store,
    (state) => state.importDraftArtifactId,
  );
  const importDraftScanClassId = useStore(
    binding.store,
    (state) => state.importDraftScanClassId,
  );
  const selectedImportVerdictId = useStore(
    binding.store,
    (state) => state.selectedImportVerdictId,
  );
  const [busy, setBusy] = useState(false);

  const artifacts = snapshot?.importArtifacts ?? [];
  const scanClasses = snapshot?.scanClasses ?? [];
  const draftView = useMemo(
    () =>
      projectImportDraftView(
        {
          artifactId: importDraftArtifactId,
          scanClassId: importDraftScanClassId,
        },
        { artifacts, scanClasses },
      ),
    [importDraftArtifactId, importDraftScanClassId, artifacts, scanClasses],
  );
  const verdictRows = useMemo(
    () => projectImportVerdictRows(snapshot?.importVerdictRecords ?? []),
    [snapshot],
  );
  const releaseRows = useMemo(
    () => projectImportReleaseRows(snapshot?.importReleases ?? []),
    [snapshot],
  );
  const verdictRegion = projectHardeningListRegionView(
    snapshot !== null,
    verdictRows.length,
  );
  const releaseRegion = projectHardeningListRegionView(
    snapshot !== null,
    releaseRows.length,
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
      data-testid="you-hardening-imports"
    >
      <section aria-label={formatMessage({ id: "you.hardening.imports.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <PackageSearchIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.hardening.imports.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {verdictRows.length} {formatMessage({ id: "you.hardening.imports.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.imports.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.hardening.imports.scan.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.imports.scan.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.imports.scan.caption" })}
        </p>
        <div className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-import-artifacts">
          <span className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.hardening.imports.scan.artifact" })}
          </span>
          <div className="flex flex-wrap gap-1">
            {artifacts.map((artifact) => {
              const selected = artifact.id === importDraftArtifactId;
              return (
                <Button
                  key={artifact.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 font-mono text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                  )}
                  data-testid="you-hardening-import-artifact-option"
                  data-you-hardening-import-artifact={artifact.id}
                  aria-pressed={selected}
                  title={artifact.artifactRef}
                  onClick={() =>
                    binding.store.getState().setImportDraftArtifact(artifact.id)
                  }
                >
                  {artifact.id}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-import-scan-classes">
          <span className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.hardening.imports.scan.scanClass" })}
          </span>
          <div className="flex flex-wrap gap-1">
            {scanClasses.map((scanClass) => {
              const selected = scanClass.id === importDraftScanClassId;
              return (
                <Button
                  key={scanClass.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 font-mono text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                    !scanClass.valid && "border-warning/40 text-warning",
                  )}
                  data-testid="you-hardening-import-scan-class-option"
                  data-you-hardening-import-scan-class={scanClass.id}
                  data-you-hardening-import-scan-class-valid={
                    scanClass.valid ? "true" : "false"
                  }
                  aria-pressed={selected}
                  onClick={() =>
                    binding.store.getState().setImportDraftScanClass(scanClass.id)
                  }
                >
                  {scanClass.scanClass}
                  <span className="ml-1 text-ui-2xs">
                    {scanClass.valid
                      ? formatMessage({ id: "you.hardening.imports.scan.classValid" })
                      : formatMessage({ id: "you.hardening.imports.scan.classInvalid" })}
                  </span>
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
            data-testid="you-hardening-import-scan"
            data-you-hardening-import-scan-disabled-reason={
              draftView.disabledReason ?? ""
            }
            onClick={() =>
              void withBusy(() =>
                binding.controller.scanImport({
                  artifactId: importDraftArtifactId,
                  scanClassId: importDraftScanClassId,
                }),
              )
            }
          >
            <PackageSearchIcon className="size-3.5" />
            {formatMessage({ id: "you.hardening.imports.scan.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.hardening.imports.scan.disabled" })}
            </span>
          ) : null}
        </div>
      </section>

      {verdictRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-hardening-imports-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.hardening.imports.verdicts.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.imports.verdicts.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.hardening.imports.verdicts.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.hardening.imports.verdicts.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.imports.verdicts.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-import-verdicts">
            {verdictRows.map((row) => {
              const selected = row.verdictId === selectedImportVerdictId;
              const releasable =
                row.verdict === "quarantined" && row.releaseRecordId === null;
              return (
                <li
                  key={row.verdictId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-hardening-import-verdict"
                  data-you-hardening-import-verdict-id={row.verdictId}
                  data-you-hardening-import-verdict-kind={row.verdict}
                  data-you-hardening-import-verdict-released={
                    row.releaseRecordId !== null ? "true" : "false"
                  }
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store.getState().selectImportVerdict(row.verdictId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.verdictId}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        VERDICT_TONE[row.verdict] ?? "border-border",
                      )}
                    >
                      {formatMessage({ id: `you.hardening.import.verdict.${row.verdict}` })}
                    </Badge>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.hardening.imports.verdicts.row.artifact" })}:{" "}
                      {row.artifactRef}
                    </span>
                    <span>
                      {formatMessage({ id: "you.hardening.imports.verdicts.row.scanClass" })}:{" "}
                      {row.scanClass}
                    </span>
                    {row.quarantinedAt !== null ? (
                      <span>
                        {formatMessage({ id: "you.hardening.imports.verdicts.row.quarantinedAt" })}:{" "}
                        {row.quarantinedAt}
                      </span>
                    ) : null}
                    {row.releasedAt !== null ? (
                      <span>
                        {formatMessage({ id: "you.hardening.imports.verdicts.row.releasedAt" })}:{" "}
                        {row.releasedAt} ({row.releaseRecordId})
                      </span>
                    ) : null}
                  </span>
                  {releasable ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        data-testid="you-hardening-import-release"
                        data-you-hardening-import-release-verdict={row.verdictId}
                        onClick={() =>
                          void withBusy(() =>
                            binding.controller.releaseQuarantinedImport({
                              verdictId: row.verdictId,
                            }),
                          )
                        }
                      >
                        <UnlockIcon className="size-3.5" />
                        {formatMessage({ id: "you.hardening.imports.verdicts.release" })}
                      </Button>
                      <span className="text-ui-xs text-foreground-subtlest">
                        {formatMessage({ id: "you.hardening.imports.verdicts.releaseCaption" })}
                      </span>
                    </div>
                  ) : null}
                  <span className="sr-only">{row.accessibleLabel}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {releaseRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-hardening-import-releases-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.hardening.imports.releases.empty" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.hardening.imports.releases.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.hardening.imports.releases.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.imports.releases.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-import-releases">
            {releaseRows.map((row) => (
              <li
                key={row.releaseId}
                className="flex flex-col gap-1 rounded-md border border-border bg-surface px-2 py-1 font-mono text-ui-xs text-foreground-subtle"
                data-testid="you-hardening-import-release-record"
                data-you-hardening-import-release-id={row.releaseId}
              >
                <span className="flex flex-wrap gap-x-2">
                  <span className="text-foreground">{row.releaseId}</span>
                  <span>
                    {formatMessage({ id: "you.hardening.imports.releases.row.verdict" })}:{" "}
                    {row.verdictId}
                  </span>
                </span>
                <span className="flex flex-wrap gap-x-2">
                  <span>
                    {formatMessage({ id: "you.hardening.imports.releases.row.artifact" })}:{" "}
                    {row.artifactRef}
                  </span>
                  <span>
                    {formatMessage({ id: "you.hardening.imports.releases.row.releasedAt" })}:{" "}
                    {row.releasedAt}
                  </span>
                </span>
                <span className="sr-only">{row.accessibleLabel}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
