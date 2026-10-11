// YOU Twin Studio — 版本检视面板（W3B）。
//
// 验收要求：查看 TwinVersion 的域块（typed、content-addressed、simulated 标注）、
// 溯源与版本谱系（candidate/canonical/superseded、单调版本号）。版本列表
// role=listbox 键盘完全可用（↑/↓/Home/End/Enter，与 Solution/Capture 同级语义）；
// 域块表格逐块展示 contentRef + contentHash（绝不内联内容）。
import { useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useStore } from "zustand";
import { GitBranchIcon, LayersIcon, PackageIcon, ShieldCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useTwinMessages } from "@/you/useTwinMessages.js";
import type { UseTwinStudioBinding } from "@/you/useTwinStudio.js";
import { orderedTwinVersions } from "@/you/twinController.js";
import {
  clampVersionIndex,
  projectDeficiencyRows,
  resolveTwinVersionKeyboardTransition,
} from "@/you/twinStudioProjection.js";
import type { TwinVersion } from "@zcode/shared";

export function TwinVersionsPanel({ binding }: { binding: UseTwinStudioBinding }) {
  const { formatMessage } = useTwinMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedVersionId = useStore(binding.store, (state) => state.selectedVersionId);
  const versionIndex = useStore(binding.store, (state) => state.versionIndex);
  const [busy, setBusy] = useState(false);

  const versions = useMemo(() => orderedTwinVersions(snapshot), [snapshot]);
  const selected = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? versions.at(-1) ?? null,
    [versions, selectedVersionId],
  );

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!snapshot || snapshot.versions.length === 0) return;
      const action = resolveTwinVersionKeyboardTransition(event.key, {
        totalVersions: snapshot.versions.length,
      });
      if (action.kind === "none") return;
      event.preventDefault();
      if (action.kind === "move") {
        binding.store.getState().moveVersionIndex(action.delta);
        return;
      }
      // Enter：选中当前光标版本（检视详情）。
      const store = binding.store.getState();
      store.selectVersion(store.snapshot?.versions[store.versionIndex]?.id ?? null);
    },
    [binding, snapshot],
  );

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  const clampedIndex = clampVersionIndex(versionIndex, versions.length);

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-twin-versions"
    >
      <section aria-label={formatMessage({ id: "you.twin.versions.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.twin.versions.title" })}
          </h3>
          <Badge
            variant="outline"
            className="gap-1 text-ui-xs text-foreground-subtle"
            data-testid="you-twin-versions-count"
          >
            <GitBranchIcon className="size-3" />v{versions.length}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtle">
          {formatMessage({ id: "you.twin.versions.lineageHint" })}
        </p>
        {versions.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-twin-versions-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.twin.versions.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.twin.versions.emptyHint" })}
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={busy}
              data-testid="you-twin-versions-publish-first"
              onClick={() => void withBusy(() => binding.controller.publishFixtureVersion({}))}
            >
              {formatMessage({ id: "you.twin.versions.publish" })}
            </Button>
          </div>
        ) : (
          <div
            role="listbox"
            aria-label={formatMessage({ id: "you.twin.versions.lineage" })}
            tabIndex={0}
            className="mt-2 flex flex-col gap-1 outline-none focus-visible:ring-1 focus-visible:ring-brand"
            onKeyDown={handleKeyDown}
            data-testid="you-twin-version-list"
          >
            {versions.map((version, index) => (
              <VersionRow
                key={version.id}
                version={version}
                selected={selected?.id === version.id}
                cursor={index === clampedIndex}
                supersededBy={snapshot.supersededBy[version.id] ?? null}
                busy={busy}
                onInspect={() => binding.store.getState().selectVersion(version.id)}
                onPromote={() =>
                  void withBusy(() => binding.controller.promoteVersion({ versionId: version.id }))
                }
              />
            ))}
          </div>
        )}
        <p className="mt-1.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.twin.versions.keyboardHint" })}
        </p>
      </section>

      {selected ? (
        <VersionInspector version={selected} />
      ) : null}

      {versions.length > 0 ? (
        <section aria-label={formatMessage({ id: "you.twin.versions.publish" })}>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              data-testid="you-twin-versions-publish"
              onClick={() => void withBusy(() => binding.controller.publishFixtureVersion({}))}
            >
              {formatMessage({ id: "you.twin.versions.publish" })}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function VersionRow({
  version,
  selected,
  cursor,
  supersededBy,
  busy,
  onInspect,
  onPromote,
}: {
  version: TwinVersion;
  selected: boolean;
  cursor: boolean;
  supersededBy: string | null;
  busy: boolean;
  onInspect: () => void;
  onPromote: () => void;
}) {
  const { formatMessage } = useTwinMessages();
  const deficiencies = projectDeficiencyRows(version);
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-md border px-2 py-1.5",
        selected ? "border-brand/40 bg-card-selected" : cursor ? "border-border bg-selected" : "border-border bg-card",
      )}
      data-testid="you-twin-version-row"
      data-you-twin-version-id={version.id}
      data-you-twin-version-status={version.status}
      data-you-twin-version-number={version.version}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="min-w-0 truncate font-mono text-ui-xs text-foreground underline-offset-2 hover:underline"
          onClick={onInspect}
          data-testid="you-twin-version-select"
        >
          v{version.version} · {version.id}
        </button>
        <Badge
          variant={version.status === "canonical" ? "secondary" : "outline"}
          className={cn(
            "text-ui-xs",
            version.status === "canonical" && "text-success",
            version.status === "superseded" && "text-foreground-subtlest",
          )}
          data-testid="you-twin-version-status"
        >
          {formatMessage({ id: `you.twin.versions.status.${version.status}` })}
        </Badge>
        <span className="font-mono text-ui-xs text-foreground-subtlest">
          {version.domainBlocks.length} blocks · {version.evidenceBindings.length} bindings ·{" "}
          {deficiencies.length} def.
        </span>
      </div>
      {supersededBy ? (
        <p className="text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.twin.versions.supersededBy" })}:{" "}
          <span className="font-mono">{supersededBy}</span>
        </p>
      ) : null}
      {version.status === "candidate" ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-ui-xs"
            disabled={busy}
            data-testid="you-twin-version-promote"
            data-you-twin-version-id={version.id}
            onClick={onPromote}
          >
            <ShieldCheckIcon className="size-3.5" />
            {formatMessage({ id: "you.twin.versions.promote" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function VersionInspector({ version }: { version: TwinVersion }) {
  const { formatMessage } = useTwinMessages();
  return (
    <section
      aria-label={formatMessage({ id: "you.twin.versions.current" })}
      className="flex flex-col gap-2"
      data-testid="you-twin-version-inspector"
      data-you-twin-version-id={version.id}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.twin.versions.current" })}
        </h4>
        <Badge variant="secondary" className="font-mono text-ui-xs">
          v{version.version}
        </Badge>
      </div>

      <div className="rounded-lg border border-border bg-card p-2.5">
        <div className="flex items-center gap-1.5">
          <LayersIcon className="size-3.5 shrink-0 text-foreground-subtle" />
          <h5 className="text-ui-xs font-semibold text-foreground">
            {formatMessage({ id: "you.twin.versions.blocks" })}
          </h5>
        </div>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.twin.versions.blocksHint" })}
        </p>
        <div className="mt-1.5 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left">
            <thead>
              <tr className="text-ui-xs text-foreground-subtle">
                <th scope="col" className="px-1.5 py-1 font-medium">
                  {formatMessage({ id: "you.twin.versions.blockDomain" })}
                </th>
                <th scope="col" className="px-1.5 py-1 font-medium">
                  {formatMessage({ id: "you.twin.versions.blockConfidence" })}
                </th>
                <th scope="col" className="px-1.5 py-1 font-medium">
                  {formatMessage({ id: "you.twin.versions.blockContent" })}
                </th>
              </tr>
            </thead>
            <tbody>
              {version.domainBlocks.map((block) => (
                <tr
                  key={block.id}
                  className="border-t border-border/50 align-top"
                  data-testid="you-twin-domain-block"
                  data-you-twin-domain={block.domain}
                  data-you-twin-block-simulated={block.simulated ? "true" : "false"}
                >
                  <td className="px-1.5 py-1 font-mono text-ui-xs text-foreground">
                    {block.domain}
                    {block.simulated ? (
                      <span className="ml-1 text-foreground-subtlest">
                        ({formatMessage({ id: "you.twin.versions.blockSimulated" })})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-1.5 py-1 font-mono text-ui-xs text-foreground">
                    {block.confidence.toFixed(2)}
                  </td>
                  <td className="px-1.5 py-1">
                    <span className="break-all font-mono text-ui-xs text-foreground-subtle">
                      {block.contentRef}
                    </span>
                    <span className="block break-all font-mono text-ui-xs text-foreground-subtlest">
                      {block.contentHash}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-2.5">
        <div className="flex items-center gap-1.5">
          <PackageIcon className="size-3.5 shrink-0 text-foreground-subtle" />
          <h5 className="text-ui-xs font-semibold text-foreground">
            {formatMessage({ id: "you.twin.versions.provenance" })}
          </h5>
        </div>
        <dl className="mt-1 flex flex-col gap-0.5">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ui-xs font-medium text-foreground-subtle">
              {formatMessage({ id: "you.twin.versions.provenanceSource" })}:
            </dt>
            <dd className="break-all font-mono text-ui-xs text-foreground">
              {version.provenance.source}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ui-xs font-medium text-foreground-subtle">
              {formatMessage({ id: "you.twin.versions.provenanceGenerator" })}:
            </dt>
            <dd className="font-mono text-ui-xs text-foreground">
              {version.provenance.generator}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ui-xs font-medium text-foreground-subtle">
              {formatMessage({ id: "you.twin.versions.provenanceCreatedAt" })}:
            </dt>
            <dd className="font-mono text-ui-xs text-foreground">
              {version.provenance.createdAt}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ui-xs font-medium text-foreground-subtle">
              {formatMessage({ id: "you.twin.versions.provenanceLineage" })}:
            </dt>
            <dd className="break-all font-mono text-ui-xs text-foreground">
              {version.provenance.lineage.length > 0
                ? version.provenance.lineage.join(" → ")
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-card p-2.5">
        <h5 className="text-ui-xs font-semibold text-foreground">
          {formatMessage({ id: "you.twin.versions.evidenceBindings" })}
        </h5>
        {version.evidenceBindings.length === 0 ? (
          <p className="mt-0.5 text-ui-xs text-foreground-subtle" data-testid="you-twin-bindings-none">
            {formatMessage({ id: "you.twin.versions.evidenceBindingsNone" })}
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5" data-testid="you-twin-bindings">
            {version.evidenceBindings.map((binding) => (
              <li key={binding.evidenceId} className="break-all font-mono text-ui-xs text-foreground-subtle">
                {binding.evidenceId} · {binding.evidenceContentHash} · consent:{" "}
                {binding.consent.state} ({binding.consent.policyId})
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
