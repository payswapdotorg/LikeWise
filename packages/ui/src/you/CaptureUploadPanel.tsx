// YOU Capture Studio — 上传面板（W2B）。
//
// 验收要求：绑定 upload_requested / evidence 流的上传 UX（演示中仅确定性
// fixture 内容）。呈现宿主收到的 runtime 事件（evidence_requested /
// upload_requested），上传槽位可附加 fixture 内容；「模拟损坏传输」暴露
// YOU_CONTENT_HASH_MISMATCH 的诚实错误路径（不静默修复）。
import { useState } from "react";
import { useStore } from "zustand";
import { CloudUploadIcon, FileWarningIcon, RadioIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import type { UseCaptureStudioBinding } from "@/you/useCaptureStudio.js";
import { useCaptureMessages } from "@/you/useCaptureMessages.js";

export function CaptureUploadPanel({ binding }: { binding: UseCaptureStudioBinding }) {
  const { formatMessage } = useCaptureMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const [busy, setBusy] = useState(false);

  if (!snapshot) {
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

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-capture-upload"
    >
      <section aria-label={formatMessage({ id: "you.capture.upload.slots" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.capture.upload.title" })}
        </h3>
        {snapshot.pendingUploadSlots.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3">
            <p className="text-ui-sm text-foreground-subtle" data-testid="you-capture-upload-none">
              {formatMessage({ id: "you.capture.upload.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.capture.upload.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-1.5">
            {snapshot.pendingUploadSlots.map((slot) => {
              const request = snapshot.evidenceRequests.find(
                (candidate) => candidate.id === slot.evidenceRequestId,
              );
              return (
                <li
                  key={slot.artifactId}
                  className="rounded-lg border border-border bg-card p-2"
                  data-testid="you-capture-upload-slot"
                  data-you-capture-artifact-id={slot.artifactId}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CloudUploadIcon className="size-3.5 text-foreground-subtle" />
                    <span className="font-mono text-ui-xs text-foreground-subtlest">
                      {slot.artifactId}
                    </span>
                    <Badge variant="outline" className="text-ui-xs">
                      upload_requested
                    </Badge>
                  </div>
                  {request ? (
                    <p className="mt-0.5 font-mono text-ui-xs text-foreground-subtlest">
                      {formatMessage({ id: "you.capture.upload.boundRequest" })}: {request.id} (
                      {request.status})
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-ui-xs"
                      disabled={busy}
                      data-testid="you-capture-upload-attach"
                      data-you-capture-artifact-id={slot.artifactId}
                      onClick={() =>
                        withBusy(() =>
                          binding.controller.uploadFixtureContent({ artifactId: slot.artifactId }),
                        )
                      }
                    >
                      {formatMessage({ id: "you.capture.upload.attach" })}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-ui-xs"
                      disabled={busy}
                      title={formatMessage({ id: "you.capture.upload.corruptHint" })}
                      data-testid="you-capture-upload-corrupt"
                      data-you-capture-artifact-id={slot.artifactId}
                      onClick={() =>
                        withBusy(() =>
                          binding.controller.uploadFixtureContent({
                            artifactId: slot.artifactId,
                            corrupt: true,
                          }),
                        )
                      }
                    >
                      <FileWarningIcon className="size-3.5" />
                      {formatMessage({ id: "you.capture.upload.corrupt" })}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.capture.upload.corruptHint" })}
        </p>
      </section>

      <section aria-label={formatMessage({ id: "you.capture.upload.events" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.capture.upload.events" })}
        </h4>
        <ol className="mt-1 flex flex-col gap-0.5">
          {snapshot.runtimeEvents.map((event, index) => (
            <li
              key={`${event.type}-${index}`}
              className="flex flex-wrap items-baseline gap-1.5 font-mono text-ui-xs"
              data-testid="you-capture-runtime-event"
              data-you-capture-runtime-type={event.type}
            >
              <RadioIcon className="size-3 shrink-0 self-center text-foreground-subtlest" />
              <span className="text-foreground-subtle">{event.type}</span>
              {event.type === "upload_requested" ? (
                <span className="text-foreground-subtlest">{event.artifactId}</span>
              ) : null}
              {event.type === "evidence_requested" ? (
                <span className="text-foreground-subtlest">{event.evidenceRequestId}</span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.capture.upload.eventsCaption" })}
        </p>
      </section>

      <p className="shrink-0 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.capture.demo.scriptedNote" })}
      </p>
    </div>
  );
}
