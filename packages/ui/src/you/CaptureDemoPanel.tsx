// YOU Capture Studio — operator demo 面板（W2B）。
//
// 显式标注「Deterministic simulated demo」的剧本驱动器 UI：步骤列表 + 执行/重置 +
// 每步确定性结果摘要（预期 typed error 诚实呈现为 code + message）。demo 驱动器
// （captureStudioDemo.ts）只用 fixture 数据。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { FlaskConicalIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { CAPTURE_DEMO_STEPS, CAPTURE_DEMO_TOTAL_STEPS } from "@/you/captureStudioDemo.js";
import type { UseCaptureStudioBinding } from "@/you/useCaptureStudio.js";
import { useCaptureMessages } from "@/you/useCaptureMessages.js";

export function CaptureDemoPanel({ binding }: { binding: UseCaptureStudioBinding }) {
  const { formatMessage } = useCaptureMessages();
  const demo = useStore(binding.store, (state) => state.demo);
  const [busy, setBusy] = useState(false);
  const outcomesByStep = useMemo(() => {
    const map = new Map<string, (typeof demo.outcomes)[number]>();
    for (const outcome of demo.outcomes) {
      map.set(outcome.stepId, outcome);
    }
    return map;
  }, [demo.outcomes]);

  const nextStep = CAPTURE_DEMO_STEPS[demo.stepIndex] ?? null;

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
      data-testid="you-capture-demo"
    >
      <section aria-label={formatMessage({ id: "you.capture.demo.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.capture.demo.title" })}
          </h3>
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 text-ui-xs text-foreground-subtle"
            data-testid="you-capture-demo-badge"
          >
            <FlaskConicalIcon className="size-3" />
            {formatMessage({ id: "you.capture.demo.badge" })}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtle">
          {formatMessage({ id: "you.capture.demo.scriptedNote" })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-ui-xs text-foreground-subtle">
            {formatMessage(
              { id: "you.capture.demo.step" },
              {
                current: Math.min(demo.stepIndex + (demo.finished ? 0 : 1), CAPTURE_DEMO_TOTAL_STEPS),
                total: CAPTURE_DEMO_TOTAL_STEPS,
              },
            )}
          </span>
          {!demo.active && !demo.finished ? (
            <Button
              type="button"
              size="sm"
              data-testid="you-capture-demo-start"
              onClick={() => binding.startDemo()}
            >
              {formatMessage({ id: "you.capture.demo.start" })}
            </Button>
          ) : null}
          {demo.active && nextStep ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              data-testid="you-capture-demo-next"
              onClick={() => void runNext()}
            >
              <PlayIcon className="size-3.5" />
              {formatMessage({ id: "you.capture.demo.next" })}
            </Button>
          ) : null}
          {demo.outcomes.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title={formatMessage({ id: "you.capture.demo.reset" })}
              aria-label={formatMessage({ id: "you.capture.demo.reset" })}
              data-testid="you-capture-demo-reset"
              onClick={() => binding.resetDemo()}
            >
              <RotateCcwIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>
        {demo.finished ? (
          <p
            className="mt-1.5 text-ui-xs text-success"
            data-testid="you-capture-demo-finished"
          >
            {formatMessage({ id: "you.capture.demo.finished" })}
          </p>
        ) : null}
        {nextStep && demo.active ? (
          <div className="mt-2 rounded-lg border border-border bg-card p-2">
            <p className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: nextStep.titleMessageId })}
            </p>
            <p className="mt-0.5 text-ui-xs text-foreground-subtle">
              {formatMessage({ id: nextStep.descriptionMessageId })}
            </p>
          </div>
        ) : null}
      </section>

      <section aria-label="demo steps">
        <ol className="flex flex-col gap-1" data-testid="you-capture-demo-steps">
          {CAPTURE_DEMO_STEPS.map((step, index) => {
            const outcome = outcomesByStep.get(step.id);
            const isNext = demo.active && index === demo.stepIndex;
            return (
              <li
                key={step.id}
                className={cn(
                  "rounded-md border px-2 py-1",
                  outcome
                    ? "border-border bg-card"
                    : isNext
                      ? "border-brand/40 bg-selected"
                      : "border-transparent bg-surface",
                )}
                data-testid={`you-capture-demo-step-${step.id}`}
              >
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "shrink-0 font-mono text-ui-xs",
                      outcome ? "text-success" : isNext ? "text-foreground" : "text-foreground-subtlest",
                    )}
                  >
                    {outcome ? "✓" : isNext ? "▸" : String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 text-ui-xs",
                      outcome || isNext ? "text-foreground" : "text-foreground-subtle",
                    )}
                  >
                    {formatMessage({ id: step.titleMessageId })}
                  </span>
                </div>
                {outcome ? (
                  <p className="mt-0.5 break-words pl-6 text-ui-xs text-foreground-subtle">
                    {outcome.summary}
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
