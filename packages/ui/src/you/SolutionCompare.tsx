// YOU Solution Studio — 版本对比面板（W1B）。
//
// 版本历史列表（最新在前）+ 与当前 canonical 的对照：质量逐类前后差、
// 实体 transform 变化、环境变化。对比对象可任选历史版本（store 视图状态）。
import { useMemo } from "react";
import { useStore } from "zustand";
import type { SolutionVersion } from "@zcode/shared";
import { cn } from "@/components/lib/utils.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.js";
import { currentSolutionVersion } from "@/you/solutionController.js";
import { diffSolutionVersionAgainst } from "@/you/solutionExportModel.js";
import type { UseSolutionSurfaceBinding } from "@/you/useSolutionSurface.js";
import { useYouMessages } from "@/you/youMessages.js";

export function SolutionComparePanel({ binding }: { binding: UseSolutionSurfaceBinding }) {
  const { formatMessage } = useYouMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const compareVersionId = useStore(binding.store, (state) => state.compareVersionId);
  const current = snapshot ? currentSolutionVersion(snapshot) : null;
  const target = useMemo(
    () =>
      snapshot?.versions.find((version) => version.id === compareVersionId) ??
      snapshot?.versions.at(-2) ??
      null,
    [snapshot, compareVersionId],
  );

  if (!snapshot || !current || snapshot.versions.length < 2) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle" data-testid="you-solution-compare-empty">
          {formatMessage({ id: "you.solution.compare.empty" })}
        </p>
      </div>
    );
  }

  const diff = target ? diffSolutionVersionAgainst(target, current) : null;

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-solution-compare"
    >
      <section aria-label={formatMessage({ id: "you.solution.compare.title" })}>
        <div className="flex items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.solution.compare.title" })}
          </h3>
          <Select
            value={target?.id ?? ""}
            onValueChange={(value) => binding.store.getState().setCompareVersionId(value)}
          >
            <SelectTrigger
              size="sm"
              className="ml-auto h-7 max-w-56 text-ui-xs"
              aria-label={formatMessage({ id: "you.solution.compare.target" })}
              data-testid="you-solution-compare-target"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {snapshot.versions
                .filter((version) => version.id !== current.id)
                .slice()
                .reverse()
                .map((version) => (
                  <SelectItem key={version.id} value={version.id} className="text-ui-xs">
                    v{version.version} · {version.provenance.generator}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        {target ? (
          <p className="mt-1 font-mono text-ui-xs text-foreground-subtlest">
            v{target.version} → v{current.version} ({formatMessage({ id: "you.solution.compare.current" })})
          </p>
        ) : null}
      </section>

      {diff ? (
        <>
          <section aria-label={formatMessage({ id: "you.solution.compare.qualityTable" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.solution.compare.qualityTable" })}
            </h4>
            {diff.identical && diff.qualityChanges.length === 0 ? (
              <p className="mt-1 text-ui-xs text-foreground-subtle">
                {formatMessage({ id: "you.solution.compare.identical" })}
              </p>
            ) : (
              <table className="mt-1 w-full text-ui-xs" data-testid="you-solution-compare-quality">
                <tbody>
                  {diff.qualityChanges.map((entry) => (
                    <tr key={entry.deficiencyClass}>
                      <td className="py-0.5 pr-2 text-foreground-subtle">
                        {entry.deficiencyClass}
                      </td>
                      <td className="py-0.5 pr-2 text-right font-mono text-foreground-subtlest">
                        {entry.before.toFixed(2)}
                      </td>
                      <td className="py-0.5 pr-2 text-right font-mono text-foreground-subtlest">
                        →
                      </td>
                      <td className="py-0.5 text-right font-mono font-medium text-foreground">
                        {entry.after.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section aria-label={formatMessage({ id: "you.solution.compare.entities" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.solution.compare.entities" })}
            </h4>
            {diff.entityChanges.length === 0 ? (
              <p className="mt-1 text-ui-xs text-foreground-subtle">—</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1" data-testid="you-solution-compare-entities">
                {diff.entityChanges.map((change) => (
                  <li
                    key={`${change.entityId}-${change.kind}`}
                    className="rounded-md bg-surface px-2 py-1"
                  >
                    <p className="text-ui-xs">
                      <span
                        className={cn(
                          "mr-1.5 font-mono",
                          change.kind === "added" && "text-success",
                          change.kind === "removed" && "text-danger",
                          (change.kind === "transform-changed" ||
                            change.kind === "attributes-changed") &&
                            "text-warning",
                        )}
                      >
                        {change.kind}
                      </span>
                      <span className="text-foreground">{change.label}</span>
                    </p>
                    {change.kind === "transform-changed" ? (
                      <p className="mt-0.5 break-all font-mono text-ui-xs text-foreground-subtlest">
                        {change.detail}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label={formatMessage({ id: "you.solution.compare.environment" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.solution.compare.environment" })}
            </h4>
            <p
              className={cn(
                "mt-1 text-ui-xs",
                diff.environmentChanged ? "text-foreground" : "text-foreground-subtle",
              )}
            >
              {diff.environmentChanged ? diff.environmentDetail : "—"}
            </p>
          </section>
        </>
      ) : null}

      <section aria-label={formatMessage({ id: "you.solution.compare.history" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.solution.compare.history" })}
        </h4>
        <ul className="mt-1 flex flex-col gap-1" data-testid="you-solution-version-history">
          {snapshot.versions
            .slice()
            .reverse()
            .map((version) => (
              <VersionHistoryRow
                key={version.id}
                version={version}
                isCurrent={version.id === current.id}
                isTarget={version.id === target?.id}
                onSelect={() => binding.store.getState().setCompareVersionId(version.id)}
              />
            ))}
        </ul>
      </section>
    </div>
  );
}

function VersionHistoryRow({
  version,
  isCurrent,
  isTarget,
  onSelect,
}: {
  version: SolutionVersion;
  isCurrent: boolean;
  isTarget: boolean;
  onSelect: () => void;
}) {
  const { formatMessage } = useYouMessages();
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left",
          isTarget ? "bg-selected" : "bg-surface hover:bg-hover",
        )}
        data-testid="you-solution-version-row"
      >
        <span className="shrink-0 font-mono text-ui-xs font-medium text-foreground">
          {formatMessage({ id: "you.solution.version" }, { version: version.version })}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-ui-xs text-foreground-subtlest">
          {version.id}
        </span>
        <span className="shrink-0 font-mono text-ui-xs text-foreground-subtle">
          {version.provenance.generator}
        </span>
        {isCurrent ? (
          <span className="shrink-0 text-ui-xs text-foreground-subtle">
            {formatMessage({ id: "you.solution.compare.current" })}
          </span>
        ) : null}
      </button>
    </li>
  );
}
