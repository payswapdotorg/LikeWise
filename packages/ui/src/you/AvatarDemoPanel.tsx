// YOU Avatar Studio — operator demo 面板（W7B）。
//
// 显式标注「Deterministic simulated demo」的剧本驱动器 UI：步骤列表 + 执行/重置 +
// 每步确定性结果摘要（预期 typed error 诚实呈现为 code + message）。demo 驱动器
//（avatarStudioDemo.ts）只用 fixture 数据，覆盖 挑选 → 附身 → 阶梯 → 再附身 →
// 关闭 全闭环（含九条诚实 typed 错误路径：YOU_SOUL_BINDING_INVALID /
// YOU_INVALID_STATE / YOU_BODY_NOT_FOUND / YOU_EMBODIMENT_STATE_INVALID ×5
//（自环 / unavailable / 越界档位 / 挂起期间 / 终态）/
// YOU_AVATAR_SESSION_NOT_FOUND）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { FlaskConicalIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import {
  AVATAR_DEMO_STEPS,
  AVATAR_DEMO_TOTAL_STEPS,
} from "@/you/avatarStudioDemo.js";
import type { UseAvatarStudioBinding } from "@/you/useAvatarStudio.js";
import { useAvatarMessages } from "@/you/useAvatarMessages.js";

export function AvatarDemoPanel({ binding }: { binding: UseAvatarStudioBinding }) {
  const { formatMessage } = useAvatarMessages();
  const demo = useStore(binding.store, (state) => state.demo);
  const [busy, setBusy] = useState(false);
  const outcomesByStep = useMemo(() => {
    const map = new Map<string, (typeof demo.outcomes)[number]>();
    for (const demoOutcome of demo.outcomes) {
      map.set(demoOutcome.stepId, demoOutcome);
    }
    return map;
  }, [demo.outcomes]);

  const nextStep = AVATAR_DEMO_STEPS[demo.stepIndex] ?? null;

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
      data-testid="you-avatar-demo"
    >
      <section aria-label={formatMessage({ id: "you.avatar.demo.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.avatar.demo.title" })}
          </h3>
          <Badge
            variant="outline"
            className="gap-1 border-warning/40 text-ui-xs text-foreground-subtle"
            data-testid="you-avatar-demo-badge"
          >
            <FlaskConicalIcon className="size-3" />
            {formatMessage({ id: "you.avatar.demo.badge" })}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtle">
          {formatMessage({ id: "you.avatar.demo.scriptedNote" })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-ui-xs text-foreground-subtle">
            {formatMessage(
              { id: "you.avatar.demo.step" },
              {
                current: Math.min(
                  demo.stepIndex + (demo.finished ? 0 : 1),
                  AVATAR_DEMO_TOTAL_STEPS,
                ),
                total: AVATAR_DEMO_TOTAL_STEPS,
              },
            )}
          </span>
          {!demo.active && !demo.finished ? (
            <Button
              type="button"
              size="sm"
              data-testid="you-avatar-demo-start"
              onClick={() => binding.startDemo()}
            >
              {formatMessage({ id: "you.avatar.demo.start" })}
            </Button>
          ) : null}
          {demo.active && nextStep ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              data-testid="you-avatar-demo-next"
              onClick={() => void runNext()}
            >
              <PlayIcon className="size-3.5" />
              {formatMessage({ id: "you.avatar.demo.next" })}
            </Button>
          ) : null}
          {demo.finished || demo.active ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              data-testid="you-avatar-demo-reset"
              onClick={() => binding.resetDemo()}
            >
              <RotateCcwIcon className="size-3.5" />
              {formatMessage({ id: "you.avatar.demo.reset" })}
            </Button>
          ) : null}
        </div>
        {demo.finished ? (
          <p
            className="mt-2 rounded-lg border border-success/40 bg-success/5 p-2 text-ui-xs text-foreground"
            data-testid="you-avatar-demo-finished"
          >
            {formatMessage({ id: "you.avatar.demo.finished" })}
          </p>
        ) : (
          <p className="mt-2 text-ui-xs text-foreground-subtlest" data-testid="you-avatar-demo-hint">
            {formatMessage({ id: "you.avatar.demo.noOutcomes" })}
          </p>
        )}
      </section>

      <section aria-label={formatMessage({ id: "you.avatar.demo.title" })}>
        <ol className="flex flex-col gap-1.5" data-testid="you-avatar-demo-steps">
          {AVATAR_DEMO_STEPS.map((demoStep, index) => {
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
                data-testid="you-avatar-demo-step"
                data-you-avatar-demo-step-id={demoStep.id}
                data-you-avatar-demo-step-state={
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
                    data-testid="you-avatar-demo-outcome"
                    data-you-avatar-demo-typed-error={
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
