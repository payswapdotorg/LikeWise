// YOU Solution Studio — 语义检查器面板（W1B）。
//
// 展示：当前选择（实体/区域/缺陷类）的属性、质量图、版本信息（lineage/provenance）
// 与 append-only 事件日志投影。质量分数处处标注 fixture 模拟值。
import { useMemo } from "react";
import { useStore } from "zustand";
import { cn } from "@/components/lib/utils.js";
import { currentSolutionVersion } from "@/you/solutionController.js";
import { describeSolutionSelector, solutionSelectorEntityIds } from "@/you/solutionProjection.js";
import type { UseSolutionSurfaceBinding } from "@/you/useSolutionSurface.js";
import { useYouMessages } from "@/you/youMessages.js";

export function SolutionInspectorPanel({ binding }: { binding: UseSolutionSurfaceBinding }) {
  const { formatMessage } = useYouMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selection = useStore(binding.store, (state) => state.selection);
  const version = snapshot ? currentSolutionVersion(snapshot) : null;
  const entities = useMemo(() => version?.state.entities ?? [], [version]);

  const selectedEntities = useMemo(
    () => (selection ? solutionSelectorEntityIds(selection, entities) : []),
    [selection, entities],
  );
  const description = selection ? describeSolutionSelector(selection, entities) : null;

  if (!snapshot || !version) {
    return <PanelEmpty messageId="you.solution.inspector.empty" formatMessage={formatMessage} />;
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-solution-inspector"
    >
      <section aria-label={formatMessage({ id: "you.solution.inspector.title" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.solution.inspector.title" })}
        </h3>
        {!description ? (
          <p className="mt-1 text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.solution.inspector.empty" })}
          </p>
        ) : (
          <div className="mt-2 rounded-lg border border-border bg-card p-2">
            <p className="text-ui-base font-medium text-foreground">
              {description.label}
              <span className="ml-1.5 font-mono text-ui-xs text-foreground-subtle">
                {description.kind}
              </span>
            </p>
            <p className="mt-0.5 font-mono text-ui-xs text-foreground-subtle">{description.detail}</p>
            {selectedEntities.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-2">
                {selectedEntities.map((entityId) => {
                  const entity = entities.find((candidate) => candidate.id === entityId);
                  if (!entity) return null;
                  return (
                    <li key={entityId} className="rounded-md bg-surface p-2">
                      <p className="text-ui-sm font-medium text-foreground">{entity.label}</p>
                      <p className="font-mono text-ui-xs text-foreground-subtlest">
                        {entity.id} · {entity.kind}
                      </p>
                      <p className="mt-1 font-mono text-ui-xs text-foreground-subtle">
                        {formatMessage({ id: "you.solution.inspector.transform" })} pos[
                        {entity.transform.position.map((v) => v.toFixed(2)).join(", ")}] rot[
                        {entity.transform.rotation.map((v) => v.toFixed(2)).join(", ")}] scl[
                        {entity.transform.scale.map((v) => v.toFixed(2)).join(", ")}]
                      </p>
                      <dl className="mt-1 flex flex-col gap-0.5">
                        {Object.entries(entity.attributes)
                          .sort(([a], [b]) => (a < b ? -1 : 1))
                          .map(([key, value]) => (
                            <div key={key} className="flex items-baseline justify-between gap-2">
                              <dt className="text-ui-xs text-foreground-subtle">{key}</dt>
                              <dd className="font-mono text-ui-xs text-foreground">{String(value)}</dd>
                            </div>
                          ))}
                      </dl>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {selection?.kind === "quality" ? (
              <p className="mt-2 text-ui-sm text-foreground-subtle">
                {formatMessage({ id: "you.solution.viewport.qualityCaption" })}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section aria-label={formatMessage({ id: "you.solution.inspector.quality" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.solution.inspector.quality" })}
        </h3>
        <div className="mt-2 flex flex-col gap-1">
          {Object.entries(version.state.quality)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([cls, score]) => (
              <div key={cls} className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-28 shrink-0 truncate text-ui-xs",
                    selection?.kind === "quality" && selection.deficiencyClass === cls
                      ? "font-medium text-foreground"
                      : "text-foreground-subtle",
                  )}
                >
                  {cls}
                </span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      score < 0.55 ? "bg-warning" : "bg-foreground-subtle",
                    )}
                    style={{ width: `${Math.round(score * 100)}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right font-mono text-ui-xs text-foreground-subtle">
                  {score.toFixed(2)}
                </span>
              </div>
            ))}
        </div>
        <p className="mt-1.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.solution.viewport.qualityCaption" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.solution.inspector.version" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.solution.inspector.version" })}
        </h3>
        <div className="mt-2 rounded-lg border border-border bg-card p-2 text-ui-xs">
          <InspectorRow label="id" value={version.id} />
          <InspectorRow
            label={formatMessage({ id: "you.solution.version" }, { version: version.version })}
            value={version.parentVersionId ?? "—"}
          />
          <InspectorRow
            label={formatMessage({ id: "you.solution.inspector.provenance" })}
            value={`${version.provenance.source} · ${version.provenance.generator}`}
          />
          <div className="mt-1">
            <p className="text-foreground-subtle">
              {formatMessage({ id: "you.solution.inspector.lineage" })}
            </p>
            <p className="mt-0.5 break-all font-mono text-foreground-subtlest">
              {version.provenance.lineage.length > 0
                ? version.provenance.lineage.join(" → ")
                : "—"}
            </p>
          </div>
        </div>
      </section>

      <section aria-label={formatMessage({ id: "you.solution.inspector.events" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.solution.inspector.events" })}
        </h3>
        <ul className="mt-2 flex max-h-96 flex-col gap-1 overflow-y-auto" data-testid="you-solution-event-log">
          {snapshot.events.length === 0 ? (
            <li className="text-ui-xs text-foreground-subtlest">—</li>
          ) : (
            snapshot.events
              .slice()
              .reverse()
              .map((event) => (
                <li
                  key={event.id}
                  className="flex items-baseline gap-2 rounded-md bg-surface px-2 py-1"
                >
                  <span className="shrink-0 font-mono text-ui-xs text-foreground-subtle">
                    {event.occurredAt.slice(11, 19)}
                  </span>
                  <span className="min-w-0 break-all font-mono text-ui-xs text-foreground">
                    {event.type}
                  </span>
                </li>
              ))
          )}
        </ul>
      </section>

      <p className="shrink-0 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.solution.demo.scriptedNote" })}
      </p>
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-foreground-subtle">{label}</span>
      <span className="min-w-0 break-all text-right font-mono text-foreground-subtle">
        {value}
      </span>
    </div>
  );
}

function PanelEmpty({
  messageId,
  formatMessage,
}: {
  messageId: string;
  formatMessage: (descriptor: { id: string }) => string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-ui-base text-foreground-subtle" data-testid="you-solution-panel-empty">
        {formatMessage({ id: messageId })}
      </p>
    </div>
  );
}
