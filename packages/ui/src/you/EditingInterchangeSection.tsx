// YOU Editing Studio — Tier-4 interchange 小节（W5B；EditingEditorsPanel 的内聚拆分）。
//
// export（确定性组装、内容寻址结果）→ import（验证 + 诚实失败入账）→ round-trip
// 恒等校验（导出/导入包摘要对比——可校验，绝不凭空断言）。导出包字节保存在视图
// 剪贴板（store.lastExport——操作性值；记录/事件保持内容寻址引用）。
import { useMemo } from "react";
import { useStore } from "zustand";
import { ArrowLeftRightIcon, DownloadIcon, UploadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEditingMessages } from "@/you/useEditingMessages.js";
import type { UseEditingStudioBinding } from "@/you/useEditingStudio.js";
import {
  interchangeFactOf,
  lastExportDigest,
  lastImportDigest,
  orderedEditingSessions,
} from "@/you/editingController.js";
import { projectImportExportRows } from "@/you/editingStudioProjection.js";

export function EditingInterchangeSection({
  binding,
  busy,
  withBusy,
}: {
  binding: UseEditingStudioBinding;
  busy: boolean;
  withBusy: (operation: () => Promise<unknown>) => Promise<void>;
}) {
  const { formatMessage } = useEditingMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedSessionId = useStore(binding.store, (state) => state.selectedSessionId);
  const exportDraft = useStore(binding.store, (state) => state.exportDraft);
  const lastExport = useStore(binding.store, (state) => state.lastExport);

  const sessions = useMemo(() => orderedEditingSessions(snapshot), [snapshot]);
  const inspectedSession = useMemo(
    () =>
      sessions.find((session) => session.id === selectedSessionId) ??
      sessions.at(-1) ??
      null,
    [sessions, selectedSessionId],
  );
  const resultRows = projectImportExportRows(snapshot?.importExports ?? []);
  const exportDigest = lastExportDigest(snapshot);
  const importDigest = lastImportDigest(snapshot);
  const roundTripState =
    exportDigest === null || importDigest === null
      ? "pending"
      : exportDigest === importDigest
        ? "identical"
        : "different";
  const format = exportDraft.format ?? snapshot?.supportedFormats[0] ?? null;
  const sessionReady = inspectedSession !== null && inspectedSession.status === "open";

  if (!snapshot) {
    return null;
  }

  return (
    <section aria-label={formatMessage({ id: "you.editing.editors.interchange.title" })}>
      <h4 className="text-ui-sm font-medium text-foreground">
        {formatMessage({ id: "you.editing.editors.interchange.title" })}
      </h4>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-ui-xs font-medium text-foreground-subtle">
          {formatMessage({ id: "you.editing.editors.interchange.format" })}:
        </span>
        <div className="flex flex-wrap gap-1" data-testid="you-editing-format-options">
          {snapshot.supportedFormats.map((candidate) => (
            <Button
              key={candidate}
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-6 px-2 text-ui-xs",
                format === candidate && "border-primary/60 bg-primary/10 text-primary",
              )}
              data-testid="you-editing-format-option"
              data-you-editing-format={candidate}
              aria-pressed={format === candidate}
              onClick={() => binding.store.getState().setExportDraftFormat(candidate)}
            >
              {candidate}
            </Button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.editing.editors.interchange.exportCaption" })}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-6 px-2 text-ui-xs"
          disabled={busy || !sessionReady || !format}
          title={sessionReady ? undefined : formatMessage({ id: "you.editing.editors.interchange.exportDisabled" })}
          data-testid="you-editing-export"
          onClick={() => {
            if (!inspectedSession || !format) return;
            void withBusy(async () => {
              const exportOutcome = await binding.controller.exportFromSession({
                sessionId: inspectedSession.id,
                format,
              });
              // 操作性值（包字节）写入视图剪贴板；记录/事件保持内容寻址引用。
              binding.store.getState().setLastExport({
                resultId: exportOutcome.result.id,
                format: String(exportOutcome.result.format),
                packageBytes: exportOutcome.packageBytes,
                packageDigest: exportOutcome.packageDigest,
              });
            });
          }}
        >
          <DownloadIcon className="size-3" />
          {formatMessage({ id: "you.editing.editors.interchange.export" })}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-6 px-2 text-ui-xs"
          disabled={busy || !lastExport || !sessionReady}
          data-testid="you-editing-import-last"
          onClick={() => {
            if (!lastExport || !inspectedSession) return;
            void withBusy(() =>
              binding.controller.importEditPackage({
                bytes: lastExport.packageBytes,
                format: lastExport.format,
                sessionId: inspectedSession.id,
              }),
            );
          }}
        >
          <UploadIcon className="size-3" />
          {formatMessage({ id: "you.editing.editors.interchange.importLast" })}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-6 px-2 text-ui-xs"
          disabled={busy || !inspectedSession}
          data-testid="you-editing-import-corrupt"
          onClick={() => {
            if (!inspectedSession) return;
            // 诚实失败路径：损坏字节（非 YOU 交换包前缀）⇒ typed 拒绝 + failed 结果入账。
            void withBusy(() =>
              binding.controller.importEditPackage({
                bytes: new TextEncoder().encode("not-a-you-interchange-package"),
                format: "edit-interchange",
                sessionId: inspectedSession.id,
              }),
            );
          }}
        >
          {formatMessage({ id: "you.editing.editors.interchange.importCorrupt" })}
        </Button>
      </div>
      <div
        className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface p-2"
        data-testid="you-editing-roundtrip"
        data-you-editing-roundtrip={roundTripState}
      >
        <ArrowLeftRightIcon className="size-3.5 text-foreground-subtle" />
        <span className="text-ui-xs font-medium text-foreground-subtle">
          {formatMessage({ id: "you.editing.editors.interchange.roundTrip" })}:
        </span>
        {roundTripState === "identical" ? (
          <Badge variant="outline" className="border-success/40 text-ui-xs text-success">
            {formatMessage({ id: "you.editing.editors.interchange.roundTripMatch" })}
          </Badge>
        ) : roundTripState === "different" ? (
          <Badge variant="outline" className="border-destructive/40 text-ui-xs text-destructive">
            {formatMessage({ id: "you.editing.editors.interchange.roundTripMismatch" })}
          </Badge>
        ) : (
          <span className="text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.editing.editors.interchange.roundTripPending" })}
          </span>
        )}
        {exportDigest ? (
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            export {exportDigest}
          </span>
        ) : null}
        {importDigest ? (
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            import {importDigest}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.editing.editors.interchange.roundTripCaption" })}
      </p>

      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <h5 className="text-ui-xs font-medium text-foreground-subtle">
          {formatMessage({ id: "you.editing.editors.interchange.results" })}
        </h5>
        <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-editing-interchange-count">
          {resultRows.length}
        </Badge>
      </div>
      {resultRows.length === 0 ? (
        <div className="mt-1 rounded-lg border border-border bg-surface p-3" data-testid="you-editing-interchange-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.editing.editors.interchange.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.editing.editors.interchange.emptyHint" })}
          </p>
        </div>
      ) : (
        <ol className="mt-1 flex flex-col gap-1" data-testid="you-editing-interchange-list">
          {resultRows.map((row) => {
            const fact = interchangeFactOf(snapshot, row.resultId);
            return (
              <li
                key={row.resultId}
                className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-2"
                data-testid="you-editing-interchange-row"
                data-you-editing-result-id={row.resultId}
                data-you-editing-result-status={row.status}
                data-you-editing-result-direction={fact?.direction ?? "unknown"}
              >
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-mono text-ui-xs text-foreground">{row.resultId}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-ui-xs",
                      row.status === "succeeded"
                        ? "border-success/40 text-success"
                        : "border-destructive/40 text-destructive",
                    )}
                  >
                    {formatMessage({ id: `you.editing.editors.interchange.status.${row.status}` })}
                  </Badge>
                  <span className="font-mono text-ui-xs text-foreground-subtle">
                    {fact?.direction ?? "?"} · {row.format}
                  </span>
                </span>
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                  <span>
                    {formatMessage({ id: "you.editing.editors.interchange.session" })}:{" "}
                    {row.sessionId ?? "none"}
                  </span>
                  {row.contentRef ? (
                    <span>
                      {row.contentRef} ({row.contentHash})
                    </span>
                  ) : null}
                  {fact?.packageDigest ? (
                    <span>
                      {formatMessage({ id: "you.editing.editors.interchange.digest" })}: {fact.packageDigest}
                    </span>
                  ) : null}
                </span>
                <span className="sr-only">{row.accessibleLabel}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
