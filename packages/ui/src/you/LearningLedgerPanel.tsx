// YOU Learning Studio — 学习账本面板（W6B）。
//
// 验收要求：记录状态阶梯视图（candidate/validated/rejected/superseded；终态锁定）
// + supersession 链接显示。账本按状态分组渲染（projectLedgerView 纯投影）；
// 记录详情展示内容寻址绑定与惰性标记；一切来自 controller 投影——UI 零业务逻辑。
import { useMemo } from "react";
import { useStore } from "zustand";
import { BookOpenIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { cn } from "@/components/lib/utils.js";
import { useLearningMessages } from "@/you/useLearningMessages.js";
import type { UseLearningStudioBinding } from "@/you/useLearningStudio.js";
import {
  orderedLearningRecords,
  successorOfRecord,
} from "@/you/learningController.js";
import {
  projectLedgerRecordRow,
  projectLedgerView,
  projectRecordLadder,
} from "@/you/learningStudioProjection.js";
import type { LearningRecord, LearningRecordStatus } from "@zcode/shared";

export function LearningLedgerPanel({ binding }: { binding: UseLearningStudioBinding }) {
  const { formatMessage } = useLearningMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedRecordId = useStore(binding.store, (state) => state.selectedRecordId);

  const records = useMemo(() => orderedLearningRecords(snapshot), [snapshot]);
  const inspected = useMemo(
    () =>
      records.find((record) => record.id === selectedRecordId) ??
      records.at(-1) ??
      null,
    [records, selectedRecordId],
  );
  const view = useMemo(() => projectLedgerView(records), [records]);
  const successor = useMemo(
    () => (snapshot ? successorOfRecord(snapshot, inspected?.id ?? null) : null),
    [snapshot, inspected],
  );

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
      data-testid="you-learning-ledger"
    >
      <section aria-label={formatMessage({ id: "you.learning.ledger.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <BookOpenIcon className="size-4 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.learning.ledger.title" })}
          </h3>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-learning-ledger-count">
            {view.total}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.ledger.caption" })}
        </p>
        {view.total === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-learning-ledger-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.learning.ledger.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.learning.ledger.emptyHint" })}
            </p>
          </div>
        ) : null}
      </section>

      <LedgerGroupSection
        status="candidate"
        rows={view.candidate}
        selectedRecordId={inspected?.id ?? null}
        onSelect={(recordId) => binding.store.getState().selectRecord(recordId)}
      />
      <LedgerGroupSection
        status="validated"
        rows={view.validated}
        selectedRecordId={inspected?.id ?? null}
        onSelect={(recordId) => binding.store.getState().selectRecord(recordId)}
      />
      <LedgerGroupSection
        status="rejected"
        rows={view.rejected}
        selectedRecordId={inspected?.id ?? null}
        onSelect={(recordId) => binding.store.getState().selectRecord(recordId)}
      />
      <LedgerGroupSection
        status="superseded"
        rows={view.superseded}
        selectedRecordId={inspected?.id ?? null}
        onSelect={(recordId) => binding.store.getState().selectRecord(recordId)}
      />

      {inspected ? (
        <InspectedRecordSection
          inspected={inspected}
          successor={successor}
        />
      ) : null}
    </div>
  );
}

function LedgerGroupSection({
  status,
  rows,
  selectedRecordId,
  onSelect,
}: {
  status: LearningRecordStatus;
  rows: readonly ReturnType<typeof projectLedgerRecordRow>[];
  selectedRecordId: string | null;
  onSelect: (recordId: string) => void;
}) {
  const { formatMessage } = useLearningMessages();
  return (
    <section
      aria-label={formatMessage({ id: `you.learning.ledger.group.${status}` })}
      data-testid={`you-learning-ledger-group-${status}`}
      data-you-learning-group-count={rows.length}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: `you.learning.status.${status}` })}
        </h4>
        <Badge variant="outline" className="text-ui-xs text-foreground-subtle">
          {rows.length}
        </Badge>
      </div>
      {rows.length === 0 ? (
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.ledger.groupEmpty" })}
        </p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.recordId}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                  row.recordId === selectedRecordId
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-surface hover:bg-surface-hover",
                )}
                data-testid="you-learning-record-row"
                data-you-learning-record-id={row.recordId}
                data-you-learning-record-status={row.status}
                data-you-learning-record-inert={row.inert ? "true" : "false"}
                onClick={() => onSelect(row.recordId)}
              >
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="font-mono text-ui-xs text-foreground">{row.recordId}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-ui-xs",
                      row.status === "validated"
                        ? "border-success/40 text-success"
                        : row.status === "rejected"
                          ? "border-destructive/40 text-destructive"
                          : row.status === "superseded"
                            ? "border-muted-foreground/40 text-foreground-subtle"
                            : "border-primary/40 text-primary",
                    )}
                  >
                    {formatMessage({ id: `you.learning.status.${row.status}` })}
                  </Badge>
                  <span className="font-mono text-ui-xs text-foreground-subtlest">{row.scope}</span>
                  {row.inert ? (
                    <Badge variant="outline" className="border-warning/40 text-ui-xs text-warning">
                      {formatMessage({ id: "you.learning.ledger.record.inert" })}
                    </Badge>
                  ) : null}
                  {row.supersededById !== null ? (
                    <span className="font-mono text-ui-xs text-foreground-subtlest">
                      → {row.supersededById}
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                  <span>
                    {formatMessage({ id: "you.learning.contentRef" })}: {row.contentRef}
                  </span>
                </span>
                <span className="sr-only">{row.accessibleLabel}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function InspectedRecordSection({
  inspected,
  successor,
}: {
  inspected: LearningRecord;
  successor: LearningRecord | null;
}) {
  const { formatMessage } = useLearningMessages();
  const row = projectLedgerRecordRow(inspected);
  const ladder = projectRecordLadder(inspected.status);
  return (
    <section aria-label={formatMessage({ id: "you.learning.ledger.ladder" })} data-testid="you-learning-record-detail">
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="font-mono text-ui-sm font-medium text-foreground">{inspected.id}</h4>
        <Badge variant="outline" className={cn("text-ui-xs", inspected.status === "validated" ? "border-success/40 text-success" : "border-border text-foreground-subtle")}>
          {formatMessage({ id: `you.learning.status.${inspected.status}` })}
        </Badge>
      </div>
      <ol className="mt-2 flex flex-wrap gap-1.5" data-testid="you-learning-record-ladder">
        {ladder.map((step) => (
          <li
            key={step.status}
            className={cn(
              "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-ui-xs",
              step.current
                ? "border-primary/50 bg-primary/10 text-primary"
                : step.reached
                  ? "border-success/30 bg-success/5 text-foreground-subtle"
                  : "border-border bg-surface text-foreground-subtlest",
            )}
            data-testid="you-learning-record-ladder-step"
            data-you-learning-ladder-status={step.status}
            data-you-learning-ladder-current={step.current ? "true" : "false"}
            data-you-learning-ladder-reached={step.reached ? "true" : "false"}
          >
            <span className="sr-only">
              {step.current
                ? `${step.status} (current)`
                : step.reached
                  ? `${step.status} (reached)`
                  : `${step.status} (not reached)`}
            </span>
            {formatMessage({ id: `you.learning.status.${step.status}` })}
          </li>
        ))}
      </ol>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.learning.ledger.terminalHint" })}
      </p>
      <dl className="mt-2 flex flex-col gap-1 text-ui-xs text-foreground-subtle">
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-foreground-subtlest">{formatMessage({ id: "you.learning.ledger.record.signal" })}:</dt>
          <dd className="font-mono">{row.signalId}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-foreground-subtlest">{formatMessage({ id: "you.learning.ledger.record.scope" })}:</dt>
          <dd className="font-mono">{row.scope}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-foreground-subtlest">{formatMessage({ id: "you.learning.contentRef" })}:</dt>
          <dd className="font-mono">{row.contentRef}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-foreground-subtlest">{formatMessage({ id: "you.learning.contentHash" })}:</dt>
          <dd className="font-mono">{row.contentHash}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-foreground-subtlest">
            {formatMessage({ id: "you.learning.ledger.record.validatedAt" })}:
          </dt>
          <dd className="font-mono">{row.validatedAt}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-foreground-subtlest">
            {formatMessage({ id: "you.learning.ledger.record.supersededBy" })}:
          </dt>
          <dd className="font-mono">
            {row.supersededById ?? formatMessage({ id: "you.learning.ledger.record.supersededByNone" })}
            {successor ? ` (successor status: ${successor.status})` : ""}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-foreground-subtlest">{formatMessage({ id: "you.learning.ledger.record.usage" })}:</dt>
          <dd className="font-mono">
            {inspected.rights.usage.length > 0
              ? inspected.rights.usage.join(", ")
              : formatMessage({ id: "you.learning.rights.usage.none" })}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-foreground-subtlest">{formatMessage({ id: "you.learning.ledger.record.inert" })}:</dt>
          <dd className="font-mono">
            {row.inert
              ? formatMessage({ id: "you.learning.ledger.record.inert" })
              : formatMessage({ id: "you.learning.ledger.record.notInert" })}
          </dd>
        </div>
      </dl>
      <span className="sr-only">{row.accessibleLabel}</span>
    </section>
  );
}
