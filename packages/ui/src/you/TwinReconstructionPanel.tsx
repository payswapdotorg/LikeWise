// YOU Twin Studio — 重建作业面板（W3B）。
//
// 验收要求：作业清单（status、method、target domains）+ 诚实 effortObservations
// （not-measured 标记原样呈现，绝不编造数字）。作业生命周期按钮走 controller 端口
// （queued → running → completed/failed），从结果发布候选版本（consent re-enforced）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { BotIcon, CircleSlashIcon, PlayIcon, RulerIcon, UploadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useTwinMessages } from "@/you/useTwinMessages.js";
import type { UseTwinStudioBinding } from "@/you/useTwinStudio.js";
import { projectEffortObservationRows } from "@/you/twinStudioProjection.js";

export function TwinReconstructionPanel({ binding }: { binding: UseTwinStudioBinding }) {
  const { formatMessage } = useTwinMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedVersionId = useStore(binding.store, (state) => state.selectedVersionId);
  const [busy, setBusy] = useState(false);

  const versionIdForJob = useMemo(() => {
    if (!snapshot) return null;
    return (
      snapshot.versions.find((candidate) => candidate.id === selectedVersionId)?.id ??
      snapshot.versions.at(-1)?.id ??
      null
    );
  }, [snapshot, selectedVersionId]);

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
      data-testid="you-twin-reconstruction"
    >
      <section aria-label={formatMessage({ id: "you.twin.reconstruction.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.twin.reconstruction.title" })}
          </h3>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-twin-jobs-count">
            {snapshot.jobs.length}
          </Badge>
        </div>

        {snapshot.jobs.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-twin-reconstruction-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.twin.reconstruction.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.twin.reconstruction.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-2" data-testid="you-twin-job-list">
            {snapshot.jobs.map((job) => (
              <li
                key={job.spec.id}
                className="rounded-lg border border-border bg-card p-2.5"
                data-testid="you-twin-job"
                data-you-twin-job-id={job.spec.id}
                data-you-twin-job-status={job.status}
                data-you-twin-job-method={job.spec.method}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="font-mono text-ui-xs text-foreground">{job.spec.id}</span>
                  <Badge
                    variant={job.status === "completed" ? "secondary" : "outline"}
                    className={cn(
                      "text-ui-xs",
                      job.status === "completed" && "text-success",
                      job.status === "running" && "text-warning",
                      job.status === "failed" && "text-destructive",
                    )}
                    data-testid="you-twin-job-status"
                  >
                    {job.status}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
                    {job.spec.method}
                  </Badge>
                </div>
                <dl className="mt-1 flex flex-col gap-0.5">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-ui-xs font-medium text-foreground-subtle">
                      {formatMessage({ id: "you.twin.reconstruction.targetDomains" })}:
                    </dt>
                    <dd
                      className="break-all font-mono text-ui-xs text-foreground"
                      data-testid="you-twin-job-domains"
                    >
                      {job.spec.targetDomains.join(", ")}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-ui-xs font-medium text-foreground-subtle">
                      {formatMessage({ id: "you.twin.reconstruction.evidenceBindings" })}:
                    </dt>
                    <dd className="font-mono text-ui-xs text-foreground">
                      {job.spec.evidenceBindings.length}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-ui-xs font-medium text-foreground-subtle">
                      {formatMessage({ id: "you.twin.versions.current" })}:
                    </dt>
                    <dd className="break-all font-mono text-ui-xs text-foreground">
                      {job.spec.twinVersionId}
                    </dd>
                  </div>
                </dl>

                {job.result ? (
                  <div className="mt-1.5 rounded-md border border-border bg-surface p-2" data-testid="you-twin-job-result">
                    <p className="text-ui-xs text-foreground-subtle">
                      {formatMessage({ id: "you.twin.reconstruction.producedBlocks" })}:{" "}
                      <span className="font-mono text-foreground">
                        {job.result.producedDomainBlocks.length}
                      </span>
                      {job.result.completedAt ? (
                        <span className="ml-1.5 font-mono text-foreground-subtlest">
                          {formatMessage({ id: "you.twin.reconstruction.completedAt" })}:{" "}
                          {job.result.completedAt}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <RulerIcon className="size-3.5 shrink-0 text-foreground-subtle" />
                        <h5 className="text-ui-xs font-semibold text-foreground">
                          {formatMessage({ id: "you.twin.reconstruction.effortTitle" })}
                        </h5>
                      </div>
                      <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
                        {formatMessage({ id: "you.twin.reconstruction.effortCaption" })}
                      </p>
                      <dl className="mt-1 flex flex-col gap-0.5" data-testid="you-twin-job-effort">
                        {projectEffortObservationRows(job.result).map((row) => (
                          <div
                            key={row.key}
                            className="flex min-w-0 flex-wrap items-baseline gap-x-1.5"
                            data-testid="you-twin-effort-row"
                            data-you-twin-effort-key={row.key}
                            data-you-twin-effort-not-measured={row.notMeasured ? "true" : "false"}
                          >
                            <dt className="min-w-0 break-all font-mono text-ui-xs text-foreground-subtle">
                              {row.key}
                            </dt>
                            <dd
                              className={cn(
                                "break-all font-mono text-ui-xs",
                                row.notMeasured
                                  ? "text-warning"
                                  : "text-foreground",
                              )}
                            >
                              {row.value}
                              {row.notMeasured ? (
                                <span className="ml-1 text-ui-xs text-warning">
                                  ({formatMessage({ id: "you.twin.reconstruction.effortNotMeasured" })})
                                </span>
                              ) : null}
                            </dd>
                            <span className="sr-only" data-testid="you-twin-effort-label">
                              {row.accessibleLabel}
                            </span>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.status === "queued" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-ui-xs"
                      disabled={busy}
                      data-testid="you-twin-job-start"
                      data-you-twin-job-id={job.spec.id}
                      onClick={() =>
                        void withBusy(() =>
                          binding.controller.startReconstructionJob({ jobId: job.spec.id }),
                        )
                      }
                    >
                      <PlayIcon className="size-3.5" />
                      {formatMessage({ id: "you.twin.reconstruction.start" })}
                    </Button>
                  ) : null}
                  {job.status === "running" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="h-6 px-2 text-ui-xs"
                        disabled={busy}
                        data-testid="you-twin-job-complete"
                        data-you-twin-job-id={job.spec.id}
                        onClick={() =>
                          void withBusy(() =>
                            binding.controller.completeReconstructionJob({ jobId: job.spec.id }),
                          )
                        }
                      >
                        {formatMessage({ id: "you.twin.reconstruction.complete" })}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-ui-xs"
                        disabled={busy}
                        data-testid="you-twin-job-fail"
                        data-you-twin-job-id={job.spec.id}
                        onClick={() =>
                          void withBusy(() =>
                            binding.controller.failReconstructionJob({
                              jobId: job.spec.id,
                              reason: "fixture: operator invoked the honest failure path",
                            }),
                          )
                        }
                      >
                        <CircleSlashIcon className="size-3.5" />
                        fail
                      </Button>
                    </>
                  ) : null}
                  {job.status === "completed" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-ui-xs"
                      disabled={busy}
                      data-testid="you-twin-job-publish"
                      data-you-twin-job-id={job.spec.id}
                      onClick={() =>
                        void withBusy(() =>
                          binding.controller.publishVersionFromJob({ jobId: job.spec.id }),
                        )
                      }
                    >
                      <UploadIcon className="size-3.5" />
                      {formatMessage({ id: "you.twin.reconstruction.publish" })}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label={formatMessage({ id: "you.twin.reconstruction.submit" })}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled={busy || versionIdForJob === null}
            data-testid="you-twin-job-submit-hybrid"
            onClick={() =>
              void withBusy(() =>
                binding.controller.submitReconstructionJob({
                  method: "hybrid",
                  targetDomains: ["geometry-skeleton", "appearance-materials"],
                  evidenceBound: true,
                }),
              )
            }
          >
            <BotIcon className="size-3.5" />
            {formatMessage({ id: "you.twin.reconstruction.submit" })} (hybrid)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || versionIdForJob === null}
            data-testid="you-twin-job-submit-unsupported"
            onClick={() =>
              void withBusy(() =>
                binding.controller.submitReconstructionJob({
                  method: "explicit-geometry",
                  targetDomains: ["voice"],
                }),
              )
            }
          >
            <CircleSlashIcon className="size-3.5" />
            unsupported (honest error)
          </Button>
        </div>
      </section>
    </div>
  );
}
