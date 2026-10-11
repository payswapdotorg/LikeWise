/* oxlint-disable eslint(max-lines) -- 模拟控制器按 TwinStudioController 端口逐方法实现（Phase-0 剧本状态机：不可变版本链 + 取代链接 + binding-time 同意强制 + 重建作业生命周期）；T3 换绑 Worker A 的 twin 服务后本文件整体退役，拆分只会增加退役成本。 */
// YOU Twin Studio — 确定性模拟控制器（W3B，Phase 0）。
//
// 这是 `TwinStudioController` 端口的确定性剧本实现（W3A 的 twin/reconstruction
// 服务已在并行 wave 合入；本实现只到 T3 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自 StoryboardClock；
// - TwinVersion 一律不可变（candidate → canonical → superseded 是**记录替换** +
//   append-only 取代链接，内容字节不变；版本号单调，绝不复用）；
// - 服务端式强制（UI 之外的硬门）：证据绑定无有效同意 ⇒ YOU_CONSENT_REQUIRED；
//   withdrawal 阻断新绑定与新处理（已派生的不可变版本保留溯源）；
// - 重建作业：method/domain 支持矩阵校验（不支持 ⇒ YOU_RECONSTRUCTION_UNSUPPORTED，
//   绝不静默回退到别的方法）；effort 观察带显式 not-measured 标记，绝不编造数字；
// - 事件语汇（frozen additive wave-3）：twin-version-published（payload.kind 区分
//   publication / promotion）、twin-quality-assessed、reconstruction-job-submitted /
//   reconstruction-job-completed；补救请求复用 evidence-requested（W1A 类型同语义）。
import type {
  ConsentReference,
  ConsentState,
  EvidenceRequest,
  HtirDomainBlock,
  OpaqueId,
  ReconstructionJobResult,
  ReconstructionJobSpec,
  SolutionEvent,
  SolutionEventType,
  TwinDeficiency,
  TwinEvidenceBinding,
  TwinVersion,
  YouError,
} from "@zcode/shared";
import {
  TwinStudioError,
  aggregateConsentState,
  type AssessTwinQualityInput,
  type FailReconstructionInput,
  type OpenRemediationInput,
  type PromoteTwinVersionInput,
  type PublishTwinVersionInput,
  type PublishVersionFromJobInput,
  type ReconstructionJobInput,
  type SubmitReconstructionInput,
  type TwinConsentDecisionInput,
  type TwinConsentProjection,
  type TwinStudioController,
  type TwinStudioLoadRequest,
  type TwinStudioSnapshot,
  type TwinWithdrawConsentInput,
} from "./twinController.js";
import { StoryboardClock } from "./solutionStoryboard.js";
import {
  TWIN_STORYBOARD_CONSENT_POLICY,
  TWIN_STORYBOARD_DISPLAY_NAME,
  TWIN_STORYBOARD_SOLUTION_ID,
  TWIN_STORYBOARD_TWIN_ID,
  assessStoryboardTwinQuality,
  buildStoryboardReconstructionResult,
  buildTwinStoryboardV1Blocks,
  buildTwinStoryboardV2Blocks,
  isLegalStoryboardTwinVersionTransition,
  storyboardRemediationEvidenceRequest,
  twinStoryboardDeficiencyKey,
  unsupportedStoryboardReconstructionDomains,
} from "./twinStoryboard.js";

interface SimulatedJobState {
  readonly spec: ReconstructionJobSpec;
  status: "queued" | "running" | "completed" | "failed";
  result: ReconstructionJobResult | null;
}

interface SimulatedTwinState {
  readonly twinId: OpaqueId;
  readonly displayName: string;
  versions: TwinVersion[];
  readonly supersededBy: Map<OpaqueId, OpaqueId>;
  evidenceRequests: EvidenceRequest[];
  /** deficiencyKey -> serving evidenceRequestId（append-only 注册表）。 */
  readonly remediationByDeficiencyKey: Map<string, OpaqueId>;
  readonly purposeStates: Map<string, ConsentState>;
  jobs: SimulatedJobState[];
  events: SolutionEvent[];
}

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): TwinStudioError {
  return new TwinStudioError({ code, message, details, simulated: true });
}

function invalidState(message: string): TwinStudioError {
  return youError("YOU_INVALID_STATE", message);
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 twinStudioRegistry）；
 * `load` 幂等：状态存在即复用（twin 是持久 workspace 表面）。
 */
export function createSimulatedTwinStudioController(): TwinStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let state: SimulatedTwinState | null = null;

  const nextId = (prefix: string): string => {
    idSeq += 1;
    return `${prefix}-${String(idSeq).padStart(3, "0")}`;
  };

  const appendEvent = (
    type: SolutionEventType,
    subjectRef: OpaqueId | null,
    payload: Record<string, string | number | boolean>,
    generator: "agent" | "user" | "fixture" = "agent",
  ): void => {
    if (!state) return;
    state.events = [
      ...state.events,
      {
        id: nextId("fx-twin-event"),
        solutionId: TWIN_STORYBOARD_SOLUTION_ID,
        type,
        occurredAt: clock.next(),
        subjectRef,
        payload,
        provenance: {
          source: "you-phase0-twin-storyboard",
          generator,
          createdAt: clock.next(),
          lineage: [],
        },
      },
    ];
  };

  const consentReference = (): ConsentReference => {
    const states = TWIN_STORYBOARD_CONSENT_POLICY.purposes.map(
      (purpose) => state?.purposeStates.get(purpose) ?? "unknown",
    );
    // 确定性保守聚合（withdrawn > denied > expired > unknown > granted）。
    return {
      policyId: TWIN_STORYBOARD_CONSENT_POLICY.id,
      state: aggregateConsentState(states),
      learningPermission: false,
    };
  };

  const consentProjection = (): TwinConsentProjection => ({
    policy: { ...TWIN_STORYBOARD_CONSENT_POLICY },
    purposeStates: [...TWIN_STORYBOARD_CONSENT_POLICY.purposes]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((purpose) => ({
        purpose,
        state: state?.purposeStates.get(purpose) ?? "unknown",
      })),
    reference: consentReference(),
  });

  const snapshot = (): TwinStudioSnapshot => {
    if (!state) throw invalidState("twin studio is not loaded");
    const supersededBy: Record<string, string> = {};
    for (const key of [...state.supersededBy.keys()].sort()) {
      const value = state.supersededBy.get(key);
      if (value !== undefined) {
        supersededBy[key] = value;
      }
    }
    return {
      displayName: state.displayName,
      twinId: state.twinId,
      versions: state.versions,
      canonicalVersionId:
        [...state.versions].reverse().find((version) => version.status === "canonical")?.id ?? null,
      supersededBy,
      evidenceRequests: state.evidenceRequests,
      consent: consentProjection(),
      jobs: state.jobs.map((job) => ({ spec: job.spec, status: job.status, result: job.result })),
      events: state.events,
      simulated: true,
    };
  };

  const bootstrap = (request: TwinStudioLoadRequest): void => {
    state = {
      twinId: TWIN_STORYBOARD_TWIN_ID,
      displayName: TWIN_STORYBOARD_DISPLAY_NAME,
      versions: [],
      supersededBy: new Map(),
      evidenceRequests: [],
      remediationByDeficiencyKey: new Map(),
      purposeStates: new Map(
        TWIN_STORYBOARD_CONSENT_POLICY.purposes.map((purpose) => [purpose, "unknown" as ConsentState]),
      ),
      jobs: [],
      events: [],
    };
    appendEvent("solution-created", state.twinId, {
      surface: "twin-studio",
      workspaceKey: request.workspaceKey,
      twinId: state.twinId,
    });
  };

  /** 服务端式硬门：政策内全部用途必须显式 granted（无许可 ⇒ 不处理）。 */
  const assertBindingConsent = (): void => {
    if (!state) throw invalidState("twin studio is not loaded");
    for (const purpose of TWIN_STORYBOARD_CONSENT_POLICY.purposes) {
      const consentState = state.purposeStates.get(purpose) ?? "unknown";
      if (consentState !== "granted") {
        throw youError(
          "YOU_CONSENT_REQUIRED",
          `evidence-bound publication requires consent for purpose "${purpose}" (state: ${consentState})`,
          { purpose, consentState },
        );
      }
    }
  };

  const requireVersion = (versionId: OpaqueId): TwinVersion => {
    if (!state) throw invalidState("twin studio is not loaded");
    const version = state.versions.find((candidate) => candidate.id === versionId);
    if (!version) {
      throw youError("YOU_VERSION_NOT_FOUND", `twin version ${versionId} not found`, {
        reason: "unknown-twin-version",
        versionId,
      });
    }
    return version;
  };

  const requireDeficiency = (versionId: OpaqueId, deficiencyId: OpaqueId): TwinDeficiency => {
    const version = requireVersion(versionId);
    const deficiency = version.quality.deficiencies.find((entry) => entry.id === deficiencyId);
    if (!deficiency) {
      throw invalidState(`twin deficiency ${deficiencyId} not found in version ${versionId}`);
    }
    return deficiency;
  };

  /** 质量投影（剧本模型；下一版发布时其缺陷将回填已有补救链接）。 */
  const assessQualityOf = (
    blocks: readonly HtirDomainBlock[],
    bindings: readonly TwinEvidenceBinding[],
  ) =>
    assessStoryboardTwinQuality(
      { domainBlocks: blocks, evidenceBindings: bindings },
      {
        clock,
        nextDeficiencyId: () => nextId("fx-twdef"),
        remediation: {
          resolve: (deficiencyClass, domain) =>
            state?.remediationByDeficiencyKey.get(twinStoryboardDeficiencyKey(deficiencyClass, domain)) ?? null,
        },
      },
    );

  /** 发布下一版候选（版本号单调；记录不可变；provenance 记录来源锚点）。 */
  const publishVersion = (input: {
    readonly domainBlocks: readonly HtirDomainBlock[];
    readonly evidenceBindings: readonly TwinEvidenceBinding[];
    readonly provenanceSource: string;
  }): TwinVersion => {
    if (!state) throw invalidState("twin studio is not loaded");
    const parent = state.versions[state.versions.length - 1];
    const quality = assessQualityOf(input.domainBlocks, input.evidenceBindings);
    const version: TwinVersion = {
      id: nextId("fx-twver"),
      twinId: state.twinId,
      version: (parent?.version ?? 0) + 1,
      status: "candidate",
      domainBlocks: [...input.domainBlocks],
      evidenceBindings: [...input.evidenceBindings],
      quality,
      createdAt: clock.next(),
      provenance: {
        source: input.provenanceSource,
        generator: "fixture",
        createdAt: clock.next(),
        lineage: parent ? [parent.id] : [],
      },
    };
    Object.freeze(version.domainBlocks);
    Object.freeze(version.evidenceBindings);
    state.versions = [...state.versions, version];
    appendEvent("twin-version-published", version.id, {
      kind: "publication",
      twinVersionId: version.id,
      twinId: state.twinId,
      versionNumber: version.version,
      statusAfter: version.status,
      domainBlockCount: version.domainBlocks.length,
      evidenceBindingCount: version.evidenceBindings.length,
      provenanceSource: input.provenanceSource,
      simulated: true,
    });
    appendEvent("twin-quality-assessed", version.id, {
      twinVersionId: version.id,
      deficiencyCount: quality.deficiencies.length,
      simulated: true,
    });
    return version;
  };

  const controller: TwinStudioController = {
    backing: "fixture-simulated",

    async load(request) {
      if (!state) {
        bootstrap(request);
      }
      return snapshot();
    },

    async refresh() {
      return snapshot();
    },

    async publishFixtureVersion(input: PublishTwinVersionInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      const blocks = buildTwinStoryboardV1Blocks(clock);
      // 证据绑定发布走 binding-time 同意强制（无许可 ⇒ 不处理）。
      const bindings: TwinEvidenceBinding[] = [];
      if (input.evidenceBound) {
        assertBindingConsent();
        bindings.push(...buildStoryboardEvidenceBindings());
      }
      return publishVersion({
        domainBlocks: blocks,
        evidenceBindings: bindings,
        provenanceSource: "fixture:twin-storyboard:v1",
      });
    },

    async promoteVersion(input: PromoteTwinVersionInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      const candidate = requireVersion(input.versionId);
      if (candidate.status !== "candidate") {
        throw youError("YOU_IMMUTABLE_VIOLATION", `twin version ${input.versionId} is ${candidate.status}, not candidate`, {
          reason: "not-candidate",
          status: candidate.status,
        });
      }
      if (!isLegalStoryboardTwinVersionTransition(candidate.status, "canonical")) {
        throw youError("YOU_IMMUTABLE_VIOLATION", `illegal twin version transition ${candidate.status} -> canonical`, {
          from: candidate.status,
          to: "canonical",
        });
      }
      const previousCanonical = [...state.versions].reverse().find((version) => version.status === "canonical");
      const promoted: TwinVersion = { ...candidate, status: "canonical" };
      state.versions = state.versions.map((version) => (version.id === promoted.id ? promoted : version));
      let superseded: TwinVersion | null = null;
      if (previousCanonical && previousCanonical.id !== promoted.id) {
        if (!isLegalStoryboardTwinVersionTransition(previousCanonical.status, "superseded")) {
          throw youError("YOU_IMMUTABLE_VIOLATION", `illegal twin version transition ${previousCanonical.status} -> superseded`, {
            from: previousCanonical.status,
            to: "superseded",
          });
        }
        const nextSuperseded: TwinVersion = { ...previousCanonical, status: "superseded" };
        superseded = nextSuperseded;
        state.versions = state.versions.map((version) => (version.id === nextSuperseded.id ? nextSuperseded : version));
        state.supersededBy.set(nextSuperseded.id, promoted.id);
      }
      appendEvent("twin-version-published", promoted.id, {
        kind: "promotion",
        twinVersionId: promoted.id,
        versionNumber: promoted.version,
        statusAfter: promoted.status,
        ...(superseded === null
          ? {}
          : { supersededVersionId: superseded.id, supersededStatusAfter: superseded.status }),
        simulated: true,
      }, "user");
      return promoted;
    },

    async assessQuality(input: AssessTwinQualityInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      const version = requireVersion(input.versionId);
      // 确定性重投影：不改变已发布版本（不可变）；仅追加 twin-quality-assessed 事件。
      const quality = assessQualityOf(version.domainBlocks, version.evidenceBindings);
      const deficiencyFacts: Record<string, string | number | boolean> = {
        twinVersionId: version.id,
        assessedAt: quality.assessedAt,
        deficiencyCount: quality.deficiencies.length,
        simulated: true,
      };
      for (const [domain, score] of Object.entries(quality.domainScores).sort(([a], [b]) => (a < b ? -1 : 1))) {
        deficiencyFacts[`score.${domain}`] = score;
      }
      appendEvent("twin-quality-assessed", version.id, deficiencyFacts);
      return snapshot();
    },

    async openRemediation(input: OpenRemediationInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      const deficiency = requireDeficiency(input.versionId, input.deficiencyId);
      const key = twinStoryboardDeficiencyKey(deficiency.deficiencyClass, deficiency.domain);
      const existingId = state.remediationByDeficiencyKey.get(key);
      if (existingId !== undefined) {
        const existing = state.evidenceRequests.find((request) => request.id === existingId);
        if (existing) {
          return existing;
        }
      }
      const request: EvidenceRequest = {
        id: nextId("fx-evreq"),
        ...storyboardRemediationEvidenceRequest(deficiency, input.versionId),
      };
      state.evidenceRequests = [...state.evidenceRequests, request];
      state.remediationByDeficiencyKey.set(key, request.id);
      appendEvent("evidence-requested", request.id, {
        evidenceRequestId: request.id,
        twinVersionId: input.versionId,
        targetDeficiency: request.targetDeficiency,
        statusAfter: request.status,
        simulated: true,
      });
      return request;
    },

    async submitReconstructionJob(input: SubmitReconstructionInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      if (input.targetDomains.length === 0) {
        throw youError("YOU_RECONSTRUCTION_UNSUPPORTED", "a reconstruction job requires at least one target domain", {
          reason: "empty-target-domains",
        });
      }
      // 支持矩阵校验最先：不支持 ⇒ typed error，绝不静默回退（W3A 同语义）。
      const unsupported = unsupportedStoryboardReconstructionDomains(input.method, input.targetDomains);
      if (unsupported.length > 0) {
        throw youError(
          "YOU_RECONSTRUCTION_UNSUPPORTED",
          `unsupported reconstruction method/domain combination: method "${input.method}" does not support target domain(s): ${unsupported.join(", ")}`,
          {
            reason: "unsupported-method-domain-combination",
            method: input.method,
            unsupportedDomains: unsupported.join(","),
          },
        );
      }
      const evidenceBindings: TwinEvidenceBinding[] = [];
      if (input.evidenceBound) {
        assertBindingConsent();
        evidenceBindings.push(...buildStoryboardEvidenceBindings());
      }
      const spec: ReconstructionJobSpec = {
        id: nextId("fx-reconjob"),
        twinVersionId: currentVersionIdOf(state),
        method: input.method,
        targetDomains: [...input.targetDomains].sort(),
        evidenceBindings,
        createdAt: clock.next(),
      };
      state.jobs = [...state.jobs, { spec, status: "queued", result: null }];
      appendEvent("reconstruction-job-submitted", spec.id, {
        jobId: spec.id,
        twinVersionId: spec.twinVersionId,
        method: spec.method,
        targetDomains: [...spec.targetDomains].join(","),
        targetDomainCount: spec.targetDomains.length,
        evidenceBindingCount: spec.evidenceBindings.length,
        simulated: true,
      });
      return spec;
    },

    async startReconstructionJob(input: ReconstructionJobInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      const job = requireJob(input.jobId);
      if (job.status !== "queued") {
        throw invalidState(`reconstruction job ${job.spec.id} is ${job.status}, not queued`);
      }
      job.status = "running";
      return snapshot();
    },

    async completeReconstructionJob(input: ReconstructionJobInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      const job = requireJob(input.jobId);
      if (job.status !== "running") {
        throw invalidState(`reconstruction job ${job.spec.id} is ${job.status}, not running`);
      }
      const producedBlocks = buildTwinStoryboardV2Blocks(clock, {
        jobId: job.spec.id,
        twinVersionId: job.spec.twinVersionId,
      });
      const result = buildStoryboardReconstructionResult({
        jobId: job.spec.id,
        status: "completed",
        producedDomainBlocks: producedBlocks,
        evidenceBindingCount: job.spec.evidenceBindings.length,
        completedAt: clock.next(),
      });
      job.status = "completed";
      job.result = result;
      appendEvent("reconstruction-job-completed", result.jobId, {
        jobId: result.jobId,
        statusAfter: result.status,
        producedBlockCount: result.producedDomainBlocks.length,
        simulated: true,
      });
      return result;
    },

    async failReconstructionJob(input: FailReconstructionInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      const job = requireJob(input.jobId);
      if (job.status === "completed" || job.status === "failed") {
        throw invalidState(`reconstruction job ${job.spec.id} is already ${job.status}`);
      }
      const result = buildStoryboardReconstructionResult({
        jobId: job.spec.id,
        status: "failed",
        producedDomainBlocks: [],
        evidenceBindingCount: job.spec.evidenceBindings.length,
        failureReason: input.reason,
        completedAt: clock.next(),
      });
      job.status = "failed";
      job.result = result;
      appendEvent("reconstruction-job-completed", result.jobId, {
        jobId: result.jobId,
        statusAfter: result.status,
        producedBlockCount: 0,
        failureReason: input.reason,
        simulated: true,
      });
      return result;
    },

    async publishVersionFromJob(input: PublishVersionFromJobInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      const job = requireJob(input.jobId);
      if (job.result === null || job.result.status !== "completed") {
        throw invalidState(
          `only a completed reconstruction job can publish a version (job ${job.spec.id} is ${job.status})`,
        );
      }
      // 证据绑定的发布走 consent re-enforcement（withdrawal 阻断新发布）。
      if (job.spec.evidenceBindings.length > 0) {
        assertBindingConsent();
      }
      return publishVersion({
        domainBlocks: job.result.producedDomainBlocks,
        evidenceBindings: job.spec.evidenceBindings,
        provenanceSource: `fixture:reconstruction:${job.spec.id}`,
      });
    },

    async decideConsent(input: TwinConsentDecisionInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      if (input.policyId !== TWIN_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      if (!TWIN_STORYBOARD_CONSENT_POLICY.purposes.includes(input.purpose)) {
        throw invalidState(`purpose ${input.purpose} is not part of policy ${input.policyId}`);
      }
      state.purposeStates.set(input.purpose, input.decision === "grant" ? "granted" : "denied");
      appendEvent("consent-recorded", input.policyId, {
        purpose: input.purpose,
        decision: input.decision,
        kind: "operational",
        simulated: true,
      });
      return consentProjection();
    },

    async withdrawConsent(input: TwinWithdrawConsentInput) {
      if (!state) throw invalidState("twin studio is not loaded");
      if (input.policyId !== TWIN_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      for (const purpose of TWIN_STORYBOARD_CONSENT_POLICY.purposes) {
        state.purposeStates.set(purpose, "withdrawn");
      }
      appendEvent("consent-withdrawn", input.policyId, {
        purposes: TWIN_STORYBOARD_CONSENT_POLICY.purposes.join(","),
        simulated: true,
      });
      return consentProjection();
    },
  };

  function currentVersionIdOf(current: SimulatedTwinState): OpaqueId {
    const latest = current.versions[current.versions.length - 1];
    if (!latest) {
      throw invalidState("no twin version to attach a reconstruction job to");
    }
    return latest.id;
  }

  function requireJob(jobId: OpaqueId): SimulatedJobState {
    if (!state) throw invalidState("twin studio is not loaded");
    const job = state.jobs.find((candidate) => candidate.spec.id === jobId);
    if (!job) {
      throw youError("YOU_INVALID_STATE", `reconstruction job ${jobId} not found`, {
        reason: "unknown-reconstruction-job",
        jobId,
      });
    }
    return job;
  }

  return controller;
}

/** 剧本证据绑定（内容寻址引用 + 同意引用；binding-time 记录）。 */
function buildStoryboardEvidenceBindings(): TwinEvidenceBinding[] {
  const binding = {
    evidenceId: "fx-evd-001",
    evidenceContentHash: "sha256-fixture-bnd1",
    consent: {
      policyId: TWIN_STORYBOARD_CONSENT_POLICY.id,
      state: "granted" as const,
      learningPermission: false,
    },
  };
  return [binding];
}
