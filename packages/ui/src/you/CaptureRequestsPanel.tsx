// YOU Capture Studio — 定向证据请求面板（W2B）。
//
// 验收要求：渲染 EvidenceRequest，把 reason / privacyRequirements / retention
// **显著且平实**地呈现（operator 必须看懂「要什么、为什么、隐私与保留」）。
// 每个请求卡提供：开始引导采集 / 请求上传槽位（upload_requested 绑定入口）。
import { useState } from "react";
import { useStore } from "zustand";
import { CameraIcon, InfoIcon, LockIcon, ClockIcon, FrameIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Spinner } from "@/components/ui/spinner.js";
import { Textarea } from "@/components/ui/textarea.js";
import { currentCaptureSession } from "@/you/captureController.js";
import type { UseCaptureStudioBinding } from "@/you/useCaptureStudio.js";
import { useCaptureMessages } from "@/you/useCaptureMessages.js";

export function CaptureRequestsPanel({ binding }: { binding: UseCaptureStudioBinding }) {
  const { formatMessage } = useCaptureMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const [deficiency, setDeficiency] = useState("geometry");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!snapshot) {
    return <PanelEmpty testId="you-capture-requests-empty" />;
  }

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  const session = currentCaptureSession(snapshot);

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-capture-requests"
    >
      <section aria-label={formatMessage({ id: "you.capture.requests.title" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.capture.requests.title" })}
        </h3>
        {snapshot.evidenceRequests.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3">
            <p className="text-ui-sm text-foreground-subtle" data-testid="you-capture-requests-none">
              {formatMessage({ id: "you.capture.requests.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.capture.requests.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {snapshot.evidenceRequests.map((request) => (
              <li
                key={request.id}
                className="rounded-lg border border-border bg-card p-2.5"
                data-testid="you-capture-request-card"
                data-you-capture-request-id={request.id}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-ui-xs">
                    {request.status}
                  </Badge>
                  <span className="font-mono text-ui-xs text-foreground-subtlest">
                    {request.id}
                  </span>
                </div>
                <dl className="mt-1.5 flex flex-col gap-1.5">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-ui-xs font-medium text-foreground-subtle">
                      {formatMessage({ id: "you.capture.requests.deficiency" })}:
                    </dt>
                    <dd className="font-mono text-ui-xs text-foreground">
                      {request.targetDeficiency}
                    </dd>
                    <dt className="text-ui-xs font-medium text-foreground-subtle">
                      {formatMessage({ id: "you.capture.requests.type" })}:
                    </dt>
                    <dd className="font-mono text-ui-xs text-foreground">{request.evidenceType}</dd>
                  </div>
                  {request.preferredFraming ? (
                    <div className="flex items-start gap-1.5">
                      <FrameIcon className="mt-0.5 size-3.5 shrink-0 text-foreground-subtle" />
                      <div>
                        <dt className="sr-only">
                          {formatMessage({ id: "you.capture.requests.framing" })}
                        </dt>
                        <dd className="text-ui-xs text-foreground-subtle">
                          <span className="font-medium text-foreground-subtle">
                            {formatMessage({ id: "you.capture.requests.framing" })}:{" "}
                          </span>
                          {request.preferredFraming}
                        </dd>
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-md border border-border bg-surface p-2">
                    <div className="flex items-center gap-1.5">
                      <InfoIcon className="size-3.5 shrink-0 text-foreground-subtle" />
                      <dt className="text-ui-xs font-semibold text-foreground">
                        {formatMessage({ id: "you.capture.requests.reasonTitle" })}
                      </dt>
                    </div>
                    <dd
                      className="mt-0.5 text-ui-sm text-foreground"
                      data-testid="you-capture-request-reason"
                    >
                      {request.reason}
                    </dd>
                  </div>
                  <div className="rounded-md border border-border bg-surface p-2">
                    <div className="flex items-center gap-1.5">
                      <LockIcon className="size-3.5 shrink-0 text-foreground-subtle" />
                      <dt className="text-ui-xs font-semibold text-foreground">
                        {formatMessage({ id: "you.capture.requests.privacyTitle" })}
                      </dt>
                    </div>
                    <dd
                      className="mt-0.5 text-ui-xs text-foreground-subtle"
                      data-testid="you-capture-request-privacy"
                    >
                      {request.privacyRequirements}
                    </dd>
                  </div>
                  <div className="rounded-md border border-border bg-surface p-2">
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="size-3.5 shrink-0 text-foreground-subtle" />
                      <dt className="text-ui-xs font-semibold text-foreground">
                        {formatMessage({ id: "you.capture.requests.retentionTitle" })}
                      </dt>
                    </div>
                    <dd
                      className="mt-0.5 text-ui-xs text-foreground-subtle"
                      data-testid="you-capture-request-retention"
                    >
                      {request.retention}
                    </dd>
                  </div>
                </dl>
                {request.status === "requested" ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-ui-xs"
                      disabled={busy}
                      data-testid="you-capture-request-start"
                      data-you-capture-request-id={request.id}
                      onClick={() =>
                        withBusy(() =>
                          binding.controller.openCaptureSession({ evidenceRequestId: request.id }),
                        )
                      }
                    >
                      <CameraIcon className="size-3.5" />
                      {formatMessage({ id: "you.capture.requests.startCapture" })}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-ui-xs"
                      disabled={busy}
                      data-testid="you-capture-request-upload-slot"
                      data-you-capture-request-id={request.id}
                      onClick={() =>
                        withBusy(() =>
                          binding.controller.requestUploadSlot({ evidenceRequestId: request.id }),
                        )
                      }
                    >
                      {formatMessage({ id: "you.capture.requests.uploadSlot" })}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {session ? (
          <p className="mt-2 text-ui-xs text-foreground-subtle">
            {formatMessage({ id: "you.capture.requests.sessionBound" })}:{" "}
            <span className="font-mono">{session.id}</span> ({session.status})
          </p>
        ) : null}
      </section>

      <section aria-label={formatMessage({ id: "you.capture.requests.create" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.capture.requests.create" })}
        </h4>
        <div className="mt-1.5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="you-capture-new-deficiency"
              className="shrink-0 text-ui-sm text-foreground-subtle"
            >
              {formatMessage({ id: "you.capture.requests.newDeficiency" })}
            </Label>
            <Input
              id="you-capture-new-deficiency"
              value={deficiency}
              onChange={(event) => setDeficiency(event.target.value)}
              className="h-7 text-ui-sm"
            />
          </div>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={formatMessage({ id: "you.capture.requests.newReasonPlaceholder" })}
            aria-label={formatMessage({ id: "you.capture.requests.newReason" })}
            className="min-h-16 text-ui-sm"
          />
          <Button
            type="button"
            size="sm"
            className="self-start"
            disabled={busy || reason.trim().length === 0 || deficiency.trim().length === 0}
            data-testid="you-capture-request-create"
            onClick={() =>
              withBusy(() =>
                binding.controller.requestTargetedEvidence({
                  targetDeficiency: deficiency.trim(),
                  reason: reason.trim(),
                }),
              )
            }
          >
            {formatMessage({ id: "you.capture.requests.create" })}
          </Button>
        </div>
      </section>

      <p className="shrink-0 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.capture.demo.scriptedNote" })}
      </p>
    </div>
  );
}

function PanelEmpty({ testId }: { testId: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6" data-testid={testId}>
      <Spinner />
    </div>
  );
}
