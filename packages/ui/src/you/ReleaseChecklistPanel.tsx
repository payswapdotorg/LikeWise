/* oxlint-disable eslint(max-lines) -- checklist 面板是 20 点 launch-gate 显示的单 switch 组件（注册表 + 草稿 + 20 点逐点分解 + 键盘导航一体的显示面；拆分只会把 LAUNCH GATE LAW 的同一显示面碎片化）；T12 换绑后随 UI 退役。 */
// YOU Release Studio — 20-point launch-gate checklist 面板（W12B）。
//
// 验收要求：checklist surface——20 点 + journey-evidence 链接 + pass 态来自
// controller 投影（LAUNCH GATE LAW：a point passes ONLY with a successful journey
// evidence reference —— never a bare assertion；the gate passes ONLY when all
// 20 points pass）。零 UI 业务逻辑；loading/error/empty 齐全；键盘导航与兄弟
// 表面同级。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { ClipboardCheckIcon, LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useReleaseMessages } from "@/you/useReleaseMessages.js";
import type { UseReleaseStudioBinding } from "@/you/useReleaseStudio.js";
import { orderedReleaseChecklists } from "@/you/releaseController.js";
import {
  projectChecklistDraftView,
  projectReleaseChecklistRows,
  projectReleaseListRegionView,
  resolveReleaseKeyboardTransition,
} from "@/you/releaseStudioProjection.js";

export function ReleaseChecklistPanel({
  binding,
}: {
  binding: UseReleaseStudioBinding;
}) {
  const { formatMessage } = useReleaseMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const checklistDraftJourneyId = useStore(
    binding.store,
    (state) => state.checklistDraftJourneyId,
  );
  const selectedChecklistId = useStore(
    binding.store,
    (state) => state.selectedChecklistId,
  );
  const [busy, setBusy] = useState(false);

  const journeys = snapshot?.journeys ?? [];
  const selectedJourney = journeys.find(
    (entry) => entry.id === checklistDraftJourneyId,
  );
  const steps = selectedJourney?.steps ?? [];
  const draftView = useMemo(
    () =>
      projectChecklistDraftView(
        { journeyId: checklistDraftJourneyId },
        journeys,
      ),
    [checklistDraftJourneyId, journeys],
  );
  const checklistRows = useMemo(
    () => projectReleaseChecklistRows(snapshot, orderedReleaseChecklists(snapshot)),
    [snapshot],
  );
  const ledgerRegion = projectReleaseListRegionView(
    snapshot !== null,
    checklistRows.length,
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
      data-testid="you-release-checklist"
      tabIndex={0}
      onKeyDown={(event) => {
        // 键盘导航 = 一等交互路径（与 Solution/Capture/…/Conformance 同款）。
        const action = resolveReleaseKeyboardTransition(event.key, {
          totalChecklists: checklistRows.length,
        });
        if (action.kind === "move") {
          event.preventDefault();
          binding.store.getState().moveChecklistIndex(action.delta);
        } else if (action.kind === "select") {
          event.preventDefault();
          if (selectedChecklistId !== null) {
            binding.store.getState().selectChecklist(selectedChecklistId);
          }
        }
      }}
    >
      <section aria-label={formatMessage({ id: "you.release.checklist.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardCheckIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.release.checklist.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {checklistRows.length}{" "}
            {formatMessage({ id: "you.release.checklist.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.release.checklist.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.release.checklist.registry.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.release.checklist.registry.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.release.checklist.registry.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-release-checklist-registry">
          {journeys.map((entry) => {
            const selected = entry.id === checklistDraftJourneyId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-release-checklist-journey"
                data-you-release-checklist-journey-id={entry.id}
                data-you-release-checklist-journey-valid={entry.valid ? "true" : "false"}
                data-you-release-checklist-journey-evidence={entry.evidenceSteps}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                  onClick={() =>
                    binding.store.getState().setChecklistDraftJourney(entry.id)
                  }
                >
                  <span className="text-foreground">{entry.journeyId}</span>
                  <span className="text-foreground-subtlest">
                    {formatMessage({ id: "you.release.checklist.registry.evidence" })}:{" "}
                    {entry.evidenceSteps}/{entry.steps.length}
                  </span>
                  {!entry.valid ? (
                    <Badge
                      variant="outline"
                      className="border-warning/40 text-ui-xs text-warning"
                    >
                      {formatMessage({ id: "you.release.checklist.registry.invalid" })}
                    </Badge>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
        {steps.length > 0 ? (
          <ol
            className="mt-1.5 flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-2 font-mono text-ui-xs"
            data-testid="you-release-checklist-steps"
          >
            {steps.map((stepName, index) => {
              const hasEvidence = index < (selectedJourney?.evidenceSteps ?? 0);
              return (
                <li
                  key={stepName}
                  className={cn(
                    "flex items-baseline gap-1.5",
                    hasEvidence ? "text-foreground-subtlest" : "text-foreground-subtlest/60",
                  )}
                  data-testid="you-release-checklist-step"
                  data-you-release-checklist-step-index={index + 1}
                  data-you-release-checklist-step-evidence={hasEvidence ? "true" : "false"}
                >
                  <span className="w-5 shrink-0 text-right text-foreground-subtlest">
                    {index + 1}.
                  </span>
                  <span>{stepName}</span>
                  <span className="ml-auto shrink-0">
                    {hasEvidence
                      ? formatMessage({ id: "you.release.point.passed" })
                      : formatMessage({ id: "you.release.point.notPassed" })}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      <section aria-label={formatMessage({ id: "you.release.checklist.run.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.release.checklist.run.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.release.checklist.run.caption" })}
        </p>
        {draftView.disabledReason === null &&
        draftView.evidenceSteps !== null &&
        draftView.totalSteps !== null ? (
          <p
            className="mt-1.5 text-ui-xs text-foreground-subtlest"
            data-testid="you-release-checklist-run-projected"
          >
            {formatMessage(
              { id: "you.release.checklist.run.projected" },
              {
                evidence: draftView.evidenceSteps,
                total: draftView.totalSteps,
              },
            )}
            {draftView.evidenceSteps <= 0
              ? ` — ${formatMessage({ id: "you.release.checklist.run.zeroNote" })}`
              : ""}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || draftView.disabledReason !== null}
            data-testid="you-release-checklist-run"
            data-you-release-checklist-disabled-reason={draftView.disabledReason ?? ""}
            onClick={() =>
              void withBusy(() =>
                binding.controller.runLaunchGateCheck({
                  journeyId: checklistDraftJourneyId,
                }),
              )
            }
          >
            <ClipboardCheckIcon className="size-3.5" />
            {formatMessage({ id: "you.release.checklist.run.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.release.checklist.run.disabled" })}
            </span>
          ) : null}
        </div>
      </section>

      {ledgerRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-release-checklist-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.release.checklist.ledger.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.release.checklist.ledger.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.release.checklist.ledger.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.release.checklist.ledger.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.release.checklist.ledger.caption" })}
          </p>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.release.checklist.keyboardHint" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-release-checklist-ledger">
            {checklistRows.map((row) => {
              const selected = row.checklistId === selectedChecklistId;
              return (
                <li
                  key={row.checklistId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-release-checklist-record-row"
                  data-you-release-checklist-id={row.checklistId}
                  data-you-release-checklist-gate-state={row.gateState}
                  data-you-release-checklist-points-passed={row.pointsPassed}
                  data-you-release-checklist-points-total={row.pointsTotal}
                  data-you-release-checklist-signed={row.signed ? "true" : "false"}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store.getState().selectChecklist(row.checklistId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.checklistId}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.gateState === "all-points-passed"
                          ? "border-success/40 text-success"
                          : "border-warning/40 text-warning",
                      )}
                    >
                      {row.countsLabel} —{" "}
                      {formatMessage({
                        id: `you.release.checklist.gateState.${row.gateState}`,
                      })}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.signed
                          ? "border-success/40 text-success"
                          : "border-border text-foreground-subtle",
                      )}
                    >
                      {formatMessage({
                        id: row.signed
                          ? "you.release.checklist.ledger.row.signed"
                          : "you.release.checklist.ledger.row.unsigned",
                      })}
                    </Badge>
                  </button>
                  <span className="font-mono text-ui-xs text-foreground-subtlest">
                    {formatMessage({ id: "you.release.checklist.ledger.row.checkedAt" })}:{" "}
                    {row.checkedAt}
                  </span>
                  {/* 20 点逐点分解（LAUNCH GATE LAW 显示面：pass 态 + journey-evidence
                      链接 verbatim——无证据点绝不显示为通过）。 */}
                  <ol
                    className="flex flex-col gap-0.25 pl-1"
                    data-testid="you-release-checklist-points"
                  >
                    {row.points.map((point) => (
                      <li
                        key={point.point}
                        className={cn(
                          "flex flex-wrap items-baseline gap-1.5 font-mono text-ui-xs",
                          point.passed
                            ? "text-foreground-subtlest"
                            : "text-destructive",
                        )}
                        data-testid="you-release-checklist-point"
                        data-you-release-checklist-point-number={point.point}
                        data-you-release-checklist-point-passed={point.passed ? "true" : "false"}
                        data-you-release-checklist-point-evidence={
                          point.journeyEvidenceRef ?? ""
                        }
                      >
                        <span className="w-5 shrink-0 text-right">
                          {point.point}.
                        </span>
                        <span className="min-w-0">{point.description}</span>
                        <span
                          className="ml-auto flex min-w-0 shrink-0 items-baseline gap-1"
                          title={
                            point.journeyEvidenceRef !== null
                              ? formatMessage({ id: "you.release.checklist.ledger.point.evidence" })
                              : formatMessage({ id: "you.release.checklist.ledger.point.noEvidence" })
                          }
                        >
                          {point.journeyEvidenceRef !== null ? (
                            <>
                              <LinkIcon className="size-3 shrink-0" />
                              <span
                                className="truncate font-mono text-ui-xs underline decoration-dotted underline-offset-2"
                                data-testid="you-release-checklist-point-evidence-link"
                              >
                                {point.journeyEvidenceRef}
                              </span>
                            </>
                          ) : (
                            <span className="font-mono text-ui-xs">
                              {formatMessage({
                                id: "you.release.checklist.ledger.point.noEvidence",
                              })}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
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
