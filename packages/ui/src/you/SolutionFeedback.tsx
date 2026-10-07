// YOU Solution Studio — 反馈面板（W1B）。
//
// 闭环：region/entity 选择 → 缺陷类别 + 注释 → canonical FeedbackRequest →
// （可选）定向证据请求 + fixture 证据 → 确定性改进（proposed ChangeSet，前后数字）→
// 用户接受/拒绝 → 新 canonical 版本。全部操作走 controller 端口（同一应用服务权威）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import type { FeedbackCategory } from "@zcode/shared";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.js";
import { Textarea } from "@/components/ui/textarea.js";
import { currentSolutionVersion } from "@/you/solutionController.js";
import { describeSolutionSelector } from "@/you/solutionProjection.js";
import { STORYBOARD_REGIONS } from "@/you/solutionStoryboard.js";
import type { UseSolutionSurfaceBinding } from "@/you/useSolutionSurface.js";
import { useYouMessages } from "@/you/youMessages.js";

const FEEDBACK_CATEGORIES: readonly FeedbackCategory[] = [
  "geometry",
  "appearance",
  "motion_naturalness",
  "identity_mismatch",
  "style",
  "composition",
  "behavior",
  "usability",
  "other",
];

export function SolutionFeedbackPanel({ binding }: { binding: UseSolutionSurfaceBinding }) {
  const { formatMessage } = useYouMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selection = useStore(binding.store, (state) => state.selection);
  const [category, setCategory] = useState<FeedbackCategory>("geometry");
  const [comment, setComment] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const version = snapshot ? currentSolutionVersion(snapshot) : null;
  const entities = useMemo(() => version?.state.entities ?? [], [version]);
  const description = selection ? describeSolutionSelector(selection, entities) : null;
  const latestFeedback = snapshot?.feedback.at(-1) ?? null;
  const pendingChangeSet =
    snapshot?.pendingChangeSets.find((changeSet) => changeSet.authorType === "agent") ?? null;
  const latestEvidence = snapshot?.evidenceRequests.at(-1) ?? null;

  if (!snapshot || !version) {
    return (
      <PanelEmpty
        text={formatMessage({ id: "you.solution.feedback.needSelectionHint" })}
        testId="you-solution-feedback-empty"
      />
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
      data-testid="you-solution-feedback"
    >
      {!selection ? (
        <div
          className="rounded-lg border border-border bg-surface p-3"
          data-testid="you-solution-feedback-need-selection"
        >
          <p className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.solution.feedback.needSelection" })}
          </p>
          <p className="mt-1 text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.solution.feedback.needSelectionHint" })}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {STORYBOARD_REGIONS.map((region) => (
              <Button
                key={region.id}
                type="button"
                variant="secondary"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                onClick={() =>
                  binding.store.getState().setSelection({ kind: "region", regionId: region.id })
                }
              >
                {region.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <section
          className="flex flex-col gap-2"
          aria-label={formatMessage({ id: "you.solution.feedback.title" })}
        >
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.solution.feedback.title" })}
            <span className="ml-1.5 font-mono text-ui-xs text-foreground-subtle">
              {description?.label}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="you-feedback-category"
              className="shrink-0 text-ui-sm text-foreground-subtle"
            >
              {formatMessage({ id: "you.solution.feedback.category" })}
            </Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as FeedbackCategory)}
            >
              <SelectTrigger id="you-feedback-category" size="sm" className="h-7 text-ui-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item} className="text-ui-sm">
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={formatMessage({ id: "you.solution.feedback.commentPlaceholder" })}
            aria-label={formatMessage({ id: "you.solution.feedback.comment" })}
            className="min-h-16 text-ui-sm"
          />
          <Input
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder={formatMessage({ id: "you.solution.feedback.actionPlaceholder" })}
            aria-label={formatMessage({ id: "you.solution.feedback.action" })}
            className="h-7 text-ui-sm"
          />
          <Button
            type="button"
            size="sm"
            className="self-start"
            disabled={busy || comment.trim().length === 0}
            data-testid="you-solution-feedback-submit"
            onClick={() =>
              withBusy(() =>
                binding.controller.submitFeedback({
                  targetRef: selection,
                  category,
                  userComment: comment.trim(),
                  requestedAction: action.trim() || formatMessage({ id: "you.solution.feedback.propose" }),
                  scope: "USER",
                }),
              )
            }
          >
            {formatMessage({ id: "you.solution.feedback.submit" })}
          </Button>
        </section>
      )}

      {latestFeedback ? (
        <section aria-label={formatMessage({ id: "you.solution.feedback.submitted" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.solution.feedback.submitted" })}
          </h4>
          <div
            className="mt-1 rounded-lg border border-border bg-card p-2"
            data-testid="you-solution-feedback-request"
          >
            <p className="font-mono text-ui-xs text-foreground-subtlest">{latestFeedback.id}</p>
            <p className="mt-0.5 text-ui-sm text-foreground">
              {latestFeedback.category} · {latestFeedback.status} · {latestFeedback.scope}
            </p>
            <p className="mt-0.5 text-ui-xs text-foreground-subtle">
              {latestFeedback.userComment}
            </p>
          </div>

          <h4 className="mt-3 text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.solution.feedback.evidence" })}
          </h4>
          {latestEvidence ? (
            <div
              className="mt-1 rounded-lg border border-border bg-card p-2"
              data-testid="you-solution-evidence-request"
            >
              <p className="font-mono text-ui-xs text-foreground-subtlest">
                {latestEvidence.id} · {latestEvidence.status}
              </p>
              <p className="mt-0.5 text-ui-xs text-foreground-subtle">
                {latestEvidence.reason}
              </p>
              <p className="mt-0.5 font-mono text-ui-xs text-foreground-subtlest">
                {latestEvidence.privacyRequirements} · {latestEvidence.retention}
              </p>
              {latestEvidence.status === "requested" ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2 h-6 px-2 text-ui-xs"
                  disabled={busy}
                  data-testid="you-solution-attach-evidence"
                  onClick={() => withBusy(() => binding.controller.attachFixtureEvidence(latestEvidence.id))}
                >
                  {formatMessage({ id: "you.solution.feedback.attachEvidence" })}
                </Button>
              ) : (
                <p className="mt-1 text-ui-xs text-foreground-subtle">
                  {formatMessage({ id: "you.solution.feedback.evidenceAttached" })}
                </p>
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-1 h-6 px-2 text-ui-xs"
              disabled={busy}
              data-testid="you-solution-request-evidence"
              onClick={() =>
                withBusy(() =>
                  binding.controller.requestEvidence({
                    feedbackRequestId: latestFeedback.id,
                    targetDeficiency: latestFeedback.category,
                    evidenceType: "fixture",
                    reason:
                      "Targeted fixture evidence can resolve this deficiency without real capture.",
                  }),
                )
              }
            >
              {formatMessage({ id: "you.solution.feedback.requestEvidence" })}
            </Button>
          )}
        </section>
      ) : null}

      {latestFeedback ? (
        <section aria-label={formatMessage({ id: "you.solution.feedback.improvement" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.solution.feedback.improvement" })}
            <span className="ml-1.5 text-ui-xs text-foreground-subtlest">
              ({formatMessage({ id: "you.solution.simulatedNote" })})
            </span>
          </h4>
          {pendingChangeSet ? (
            <div
              className="mt-1 rounded-lg border border-border bg-card p-2"
              data-testid="you-solution-pending-changeset"
            >
              <p className="font-mono text-ui-xs text-foreground-subtlest">
                {pendingChangeSet.id} · {pendingChangeSet.authorType}
              </p>
              <QualityBeforeAfter
                beforeVersionId={pendingChangeSet.inputVersionId}
                operations={pendingChangeSet.proposedOperations}
                currentVersion={version}
                formatMessage={formatMessage}
              />
              <div className="mt-2 flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-6 px-2 text-ui-xs"
                  disabled={busy}
                  data-testid="you-solution-accept-changeset"
                  onClick={() => withBusy(() => binding.controller.acceptChangeSet(pendingChangeSet.id))}
                >
                  {formatMessage({ id: "you.solution.feedback.accept" })}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-ui-xs"
                  disabled={busy}
                  data-testid="you-solution-reject-changeset"
                  onClick={() => withBusy(() => binding.controller.rejectChangeSet(pendingChangeSet.id))}
                >
                  {formatMessage({ id: "you.solution.feedback.reject" })}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-1 h-6 px-2 text-ui-xs"
              disabled={busy}
              data-testid="you-solution-propose-improvement"
              onClick={() =>
                withBusy(() =>
                  binding.controller.proposeDeterministicImprovement(latestFeedback.id),
                )
              }
            >
              {formatMessage({ id: "you.solution.feedback.propose" })}
            </Button>
          )}
        </section>
      ) : null}

      <p className="shrink-0 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.solution.demo.scriptedNote" })}
      </p>
    </div>
  );
}

/** 改进前后对照：输入版本质量 vs 应用 proposedOperations 后的质量（确定性算术）。 */
function QualityBeforeAfter({
  beforeVersionId,
  operations,
  currentVersion,
  formatMessage,
}: {
  beforeVersionId: string;
  operations: readonly { op: string; deficiencyClass?: string; delta?: number }[];
  currentVersion: NonNullable<ReturnType<typeof currentSolutionVersion>>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
}) {
  void beforeVersionId;
  const qualityOps = operations.filter((operation) => operation.op === "adjust_quality");
  if (qualityOps.length === 0) {
    return (
      <p className="mt-1 text-ui-xs text-foreground-subtle">
        {formatMessage({ id: "you.solution.feedback.noPending" })}
      </p>
    );
  }
  return (
    <table className="mt-1 w-full text-ui-xs">
      <tbody>
        {qualityOps.map((operation, index) => {
          const cls = operation.deficiencyClass ?? "";
          const before = currentVersion.state.quality[cls] ?? 0;
          const after = Math.round(Math.min(1, Math.max(0, before + (operation.delta ?? 0))) * 100) / 100;
          const delta = Math.round((after - before) * 100) / 100;
          return (
            <tr key={`${cls}-${index}`}>
              <td className="py-0.5 pr-2 text-foreground-subtle">{cls}</td>
              <td className="py-0.5 pr-2 text-right font-mono text-foreground-subtlest">
                {before.toFixed(2)}
              </td>
              <td className="py-0.5 pr-2 text-right font-mono text-foreground-subtlest">→</td>
              <td className="py-0.5 pr-2 text-right font-mono font-medium text-foreground">
                {after.toFixed(2)}
              </td>
              <td className="py-0.5 text-right font-mono text-foreground-subtle">
                {formatMessage({ id: "you.solution.feedback.delta" }, { delta: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}` })}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PanelEmpty({ text, testId }: { text: string; testId: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-ui-base text-foreground-subtle" data-testid={testId}>
        {text}
      </p>
    </div>
  );
}
