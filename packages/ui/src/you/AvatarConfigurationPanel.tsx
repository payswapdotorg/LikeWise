// YOU Avatar Studio — 配置面板（W7B）。
//
// 验收要求：Body picker（role/capabilities/tools）+ Soul binding picker
//（providerKind/modelRef/routingProfile）——全部来自 controller 投影，UI 零业务
// 逻辑；打开会话与注册 body/soul 都是投射意图（经 controller 端口）。外观内容
// 寻址（仅标签）。注册表单区拆分至 `AvatarRegisterForms.tsx`（模块内聚）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { BotIcon, PersonStandingIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useAvatarMessages } from "@/you/useAvatarMessages.js";
import type { UseAvatarStudioBinding } from "@/you/useAvatarStudio.js";
import { AvatarRegisterForms } from "@/you/AvatarRegisterForms.js";
import {
  avatarBodyById,
  avatarSoulBindingById,
  orderedAvatarBodies,
  orderedAvatarSoulBindings,
} from "@/you/avatarController.js";
import {
  projectBodyOptionRows,
  projectConfigurationDraftView,
  projectListRegionView,
  projectSoulOptionRows,
} from "@/you/avatarStudioProjection.js";

export function AvatarConfigurationPanel({ binding }: { binding: UseAvatarStudioBinding }) {
  const { formatMessage } = useAvatarMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedBodyId = useStore(binding.store, (state) => state.selectedBodyId);
  const selectedSoulBindingId = useStore(
    binding.store,
    (state) => state.selectedSoulBindingId,
  );
  const [busy, setBusy] = useState(false);

  const bodies = useMemo(() => orderedAvatarBodies(snapshot), [snapshot]);
  const souls = useMemo(() => orderedAvatarSoulBindings(snapshot), [snapshot]);
  const bodyRows = useMemo(() => projectBodyOptionRows(bodies), [bodies]);
  const soulRows = useMemo(() => projectSoulOptionRows(souls), [souls]);
  const inspectedBody = useMemo(
    () => avatarBodyById(snapshot, selectedBodyId) ?? bodies[0] ?? null,
    [snapshot, selectedBodyId, bodies],
  );
  const inspectedSoul = useMemo(
    () => avatarSoulBindingById(snapshot, selectedSoulBindingId) ?? souls[0] ?? null,
    [snapshot, selectedSoulBindingId, souls],
  );
  const draftView = useMemo(
    () =>
      projectConfigurationDraftView({
        bodyId: inspectedBody?.id ?? null,
        soulBindingId: inspectedSoul?.id ?? null,
      }),
    [inspectedBody, inspectedSoul],
  );
  const bodyRegion = projectListRegionView(snapshot !== null, bodyRows.length);
  const soulRegion = projectListRegionView(snapshot !== null, soulRows.length);

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
      data-testid="you-avatar-configuration"
    >
      <section aria-label={formatMessage({ id: "you.avatar.configuration.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <SparklesIcon className="size-4 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.avatar.configuration.title" })}
          </h3>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.configuration.caption" })}
        </p>
      </section>

      {/* -- Body picker -- */}
      <section aria-label={formatMessage({ id: "you.avatar.configuration.bodies.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <PersonStandingIcon className="size-4 text-foreground-subtle" />
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.avatar.configuration.bodies.title" })}
          </h4>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-avatar-body-count">
            {bodyRows.length} {formatMessage({ id: "you.avatar.configuration.bodies.count" })}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.configuration.bodies.hint" })}
        </p>
        {bodyRegion === "empty" ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-avatar-bodies-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.avatar.configuration.bodies.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.avatar.configuration.bodies.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-1.5" data-testid="you-avatar-body-list">
            {bodyRows.map((row) => (
              <li key={row.bodyId}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                    row.bodyId === inspectedBody?.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-surface hover:bg-surface-hover",
                  )}
                  data-testid="you-avatar-body-row"
                  data-you-avatar-body-id={row.bodyId}
                  onClick={() => binding.store.getState().selectBody(row.bodyId)}
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="font-mono text-ui-xs text-foreground">{row.bodyId}</span>
                    <Badge variant="outline" className="border-primary/40 text-ui-xs text-primary">
                      {row.role}
                    </Badge>
                  </span>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                    <span>
                      {formatMessage({ id: "you.avatar.configuration.bodies.capabilities" })}:{" "}
                      {row.capabilities.join(", ")}
                    </span>
                    <span>
                      {formatMessage({ id: "you.avatar.configuration.bodies.tools" })}:{" "}
                      {row.tools.join(", ")}
                    </span>
                  </span>
                  <span className="font-mono text-ui-xs text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.configuration.bodies.appearance" })}:{" "}
                    {row.appearanceRef ?? formatMessage({ id: "you.avatar.configuration.bodies.appearanceNone" })}
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* -- Soul binding picker -- */}
      <section aria-label={formatMessage({ id: "you.avatar.configuration.souls.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <BotIcon className="size-4 text-foreground-subtle" />
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.avatar.configuration.souls.title" })}
          </h4>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-avatar-soul-count">
            {soulRows.length} {formatMessage({ id: "you.avatar.configuration.souls.count" })}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.configuration.souls.hint" })}
        </p>
        {soulRegion === "empty" ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-avatar-souls-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.avatar.configuration.souls.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.avatar.configuration.souls.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-1.5" data-testid="you-avatar-soul-list">
            {soulRows.map((row) => (
              <li key={row.soulBindingId}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                    row.soulBindingId === inspectedSoul?.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-surface hover:bg-surface-hover",
                  )}
                  data-testid="you-avatar-soul-row"
                  data-you-avatar-soul-id={row.soulBindingId}
                  onClick={() =>
                    binding.store.getState().selectSoulBinding(row.soulBindingId)
                  }
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="font-mono text-ui-xs text-foreground">{row.soulBindingId}</span>
                    <Badge variant="outline" className="border-secondary/40 text-ui-xs text-secondary-foreground">
                      {row.routingProfile}
                    </Badge>
                  </span>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                    <span>
                      {formatMessage({ id: "you.avatar.configuration.souls.providerKind" })}:{" "}
                      {row.providerKind}
                    </span>
                    <span>
                      {formatMessage({ id: "you.avatar.configuration.souls.modelRef" })}:{" "}
                      {row.modelRef}
                    </span>
                  </span>
                  <span className="font-mono text-ui-xs text-foreground-subtlest">
                    {formatMessage({ id: "you.avatar.configuration.souls.capabilities" })}:{" "}
                    {row.capabilities.join(", ")}
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* -- open session (projected intent) -- */}
      <section aria-label={formatMessage({ id: "you.avatar.configuration.open.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.avatar.configuration.open.title" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.configuration.open.caption" })}
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-2 h-7 px-2.5 text-ui-xs"
          disabled={busy || draftView.disabledReason !== null}
          data-testid="you-avatar-open-session"
          onClick={() => {
            if (!inspectedBody || !inspectedSoul) return;
            void withBusy(() =>
              binding.controller.openSession({
                bodyId: inspectedBody.id,
                soulBindingId: inspectedSoul.id,
                initialState: null,
              }),
            );
          }}
        >
          {formatMessage({ id: "you.avatar.configuration.open" })}
        </Button>
        {draftView.disabledReason !== null ? (
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({
              id: `you.avatar.configuration.openDisabled.${draftView.disabledReason}`,
            })}
          </p>
        ) : null}
      </section>

      {/* -- register body + soul (projected intents; module-cohesion split) -- */}
      <AvatarRegisterForms binding={binding} />
    </div>
  );
}
