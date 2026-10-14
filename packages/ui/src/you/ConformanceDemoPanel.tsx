// YOU Conformance Studio — operator demo 面板（W11B）。
//
// 显式标注「Deterministic simulated demo」的剧本驱动器 UI：步骤列表 + 执行/重置 +
// 每步确定性结果摘要（预期 typed error 诚实呈现为 code + message）。demo 驱动器
//（conformanceStudioDemo.ts）只用 fixture 数据，覆盖 审查（记录/接受/重复接受/
// 零 findings/未知 scope）→ 负载（simulated/measured/invented/未注册）→ 一致性
//（partial/full/零检查）→ 旅程（完整 20 点/失败注入/越界/measured/未知）→ 手册
//（演练/claim 拒绝/未知 class）→ 终态 全闭环。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { FlaskConicalIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import {
  CONFORMANCE_DEMO_STEPS,
  CONFORMANCE_DEMO_TOTAL_STEPS,
} from "@/you/conformanceStudioDemo.js";
import type { UseConformanceStudioBinding } from "@/you/useConformanceStudio.js";
import { useConformanceMessages } from "@/you/useConformanceMessages.js";

export function ConformanceDemoPanel({
  binding,
}: {
  binding: UseConformanceStudioBinding;
}) {
  const { formatMessage } = useConformanceMessages();
  const demo = useStore(binding.store, (state) => state.demo);
  const [busy, setBusy] = useState(false);
  const outcomesByStep = useMemo(() => {
    const map = new Map<string, (typeof demo.outcomes)[number]>();
    for (const demoOutcome of demo.outcomes) {
      map.set(demoOutcome.stepId, demoOutcome);
    }
    return map;
  }, [demo.outcomes]);

  const nextStep = CONFORMANCE_DEMO_STEPS[demo.stepIndex] ?? null;

  const runNext = async () => {
    setBusy(true);
    try {
      await binding.runDemoStep();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-conformance-demo"
    >
      <section aria-label={formatMessage({ id: "you.conformance.demo.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.conformance.demo.title" })}
          </h3>
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 text-ui-xs text-foreground-subtle"
            data-testid="you-conformance-demo-badge"
          >
            <FlaskConicalIcon className="size-3" />
            {formatMessage({ id: "you.conformance.demo.badge" })}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtle">
          {formatMessage({ id: "you.conformance.demo.scriptedNote" })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-ui-xs text-foreground-subtle">
            {formatMessage(
              { id: "you.conformance.demo.step" },
              {
                current: Math.min(
                  demo.stepIndex + (demo.finished ? 0 : 1),
                  CONFORMANCE_DEMO_TOTAL_STEPS,
                ),
                total: CONFORMANCE_DEMO_TOTAL_STEPS,
              },
            )}
          </span>
          {!demo.active && !demo.finished ? (
            <Button
              type="button"
              size="sm"
              data-testid="you-conformance-demo-start"
              onClick={() => binding.startDemo()}
            >
              {formatMessage({ id: "you.conformance.demo.start" })}
            </Button>
          ) : null}
          {demo.active && nextStep ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              data-testid="you-conformance-demo-next"
              onClick={() => void runNext()}
            >
              <PlayIcon className="size-3.5" />
              {formatMessage({ id: "you.conformance.demo.next" })}
            </Button>
          ) : null}
          {demo.finished || demo.active ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              data-testid="you-conformance-demo-reset"
              onClick={() => binding.resetDemo()}
            >
              <RotateCcwIcon className="size-3.5" />
              {formatMessage({ id: "you.conformance.demo.reset" })}
            </Button>
          ) : null}
        </div>
        {demo.finished ? (
          <p
            className="mt-2 rounded-lg border border-success/40 bg-success/5 p-2 text-ui-xs text-foreground"
            data-testid="you-conformance-demo-finished"
          >
            {formatMessage({ id: "you.conformance.demo.finished" })}
          </p>
        ) : (
          <p
            className="mt-2 text-ui-xs text-foreground-subtlest"
            data-testid="you-conformance-demo-hint"
          >
            {formatMessage({ id: "you.conformance.demo.noOutcomes" })}
          </p>
        )}
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.demo.title" })}>
        <ol className="flex flex-col gap-1.5" data-testid="you-conformance-demo-steps">
          {CONFORMANCE_DEMO_STEPS.map((demoStep, index) => {
            const stepOutcome = outcomesByStep.get(demoStep.id);
            const isNext = demo.active && index === demo.stepIndex;
            return (
              <li
                key={demoStep.id}
                className={cn(
                  "rounded-md border px-2 py-1.5",
                  stepOutcome ? "border-border bg-card" : "border-border bg-surface",
                  isNext && "ring-1 ring-brand/30",
                )}
                data-testid="you-conformance-demo-step"
                data-you-conformance-demo-step-id={demoStep.id}
                data-you-conformance-demo-step-state={
                  stepOutcome ? "done" : isNext ? "next" : "todo"
                }
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                  <span className="font-mono text-ui-xs text-foreground-subtlest">
                    {index + 1}.
                  </span>
                  <span className="text-ui-xs font-medium text-foreground">
                    {formatMessage({ id: demoStep.titleMessageId })}
                  </span>
                </div>
                <p className="mt-0.5 text-ui-xs text-foreground-subtle">
                  {formatMessage({ id: demoStep.descriptionMessageId })}
                </p>
                {stepOutcome ? (
                  <p
                    className={cn(
                      "mt-1 break-all rounded-sm bg-surface p-1.5 font-mono text-ui-xs",
                      stepOutcome.summary.includes("YOU_")
                        ? "text-destructive"
                        : "text-foreground-subtle",
                    )}
                    data-testid="you-conformance-demo-outcome"
                    data-you-conformance-demo-typed-error={
                      stepOutcome.summary.includes("YOU_") ? "true" : "false"
                    }
                  >
                    {stepOutcome.summary}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
