// YOU Capture Studio — 同意面板（W2B）。
//
// SECURITY.md 同意职责的 UX 落点：explicit（按用途 grant/deny）、scoped（作用域
// 可见）、revocable（撤回控制）、purpose-specific、学习复用**独立**记录；
// 「无许可 ⇒ 不处理」作为显式可见状态（gate 列表 + 表头 chip）。
// 门状态只是服务端强制的镜像（UI 禁用按钮）；服务端独立拒绝无同意的处理。
import { useState } from "react";
import { useStore } from "zustand";
import { BanIcon, CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/components/lib/utils.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Label } from "@/components/ui/label.js";
import { Switch } from "@/components/ui/switch.js";
import {
  projectConsentProcessingGate,
  projectLearningReuseGate,
  projectOperationalProcessingGate,
} from "@/you/captureController.js";
import type { UseCaptureStudioBinding } from "@/you/useCaptureStudio.js";
import { useCaptureMessages } from "@/you/useCaptureMessages.js";

export function CaptureConsentPanel({ binding }: { binding: UseCaptureStudioBinding }) {
  const { formatMessage } = useCaptureMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const [busy, setBusy] = useState(false);

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  const consent = snapshot.consent;
  const policy = consent.policy;
  const operationalGate = projectOperationalProcessingGate(consent);
  const learningGate = projectLearningReuseGate(consent);
  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-capture-consent"
    >
      <section aria-label={formatMessage({ id: "you.capture.consent.policy" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.capture.consent.title" })}
        </h3>
        <div
          className="mt-2 rounded-lg border border-border bg-card p-2.5"
          data-testid="you-capture-consent-policy"
        >
          <p className="font-mono text-ui-xs text-foreground-subtlest">{policy.id}</p>
          <dl className="mt-1 flex flex-col gap-0.5 text-ui-xs">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground-subtle">
                {formatMessage({ id: "you.capture.consent.scope" })}:
              </dt>
              <dd className="font-mono text-foreground">{policy.scope}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-foreground-subtle">
                {formatMessage({ id: "you.capture.consent.revocable" })}:
              </dt>
              <dd className="font-mono text-foreground">
                {formatMessage({ id: policy.revocable ? "you.capture.consent.yes" : "you.capture.consent.no" })}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground-subtle">
                {formatMessage({ id: "you.capture.consent.retention" })}:
              </dt>
              <dd className="mt-0.5 text-foreground-subtle">
                {policy.retention.policy}
                {policy.retention.deleteAfter ? ` (${policy.retention.deleteAfter})` : ""} —{" "}
                {policy.retention.reason}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-label={formatMessage({ id: "you.capture.consent.purposes" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.capture.consent.purposes" })}
        </h4>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {consent.purposeStates.map((entry) => {
            const gate = projectConsentProcessingGate(consent, entry.purpose);
            return (
              <li
                key={entry.purpose}
                className="rounded-lg border border-border bg-card p-2"
                data-testid="you-capture-consent-purpose"
                data-you-capture-purpose={entry.purpose}
                data-you-capture-purpose-state={entry.state}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 font-mono text-ui-xs text-foreground">
                    {entry.purpose}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-ui-xs",
                      gate.allowed ? "text-success" : "text-warning",
                    )}
                  >
                    {formatMessage({ id: `you.capture.consent.state.${entry.state}` })}
                  </Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 px-2 text-ui-xs"
                    disabled={busy || entry.state === "granted"}
                    data-testid="you-capture-consent-grant"
                    data-you-capture-purpose={entry.purpose}
                    onClick={() =>
                      withBusy(() =>
                        binding.controller.decideConsent({
                          policyId: policy.id,
                          purpose: entry.purpose,
                          decision: "grant",
                        }),
                      )
                    }
                  >
                    <CheckIcon className="size-3.5" />
                    {formatMessage({ id: "you.capture.consent.purpose.grant" })}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-ui-xs"
                    disabled={busy || entry.state === "denied"}
                    data-testid="you-capture-consent-deny"
                    data-you-capture-purpose={entry.purpose}
                    onClick={() =>
                      withBusy(() =>
                        binding.controller.decideConsent({
                          policyId: policy.id,
                          purpose: entry.purpose,
                          decision: "deny",
                        }),
                      )
                    }
                  >
                    <XIcon className="size-3.5" />
                    {formatMessage({ id: "you.capture.consent.purpose.deny" })}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label={formatMessage({ id: "you.capture.consent.learningTitle" })}>
        <div
          className={cn(
            "rounded-lg border p-2.5",
            learningGate.allowed ? "border-success/40 bg-success/5" : "border-border bg-card",
          )}
          data-testid="you-capture-learning-gate"
          data-you-capture-learning-allowed={learningGate.allowed ? "true" : "false"}
        >
          <div className="flex items-center gap-2">
            <Switch
              id="you-capture-learning-reuse"
              checked={consent.learningReuse}
              disabled={busy}
              onCheckedChange={(checked) =>
                withBusy(() =>
                  binding.controller.setLearningReuse({ policyId: policy.id, granted: checked }),
                )
              }
            />
            <Label
              htmlFor="you-capture-learning-reuse"
              className="text-ui-sm font-medium text-foreground"
            >
              {formatMessage({ id: "you.capture.consent.learningTitle" })}
            </Label>
          </div>
          <p className="mt-1 text-ui-xs text-foreground-subtle">
            {formatMessage({ id: "you.capture.consent.learningHint" })}
          </p>
        </div>
      </section>

      <section aria-label={formatMessage({ id: "you.capture.consent.withdraw" })}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-ui-xs"
          disabled={busy || !policy.revocable}
          data-testid="you-capture-consent-withdraw"
          onClick={() => withBusy(() => binding.controller.withdrawConsent({ policyId: policy.id }))}
        >
          <BanIcon className="size-3.5" />
          {formatMessage({ id: "you.capture.consent.withdraw" })}
        </Button>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.capture.consent.withdrawHint" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.capture.consent.gateTitle" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.capture.consent.gateTitle" })}
        </h4>
        <ul className="mt-1.5 flex flex-col gap-1">
          {consent.purposeStates.map((entry) => {
            const gate = projectConsentProcessingGate(consent, entry.purpose);
            return (
              <li
                key={`gate-${entry.purpose}`}
                className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1"
                data-testid="you-capture-consent-gate"
                data-you-capture-gate-purpose={entry.purpose}
                data-you-capture-gate-allowed={gate.allowed ? "true" : "false"}
              >
                <span className="min-w-0 font-mono text-ui-xs text-foreground-subtle">
                  {entry.purpose}
                </span>
                <span
                  className={cn(
                    "ml-auto text-ui-xs font-medium",
                    gate.allowed ? "text-success" : "text-warning",
                  )}
                  data-testid={
                    gate.allowed ? "you-capture-gate-allowed" : "you-capture-gate-blocked"
                  }
                >
                  {gate.allowed
                    ? formatMessage({ id: "you.capture.consent.gateAllowed" })
                    : formatMessage({ id: "you.capture.consent.gateBlocked" })}
                </span>
              </li>
            );
          })}
          <li
            className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1"
            data-testid="you-capture-consent-gate"
            data-you-capture-gate-purpose="learning-reuse"
            data-you-capture-gate-allowed={learningGate.allowed ? "true" : "false"}
          >
            <span className="min-w-0 font-mono text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.capture.consent.gateLearning" })}
            </span>
            <span
              className={cn(
                "ml-auto text-ui-xs font-medium",
                learningGate.allowed ? "text-success" : "text-warning",
              )}
            >
              {learningGate.allowed
                ? formatMessage({ id: "you.capture.consent.gateAllowed" })
                : formatMessage({ id: "you.capture.consent.gateBlocked" })}
            </span>
          </li>
        </ul>
        {!operationalGate.allowed ? (
          <p
            className="mt-1.5 text-ui-xs font-medium text-warning"
            data-testid="you-capture-no-consent-no-processing"
          >
            {formatMessage({ id: "you.capture.consent.gateBlocked" })}
          </p>
        ) : null}
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.capture.consent.gateCaption" })}
        </p>
        <p className="mt-1 font-mono text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.capture.consent.reference" })}: {consent.reference.policyId} ·{" "}
          {consent.reference.state} · learning={String(consent.reference.learningPermission)}
        </p>
      </section>
    </div>
  );
}
