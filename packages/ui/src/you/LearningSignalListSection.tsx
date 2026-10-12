// YOU Learning Studio — teach-me 信号列表区（W6B）。
//
// 从 `LearningSignalsPanel.tsx` 按模块内聚拆分（保持仓库 400 行纪律——与 W5B
// EditingInterchangeSection 同款先例）：信号列表（键盘可达）+ 检视信号的证据
// 引用展开（内容寻址标签 ONLY——绝不内联内容）。纯展示区，接收面板下发的
// props；一切业务语义在 controller 投影内。
import { useLearningMessages } from "@/you/useLearningMessages.js";
import { Badge } from "@/components/ui/badge.js";
import { cn } from "@/components/lib/utils.js";
import {
  clampSignalIndex,
  projectSignalEvidenceRows,
  projectSignalRows,
} from "@/you/learningStudioProjection.js";
import type { LearningSignal } from "@zcode/shared";

/** 信号列表（追加序 = id 升序；键盘光标与选中联动由面板 store 承担）。 */
export function LearningSignalListSection({
  signals,
  signalIndex,
  inspected,
  onSelect,
}: {
  signals: readonly LearningSignal[];
  signalIndex: number;
  inspected: LearningSignal | null;
  onSelect: (signalId: string) => void;
}) {
  const { formatMessage } = useLearningMessages();
  const rows = projectSignalRows(signals);
  return (
    <section aria-label={formatMessage({ id: "you.learning.signals.title" })}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.learning.signals.count" })}
        </h4>
        <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-learning-signals-count">
          {signals.length}
        </Badge>
      </div>
      {rows.length === 0 ? (
        <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-learning-signals-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.learning.signals.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.learning.signals.emptyHint" })}
          </p>
        </div>
      ) : (
        <ol className="mt-2 flex flex-col gap-1.5" data-testid="you-learning-signal-list" tabIndex={0}>
          {rows.map((row, index) => {
            const signal = signals[index];
            const isCursor = index === clampSignalIndex(signalIndex, signals.length);
            return (
              <li key={row.signalId}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                    row.signalId === inspected?.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-surface hover:bg-surface-hover",
                  )}
                  data-testid="you-learning-signal-row"
                  data-you-learning-signal-id={row.signalId}
                  data-you-learning-signal-kind={signal?.kind}
                  data-you-learning-signal-scope={signal?.scope}
                  data-you-learning-signal-cursor={isCursor ? "true" : "false"}
                  onClick={() => onSelect(row.signalId)}
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="font-mono text-ui-xs text-foreground">{row.signalId}</span>
                    <Badge variant="outline" className="border-primary/40 text-ui-xs text-primary">
                      {signal?.kind}
                    </Badge>
                    <span className="font-mono text-ui-xs text-foreground-subtlest">{row.scope}</span>
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-1.5 text-ui-xs text-foreground-subtle">
                    <span>
                      {formatMessage({ id: "you.learning.signals.evidenceRef" })}: ×{row.evidenceCount}
                    </span>
                    <span>· {formatMessage({ id: "you.learning.signals.capturedAt" })}:</span>
                    <span className="font-mono">{row.capturedAt}</span>
                  </span>
                  <span className="sr-only">{row.accessibleLabel}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.learning.signals.keyboardHint" })}
      </p>
    </section>
  );
}

/** 检视信号的 evidence 引用展开（内容寻址标签；顺序 = 捕获序）。 */
export function LearningInspectedSignalSection({ inspected }: { inspected: LearningSignal }) {
  const { formatMessage } = useLearningMessages();
  const evidenceRows = projectSignalEvidenceRows(inspected.evidenceRefs);
  return (
    <section aria-label={formatMessage({ id: "you.learning.signals.evidenceRefs" })} data-testid="you-learning-signal-detail">
      <h4 className="text-ui-sm font-medium text-foreground">
        {inspected.id} · {formatMessage({ id: "you.learning.signals.evidenceRefs" })}
      </h4>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-ui-xs text-foreground-subtle">
        <span>
          {formatMessage({ id: "you.learning.signals.subject" })}:{" "}
          {inspected.subjectRef ?? formatMessage({ id: "you.learning.signals.subjectNone" })}
        </span>
      </p>
      <ol className="mt-2 flex flex-col gap-1" data-testid="you-learning-signal-evidence-refs">
        {evidenceRows.map((row) => (
          <li
            key={`${row.index}:${row.evidenceRef}`}
            className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-ui-xs text-foreground-subtle"
            data-testid="you-learning-signal-evidence-ref"
          >
            <span className="text-foreground-subtlest">{row.index + 1}.</span>{" "}
            {row.evidenceRef}
            <span className="sr-only">{row.accessibleLabel}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
