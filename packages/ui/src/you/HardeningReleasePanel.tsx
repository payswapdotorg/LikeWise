/* oxlint-disable eslint(max-lines) -- release 面板是「matrix 注册面 + 决定 intake（证据/意图挑选）+ live 门投影 + eligibility 账本 + live 决定 + 反转动作」的单面板聚合（每段都消费同一 controller 投影的同一选择器族；拆分只会让同一表面的成段 JSX/文案跨文件碎片化，增加 T10 换绑时的对照成本——W8B/W9B max-lines 文件的既定 disable header 先例）。 */
// YOU Hardening Studio — release readiness 面板（W10B）。
//
// 验收要求：ProductionEligibilityRecord 面板（eligible/blocked、rollback evidence
// 链接）；subject 经 provider matrix 注册面引用（ECOSYSTEM GATE 声明侧镜像）。
// 零 UI 业务逻辑；loading/error/empty 齐全；reversal 以投射意图经 controller
// 端口落为新记录。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { RocketIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useHardeningMessages } from "@/you/useHardeningMessages.js";
import type { UseHardeningStudioBinding } from "@/you/useHardeningStudio.js";
import {
  eligibilityEntryById,
  eligibilityIsReversed,
  liveEligibilityOfSubject,
  orderedEligibilityLedger,
  projectHardeningEligibilityGate,
} from "@/you/hardeningController.js";
import {
  projectEligibilityRows,
  projectHardeningListRegionView,
  projectReleaseDraftView,
  rollbackEvidenceIsPresent,
} from "@/you/hardeningStudioProjection.js";

export function HardeningReleasePanel({
  binding,
}: {
  binding: UseHardeningStudioBinding;
}) {
  const { formatMessage } = useHardeningMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const releaseDraftMatrixId = useStore(
    binding.store,
    (state) => state.releaseDraftMatrixId,
  );
  const releaseDraftEvidenceId = useStore(
    binding.store,
    (state) => state.releaseDraftEvidenceId,
  );
  const releaseDraftEligible = useStore(
    binding.store,
    (state) => state.releaseDraftEligible,
  );
  const selectedEligibilityRecordId = useStore(
    binding.store,
    (state) => state.selectedEligibilityRecordId,
  );
  const [busy, setBusy] = useState(false);

  const matrixEntries = snapshot?.matrixEntries ?? [];
  const evidencePresets = snapshot?.rollbackEvidence ?? [];
  const gate = useMemo(
    () =>
      projectHardeningEligibilityGate(
        snapshot,
        releaseDraftMatrixId,
        releaseDraftEvidenceId,
        releaseDraftEligible,
      ),
    [snapshot, releaseDraftMatrixId, releaseDraftEvidenceId, releaseDraftEligible],
  );
  const draftView = useMemo(
    () =>
      projectReleaseDraftView(
        {
          matrixEntryId: releaseDraftMatrixId,
          rollbackEvidenceId: releaseDraftEvidenceId,
          eligible: releaseDraftEligible,
        },
        gate,
      ),
    [releaseDraftMatrixId, releaseDraftEvidenceId, releaseDraftEligible, gate],
  );
  const ledgerRows = useMemo(
    () => projectEligibilityRows(orderedEligibilityLedger(snapshot)),
    [snapshot],
  );
  const ledgerRegion = projectHardeningListRegionView(
    snapshot !== null,
    ledgerRows.length,
  );
  const selectedEntry = useMemo(
    () => eligibilityEntryById(snapshot, selectedEligibilityRecordId),
    [snapshot, selectedEligibilityRecordId],
  );
  const selectedMatrixRef = selectedEntry
    ? selectedEntry.record.subjectRef
    : matrixEntries.find((entry) => entry.id === releaseDraftMatrixId)?.matrixRef ?? null;
  const liveRecord = useMemo(
    () => liveEligibilityOfSubject(snapshot, selectedMatrixRef),
    [snapshot, selectedMatrixRef],
  );
  const canReverseSelected =
    selectedEntry !== null &&
    !eligibilityIsReversed(snapshot!, selectedEntry.record.id);

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
      data-testid="you-hardening-release"
    >
      <section aria-label={formatMessage({ id: "you.hardening.release.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <RocketIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.hardening.release.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {ledgerRows.length} {formatMessage({ id: "you.hardening.release.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.release.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.hardening.release.matrix.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.release.matrix.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.release.matrix.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-matrix-entries">
          {matrixEntries.map((entry) => {
            const selected = entry.id === releaseDraftMatrixId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  !entry.valid && "border-warning/40",
                )}
                data-testid="you-hardening-matrix-entry"
                data-you-hardening-matrix-id={entry.id}
                data-you-hardening-matrix-valid={entry.valid ? "true" : "false"}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                  onClick={() =>
                    binding.store.getState().setReleaseDraftMatrix(entry.id)
                  }
                >
                  <span className="font-mono text-ui-xs text-foreground">
                    {entry.providerKind}
                  </span>
                  <span className="font-mono text-ui-xs text-foreground-subtle">
                    {entry.region}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-ui-xs",
                      entry.eligible
                        ? "border-success/40 text-success"
                        : "border-border text-foreground-subtle",
                    )}
                  >
                    {formatMessage({ id: "you.hardening.release.matrix.eligible" })}
                  </Badge>
                  <span className="text-ui-xs text-foreground-subtlest">
                    {entry.valid
                      ? formatMessage({ id: "you.hardening.release.matrix.valid" })
                      : formatMessage({ id: "you.hardening.release.matrix.invalid" })}
                  </span>
                </button>
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                  <span>
                    {formatMessage({ id: "you.hardening.release.matrix.capabilities" })}:{" "}
                    {entry.capabilityClasses.join(", ") || "—"}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.hardening.release.decide.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.release.decide.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.release.decide.caption" })}
        </p>
        <div className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-release-evidence">
          <span className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.hardening.release.decide.evidence" })}
          </span>
          <div className="flex flex-wrap gap-1">
            {evidencePresets.map((preset) => {
              const selected = preset.id === releaseDraftEvidenceId;
              return (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 font-mono text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                    !preset.present && "border-warning/40 text-warning",
                  )}
                  data-testid="you-hardening-release-evidence-option"
                  data-you-hardening-release-evidence={preset.id}
                  data-you-hardening-release-evidence-present={
                    preset.present ? "true" : "false"
                  }
                  aria-pressed={selected}
                  title={preset.evidenceRef}
                  onClick={() =>
                    binding.store.getState().setReleaseDraftEvidence(preset.id)
                  }
                >
                  {preset.present
                    ? formatMessage({ id: "you.hardening.release.decide.evidencePresent" })
                    : formatMessage({ id: "you.hardening.release.decide.evidenceNone" })}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-release-intent">
          <span className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.hardening.release.decide.intent" })}
          </span>
          <div className="flex flex-wrap gap-1">
            {[true, false].map((eligible) => (
              <Button
                key={String(eligible)}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-6 px-2 text-ui-xs",
                  releaseDraftEligible === eligible &&
                    "border-primary/60 bg-primary/10 text-primary",
                )}
                data-testid="you-hardening-release-intent-option"
                data-you-hardening-release-intent={eligible ? "eligible" : "blocked"}
                aria-pressed={releaseDraftEligible === eligible}
                onClick={() =>
                  binding.store.getState().setReleaseDraftEligible(eligible)
                }
              >
                {eligible
                  ? formatMessage({ id: "you.hardening.release.decide.intentEligible" })
                  : formatMessage({ id: "you.hardening.release.decide.intentBlocked" })}
              </Button>
            ))}
          </div>
        </div>
        <div
          className="mt-2 rounded-md border border-border bg-surface p-2"
          data-testid="you-hardening-release-gate"
          data-you-hardening-gate-allowed={gate.allowed ? "true" : "false"}
          data-you-hardening-gate-reason={gate.reason}
        >
          <span className="text-ui-xs font-medium text-foreground">
            {formatMessage({ id: "you.hardening.release.gate.title" })}:{" "}
          </span>
          <span
            className={cn(
              "text-ui-xs",
              gate.allowed ? "text-success" : "text-warning",
            )}
          >
            {gate.allowed
              ? formatMessage({ id: "you.hardening.release.gate.allowed" })
              : formatMessage({ id: "you.hardening.release.gate.blocked" })}
          </span>
          <p className="mt-0.5 text-ui-xs text-foreground-subtle">
            {formatMessage({ id: `you.hardening.release.gate.reason.${gate.reason}` })}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || gate.reason === "matrix-entry-not-selected"}
            data-testid="you-hardening-release-decide"
            onClick={() =>
              void withBusy(() =>
                binding.controller.decideEligibility({
                  matrixEntryId: releaseDraftMatrixId,
                  rollbackEvidenceId: releaseDraftEvidenceId,
                  eligible: releaseDraftEligible,
                }),
              )
            }
          >
            {formatMessage({ id: "you.hardening.release.decide.apply" })}
          </Button>
          {draftView.gate.reason === "matrix-entry-not-selected" ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.hardening.release.decide.disabled" })}
            </span>
          ) : null}
        </div>
      </section>

      {ledgerRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-hardening-release-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.hardening.release.ledger.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.release.ledger.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.hardening.release.ledger.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.hardening.release.ledger.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.hardening.release.ledger.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-hardening-release-ledger">
            {ledgerRows.map((row) => {
              const selected = row.recordId === selectedEligibilityRecordId;
              return (
                <li
                  key={row.recordId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-hardening-eligibility-record"
                  data-you-hardening-eligibility-id={row.recordId}
                  data-you-hardening-eligibility-kind={row.kind}
                  data-you-hardening-eligibility-eligible={row.eligible ? "true" : "false"}
                  data-you-hardening-eligibility-selected={selected ? "true" : "false"}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store
                        .getState()
                        .selectEligibilityRecord(row.recordId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.recordId}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.eligible
                          ? "border-success/40 text-success"
                          : "border-destructive/40 text-destructive",
                      )}
                    >
                      {row.eligible
                        ? formatMessage({ id: "you.hardening.release.ledger.eligible" })
                        : formatMessage({ id: "you.hardening.release.ledger.blocked" })}
                    </Badge>
                    <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
                      {formatMessage({ id: `you.hardening.release.kind.${row.kind}` })}
                    </Badge>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.hardening.release.ledger.row.subject" })}:{" "}
                      {row.subjectRef}
                    </span>
                    <span>
                      {formatMessage({ id: "you.hardening.release.ledger.row.rollbackEvidence" })}:{" "}
                      {rollbackEvidenceIsPresent(row.rollbackEvidenceRef)
                        ? row.rollbackEvidenceRef
                        : formatMessage({
                            id: "you.hardening.release.ledger.row.rollbackEvidenceNone",
                          })}
                    </span>
                    <span>
                      {formatMessage({ id: "you.hardening.release.ledger.row.decidedAt" })}:{" "}
                      {row.decidedAt}
                    </span>
                    {row.supersedesRecordId !== null ? (
                      <span>
                        {formatMessage({ id: "you.hardening.release.ledger.row.supersedes" })}:{" "}
                        {row.supersedesRecordId}
                      </span>
                    ) : null}
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section aria-label={formatMessage({ id: "you.hardening.release.live.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.hardening.release.live.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.hardening.release.live.caption" })}
        </p>
        {liveRecord ? (
          <div
            className="mt-1.5 rounded-lg border border-border bg-card p-2"
            data-testid="you-hardening-release-live"
            data-you-hardening-live-subject={liveRecord.subjectRef}
            data-you-hardening-live-eligible={liveRecord.eligible ? "true" : "false"}
          >
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-ui-xs text-foreground">
                {liveRecord.subjectRef}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-ui-xs",
                  liveRecord.eligible
                    ? "border-success/40 text-success"
                    : "border-destructive/40 text-destructive",
                )}
              >
                {liveRecord.eligible
                  ? formatMessage({ id: "you.hardening.release.ledger.eligible" })
                  : formatMessage({ id: "you.hardening.release.ledger.blocked" })}
              </Badge>
            </div>
            <p className="mt-1 font-mono text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.hardening.release.ledger.row.rollbackEvidence" })}:{" "}
              {rollbackEvidenceIsPresent(liveRecord.rollbackEvidenceRef)
                ? liveRecord.rollbackEvidenceRef
                : formatMessage({ id: "you.hardening.release.ledger.row.rollbackEvidenceNone" })}
            </p>
          </div>
        ) : (
          <p
            className="mt-1.5 text-ui-xs text-foreground-subtle"
            data-testid="you-hardening-release-live-empty"
          >
            {formatMessage({ id: "you.hardening.release.live.empty" })}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !canReverseSelected}
            data-testid="you-hardening-release-reverse"
            data-you-hardening-release-reverse-disabled={
              canReverseSelected ? "false" : "true"
            }
            onClick={() => {
              if (!selectedEntry) return;
              void withBusy(() =>
                binding.controller.reverseEligibility({
                  recordId: selectedEntry.record.id,
                }),
              );
            }}
          >
            {formatMessage({ id: "you.hardening.release.live.reverse" })}
          </Button>
          <span className="text-ui-xs text-foreground-subtlest">
            {canReverseSelected
              ? formatMessage({ id: "you.hardening.release.live.reverseCaption" })
              : formatMessage({ id: "you.hardening.release.live.reverseDisabled" })}
          </span>
        </div>
      </section>
    </div>
  );
}
