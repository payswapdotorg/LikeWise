// YOU Hardening Studio — limit notices 面板（W10B）。
//
// 验收要求：rate-limit states（deny/defer/shed 携 window 与 retry 指引）全部
// 来自 controller 投影——零 UI 业务逻辑（W1B–W9B controller 模式；模拟控制器
// 直到 T10 换绑）。enforcement 账本键盘可导航（与 Solution/Capture/Twin/
// Performance/Editing/Learning/Avatar/Escalation 表面同级的键盘可用性）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { GaugeIcon, ShieldAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useHardeningMessages } from "@/you/useHardeningMessages.js";
import type { UseHardeningStudioBinding } from "@/you/useHardeningStudio.js";
import { orderedHardeningEnforcements } from "@/you/hardeningController.js";
import {
  projectEnforcementRows,
  projectHardeningListRegionView,
  projectLimitDraftView,
  projectRetryGuidanceKind,
  resolveHardeningKeyboardTransition,
} from "@/you/hardeningStudioProjection.js";
import type { RateLimitAttemptResult } from "@/you/hardeningController.js";

const ACTION_TONE: Record<string, string> = {
  deny: "border-destructive/40 text-destructive",
  defer: "border-warning/40 text-warning",
  shed: "border-warning/40 text-warning",
};

export function HardeningLimitsPanel({
  binding,
}: {
  binding: UseHardeningStudioBinding;
}) {
  const { formatMessage } = useHardeningMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const limitDraftPolicyId = useStore(
    binding.store,
    (state) => state.limitDraftPolicyId,
  );
  const selectedEnforcementId = useStore(
    binding.store,
    (state) => state.selectedEnforcementId,
  );
  const [busy, setBusy] = useState(false);
  /** 最近一次放行尝试的即时反馈（瞬态视图态；enforcement 账本才是 canonical）。 */
  const [lastAttempt, setLastAttempt] = useState<RateLimitAttemptResult | null>(
    null,
  );

  const policies = snapshot?.policies ?? [];
  const draftView = useMemo(
    () => projectLimitDraftView({ policyId: limitDraftPolicyId }, policies),
    [limitDraftPolicyId, policies],
  );
  const enforcementRows = useMemo(
    () => projectEnforcementRows(orderedHardeningEnforcements(snapshot)),
    [snapshot],
  );
  const region = projectHardeningListRegionView(
    snapshot !== null,
    enforcementRows.length,
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
      data-testid="you-hardening-limits"
      onKeyDown={(event) => {
        // 键盘导航 = 一等交互路径（与 Solution/Capture/…/Learning 同款）。
        const action = resolveHardeningKeyboardTransition(event.key, {
          totalEnforcements: enforcementRows.length,
        });
        if (action.kind === "move") {
          event.preventDefault();
          binding.store.getState().moveEnforcementIndex(action.delta);
        } else if (action.kind === "select") {
          event.preventDefault();
          if (selectedEnforcementId !== null) {
            binding.store
              .getState()
              .selectEnforcement(selectedEnforcementId);
          }
        }
      }}
    >
      <section aria-label={formatMessage({ id: "you.hardening.limits.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <GaugeIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.hardening.limits.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {enforcementRows.length}{" "}
            {formatMessage({ id: "you.hardening.enforcements.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.limits.caption" })}
        </p>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.limits.keyboardHint" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.hardening.limits.policies.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.limits.policies.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.limits.policies.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-policies">
          {policies.map((policy) => {
            const selected = policy.id === limitDraftPolicyId;
            return (
              <li
                key={policy.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-hardening-policy"
                data-you-hardening-policy-id={policy.id}
                data-you-hardening-policy-selected={selected ? "true" : "false"}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                  onClick={() =>
                    binding.store.getState().setLimitDraftPolicy(policy.id)
                  }
                >
                  <span className="font-mono text-ui-xs text-foreground">
                    {policy.scope}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-ui-xs", ACTION_TONE[policy.action] ?? "border-border")}
                    data-you-hardening-policy-action={policy.action}
                  >
                    {formatMessage({ id: `you.hardening.limits.action.${policy.action}` })}
                  </Badge>
                </button>
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                  <span>
                    {formatMessage({ id: "you.hardening.limits.policies.window" })}:{" "}
                    {formatMessage(
                      { id: "you.hardening.limits.policies.windowS" },
                      { seconds: policy.windowS },
                    )}
                  </span>
                  <span>
                    {formatMessage({ id: "you.hardening.limits.policies.burst" })}:{" "}
                    {policy.burst}
                  </span>
                </span>
                <span className="text-ui-xs text-foreground-subtle">
                  {formatMessage({ id: `you.hardening.limits.guidance.${policy.action}` })}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.hardening.limits.enforce.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.limits.enforce.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.limits.enforce.caption" })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || draftView.disabledReason !== null}
            data-testid="you-hardening-limit-enforce"
            data-you-hardening-limit-enforce-disabled-reason={
              draftView.disabledReason ?? ""
            }
            onClick={() =>
              void withBusy(async () => {
                const attempt = await binding.controller.enforceRateLimit({
                  policyId: limitDraftPolicyId,
                });
                setLastAttempt(attempt);
                return attempt;
              })
            }
          >
            <ShieldAlertIcon className="size-3.5" />
            {formatMessage({ id: "you.hardening.limits.enforce.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.hardening.limits.enforce.disabled" })}
            </span>
          ) : null}
        </div>
        {lastAttempt && lastAttempt.allowed ? (
          <p
            className="mt-1 text-ui-xs text-foreground-subtle"
            data-testid="you-hardening-limit-attempt-allowed"
          >
            {formatMessage(
              { id: "you.hardening.limits.enforce.attemptAllowed" },
              {
                remaining: lastAttempt.remaining,
                burst: draftView.burst ?? 0,
                windowS: draftView.windowS ?? 0,
              },
            )}
          </p>
        ) : null}
      </section>

      {region === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-hardening-limits-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.hardening.limits.ledger.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.limits.ledger.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.hardening.limits.ledger.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.hardening.limits.ledger.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.limits.ledger.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-enforcements">
            {enforcementRows.map((row) => {
              const selected = row.enforcementId === selectedEnforcementId;
              return (
                <li
                  key={row.enforcementId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-hardening-enforcement"
                  data-you-hardening-enforcement-id={row.enforcementId}
                  data-you-hardening-enforcement-action={row.action}
                  data-you-hardening-enforcement-selected={selected ? "true" : "false"}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store.getState().selectEnforcement(row.enforcementId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.scope}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        ACTION_TONE[row.action] ?? "border-border",
                      )}
                    >
                      {formatMessage({ id: `you.hardening.limits.action.${row.action}` })}
                    </Badge>
                    <span className="text-ui-xs text-foreground-subtle">
                      {projectRetryGuidanceKind(row.retryAfterS) === "immediate"
                        ? formatMessage({ id: "you.hardening.limits.retryKind.immediate" })
                        : formatMessage({ id: "you.hardening.limits.retryKind.windowed" })}
                    </span>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.hardening.limits.ledger.row.policy" })}:{" "}
                      {row.policyId}
                    </span>
                    <span>
                      {formatMessage({ id: "you.hardening.limits.ledger.row.window" })}:{" "}
                      {formatMessage(
                        { id: "you.hardening.limits.ledger.retryS" },
                        { seconds: row.windowS },
                      )}
                    </span>
                    <span>
                      {formatMessage({ id: "you.hardening.limits.ledger.row.retry" })}:{" "}
                      {formatMessage(
                        { id: "you.hardening.limits.ledger.retryS" },
                        { seconds: row.retryAfterS },
                      )}
                    </span>
                    <span>
                      {formatMessage({ id: "you.hardening.limits.ledger.row.enforcedAt" })}:{" "}
                      {row.enforcedAt}
                    </span>
                  </span>
                  <span className="text-ui-xs text-foreground-subtle">
                    {formatMessage({ id: `you.hardening.limits.guidance.${row.action}` })}
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
