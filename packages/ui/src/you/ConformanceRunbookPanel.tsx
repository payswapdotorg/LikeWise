// YOU Conformance Studio — incident runbook 面板（W11B）。
//
// 验收要求：incident 条目携 detection / containment / recovery + exercised /
// unexercised 状态——RUNBOOK LAW：每条 entry 被 ≥1 条 failure-injection journey
// 演练，或显式标注 unexercised。零 UI 业务逻辑；loading/error/empty 齐全。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { BookOpenIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useConformanceMessages } from "@/you/useConformanceMessages.js";
import type { UseConformanceStudioBinding } from "@/you/useConformanceStudio.js";
import {
  incidentClassIsExercised,
  orderedRunbook,
} from "@/you/conformanceController.js";
import {
  projectConformanceListRegionView,
  projectConformanceRunbookRows,
  projectRunbookDraftView,
} from "@/you/conformanceStudioProjection.js";

const EXERCISE_VIAS: readonly ("failure-injection" | "exercise-claim")[] = [
  "failure-injection",
  "exercise-claim",
];

export function ConformanceRunbookPanel({
  binding,
}: {
  binding: UseConformanceStudioBinding;
}) {
  const { formatMessage } = useConformanceMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const runbookDraftIncidentClassId = useStore(
    binding.store,
    (state) => state.runbookDraftIncidentClassId,
  );
  const runbookDraftVia = useStore(
    binding.store,
    (state) => state.runbookDraftVia,
  );
  const selectedRunbookEntryId = useStore(
    binding.store,
    (state) => state.selectedRunbookEntryId,
  );
  const [busy, setBusy] = useState(false);

  const incidentClasses = snapshot?.incidentClasses ?? [];
  const steps = snapshot?.journeys.find((entry) => entry.id === "journey-launch-gate")
    ?.steps ?? [];
  const draftView = useMemo(
    () =>
      projectRunbookDraftView(
        {
          incidentClassId: runbookDraftIncidentClassId,
          via: runbookDraftVia,
        },
        incidentClasses.map((entry) => ({
          ...entry,
          steps,
        })),
      ),
    [incidentClasses, runbookDraftIncidentClassId, runbookDraftVia, steps],
  );
  const runbookRows = useMemo(
    () => projectConformanceRunbookRows(orderedRunbook(snapshot)),
    [snapshot],
  );
  const ledgerRegion = projectConformanceListRegionView(
    snapshot !== null,
    runbookRows.length,
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
      data-testid="you-conformance-runbook"
    >
      <section aria-label={formatMessage({ id: "you.conformance.runbook.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <BookOpenIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.conformance.runbook.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {runbookRows.length} {formatMessage({ id: "you.conformance.runbook.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.runbook.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.runbook.classes.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.runbook.classes.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.runbook.classes.caption" })}
        </p>
        <ol
          className="mt-1.5 flex flex-col gap-1"
          data-testid="you-conformance-runbook-classes"
        >
          {incidentClasses.map((entry) => {
            const selected = entry.id === runbookDraftIncidentClassId;
            const exercised = incidentClassIsExercised(snapshot, entry.incidentClass);
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-conformance-runbook-class"
                data-you-conformance-runbook-class-id={entry.id}
                data-you-conformance-runbook-class-exercised={exercised ? "true" : "false"}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                  onClick={() =>
                    binding.store.getState().setRunbookDraftIncidentClass(entry.id)
                  }
                >
                  <span className="text-foreground">{entry.incidentClass}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-ui-xs",
                      exercised
                        ? "border-success/40 text-success"
                        : "border-warning/40 text-warning",
                    )}
                  >
                    {formatMessage({
                      id: exercised
                        ? "you.conformance.runbook.ledger.row.exercised"
                        : "you.conformance.runbook.ledger.row.unexercised",
                    })}
                  </Badge>
                </button>
                <span className="flex flex-col gap-0.5 text-foreground-subtlest">
                  <span>
                    {formatMessage({ id: "you.conformance.runbook.classes.detection" })}:{" "}
                    {entry.detection}
                  </span>
                  <span>
                    {formatMessage({ id: "you.conformance.runbook.classes.containment" })}:{" "}
                    {entry.containment}
                  </span>
                  <span>
                    {formatMessage({ id: "you.conformance.runbook.classes.recovery" })}:{" "}
                    {entry.recovery}
                  </span>
                  <span>
                    {formatMessage({ id: "you.conformance.runbook.classes.boundStep" })}{" "}
                    {entry.boundStepIndex}: {steps[entry.boundStepIndex - 1] ?? "—"}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.runbook.exercise.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.runbook.exercise.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.runbook.exercise.caption" })}
        </p>
        <div className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-runbook-vias">
          <span className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.conformance.runbook.exercise.via" })}
          </span>
          <div className="flex flex-wrap gap-1">
            {EXERCISE_VIAS.map((via) => {
              const selected = via === runbookDraftVia;
              return (
                <Button
                  key={via}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                    via === "exercise-claim" && "border-warning/40 text-warning",
                  )}
                  data-testid="you-conformance-runbook-via-option"
                  data-you-conformance-runbook-via={via}
                  aria-pressed={selected}
                  onClick={() => binding.store.getState().setRunbookDraftVia(via)}
                >
                  {via}
                </Button>
              );
            })}
          </div>
          <p
            className="text-ui-xs text-foreground-subtlest"
            data-testid="you-conformance-runbook-via-note"
          >
            {formatMessage({
              id: `you.conformance.runbook.exercise.viaNote.${runbookDraftVia}`,
            })}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || draftView.disabledReason !== null}
            data-testid="you-conformance-runbook-exercise"
            data-you-conformance-runbook-disabled-reason={draftView.disabledReason ?? ""}
            onClick={() =>
              void withBusy(() =>
                binding.controller.exerciseRunbook({
                  incidentClassId: runbookDraftIncidentClassId,
                  via: runbookDraftVia,
                }),
              )
            }
          >
            <BookOpenIcon className="size-3.5" />
            {formatMessage({ id: "you.conformance.runbook.exercise.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.conformance.runbook.exercise.disabled" })}
            </span>
          ) : null}
        </div>
      </section>

      {ledgerRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-conformance-runbook-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.conformance.runbook.ledger.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.runbook.ledger.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.conformance.runbook.ledger.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.conformance.runbook.ledger.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.runbook.ledger.caption" })}
          </p>
          <ol
            className="mt-1.5 flex flex-col gap-1"
            data-testid="you-conformance-runbook-ledger"
          >
            {runbookRows.map((row) => {
              const selected = row.entryId === selectedRunbookEntryId;
              return (
                <li
                  key={row.entryId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-conformance-runbook-entry"
                  data-you-conformance-runbook-entry-id={row.entryId}
                  data-you-conformance-runbook-kind={row.kind}
                  data-you-conformance-runbook-exercised={row.exercised ? "true" : "false"}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store.getState().selectRunbookEntry(row.entryId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.entryId}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.kind === "exercise"
                          ? "border-success/40 text-success"
                          : "border-border text-foreground-subtle",
                      )}
                    >
                      {formatMessage({
                        id: `you.conformance.runbook.kind.${row.kind}`,
                      })}
                    </Badge>
                    {/* RUNBOOK LAW 显示面：exercised / unexercised 显式呈现。 */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.exercised
                          ? "border-success/40 text-success"
                          : "border-warning/40 text-warning",
                      )}
                    >
                      {formatMessage({
                        id: row.exercised
                          ? "you.conformance.runbook.ledger.row.exercised"
                          : "you.conformance.runbook.ledger.row.unexercised",
                      })}
                    </Badge>
                  </button>
                  <span className="flex flex-col gap-0.5 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.conformance.runbook.ledger.row.incidentClass" })}:{" "}
                      {row.incidentClass}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.runbook.classes.detection" })}:{" "}
                      {row.detection}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.runbook.classes.containment" })}:{" "}
                      {row.containment}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.runbook.classes.recovery" })}:{" "}
                      {row.recovery}
                    </span>
                    {row.supersedesEntryId !== null ? (
                      <span>
                        {formatMessage({ id: "you.conformance.runbook.ledger.row.supersedes" })}:{" "}
                        {row.supersedesEntryId}
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
    </div>
  );
}
