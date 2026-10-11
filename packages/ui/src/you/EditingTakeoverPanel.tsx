// YOU Editing Studio — 手动接管面板（W5B）。
//
// 验收要求：takeover 确认由 consent-state 投影渲染（wave-2 同意权威——不存在第二条
// 同意路径）。门投影只禁用 UI 操作；服务端独立强制（requestTakeoverConfirmation 无
// 许可抛 YOU_CONSENT_REQUIRED）。确认记录 append-only；「未许可不接管」可见可测。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { HandIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEditingMessages } from "@/you/useEditingMessages.js";
import type { UseEditingStudioBinding } from "@/you/useEditingStudio.js";
import {
  orderedEditingSessions,
  projectEditingConsentGate,
} from "@/you/editingController.js";

export function EditingTakeoverPanel({ binding }: { binding: UseEditingStudioBinding }) {
  const { formatMessage } = useEditingMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedSessionId = useStore(binding.store, (state) => state.selectedSessionId);
  const [busy, setBusy] = useState(false);

  const sessions = useMemo(() => orderedEditingSessions(snapshot), [snapshot]);
  const inspectedSession = useMemo(
    () =>
      sessions.find((session) => session.id === selectedSessionId) ??
      sessions.at(-1) ??
      null,
    [sessions, selectedSessionId],
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

  // 同意门投影（manual-takeover 用途）：确认的放行依据（wave-2 权威形状）。
  const takeoverGate = projectEditingConsentGate(snapshot.consent, "manual-takeover");
  const sessionReady = inspectedSession !== null && inspectedSession.status === "open";

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-editing-takeover"
    >
      <section aria-label={formatMessage({ id: "you.editing.takeover.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <HandIcon className="size-4 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.editing.takeover.title" })}
          </h3>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.editing.takeover.caption" })}
        </p>
        <div
          className={cn(
            "mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border p-2",
            takeoverGate.allowed
              ? "border-success/40 bg-success/5"
              : "border-warning/40 bg-warning/5",
          )}
          data-testid="you-editing-takeover-gate"
          data-you-editing-takeover-allowed={takeoverGate.allowed ? "true" : "false"}
          data-you-editing-takeover-state={takeoverGate.state}
        >
          {takeoverGate.allowed ? (
            <ShieldCheckIcon className="size-3.5 text-success" />
          ) : (
            <ShieldXIcon className="size-3.5 text-warning" />
          )}
          <span className="text-ui-xs font-medium text-foreground">
            {takeoverGate.allowed
              ? formatMessage({ id: "you.editing.takeover.gateAllowed" })
              : formatMessage({ id: "you.editing.takeover.gateBlocked" })}
          </span>
          <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
            {formatMessage({ id: "you.editing.takeover.consentState" })}: {takeoverGate.state}
          </Badge>
          {!takeoverGate.allowed ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto h-6 px-2 text-ui-xs"
              disabled={busy}
              data-testid="you-editing-takeover-grant-consent"
              onClick={() =>
                void withBusy(() =>
                  binding.controller.decideConsent({
                    policyId: snapshot.consent.policy.id,
                    purpose: "manual-takeover",
                    decision: "grant",
                  }),
                )
              }
            >
              {formatMessage({ id: "you.editing.takeover.grant" })}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto h-6 px-2 text-ui-xs"
              disabled={busy}
              data-testid="you-editing-takeover-withdraw-consent"
              onClick={() =>
                void withBusy(() =>
                  binding.controller.withdrawConsent({
                    policyId: snapshot.consent.policy.id,
                  }),
                )
              }
            >
              {formatMessage({ id: "you.editing.takeover.withdraw" })}
            </Button>
          )}
        </div>
        {inspectedSession ? (
          <p className="mt-2 flex flex-wrap gap-x-1.5 text-ui-xs text-foreground-subtle">
            <span>{formatMessage({ id: "you.editing.sessions.title" })}:</span>
            <span className="font-mono text-foreground">{inspectedSession.id}</span>
            <span>({formatMessage({ id: `you.editing.sessions.status.${inspectedSession.status}` })})</span>
          </p>
        ) : null}
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            className="h-6 px-2 text-ui-xs"
            disabled={busy || !sessionReady}
            title={sessionReady ? undefined : formatMessage({ id: "you.editing.takeover.confirmDisabled" })}
            data-testid="you-editing-takeover-confirm"
            onClick={() => {
              if (!inspectedSession) return;
              void withBusy(() =>
                binding.controller.requestTakeoverConfirmation({
                  sessionId: inspectedSession.id,
                }),
              );
            }}
          >
            <HandIcon className="size-3" />
            {formatMessage({ id: "you.editing.takeover.confirm" })}
          </Button>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.editing.takeover.confirmCaption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.editing.takeover.confirmCount" })}>
        <div className="flex flex-wrap items-baseline gap-2">
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.editing.takeover.title" })}
          </h4>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-editing-takeover-count">
            {snapshot.takeovers.length}
          </Badge>
        </div>
        {snapshot.takeovers.length === 0 ? (
          <p className="mt-1 text-ui-xs text-foreground-subtle" data-testid="you-editing-takeovers-empty">
            {formatMessage({ id: "you.editing.takeover.empty" })}
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1" data-testid="you-editing-takeover-list">
            {snapshot.takeovers.map((takeover) => (
              <li
                key={takeover.takeoverId}
                className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-2"
                data-testid="you-editing-takeover-record"
                data-you-editing-takeover-id={takeover.takeoverId}
              >
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-mono text-ui-xs text-foreground">{takeover.takeoverId}</span>
                  <Badge variant="secondary" className="text-ui-xs">
                    {formatMessage({ id: "you.editing.takeover.confirmedAt" })}: {takeover.confirmedAt}
                  </Badge>
                </span>
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                  <span>
                    {formatMessage({ id: "you.editing.editors.launch.session" })}: {takeover.sessionId}
                  </span>
                  <span>
                    {formatMessage({ id: "you.editing.takeover.subject" })}: {takeover.subjectArtifactId}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
