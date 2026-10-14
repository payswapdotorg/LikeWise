// YOU Hardening Studio — retention controls 面板（W10B）。
//
// 验收要求：retention classes 携 consent-protected 指示器（consent 法律显示面）
// ——零 UI 业务逻辑；loading/error/empty 状态齐全。RETENTION LAW 的显示面：
// retention class 绝不覆盖 active consent（typed 拒绝路径可见，按钮不禁用——
// 法则路径可见可测）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { FileClockIcon, ShieldCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useHardeningMessages } from "@/you/useHardeningMessages.js";
import type { UseHardeningStudioBinding } from "@/you/useHardeningStudio.js";
import { orderedRetentionRecords } from "@/you/hardeningController.js";
import {
  projectHardeningListRegionView,
  projectRetentionDraftView,
  projectRetentionRecordRows,
} from "@/you/hardeningStudioProjection.js";

export function HardeningRetentionPanel({
  binding,
}: {
  binding: UseHardeningStudioBinding;
}) {
  const { formatMessage } = useHardeningMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const retentionDraftSubjectId = useStore(
    binding.store,
    (state) => state.retentionDraftSubjectId,
  );
  const retentionDraftClassId = useStore(
    binding.store,
    (state) => state.retentionDraftClassId,
  );
  const selectedRetentionRecordId = useStore(
    binding.store,
    (state) => state.selectedRetentionRecordId,
  );
  const [busy, setBusy] = useState(false);

  const subjects = snapshot?.retentionSubjects ?? [];
  const classes = snapshot?.retentionClasses ?? [];
  const draftView = useMemo(
    () =>
      projectRetentionDraftView(
        {
          subjectId: retentionDraftSubjectId,
          retentionClassId: retentionDraftClassId,
        },
        {
          subjects: subjects.map((subject) => ({
            id: subject.id,
            consentProtected: subject.consentProtected,
            consentState: subject.consentState,
          })),
          classes: classes.map((entry) => ({ id: entry.id })),
        },
      ),
    [retentionDraftSubjectId, retentionDraftClassId, subjects, classes],
  );
  const recordRows = useMemo(
    () => projectRetentionRecordRows(orderedRetentionRecords(snapshot)),
    [snapshot],
  );
  const recordRegion = projectHardeningListRegionView(
    snapshot !== null,
    recordRows.length,
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
      data-testid="you-hardening-retention"
    >
      <section aria-label={formatMessage({ id: "you.hardening.retention.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <FileClockIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.hardening.retention.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {recordRows.length} {formatMessage({ id: "you.hardening.retention.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.retention.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.hardening.retention.classes.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.retention.classes.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.retention.classes.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-retention-classes">
          {classes.map((entry) => {
            const selected = entry.id === retentionDraftClassId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-wrap items-baseline gap-x-2 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-hardening-retention-class"
                data-you-hardening-retention-class={entry.retentionClass}
                data-you-hardening-retention-class-selected={selected ? "true" : "false"}
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() =>
                    binding.store.getState().setRetentionDraftClass(entry.id)
                  }
                >
                  <span className="text-foreground">{entry.retentionClass}</span>
                </button>
                <span className="text-foreground-subtlest">
                  {formatMessage({ id: "you.hardening.retention.classes.window" })}:{" "}
                  {entry.windowLabel}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.hardening.retention.subjects.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.retention.subjects.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.retention.subjects.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-retention-subjects">
          {subjects.map((subject) => {
            const selected = subject.id === retentionDraftSubjectId;
            return (
              <li
                key={subject.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  subject.consentProtected && "ring-1 ring-brand/30",
                )}
                data-testid="you-hardening-retention-subject"
                data-you-hardening-retention-subject-id={subject.id}
                data-you-hardening-retention-consent-state={subject.consentState}
                data-you-hardening-retention-consent-protected={
                  subject.consentProtected ? "true" : "false"
                }
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                  onClick={() =>
                    binding.store.getState().setRetentionDraftSubject(subject.id)
                  }
                >
                  <span className="font-mono text-ui-xs text-foreground">
                    {subject.subjectRef}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-ui-xs",
                      subject.consentProtected
                        ? "border-success/40 text-success"
                        : "border-border text-foreground-subtle",
                    )}
                  >
                    {formatMessage({
                      id: `you.hardening.retention.consent.${subject.consentState}`,
                    })}
                  </Badge>
                  {subject.consentProtected ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-success/40 text-ui-xs text-success"
                      data-testid="you-hardening-retention-consent-protected"
                    >
                      <ShieldCheckIcon className="size-3" />
                      {formatMessage({ id: "you.hardening.retention.subjects.protected" })}
                    </Badge>
                  ) : null}
                </button>
                {subject.consentProtected ? (
                  <p className="text-ui-xs text-foreground-subtle">
                    {formatMessage({ id: "you.hardening.retention.subjects.protectedHint" })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.hardening.retention.enforce.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.retention.enforce.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.retention.enforce.caption" })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || draftView.disabledReason !== null}
            data-testid="you-hardening-retention-enforce"
            data-you-hardening-retention-enforce-disabled-reason={
              draftView.disabledReason ?? ""
            }
            onClick={() =>
              void withBusy(() =>
                binding.controller.enforceRetention({
                  subjectId: retentionDraftSubjectId,
                  retentionClassId: retentionDraftClassId,
                }),
              )
            }
          >
            <FileClockIcon className="size-3.5" />
            {formatMessage({ id: "you.hardening.retention.enforce.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.hardening.retention.enforce.disabled" })}
            </span>
          ) : null}
          {draftView.consentProtected ? (
            <span
              className="text-ui-xs text-foreground-subtle"
              data-testid="you-hardening-retention-consent-note"
            >
              {formatMessage({ id: "you.hardening.retention.enforce.consentProtectedNote" })}
            </span>
          ) : null}
        </div>
      </section>

      {recordRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-hardening-retention-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.hardening.retention.records.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.retention.records.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.hardening.retention.records.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.hardening.retention.records.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.retention.records.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-retention-records">
            {recordRows.map((row) => {
              const selected = row.recordId === selectedRetentionRecordId;
              return (
                <li
                  key={row.recordId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-hardening-retention-record"
                  data-you-hardening-retention-record-id={row.recordId}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left font-mono text-ui-xs text-foreground"
                    onClick={() =>
                      binding.store.getState().selectRetentionRecord(row.recordId)
                    }
                  >
                    <span>{row.recordId}</span>
                    <span className="text-foreground-subtle">{row.retentionClass}</span>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.hardening.retention.records.row.subject" })}:{" "}
                      {row.subjectRef}
                    </span>
                    <span>
                      {formatMessage({ id: "you.hardening.retention.records.row.enforcedAt" })}:{" "}
                      {row.enforcedAt}
                    </span>
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
