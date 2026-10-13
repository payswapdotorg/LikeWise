// YOU Lab Studio — 晋升面板（W9B）。
//
// 验收要求：promotion surface——LabPromotionRecord 显示（winner 臂、objective vs
// baseline 分数、证据链接）+ promotion gate 拒绝状态（门显示从
// projectLabPromotionGate 投影——服务端独立强制；固定求值序 fail closed）+
// reversal 新记录账本（kind/supersedes 链接——LAB PROMOTION LAW 的可见面）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { AwardIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useLabMessages } from "@/you/useLabMessages.js";
import type { UseLabStudioBinding } from "@/you/useLabStudio.js";
import {
  labExperimentById,
  labPromotionLedgerOfExperiment,
  liveLabPromotionOfExperiment,
  projectLabPromotionGate,
} from "@/you/labController.js";
import {
  projectLabListRegionView,
  projectPromotionRows,
} from "@/you/labStudioProjection.js";
import type { LabArmKind } from "@zcode/shared";

const CANDIDATE_ARMS: readonly LabArmKind[] = [
  "generalist-baseline",
  "hand-designed",
  "searched",
];

export function LabPromotionPanel({ binding }: { binding: UseLabStudioBinding }) {
  const { formatMessage } = useLabMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedExperimentId = useStore(binding.store, (state) => state.selectedExperimentId);
  const promotionDraft = useStore(binding.store, (state) => state.promotionDraft);
  const [busy, setBusy] = useState(false);

  const experiment = useMemo(
    () => labExperimentById(snapshot, selectedExperimentId),
    [snapshot, selectedExperimentId],
  );
  const ledger = useMemo(
    () => labPromotionLedgerOfExperiment(snapshot, selectedExperimentId),
    [snapshot, selectedExperimentId],
  );
  const promotionRows = useMemo(() => projectPromotionRows(ledger), [ledger]);
  const livePromotion = useMemo(
    () => liveLabPromotionOfExperiment(snapshot, selectedExperimentId),
    [snapshot, selectedExperimentId],
  );
  const gate = useMemo(
    () =>
      projectLabPromotionGate(
        snapshot,
        selectedExperimentId,
        promotionDraft.candidateArm,
        promotionDraft.evidenceManifestId,
      ),
    [snapshot, selectedExperimentId, promotionDraft],
  );
  const region = projectLabListRegionView(snapshot !== null, ledger.length);
  const experimentManifests = useMemo(
    () =>
      (snapshot?.manifests ?? []).filter((entry) => {
        const run = snapshot?.runs.find((candidate) => candidate.id === entry.manifest.runId);
        return run !== undefined && run.experimentId === selectedExperimentId;
      }),
    [snapshot, selectedExperimentId],
  );

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
      data-testid="you-lab-promotion"
    >
      <section aria-label={formatMessage({ id: "you.lab.promotion.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <AwardIcon className="size-4 shrink-0 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.lab.promotion.title" })}
          </h3>
          <span className="font-mono text-ui-xs text-foreground-subtlest">
            {experiment ? experiment.id : "—"}
          </span>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.promotion.caption" })}
        </p>
      </section>

      {region === "empty" && experiment === null ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-testid="you-lab-promotion-empty">
          <p className="text-ui-sm text-foreground-subtle">
            {formatMessage({ id: "you.lab.promotion.empty" })}
          </p>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.lab.promotion.emptyHint" })}
          </p>
        </div>
      ) : (
        <>
          <section
            aria-label={formatMessage({ id: "you.lab.promotion.gate.title" })}
            data-testid="you-lab-promotion-gate"
            data-you-lab-promotion-gate-allowed={gate.allowed ? "true" : "false"}
            data-you-lab-promotion-gate-reason={gate.reason}
          >
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.lab.promotion.gate.title" })}
            </h4>
            <div
              className={cn(
                "mt-1 flex flex-wrap items-center gap-2 rounded-md border p-1.5",
                gate.allowed
                  ? "border-success/40 bg-success/5"
                  : "border-warning/40 bg-warning/5",
              )}
            >
              {gate.allowed ? (
                <ShieldCheckIcon className="size-3.5 text-success" />
              ) : (
                <ShieldXIcon className="size-3.5 text-warning" />
              )}
              <span className="text-ui-xs font-medium text-foreground">
                {gate.allowed
                  ? formatMessage({ id: "you.lab.promotion.gate.allowed" })
                  : formatMessage({ id: "you.lab.promotion.gate.blocked" })}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-ui-xs",
                  gate.allowed
                    ? "border-success/40 text-success"
                    : "border-warning/40 text-warning",
                )}
              >
                {formatMessage({ id: `you.lab.promotion.gate.reason.${gate.reason}` })}
              </Badge>
            </div>
            <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.lab.promotion.decideCaption" })}
            </p>
          </section>

          <section aria-label={formatMessage({ id: "you.lab.promotion.candidate.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.lab.promotion.candidate.title" })}
            </h4>
            <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.lab.promotion.candidate.hint" })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1" data-testid="you-lab-candidate-options">
              {CANDIDATE_ARMS.map((arm) => {
                const selected = arm === promotionDraft.candidateArm;
                return (
                  <Button
                    key={arm}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className={cn(
                      "h-6 px-2 text-ui-xs",
                      selected && "border-primary/60 bg-primary/10 text-primary",
                    )}
                    data-testid="you-lab-candidate-option"
                    data-you-lab-candidate-arm={arm}
                    aria-pressed={selected}
                    onClick={() => binding.store.getState().setPromotionCandidateArm(arm)}
                  >
                    {formatMessage({ id: `you.lab.arm.${arm}` })}
                  </Button>
                );
              })}
            </div>
          </section>

          <section aria-label={formatMessage({ id: "you.lab.promotion.evidence.title" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.lab.promotion.evidence.title" })}
            </h4>
            <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.lab.promotion.evidence.hint" })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1" data-testid="you-lab-promotion-evidence-options">
              {experimentManifests.length === 0 ? (
                <span className="text-ui-xs text-foreground-subtle">
                  {formatMessage({ id: "you.lab.promotion.evidence.none" })}
                </span>
              ) : (
                experimentManifests.map((entry) => {
                  const selected = entry.manifest.id === promotionDraft.evidenceManifestId;
                  return (
                    <Button
                      key={entry.manifest.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className={cn(
                        "h-6 px-2 font-mono text-ui-xs",
                        selected && "border-primary/60 bg-primary/10 text-primary",
                        entry.verification !== "verified" && "border-warning/40 text-warning",
                      )}
                      data-testid="you-lab-promotion-evidence-option"
                      data-you-lab-promotion-evidence={entry.manifest.id}
                      data-you-lab-promotion-evidence-verified={
                        entry.verification === "verified" ? "true" : "false"
                      }
                      aria-pressed={selected}
                      onClick={() =>
                        binding.store.getState().setPromotionEvidence(entry.manifest.id)
                      }
                    >
                      {entry.manifest.id} ·{" "}
                      {formatMessage({ id: `you.lab.evidence.verification.${entry.verification}` })}
                    </Button>
                  );
                })
              )}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || !gate.allowed}
              data-testid="you-lab-promotion-decide"
              data-you-lab-promotion-decide-gate={gate.reason}
              onClick={() =>
                void withBusy(() =>
                  binding.controller.decidePromotion({
                    experimentId: selectedExperimentId ?? "",
                    candidateArm: promotionDraft.candidateArm ?? "searched",
                    evidenceManifestRef: promotionDraft.evidenceManifestId ?? "",
                  }),
                )
              }
            >
              {formatMessage({ id: "you.lab.promotion.decide" })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || livePromotion === null}
              data-testid="you-lab-promotion-reverse"
              onClick={() =>
                void withBusy(() =>
                  binding.controller.reversePromotion({
                    promotionId: livePromotion?.id ?? "",
                  }),
                )
              }
            >
              {formatMessage({ id: "you.lab.promotion.reverse" })}
            </Button>
            {livePromotion === null ? (
              <span className="text-ui-xs text-foreground-subtle">
                {formatMessage({ id: "you.lab.promotion.reverseDisabled" })}
              </span>
            ) : (
              <span className="font-mono text-ui-xs text-foreground-subtle">
                {formatMessage({ id: "you.lab.promotion.reverseCaption" })}
              </span>
            )}
          </div>
        </>
      )}

      <section aria-label={formatMessage({ id: "you.lab.promotion.ledger.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.lab.promotion.ledger.title" })}
        </h4>
        <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.lab.promotion.ledger.caption" })}
        </p>
        {promotionRows.length === 0 ? (
          <p className="mt-1 text-ui-xs text-foreground-subtle" data-testid="you-lab-promotion-ledger-empty">
            {formatMessage({ id: "you.lab.promotion.ledger.empty" })}
          </p>
        ) : (
          <ol className="mt-1.5 flex flex-col gap-1.5" data-testid="you-lab-promotion-ledger">
            {promotionRows.map((row) => (
              <li
                key={row.promotionId}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2",
                  row.kind === "promotion"
                    ? "border-success/40 bg-success/5"
                    : "border-warning/40 bg-warning/5",
                )}
                data-testid="you-lab-promotion-row"
                data-you-lab-promotion-kind={row.kind}
                data-you-lab-promotion-id={row.promotionId}
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-ui-xs",
                      row.kind === "promotion"
                        ? "border-success/40 text-success"
                        : "border-warning/40 text-warning",
                    )}
                  >
                    {formatMessage({ id: `you.lab.promotion.ledger.kind.${row.kind}` })}
                  </Badge>
                  <span className="font-mono text-ui-xs text-foreground">{row.promotionId}</span>
                  <span className="text-ui-xs text-foreground-subtle">
                    {formatMessage({ id: "you.lab.promotion.ledger.winner" })}:{" "}
                    {formatMessage({ id: `you.lab.arm.${row.winnerArm}` })}
                  </span>
                </div>
                <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                  <span>
                    {formatMessage({ id: "you.lab.promotion.ledger.objective" })}:{" "}
                    {row.objectiveScore}
                  </span>
                  <span>
                    {formatMessage({ id: "you.lab.promotion.ledger.baseline" })}: {row.baselineScore}
                  </span>
                  <span>
                    {formatMessage({ id: "you.lab.promotion.ledger.evidence" })}:{" "}
                    {row.evidenceManifestRef}
                  </span>
                  <span>
                    {formatMessage({ id: "you.lab.promotion.ledger.decidedAt" })}: {row.decidedAt}
                  </span>
                  {row.supersedesRecordId !== null ? (
                    <span>
                      {formatMessage({ id: "you.lab.promotion.ledger.supersedes" })}:{" "}
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
    </div>
  );
}
