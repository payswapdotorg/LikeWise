// YOU Escalation Studio — 学习许可面板（W8B）。
//
// 验收要求：learning-permission 显示 + 撤回投影（wave-6 权利法显示模式的 arena 边界
// 延伸）：每升级一行——有效许可（none/aggregate/full）+ 撤回标记 + 授权链接
//（scope/expiry/grantedAt/record id）+ 撤回动作（经 controller 端口的投射意图——
// 账本新记录，learningPermission 落为 none）。门投影只禁用/提示；服务端独立强制
//（ARENA LEARNING PERMISSION LAW——无许可 ⇒ 不派生）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { GraduationCapIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEscalationMessages } from "@/you/useEscalationMessages.js";
import type { UseEscalationStudioBinding } from "@/you/useEscalationStudio.js";
import { orderedEscalations } from "@/you/escalationController.js";
import { projectLearningPermissionRows } from "@/you/escalationStudioProjection.js";

export function EscalationPermissionsPanel({ binding }: { binding: UseEscalationStudioBinding }) {
  const { formatMessage } = useEscalationMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedEscalationId = useStore(binding.store, (state) => state.selectedEscalationId);
  const [busy, setBusy] = useState(false);

  const escalations = useMemo(() => orderedEscalations(snapshot), [snapshot]);
  const permissionRows = useMemo(
    () => projectLearningPermissionRows(escalations, snapshot?.liveAuthorizations ?? []),
    [escalations, snapshot],
  );
  const inertCount = permissionRows.filter(
    (row) => row.livePermission === "none",
  ).length;

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
      data-testid="you-escalation-permissions"
    >
      <section aria-label={formatMessage({ id: "you.escalation.permissions.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <GraduationCapIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.escalation.permissions.title" })}
          </h3>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.escalation.permissions.caption" })}
        </p>
      </section>

      {permissionRows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-escalation-permissions-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.escalation.permissions.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.escalation.permissions.emptyHint" })}
          </p>
        </div>
      ) : (
        <section>
          <ol className="flex flex-col gap-1.5" data-testid="you-escalation-permissions-list">
            {permissionRows.map((row) => {
              const permitted = row.livePermission !== "none";
              const selected = row.escalationId === selectedEscalationId;
              return (
                <li
                  key={row.escalationId}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
                    !permitted && "border-warning/40",
                  )}
                  data-testid="you-escalation-permission-row"
                  data-you-escalation-permission-escalation={row.escalationId}
                  data-you-escalation-permission={row.livePermission}
                  data-you-escalation-permission-withdrawn={row.withdrawn ? "true" : "false"}
                  data-you-escalation-permission-permitted={permitted ? "true" : "false"}
                >
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-1.5 rounded-md border p-1.5",
                      permitted
                        ? "border-success/40 bg-success/5"
                        : "border-warning/40 bg-warning/5",
                    )}
                    data-testid="you-escalation-permission-gate"
                    data-you-escalation-permission-gate-allowed={permitted ? "true" : "false"}
                  >
                    {permitted ? (
                      <ShieldCheckIcon className="size-3.5 text-success" />
                    ) : (
                      <ShieldXIcon className="size-3.5 text-warning" />
                    )}
                    <span className="text-ui-xs font-medium text-foreground">
                      {permitted
                        ? formatMessage(
                            { id: "you.escalation.permissions.gate.allowed" },
                            { permission: row.livePermission },
                          )
                        : formatMessage({ id: "you.escalation.permissions.gate.blocked" })}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        permitted
                          ? "border-success/40 text-success"
                          : "border-warning/40 text-warning",
                      )}
                    >
                      {formatMessage({
                        id: `you.escalation.permissions.permission.${row.livePermission}`,
                      })}
                    </Badge>
                    {row.withdrawn ? (
                      <Badge variant="outline" className="border-warning/40 text-ui-xs text-warning">
                        {formatMessage({ id: "you.escalation.permissions.withdrawn" })}
                      </Badge>
                    ) : null}
                    {row.recordId !== null && permitted ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="ml-auto h-6 px-2 text-ui-xs"
                        disabled={busy}
                        data-testid="you-escalation-permission-withdraw"
                        onClick={() =>
                          void withBusy(() =>
                            binding.controller.withdrawAuthorization({
                              authorizationId: row.recordId!,
                            }),
                          )
                        }
                      >
                        {formatMessage({ id: "you.escalation.permissions.withdraw" })}
                      </Button>
                    ) : null}
                  </div>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                    <span className="text-foreground">{row.escalationId}</span>
                    <span>
                      {formatMessage({ id: "you.escalation.permissions.record" })}:{" "}
                      {row.recordId ?? formatMessage({ id: "you.escalation.permissions.noAuthorization" })}
                    </span>
                    <span>
                      {formatMessage({ id: "you.escalation.permissions.scope" })}: {row.scope || "—"}
                    </span>
                    <span>
                      {formatMessage({ id: "you.escalation.permissions.grantedAt" })}:{" "}
                      {row.grantedAt ?? "—"}
                    </span>
                    <span>
                      {formatMessage({ id: "you.escalation.permissions.expiresAt" })}:{" "}
                      {row.expiresAt ?? formatMessage({ id: "you.escalation.permissions.noExpiry" })}
                    </span>
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.escalation.permissions.withdrawCaption" })}
          </p>
        </section>
      )}

      {inertCount > 0 ? (
        <div
          className="rounded-lg border border-warning/40 bg-warning/5 p-2 text-ui-xs text-foreground"
          data-testid="you-escalation-permissions-inert-notice"
          data-you-escalation-inert-count={inertCount}
          role="note"
        >
          <span className="font-medium">
            {formatMessage({ id: "you.escalation.gaps.count" })}: {inertCount} ·{" "}
            {formatMessage({ id: "you.escalation.permissions.permission.none" })}
          </span>
          <p className="mt-0.5 text-foreground-subtle">
            {formatMessage({ id: "you.escalation.permissions.inertNotice" })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
