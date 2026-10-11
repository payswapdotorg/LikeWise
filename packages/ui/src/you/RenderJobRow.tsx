// YOU Performance Studio — 渲染作业卡片组件（W4B）。
//
// 单个渲染作业的只读卡片：spec（method / performance / outputKinds / plain typed
// 参数）、状态阶梯（queued → running → completed | failed——全部由 controller 投影
// 渲染）、终态 result（内容寻址 artifacts 计数 + 诚实 not-measured effort 观察）与
// 生命周期操作按钮（Start / Complete / fail——走 controller 端口）。从 RenderJobsPanel
// 按模块内聚拆分（保持仓库 400 行纪律）。
import { CircleSlashIcon, PlayIcon, RulerIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { usePerformanceMessages } from "@/you/usePerformanceMessages.js";
import type { UsePerformanceStudioBinding } from "@/you/usePerformanceStudio.js";
import type { RenderJobView } from "@/you/performanceController.js";
import {
  projectRenderEffortRows,
  projectRenderJobLadder,
  projectRenderJobSpecRow,
} from "@/you/performanceStudioProjection.js";

export function RenderJobRow({
  job,
  binding,
  busy,
  withBusy,
}: {
  job: RenderJobView;
  binding: UsePerformanceStudioBinding;
  busy: boolean;
  withBusy: (operation: () => Promise<unknown>) => Promise<void>;
}) {
  const { formatMessage } = usePerformanceMessages();
  const specRow = projectRenderJobSpecRow(job);
  const ladder = projectRenderJobLadder(job.status);
  const effortRows = projectRenderEffortRows(job);

  return (
    <li
      className="rounded-lg border border-border bg-card p-2.5"
      data-testid="you-performance-job"
      data-you-performance-job-id={job.spec.id}
      data-you-performance-job-status={job.status}
      data-you-performance-job-method={job.spec.method}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="font-mono text-ui-xs text-foreground">{specRow.jobId}</span>
        <Badge
          variant={job.status === "completed" ? "secondary" : "outline"}
          className={cn(
            "font-mono text-ui-xs",
            job.status === "completed" && "text-success",
            job.status === "running" && "text-warning",
            job.status === "failed" && "text-destructive",
          )}
          data-testid="you-performance-job-status"
        >
          {formatMessage({ id: `you.performance.jobs.status.${job.status}` })}
        </Badge>
        <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
          {specRow.method}
        </Badge>
      </div>
      <dl className="mt-1 flex flex-col gap-0.5">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.performance.jobs.submit.performance" })}:
          </dt>
          <dd className="break-all font-mono text-ui-xs text-foreground" data-testid="you-performance-job-performance">
            {specRow.performanceId}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.performance.jobs.outputKinds" })}:
          </dt>
          <dd className="break-all font-mono text-ui-xs text-foreground" data-testid="you-performance-job-kinds">
            {specRow.outputKinds.join(", ")}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.performance.jobs.spec" })}:
          </dt>
          <dd className="break-all font-mono text-ui-xs text-foreground-subtle" data-testid="you-performance-job-params">
            {specRow.parameterEntries.map((entry) => `${entry.key}=${entry.value}`).join(" ")}
          </dd>
        </div>
      </dl>

      {/* 状态阶梯（queued → running → completed | failed；由投影渲染）。 */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1" data-testid="you-performance-job-ladder">
        <span className="text-ui-xs font-medium text-foreground-subtle">
          {formatMessage({ id: "you.performance.jobs.ladder" })}:
        </span>
        {ladder.map((step) => (
          <Badge
            key={step.status}
            variant={step.current ? "secondary" : "outline"}
            className={cn(
              "font-mono text-ui-xs",
              step.current && step.status === "completed" && "text-success",
              step.current && step.status === "failed" && "text-destructive",
              step.current && step.status === "running" && "text-warning",
              !step.reached && "text-foreground-subtlest",
            )}
            data-testid="you-performance-job-ladder-step"
            data-you-performance-ladder-status={step.status}
            data-you-performance-ladder-reached={step.reached ? "true" : "false"}
          >
            {formatMessage({ id: `you.performance.jobs.status.${step.status}` })}
          </Badge>
        ))}
      </div>

      {job.result ? (
        <div className="mt-1.5 rounded-md border border-border bg-surface p-2" data-testid="you-performance-job-result">
          <p className="text-ui-xs text-foreground-subtle">
            {formatMessage({ id: "you.performance.jobs.artifacts" })}:{" "}
            <span className="font-mono text-foreground">{specRow.artifactCount}</span>
            {specRow.completedAt ? (
              <span className="ml-1.5 font-mono text-foreground-subtlest">
                {formatMessage({ id: "you.performance.jobs.completedAt" })}: {specRow.completedAt}
              </span>
            ) : null}
          </p>
          {specRow.failureReason ? (
            <p className="mt-1 break-all font-mono text-ui-xs text-destructive" data-testid="you-performance-job-failure">
              {formatMessage({ id: "you.performance.jobs.failureReason" })}: {specRow.failureReason}
            </p>
          ) : null}
          <div className="mt-1.5">
            <div className="flex items-center gap-1.5">
              <RulerIcon className="size-3.5 shrink-0 text-foreground-subtle" />
              <h5 className="text-ui-xs font-semibold text-foreground">
                {formatMessage({ id: "you.performance.jobs.effortTitle" })}
              </h5>
            </div>
            <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.performance.jobs.effortCaption" })}
            </p>
            <dl className="mt-1 flex flex-col gap-0.5" data-testid="you-performance-job-effort">
              {effortRows.map((row) => (
                <div
                  key={row.key}
                  className="flex min-w-0 flex-wrap items-baseline gap-x-1.5"
                  data-testid="you-performance-effort-row"
                  data-you-performance-effort-key={row.key}
                  data-you-performance-effort-not-measured={row.notMeasured ? "true" : "false"}
                >
                  <dt className="min-w-0 break-all font-mono text-ui-xs text-foreground-subtle">
                    {row.key}
                  </dt>
                  <dd
                    className={cn(
                      "break-all font-mono text-ui-xs",
                      row.notMeasured ? "text-warning" : "text-foreground",
                    )}
                  >
                    {row.value}
                    {row.notMeasured ? (
                      <span className="ml-1 text-ui-xs text-warning">
                        ({formatMessage({ id: "you.performance.jobs.effortNotMeasured" })})
                      </span>
                    ) : null}
                  </dd>
                  <span className="sr-only" data-testid="you-performance-effort-label">
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
            data-testid="you-performance-job-start"
            data-you-performance-job-id={job.spec.id}
            onClick={() =>
              void withBusy(() => binding.controller.startRenderJob({ jobId: job.spec.id }))
            }
          >
            <PlayIcon className="size-3.5" />
            {formatMessage({ id: "you.performance.jobs.start" })}
          </Button>
        ) : null}
        {job.status === "running" ? (
          <>
            <Button
              type="button"
              size="sm"
              className="h-6 px-2 text-ui-xs"
              disabled={busy}
              data-testid="you-performance-job-complete"
              data-you-performance-job-id={job.spec.id}
              onClick={() =>
                void withBusy(() => binding.controller.completeRenderJob({ jobId: job.spec.id }))
              }
            >
              {formatMessage({ id: "you.performance.jobs.complete" })}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-ui-xs text-destructive"
              disabled={busy}
              data-testid="you-performance-job-fail"
              data-you-performance-job-id={job.spec.id}
              onClick={() =>
                void withBusy(() =>
                  binding.controller.failRenderJob({
                    jobId: job.spec.id,
                    reason: "fixture: operator invoked the honest failure path",
                  }),
                )
              }
            >
              <CircleSlashIcon className="size-3.5" />
              {formatMessage({ id: "you.performance.jobs.fail" })}
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}
