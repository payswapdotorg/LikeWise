// YOU Twin Studio — 确定性 operator demo 驱动器（W3B）。
//
// 覆盖 W3B 验收的 twin 检视/质量/对比/补救/重建闭环：
// version-publish（v1 候选，检视开始）-> quality-assess（确定性缺陷投影）->
// promote-first（接受 v1 → canonical）-> remediation-open（定向 EvidenceRequest：
// reason/privacy/retention 平实可见）-> consent-gate（证据绑定发布无许可 ⇒ 诚实
// typed error）-> consent-grant -> reconstruction-submit（支持矩阵校验后的 typed
// spec）-> reconstruction-run -> reconstruction-complete（诚实 not-measured effort
// 观察）-> version-from-job（v2 候选：重建产物 + 证据绑定）-> promote（v2 →
// canonical；v1 → superseded，append-only 链接）-> compare（v1 vs v2 的分数/缺陷/
// 溯源 delta）-> reconstruction-unsupported（不支持组合 ⇒
// YOU_RECONSTRUCTION_UNSUPPORTED）-> consent-withdraw（撤回阻断新绑定；已派生
// 版本保留溯源）-> quality-reassess（确定性重投影，已发布版本不变）。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed error
// 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import { TwinStudioError, type TwinStudioController } from "./twinController.js";
import type { TwinPanelId } from "./twinStudioStore.js";

export type TwinDemoStepId =
  | "version-publish"
  | "quality-assess"
  | "promote-first"
  | "remediation-open"
  | "consent-gate"
  | "consent-grant"
  | "reconstruction-submit"
  | "reconstruction-run"
  | "reconstruction-complete"
  | "version-from-job"
  | "promote"
  | "compare"
  | "reconstruction-unsupported"
  | "consent-withdraw"
  | "quality-reassess";

export interface TwinDemoStep {
  readonly id: TwinDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: TwinDemoStepId): TwinDemoStep {
  return {
    id,
    titleMessageId: `you.twin.demo.step.${id}.title`,
    descriptionMessageId: `you.twin.demo.step.${id}.description`,
  };
}

export const TWIN_DEMO_STEPS: readonly TwinDemoStep[] = [
  step("version-publish"),
  step("quality-assess"),
  step("promote-first"),
  step("remediation-open"),
  step("consent-gate"),
  step("consent-grant"),
  step("reconstruction-submit"),
  step("reconstruction-run"),
  step("reconstruction-complete"),
  step("version-from-job"),
  step("promote"),
  step("compare"),
  step("reconstruction-unsupported"),
  step("consent-withdraw"),
  step("quality-reassess"),
];

/** 步骤对视图状态的提示（由 useTwinStudio 应用；驱动器不直接写 store）。 */
export interface TwinDemoUiHint {
  readonly panel?: TwinPanelId;
  readonly selectedVersionId?: string | null;
  readonly compareBaseVersionId?: string | null;
  readonly compareTargetVersionId?: string | null;
  readonly compareMode?: "side-by-side" | "delta";
}

export interface TwinDemoStepOutcome {
  readonly stepId: TwinDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（版本 / 请求 / 作业等）。 */
  readonly refs: readonly string[];
  readonly uiHint: TwinDemoUiHint;
}

function outcome(
  stepId: TwinDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: TwinDemoUiHint = {},
): TwinDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<TwinStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof TwinStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("demo: expected a typed TwinStudioError, but the operation succeeded");
}

/**
 * 执行一步剧本。控制器必须已 load（version-publish 步骤负责 load）。
 * 每步只做确定性操作；非法状态会抛出端口级 typed error（非预期错误直接上抛）。
 */
export async function runTwinDemoStep(
  controller: TwinStudioController,
  step: TwinDemoStep,
): Promise<TwinDemoStepOutcome> {
  switch (step.id) {
    case "version-publish": {
      // 首步负责加载（与 W1B/W2B demo 首步同款职责）。
      await controller.load({ workspaceKey: "you-w3b-twin-demo" });
      const version = await controller.publishFixtureVersion({});
      return outcome(
        "version-publish",
        `Candidate TwinVersion ${version.id} published (version ${version.version}; ${version.domainBlocks.length} domain blocks, ${version.evidenceBindings.length} evidence bindings — provenance-missing is honest here). Blocks are typed, content-addressed, simulated.`,
        [version.id],
        { panel: "versions", selectedVersionId: version.id },
      );
    }
    case "quality-assess": {
      const snapshot = await controller.refresh();
      const version = snapshot.versions.at(-1);
      if (!version) throw new Error("demo: twin version missing");
      await controller.assessQuality({ versionId: version.id });
      const scores = Object.entries(version.quality.domainScores)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([domain, score]) => `${domain}=${score}`)
        .join(", ");
      return outcome(
        "quality-assess",
        `Deterministic quality projection journaled: ${scores}. Deficiencies: ${version.quality.deficiencies.length} (class/severity/remediation visible in the quality map).`,
        [version.id],
        { panel: "quality", selectedVersionId: version.id },
      );
    }
    case "promote-first": {
      const snapshot = await controller.refresh();
      const version = snapshot.versions.at(-1);
      if (!version) throw new Error("demo: twin version missing");
      if (version.status !== "candidate") {
        throw new Error(`demo: expected a candidate version, found ${version.status}`);
      }
      const promoted = await controller.promoteVersion({ versionId: version.id });
      return outcome(
        "promote-first",
        `Acceptance promotes TwinVersion ${promoted.id} to canonical (version ${promoted.version}); there is no previous canonical to supersede yet.`,
        [promoted.id],
        { panel: "versions", selectedVersionId: promoted.id },
      );
    }
    case "remediation-open": {
      const snapshot = await controller.refresh();
      const version = snapshot.versions.at(-1);
      if (!version) throw new Error("demo: twin version missing");
      const deficiency = version.quality.deficiencies.find(
        (candidate) => candidate.deficiencyClass === "geometric-error",
      ) ?? version.quality.deficiencies[0];
      if (!deficiency) throw new Error("demo: twin deficiency missing");
      const request = await controller.openRemediation({
        versionId: version.id,
        deficiencyId: deficiency.id,
      });
      return outcome(
        "remediation-open",
        `Targeted EvidenceRequest ${request.id} opened (deficiency ${request.targetDeficiency}). Reason, privacy requirements and retention are rendered verbatim; the flow links into Capture.`,
        [request.id, deficiency.id],
        { panel: "remediation", selectedVersionId: version.id },
      );
    }
    case "consent-gate": {
      const snapshot = await controller.refresh();
      const version = snapshot.versions.at(-1);
      if (!version) throw new Error("demo: twin version missing");
      // 预期中的 typed error：无许可 ⇒ 不处理（服务端强制，非 UI 禁用）。
      const error = await expectTypedError(() =>
        controller.publishFixtureVersion({ evidenceBound: true }),
      );
      return outcome(
        "consent-gate",
        `${error.youError.code}: ${error.youError.message} — no permission means no processing.`,
        [version.id],
        { panel: "remediation" },
      );
    }
    case "consent-grant": {
      const snapshot = await controller.refresh();
      const policy = snapshot.consent.policy;
      for (const purpose of policy.purposes) {
        await controller.decideConsent({
          policyId: policy.id,
          purpose,
          decision: "grant",
        });
      }
      return outcome(
        "consent-grant",
        `Operational consent granted per purpose (${policy.purposes.join(", ")}). Evidence-bound publication is possible only from this point.`,
        [policy.id],
        { panel: "remediation" },
      );
    }
    case "reconstruction-submit": {
      const snapshot = await controller.refresh();
      const version = snapshot.versions.at(-1);
      if (!version) throw new Error("demo: twin version missing");
      const spec = await controller.submitReconstructionJob({
        method: "hybrid",
        targetDomains: ["geometry-skeleton", "appearance-materials", "hair"],
        evidenceBound: true,
      });
      return outcome(
        "reconstruction-submit",
        `ReconstructionJobSpec ${spec.id} submitted (method ${spec.method}; target domains ${spec.targetDomains.join(", ")}; ${spec.evidenceBindings.length} evidence bindings). Status: queued.`,
        [spec.id, version.id],
        { panel: "reconstruction" },
      );
    }
    case "reconstruction-run": {
      const snapshot = await controller.refresh();
      const job = snapshot.jobs.at(-1);
      if (!job) throw new Error("demo: reconstruction job missing");
      await controller.startReconstructionJob({ jobId: job.spec.id });
      return outcome(
        "reconstruction-run",
        `Reconstruction job ${job.spec.id} is running (queued -> running; provider-neutral, method-plural — no method is canonical).`,
        [job.spec.id],
        { panel: "reconstruction" },
      );
    }
    case "reconstruction-complete": {
      const snapshot = await controller.refresh();
      const job = snapshot.jobs.at(-1);
      if (!job) throw new Error("demo: reconstruction job missing");
      const result = await controller.completeReconstructionJob({ jobId: job.spec.id });
      return outcome(
        "reconstruction-complete",
        `Reconstruction job ${result.jobId} completed: ${result.producedDomainBlocks.length} domain blocks. Effort/latency/cost carry explicit not-measured markers — never invented numbers. Result stays simulated.`,
        [result.jobId],
        { panel: "reconstruction" },
      );
    }
    case "version-from-job": {
      const snapshot = await controller.refresh();
      const job = snapshot.jobs.at(-1);
      if (!job || job.result === null) throw new Error("demo: completed reconstruction job missing");
      const version = await controller.publishVersionFromJob({ jobId: job.spec.id });
      return outcome(
        "version-from-job",
        `Candidate TwinVersion ${version.id} published from job output (version ${version.version}; ${version.evidenceBindings.length} evidence bindings — provenance now carries the job lineage).`,
        [version.id, job.spec.id],
        { panel: "versions", selectedVersionId: version.id },
      );
    }
    case "promote": {
      const snapshot = await controller.refresh();
      const version = snapshot.versions.at(-1);
      if (!version) throw new Error("demo: twin version missing");
      const promoted = await controller.promoteVersion({ versionId: version.id });
      const after = await controller.refresh();
      const supersededId = Object.entries(after.supersededBy).find(
        ([, by]) => by === promoted.id,
      )?.[0];
      return outcome(
        "promote",
        `TwinVersion ${promoted.id} promoted to canonical (version ${promoted.version})${supersededId ? `; the previous canonical ${supersededId} is superseded through append-only linkage` : ""}. Version numbers stay monotonic; content is never rewritten.`,
        [promoted.id, supersededId ?? ""],
        { panel: "versions", selectedVersionId: promoted.id },
      );
    }
    case "compare": {
      const snapshot = await controller.refresh();
      const base = snapshot.versions[0];
      const target = snapshot.versions.at(-1);
      if (!base || !target) throw new Error("demo: twin versions missing");
      return outcome(
        "compare",
        `Compare v${base.version} vs v${target.version}: domain-score deltas, deficiency resolution and provenance lineage are projected side-by-side and as an honest delta.`,
        [base.id, target.id],
        {
          panel: "compare",
          compareBaseVersionId: base.id,
          compareTargetVersionId: target.id,
          compareMode: "delta",
        },
      );
    }
    case "reconstruction-unsupported": {
      // 预期中的 typed error：支持矩阵拒绝（绝不静默回退到别的方法）。
      const error = await expectTypedError(() =>
        controller.submitReconstructionJob({
          method: "explicit-geometry",
          targetDomains: ["voice"],
        }),
      );
      return outcome(
        "reconstruction-unsupported",
        `${error.youError.code}: ${error.youError.message} — no silent fallback to another method.`,
        [],
        { panel: "reconstruction" },
      );
    }
    case "consent-withdraw": {
      const snapshot = await controller.refresh();
      const policy = snapshot.consent.policy;
      await controller.withdrawConsent({ policyId: policy.id });
      const error = await expectTypedError(() =>
        controller.publishFixtureVersion({ evidenceBound: true }),
      );
      return outcome(
        "consent-withdraw",
        `Consent withdrawn (${policy.id}): ${error.youError.code} on the next evidence-bound publication — future processing is blocked; already-derived immutable versions keep their provenance.`,
        [policy.id],
        { panel: "remediation" },
      );
    }
    case "quality-reassess": {
      const snapshot = await controller.refresh();
      const canonical = snapshot.versions.find(
        (version) => version.id === snapshot.canonicalVersionId,
      );
      if (!canonical) throw new Error("demo: canonical twin version missing");
      const after = await controller.assessQuality({ versionId: canonical.id });
      const reassessed = after.versions.find((version) => version.id === canonical.id);
      if (!reassessed) throw new Error("demo: reassessed twin version missing");
      return outcome(
        "quality-reassess",
        `Deterministic re-projection of ${canonical.id}: ${reassessed.quality.deficiencies.length} deficiency(ies), ${Object.keys(reassessed.quality.domainScores).length} scored domains. The published version never changes — quality is a projection.`,
        [canonical.id],
        { panel: "quality", selectedVersionId: canonical.id },
      );
    }
  }
}

/** 步骤总数（驱动器与 UI 共享）。 */
export const TWIN_DEMO_TOTAL_STEPS = TWIN_DEMO_STEPS.length;
