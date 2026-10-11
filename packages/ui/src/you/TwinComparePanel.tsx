// YOU Twin Studio — 版本对比面板（W3B）。
//
// 验收要求：两个 TwinVersion 的 side-by-side 或 delta 视图（域分数、缺陷、溯源）。
// 对比是纯投影（projectTwinVersionCompare）：分数差值行 + 缺陷解决/新增清单 +
// 溯源变化（重建作业产物 vs 直接发布）。模式切换 side-by-side / delta。
import { useMemo } from "react";
import { useStore } from "zustand";
import { Columns2Icon, GitCompareIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useTwinMessages } from "@/you/useTwinMessages.js";
import type { UseTwinStudioBinding } from "@/you/useTwinStudio.js";
import { orderedTwinVersions } from "@/you/twinController.js";
import { projectTwinVersionCompare } from "@/you/twinStudioProjection.js";
import type { TwinCompareMode } from "@/you/twinStudioStore.js";

export function TwinComparePanel({ binding }: { binding: UseTwinStudioBinding }) {
  const { formatMessage } = useTwinMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const compareBaseVersionId = useStore(binding.store, (state) => state.compareBaseVersionId);
  const compareTargetVersionId = useStore(binding.store, (state) => state.compareTargetVersionId);
  const compareMode = useStore(binding.store, (state) => state.compareMode);

  const versions = useMemo(() => orderedTwinVersions(snapshot), [snapshot]);
  const base = versions.find((version) => version.id === compareBaseVersionId) ?? null;
  const target = versions.find((version) => version.id === compareTargetVersionId) ?? null;
  const compare = base && target && base.id !== target.id ? projectTwinVersionCompare(base, target) : null;

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
      data-testid="you-twin-compare"
    >
      <section aria-label={formatMessage({ id: "you.twin.compare.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.twin.compare.title" })}
          </h3>
          <div className="flex gap-0.5 rounded-lg border border-border bg-surface p-0.5">
            {(["side-by-side", "delta"] as const).map((mode: TwinCompareMode) => (
              <Button
                key={mode}
                type="button"
                variant={compareMode === mode ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-ui-xs"
                data-testid={`you-twin-compare-mode-${mode}`}
                aria-pressed={compareMode === mode}
                onClick={() => binding.store.getState().setCompareMode(mode)}
              >
                {mode === "delta" ? (
                  <GitCompareIcon className="size-3.5" />
                ) : (
                  <Columns2Icon className="size-3.5" />
                )}
                {formatMessage({ id: `you.twin.compare.mode.${mode}` })}
              </Button>
            ))}
          </div>
        </div>

        {versions.length < 2 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-twin-compare-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.twin.compare.notEnoughVersions" })}
            </p>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <VersionSelect
              label={formatMessage({ id: "you.twin.compare.base" })}
              versions={versions}
              value={base?.id ?? null}
              onChange={(value) => binding.store.getState().setCompareBase(value)}
              testId="you-twin-compare-base"
            />
            <VersionSelect
              label={formatMessage({ id: "you.twin.compare.target" })}
              versions={versions}
              value={target?.id ?? null}
              onChange={(value) => binding.store.getState().setCompareTarget(value)}
              testId="you-twin-compare-target"
            />
          </div>
        )}

        {versions.length >= 2 && !compare ? (
          <p
            className="mt-2 text-ui-xs text-foreground-subtle"
            data-testid="you-twin-compare-same"
          >
            {formatMessage({ id: "you.twin.compare.sameVersion" })}
          </p>
        ) : null}
      </section>

      {compare ? (
        <>
          <section aria-label={formatMessage({ id: "you.twin.compare.domain" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.twin.compare.domain" })}
            </h4>
            <div className="mt-1.5 overflow-x-auto">
              <table className="w-full min-w-[24rem] border-collapse text-left" data-testid="you-twin-compare-scores">
                <thead>
                  <tr className="text-ui-xs text-foreground-subtle">
                    <th scope="col" className="px-1.5 py-1 font-medium">
                      {formatMessage({ id: "you.twin.compare.domain" })}
                    </th>
                    {compareMode === "side-by-side" ? (
                      <>
                        <th scope="col" className="px-1.5 py-1 font-medium">
                          {formatMessage({ id: "you.twin.compare.base" })} (v{compare.baseVersionNumber})
                        </th>
                        <th scope="col" className="px-1.5 py-1 font-medium">
                          {formatMessage({ id: "you.twin.compare.target" })} (v{compare.targetVersionNumber})
                        </th>
                      </>
                    ) : null}
                    <th scope="col" className="px-1.5 py-1 font-medium">
                      {formatMessage({ id: "you.twin.compare.scoreDelta" })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {compare.scoreRows.map((row) => (
                    <tr
                      key={row.domain}
                      className="border-t border-border/50"
                      data-testid="you-twin-compare-score-row"
                      data-you-twin-compare-domain={row.domain}
                      data-you-twin-compare-change={row.change}
                      data-you-twin-compare-delta={row.delta ?? "n/a"}
                    >
                      <td className="px-1.5 py-1 font-mono text-ui-xs text-foreground">
                        {row.domain}
                      </td>
                      {compareMode === "side-by-side" ? (
                        <>
                          <td className="px-1.5 py-1 font-mono text-ui-xs text-foreground-subtle">
                            {row.baseScore === null ? "—" : row.baseScore.toFixed(2)}
                          </td>
                          <td className="px-1.5 py-1 font-mono text-ui-xs text-foreground">
                            {row.targetScore === null ? "—" : row.targetScore.toFixed(2)}
                          </td>
                        </>
                      ) : null}
                      <td className="px-1.5 py-1">
                        <span
                          className={cn(
                            "font-mono text-ui-xs",
                            row.change === "improved" && "text-success",
                            row.change === "regressed" && "text-destructive",
                            (row.change === "unchanged" || row.change === "added" || row.change === "removed") &&
                              "text-foreground-subtle",
                          )}
                        >
                          {row.delta === null
                            ? "—"
                            : `${row.delta > 0 ? "+" : ""}${row.delta.toFixed(2)}`}
                        </span>
                        <span className="ml-1.5 text-ui-xs text-foreground-subtle">
                          {formatMessage({ id: `you.twin.compare.change.${row.change}` })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label={formatMessage({ id: "you.twin.compare.deficiencies" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.twin.compare.deficiencies" })}
            </h4>
            <div className="mt-1.5 flex flex-col gap-1.5" data-testid="you-twin-compare-deficiencies">
              <CompareDeficiencyGroup
                label={formatMessage({ id: "you.twin.compare.resolved" })}
                keys={compare.resolvedDeficiencyKeys}
                tone="success"
                testId="you-twin-compare-resolved"
              />
              <CompareDeficiencyGroup
                label={formatMessage({ id: "you.twin.compare.added" })}
                keys={compare.addedDeficiencyKeys}
                tone="destructive"
                testId="you-twin-compare-added"
              />
              <CompareDeficiencyGroup
                label={formatMessage({ id: "you.twin.compare.unchanged" })}
                keys={compare.unchangedDeficiencyKeys}
                tone="subtle"
                testId="you-twin-compare-unchanged"
              />
            </div>
          </section>

          <section aria-label={formatMessage({ id: "you.twin.compare.provenance" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.twin.compare.provenance" })}
            </h4>
            <div className="mt-1.5 flex flex-col gap-1 rounded-lg border border-border bg-card p-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-ui-xs font-medium text-foreground-subtle">
                  {formatMessage({ id: "you.twin.compare.base" })}:
                </span>
                <span className="break-all font-mono text-ui-xs text-foreground">
                  {compare.baseProvenance.source}
                </span>
                <span className="font-mono text-ui-xs text-foreground-subtlest">
                  {compare.baseDomainBlockCount} blocks · {compare.baseEvidenceBindingCount} bindings
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-ui-xs font-medium text-foreground-subtle">
                  {formatMessage({ id: "you.twin.compare.target" })}:
                </span>
                <span className="break-all font-mono text-ui-xs text-foreground">
                  {compare.targetProvenance.source}
                </span>
                <span className="font-mono text-ui-xs text-foreground-subtlest">
                  {compare.targetDomainBlockCount} blocks · {compare.targetEvidenceBindingCount} bindings
                </span>
              </div>
              <p className="text-ui-xs text-foreground-subtle" data-testid="you-twin-compare-provenance-change">
                {formatMessage({
                  id: compare.provenanceSourceChanged
                    ? "you.twin.compare.provenanceSourceChanged"
                    : "you.twin.compare.provenanceSourceSame",
                })}
                {compare.targetProvenance.lineage.length > 0 ? (
                  <span className="ml-1.5 font-mono text-ui-xs text-foreground-subtlest">
                    lineage: {compare.targetProvenance.lineage.join(" → ")}
                  </span>
                ) : null}
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function VersionSelect({
  label,
  versions,
  value,
  onChange,
  testId,
}: {
  label: string;
  versions: readonly { readonly id: string; readonly version: number; readonly status: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
  testId: string;
}) {
  const { formatMessage } = useTwinMessages();
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-ui-xs font-medium text-foreground-subtle">{label}</span>
      <select
        className="h-7 w-full min-w-0 rounded-md border border-input-border bg-input px-1.5 text-ui-sm text-foreground"
        value={value ?? ""}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
      >
        {versions.length === 0 ? (
          <option value="">—</option>
        ) : null}
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            v{version.version} · {formatMessage({ id: `you.twin.versions.status.${version.status}` })}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompareDeficiencyGroup({
  label,
  keys,
  tone,
  testId,
}: {
  label: string;
  keys: readonly string[];
  tone: "success" | "destructive" | "subtle";
  testId: string;
}) {
  return (
    <div
      className="rounded-md border border-border bg-card p-2"
      data-testid={testId}
      data-you-twin-count={keys.length}
    >
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-ui-xs font-medium text-foreground-subtle">{label}:</span>
        <Badge
          variant={tone === "subtle" ? "outline" : "secondary"}
          className={cn(
            "text-ui-xs",
            tone === "success" && "text-success",
            tone === "destructive" && "text-destructive",
            tone === "subtle" && "text-foreground-subtlest",
          )}
        >
          {keys.length}
        </Badge>
      </div>
      {keys.length > 0 ? (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {keys.map((key) => (
            <li key={key} className="break-all font-mono text-ui-xs text-foreground-subtle">
              {key}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">—</p>
      )}
    </div>
  );
}
