// YOU Solution Studio — 导出 / 编辑器 / 再导入面板（W1B）。
//
// 编辑器推荐（EditorRecommendation，外部编辑器只是 adapter）→ 可编辑包 manifest
// （lineage/provenance/consent 齐全，确定性序列化）→ 下载/复制 → 外部编辑后回贴 →
// truthful diff → 接受为 importer 候选版本 / 拒绝。外部编辑器存根为确定性模拟。
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import type { EditorRecommendation } from "@zcode/shared";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { Textarea } from "@/components/ui/textarea.js";
import { logger } from "@/logger.js";
import { currentSolutionVersion } from "@/you/solutionController.js";
import {
  diffSolutionVersionAgainst,
  parseSolutionPackageManifest,
  serializeSolutionPackageManifest,
} from "@/you/solutionExportModel.js";
import type { UseSolutionSurfaceBinding } from "@/you/useSolutionSurface.js";
import { useYouMessages } from "@/you/youMessages.js";

export function SolutionExportPanel({ binding }: { binding: UseSolutionSurfaceBinding }) {
  const { formatMessage } = useYouMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const current = snapshot ? currentSolutionVersion(snapshot) : null;
  const [manifestJson, setManifestJson] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorRecommendation | null>(null);

  useEffect(() => {
    let disposed = false;
    void binding.controller
      .recommendEditor()
      .then((recommendation) => {
        if (!disposed) setEditor(recommendation);
      })
      .catch(() => {
        // 推荐不可用时面板仍可用；导出按钮会再次尝试。
      });
    return () => {
      disposed = true;
    };
  }, [binding.controller]);

  const pendingImporter = useMemo(
    () =>
      snapshot?.pendingChangeSets.find((changeSet) => changeSet.authorType === "importer") ?? null,
    [snapshot],
  );

  const [importDiffState, setImportDiffState] = useState<ReturnType<
    typeof diffSolutionVersionAgainst
  > | null>(null);

  if (!snapshot || !current) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    await withBusy(async () => {
      await binding.controller.recommendEditor();
      const manifest = await binding.controller.exportPackage(current.id);
      setManifestJson(serializeSolutionPackageManifest(manifest));
    });
  };

  const handleDownload = () => {
    if (!manifestJson) return;
    try {
      const blob = new Blob([manifestJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `you-solution-v${current.version}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.warn("[you:solution] manifest download failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleCopy = async () => {
    if (!manifestJson) return;
    try {
      await navigator.clipboard.writeText(manifestJson);
      setCopied(true);
    } catch (error) {
      logger.warn("[you:solution] manifest copy failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleImport = async () => {
    setImportError(null);
    setImportDiffState(null);
    let manifest;
    try {
      manifest = parseSolutionPackageManifest(importText);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
      return;
    }
    await withBusy(async () => {
      await binding.controller.importPackage(manifest);
      const fresh = await binding.controller.refresh();
      const freshCurrent = fresh.versions.at(-1) ?? current;
      setImportDiffState(diffSolutionVersionAgainst(manifest.version, freshCurrent));
    });
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-solution-export"
    >
      <section aria-label={formatMessage({ id: "you.solution.export.recommended" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.solution.export.recommended" })}
        </h3>
        <div className="mt-1 rounded-lg border border-border bg-card p-2">
          <p className="text-ui-sm font-medium text-foreground">
            {editor?.editorName ?? "—"}
          </p>
          <p className="mt-0.5 text-ui-xs text-foreground-subtle">
            {formatMessage({ id: "you.solution.export.rationale" })}: {editor?.rationale ?? "—"}
          </p>
          <p className="mt-0.5 font-mono text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.solution.export.format" })}: {editor?.exportFormat ?? "—"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-2"
          disabled={busy}
          data-testid="you-solution-export-action"
          onClick={() => void handleExport()}
        >
          {formatMessage({ id: "you.solution.export.title" })}
        </Button>
      </section>

      {manifestJson ? (
        <section aria-label={formatMessage({ id: "you.solution.export.manifest" })}>
          <div className="flex items-center gap-1">
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.solution.export.manifest" })}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title={formatMessage({ id: "you.solution.export.copy" })}
              aria-label={formatMessage({ id: "you.solution.export.copy" })}
              onClick={() => void handleCopy()}
            >
              <CopyIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title={formatMessage({ id: "you.solution.export.download" })}
              aria-label={formatMessage({ id: "you.solution.export.download" })}
              onClick={handleDownload}
            >
              <DownloadIcon className="size-3.5" />
            </Button>
            {copied ? (
              <span className="text-ui-xs text-foreground-subtle">
                {formatMessage({ id: "you.solution.export.copied" })}
              </span>
            ) : null}
          </div>
          <pre
            className="mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-surface p-2 font-mono text-ui-xs text-foreground-subtle"
            data-testid="you-solution-manifest"
          >
            {manifestJson}
          </pre>
        </section>
      ) : null}

      <section aria-label={formatMessage({ id: "you.solution.export.reimport" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.solution.export.reimport" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtle">
          {formatMessage({ id: "you.solution.export.reimportHint" })}
        </p>
        <Textarea
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          className="mt-1 min-h-20 font-mono text-ui-xs"
          aria-label={formatMessage({ id: "you.solution.export.reimport" })}
          data-testid="you-solution-import-input"
        />
        {importError ? (
          <p className="mt-1 break-all font-mono text-ui-xs text-danger" data-testid="you-solution-import-error">
            {importError}
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={busy || importText.trim().length === 0}
          data-testid="you-solution-import-action"
          onClick={() => void handleImport()}
        >
          {formatMessage({ id: "you.solution.export.reimportAction" })}
        </Button>

        {pendingImporter ? (
          <div
            className="mt-2 rounded-lg border border-border bg-card p-2"
            data-testid="you-solution-import-changeset"
          >
            <p className="font-mono text-ui-xs text-foreground-subtlest">
              {pendingImporter.id} · {pendingImporter.authorType} · {pendingImporter.status}
            </p>
            {importDiffState ? (
              <div className="mt-1" data-testid="you-solution-import-diff">
                <p className="text-ui-xs font-medium text-foreground">
                  {formatMessage({ id: "you.solution.export.diffTitle" })}
                </p>
                {importDiffState.identical ? (
                  <p className="mt-0.5 text-ui-xs text-foreground-subtle">
                    {formatMessage({ id: "you.solution.export.diffEmpty" })}
                  </p>
                ) : (
                  <ul className="mt-0.5 flex flex-col gap-0.5">
                    {importDiffState.entityChanges.map((change) => (
                      <li key={change.entityId} className="text-ui-xs text-foreground-subtle">
                        <span className="font-mono">{change.kind}</span> {change.label}
                      </li>
                    ))}
                    {importDiffState.qualityChanges.map((change) => (
                      <li
                        key={change.deficiencyClass}
                        className="text-ui-xs text-foreground-subtle"
                      >
                        <span className="font-mono">{change.deficiencyClass}</span>{" "}
                        {change.before.toFixed(2)} → {change.after.toFixed(2)}
                      </li>
                    ))}
                    {importDiffState.environmentChanged ? (
                      <li className="text-ui-xs text-foreground-subtle">
                        <span className="font-mono">environment</span>{" "}
                        {importDiffState.environmentDetail}
                      </li>
                    ) : null}
                  </ul>
                )}
              </div>
            ) : null}
            <div className="mt-2 flex gap-1">
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy}
                data-testid="you-solution-import-accept"
                onClick={() => withBusy(() => binding.controller.acceptChangeSet(pendingImporter.id))}
              >
                {formatMessage({ id: "you.solution.feedback.accept" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy}
                onClick={() => withBusy(() => binding.controller.rejectChangeSet(pendingImporter.id))}
              >
                {formatMessage({ id: "you.solution.feedback.reject" })}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <p className="shrink-0 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.solution.demo.scriptedNote" })}
      </p>
    </div>
  );
}
