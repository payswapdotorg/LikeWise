/* oxlint-disable eslint(max-lines) -- demo 驱动器是单 switch 的 golden 序列状态机（31 步 × 每步确定性 summary 即 golden 期望——拆分只会让 golden 序列跨模块碎片化、增加 T9 换绑时的对照成本）；T9 换绑 Worker A 的 lab 服务后本文件整体退役。 */
// YOU Lab Studio — 确定性 operator demo 驱动器（W9B）。
//
// 覆盖 W9B 验收的完整 W9 箭头（W9A fixture 场景的 UI 侧镜像）：世界/预算 intake
// typed 拒绝（YOU_LAB_WORLD_INVALID / YOU_SEARCH_LADDER_INVALID）→ 实验声明
//（三臂法则）→ run 阶梯（baseline 成功 / hand-designed 失败+重试 / searched 搜索
// 阶梯步）→ evidence manifest 发布（未校验晋升拒绝 → 校验）→ promotion gate
//（非 searched winner 拒绝 → 晋升 → already-decided 拒绝 → reversal 新记录）→
// 污染 manifest 与 hash-mismatch/未知 manifest 拒绝
//（YOU_LAB_EVIDENCE_MANIFEST_INVALID）→ 落败实验（三臂扫 + no-improvement 拒绝）→
// 持平实验（紧预算 + ties 拒绝）→ 搜索预算耗尽（recorded terminal）→ run 退役 →
// 未知 run/实验拒绝（YOU_LAB_RUN_NOT_FOUND / YOU_LAB_EXPERIMENT_NOT_FOUND）→
// 终态锁定拒绝。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed
// error 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import {
  LabStudioError,
  type LabStudioController,
  type LabStudioSnapshot,
} from "./labController.js";
import type { LabDemoStep, LabDemoStepId } from "./labStudioDemoSteps.js";
export {
  LAB_DEMO_STEPS,
  LAB_DEMO_TOTAL_STEPS,
  type LabDemoStep,
  type LabDemoStepId,
} from "./labStudioDemoSteps.js";
import type { LabPanelId } from "./labStudioStore.js";
import type { LabExperiment, LabRun } from "@zcode/shared";
import { storyboardExperimentSpecById } from "./labStoryboard.js";

/** 步骤对视图状态的提示（由 useLabStudio 应用；驱动器不直接写 store）。 */
export interface LabDemoUiHint {
  readonly panel?: LabPanelId;
  readonly selectedExperimentId?: string | null;
  readonly selectedRunId?: string | null;
  readonly selectedManifestId?: string | null;
}

export interface LabDemoStepOutcome {
  readonly stepId: LabDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（实验 / run / manifest / promotion 等）。 */
  readonly refs: readonly string[];
  readonly uiHint: LabDemoUiHint;
}

function outcome(
  stepId: LabDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: LabDemoUiHint = {},
): LabDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<LabStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof LabStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("demo: expected a typed LabStudioError, but the operation succeeded");
}

/** 规格 → 已落账实验（constraintsHash 唯一定位；确定性）。 */
function experimentOfSpec(
  snapshot: LabStudioSnapshot,
  specId: string,
): LabExperiment {
  const spec = storyboardExperimentSpecById(specId);
  if (!spec) throw new Error(`demo: spec ${specId} missing`);
  const experiment = snapshot.experiments.find(
    (candidate) => candidate.constraintsHash === spec.constraintsHash,
  );
  if (!experiment) throw new Error(`demo: experiment of spec ${specId} missing`);
  return experiment;
}

/** 实验 + 臂 → 最新 run（追加序末位）。 */
function latestRunOfArm(
  snapshot: LabStudioSnapshot,
  experimentId: string,
  arm: LabRun["arm"],
): LabRun | null {
  const runs = snapshot.runs.filter(
    (run) => run.experimentId === experimentId && run.arm === arm,
  );
  return runs.at(-1) ?? null;
}

/** 实验 + 臂 → 最新 succeeded run。 */
function latestSucceededRunOfArm(
  snapshot: LabStudioSnapshot,
  experimentId: string,
  arm: LabRun["arm"],
): LabRun | null {
  const runs = snapshot.runs.filter(
    (run) => run.experimentId === experimentId && run.arm === arm && run.status === "succeeded",
  );
  return runs.at(-1) ?? null;
}

/** 快照检视面（refresh + 决不容忍未加载态——demo 剧本的 load 步骤负责加载）。 */
async function view(controller: LabStudioController) {
  const snapshot = await controller.refresh();
  if (!snapshot) throw new Error("demo: lab plane is not loaded");
  return snapshot;
}

/** 单臂三步走（submit -> start -> 终态）——sweep 步骤的确定性子程序。 */
async function runArmToTerminal(
  controller: LabStudioController,
  experimentId: string,
  arm: LabRun["arm"],
  terminal: "succeeded" | "failed",
): Promise<LabRun> {
  const submitted = await controller.submitLabRun({ experimentId, arm });
  const started = await controller.startLabRun({ runId: submitted.id });
  return controller.completeLabRun({ runId: started.id, outcome: terminal });
}

/**
 * 执行一步剧本。控制器必须已 load（load 步骤负责加载）。
 * 每步只做确定性操作；非法状态会抛出端口级 typed error（非预期错误直接上抛）。
 */
export async function runLabDemoStep(
  controller: LabStudioController,
  demoStep: LabDemoStep,
): Promise<LabDemoStepOutcome> {
  switch (demoStep.id) {
    case "load": {
      const snapshot = await controller.load({ workspaceKey: "you-w9b-lab-demo" });
      return outcome(
        "load",
        `Lab plane loaded (${snapshot.studioId}, ${snapshot.armKinds.length} frozen arms ${snapshot.armKinds.join(" / ")}, ${snapshot.runStatuses.length} run statuses, ${snapshot.experimentSpecs.length} experiment specs, ${snapshot.worldPresets.length} world presets, ${snapshot.budgetPresets.length} budget presets). The experiment declaration, run ladder, evidence manifests and promotion gate all render from these controller projections — zero business logic in the UI.`,
        [snapshot.studioId],
        { panel: "experiments" },
      );
    }
    case "world-invalid": {
      // 预期中的 typed error：空 seed 世界 ⇒ YOU_LAB_WORLD_INVALID。
      const error = await expectTypedError(() =>
        controller.declareExperiment({
          specId: "fx-labspec-001",
          worldPresetId: "world-empty-seed",
          budgetPresetId: "budget-standard",
        }),
      );
      return outcome(
        "world-invalid",
        `${error.youError.code}: ${error.youError.message} — the LAB DETERMINISM LAW: lab worlds are seed-deterministic (same seed, byte-identical world); an empty-seed or out-of-range actor descriptor is a typed refusal, never a silently repaired world.`,
        [],
        { panel: "experiments" },
      );
    }
    case "budget-invalid": {
      // 预期中的 typed error：零预算 ⇒ YOU_SEARCH_LADDER_INVALID。
      const error = await expectTypedError(() =>
        controller.declareExperiment({
          specId: "fx-labspec-001",
          worldPresetId: "world-alpha",
          budgetPresetId: "budget-zero",
        }),
      );
      return outcome(
        "budget-invalid",
        `${error.youError.code}: ${error.youError.message} — the SEARCH BUDGET LAW: the search/RL ladder explores under an explicit cumulative budget (integer >= 1); a zero/implicit budget is refused at declaration intake, never defaulted.`,
        [],
        { panel: "experiments" },
      );
    }
    case "experiment-declare": {
      const experiment = await controller.declareExperiment({
        specId: "fx-labspec-001",
        worldPresetId: "world-alpha",
        budgetPresetId: "budget-standard",
      });
      return outcome(
        "experiment-declare",
        `LabExperiment ${experiment.id} declared: intent ${experiment.intentRef}, objective "${experiment.objective}", constraints ${experiment.constraintsHash}, arms ${experiment.arms.join(" / ")} (the LAB.md three-arm comparison law). The declaration context records world-alpha (seed you-w9b-world-alpha, 4 actors — content-addressed ground-truth label) and cumulative search budget 6. Honest disclosure: the frozen v9 event vocabulary carries no lab-experiment-declared type, so the declaration is a durable record without a journaled event (runs, evidence and promotions carry the events).`,
        [experiment.id],
        { panel: "experiments", selectedExperimentId: experiment.id },
      );
    }
    case "run-submit-baseline": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const run = await controller.submitLabRun({
        experimentId: experiment.id,
        arm: "generalist-baseline",
      });
      return outcome(
        "run-submit-baseline",
        `LabRun ${run.id} submitted on the generalist-baseline arm of ${experiment.id} (plan hash ${run.planHash} — content-addressed, deterministic). The append-only run ladder opens at "submitted" and lab-run-recorded is journaled with statusBefore/statusAfter submitted.`,
        [run.id],
        { panel: "runs", selectedExperimentId: experiment.id, selectedRunId: run.id },
      );
    }
    case "run-start-baseline": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const run = latestRunOfArm(snapshot, experiment.id, "generalist-baseline")!;
      const started = await controller.startLabRun({ runId: run.id });
      return outcome(
        "run-start-baseline",
        `LabRun ${started.id} moved submitted -> running (lab-run-recorded journaled). The generalist baseline organization now executes inside the deterministic world.`,
        [started.id],
        { panel: "runs", selectedExperimentId: experiment.id, selectedRunId: started.id },
      );
    }
    case "run-succeed-baseline": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const run = latestRunOfArm(snapshot, experiment.id, "generalist-baseline")!;
      const succeeded = await controller.completeLabRun({
        runId: run.id,
        outcome: "succeeded",
      });
      return outcome(
        "run-succeed-baseline",
        `LabRun ${succeeded.id} reached the "succeeded" terminal at ${succeeded.completedAt} — terminals are locked. The baseline benchmark score 0.62 now shows in the three-arm comparison projection (derived, never authoritative).`,
        [succeeded.id],
        { panel: "runs", selectedExperimentId: experiment.id, selectedRunId: succeeded.id },
      );
    }
    case "run-fail-handdesigned": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const failed = await runArmToTerminal(
        controller,
        experiment.id,
        "hand-designed",
        "failed",
      );
      return outcome(
        "run-fail-handdesigned",
        `LabRun ${failed.id} (hand-designed arm) walked submitted -> running -> failed — the honest failure path: a locked terminal on the append-only ladder. Retrying appends a NEW run, never a reset.`,
        [failed.id],
        { panel: "runs", selectedExperimentId: experiment.id, selectedRunId: failed.id },
      );
    }
    case "run-retry-handdesigned": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const succeeded = await runArmToTerminal(
        controller,
        experiment.id,
        "hand-designed",
        "succeeded",
      );
      return outcome(
        "run-retry-handdesigned",
        `LabRun ${succeeded.id} appended as the hand-designed arm's second attempt and succeeded — the run ladder stays append-only, every attempt addressable; the hand-designed score 0.71 joins the three-arm comparison.`,
        [succeeded.id],
        { panel: "runs", selectedExperimentId: experiment.id, selectedRunId: succeeded.id },
      );
    }
    case "run-submit-searched": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const run = await controller.submitLabRun({
        experimentId: experiment.id,
        arm: "searched",
      });
      return outcome(
        "run-submit-searched",
        `LabRun ${run.id} submitted on the searched arm — submitting a searched run appends SearchLadderStep 1 (strategy beam-search, 1 explored node, cumulativeBudget 6) BEFORE any result exists: the SEARCH BUDGET LAW made visible. The searched candidate organization compiles from intent -> roles -> bodies -> souls -> tools -> execution order (the lab optimizes organizations, not single models).`,
        [run.id],
        { panel: "runs", selectedExperimentId: experiment.id, selectedRunId: run.id },
      );
    }
    case "run-start-searched": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const run = latestRunOfArm(snapshot, experiment.id, "searched")!;
      const started = await controller.startLabRun({ runId: run.id });
      return outcome(
        "run-start-searched",
        `LabRun ${started.id} moved submitted -> running — the searched organization executes inside the seed-deterministic world (same seed, byte-identical replay; LAB DETERMINISM LAW).`,
        [started.id],
        { panel: "runs", selectedExperimentId: experiment.id, selectedRunId: started.id },
      );
    }
    case "run-succeed-searched": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const run = latestRunOfArm(snapshot, experiment.id, "searched")!;
      const succeeded = await controller.completeLabRun({
        runId: run.id,
        outcome: "succeeded",
      });
      return outcome(
        "run-succeed-searched",
        `LabRun ${succeeded.id} succeeded — the searched benchmark score 0.78 lands ABOVE the baseline 0.62: the three-arm comparison verdict turns to "beats" (strict inequality; the promotion gate will evaluate independently).`,
        [succeeded.id],
        { panel: "experiments", selectedExperimentId: experiment.id, selectedRunId: succeeded.id },
      );
    }
    case "evidence-publish": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const searched = latestSucceededRunOfArm(snapshot, experiment.id, "searched")!;
      const published = await controller.publishEvidenceManifest({
        runId: searched.id,
        integrity: "honest",
      });
      return outcome(
        "evidence-publish",
        `LabEvidenceManifest ${published.manifest.id} published for run ${searched.id}: contentHash ${published.manifest.contentHash} over ${published.manifest.artifactRefs.length} content-addressed artifact refs (${published.manifest.artifactRefs[0]} …). Content-addressed bundles make runs replayable and auditable without trusting the storage layer; verification starts "unverified" and lab-evidence-published is journaled.`,
        [published.manifest.id],
        { panel: "evidence", selectedExperimentId: experiment.id, selectedManifestId: published.manifest.id },
      );
    }
    case "promotion-unverified": {
      // 预期中的 typed error：未校验证据 ⇒ YOU_LAB_PROMOTION_INVALID。
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const searched = latestSucceededRunOfArm(snapshot, experiment.id, "searched")!;
      const manifest = snapshot.manifests.find(
        (entry) => entry.manifest.runId === searched.id,
      )!;
      const error = await expectTypedError(() =>
        controller.decidePromotion({
          experimentId: experiment.id,
          candidateArm: "searched",
          evidenceManifestRef: manifest.manifest.id,
        }),
      );
      return outcome(
        "promotion-unverified",
        `${error.youError.code}: ${error.youError.message} — the promotion gate demands VERIFIED evidence: promotion decisions cite an evidence manifest that passed hash verification (fail closed, gate evaluation order fixed).`,
        [manifest.manifest.id],
        { panel: "promotion", selectedExperimentId: experiment.id, selectedManifestId: manifest.manifest.id },
      );
    }
    case "manifest-verify": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const searched = latestSucceededRunOfArm(snapshot, experiment.id, "searched")!;
      const manifest = snapshot.manifests.find(
        (entry) => entry.manifest.runId === searched.id,
      )!;
      const verified = await controller.verifyEvidenceManifest({
        manifestId: manifest.manifest.id,
      });
      return outcome(
        "manifest-verify",
        `Manifest ${verified.manifest.id} verified: the recomputed content hash (${verified.manifest.artifactRefs.length} artifact refs folded over run ${verified.manifest.runId}) matches the recorded ${verified.manifest.contentHash} — verification status "verified" at ${verified.verifiedAt}. Hash mismatches fail closed with a typed refusal.`,
        [verified.manifest.id],
        { panel: "evidence", selectedExperimentId: experiment.id, selectedManifestId: verified.manifest.id },
      );
    }
    case "promotion-baseline-winner": {
      // 预期中的 typed error：非 searched winner ⇒ YOU_LAB_PROMOTION_INVALID。
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const searched = latestSucceededRunOfArm(snapshot, experiment.id, "searched")!;
      const manifest = snapshot.manifests.find(
        (entry) => entry.manifest.runId === searched.id,
      )!;
      const error = await expectTypedError(() =>
        controller.decidePromotion({
          experimentId: experiment.id,
          candidateArm: "generalist-baseline",
          evidenceManifestRef: manifest.manifest.id,
        }),
      );
      return outcome(
        "promotion-baseline-winner",
        `${error.youError.code}: ${error.youError.message} — only a SEARCHED arm may ever promote (the LAB PROMOTION LAW): the baseline and hand-designed arms exist to be compared against, not promoted.`,
        [],
        { panel: "promotion", selectedExperimentId: experiment.id },
      );
    }
    case "promotion-decide": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const searched = latestSucceededRunOfArm(snapshot, experiment.id, "searched")!;
      const manifest = snapshot.manifests.find(
        (entry) => entry.manifest.runId === searched.id,
      )!;
      const decided = await controller.decidePromotion({
        experimentId: experiment.id,
        candidateArm: "searched",
        evidenceManifestRef: manifest.manifest.id,
      });
      return outcome(
        "promotion-decide",
        `LabPromotionRecord ${decided.record.id} decided: winner ${decided.record.winnerArm}, objective ${decided.record.objectiveScore} vs baseline ${decided.record.baselineScore} (0.78 > 0.62 — beats the baseline under the recorded objective and constraints), evidence ${decided.record.evidenceManifestRef}. The immutable record lands on the append-only ledger, the experiment's promotionRef is immutably replaced, and lab-promotion-decided is journaled.`,
        [decided.record.id],
        { panel: "promotion", selectedExperimentId: experiment.id },
      );
    }
    case "promotion-already-decided": {
      // 预期中的 typed error：已有 live 决定 ⇒ YOU_LAB_PROMOTION_INVALID。
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const searched = latestSucceededRunOfArm(snapshot, experiment.id, "searched")!;
      const manifest = snapshot.manifests.find(
        (entry) => entry.manifest.runId === searched.id,
      )!;
      const error = await expectTypedError(() =>
        controller.decidePromotion({
          experimentId: experiment.id,
          candidateArm: "searched",
          evidenceManifestRef: manifest.manifest.id,
        }),
      );
      return outcome(
        "promotion-already-decided",
        `${error.youError.code}: ${error.youError.message} — a live promotion blocks re-deciding: a change of mind must append a reversal record (a new immutable record), never an in-place mutation.`,
        [],
        { panel: "promotion", selectedExperimentId: experiment.id },
      );
    }
    case "promotion-reversal": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const live = snapshot.promotionLedger.find(
        (entry) =>
          entry.kind === "promotion" && entry.record.experimentId === experiment.id,
      )!;
      const reversed = await controller.reversePromotion({
        promotionId: live.record.id,
      });
      return outcome(
        "promotion-reversal",
        `Reversal ${reversed.record.id} appended (kind reversal, supersedes ${reversed.supersedesRecordId}) — the experiment's promotionRef immutably replaced to the reversal record; journaled as lab-promotion-decided with the reversal marker. Promotion records are immutable: a reversal is a NEW record, never a mutation (the LAB PROMOTION LAW).`,
        [reversed.record.id, reversed.supersedesRecordId ?? ""],
        { panel: "promotion", selectedExperimentId: experiment.id },
      );
    }
    case "manifest-tampered": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const baseline = latestSucceededRunOfArm(
        snapshot,
        experiment.id,
        "generalist-baseline",
      )!;
      const published = await controller.publishEvidenceManifest({
        runId: baseline.id,
        integrity: "tampered",
      });
      return outcome(
        "manifest-tampered",
        `Manifest ${published.manifest.id} published with the tampered integrity preset on run ${baseline.id}: a legal, honestly-labeled record carrying a deliberately wrong contentHash (${published.manifest.contentHash}). Publishing never refuses it — the fail-closed verification gate is the honest path that catches it.`,
        [published.manifest.id],
        { panel: "evidence", selectedExperimentId: experiment.id, selectedManifestId: published.manifest.id },
      );
    }
    case "manifest-mismatch": {
      // 预期中的 typed error ×2：污染 manifest hash mismatch + 未知 manifest id。
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const baseline = latestSucceededRunOfArm(
        snapshot,
        experiment.id,
        "generalist-baseline",
      )!;
      const tampered = snapshot.manifests.find(
        (entry) => entry.manifest.runId === baseline.id,
      )!;
      const mismatchError = await expectTypedError(() =>
        controller.verifyEvidenceManifest({ manifestId: tampered.manifest.id }),
      );
      const unknownError = await expectTypedError(() =>
        controller.verifyEvidenceManifest({ manifestId: "fx-manifest-999" }),
      );
      const mismatchSnapshot = await view(controller);
      const mismatchStatus = mismatchSnapshot.manifests.find(
        (entry) => entry.manifest.id === tampered.manifest.id,
      )!.verification;
      return outcome(
        "manifest-mismatch",
        `${mismatchError.youError.code}: ${mismatchError.youError.message} — the manifest's recorded contentHash fails against the recomputed artifact hash; the mismatch is RECORDED as a verification observation (status "${mismatchStatus}") while the manifest record stays immutable. And ${unknownError.youError.code}: ${unknownError.youError.message} — unknown manifest ids are the same typed refusal, never a guess.`,
        [tampered.manifest.id],
        { panel: "evidence", selectedExperimentId: experiment.id, selectedManifestId: tampered.manifest.id },
      );
    }
    case "experiment-declare-losing": {
      const experiment = await controller.declareExperiment({
        specId: "fx-labspec-002",
        worldPresetId: "world-beta",
        budgetPresetId: "budget-standard",
      });
      return outcome(
        "experiment-declare-losing",
        `LabExperiment ${experiment.id} declared from spec 002 (objective "${experiment.objective}") in world-beta (seed you-w9b-world-beta, 12 actors) — the honest losing arm: the searched organization scores 0.74 against the baseline's 0.80.`,
        [experiment.id],
        { panel: "experiments", selectedExperimentId: experiment.id },
      );
    }
    case "losing-sweep": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-002");
      const refs: string[] = [];
      for (const arm of ["generalist-baseline", "hand-designed", "searched"] as const) {
        const run = await runArmToTerminal(controller, experiment.id, arm, "succeeded");
        refs.push(run.id);
      }
      const searched = latestSucceededRunOfArm(
        await view(controller),
        experiment.id,
        "searched",
      )!;
      const published = await controller.publishEvidenceManifest({
        runId: searched.id,
        integrity: "honest",
      });
      await controller.verifyEvidenceManifest({ manifestId: published.manifest.id });
      refs.push(published.manifest.id);
      return outcome(
        "losing-sweep",
        `Three arms swept to succeeded on ${experiment.id} (runs ${refs.slice(0, 3).join(", ")}); the searched run's manifest ${published.manifest.id} published AND verified. The three-arm comparison projection reads baseline 0.80 / hand-designed 0.75 / searched 0.74 — verdict "loses".`,
        refs,
        { panel: "experiments", selectedExperimentId: experiment.id, selectedManifestId: published.manifest.id },
      );
    }
    case "promotion-losing": {
      // 预期中的 typed error：searched 未胜过 baseline ⇒ YOU_LAB_PROMOTION_INVALID。
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-002");
      const searched = latestSucceededRunOfArm(snapshot, experiment.id, "searched")!;
      const manifest = snapshot.manifests.find(
        (entry) => entry.manifest.runId === searched.id,
      )!;
      const error = await expectTypedError(() =>
        controller.decidePromotion({
          experimentId: experiment.id,
          candidateArm: "searched",
          evidenceManifestRef: manifest.manifest.id,
        }),
      );
      return outcome(
        "promotion-losing",
        `${error.youError.code}: ${error.youError.message} — the LAB PROMOTION LAW core: a searched organization promotes ONLY when it beats the generalist baseline under the recorded objective and constraints. 0.74 <= 0.80 is a typed refusal, never a quiet pass.`,
        [experiment.id],
        { panel: "promotion", selectedExperimentId: experiment.id },
      );
    }
    case "experiment-declare-tie": {
      const experiment = await controller.declareExperiment({
        specId: "fx-labspec-003",
        worldPresetId: "world-alpha",
        budgetPresetId: "budget-tight",
      });
      return outcome(
        "experiment-declare-tie",
        `LabExperiment ${experiment.id} declared from spec 003 with the TIGHT budget preset (cumulativeBudget 1) in world-alpha — the searched arm scores exactly the baseline (0.66) and exploration is deliberately bounded to one step.`,
        [experiment.id],
        { panel: "experiments", selectedExperimentId: experiment.id },
      );
    }
    case "tie-sweep": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-003");
      const refs: string[] = [];
      for (const arm of ["generalist-baseline", "hand-designed", "searched"] as const) {
        const run = await runArmToTerminal(controller, experiment.id, arm, "succeeded");
        refs.push(run.id);
      }
      const searched = latestSucceededRunOfArm(
        await view(controller),
        experiment.id,
        "searched",
      )!;
      const published = await controller.publishEvidenceManifest({
        runId: searched.id,
        integrity: "honest",
      });
      await controller.verifyEvidenceManifest({ manifestId: published.manifest.id });
      refs.push(published.manifest.id);
      return outcome(
        "tie-sweep",
        `Three arms swept to succeeded on ${experiment.id} within the tight budget (searched = SearchLadderStep 1 of 1); the searched manifest ${published.manifest.id} published and verified. The comparison projection reads baseline 0.66 / hand-designed 0.72 / searched 0.66 — verdict "ties".`,
        refs,
        { panel: "experiments", selectedExperimentId: experiment.id, selectedManifestId: published.manifest.id },
      );
    }
    case "promotion-tie": {
      // 预期中的 typed error：持平 ⇒ YOU_LAB_PROMOTION_INVALID（严格不等式）。
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-003");
      const searched = latestSucceededRunOfArm(snapshot, experiment.id, "searched")!;
      const manifest = snapshot.manifests.find(
        (entry) => entry.manifest.runId === searched.id,
      )!;
      const error = await expectTypedError(() =>
        controller.decidePromotion({
          experimentId: experiment.id,
          candidateArm: "searched",
          evidenceManifestRef: manifest.manifest.id,
        }),
      );
      return outcome(
        "promotion-tie",
        `${error.youError.code}: ${error.youError.message} — the improvement must be STRICT: searched 0.66 equals baseline 0.66, and a tie never promotes (equality is not an improvement).`,
        [experiment.id],
        { panel: "promotion", selectedExperimentId: experiment.id },
      );
    }
    case "search-exhaustion": {
      // 预期中的 typed error：预算耗尽 ⇒ YOU_SEARCH_LADDER_INVALID + recorded terminal。
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-003");
      const error = await expectTypedError(() =>
        controller.submitLabRun({ experimentId: experiment.id, arm: "searched" }),
      );
      const after = await view(controller);
      const terminal = after.searchLadder
        .filter((step) => step.experimentId === experiment.id)
        .find((step) => step.strategy === "budget-exhausted");
      return outcome(
        "search-exhaustion",
        `${error.youError.code}: ${error.youError.message} — the exhaustion is RECORDED as terminal SearchLadderStep ${terminal?.step}/${terminal?.cumulativeBudget} (strategy budget-exhausted) BEFORE the refusal: budget exhaustion is a recorded terminal, never a silent stop (SEARCH BUDGET LAW). Further searched submissions refuse with the ladder already terminal.`,
        [terminal?.id ?? ""],
        { panel: "runs", selectedExperimentId: experiment.id },
      );
    }
    case "run-retire": {
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-003");
      const submitted = await controller.submitLabRun({
        experimentId: experiment.id,
        arm: "generalist-baseline",
      });
      const retired = await controller.retireLabRun({ runId: submitted.id });
      return outcome(
        "run-retire",
        `LabRun ${retired.id} retired before starting (submitted -> retired at ${retired.completedAt}) — the ladder's graceful-removal terminal for superseded runs, locked on arrival; the run record stays addressable forever.`,
        [retired.id],
        { panel: "runs", selectedExperimentId: experiment.id, selectedRunId: retired.id },
      );
    }
    case "not-found-refusals": {
      // 预期中的 typed error ×2：未知 run / 未知实验。
      const runError = await expectTypedError(() =>
        controller.startLabRun({ runId: "fx-run-999" }),
      );
      const experimentError = await expectTypedError(() =>
        controller.submitLabRun({ experimentId: "fx-experiment-999", arm: "searched" }),
      );
      return outcome(
        "not-found-refusals",
        `${runError.youError.code}: ${runError.youError.message} — and ${experimentError.youError.code}: ${experimentError.youError.message} — unknown run and experiment ids are typed refusals; records are addressed by immutable ids, never guessed.`,
        [],
        { panel: "runs" },
      );
    }
    case "terminal-refusal": {
      // 预期中的 typed error：终态 run 再迁移 ⇒ YOU_INVALID_STATE（终态锁定）。
      const snapshot = await view(controller);
      const experiment = experimentOfSpec(snapshot, "fx-labspec-001");
      const baseline = latestSucceededRunOfArm(
        snapshot,
        experiment.id,
        "generalist-baseline",
      )!;
      const error = await expectTypedError(() =>
        controller.completeLabRun({ runId: baseline.id, outcome: "failed" }),
      );
      return outcome(
        "terminal-refusal",
        `${error.youError.code}: ${error.youError.message} — run terminals are locked: the ladder submitted -> running -> succeeded | failed | retired refuses every transition out of a terminal. Honest disclosure: frozen v9 defines no lab-run-state-specific error code, so the generic invalid-state code carries the reason (run-terminal-locked).`,
        [baseline.id],
        { panel: "runs", selectedExperimentId: experiment.id, selectedRunId: baseline.id },
      );
    }
  }
}
