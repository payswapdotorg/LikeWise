// YOU Escalation Studio — CapabilityGap 面板（W8B）。
//
// 验收要求：gap 显示（category / confidence / attempted strategies / failure-evidence
// 链接——内容寻址标签）+ record-gap fixture 动作（注册面规格挑选，经 controller
// 端口）+ ToolGap / KnowledgeGap 投影显示与发布动作（派生非权威；malformed 请求
// 以 typed YOU_GAP_PROJECTION_INVALID 面板拒绝）。零业务逻辑：全部行来自
// escalationStudioProjection 的纯投影。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEscalationMessages } from "@/you/useEscalationMessages.js";
import type { UseEscalationStudioBinding } from "@/you/useEscalationStudio.js";
import {
  escalationGapById,
  orderedEscalationGaps,
} from "@/you/escalationController.js";
import {
  projectGapEvidenceRows,
  projectGapRows,
  projectGapSpecOptions,
  projectGapStrategyRows,
  projectKnowledgeProjectionRows,
  projectListRegionView,
  projectToolProjectionRows,
} from "@/you/escalationStudioProjection.js";

export function EscalationGapsPanel({ binding }: { binding: UseEscalationStudioBinding }) {
  const { formatMessage } = useEscalationMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedGapId = useStore(binding.store, (state) => state.selectedGapId);
  const selectedGapSpecId = useStore(binding.store, (state) => state.selectedGapSpecId);
  const [projectionKind, setProjectionKind] = useState<"tool" | "knowledge">("tool");
  const [busy, setBusy] = useState(false);

  const gaps = useMemo(() => orderedEscalationGaps(snapshot), [snapshot]);
  const gapRows = useMemo(() => projectGapRows(gaps), [gaps]);
  const inspected = useMemo(
    () =>
      escalationGapById(snapshot, selectedGapId) ??
      gaps.at(-1) ??
      null,
    [snapshot, gaps, selectedGapId],
  );
  const specOptions = useMemo(
    () => projectGapSpecOptions(snapshot?.gapSpecs ?? []),
    [snapshot],
  );
  const strategyRows = useMemo(
    () => (inspected ? projectGapStrategyRows(inspected.attemptedStrategies) : []),
    [inspected],
  );
  const evidenceRows = useMemo(
    () => (inspected ? projectGapEvidenceRows(inspected.failureEvidence) : []),
    [inspected],
  );
  const toolRows = useMemo(
    () => projectToolProjectionRows(snapshot?.toolProjections ?? []),
    [snapshot],
  );
  const knowledgeRows = useMemo(
    () => projectKnowledgeProjectionRows(snapshot?.knowledgeProjections ?? []),
    [snapshot],
  );
  const gapRegion = projectListRegionView(snapshot !== null, gapRows.length);

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
      data-testid="you-escalation-gaps"
    >
      <section aria-label={formatMessage({ id: "you.escalation.gaps.title" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.escalation.gaps.title" })}
        </h3>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.escalation.gaps.caption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.escalation.gaps.record.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.escalation.gaps.record.title" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.escalation.gaps.record.caption" })}
        </p>
        <div className="mt-2 flex flex-wrap gap-1" data-testid="you-escalation-gap-spec-options">
          {specOptions.map((option) => {
            const selected = option.specId === selectedGapSpecId;
            return (
              <Button
                key={option.specId}
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className={cn(
                  "h-6 px-2 font-mono text-ui-xs",
                  selected && "border-primary/60 bg-primary/10 text-primary",
                )}
                data-testid="you-escalation-gap-spec-option"
                data-you-escalation-gap-spec-id={option.specId}
                aria-pressed={selected}
                onClick={() => binding.store.getState().selectGapSpec(option.specId)}
              >
                {formatMessage({ id: `you.escalation.gaps.category.${option.category}` })}{" "}
                · {option.confidence} ·{" "}
                {formatMessage({
                  id: option.eligible
                    ? "you.escalation.gaps.spec.eligible"
                    : "you.escalation.gaps.spec.notEligible",
                })}
              </Button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || selectedGapSpecId === null}
            data-testid="you-escalation-gap-record"
            onClick={() =>
              void withBusy(() =>
                binding.controller.openCapabilityGap({
                  gapSpecId: selectedGapSpecId ?? "",
                }),
              )
            }
          >
            {formatMessage({ id: "you.escalation.gaps.record.apply" })}
          </Button>
          {selectedGapSpecId === null ? (
            <span className="text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.gaps.record.disabled" })}
            </span>
          ) : null}
        </div>
      </section>

      {gapRegion === "empty" ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-escalation-gaps-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.escalation.gaps.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.escalation.gaps.emptyHint" })}
          </p>
        </div>
      ) : (
        <section aria-label={formatMessage({ id: "you.escalation.gaps.title" })}>
          <ol className="flex flex-col gap-1.5" data-testid="you-escalation-gaps-list">
            {gapRows.map((row) => (
              <li
                key={row.gapId}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2",
                  row.gapId === inspected?.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-surface",
                )}
                data-testid="you-escalation-gap-row"
                data-you-escalation-gap-id={row.gapId}
                data-you-escalation-gap-category={row.category}
                data-you-escalation-gap-eligibility={row.eligibility}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-left"
                  onClick={() => binding.store.getState().selectGap(row.gapId)}
                >
                  <span className="font-mono text-ui-xs text-foreground">{row.gapId}</span>
                  <Badge
                    variant="outline"
                    className="border-primary/30 text-ui-xs text-primary"
                  >
                    {formatMessage({ id: `you.escalation.gaps.category.${row.category}` })}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-ui-xs",
                      row.eligibility === "escalated"
                        ? "border-success/40 text-success"
                        : row.eligibility === "eligible"
                          ? "border-warning/40 text-warning"
                          : "border-border text-foreground-subtle",
                    )}
                  >
                    {formatMessage({ id: `you.escalation.gaps.eligibility.${row.eligibility}` })}
                  </Badge>
                </button>
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                  <span>
                    {formatMessage({ id: "you.escalation.gaps.row.confidence" })}:{" "}
                    {row.confidence}
                  </span>
                  <span>
                    {formatMessage({ id: "you.escalation.gaps.row.strategies" })}:{" "}
                    {row.strategyCount}
                  </span>
                  <span>
                    {formatMessage({ id: "you.escalation.gaps.row.evidence" })}:{" "}
                    {row.evidenceCount}
                  </span>
                  <span>
                    {formatMessage({ id: "you.escalation.gaps.row.escalation" })}:{" "}
                    {row.escalationId ?? formatMessage({ id: "you.escalation.gaps.row.escalationNone" })}
                    {row.escalationStatus !== null ? ` (${row.escalationStatus})` : ""}
                  </span>
                </span>
                <span className="sr-only">{row.accessibleLabel}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {inspected ? (
        <section aria-label={formatMessage({ id: "you.escalation.gaps.inspect.title" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.escalation.gaps.inspect.title" })}{" "}
            <span className="font-mono text-foreground-subtle">{inspected.id}</span>
          </h4>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.escalation.gaps.inspect.suggested" })}:{" "}
            {inspected.suggestedNextAction}
          </p>
          <p className="mt-0.5 font-mono text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.escalation.gaps.inspect.intent" })}:{" "}
            {inspected.intentRef ?? formatMessage({ id: "you.escalation.gaps.inspect.intentNone" })}
          </p>

          <h5 className="mt-2 text-ui-xs font-medium text-foreground">
            {formatMessage({ id: "you.escalation.gaps.inspect.strategies.title" })}
          </h5>
          <p className="text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.escalation.gaps.inspect.strategies.hint" })}
          </p>
          <ol className="mt-1 flex flex-col gap-1" data-testid="you-escalation-gap-strategies">
            {strategyRows.map((row) => (
              <li
                key={row.index}
                className="flex flex-wrap items-baseline gap-x-2 rounded-md border border-border bg-surface px-2 py-1 font-mono text-ui-xs"
                data-testid="you-escalation-gap-strategy"
                data-you-escalation-strategy-outcome={row.outcome}
              >
                <span className="text-foreground">{row.strategy}</span>
                <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
                  {row.outcome}
                </Badge>
                <span className="min-w-0 truncate text-foreground-subtlest">
                  {row.evidenceRef ?? "—"}
                </span>
                <span className="sr-only">{row.accessibleLabel}</span>
              </li>
            ))}
          </ol>

          <h5 className="mt-2 text-ui-xs font-medium text-foreground">
            {formatMessage({ id: "you.escalation.gaps.inspect.evidence.title" })}
          </h5>
          <p className="text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.escalation.gaps.inspect.evidence.hint" })}
          </p>
          <ol className="mt-1 flex flex-col gap-1" data-testid="you-escalation-gap-evidence">
            {evidenceRows.map((row) => (
              <li
                key={row.index}
                className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-ui-xs text-foreground-subtle"
                data-testid="you-escalation-gap-evidence-ref"
              >
                {row.evidenceRef}
                <span className="sr-only">{row.accessibleLabel}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-label={formatMessage({ id: "you.escalation.projections.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.escalation.projections.title" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.escalation.projections.caption" })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex gap-1" data-testid="you-escalation-projection-kind-options">
            {(["tool", "knowledge"] as const).map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-6 px-2 text-ui-xs",
                  projectionKind === kind && "border-primary/60 bg-primary/10 text-primary",
                )}
                data-testid="you-escalation-projection-kind-option"
                data-you-escalation-projection-kind={kind}
                aria-pressed={projectionKind === kind}
                onClick={() => setProjectionKind(kind)}
              >
                {formatMessage({ id: `you.escalation.projections.kind.${kind}` })}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={busy || inspected === null}
            data-testid="you-escalation-projection-publish"
            onClick={() =>
              void withBusy(() =>
                binding.controller.publishGapProjection({
                  gapId: inspected?.id ?? "",
                  kind: projectionKind,
                }),
              )
            }
          >
            {formatMessage({ id: "you.escalation.projections.publish" })}
          </Button>
          {inspected === null ? (
            <span className="text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.projections.publishDisabled" })}
            </span>
          ) : null}
        </div>

        <h5 className="mt-2 text-ui-xs font-medium text-foreground">
          {formatMessage({ id: "you.escalation.projections.tool.title" })}
        </h5>
        {toolRows.length === 0 ? (
          <p className="mt-1 text-ui-xs text-foreground-subtlest" data-testid="you-escalation-tool-projections-empty">
            {formatMessage({ id: "you.escalation.projections.tool.empty" })}
          </p>
        ) : (
          <ol className="mt-1 flex flex-col gap-1" data-testid="you-escalation-tool-projections">
            {toolRows.map((row) => (
              <li
                key={`${row.gapId}:${row.toolId}`}
                className="flex flex-col gap-0.5 rounded-md border border-border bg-surface px-2 py-1 text-ui-xs"
                data-testid="you-escalation-tool-projection"
                data-you-escalation-tool-projection-gap={row.gapId}
              >
                <span className="font-mono text-foreground-subtle">
                  {row.gapId} · {formatMessage({ id: "you.escalation.projections.tool.toolId" })}:{" "}
                  {row.toolId}
                </span>
                <span className="text-foreground-subtlest">
                  {formatMessage({ id: "you.escalation.projections.tool.requiredCapability" })}:{" "}
                  {row.requiredCapability}
                </span>
                <span className="text-foreground-subtlest">
                  {formatMessage({ id: "you.escalation.projections.remediation" })}: {row.remediation}
                </span>
                <span className="sr-only">{row.accessibleLabel}</span>
              </li>
            ))}
          </ol>
        )}

        <h5 className="mt-2 text-ui-xs font-medium text-foreground">
          {formatMessage({ id: "you.escalation.projections.knowledge.title" })}
        </h5>
        {knowledgeRows.length === 0 ? (
          <p className="mt-1 text-ui-xs text-foreground-subtlest" data-testid="you-escalation-knowledge-projections-empty">
            {formatMessage({ id: "you.escalation.projections.knowledge.empty" })}
          </p>
        ) : (
          <ol className="mt-1 flex flex-col gap-1" data-testid="you-escalation-knowledge-projections">
            {knowledgeRows.map((row) => (
              <li
                key={`${row.gapId}:${row.domain}`}
                className="flex flex-col gap-0.5 rounded-md border border-border bg-surface px-2 py-1 text-ui-xs"
                data-testid="you-escalation-knowledge-projection"
                data-you-escalation-knowledge-projection-gap={row.gapId}
              >
                <span className="font-mono text-foreground-subtle">
                  {row.gapId} · {formatMessage({ id: "you.escalation.projections.knowledge.domain" })}:{" "}
                  {row.domain}
                </span>
                <span className="font-mono text-foreground-subtlest">
                  {formatMessage({ id: "you.escalation.projections.knowledge.missing" })}:{" "}
                  {row.missingKnowledgeRef ?? "—"}
                </span>
                <span className="text-foreground-subtlest">
                  {formatMessage({ id: "you.escalation.projections.remediation" })}: {row.remediation}
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
