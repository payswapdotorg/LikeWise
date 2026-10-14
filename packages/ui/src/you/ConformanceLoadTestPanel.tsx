// YOU Conformance Studio — load test reports 面板（W11B）。
//
// 验收要求：报告携 peak/p99 与回归清单（simulated-labeled 指示器）——LOAD TEST
// LAW：peak/p99 measured 或 simulated-labeled，绝不 invented；regressions listed
// verbatim。零 UI 业务逻辑；loading/error/empty 齐全。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { GaugeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useConformanceMessages } from "@/you/useConformanceMessages.js";
import type { UseConformanceStudioBinding } from "@/you/useConformanceStudio.js";
import { orderedLoadReports } from "@/you/conformanceController.js";
import {
  projectConformanceListRegionView,
  projectConformanceLoadReportRows,
  projectLoadDraftView,
} from "@/you/conformanceStudioProjection.js";

const METRICS_SOURCES: readonly ("measured" | "simulated" | "invented")[] = [
  "measured",
  "simulated",
  "invented",
];

export function ConformanceLoadTestPanel({
  binding,
}: {
  binding: UseConformanceStudioBinding;
}) {
  const { formatMessage } = useConformanceMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const loadDraftScenarioId = useStore(
    binding.store,
    (state) => state.loadDraftScenarioId,
  );
  const loadDraftMetricsSource = useStore(
    binding.store,
    (state) => state.loadDraftMetricsSource,
  );
  const selectedLoadReportId = useStore(
    binding.store,
    (state) => state.selectedLoadReportId,
  );
  const [busy, setBusy] = useState(false);

  const scenarios = snapshot?.loadScenarios ?? [];
  const draftView = useMemo(
    () =>
      projectLoadDraftView(
        {
          scenarioId: loadDraftScenarioId,
          metricsSource: loadDraftMetricsSource,
        },
        scenarios,
      ),
    [loadDraftScenarioId, loadDraftMetricsSource, scenarios],
  );
  const reportRows = useMemo(
    () => projectConformanceLoadReportRows(orderedLoadReports(snapshot)),
    [snapshot],
  );
  const reportsRegion = projectConformanceListRegionView(
    snapshot !== null,
    reportRows.length,
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
      data-testid="you-conformance-load"
    >
      <section aria-label={formatMessage({ id: "you.conformance.load.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <GaugeIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.conformance.load.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {reportRows.length} {formatMessage({ id: "you.conformance.load.count" })}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.load.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.load.scenarios.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.load.scenarios.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.load.scenarios.caption" })}
        </p>
        <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-load-scenarios">
          {scenarios.map((entry) => {
            const selected = entry.id === loadDraftScenarioId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 font-mono text-ui-xs",
                  selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                )}
                data-testid="you-conformance-load-scenario"
                data-you-conformance-load-scenario-id={entry.id}
                data-you-conformance-load-scenario-valid={entry.valid ? "true" : "false"}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                  onClick={() =>
                    binding.store.getState().setLoadDraftScenario(entry.id)
                  }
                >
                  <span className="text-foreground">{entry.scenarioRef}</span>
                  {!entry.valid ? (
                    <Badge variant="outline" className="border-warning/40 text-ui-xs text-warning">
                      {formatMessage({ id: "you.conformance.load.scenarios.invalid" })}
                    </Badge>
                  ) : null}
                </button>
                {entry.valid ? (
                  <span className="flex flex-wrap gap-x-2 text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.conformance.load.scenarios.peak" })}:{" "}
                      {formatMessage(
                        { id: "you.conformance.load.scenarios.rps" },
                        { rps: entry.peakRps },
                      )}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.load.scenarios.p99" })}:{" "}
                      {formatMessage(
                        { id: "you.conformance.load.scenarios.ms" },
                        { ms: entry.p99Ms },
                      )}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.load.scenarios.regressions" })}:{" "}
                      {entry.regressions.length}
                    </span>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={formatMessage({ id: "you.conformance.load.run.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.conformance.load.run.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.conformance.load.run.caption" })}
        </p>
        <div className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-load-sources">
          <span className="text-ui-xs font-medium text-foreground-subtle">
            {formatMessage({ id: "you.conformance.load.run.source" })}
          </span>
          <div className="flex flex-wrap gap-1">
            {METRICS_SOURCES.map((source) => {
              const selected = source === loadDraftMetricsSource;
              return (
                <Button
                  key={source}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                    source !== "simulated" && "border-warning/40 text-warning",
                  )}
                  data-testid="you-conformance-load-source-option"
                  data-you-conformance-load-source={source}
                  aria-pressed={selected}
                  onClick={() =>
                    binding.store.getState().setLoadDraftMetricsSource(source)
                  }
                >
                  {formatMessage({ id: `you.conformance.metrics.${source}` })}
                </Button>
              );
            })}
          </div>
          <p
            className="text-ui-xs text-foreground-subtlest"
            data-testid="you-conformance-load-source-note"
          >
            {formatMessage({
              id: `you.conformance.load.run.sourceNote.${loadDraftMetricsSource}`,
            })}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || draftView.disabledReason !== null}
            data-testid="you-conformance-load-run"
            data-you-conformance-load-run-disabled-reason={draftView.disabledReason ?? ""}
            onClick={() =>
              void withBusy(() =>
                binding.controller.runLoadTest({
                  scenarioId: loadDraftScenarioId,
                  metricsSource: loadDraftMetricsSource,
                }),
              )
            }
          >
            <GaugeIcon className="size-3.5" />
            {formatMessage({ id: "you.conformance.load.run.apply" })}
          </Button>
          {draftView.disabledReason !== null ? (
            <span className="text-ui-xs text-foreground-subtle">
              {formatMessage({ id: "you.conformance.load.run.disabled" })}
            </span>
          ) : null}
        </div>
      </section>

      {reportsRegion === "empty" ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-conformance-load-empty"
        >
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.conformance.load.reports.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.load.reports.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.conformance.load.reports.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.conformance.load.reports.title" })}
          </h4>
          <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.conformance.load.reports.caption" })}
          </p>
          <ol className="mt-1.5 flex flex-col gap-1" data-testid="you-conformance-load-reports">
            {reportRows.map((row) => {
              const selected = row.reportId === selectedLoadReportId;
              return (
                <li
                  key={row.reportId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                  )}
                  data-testid="you-conformance-load-report"
                  data-you-conformance-load-report-id={row.reportId}
                  data-you-conformance-load-simulated={row.simulatedLabeled ? "true" : "false"}
                  data-you-conformance-load-regressions={row.regressions.length}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-left"
                    onClick={() =>
                      binding.store.getState().selectLoadReport(row.reportId)
                    }
                  >
                    <span className="font-mono text-ui-xs text-foreground">
                      {row.reportId}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        row.simulatedLabeled
                          ? "border-warning/40 text-warning"
                          : "border-success/40 text-success",
                      )}
                    >
                      {formatMessage({
                        id: row.simulatedLabeled
                          ? "you.conformance.load.reports.simulatedLabel"
                          : "you.conformance.load.reports.measuredLabel",
                      })}
                    </Badge>
                  </button>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                    <span>
                      {formatMessage({ id: "you.conformance.load.reports.row.peak" })}:{" "}
                      {formatMessage(
                        { id: "you.conformance.load.scenarios.rps" },
                        { rps: row.peakRps },
                      )}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.load.reports.row.p99" })}:{" "}
                      {formatMessage(
                        { id: "you.conformance.load.scenarios.ms" },
                        { ms: row.p99Ms },
                      )}
                    </span>
                    <span>
                      {formatMessage({ id: "you.conformance.contentRef" })}: {row.scenarioRef}
                    </span>
                  </span>
                  <span
                    className="flex flex-col gap-0.5 font-mono text-ui-xs text-foreground-subtlest"
                    data-testid="you-conformance-load-regressions"
                  >
                    <span>
                      {formatMessage({ id: "you.conformance.load.reports.row.regressions" })}:{" "}
                      {row.regressions.length > 0
                        ? ""
                        : formatMessage({ id: "you.conformance.load.reports.row.none" })}
                    </span>
                    {row.regressions.map((regression) => (
                      <span key={regression} className="pl-2 text-warning">
                        · {regression}
                      </span>
                    ))}
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
