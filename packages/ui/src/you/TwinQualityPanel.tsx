// YOU Twin Studio — 质量地图面板（W3B）。
//
// 验收要求：domain-keyed 评分以**可访问**方式呈现（非仅颜色：每行带数值文本 +
// 文本级 level + 进度条），缺陷清单（class、severity、补救提示）可读。
// 评分为 fixture 定义的确定性投影，非科学度量（文案显式声明）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { ActivityIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Progress } from "@/components/ui/progress.js";
import { cn } from "@/components/lib/utils.js";
import { useTwinMessages } from "@/you/useTwinMessages.js";
import type { UseTwinStudioBinding } from "@/you/useTwinStudio.js";
import { orderedTwinVersions } from "@/you/twinController.js";
import { projectDeficiencyRows, projectQualityMapRows } from "@/you/twinStudioProjection.js";

export function TwinQualityPanel({ binding }: { binding: UseTwinStudioBinding }) {
  const { formatMessage } = useTwinMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedVersionId = useStore(binding.store, (state) => state.selectedVersionId);
  const [busy, setBusy] = useState(false);

  const versions = useMemo(() => orderedTwinVersions(snapshot), [snapshot]);
  const version = useMemo(
    () => versions.find((candidate) => candidate.id === selectedVersionId) ?? versions.at(-1) ?? null,
    [versions, selectedVersionId],
  );
  const qualityRows = useMemo(() => projectQualityMapRows(version), [version]);
  const deficiencyRows = useMemo(() => projectDeficiencyRows(version), [version]);

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

  if (!version) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6" data-testid="you-twin-quality-empty">
        <p className="text-ui-base text-foreground-subtle">
          {formatMessage({ id: "you.twin.quality.empty" })}
        </p>
        <p className="max-w-[24rem] text-center text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.twin.quality.emptyHint" })}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-twin-quality"
      data-you-twin-version-id={version.id}
    >
      <section aria-label={formatMessage({ id: "you.twin.quality.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.twin.quality.title" })}
          </h3>
          <Badge variant="secondary" className="font-mono text-ui-xs">
            v{version.version}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-ui-xs"
            disabled={busy}
            data-testid="you-twin-quality-reassess"
            onClick={() =>
              void withBusy(() => binding.controller.assessQuality({ versionId: version.id }))
            }
          >
            <ActivityIcon className="size-3.5" />
            {formatMessage({ id: "you.twin.quality.reassess" })}
          </Button>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtle">
          {formatMessage({ id: "you.twin.quality.scoresCaption" })}
        </p>
        <p className="mt-0.5 font-mono text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.twin.quality.assessedAt" })}: {version.quality.assessedAt}
        </p>

        <ul className="mt-2 flex flex-col gap-1" data-testid="you-twin-quality-map">
          {qualityRows.map((row) => (
            <li
              key={row.domain}
              className="flex flex-col gap-1 rounded-md border border-border bg-card px-2 py-1.5"
              data-testid="you-twin-quality-row"
              data-you-twin-quality-domain={row.domain}
              data-you-twin-quality-score={row.score}
              data-you-twin-quality-level={row.level}
            >
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
                <span className="min-w-0 break-all font-mono text-ui-xs text-foreground">
                  {row.domain}
                </span>
                <span className="font-mono text-ui-xs text-foreground">
                  {row.score.toFixed(2)}
                </span>
                <Badge
                  variant={row.level === "low" ? "outline" : "secondary"}
                  className={cn(
                    "text-ui-xs",
                    row.level === "strong" && "text-success",
                    row.level === "adequate" && "text-foreground",
                    row.level === "low" && "border-warning/40 text-warning",
                  )}
                >
                  {formatMessage({ id: `you.twin.quality.level.${row.level}` })}
                </Badge>
              </div>
              <div
                className="sr-only"
                data-testid="you-twin-quality-row-label"
                data-you-twin-quality-label={row.accessibleLabel}
              >
                {row.accessibleLabel}
              </div>
              <Progress
                value={row.percent}
                aria-label={row.accessibleLabel}
                data-testid="you-twin-quality-progress"
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={formatMessage({ id: "you.twin.quality.deficiencies" })}>
        <div className="flex items-center gap-1.5">
          <TriangleAlertIcon className="size-3.5 shrink-0 text-foreground-subtle" />
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.twin.quality.deficiencies" })}
          </h4>
        </div>
        {deficiencyRows.length === 0 ? (
          <p className="mt-1 text-ui-xs text-foreground-subtle" data-testid="you-twin-deficiencies-none">
            {formatMessage({ id: "you.twin.quality.deficienciesNone" })}
          </p>
        ) : (
          <ol className="mt-1.5 flex flex-col gap-1.5" data-testid="you-twin-deficiency-list">
            {deficiencyRows.map((row) => (
              <li
                key={row.id}
                className="rounded-md border border-border bg-card p-2"
                data-testid="you-twin-deficiency"
                data-you-twin-deficiency-id={row.id}
                data-you-twin-deficiency-class={row.deficiencyClass}
                data-you-twin-deficiency-domain={row.domain}
                data-you-twin-deficiency-severity={row.severity}
              >
                <div className="sr-only" data-testid="you-twin-deficiency-label">
                  {row.accessibleLabel}
                </div>
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-ui-xs text-foreground">
                    {row.deficiencyClass}
                  </span>
                  <span className="font-mono text-ui-xs text-foreground-subtle">@ {row.domain}</span>
                  <Badge variant="outline" className="text-ui-xs text-warning">
                    {formatMessage({ id: "you.twin.quality.deficiencySeverity" })}{" "}
                    {row.severity.toFixed(2)}
                  </Badge>
                  {row.remediationEvidenceRequestId ? (
                    <span className="font-mono text-ui-xs text-foreground-subtlest">
                      → {row.remediationEvidenceRequestId}
                    </span>
                  ) : null}
                </div>
                {row.remediationHint ? (
                  <p className="mt-0.5 text-ui-xs text-foreground-subtle" data-testid="you-twin-deficiency-hint">
                    {formatMessage({ id: "you.twin.quality.deficiencyHint" })}: {row.remediationHint}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
