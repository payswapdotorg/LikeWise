// YOU Capture Studio — 证据评审面板（W2B）。
//
// 验收要求：评审一条 EvidenceRecord（质量观察、备注、接受/拒绝），诚实呈现
// 加载/错误/空状态。质量观察来自服务端确定性表（fixture 定义，非科学度量）；
// 评审历史含 superseded 标记（re-review 取代，绝不覆写）；保留状态
// （available / expired / purged）真实可见；「读取 fixture 内容」暴露
// YOU_RETENTION_EXPIRED / YOU_EVIDENCE_NOT_FOUND 的诚实错误路径。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { CheckIcon, XIcon, FileSearchIcon } from "lucide-react";
import { cn } from "@/components/lib/utils.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Label } from "@/components/ui/label.js";
import { Textarea } from "@/components/ui/textarea.js";
import {
  effectiveReviewForEvidence,
  orderedEvidenceRecords,
  type CaptureFixtureContent,
} from "@/you/captureController.js";
import { projectEvidenceAvailability } from "@/you/captureStudioProjection.js";
import type { UseCaptureStudioBinding } from "@/you/useCaptureStudio.js";
import { useCaptureMessages } from "@/you/useCaptureMessages.js";

export function EvidenceReviewPanel({ binding }: { binding: UseCaptureStudioBinding }) {
  const { formatMessage } = useCaptureMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedEvidenceRecordId = useStore(
    binding.store,
    (state) => state.selectedEvidenceRecordId,
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [contentPreview, setContentPreview] = useState<CaptureFixtureContent | null>(null);

  const records = useMemo(() => orderedEvidenceRecords(snapshot), [snapshot]);
  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedEvidenceRecordId) ?? records.at(-1) ?? null,
    [records, selectedEvidenceRecordId],
  );
  const effectiveReview = useMemo(
    () =>
      selectedRecord && snapshot
        ? effectiveReviewForEvidence(snapshot, selectedRecord.id)
        : null,
    [snapshot, selectedRecord],
  );
  const reviewsForSelected = useMemo(
    () =>
      selectedRecord && snapshot
        ? snapshot.reviews.filter((review) => review.evidenceId === selectedRecord.id)
        : [],
    [snapshot, selectedRecord],
  );

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
      data-testid="you-capture-review"
    >
      <section aria-label={formatMessage({ id: "you.capture.review.records" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.capture.review.title" })}
        </h3>
        {records.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3">
            <p className="text-ui-sm text-foreground-subtle" data-testid="you-capture-review-none">
              {formatMessage({ id: "you.capture.review.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.capture.review.emptyHint" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-1">
            {records.map((record) => {
              const availability = projectEvidenceAvailability(record.id, snapshot.retention);
              const isSelected = selectedRecord?.id === record.id;
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-md border px-2 py-1.5 text-left",
                      isSelected
                        ? "border-brand/50 bg-selected"
                        : "border-border bg-card hover:bg-surface-hover",
                    )}
                    aria-pressed={isSelected}
                    data-testid="you-capture-review-record"
                    data-you-capture-evidence-id={record.id}
                    onClick={() => {
                      binding.store.getState().selectEvidenceRecord(record.id);
                      setContentPreview(null);
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-ui-xs text-foreground-subtlest">
                        {record.id}
                      </span>
                      <Badge variant="outline" className="text-ui-xs">
                        {record.evidenceType} · {record.modality}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-ui-xs",
                          availability === "available" && "text-success",
                          availability === "expired" && "text-warning",
                        )}
                        data-testid="you-capture-review-availability"
                      >
                        {formatMessage({ id: `you.capture.review.retention.${availability}` })}
                      </Badge>
                      {record.simulated ? (
                        <Badge
                          variant="outline"
                          className="border-warning/40 text-ui-xs text-foreground-subtle"
                        >
                          {formatMessage({ id: "you.capture.simulatedNote" })}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 font-mono text-ui-xs text-foreground-subtlest">
                      {formatMessage({ id: "you.capture.review.privacyClass" })}:{" "}
                      {record.privacyClass} · {formatMessage({ id: "you.capture.review.capturedAt" })}:{" "}
                      {record.capturedAt}
                    </p>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {selectedRecord ? (
        <section aria-label={formatMessage({ id: "you.capture.review.record" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.capture.review.record" })}
            <span className="ml-1.5 font-mono text-ui-xs text-foreground-subtlest">
              {selectedRecord.id}
            </span>
          </h4>
          <div className="mt-1.5 flex flex-col gap-2">
            <div className="rounded-lg border border-border bg-card p-2">
              <p className="text-ui-xs font-medium text-foreground">
                {formatMessage({ id: "you.capture.review.observations" })}
              </p>
              {effectiveReview ? (
                <>
                  <ul className="mt-1 flex flex-col gap-0.5" data-testid="you-capture-review-observations">
                    {Object.entries(effectiveReview.qualityObservations)
                      .sort(([a], [b]) => (a < b ? -1 : 1))
                      .map(([cls, score]) => (
                        <li key={cls} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 truncate font-mono text-ui-xs text-foreground-subtle">
                            {cls}
                          </span>
                          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-hover">
                            <span
                              className="block h-full rounded-full bg-foreground-subtle"
                              style={{ width: `${Math.round(score * 100)}%` }}
                            />
                          </span>
                          <span className="w-9 shrink-0 text-right font-mono text-ui-xs text-foreground-subtle">
                            {score.toFixed(2)}
                          </span>
                        </li>
                      ))}
                  </ul>
                  <p className="mt-1 text-ui-xs text-foreground-subtlest">
                    {formatMessage({ id: "you.capture.review.observationsCaption" })}
                  </p>
                </>
              ) : (
                <p
                  className="mt-1 text-ui-xs text-foreground-subtlest"
                  data-testid="you-capture-review-not-reviewed"
                >
                  {formatMessage({ id: "you.capture.review.observationsNone" })}
                </p>
              )}
            </div>

            <div>
              <Label
                htmlFor="you-capture-review-notes"
                className="text-ui-sm text-foreground-subtle"
              >
                {formatMessage({ id: "you.capture.review.notes" })}
              </Label>
              <Textarea
                id="you-capture-review-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={formatMessage({ id: "you.capture.review.notesPlaceholder" })}
                className="mt-1 min-h-14 text-ui-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy}
                data-testid="you-capture-review-accept"
                onClick={() =>
                  withBusy(async () => {
                    await binding.controller.reviewEvidence({
                      evidenceId: selectedRecord.id,
                      outcome: "accepted",
                      notes: notes.trim(),
                    });
                    setContentPreview(null);
                  })
                }
              >
                <CheckIcon className="size-3.5" />
                {formatMessage({ id: "you.capture.review.accept" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy}
                data-testid="you-capture-review-reject"
                onClick={() =>
                  withBusy(async () => {
                    await binding.controller.reviewEvidence({
                      evidenceId: selectedRecord.id,
                      outcome: "rejected",
                      notes: notes.trim(),
                    });
                    setContentPreview(null);
                  })
                }
              >
                <XIcon className="size-3.5" />
                {formatMessage({ id: "you.capture.review.reject" })}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy}
                data-testid="you-capture-review-read-content"
                onClick={() =>
                  withBusy(async () => {
                    const content = await binding.controller.readFixtureContent(selectedRecord.id);
                    setContentPreview(content ?? null);
                  })
                }
              >
                <FileSearchIcon className="size-3.5" />
                {formatMessage({ id: "you.capture.review.readContent" })}
              </Button>
            </div>

            {contentPreview ? (
              <div
                className="rounded-lg border border-border bg-card p-2"
                data-testid="you-capture-review-content"
              >
                <p className="text-ui-xs font-medium text-foreground">
                  {formatMessage({ id: "you.capture.review.contentPreview" })}
                </p>
                <p className="mt-0.5 break-all font-mono text-ui-xs text-foreground-subtle">
                  {contentPreview.preview}…
                </p>
                <p className="mt-0.5 font-mono text-ui-xs text-foreground-subtlest">
                  {formatMessage({ id: "you.capture.review.contentHash" })}:{" "}
                  {contentPreview.contentHash}
                </p>
                <p className="font-mono text-ui-xs text-foreground-subtlest">
                  {formatMessage(
                    { id: "you.capture.review.contentBytes" },
                    { count: contentPreview.byteLength },
                  )}
                </p>
              </div>
            ) : null}
          </div>

          {reviewsForSelected.length > 0 ? (
            <div className="mt-2">
              <p className="text-ui-xs font-medium text-foreground">
                {formatMessage({ id: "you.capture.review.reviewHistory" })}
              </p>
              <ol className="mt-1 flex flex-col gap-0.5">
                {reviewsForSelected.map((review) => (
                  <li
                    key={review.id}
                    className="flex flex-wrap items-baseline gap-1.5 font-mono text-ui-xs"
                    data-testid="you-capture-review-history-item"
                    data-you-capture-review-status={review.status}
                  >
                    <span className="text-foreground-subtlest">{review.id}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-ui-xs",
                        review.status === "accepted" && "text-success",
                        review.status === "rejected" && "text-warning",
                      )}
                    >
                      {review.status}
                    </Badge>
                    {review.status === "superseded" ? (
                      <span className="text-foreground-subtlest">
                        {formatMessage({ id: "you.capture.review.superseded" })}
                      </span>
                    ) : null}
                    <span className="text-foreground-subtlest">{review.reviewedAt}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.capture.review.selectRecord" })}
        </p>
      )}

      <p className="shrink-0 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.capture.demo.scriptedNote" })}
      </p>
    </div>
  );
}
