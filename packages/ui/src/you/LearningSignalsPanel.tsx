// YOU Learning Studio — teach-me/learn-this 信号面板（W6B）。
//
// 验收要求：learning-signal kind picker（六种 frozen kind）+ scope ladder + evidence
// refs 标签 + 捕获确认全部由 controller 投影渲染——UI 零业务逻辑（W1B–W5B
// controller 模式；T6 换绑前由模拟控制器支撑）。kind/scope/evidence 选项来自快照
// 注册面投影（非 UI 硬编码）；信号校验（YOU_LEARNING_SIGNAL_INVALID）在服务端
// 语义内；证据内容寻址——只显示标签，绝不内联内容。
// 信号列表 + 检视证据展开按模块内聚拆分至 `LearningSignalListSection.tsx`。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { CheckCircle2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useLearningMessages } from "@/you/useLearningMessages.js";
import type { UseLearningStudioBinding } from "@/you/useLearningStudio.js";
import { orderedLearningSignals } from "@/you/learningController.js";
import {
  projectDraftEvidenceRefs,
  projectEvidenceOptions,
  projectKindOptions,
  projectScopeLadder,
  projectSignalDraftView,
  resolveLearningKeyboardTransition,
} from "@/you/learningStudioProjection.js";
import {
  LearningInspectedSignalSection,
  LearningSignalListSection,
} from "@/you/LearningSignalListSection.js";
import type { LearningScope } from "@zcode/shared";

export function LearningSignalsPanel({ binding }: { binding: UseLearningStudioBinding }) {
  const { formatMessage } = useLearningMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedSignalId = useStore(binding.store, (state) => state.selectedSignalId);
  const signalIndex = useStore(binding.store, (state) => state.signalIndex);
  const signalDraft = useStore(binding.store, (state) => state.signalDraft);
  const [busy, setBusy] = useState(false);

  const signals = useMemo(() => orderedLearningSignals(snapshot), [snapshot]);
  const inspected = useMemo(
    () =>
      signals.find((signal) => signal.id === selectedSignalId) ??
      signals.at(-1) ??
      null,
    [signals, selectedSignalId],
  );
  const kindOptions = useMemo(
    () => (snapshot ? projectKindOptions(snapshot.kindRegistry) : []),
    [snapshot],
  );
  const evidenceOptions = useMemo(
    () => (snapshot ? projectEvidenceOptions(snapshot.evidence) : []),
    [snapshot],
  );
  const draftView = projectSignalDraftView(signalDraft);
  const draftEvidenceRefs = projectDraftEvidenceRefs(snapshot, signalDraft.evidenceIds);

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

  const captureDisabledReason =
    draftView.disabledReason === "no-kind"
      ? formatMessage({ id: "you.learning.signals.captureDisabled.no-kind" })
      : draftView.disabledReason === "no-scope"
        ? formatMessage({ id: "you.learning.signals.captureDisabled.no-scope" })
        : draftView.disabledReason === "no-evidence"
          ? formatMessage({ id: "you.learning.signals.captureDisabled.no-evidence" })
          : null;

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-learning-signals"
      onKeyDown={(event) => {
        // 键盘导航 = 一等交互路径（与 Solution/Capture/Twin/Performance/Editing 同款）。
        const action = resolveLearningKeyboardTransition(event.key, {
          totalSignals: signals.length,
        });
        if (action.kind === "move") {
          event.preventDefault();
          binding.store.getState().moveSignalIndex(action.delta);
        } else if (action.kind === "select" && inspected) {
          event.preventDefault();
          binding.store.getState().selectSignal(inspected.id);
        }
      }}
    >
      <section aria-label={formatMessage({ id: "you.learning.signals.title" })}>
        <h3 className="text-ui-base font-medium text-foreground">
          {formatMessage({ id: "you.learning.signals.title" })}
        </h3>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.signals.caption" })}
        </p>
      </section>

      <KindPickerSection
        kindOptions={kindOptions}
        selectedKind={signalDraft.kind}
        onSelect={(kind) => binding.store.getState().setSignalDraftKind(kind)}
      />

      <ScopeSection
        scopes={snapshot.scopes}
        selectedScope={signalDraft.scope}
        onSelect={(scope) => binding.store.getState().setSignalDraftScope(scope)}
      />

      <EvidenceSection
        evidenceOptions={evidenceOptions}
        selectedIds={signalDraft.evidenceIds}
        onToggle={(evidenceId) =>
          binding.store.getState().toggleSignalDraftEvidence(evidenceId)
        }
      />

      <section aria-label={formatMessage({ id: "you.learning.signals.capture" })}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-6 px-2 text-ui-xs"
            disabled={busy || captureDisabledReason !== null}
            title={captureDisabledReason ?? undefined}
            data-testid="you-learning-signal-capture"
            onClick={() => {
              if (signalDraft.kind === null || signalDraft.scope === null) return;
              void withBusy(() =>
                binding.controller.captureSignal({
                  kind: signalDraft.kind as never,
                  scope: signalDraft.scope as LearningScope,
                  evidenceRefs: draftEvidenceRefs,
                }),
              );
            }}
          >
            <CheckCircle2Icon className="size-3" />
            {formatMessage({ id: "you.learning.signals.capture" })}
          </Button>
          {draftEvidenceRefs.length > 0 ? (
            <span className="font-mono text-ui-xs text-foreground-subtlest">
              {draftEvidenceRefs.length} ×{" "}
              {formatMessage({ id: "you.learning.signals.evidenceRef" })}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.signals.captureCaption" })}
        </p>
      </section>

      <LearningSignalListSection
        signals={signals}
        signalIndex={signalIndex}
        inspected={inspected}
        onSelect={(signalId) => binding.store.getState().selectSignal(signalId)}
      />

      {inspected ? <LearningInspectedSignalSection inspected={inspected} /> : null}
    </div>
  );
}

function KindPickerSection({
  kindOptions,
  selectedKind,
  onSelect,
}: {
  kindOptions: readonly { readonly kind: string; readonly displayName: string }[];
  selectedKind: string | null;
  onSelect: (kind: string) => void;
}) {
  const { formatMessage } = useLearningMessages();
  return (
    <section aria-label={formatMessage({ id: "you.learning.signals.kind.title" })}>
      <h4 className="text-ui-sm font-medium text-foreground">
        {formatMessage({ id: "you.learning.signals.kind.title" })}
      </h4>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.learning.signals.kind.hint" })}
      </p>
      <div className="mt-2 flex flex-wrap gap-1" data-testid="you-learning-kind-options">
        {kindOptions.map((option) => {
          const selected = option.kind === selectedKind;
          const labelId = `you.learning.signals.kind.${option.kind}`;
          return (
            <Button
              key={option.kind}
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-6 px-2 text-ui-xs",
                selected && "border-primary/60 bg-primary/10 text-primary",
              )}
              data-testid="you-learning-kind-option"
              data-you-learning-kind={option.kind}
              aria-pressed={selected}
              onClick={() => onSelect(option.kind)}
            >
              {formatMessage({ id: labelId }) !== labelId
                ? formatMessage({ id: labelId })
                : option.displayName}
            </Button>
          );
        })}
      </div>
    </section>
  );
}

function ScopeSection({
  scopes,
  selectedScope,
  onSelect,
}: {
  scopes: readonly LearningScope[];
  selectedScope: string | null;
  onSelect: (scope: string) => void;
}) {
  const { formatMessage } = useLearningMessages();
  const ladder = selectedScope !== null ? projectScopeLadder(selectedScope as LearningScope, scopes) : [];
  return (
    <section aria-label={formatMessage({ id: "you.learning.signals.scope.title" })}>
      <h4 className="text-ui-sm font-medium text-foreground">
        {formatMessage({ id: "you.learning.signals.scope.title" })}
      </h4>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.learning.signals.scope.hint" })}
      </p>
      <div className="mt-2 flex flex-wrap gap-1" data-testid="you-learning-scope-options">
        {scopes.map((scope) => {
          const selected = scope === selectedScope;
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
              data-testid="you-learning-scope-option"
              data-you-learning-scope={scope}
              aria-pressed={selected}
              onClick={() => onSelect(scope)}
            >
              {scope}
            </Button>
          );
        })}
      </div>
      {ladder.length > 0 ? (
        <>
          <ol className="mt-2 flex flex-wrap gap-1.5" data-testid="you-learning-scope-ladder">
            {ladder.map((step) => (
              <li
                key={step.scope}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-ui-xs",
                  step.current
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : step.reached
                      ? "border-success/30 bg-success/5 text-foreground-subtle"
                      : "border-border bg-surface text-foreground-subtlest",
                )}
                data-testid="you-learning-scope-ladder-step"
                data-you-learning-scope-step={step.scope}
                data-you-learning-scope-current={step.current ? "true" : "false"}
                data-you-learning-scope-reached={step.reached ? "true" : "false"}
              >
                <span className="sr-only">
                  {step.current
                    ? `${step.scope} (effective scope)`
                    : step.reached
                      ? `${step.scope} (reached)`
                      : `${step.scope} (out of effect)`}
                </span>
                {step.scope}
              </li>
            ))}
          </ol>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.learning.signals.ladderHint" })}
          </p>
        </>
      ) : null}
    </section>
  );
}

function EvidenceSection({
  evidenceOptions,
  selectedIds,
  onToggle,
}: {
  evidenceOptions: readonly {
    readonly evidenceId: string;
    readonly displayName: string;
    readonly contentRef: string;
    readonly contentHash: string;
    readonly originPlane: string;
    readonly accessibleLabel: string;
  }[];
  selectedIds: readonly string[];
  onToggle: (evidenceId: string) => void;
}) {
  const { formatMessage } = useLearningMessages();
  return (
    <section aria-label={formatMessage({ id: "you.learning.signals.evidence.title" })}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.learning.signals.evidence.title" })}
        </h4>
        <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-learning-evidence-count">
          {selectedIds.length}/{evidenceOptions.length}
        </Badge>
      </div>
      <p className="mt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.learning.signals.evidence.hint" })}
      </p>
      {evidenceOptions.length === 0 ? (
        <p className="mt-2 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.signals.evidence.none" })}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5" data-testid="you-learning-evidence-options">
          {evidenceOptions.map((option) => {
            const selected = selectedIds.includes(option.evidenceId);
            return (
              <li key={option.evidenceId}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-lg border p-2 text-left transition-colors",
                    selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface hover:bg-surface-hover",
                  )}
                  data-testid="you-learning-evidence-option"
                  data-you-learning-evidence-id={option.evidenceId}
                  aria-pressed={selected}
                  onClick={() => onToggle(option.evidenceId)}
                >
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-ui-sm text-foreground">{option.displayName}</span>
                    <span className="font-mono text-ui-xs text-foreground-subtlest">{option.evidenceId}</span>
                    <Badge variant="outline" className="ml-auto text-ui-xs text-foreground-subtle">
                      {option.originPlane}
                    </Badge>
                  </span>
                  <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtle">
                    <span>
                      {formatMessage({ id: "you.learning.contentRef" })}: {option.contentRef}
                    </span>
                    <span>
                      {formatMessage({ id: "you.learning.contentHash" })}: {option.contentHash}
                    </span>
                  </span>
                  <span className="sr-only">{option.accessibleLabel}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
