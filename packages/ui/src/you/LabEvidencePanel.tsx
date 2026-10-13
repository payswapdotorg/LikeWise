// YOU Lab Studio — 证据面板（W9B）。
//
// 验收要求：evidence surface——LabEvidenceManifest 面板（内容寻址 artifact 标签 +
// 校验状态）：发布（honest / tampered 完整性挑选——与 W8B 过期预设同款诚实路径）、
// 校验（重算 contentHash；mismatch/未知 ⇒ typed YOU_LAB_EVIDENCE_MANIFEST_INVALID
// 拒绝——失败校验作为观察落账）。发布经 controller 端口投射意图。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { FileCheckIcon, PackageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useLabMessages } from "@/you/useLabMessages.js";
import type { UseLabStudioBinding } from "@/you/useLabStudio.js";
import {
  labManifestById,
  labRunById,
  labRunsOfExperiment,
  labExperimentById,
} from "@/you/labController.js";
import { projectLabListRegionView, projectManifestRows } from "@/you/labStudioProjection.js";

export function LabEvidencePanel({ binding }: { binding: UseLabStudioBinding }) {
  const { formatMessage } = useLabMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedExperimentId = useStore(binding.store, (state) => state.selectedExperimentId);
  const selectedRunId = useStore(binding.store, (state) => state.selectedRunId);
  const selectedManifestId = useStore(binding.store, (state) => state.selectedManifestId);
  const manifestIntegrity = useStore(binding.store, (state) => state.manifestIntegrity);
  const [busy, setBusy] = useState(false);

  const experiment = useMemo(
    () => labExperimentById(snapshot, selectedExperimentId),
    [snapshot, selectedExperimentId],
  );
  const experimentRuns = useMemo(
    () => labRunsOfExperiment(snapshot, selectedExperimentId),
    [snapshot, selectedExperimentId],
  );
  const experimentManifests = useMemo(
    () =>
      (snapshot?.manifests ?? []).filter((entry) =>
        experimentRuns.some((run) => run.id === entry.manifest.runId),
      ),
    [snapshot, experimentRuns],
  );
  const manifestRows = useMemo(
    () => projectManifestRows(experimentManifests),
    [experimentManifests],
  );
  const selectedRun = useMemo(
    () => labRunById(snapshot, selectedRunId),
    [snapshot, selectedRunId],
  );
  const selectedManifest = useMemo(
    () => labManifestById(snapshot, selectedManifestId),
    [snapshot, selectedManifestId],
  );
  const region = projectLabListRegionView(snapshot !== null, manifestRows.length);
  const terminalRunSelected =
    selectedRun?.status === "succeeded" ||
    selectedRun?.status === "failed" ||
    selectedRun?.status === "retired";

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
      data-testid="you-lab-evidence"
    >
      <section aria-label={formatMessage({ id: "you.lab.evidence.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <PackageIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.lab.evidence.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {experiment ? `${experiment.id} · ${manifestRows.length} ${formatMessage({ id: "you.lab.evidence.count" })}` : "—"}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.evidence.caption" })}
        </p>
      </section>

      {region === "empty" ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-lab-evidence-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.lab.evidence.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.lab.evidence.emptyHint" })}
          </p>
        </div>
      ) : (
        <section>
          <ol className="flex flex-col gap-1.5" data-testid="you-lab-manifests-list">
            {manifestRows.map((row) => {
              const selected = row.manifestId === selectedManifestId;
              return (
                <li
                  key={row.manifestId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-lab-manifest-row"
                  data-you-lab-manifest-id={row.manifestId}
                  data-you-lab-manifest-verification={row.verification}
                  data-you-lab-manifest-selected={selected ? "true" : "false"}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() => binding.store.getState().selectManifest(row.manifestId)}
                  >
                    <span className="font-mono text-ui-xs text-foreground">{row.manifestId}</span>
                    <span className="font-mono text-ui-xs text-foreground-subtle">
                      {formatMessage({ id: "you.lab.evidence.manifest.run" })}: {row.runId}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 text-ui-xs",
                        row.verification === "verified"
                          ? "border-success/40 text-success"
                          : row.verification === "mismatch"
                            ? "border-destructive/40 text-destructive"
                            : "border-border text-foreground-subtle",
                      )}
                    >
                      <FileCheckIcon className="size-3" />
                      {formatMessage({ id: `you.lab.evidence.verification.${row.verification}` })}
                    </Badge>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.lab.evidence.manifest.contentHash" })}:{" "}
                      {row.contentHash.slice(0, 28)}…
                    </span>
                    <span>
                      {formatMessage({ id: "you.lab.evidence.manifest.publishedAt" })}: {row.publishedAt}
                    </span>
                    {row.verifiedAt !== null ? (
                      <span>
                        {formatMessage({ id: "you.lab.evidence.manifest.verifiedAt" })}: {row.verifiedAt}
                      </span>
                    ) : null}
                  </span>
                  <div className="flex flex-wrap gap-1" data-testid="you-lab-manifest-artifacts">
                    {row.artifactRows.map((artifact) => (
                      <span
                        key={artifact.index}
                        className="rounded-sm border border-border bg-card px-1 font-mono text-ui-xs text-foreground-subtle"
                        data-testid="you-lab-manifest-artifact"
                        data-you-lab-artifact-ref={artifact.artifactRef}
                      >
                        {formatMessage({ id: "you.lab.contentRef" })} {artifact.artifactRef.slice(0, 18)}…
                      </span>
                    ))}
                  </div>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section aria-label={formatMessage({ id: "you.lab.evidence.publish.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.lab.evidence.publish.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.evidence.publish.caption" })}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1" data-testid="you-lab-integrity-options">
          {snapshot.manifestIntegrities.map((integrity) => {
            const selected = integrity === manifestIntegrity;
            return (
              <Button
                key={integrity}
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className={cn(
                  "h-6 px-2 text-ui-xs",
                  selected && "border-primary/60 bg-primary/10 text-primary",
                  integrity === "tampered" && "border-warning/40 text-warning",
                )}
                data-testid="you-lab-integrity-option"
                data-you-lab-integrity={integrity}
                aria-pressed={selected}
                onClick={() => binding.store.getState().setManifestIntegrity(integrity)}
              >
                {formatMessage({ id: `you.lab.evidence.publish.integrity.${integrity}` })}
              </Button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || selectedRunId === null || !terminalRunSelected}
            data-testid="you-lab-manifest-publish"
            onClick={() =>
              void withBusy(() =>
                binding.controller.publishEvidenceManifest({
                  runId: selectedRunId ?? "",
                  integrity: manifestIntegrity,
                }),
              )
            }
          >
            {formatMessage({ id: "you.lab.evidence.publish.apply" })}
          </Button>
          {selectedRun && !terminalRunSelected ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.lab.evidence.publish.disabled" })}
            </span>
          ) : null}
        </div>
      </section>

      <section aria-label={formatMessage({ id: "you.lab.evidence.verify" })}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || selectedManifestId === null}
            data-testid="you-lab-manifest-verify"
            onClick={() =>
              void withBusy(() =>
                binding.controller.verifyEvidenceManifest({
                  manifestId: selectedManifestId ?? "",
                }),
              )
            }
          >
            <FileCheckIcon className="size-3.5" />
            {formatMessage({ id: "you.lab.evidence.verify" })}
          </Button>
          {selectedManifest ? (
            <span className="font-mono text-ui-xs text-foreground-subtle">
              {selectedManifest.manifest.id} ·{" "}
              {formatMessage({
                id: `you.lab.evidence.verification.${selectedManifest.verification}`,
              })}
            </span>
          ) : (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.lab.evidence.verifyDisabled" })}
            </span>
          )}
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.evidence.verifyCaption" })}
        </p>
      </section>
    </div>
  );
}
