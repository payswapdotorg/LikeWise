// YOU Learning Studio — 权利与同意面板（W6B）。
//
// 验收要求：rights 显示（usage classes + consent linkage——consentRef + consentHash
// 溯源 wave-2 同意权威）+ 同意撤回控件（经同意权威端口路由——无第二条同意路径）
// + 惰性记录通知。门投影只禁用 UI 操作；服务端独立强制（useRecord/derivePreference
// 无许可抛 YOU_LEARNING_RIGHTS_REQUIRED）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useLearningMessages } from "@/you/useLearningMessages.js";
import type { UseLearningStudioBinding } from "@/you/useLearningStudio.js";
import {
  orderedLearningRecords,
  projectLearningConsentGate,
} from "@/you/learningController.js";
import { projectRightsRows } from "@/you/learningStudioProjection.js";
import { LEARNING_STORYBOARD_LEARNING_PURPOSE } from "@/you/learningStoryboard.js";

export function LearningRightsPanel({ binding }: { binding: UseLearningStudioBinding }) {
  const { formatMessage } = useLearningMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedRecordId = useStore(binding.store, (state) => state.selectedRecordId);
  const [busy, setBusy] = useState(false);

  const records = useMemo(() => orderedLearningRecords(snapshot), [snapshot]);
  const inspected = useMemo(
    () =>
      records.find((record) => record.id === selectedRecordId) ??
      records.at(-1) ??
      null,
    [records, selectedRecordId],
  );
  const rightsRows = useMemo(() => projectRightsRows(records), [records]);
  const inertCount = rightsRows.filter((row) => row.inert).length;

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

  // 同意门投影（learning 用途）：rights 签发的放行依据（wave-2 权威形状）。
  const gate = projectLearningConsentGate(
    snapshot.consent,
    LEARNING_STORYBOARD_LEARNING_PURPOSE,
  );

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-learning-rights"
    >
      <section aria-label={formatMessage({ id: "you.learning.rights.title" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.learning.rights.title" })}
        </h3>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.rights.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.learning.rights.consent.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.learning.rights.consent.title" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.rights.consent.caption" })}
        </p>
        <div
          className={cn(
            "mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border p-2",
            gate.allowed
              ? "border-success/40 bg-success/5"
              : "border-warning/40 bg-warning/5",
          )}
          data-testid="you-learning-consent-gate"
          data-you-learning-consent-allowed={gate.allowed ? "true" : "false"}
          data-you-learning-consent-state={gate.state}
        >
          {gate.allowed ? (
            <ShieldCheckIcon className="size-3.5 text-success" />
          ) : (
            <ShieldXIcon className="size-3.5 text-warning" />
          )}
          <span className="text-ui-xs font-medium text-foreground">
            {gate.allowed
              ? formatMessage({ id: "you.learning.rights.gate.allowed" })
              : formatMessage({ id: "you.learning.rights.gate.blocked" })}
          </span>
          <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
            {formatMessage({ id: "you.learning.rights.consent.state" })}: {gate.state}
          </Badge>
          {!gate.allowed ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto h-6 px-2 text-ui-xs"
              disabled={busy}
              data-testid="you-learning-consent-grant"
              onClick={() =>
                void withBusy(() =>
                  binding.controller.decideConsent({
                    policyId: snapshot.consent.policy.id,
                    purpose: LEARNING_STORYBOARD_LEARNING_PURPOSE,
                    decision: "grant",
                  }),
                )
              }
            >
              {formatMessage({ id: "you.learning.rights.grant" })}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto h-6 px-2 text-ui-xs"
              disabled={busy}
              data-testid="you-learning-consent-withdraw"
              onClick={() =>
                void withBusy(() =>
                  binding.controller.withdrawConsent({
                    policyId: snapshot.consent.policy.id,
                  }),
                )
              }
            >
              {formatMessage({ id: "you.learning.rights.withdraw" })}
            </Button>
          )}
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.rights.withdrawCaption" })}
        </p>
        <dl className="mt-2 flex flex-col gap-1 text-ui-xs text-foreground-subtle">
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-foreground-subtlest">
              {formatMessage({ id: "you.learning.rights.consent.policy" })}:
            </dt>
            <dd className="font-mono">{snapshot.consent.policy.id}</dd>
          </div>
        </dl>
      </section>

      {inertCount > 0 ? (
        <div
          className="rounded-lg border border-warning/40 bg-warning/5 p-2 text-ui-xs text-foreground"
          data-testid="you-learning-inert-notice"
          data-you-learning-inert-count={inertCount}
          role="note"
        >
          <span className="font-medium">
            {formatMessage({ id: "you.learning.rights.inertCount" })}: {inertCount}
          </span>
          <p className="mt-0.5 text-foreground-subtle">
            {formatMessage({ id: "you.learning.rights.inertNotice" })}
          </p>
        </div>
      ) : null}

      <section aria-label={formatMessage({ id: "you.learning.rights.usage.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.learning.rights.usage.title" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.rights.usage.hint" })}
        </p>
        {rightsRows.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-learning-rights-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.learning.rights.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.learning.rights.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-1.5" data-testid="you-learning-rights-list">
            {rightsRows.map((row) => (
              <li
                key={row.recordId}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2",
                  row.recordId === inspected?.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-surface",
                )}
                data-testid="you-learning-rights-row"
                data-you-learning-rights-record-id={row.recordId}
                data-you-learning-rights-inert={row.inert ? "true" : "false"}
                data-you-learning-rights-status={row.status}
              >
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="font-mono text-ui-xs text-foreground">{row.recordId}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-ui-xs",
                      row.status === "validated"
                        ? "border-success/40 text-success"
                        : "border-border text-foreground-subtle",
                    )}
                  >
                    {formatMessage({ id: `you.learning.status.${row.status}` })}
                  </Badge>
                  {row.inert ? (
                    <Badge variant="outline" className="border-warning/40 text-ui-xs text-warning">
                      {formatMessage({ id: "you.learning.ledger.record.inert" })}
                    </Badge>
                  ) : null}
                </span>
                <span className="flex flex-wrap gap-1" data-testid="you-learning-rights-usage-classes">
                  {row.usage.length > 0 ? (
                    row.usage.map((usage) => (
                      <Badge
                        key={usage}
                        variant="outline"
                        className="border-primary/30 font-mono text-ui-xs text-primary"
                      >
                        {usage}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-ui-xs text-foreground-subtlest">
                      {formatMessage({ id: "you.learning.rights.usage.none" })}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                  <span>
                    {formatMessage({ id: "you.learning.rights.consent.policy" })}: {row.consentRef || "—"}
                  </span>
                  <span>
                    {formatMessage({ id: "you.learning.rights.consent.hash" })}:{" "}
                    {row.consentHash || "—"}
                  </span>
                  <span>
                    {formatMessage({ id: "you.learning.rights.expiresAt" })}:{" "}
                    {row.expiresAt ?? formatMessage({ id: "you.learning.rights.noExpiry" })}
                  </span>
                </span>
                <span className="sr-only">{row.accessibleLabel}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
