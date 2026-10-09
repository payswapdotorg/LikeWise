/* oxlint-disable eslint(max-lines) -- 引导采集面板集中承载会话卡、进度、键盘可导航的引导步骤列表与采集/完成/拒绝操作；拆散会让键盘转移表与列表渲染跨文件跳转，先保持单文件收口。 */
// YOU Capture Studio — 引导采集面板（W2B）。
//
// 验收要求：渲染 CaptureSession + CaptureGuideSteps（进度、每步首选取景、
// 显式 synthetic/fixture 标注）；键盘导航与 Solution 视口同级（纯转移表
// resolveCaptureGuideKeyboardTransition 可测：方向键/Home/End 移动，Enter 捕获）。
// 采集按钮被同意门投影禁用（「无许可 ⇒ 不处理」可见），服务端独立强制。
import { useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useStore } from "zustand";
import { CheckIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/components/lib/utils.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Progress } from "@/components/ui/progress.js";
import { currentCaptureSession, projectOperationalProcessingGate } from "@/you/captureController.js";
import { projectCaptureProgress, resolveCaptureGuideKeyboardTransition } from "@/you/captureStudioProjection.js";
import type { UseCaptureStudioBinding } from "@/you/useCaptureStudio.js";
import { useCaptureMessages } from "@/you/useCaptureMessages.js";

export function CaptureSessionPanel({ binding }: { binding: UseCaptureStudioBinding }) {
  const { formatMessage } = useCaptureMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const activeCaptureSessionId = useStore(binding.store, (state) => state.activeCaptureSessionId);
  const guideStepIndex = useStore(binding.store, (state) => state.guideStepIndex);
  const [busy, setBusy] = useState(false);

  const session = useMemo(() => {
    if (!snapshot) return null;
    return (
      snapshot.captureSessions.find((candidate) => candidate.id === activeCaptureSessionId) ??
      currentCaptureSession(snapshot)
    );
  }, [snapshot, activeCaptureSessionId]);

  const progress = useMemo(
    () => (snapshot && session ? projectCaptureProgress(session, snapshot.captureStepBindings) : null),
    [snapshot, session],
  );

  const operationalGate = snapshot ? projectOperationalProcessingGate(snapshot.consent) : null;
  const currentStep = session?.guideSteps[guideStepIndex] ?? null;

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  const captureCurrent = useCallback(() => {
    if (!session || !currentStep) return;
    void withBusy(() =>
      binding.controller.captureGuideStep({ sessionId: session.id, stepId: currentStep.id }),
    );
  }, [binding, currentStep, session]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!session) return;
      const action = resolveCaptureGuideKeyboardTransition(event.key, {
        sessionActive: session.status === "active",
        totalSteps: session.guideSteps.length,
      });
      if (action.kind === "none") return;
      event.preventDefault();
      if (action.kind === "move") {
        binding.store.getState().moveGuideStep(action.delta);
        return;
      }
      captureCurrent();
    },
    [binding, captureCurrent, session],
  );

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-2 p-6"
        data-testid="you-capture-session-empty"
      >
        <p className="text-ui-base text-foreground-subtle">
          {formatMessage({ id: "you.capture.capture.noSession" })}
        </p>
        <p className="max-w-[24rem] text-center text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.capture.capture.noSessionHint" })}
        </p>
      </div>
    );
  }

  const capturedEvidenceByStep = new Map<string, string>();
  for (const stepBinding of snapshot.captureStepBindings) {
    if (stepBinding.captureSessionId === session.id && !capturedEvidenceByStep.has(stepBinding.stepId)) {
      const record = snapshot.evidenceRecords.find((candidate) => candidate.id === stepBinding.evidenceId);
      if (record) {
        capturedEvidenceByStep.set(stepBinding.stepId, record.id);
      }
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-capture-session"
      data-you-capture-session-id={session.id}
    >
      <section aria-label={formatMessage({ id: "you.capture.capture.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.capture.capture.title" })}
          </h3>
          <Badge
            variant={session.status === "active" ? "secondary" : "outline"}
            className={cn(
              "text-ui-xs",
              session.status === "active" && "text-success",
              (session.status === "declined" || session.status === "expired") && "text-warning",
            )}
            data-testid="you-capture-session-status"
          >
            {session.status}
          </Badge>
        </div>
        <p className="mt-1 font-mono text-ui-xs text-foreground-subtlest">{session.id}</p>
        {progress ? (
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-ui-xs text-foreground-subtle" data-testid="you-capture-session-progress">
                {formatMessage(
                  { id: "you.capture.capture.progress" },
                  { captured: progress.capturedSteps, total: progress.totalSteps },
                )}
              </span>
              <span className="font-mono text-ui-xs text-foreground-subtlest">
                {session.consent.policyId} · {session.consent.state}
              </span>
            </div>
            <Progress
              value={
                progress.totalSteps > 0
                  ? (progress.capturedSteps / progress.totalSteps) * 100
                  : 0
              }
              aria-label={formatMessage(
                { id: "you.capture.capture.progress" },
                { captured: progress.capturedSteps, total: progress.totalSteps },
              )}
            />
          </div>
        ) : null}
      </section>

      <section aria-label={formatMessage({ id: "you.capture.capture.guideSteps" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.capture.capture.guideSteps" })}
        </h4>
        <div
          role="listbox"
          aria-label={formatMessage({ id: "you.capture.capture.guideSteps" })}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-border p-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          data-testid="you-capture-guide-steps"
        >
          {session.guideSteps.map((guideStep, index) => {
            const capturedEvidenceId = capturedEvidenceByStep.get(guideStep.id) ?? null;
            const isCurrent = index === guideStepIndex;
            return (
              <div
                key={guideStep.id}
                role="option"
                aria-selected={isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "rounded-md border px-2 py-1.5",
                  isCurrent
                    ? "border-brand/50 bg-selected"
                    : capturedEvidenceId
                      ? "border-border bg-card"
                      : "border-transparent bg-surface",
                )}
                data-testid="you-capture-guide-step"
                data-you-capture-guide-step-id={guideStep.id}
                data-you-capture-step-captured={capturedEvidenceId ? "true" : "false"}
              >
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "shrink-0 font-mono text-ui-xs",
                      capturedEvidenceId
                        ? "text-success"
                        : isCurrent
                          ? "text-foreground"
                          : "text-foreground-subtlest",
                    )}
                  >
                    {capturedEvidenceId ? "✓" : String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 text-ui-xs font-medium",
                      isCurrent || capturedEvidenceId ? "text-foreground" : "text-foreground-subtle",
                    )}
                  >
                    {formatMessage({ id: "you.capture.capture.step" }, { index: index + 1 })}
                  </span>
                  {guideStep.requiredModality ? (
                    <Badge variant="outline" className="ml-auto shrink-0 text-ui-xs">
                      {guideStep.requiredModality}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 break-words pl-6 text-ui-xs text-foreground-subtle">
                  {guideStep.instruction}
                </p>
                {guideStep.preferredFraming ? (
                  <p className="mt-0.5 break-words pl-6 text-ui-xs text-foreground-subtlest">
                    <span className="font-medium text-foreground-subtle">
                      {formatMessage({ id: "you.capture.capture.stepFraming" })}:{" "}
                    </span>
                    {guideStep.preferredFraming}
                  </p>
                ) : null}
                {capturedEvidenceId ? (
                  <p className="mt-0.5 pl-6 font-mono text-ui-xs text-success">
                    {formatMessage({ id: "you.capture.capture.capturedEvidence" })}:{" "}
                    {capturedEvidenceId}{" "}
                    <span className="text-foreground-subtlest">
                      ({formatMessage({ id: "you.capture.simulatedNote" })})
                    </span>
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.capture.capture.keyboardHint" })}
        </p>
      </section>

      <section className="flex flex-col gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 self-start text-ui-xs"
          disabled={
            busy ||
            !currentStep ||
            session.status !== "active" ||
            (operationalGate ? !operationalGate.allowed : true)
          }
          title={
            operationalGate && !operationalGate.allowed
              ? formatMessage({ id: "you.capture.capture.captureCurrentBlocked" })
              : undefined
          }
          data-testid="you-capture-step-capture"
          data-you-capture-guide-step-id={currentStep?.id ?? ""}
          onClick={captureCurrent}
        >
          <CheckIcon className="size-3.5" />
          {formatMessage({ id: "you.capture.capture.captureCurrent" })}
        </Button>
        {operationalGate && !operationalGate.allowed ? (
          <p
            className="text-ui-xs text-warning"
            data-testid="you-capture-step-capture-blocked"
          >
            {formatMessage({ id: "you.capture.capture.captureCurrentBlocked" })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-6 px-2 text-ui-xs"
            disabled={
              busy ||
              session.status !== "active" ||
              !(progress?.complete ?? false)
            }
            data-testid="you-capture-session-complete"
            onClick={() => withBusy(() => binding.controller.completeCaptureSession(session.id))}
          >
            {formatMessage({ id: "you.capture.capture.complete" })}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-ui-xs"
            disabled={
              busy ||
              session.status === "completed" ||
              session.status === "declined" ||
              session.status === "expired"
            }
            data-testid="you-capture-session-decline"
            onClick={() => withBusy(() => binding.controller.declineCaptureSession(session.id))}
          >
            <XCircleIcon className="size-3.5" />
            {formatMessage({ id: "you.capture.capture.decline" })}
          </Button>
        </div>
      </section>

      <p className="shrink-0 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.capture.capture.simulatedNote" })}
      </p>
    </div>
  );
}
