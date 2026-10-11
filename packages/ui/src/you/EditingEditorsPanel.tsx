// YOU Editing Studio — 编辑器编排面板（W5B）。
//
// 验收要求：native/embedded/external editor kind 选择器（EditorKind 分类学）+
// external editor launch UX（同意门约束的投射流程——UI 无环境进程控制；启动是经
// controller 接口投射的意图）+ Tier-4 interchange（export/import + round-trip 恒等
// 校验 + 诚实失败）。profile 数据来自快照注册面投影（W5C lane 研究数据——非运行时
// 权威）。Tier-4 小节在 EditingInterchangeSection（按模块内聚拆分保持 400 行纪律）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { ExternalLinkIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEditingMessages } from "@/you/useEditingMessages.js";
import type { UseEditingStudioBinding } from "@/you/useEditingStudio.js";
import {
  orderedEditingSessions,
  projectEditingConsentGate,
} from "@/you/editingController.js";
import { EditingInterchangeSection } from "@/you/EditingInterchangeSection.js";

export function EditingEditorsPanel({ binding }: { binding: UseEditingStudioBinding }) {
  const { formatMessage } = useEditingMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedSessionId = useStore(binding.store, (state) => state.selectedSessionId);
  const selectedEditorKind = useStore(binding.store, (state) => state.selectedEditorKind);
  const [busy, setBusy] = useState(false);

  const sessions = useMemo(() => orderedEditingSessions(snapshot), [snapshot]);
  const inspectedSession = useMemo(
    () =>
      sessions.find((session) => session.id === selectedSessionId) ??
      sessions.at(-1) ??
      null,
    [sessions, selectedSessionId],
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

  // 同意门投影（export 用途——external launch 的 binding-time 强制的 UI 镜像；
  // 服务端独立强制，UI 只禁用）。
  const launchGate = projectEditingConsentGate(snapshot.consent, "export");
  const externalSessionReady =
    inspectedSession !== null &&
    inspectedSession.status === "open" &&
    inspectedSession.editorKind === "external";

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-editing-editors"
    >
      <section aria-label={formatMessage({ id: "you.editing.editors.kind.title" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.editing.editors.kind.title" })}
        </h3>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.editing.editors.kindHint" })}
        </p>
        <ul className="mt-2 flex flex-col gap-1.5" data-testid="you-editing-editor-profiles">
          {snapshot.editorProfiles.map((profile) => {
            const selected = profile.editorKind === selectedEditorKind;
            const localized =
              formatMessage({ id: `you.editing.editors.kind.${profile.editorKind}` }) !==
              `you.editing.editors.kind.${profile.editorKind}`
                ? formatMessage({ id: `you.editing.editors.kind.${profile.editorKind}` })
                : String(profile.editorKind);
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-lg border p-2 text-left transition-colors",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface hover:bg-surface-hover",
                  )}
                  data-testid="you-editing-editor-profile"
                  data-you-editing-editor-kind={profile.editorKind}
                  aria-pressed={selected}
                  onClick={() => binding.store.getState().selectEditorKind(profile.editorKind)}
                >
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-ui-sm text-foreground">{localized}</span>
                    <span className="font-mono text-ui-xs text-foreground-subtlest">{profile.id}</span>
                    {profile.roundTripSafe ? (
                      <Badge variant="outline" className="ml-auto border-success/40 text-ui-xs text-success">
                        {formatMessage({ id: "you.editing.editors.kind.roundTripSafe" })}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                    <span>
                      {formatMessage({ id: "you.editing.editors.kind.formats" })}:{" "}
                      {profile.supportsFormats.join(", ")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label={formatMessage({ id: "you.editing.editors.launch.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.editing.editors.launch.title" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.editing.editors.launch.caption" })}
        </p>
        <div
          className={cn(
            "mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border p-2",
            launchGate.allowed
              ? "border-success/40 bg-success/5"
              : "border-warning/40 bg-warning/5",
          )}
          data-testid="you-editing-launch-gate"
          data-you-editing-launch-allowed={launchGate.allowed ? "true" : "false"}
          data-you-editing-launch-state={launchGate.state}
        >
          {launchGate.allowed ? (
            <ShieldCheckIcon className="size-3.5 text-success" />
          ) : (
            <ShieldXIcon className="size-3.5 text-warning" />
          )}
          <span className="text-ui-xs font-medium text-foreground">
            {launchGate.allowed
              ? formatMessage({ id: "you.editing.editors.launch.gateAllowed" })
              : formatMessage({ id: "you.editing.editors.launch.gateBlocked" })}
          </span>
          <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
            {launchGate.state}
          </Badge>
          {!launchGate.allowed ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto h-6 px-2 text-ui-xs"
              disabled={busy}
              data-testid="you-editing-launch-grant-consent"
              onClick={() =>
                void withBusy(() =>
                  binding.controller.decideConsent({
                    policyId: snapshot.consent.policy.id,
                    purpose: "export",
                    decision: "grant",
                  }),
                )
              }
            >
              {formatMessage({ id: "you.editing.editors.launch.grant" })}
            </Button>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-6 px-2 text-ui-xs"
            disabled={busy || !externalSessionReady}
            title={externalSessionReady ? undefined : formatMessage({ id: "you.editing.editors.launch.requestDisabled" })}
            data-testid="you-editing-launch-request"
            onClick={() => {
              if (!inspectedSession) return;
              void withBusy(() =>
                binding.controller.requestExternalEditorLaunch({
                  sessionId: inspectedSession.id,
                }),
              );
            }}
          >
            <ExternalLinkIcon className="size-3" />
            {formatMessage({ id: "you.editing.editors.launch.request" })}
          </Button>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.editing.editors.launch.projectedNote" })}
        </p>
        {snapshot.externalLaunches.length === 0 ? (
          <p className="mt-1 text-ui-xs text-foreground-subtle" data-testid="you-editing-launches-empty">
            {formatMessage({ id: "you.editing.editors.launch.empty" })}
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1" data-testid="you-editing-launch-list">
            {snapshot.externalLaunches.map((launch) => (
              <li
                key={launch.launchId}
                className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-2"
                data-testid="you-editing-launch-intent"
                data-you-editing-launch-id={launch.launchId}
              >
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-mono text-ui-xs text-foreground">{launch.launchId}</span>
                  <Badge variant="secondary" className="text-ui-xs">{String(launch.editorKind)}</Badge>
                  <span className="font-mono text-ui-xs text-foreground-subtlest">
                    {formatMessage({ id: "you.editing.editors.launch.format" })}: {String(launch.format)}
                  </span>
                </span>
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                  <span>
                    {formatMessage({ id: "you.editing.editors.launch.session" })}: {launch.sessionId}
                  </span>
                  <span>
                    {formatMessage({ id: "you.editing.editors.launch.package" })}: {launch.packageResultId}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <EditingInterchangeSection binding={binding} withBusy={withBusy} busy={busy} />
    </div>
  );
}
