/* eslint-disable max-lines -- 授权门面板（W8B）：scope/expiry/learning-permission 三段选择器 + 错误面板 + 加载/空态在同一表面内聚渲染（W2B-W7B 面板惯例：一个表面一个文件）；T8 换绑后随 UI 退役。 */
// YOU Escalation Studio — 升级授权门面板（W8B）。
//
// 验收要求：authorization surface——escalation gate（scope、expiry、learning
// permission picker none/aggregate/full）由 controller 投影渲染；零业务逻辑（W1B-W7B
// controller 模式；T8 换绑前由模拟控制器支撑）。live 门显示与授权账本
//（grant/withdrawal 不可变记录）+ 撤回投影 + ArenaRetryPolicy 校验面（W8A 无状态
// 校验器接缝镜像）。UI 只禁用操作；服务端独立拒绝（无第二条授权路径）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useEscalationMessages } from "@/you/useEscalationMessages.js";
import type { UseEscalationStudioBinding } from "@/you/useEscalationStudio.js";
import {
  ESCALATION_STORYBOARD_EXPIRY_PRESETS,
} from "@/you/escalationStoryboard.js";
import {
  escalationById,
  liveAuthorizationOfEscalation,
  authorizationLedgerOfEscalation,
  orderedEscalations,
  projectEscalationAuthorizationGate,
} from "@/you/escalationController.js";
import {
  projectAuthorizationDraftView,
  projectAuthorizationRows,
  projectRetryPolicyDraftView,
} from "@/you/escalationStudioProjection.js";

export function EscalationGatePanel({ binding }: { binding: UseEscalationStudioBinding }) {
  const { formatMessage } = useEscalationMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedEscalationId = useStore(binding.store, (state) => state.selectedEscalationId);
  const authorizationDraft = useStore(binding.store, (state) => state.authorizationDraft);
  const policyDraft = useStore(binding.store, (state) => state.policyDraft);
  const [busy, setBusy] = useState(false);
  const [policyValidated, setPolicyValidated] = useState(false);

  const escalations = useMemo(() => orderedEscalations(snapshot), [snapshot]);
  const inspected = useMemo(
    () =>
      escalationById(snapshot, selectedEscalationId) ??
      escalations.at(-1) ??
      null,
    [snapshot, escalations, selectedEscalationId],
  );
  const live = useMemo(
    () =>
      inspected === null
        ? null
        : liveAuthorizationOfEscalation(snapshot, inspected.escalationId),
    [snapshot, inspected],
  );
  const ledger = useMemo(
    () =>
      inspected === null
        ? []
        : authorizationLedgerOfEscalation(snapshot, inspected.escalationId),
    [snapshot, inspected],
  );
  const authorizationRows = useMemo(
    () => projectAuthorizationRows(ledger, live),
    [ledger, live],
  );
  const gate = inspected
    ? projectEscalationAuthorizationGate(live, inspected.requiredScope, snapshot?.projectedAt ?? "")
    : null;
  const draftView = projectAuthorizationDraftView(authorizationDraft, inspected);
  const policyDraftView = projectRetryPolicyDraftView(policyDraft);

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

  const expiryPreset =
    ESCALATION_STORYBOARD_EXPIRY_PRESETS.find(
      (preset) => preset.id === authorizationDraft.expiryPresetId,
    ) ?? null;

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-escalation-gate"
    >
      <section aria-label={formatMessage({ id: "you.escalation.gate.title" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.escalation.gate.title" })}
        </h3>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.escalation.gate.caption" })}
        </p>
      </section>

      {inspected === null ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-escalation-gate-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.escalation.gate.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.escalation.gate.emptyHint" })}
          </p>
        </div>
      ) : (
        <>
          <section>
            <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-ui-xs text-foreground-subtle">
              <span>
                {formatMessage({ id: "you.escalation.gate.escalation" })}:{" "}
                {inspected.escalationId}
              </span>
              <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
                {formatMessage({ id: `you.escalation.progress.status.${inspected.status}` })}
              </Badge>
              <span>
                {formatMessage({ id: "you.escalation.gate.requiredScope" })}:{" "}
                {inspected.requiredScope}
              </span>
            </div>
          </section>

          {gate ? (
            <section aria-label={formatMessage({ id: "you.escalation.gate.live.title" })}>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-1.5 rounded-lg border p-2",
                  gate.allowed
                    ? "border-success/40 bg-success/5"
                    : "border-warning/40 bg-warning/5",
                )}
                data-testid="you-escalation-gate-live"
                data-you-escalation-gate-allowed={gate.allowed ? "true" : "false"}
                data-you-escalation-gate-reason={gate.reason}
              >
                {gate.allowed ? (
                  <ShieldCheckIcon className="size-3.5 text-success" />
                ) : (
                  <ShieldXIcon className="size-3.5 text-warning" />
                )}
                <span className="text-ui-xs font-medium text-foreground">
                  {gate.allowed
                    ? formatMessage({ id: "you.escalation.gate.live.allowed" })
                    : formatMessage({ id: "you.escalation.gate.live.blocked" })}
                </span>
                <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
                  {formatMessage({ id: `you.escalation.gate.live.reason.${gate.reason}` })}
                </Badge>
                {gate.allowed && live?.record ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto h-6 px-2 text-ui-xs"
                    disabled={busy}
                    data-testid="you-escalation-gate-withdraw"
                    onClick={() =>
                      void withBusy(() =>
                        binding.controller.withdrawAuthorization({
                          authorizationId: live.record!.id,
                        }),
                      )
                    }
                  >
                    {formatMessage({ id: "you.escalation.gate.withdraw" })}
                  </Button>
                ) : null}
              </div>
              <p className="mt-1 text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.escalation.gate.withdrawCaption" })}
              </p>
            </section>
          ) : null}

          <section aria-label={formatMessage({ id: "you.escalation.gate.scope.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.escalation.gate.scope.title" })}
            </h4>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.gate.scope.hint" })}
            </p>
            <div className="mt-2 flex flex-wrap gap-1" data-testid="you-escalation-scope-options">
              {snapshot.scopePresets.map((scope) => {
                const selected = authorizationDraft.scope === scope;
                return (
                  <Button
                    key={scope}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-6 px-2 font-mono text-ui-xs",
                      selected && "border-primary/60 bg-primary/10 text-primary",
                    )}
                    data-testid="you-escalation-scope-option"
                    data-you-escalation-scope={scope}
                    aria-pressed={selected}
                    onClick={() =>
                      binding.store.getState().setAuthorizationDraftScope(scope)
                    }
                  >
                    {scope}
                  </Button>
                );
              })}
            </div>
          </section>

          <section aria-label={formatMessage({ id: "you.escalation.gate.expiry.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.escalation.gate.expiry.title" })}
            </h4>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.gate.expiry.hint" })}
            </p>
            <div className="mt-2 flex flex-wrap gap-1" data-testid="you-escalation-expiry-options">
              {ESCALATION_STORYBOARD_EXPIRY_PRESETS.map((preset) => {
                const selected = authorizationDraft.expiryPresetId === preset.id;
                return (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-6 px-2 text-ui-xs",
                      selected && "border-primary/60 bg-primary/10 text-primary",
                    )}
                    data-testid="you-escalation-expiry-option"
                    data-you-escalation-expiry={preset.id}
                    aria-pressed={selected}
                    onClick={() =>
                      binding.store
                        .getState()
                        .setAuthorizationDraftExpiry(preset.id)
                    }
                  >
                    {formatMessage({ id: `you.escalation.gate.expiry.${preset.id}` })}
                  </Button>
                );
              })}
            </div>
          </section>

          <section aria-label={formatMessage({ id: "you.escalation.gate.permission.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.escalation.gate.permission.title" })}
            </h4>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.gate.permission.hint" })}
            </p>
            <div className="mt-2 flex flex-wrap gap-1" data-testid="you-escalation-permission-options">
              {snapshot.learningPermissions.map((permission) => {
                const selected = authorizationDraft.learningPermission === permission;
                return (
                  <Button
                    key={permission}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-6 px-2 text-ui-xs",
                      selected && "border-primary/60 bg-primary/10 text-primary",
                    )}
                    data-testid="you-escalation-permission-option"
                    data-you-escalation-permission={permission}
                    aria-pressed={selected}
                    onClick={() =>
                      binding.store
                        .getState()
                        .setAuthorizationDraftPermission(permission)
                    }
                  >
                    {formatMessage({ id: `you.escalation.gate.permission.${permission}` })}
                  </Button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || draftView.disabledReason !== null}
                title={draftView.disabledReason ?? undefined}
                data-testid="you-escalation-gate-grant"
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.grantAuthorization({
                      escalationId: inspected.escalationId,
                      scope: authorizationDraft.scope ?? "",
                      expiresAt: expiryPreset?.expiresAt ?? null,
                      learningPermission:
                        authorizationDraft.learningPermission ?? "none",
                    }),
                  )
                }
              >
                {formatMessage({ id: "you.escalation.gate.grant" })}
              </Button>
              {draftView.disabledReason !== null ? (
                <span className="text-ui-xs text-foreground-subtlest">
                  {formatMessage({
                    id: `you.escalation.gate.grantDisabled.${draftView.disabledReason}`,
                  })}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.gate.grantCaption" })}
            </p>
          </section>

          <section aria-label={formatMessage({ id: "you.escalation.gate.ledger.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.escalation.gate.ledger.title" })}
            </h4>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.gate.ledger.caption" })}
            </p>
            {authorizationRows.length === 0 ? (
              <p className="mt-2 text-ui-xs text-foreground-subtlest" data-testid="you-escalation-ledger-empty">
                {formatMessage({ id: "you.escalation.gate.ledger.empty" })}
              </p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1.5" data-testid="you-escalation-ledger">
                {authorizationRows.map((row) => (
                  <li
                    key={row.authorizationId}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border p-2",
                      row.live
                        ? "border-success/40 bg-success/5"
                        : row.kind === "withdrawal"
                          ? "border-warning/40 bg-warning/5"
                          : "border-border bg-surface",
                    )}
                    data-testid="you-escalation-ledger-entry"
                    data-you-escalation-authorization-id={row.authorizationId}
                    data-you-escalation-authorization-kind={row.kind}
                    data-you-escalation-authorization-live={row.live ? "true" : "false"}
                    data-you-escalation-authorization-permission={row.learningPermission}
                  >
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="font-mono text-ui-xs text-foreground">
                        {row.authorizationId}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-ui-xs",
                          row.kind === "grant"
                            ? "border-primary/30 text-primary"
                            : "border-warning/40 text-warning",
                        )}
                      >
                        {formatMessage({ id: `you.escalation.gate.ledger.kind.${row.kind}` })}
                      </Badge>
                      {row.live ? (
                        <Badge variant="outline" className="border-success/40 text-ui-xs text-success">
                          {formatMessage({ id: "you.escalation.gate.ledger.live" })}
                        </Badge>
                      ) : null}
                      {row.withdrawn ? (
                        <Badge variant="outline" className="border-warning/40 text-ui-xs text-warning">
                          {formatMessage({ id: "you.escalation.gate.ledger.withdrawn" })}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                      <span>{row.scope}</span>
                      <span>
                        {formatMessage({ id: "you.escalation.gate.ledger.permission" })}:{" "}
                        {row.learningPermission}
                      </span>
                      <span>
                        {formatMessage({ id: "you.escalation.gate.ledger.expiresAt" })}:{" "}
                        {row.expiresAt ?? formatMessage({ id: "you.escalation.gate.ledger.noExpiry" })}
                      </span>
                      {row.supersedesRecordId !== null ? (
                        <span>
                          {formatMessage({ id: "you.escalation.gate.ledger.supersedes" })}:{" "}
                          {row.supersedesRecordId}
                        </span>
                      ) : null}
                    </span>
                    <span className="sr-only">{row.accessibleLabel}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      <section aria-label={formatMessage({ id: "you.escalation.gate.policy.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.escalation.gate.policy.title" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.escalation.gate.policy.caption" })}
        </p>
        <dl className="mt-2 flex flex-col gap-1 font-mono text-ui-xs text-foreground-subtle">
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.gate.policy.maxAttempts" })}:
            </dt>
            <dd>{snapshot.retryPolicy.maxAttempts}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.gate.policy.backoffClass" })}:
            </dt>
            <dd>{snapshot.retryPolicy.backoffClass}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.gate.policy.eligibility" })}:
            </dt>
            <dd>{snapshot.retryPolicy.eligibilityCategories.join(", ")}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-foreground-subtlest">
              {formatMessage({ id: "you.escalation.gate.policy.requiresAuthorization" })}:
            </dt>
            <dd>
              {formatMessage({
                id: snapshot.retryPolicy.requiresAuthorization
                  ? "you.escalation.gate.policy.yes"
                  : "you.escalation.gate.policy.no",
              })}
            </dd>
          </div>
        </dl>

        <h5 className="mt-2 text-ui-xs font-medium text-foreground">
          {formatMessage({ id: "you.escalation.gate.policy.draft.title" })}
        </h5>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <label
            className="text-ui-xs text-foreground-subtlest"
            htmlFor="you-escalation-policy-max-attempts"
          >
            {formatMessage({ id: "you.escalation.gate.policy.draft.maxAttempts" })}
          </label>
          <input
            id="you-escalation-policy-max-attempts"
            type="number"
            min={0}
            max={10}
            className="h-6 w-16 rounded-md border border-border bg-surface px-1.5 font-mono text-ui-xs text-foreground"
            value={policyDraftView.maxAttempts}
            onChange={(event) =>
              binding.store
                .getState()
                .setPolicyDraftMaxAttempts(Number(event.target.value))
            }
            data-testid="you-escalation-policy-max-attempts"
          />
          <div className="flex flex-wrap gap-1" data-testid="you-escalation-backoff-options">
            {snapshot.backoffClasses.map((backoffClass) => {
              const selected = policyDraft.backoffClass === backoffClass;
              return (
                <Button
                  key={backoffClass}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 font-mono text-ui-xs",
                    selected && "border-primary/60 bg-primary/10 text-primary",
                  )}
                  data-testid="you-escalation-backoff-option"
                  data-you-escalation-backoff={backoffClass}
                  aria-pressed={selected}
                  onClick={() =>
                    binding.store.getState().setPolicyDraftBackoffClass(backoffClass)
                  }
                >
                  {backoffClass}
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-ui-xs"
            disabled={busy}
            data-testid="you-escalation-policy-validate"
            onClick={() => {
              setPolicyValidated(false);
              void withBusy(async () => {
                await binding.controller.validateRetryPolicy({
                  maxAttempts: policyDraftView.maxAttempts,
                  backoffClass: policyDraft.backoffClass,
                  eligibilityCategories: snapshot.categories,
                  requiresAuthorization: policyDraft.requiresAuthorization,
                });
                setPolicyValidated(true);
              });
            }}
          >
            {formatMessage({ id: "you.escalation.gate.policy.validate" })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-ui-xs"
            aria-pressed={policyDraft.requiresAuthorization}
            data-testid="you-escalation-policy-requires-authorization"
            onClick={() =>
              binding.store
                .getState()
                .setPolicyDraftRequiresAuthorization(!policyDraft.requiresAuthorization)
            }
          >
            {formatMessage({ id: "you.escalation.gate.policy.requiresAuthorization" })}:{" "}
            {formatMessage({
              id: policyDraft.requiresAuthorization
                ? "you.escalation.gate.policy.yes"
                : "you.escalation.gate.policy.no",
            })}
          </Button>
          {policyValidated ? (
            <Badge
              variant="outline"
              className="border-success/40 text-ui-xs text-success"
              data-testid="you-escalation-policy-validated"
            >
              {formatMessage({ id: "you.escalation.gate.policy.validated" })}
            </Badge>
          ) : null}
        </div>
      </section>

      <p className="text-ui-xs text-foreground-subtlest" data-testid="you-escalation-gate-gap-count">
        {formatMessage({ id: "you.escalation.gaps.count" })}: {snapshot.gapSpecs.length}{" "}
        fixture specs on the registry.
      </p>
    </div>
  );
}
