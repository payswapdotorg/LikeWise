// YOU Editing Studio — operator demo 面板（W5B）。
//
// 显式标注「Deterministic simulated demo」的剧本驱动器 UI：步骤列表 + 执行/重置 +
// 每步确定性结果摘要（预期 typed error 诚实呈现为 code + message）。demo 驱动器
//（editingStudioDemo.ts）只用 fixture 数据，覆盖 会话 → 变更集 → 候选 → 接受/拒绝
// → external 启动 → Tier-4 交换 → 接管 → 终态收束 全闭环（含六条诚实 typed 错误
// 路径：YOU_CHANGESET_INVALID / YOU_EDITOR_UNSUPPORTED / YOU_EDIT_SESSION_NOT_FOUND /
// YOU_CONSENT_REQUIRED ×2 / YOU_IMPORT_EXPORT_FAILED / 终态锁定）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { FlaskConicalIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import {
  EDITING_DEMO_STEPS,
  EDITING_DEMO_TOTAL_STEPS,
} from "@/you/editingStudioDemo.js";
import type { UseEditingStudioBinding } from "@/you/useEditingStudio.js";
import { useEditingMessages } from "@/you/useEditingMessages.js";

export function EditingDemoPanel({ binding }: { binding: UseEditingStudioBinding }) {
  const { formatMessage } = useEditingMessages();
  const demo = useStore(binding.store, (state) => state.demo);
  const [busy, setBusy] = useState(false);
  const outcomesByStep = useMemo(() => {
    const map = new Map<string, (typeof demo.outcomes)[number]>();
    for (const demoOutcome of demo.outcomes) {
      map.set(demoOutcome.stepId, demoOutcome);
    }
    return map;
  }, [demo.outcomes]);

  const nextStep = EDITING_DEMO_STEPS[demo.stepIndex] ?? null;

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
      data-testid="you-editing-demo"
    >
      <section aria-label={formatMessage({ id: "you.editing.demo.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.editing.demo.title" })}
          </h3>
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 text-ui-xs text-foreground-subtle"
            data-testid="you-editing-demo-badge"
          >
            <FlaskConicalIcon className="size-3" />
            {formatMessage({ id: "you.editing.demo.badge" })}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtle">
          {formatMessage({ id: "you.editing.demo.scriptedNote" })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-ui-xs text-foreground-subtle">
            {formatMessage(
              { id: "you.editing.demo.step" },
              {
                current: Math.min(
                  demo.stepIndex + (demo.finished ? 0 : 1),
                  EDITING_DEMO_TOTAL_STEPS,
                ),
                total: EDITING_DEMO_TOTAL_STEPS,
              },
            )}
          </span>
          {!demo.active && !demo.finished ? (
            <Button
              type="button"
              size="sm"
              data-testid="you-editing-demo-start"
              onClick={() => binding.startDemo()}
            >
              {formatMessage({ id: "you.editing.demo.start" })}
            </Button>
          ) : null}
          {demo.active && nextStep ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              data-testid="you-editing-demo-next"
              onClick={() => void runNext()}
            >
              <PlayIcon className="size-3.5" />
              {formatMessage({ id: "you.editing.demo.next" })}
            </Button>
          ) : null}
          {demo.finished || demo.active ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              data-testid="you-editing-demo-reset"
              onClick={() => binding.resetDemo()}
            >
              <RotateCcwIcon className="size-3.5" />
              {formatMessage({ id: "you.editing.demo.reset" })}
            </Button>
          ) : null}
        </div>
        {demo.finished ? (
          <p
            className="mt-2 rounded-lg border border-success/40 bg-success/5 p-2 text-ui-xs text-foreground"
            data-testid="you-editing-demo-finished"
          >
            {formatMessage({ id: "you.editing.demo.finished" })}
          </p>
        ) : (
          <p className="mt-2 text-ui-xs text-foreground-subtlest" data-testid="you-editing-demo-hint">
            {formatMessage({ id: "you.editing.demo.noOutcomes" })}
          </p>
        )}
      </section>

      <section aria-label={formatMessage({ id: "you.editing.demo.title" })}>
        <ol className="flex flex-col gap-1.5" data-testid="you-editing-demo-steps">
          {EDITING_DEMO_STEPS.map((demoStep, index) => {
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
                data-testid="you-editing-demo-step"
                data-you-editing-demo-step-id={demoStep.id}
                data-you-editing-demo-step-state={
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
                      stepOutcome.summary.includes("YOU_") ? "text-destructive" : "text-foreground-subtle",
                    )}
                    data-testid="you-editing-demo-outcome"
                    data-you-editing-demo-typed-error={
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
