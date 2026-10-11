// YOU Twin Studio — 改进流程面板（W3B）。
//
// 验收要求：缺陷的补救路径**原样**渲染其定向 EvidenceRequest（reason、privacy
// requirements、retention —— W2 consent UX 职责逐字适用），并链入采集流程；
// 「无许可 ⇒ 不处理」保持可见。证据绑定发布按钮的禁用只是 UI 投影——服务端
// binding-time 强制独立存在（binding.run 内的 typed error 诚实 inline 呈现）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import {
  CameraIcon,
  ClockIcon,
  InfoIcon,
  LockIcon,
  ShieldXIcon,
  WrenchIcon,
  FrameIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { useTwinMessages } from "@/you/useTwinMessages.js";
import type { UseTwinStudioBinding } from "@/you/useTwinStudio.js";
import {
  canonicalVersionOf,
  orderedTwinVersions,
  projectTwinBindingGate,
} from "@/you/twinController.js";
import { projectDeficiencyRows } from "@/you/twinStudioProjection.js";

export function TwinRemediationPanel({
  binding,
  onOpenCaptureStudio,
}: {
  binding: UseTwinStudioBinding;
  /** 链入既有 Capture 表面（app shell 注入的 handler；未提供时呈现提示文案）。 */
  onOpenCaptureStudio?: () => void;
}) {
  const { formatMessage } = useTwinMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedVersionId = useStore(binding.store, (state) => state.selectedVersionId);
  const [busy, setBusy] = useState(false);
  const [selectedDeficiencyId, setSelectedDeficiencyId] = useState<string | null>(null);

  const versions = useMemo(() => orderedTwinVersions(snapshot), [snapshot]);
  const version = useMemo(
    () =>
      versions.find((candidate) => candidate.id === selectedVersionId) ??
      canonicalVersionOf(snapshot) ??
      versions.at(-1) ??
      null,
    [versions, selectedVersionId, snapshot],
  );
  const deficiencyRows = useMemo(() => projectDeficiencyRows(version), [version]);
  const selectedDeficiency =
    deficiencyRows.find((row) => row.id === selectedDeficiencyId) ?? deficiencyRows[0] ?? null;
  const gate = snapshot ? projectTwinBindingGate(snapshot.consent) : null;

  /** 已注册的补救请求（按 targetDeficiency key 命中）。 */
  const linkedRequest = useMemo(() => {
    if (!snapshot || !selectedDeficiency) return null;
    const key = `${selectedDeficiency.deficiencyClass}:${selectedDeficiency.domain}`;
    return (
      snapshot.evidenceRequests.find((request) => request.targetDeficiency === key) ?? null
    );
  }, [snapshot, selectedDeficiency]);

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

  if (!version || deficiencyRows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6" data-testid="you-twin-remediation-empty">
        <p className="text-ui-base text-foreground-subtle">
          {formatMessage({ id: "you.twin.remediation.empty" })}
        </p>
        <p className="max-w-[24rem] text-center text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.twin.remediation.emptyHint" })}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-twin-remediation"
      data-you-twin-version-id={version.id}
    >
      <section aria-label={formatMessage({ id: "you.twin.remediation.title" })}>
        <div className="flex items-center gap-1.5">
          <WrenchIcon className="size-3.5 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.twin.remediation.title" })}
          </h3>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtle">
          {formatMessage({ id: "you.twin.versions.current" })}:{" "}
          <span className="font-mono">
            v{version.version} · {version.id}
          </span>
        </p>
        <ol className="mt-2 flex flex-col gap-1" data-testid="you-twin-remediation-deficiencies">
          {deficiencyRows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={
                  selectedDeficiency?.id === row.id
                    ? "flex w-full min-w-0 flex-col rounded-md border border-brand/40 bg-card-selected px-2 py-1.5 text-left"
                    : "flex w-full min-w-0 flex-col rounded-md border border-border bg-card px-2 py-1.5 text-left hover:bg-surface-hover"
                }
                data-testid="you-twin-remediation-deficiency"
                data-you-twin-deficiency-id={row.id}
                aria-pressed={selectedDeficiency?.id === row.id}
                onClick={() => setSelectedDeficiencyId(row.id)}
              >
                <span className="min-w-0 break-all font-mono text-ui-xs text-foreground">
                  {row.deficiencyClass} @ {row.domain}
                </span>
                <span className="text-ui-xs text-foreground-subtle">
                  {formatMessage({ id: "you.twin.quality.deficiencySeverity" })}{" "}
                  {row.severity.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {selectedDeficiency ? (
        <section
          aria-label={formatMessage({ id: "you.twin.remediation.evidenceRequest" })}
          className="flex flex-col gap-2"
          data-testid="you-twin-remediation-request"
          data-you-twin-deficiency-id={selectedDeficiency.id}
        >
          {linkedRequest ? (
            <div className="rounded-lg border border-border bg-card p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <h4 className="text-ui-sm font-medium text-foreground">
                  {formatMessage({ id: "you.twin.remediation.linkedRequest" })}
                </h4>
                <Badge variant="secondary" className="text-ui-xs">
                  {linkedRequest.status}
                </Badge>
                <span className="font-mono text-ui-xs text-foreground-subtlest">
                  {linkedRequest.id}
                </span>
              </div>
              <dl className="mt-1.5 flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-ui-xs font-medium text-foreground-subtle">
                    {formatMessage({ id: "you.twin.remediation.deficiency" })}:
                  </dt>
                  <dd className="font-mono text-ui-xs text-foreground">
                    {linkedRequest.targetDeficiency}
                  </dd>
                </div>
                {linkedRequest.preferredFraming ? (
                  <div className="flex items-start gap-1.5">
                    <FrameIcon className="mt-0.5 size-3.5 shrink-0 text-foreground-subtle" />
                    <div>
                      <dt className="sr-only">
                        {formatMessage({ id: "you.twin.remediation.framing" })}
                      </dt>
                      <dd className="text-ui-xs text-foreground-subtle">
                        <span className="font-medium text-foreground-subtle">
                          {formatMessage({ id: "you.twin.remediation.framing" })}:{" "}
                        </span>
                        {linkedRequest.preferredFraming}
                      </dd>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-md border border-border bg-surface p-2">
                  <div className="flex items-center gap-1.5">
                    <InfoIcon className="size-3.5 shrink-0 text-foreground-subtle" />
                    <dt className="text-ui-xs font-semibold text-foreground">
                      {formatMessage({ id: "you.twin.remediation.reasonTitle" })}
                    </dt>
                  </div>
                  <dd
                    className="mt-0.5 text-ui-sm text-foreground"
                    data-testid="you-twin-remediation-reason"
                  >
                    {linkedRequest.reason}
                  </dd>
                </div>
                <div className="rounded-md border border-border bg-surface p-2">
                  <div className="flex items-center gap-1.5">
                    <LockIcon className="size-3.5 shrink-0 text-foreground-subtle" />
                    <dt className="text-ui-xs font-semibold text-foreground">
                      {formatMessage({ id: "you.twin.remediation.privacyTitle" })}
                    </dt>
                  </div>
                  <dd
                    className="mt-0.5 text-ui-xs text-foreground-subtle"
                    data-testid="you-twin-remediation-privacy"
                  >
                    {linkedRequest.privacyRequirements}
                  </dd>
                </div>
                <div className="rounded-md border border-border bg-surface p-2">
                  <div className="flex items-center gap-1.5">
                    <ClockIcon className="size-3.5 shrink-0 text-foreground-subtle" />
                    <dt className="text-ui-xs font-semibold text-foreground">
                      {formatMessage({ id: "you.twin.remediation.retentionTitle" })}
                    </dt>
                  </div>
                  <dd
                    className="mt-0.5 text-ui-xs text-foreground-subtle"
                    data-testid="you-twin-remediation-retention"
                  >
                    {linkedRequest.retention}
                  </dd>
                </div>
              </dl>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {onOpenCaptureStudio ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 px-2 text-ui-xs"
                    data-testid="you-twin-remediation-capture-link"
                    onClick={onOpenCaptureStudio}
                  >
                    <CameraIcon className="size-3.5" />
                    {formatMessage({ id: "you.twin.remediation.captureLink" })}
                  </Button>
                ) : null}
                <span className="self-center text-ui-xs text-foreground-subtlest">
                  {formatMessage({ id: "you.twin.remediation.captureLinkHint" })}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-ui-xs text-foreground-subtle">
                {formatMessage({ id: "you.twin.remediation.noRequests" })}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-2"
                disabled={busy}
                data-testid="you-twin-remediation-open"
                data-you-twin-deficiency-id={selectedDeficiency.id}
                onClick={() =>
                  void withBusy(() =>
                    binding.controller.openRemediation({
                      versionId: version.id,
                      deficiencyId: selectedDeficiency.id,
                    }),
                  )
                }
              >
                {formatMessage({ id: "you.twin.remediation.openRequest" })}
              </Button>
            </div>
          )}
        </section>
      ) : null}

      <section aria-label={formatMessage({ id: "you.twin.remediation.consentTitle" })}>
        <div className="flex items-center gap-1.5">
          <ShieldXIcon className="size-3.5 shrink-0 text-foreground-subtle" />
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.twin.remediation.consentTitle" })}
          </h4>
        </div>
        <div className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2">
          {gate ? (
            <>
              <Badge
                variant={gate.allowed ? "secondary" : "outline"}
                className={
                  gate.allowed
                    ? "self-start text-ui-xs text-success"
                    : "self-start border-warning/40 text-ui-xs text-warning"
                }
                data-testid="you-twin-binding-gate"
                data-you-twin-binding-allowed={gate.allowed ? "true" : "false"}
                data-you-twin-binding-state={gate.state}
              >
                {gate.allowed
                  ? formatMessage({ id: "you.twin.remediation.gateAllowed" })
                  : formatMessage({ id: "you.twin.remediation.gateBlocked" })}
              </Badge>
              <p className="text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.twin.remediation.gateCaption" })}
              </p>
            </>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-ui-xs"
              disabled={busy}
              data-testid="you-twin-remediation-grant"
              onClick={() =>
                void withBusy(async () => {
                  const policy = (await binding.controller.refresh()).consent.policy;
                  for (const purpose of policy.purposes) {
                    await binding.controller.decideConsent({
                      policyId: policy.id,
                      purpose,
                      decision: "grant",
                    });
                  }
                })
              }
            >
              {formatMessage({ id: "you.twin.remediation.grantConsent" })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-ui-xs"
              disabled={busy}
              data-testid="you-twin-remediation-withdraw"
              onClick={() =>
                void withBusy(async () => {
                  const policy = (await binding.controller.refresh()).consent.policy;
                  await binding.controller.withdrawConsent({ policyId: policy.id });
                })
              }
            >
              {formatMessage({ id: "you.twin.remediation.withdrawConsent" })}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-6 px-2 text-ui-xs"
              disabled={busy || (gate ? !gate.allowed : true)}
              title={
                gate && !gate.allowed
                  ? formatMessage({ id: "you.twin.remediation.gateBlocked" })
                  : undefined
              }
              data-testid="you-twin-remediation-publish-evidence-bound"
              onClick={() =>
                void withBusy(() => binding.controller.publishFixtureVersion({ evidenceBound: true }))
              }
            >
              {formatMessage({ id: "you.twin.remediation.publishEvidenceBound" })}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
