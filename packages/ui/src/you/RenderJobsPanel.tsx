// YOU Performance Studio — 渲染作业面板（W4B）。
//
// 验收要求：提交渲染作业（method + outputKinds + params）+ 作业状态阶梯
// （queued/running/completed/failed）全部由 controller 投影渲染——UI 零业务逻辑。
// 方法/输出选项来自快照的 renderMethods 注册面投影（非 UI 硬编码）；evidence-bound
// 性能的提交按钮由同意门投影禁用（服务端独立强制）。effort 观察带显式 not-measured
// 标记原样呈现（truth law——绝不编造数字；单卡渲染在 RenderJobRow.tsx，按模块内聚
// 拆分以保持仓库 400 行纪律）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { usePerformanceMessages } from "@/you/usePerformanceMessages.js";
import type { UsePerformanceStudioBinding } from "@/you/usePerformanceStudio.js";
import type { RenderMethod } from "@zcode/shared";
import {
  orderedRenderJobs,
  performanceById,
  projectRenderConsentGate,
} from "@/you/performanceController.js";
import { RenderJobRow } from "@/you/RenderJobRow.js";
import {
  selectRenderMethod,
  setRenderDraftParameter,
  toggleRenderOutputKind,
} from "@/you/performanceStudioProjection.js";
import { storyboardEvidenceBoundCueCount } from "@/you/performanceStoryboard.js";

export function RenderJobsPanel({ binding }: { binding: UsePerformanceStudioBinding }) {
  const { formatMessage } = usePerformanceMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedPerformanceId = useStore(binding.store, (state) => state.selectedPerformanceId);
  const renderDraft = useStore(binding.store, (state) => state.renderDraft);
  const [busy, setBusy] = useState(false);

  const jobs = useMemo(() => orderedRenderJobs(snapshot), [snapshot]);
  const targetPerformance = useMemo(
    () =>
      performanceById(snapshot, selectedPerformanceId) ??
      snapshot?.performances.at(-1) ??
      null,
    [snapshot, selectedPerformanceId],
  );
  const consentGate = snapshot ? projectRenderConsentGate(snapshot.consent) : null;
  const evidenceBoundCues = targetPerformance
    ? storyboardEvidenceBoundCueCount(targetPerformance.timeline)
    : 0;
  const gated = evidenceBoundCues > 0;

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

  const methodProfile = snapshot.renderMethods.find(
    (profile) => profile.method === renderDraft.method,
  );
  const submitDisabledReason = !renderDraft.method
    ? formatMessage({ id: "you.performance.jobs.submitDisabledNoMethod" })
    : renderDraft.outputKinds.length === 0
      ? formatMessage({ id: "you.performance.jobs.submitDisabledNoKinds" })
      : null;

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-performance-jobs"
    >
      <section aria-label={formatMessage({ id: "you.performance.jobs.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.performance.jobs.title" })}
          </h3>
          <Badge
            variant="outline"
            className="text-ui-xs text-foreground-subtle"
            data-testid="you-performance-jobs-count"
          >
            {jobs.length}
          </Badge>
        </div>
        {jobs.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-performance-jobs-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.performance.jobs.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.performance.jobs.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-2" data-testid="you-performance-job-list">
            {jobs.map((job) => (
              <RenderJobRow
                key={job.spec.id}
                job={job}
                binding={binding}
                busy={busy}
                withBusy={withBusy}
              />
            ))}
          </ol>
        )}
      </section>

      <section aria-label={formatMessage({ id: "you.performance.jobs.submit.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.performance.jobs.submit.title" })}
        </h4>
        {targetPerformance ? (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-ui-xs text-foreground-subtle">
            <span>{formatMessage({ id: "you.performance.jobs.submit.performance" })}:</span>
            <span className="font-mono text-foreground" data-testid="you-performance-submit-target">
              {targetPerformance.id}
            </span>
            {gated ? (
              <Badge
                variant="outline"
                className="border-warning/40 font-mono text-ui-xs text-warning"
                data-testid="you-performance-submit-evidence-bound"
              >
                {evidenceBoundCues} evidence-derived
              </Badge>
            ) : null}
          </p>
        ) : null}

        <div className="mt-2 flex flex-col gap-2" data-testid="you-performance-submit-form">
          <div>
            <p className="text-ui-xs font-medium text-foreground-subtle">
              {formatMessage({ id: "you.performance.jobs.submit.method" })}
            </p>
            <div className="mt-1 flex flex-wrap gap-1" data-testid="you-performance-method-options">
              {snapshot.renderMethods.map((profile) => (
                <Button
                  key={profile.method}
                  type="button"
                  variant={renderDraft.method === profile.method ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2 font-mono text-ui-xs"
                  data-testid="you-performance-method-option"
                  data-you-performance-method={profile.method}
                  onClick={() =>
                    binding.store
                      .getState()
                      .setRenderDraft(selectRenderMethod(renderDraft, profile.method, profile))
                  }
                >
                  {profile.method}
                </Button>
              ))}
            </div>
          </div>
          {methodProfile ? (
            <div>
              <p className="text-ui-xs font-medium text-foreground-subtle">
                {formatMessage({ id: "you.performance.jobs.submit.outputKinds" })}
              </p>
              <div className="mt-1 flex flex-wrap gap-1" data-testid="you-performance-kind-options">
                {methodProfile.supportedOutputKinds.map((kind) => {
                  const selected = renderDraft.outputKinds.includes(kind);
                  return (
                    <Button
                      key={kind}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      className="h-6 px-2 font-mono text-ui-xs"
                      data-testid="you-performance-kind-option"
                      data-you-performance-kind={kind}
                      onClick={() =>
                        binding.store
                          .getState()
                          .setRenderDraft(toggleRenderOutputKind(renderDraft, kind))
                      }
                    >
                      {kind}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {methodProfile ? (
            <div>
              <p className="text-ui-xs font-medium text-foreground-subtle">
                {formatMessage({ id: "you.performance.jobs.submit.parameters" })}
              </p>
              <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.performance.jobs.submit.parametersHint" })}
              </p>
              <div className="mt-1 flex flex-col gap-1" data-testid="you-performance-render-parameters">
                {Object.entries(renderDraft.parameters)
                  .sort(([a], [b]) => (a < b ? -1 : 1))
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className="flex min-w-0 flex-wrap items-center gap-x-2 rounded-md border border-border bg-card px-2 py-1"
                      data-testid="you-performance-render-parameter-row"
                      data-you-performance-parameter-key={key}
                    >
                      <span className="min-w-0 break-all font-mono text-ui-xs text-foreground">
                        {key}
                      </span>
                      {typeof value === "boolean" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-5 px-1.5 font-mono text-ui-xs"
                          data-testid="you-performance-render-parameter-toggle"
                          onClick={() =>
                            binding.store
                              .getState()
                              .setRenderDraft(setRenderDraftParameter(renderDraft, key, !value))
                          }
                        >
                          {String(value)}
                        </Button>
                      ) : typeof value === "number" ? (
                        <span className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-5 px-1.5 text-ui-xs"
                            data-testid="you-performance-render-parameter-decrement"
                            onClick={() =>
                              binding.store
                                .getState()
                                .setRenderDraft(
                                  setRenderDraftParameter(
                                    renderDraft,
                                    key,
                                    Math.round((value - 1) * 100) / 100,
                                  ),
                                )
                            }
                          >
                            −
                          </Button>
                          <span className="min-w-10 text-center font-mono text-ui-xs text-foreground">
                            {String(value)}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-5 px-1.5 text-ui-xs"
                            data-testid="you-performance-render-parameter-increment"
                            onClick={() =>
                              binding.store
                                .getState()
                                .setRenderDraft(
                                  setRenderDraftParameter(
                                    renderDraft,
                                    key,
                                    Math.round((value + 1) * 100) / 100,
                                  ),
                                )
                            }
                          >
                            +
                          </Button>
                        </span>
                      ) : (
                        <span
                          className="min-w-0 break-all font-mono text-ui-xs text-foreground-subtle"
                          data-testid="you-performance-render-parameter-value"
                        >
                          {String(value)}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || !targetPerformance || submitDisabledReason !== null || (gated && consentGate ? !consentGate.allowed : false)}
              title={submitDisabledReason ?? undefined}
              data-testid="you-performance-job-submit"
              onClick={() => {
                if (!targetPerformance || !renderDraft.method) return;
                const method: RenderMethod = renderDraft.method;
                const outputKinds = renderDraft.outputKinds;
                const parameters = renderDraft.parameters;
                void withBusy(() =>
                  binding.controller.submitRenderJob({
                    performanceId: targetPerformance.id,
                    method,
                    outputKinds,
                    parameters,
                  }),
                );
              }}
            >
              <SparklesIcon className="size-3.5" />
              {formatMessage({ id: "you.performance.jobs.submit" })}
            </Button>
            {submitDisabledReason ? (
              <span className="text-ui-xs text-foreground-subtlest">{submitDisabledReason}</span>
            ) : null}
            {gated && consentGate ? (
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-ui-xs",
                  consentGate.allowed
                    ? "text-success"
                    : "border-warning/40 text-warning",
                )}
                data-testid="you-performance-submit-gate"
                data-you-performance-gate-allowed={consentGate.allowed ? "true" : "false"}
              >
                {consentGate.state}
              </Badge>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
