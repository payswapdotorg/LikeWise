/* oxlint-disable eslint(max-lines) -- 模拟控制器按 LabStudioController 端口逐方法实现（Phase-0 剧本状态机：实验声明 intake（三臂法则 + 世界/预算 intake）+ run 阶梯 append-only（submitted -> running -> succeeded|failed|retired，终态锁定）+ content-addressed manifest 发布与校验（hash mismatch fail closed）+ promotion gate 固定序求值 + reversal 新记录 + 搜索阶梯预算（耗尽为 recorded terminal））；T9 换绑 Worker A 的 lab 服务后本文件整体退役，拆分只会增加退役成本。 */
// YOU Lab Studio — 确定性模拟控制器（W9B，Phase 0）。
//
// 这是 `LabStudioController` 端口的确定性剧本实现（W9A 的 lab 持久化服务在并行
// wave 合入；本实现只到 T9 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自 StoryboardClock
//   （统一经 tick() 包装——消费计数使快照 projectedAt 锚定确定性，绝不 Date.now）；
// - LAB PERSISTENCE LAW：LabExperiment/LabRun/LabEvidenceManifest/LabPromotionRecord
//   记录不可变（run 的 evidenceManifestRef 与 experiment 的 promotionRef 经不可变
//   替换同步——同 id 新记录，绝不原地覆写）；run 阶梯 append-only（每 run
//   submitted -> running -> succeeded | failed | retired，终态后再迁移是 typed
//   拒绝）；manifest 是 content-addressed 的 durability 单元（artifact 内容哈希
//   让 run 可重放可审计——verify 按同派生折叠重算比对，mismatch fail closed）；
// - LAB PROMOTION LAW：searched 臂仅在实验记录的 objective 与 constraints 下严格
//   胜过 generalist baseline 才可晋升（持平不晋升）；promotion 记录不可变，
//   reversal 是新账本记录（kind/supersedes 链接——frozen 形状不动）；非法晋升
//   ⇒ YOU_LAB_PROMOTION_INVALID typed 拒绝；
// - LAB DETERMINISM LAW：世界与基准 run seed-deterministic（同 seed ⇒ 字节一致
//   世界——manifest/plan 哈希按 seed 派生）；一切 simulated 保持
//   `simulated: true`（truth law）；
// - SEARCH BUDGET LAW：searched 臂每次 run 提交追加 SearchLadderStep（显式累计
//   预算）；预算耗尽是 recorded terminal（terminal step 落账后 typed 拒绝——
//   YOU_SEARCH_LADDER_INVALID，绝不静默停止）；
// - run 阶梯非法迁移/终态锁定 ⇒ YOU_INVALID_STATE（frozen v9 词汇无
//   lab-run-state 专属 code——generic invalid-state 携带 reason，与 W8B 服务语义
//   同款披露）；未知 run ⇒ YOU_LAB_RUN_NOT_FOUND；未知实验 ⇒
//   YOU_LAB_EXPERIMENT_NOT_FOUND；manifest 校验失败 ⇒
//   YOU_LAB_EVIDENCE_MANIFEST_INVALID；世界 intake 违例 ⇒ YOU_LAB_WORLD_INVALID；
// - 事件词汇（frozen additive wave-9）：lab-run-recorded（每次迁移同型落账）/
//   lab-evidence-published / lab-promotion-decided（reversal 带 reversal 标记）+
//   solution-created。frozen 词汇无 lab-experiment-declared 类型——实验声明是
//   durable 记录（不伪造事件，与 W8B delivered/rejected 无事件类型同款披露）。
import type {
  LabArmKind,
  LabExperiment,
  LabPromotionRecord,
  LabRun,
  LabRunStatus,
  LabWorldDescriptor,
  OpaqueId,
  SearchLadderStep,
  SolutionEvent,
  SolutionEventType,
  YouError,
} from "@zcode/shared";
import {
  LabStudioError,
  type CompleteLabRunInput,
  type DecidePromotionInput,
  type DeclareExperimentInput,
  type LabBudgetPresetView,
  type LabExperimentContextView,
  type LabExperimentSpecView,
  type LabManifestView,
  type LabPromotionEntry,
  type LabStudioController,
  type LabStudioLoadRequest,
  type LabStudioSnapshot,
  type LabWorldPresetView,
  type PublishEvidenceManifestInput,
  type RetireLabRunInput,
  type ReversePromotionInput,
  type StartLabRunInput,
  type SubmitLabRunInput,
  type VerifyEvidenceManifestInput,
} from "./labController.js";
import { StoryboardClock } from "./solutionStoryboard.js";
import {
  evaluateStoryboardPromotionGate,
  isLegalStoryboardLabRunTransition,
  isTerminalStoryboardLabRunStatus,
  storyboardManifestHashMatches,
  validateStoryboardExperimentIntake,
  validateStoryboardSearchBudget,
  validateStoryboardWorldDescriptor,
} from "./labStoryboardLaws.js";
import {
  LAB_STORYBOARD_ARM_KINDS,
  LAB_STORYBOARD_BUDGET_PRESETS,
  LAB_STORYBOARD_DISPLAY_NAME,
  LAB_STORYBOARD_EXPERIMENT_SPECS,
  LAB_STORYBOARD_MANIFEST_INTEGRITIES,
  LAB_STORYBOARD_RUN_STATUSES,
  LAB_STORYBOARD_SOLUTION_ID,
  LAB_STORYBOARD_WORLD_PRESETS,
  compareStoryboardId,
  storyboardArmScoresOfSpec,
  storyboardArtifactRefs,
  storyboardBudgetPresetById,
  storyboardManifestContentHash,
  storyboardPlanHash,
  storyboardSearchStrategy,
  storyboardWorldOfPreset,
  storyboardWorldPresetById,
  type StoryboardExperimentSpec,
} from "./labStoryboard.js";

/** 一次 run 的 manifest 工件数（确定性 fixture 常量）。 */
const MANIFEST_ARTIFACT_COUNT = 3;

interface SimulatedLabState {
  readonly studioId: OpaqueId;
  readonly displayName: string;
  experiments: LabExperiment[];
  /** experimentId → 规格关联（服务端事实；frozen 实验记录不含 spec 字段）。 */
  experimentSpecIds: Map<string, string>;
  /** experimentId → 声明的确定性世界。 */
  experimentWorlds: Map<string, LabWorldDescriptor>;
  /** experimentId → 显式累计搜索预算。 */
  experimentBudgets: Map<string, number>;
  /** experimentId → 搜索阶梯是否已达 recorded exhaustion terminal。 */
  experimentSearchExhausted: Map<string, boolean>;
  runs: LabRun[];
  /** manifest 记录 + 校验账本（append-only 校验观察——manifest 记录本身不可变）。 */
  manifestVerifications: Map<string, { status: string; verifiedAt: string | null }>;
  manifests: import("@zcode/shared").LabEvidenceManifest[];
  promotionLedger: LabPromotionEntry[];
  searchLadder: SearchLadderStep[];
  worlds: LabWorldDescriptor[];
  events: SolutionEvent[];
}

/** 与 solutionStoryboard.ts 私有纪元一致的镜像字面量（时钟锚）。 */
const STORYBOARD_EPOCH_MS = Date.UTC(2025, 5, 2, 9, 0, 0, 0);

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): LabStudioError {
  return new LabStudioError({ code, message, details, simulated: true });
}

function invalidState(
  reason: string,
  message: string,
  details: Record<string, string | number | boolean> = {},
): LabStudioError {
  return youError("YOU_INVALID_STATE", message, { reason, ...details });
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 labStudioRegistry）；
 * `load` 幂等：状态存在即复用（lab 平面是持久 workspace 表面）。
 */
export function createSimulatedLabStudioController(): LabStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let consumedTicks = 0;
  let state: SimulatedLabState | null = null;

  const nextId = (prefix: string): string => {
    idSeq += 1;
    return `${prefix}-${String(idSeq).padStart(3, "0")}`;
  };

  /** 全部时间戳统一入口（消费计数 → projectedAt 锚定确定性）。 */
  const tick = (): string => {
    consumedTicks += 1;
    return clock.next();
  };

  /** 确定性「当前时刻」＝下一次 tick 的值（纪元 + 已消费 tick 秒；非 Date.now）。 */
  const clockNow = (): string =>
    new Date(STORYBOARD_EPOCH_MS + consumedTicks * 1000).toISOString();

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
        id: nextId("fx-lab-event"),
        solutionId: LAB_STORYBOARD_SOLUTION_ID,
        type,
        occurredAt: tick(),
        subjectRef,
        payload,
        provenance: {
          source: "you-phase0-lab-storyboard",
          generator,
          createdAt: tick(),
          lineage: [],
        },
      },
    ];
  };

  // -------------------------------------------------------------------------
  // 账本解析 / 不可变替换（W8B replaceRecord 同款：同 id 新记录，绝不覆写）
  // -------------------------------------------------------------------------

  const requireExperiment = (experimentId: OpaqueId): LabExperiment => {
    if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
    const experiment = state.experiments.find(
      (candidate) => candidate.id === experimentId,
    );
    if (!experiment) {
      throw youError(
        "YOU_LAB_EXPERIMENT_NOT_FOUND",
        `lab experiment ${experimentId} not found`,
        { reason: "unknown-experiment", experimentId },
      );
    }
    return experiment;
  };

  const requireRun = (runId: OpaqueId): LabRun => {
    if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
    const run = state.runs.find((candidate) => candidate.id === runId);
    if (!run) {
      throw youError("YOU_LAB_RUN_NOT_FOUND", `lab run ${runId} not found`, {
        reason: "unknown-lab-run",
        runId,
      });
    }
    return run;
  };

  const replaceRun = (run: LabRun): void => {
    if (!state) return;
    state.runs = state.runs.map((candidate) => (candidate.id === run.id ? run : candidate));
  };

  const replaceExperiment = (experiment: LabExperiment): void => {
    if (!state) return;
    state.experiments = state.experiments.map((candidate) =>
      candidate.id === experiment.id ? experiment : candidate,
    );
  };

  const specOfExperiment = (experimentId: OpaqueId): StoryboardExperimentSpec => {
    if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
    const specId = state.experimentSpecIds.get(experimentId);
    if (!specId) {
      throw invalidState("unknown-experiment-spec", `experiment ${experimentId} has no spec association`);
    }
    const spec = LAB_STORYBOARD_EXPERIMENT_SPECS.find((entry) => entry.id === specId);
    if (!spec) {
      throw invalidState("unknown-experiment-spec", `spec ${specId} is not on the fixture registry`);
    }
    return spec;
  };

  const runsOfArm = (experimentId: OpaqueId, arm: LabArmKind): LabRun[] =>
    state?.runs.filter((run) => run.experimentId === experimentId && run.arm === arm) ?? [];

  const latestSucceededRunOfArm = (
    experimentId: OpaqueId,
    arm: LabArmKind,
  ): LabRun | null => {
    const succeeded = runsOfArm(experimentId, arm).filter(
      (run) => run.status === "succeeded",
    );
    return succeeded.at(-1) ?? null;
  };

  const bestSearchedScoreSoFar = (experimentId: OpaqueId): number => {
    const spec = specOfExperiment(experimentId);
    const scores = storyboardArmScoresOfSpec(spec);
    return latestSucceededRunOfArm(experimentId, "searched") !== null
      ? scores.searched
      : 0;
  };

  // -------------------------------------------------------------------------
  // 快照
  // -------------------------------------------------------------------------

  const snapshot = (): LabStudioSnapshot => {
    if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
    const experimentSpecs: readonly LabExperimentSpecView[] =
      LAB_STORYBOARD_EXPERIMENT_SPECS.map((spec) => ({
        id: spec.id,
        intentRef: spec.intentRef,
        objective: spec.objective,
        constraintsHash: spec.constraintsHash,
        armScores: spec.armScores.map((entry) => ({ ...entry })),
      }));
    const worldPresets: readonly LabWorldPresetView[] =
      LAB_STORYBOARD_WORLD_PRESETS.map((preset) => ({
        id: preset.id,
        seed: preset.seed,
        actorCount: preset.actorCount,
        valid: preset.valid,
      }));
    const budgetPresets: readonly LabBudgetPresetView[] =
      LAB_STORYBOARD_BUDGET_PRESETS.map((preset) => ({
        id: preset.id,
        cumulativeBudget: preset.cumulativeBudget,
        valid: preset.valid,
      }));
    const experiments = [...state.experiments].sort((a, b) =>
      compareStoryboardId(a.id, b.id),
    );
    const experimentContexts: readonly LabExperimentContextView[] = experiments.map(
      (experiment) => ({
        experimentId: experiment.id,
        specId: state!.experimentSpecIds.get(experiment.id) ?? "",
        world: state!.experimentWorlds.get(experiment.id) ?? {
          id: "",
          seed: "",
          actorCount: 0,
          groundTruthRef: null,
          simulated: true,
        },
        searchBudget: state!.experimentBudgets.get(experiment.id) ?? 0,
        searchExhausted:
          state!.experimentSearchExhausted.get(experiment.id) === true,
      }),
    );
    const manifestViews: readonly LabManifestView[] = [...state.manifests]
      .sort((a, b) => compareStoryboardId(a.id, b.id))
      .map((manifest) => {
        const verification = state!.manifestVerifications.get(manifest.id);
        return {
          manifest: { ...manifest },
          verification: (verification?.status ?? "unverified") as
            | "unverified"
            | "verified"
            | "mismatch",
          verifiedAt: verification?.verifiedAt ?? null,
        };
      });
    const armScores = experiments.flatMap((experiment) => {
      const spec = specOfExperiment(experiment.id);
      const scores = storyboardArmScoresOfSpec(spec);
      return LAB_STORYBOARD_ARM_KINDS.map((arm) => {
        const armRuns = runsOfArm(experiment.id, arm);
        const best = latestSucceededRunOfArm(experiment.id, arm);
        return {
          experimentId: experiment.id,
          arm,
          score: best !== null ? scores[arm] : null,
          runCount: armRuns.length,
          succeededCount: armRuns.filter((run) => run.status === "succeeded").length,
          bestRunId: best?.id ?? null,
          evidenceManifestId: best?.evidenceManifestRef ?? null,
          simulated: true,
        };
      });
    });
    return {
      displayName: state.displayName,
      studioId: state.studioId,
      armKinds: [...LAB_STORYBOARD_ARM_KINDS],
      runStatuses: [...LAB_STORYBOARD_RUN_STATUSES] as readonly LabRunStatus[],
      experimentSpecs,
      worldPresets,
      budgetPresets,
      manifestIntegrities: [...LAB_STORYBOARD_MANIFEST_INTEGRITIES],
      experiments,
      experimentContexts,
      runs: [...state.runs].sort((a, b) => compareStoryboardId(a.id, b.id)),
      manifests: manifestViews,
      promotionLedger: state.promotionLedger.map((entry) => ({
        record: { ...entry.record },
        kind: entry.kind,
        supersedesRecordId: entry.supersedesRecordId,
      })),
      armScores,
      worlds: state.worlds.map((world) => ({ ...world })),
      searchLadder: state.searchLadder.map((step) => ({ ...step })),
      events: state.events,
      projectedAt: clockNow(),
      simulated: true,
    };
  };

  const bootstrap = (request: LabStudioLoadRequest): void => {
    state = {
      studioId: "fx-lab-studio-001",
      displayName: LAB_STORYBOARD_DISPLAY_NAME,
      experiments: [],
      experimentSpecIds: new Map(),
      experimentWorlds: new Map(),
      experimentBudgets: new Map(),
      experimentSearchExhausted: new Map(),
      runs: [],
      manifestVerifications: new Map(),
      manifests: [],
      promotionLedger: [],
      searchLadder: [],
      worlds: [],
      events: [],
    };
    appendEvent("solution-created", state.studioId, {
      surface: "lab-studio",
      workspaceKey: request.workspaceKey,
      studioId: state.studioId,
      armKindCount: LAB_STORYBOARD_ARM_KINDS.length,
      runStatusCount: LAB_STORYBOARD_RUN_STATUSES.length,
      experimentSpecCount: LAB_STORYBOARD_EXPERIMENT_SPECS.length,
      worldPresetCount: LAB_STORYBOARD_WORLD_PRESETS.length,
      simulated: true,
    });
  };

  // -------------------------------------------------------------------------
  // run 阶梯迁移（转移表强制；合法迁移的单一入口）
  // -------------------------------------------------------------------------

  const transitionRun = (
    run: LabRun,
    to: LabRunStatus,
    patch: Partial<LabRun> = {},
  ): LabRun => {
    if (!isLegalStoryboardLabRunTransition(run.status, to)) {
      throw invalidState(
        "illegal-run-transition",
        `illegal lab run transition ${run.status} -> ${to} on ${run.id}`,
        { runId: run.id, from: run.status, to },
      );
    }
    const next: LabRun = { ...run, ...patch, status: to };
    replaceRun(next);
    return next;
  };

  const recordRunEvent = (
    run: LabRun,
    statusBefore: LabRunStatus,
    statusAfter: LabRunStatus,
  ): void => {
    appendEvent("lab-run-recorded", run.id, {
      runId: run.id,
      experimentId: run.experimentId,
      arm: run.arm,
      planHash: run.planHash,
      statusBefore,
      statusAfter,
      completedAt: run.completedAt ?? "",
      evidenceManifestRef: run.evidenceManifestRef ?? "",
      simulated: true,
    });
  };

  // -------------------------------------------------------------------------
  // 搜索阶梯（SEARCH BUDGET LAW：显式累计预算；耗尽为 recorded terminal）
  // -------------------------------------------------------------------------

  const ladderOfExperiment = (experimentId: OpaqueId): SearchLadderStep[] =>
    state?.searchLadder.filter((step) => step.experimentId === experimentId) ?? [];

  /** searched 臂 run 提交的阶梯预算强制（耗尽 ⇒ terminal 落账 + typed 拒绝）。 */
  const enforceSearchBudget = (experimentId: OpaqueId): void => {
    if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
    const budget = state.experimentBudgets.get(experimentId) ?? 0;
    const steps = ladderOfExperiment(experimentId);
    const exhausted = state.experimentSearchExhausted.get(experimentId) === true;
    if (exhausted) {
      throw youError(
        "YOU_SEARCH_LADDER_INVALID",
        `search ladder for experiment ${experimentId} is terminal (budget ${budget} exhausted)`,
        { reason: "budget-exhausted", experimentId, cumulativeBudget: budget },
      );
    }
    const nextStep = steps.length + 1;
    if (nextStep > budget) {
      // 预算耗尽是 recorded terminal（SEARCH BUDGET LAW——绝不静默停止）。
      const terminal: SearchLadderStep = {
        id: nextId("fx-ladder-step"),
        experimentId,
        step: nextStep,
        strategy: "budget-exhausted",
        exploredNodes: 0,
        bestScore: bestSearchedScoreSoFar(experimentId),
        cumulativeBudget: budget,
        simulated: true,
      };
      state.searchLadder = [...state.searchLadder, terminal];
      state.experimentSearchExhausted.set(experimentId, true);
      throw youError(
        "YOU_SEARCH_LADDER_INVALID",
        `search budget exhausted for experiment ${experimentId}: step ${nextStep} exceeds cumulativeBudget ${budget} (terminal recorded, never a silent stop)`,
        {
          reason: "budget-exhausted",
          experimentId,
          step: nextStep,
          cumulativeBudget: budget,
        },
      );
    }
  };

  /** searched 臂 run 提交后追加探索步（append-only SearchLadderStep）。 */
  const appendSearchStep = (experimentId: OpaqueId): SearchLadderStep => {
    if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
    const budget = state.experimentBudgets.get(experimentId) ?? 0;
    const step = ladderOfExperiment(experimentId).length + 1;
    const entry: SearchLadderStep = {
      id: nextId("fx-ladder-step"),
      experimentId,
      step,
      strategy: storyboardSearchStrategy(step),
      exploredNodes: 1,
      bestScore: bestSearchedScoreSoFar(experimentId),
      cumulativeBudget: budget,
      simulated: true,
    };
    state.searchLadder = [...state.searchLadder, entry];
    return entry;
  };

  // -------------------------------------------------------------------------
  // promotion 账本解析（reversal = 新记录；live 判定走账本事实）
  // -------------------------------------------------------------------------

  const promotionIsLive = (promotionId: OpaqueId): boolean => {
    if (!state) return false;
    const superseded = state.promotionLedger.some(
      (entry) =>
        entry.kind === "reversal" && entry.supersedesRecordId === promotionId,
    );
    return !superseded;
  };

  const controller: LabStudioController = {
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

    // -- 实验平面（LAB PERSISTENCE LAW：记录不可变；三臂法则 + 世界/预算 intake） --

    async declareExperiment(input: DeclareExperimentInput) {
      if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
      const spec = LAB_STORYBOARD_EXPERIMENT_SPECS.find(
        (entry) => entry.id === input.specId,
      );
      if (!spec) {
        throw invalidState(
          "unknown-experiment-spec",
          `experiment spec ${input.specId} is not on the fixture registry`,
          { specId: input.specId },
        );
      }
      const worldPreset = storyboardWorldPresetById(input.worldPresetId);
      if (!worldPreset) {
        throw invalidState(
          "unknown-world-preset",
          `world preset ${input.worldPresetId} is not on the fixture registry`,
          { worldPresetId: input.worldPresetId },
        );
      }
      // 世界 intake 最先（LAB DETERMINISM LAW——malformed 世界绝不猜测补全）。
      const worldViolation = validateStoryboardWorldDescriptor({
        seed: worldPreset.seed,
        actorCount: worldPreset.actorCount,
      });
      if (worldViolation) {
        throw youError(
          "YOU_LAB_WORLD_INVALID",
          `invalid lab world: ${worldViolation.detail}`,
          { reason: worldViolation.reason, worldPresetId: worldPreset.id },
        );
      }
      const budgetPreset = storyboardBudgetPresetById(input.budgetPresetId);
      if (!budgetPreset) {
        throw invalidState(
          "unknown-budget-preset",
          `budget preset ${input.budgetPresetId} is not on the fixture registry`,
          { budgetPresetId: input.budgetPresetId },
        );
      }
      // 预算 intake（SEARCH BUDGET LAW——显式且可用；0/负数/非整数 typed 拒绝）。
      const budgetViolation = validateStoryboardSearchBudget(
        budgetPreset.cumulativeBudget,
      );
      if (budgetViolation) {
        throw youError(
          "YOU_SEARCH_LADDER_INVALID",
          `invalid search budget: ${budgetViolation.detail}`,
          { reason: budgetViolation.reason, budgetPresetId: budgetPreset.id },
        );
      }
      const intakeViolation = validateStoryboardExperimentIntake({
        intentRef: spec.intentRef,
        objective: spec.objective,
        constraintsHash: spec.constraintsHash,
        arms: spec.arms,
      });
      if (intakeViolation) {
        // 剧本规格恒良构（三臂法则）；防御分支（服务语义镜像：malformed 声明 ⇒
        // typed 拒绝）。
        throw invalidState(
          "experiment-intake-invalid",
          `invalid experiment declaration: ${intakeViolation.detail}`,
          { reason: intakeViolation.reason, specId: spec.id },
        );
      }
      const experimentId = nextId("fx-experiment");
      const experiment: LabExperiment = {
        id: experimentId,
        intentRef: spec.intentRef,
        constraintsHash: spec.constraintsHash,
        objective: spec.objective,
        arms: [...spec.arms],
        promotionRef: null,
        simulated: true,
      };
      state.experiments = [...state.experiments, experiment];
      state.experimentSpecIds.set(experimentId, spec.id);
      const world = storyboardWorldOfPreset(worldPreset);
      state.experimentWorlds.set(experimentId, world);
      state.experimentBudgets.set(experimentId, budgetPreset.cumulativeBudget);
      state.experimentSearchExhausted.set(experimentId, false);
      if (!state.worlds.some((candidate) => candidate.id === world.id)) {
        state.worlds = [...state.worlds, world];
      }
      // frozen v9 事件词汇无 lab-experiment-declared 类型——声明是 durable 记录
      //（不伪造事件；与 W8B delivered/rejected 无事件类型同款披露）。
      return experiment;
    },

    // -- run 阶梯（append-only：submitted -> running -> 终态锁定） --

    async submitLabRun(input: SubmitLabRunInput) {
      if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
      const experiment = requireExperiment(input.experimentId);
      if (!experiment.arms.includes(input.arm)) {
        throw invalidState(
          "arm-not-in-experiment",
          `arm ${input.arm} is not one of the experiment's three arms`,
          { experimentId: experiment.id, arm: input.arm },
        );
      }
      // searched 臂的搜索预算强制最先（SEARCH BUDGET LAW）。
      if (input.arm === "searched") {
        enforceSearchBudget(experiment.id);
      }
      const attempt = runsOfArm(experiment.id, input.arm).length + 1;
      const run: LabRun = {
        id: nextId("fx-run"),
        experimentId: experiment.id,
        arm: input.arm,
        planHash: storyboardPlanHash(experiment.id, input.arm, attempt),
        status: "submitted",
        submittedAt: tick(),
        completedAt: null,
        evidenceManifestRef: null,
        simulated: true,
      };
      state.runs = [...state.runs, run];
      if (input.arm === "searched") {
        appendSearchStep(experiment.id);
      }
      recordRunEvent(run, "submitted", "submitted");
      return run;
    },

    async startLabRun(input: StartLabRunInput) {
      if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
      const run = requireRun(input.runId);
      if (run.status !== "submitted") {
        throw invalidState(
          isTerminalStoryboardLabRunStatus(run.status) ? "run-terminal-locked" : "illegal-run-transition",
          `lab run ${run.id} is ${run.status} — a run starts only from submitted`,
          { runId: run.id, from: run.status, to: "running" },
        );
      }
      const next = transitionRun(run, "running");
      recordRunEvent(next, "submitted", "running");
      return next;
    },

    async completeLabRun(input: CompleteLabRunInput) {
      if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
      const run = requireRun(input.runId);
      if (run.status !== "running") {
        throw invalidState(
          isTerminalStoryboardLabRunStatus(run.status) ? "run-terminal-locked" : "illegal-run-transition",
          `lab run ${run.id} is ${run.status} — run terminals are locked`,
          { runId: run.id, from: run.status, to: input.outcome },
        );
      }
      const next = transitionRun(run, input.outcome, { completedAt: tick() });
      recordRunEvent(next, "running", input.outcome);
      return next;
    },

    async retireLabRun(input: RetireLabRunInput) {
      if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
      const run = requireRun(input.runId);
      if (run.status !== "submitted" && run.status !== "running") {
        throw invalidState(
          "run-terminal-locked",
          `lab run ${run.id} is ${run.status} — run terminals are locked`,
          { runId: run.id, from: run.status, to: "retired" },
        );
      }
      const next = transitionRun(run, "retired", { completedAt: tick() });
      recordRunEvent(next, run.status, "retired");
      return next;
    },

    // -- evidence 平面（content-addressed；verification fail closed） --

    async publishEvidenceManifest(input: PublishEvidenceManifestInput) {
      if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
      const run = requireRun(input.runId);
      if (!isTerminalStoryboardLabRunStatus(run.status)) {
        // manifest intake：仅终态 run 有可发布的确定性工件 bundle。
        throw youError(
          "YOU_LAB_EVIDENCE_MANIFEST_INVALID",
          `lab run ${run.id} is ${run.status} — evidence manifests bundle terminal runs only`,
          { reason: "manifest-intake-run-not-terminal", runId: run.id },
        );
      }
      const artifactRefs = storyboardArtifactRefs(run.id, MANIFEST_ARTIFACT_COUNT);
      const trueHash = storyboardManifestContentHash(run.id, artifactRefs);
      const recordedHash =
        input.integrity === "honest"
          ? trueHash
          : // tampered：合法落账但记录故意错误哈希（诚实拒绝路径——与 W8B 过期
            // 预设同款；verification 以 mismatch fail closed）。
            `sha256-fixture-tampered-${trueHash.slice("sha256-fixture-".length)}`;
      const manifest = {
        id: nextId("fx-manifest"),
        runId: run.id,
        contentHash: recordedHash,
        artifactRefs: [...artifactRefs],
        publishedAt: tick(),
        simulated: true,
      };
      state.manifests = [...state.manifests, manifest];
      state.manifestVerifications.set(manifest.id, { status: "unverified", verifiedAt: null });
      // run 的 evidenceManifestRef 经不可变替换同步（同 id 新记录，绝不覆写）。
      const linked: LabRun = { ...run, evidenceManifestRef: manifest.id };
      replaceRun(linked);
      appendEvent("lab-evidence-published", manifest.id, {
        manifestId: manifest.id,
        runId: manifest.runId,
        experimentId: run.experimentId,
        arm: run.arm,
        contentHash: manifest.contentHash,
        artifactCount: manifest.artifactRefs.length,
        integrity: input.integrity,
        simulated: true,
      });
      return {
        manifest: { ...manifest },
        verification: "unverified" as const,
        verifiedAt: null,
      };
    },

    async verifyEvidenceManifest(input: VerifyEvidenceManifestInput) {
      if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
      const manifest = state.manifests.find(
        (candidate) => candidate.id === input.manifestId,
      );
      if (!manifest) {
        throw youError(
          "YOU_LAB_EVIDENCE_MANIFEST_INVALID",
          `lab evidence manifest ${input.manifestId} not found`,
          { reason: "unknown-manifest", manifestId: input.manifestId },
        );
      }
      const matches = storyboardManifestHashMatches(
        manifest.runId,
        manifest.artifactRefs,
        manifest.contentHash,
      );
      if (!matches) {
        // 失败校验是可观察事实（账本 append）——manifest 记录本身保持不可变。
        state.manifestVerifications.set(manifest.id, {
          status: "mismatch",
          verifiedAt: clockNow(),
        });
        throw youError(
          "YOU_LAB_EVIDENCE_MANIFEST_INVALID",
          `lab evidence manifest ${manifest.id} failed verification: recorded contentHash ${manifest.contentHash} does not match the recomputed artifact content hash (fail closed)`,
          {
            reason: "hash-mismatch",
            manifestId: manifest.id,
            runId: manifest.runId,
          },
        );
      }
      state.manifestVerifications.set(manifest.id, {
        status: "verified",
        verifiedAt: clockNow(),
      });
      return {
        manifest: { ...manifest },
        verification: "verified" as const,
        verifiedAt: clockNow(),
      };
    },

    // -- promotion 平面（LAB PROMOTION LAW：searched-only + beats-baseline） --

    async decidePromotion(input: DecidePromotionInput) {
      if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
      const experiment = requireExperiment(input.experimentId);
      const spec = specOfExperiment(experiment.id);
      const scores = storyboardArmScoresOfSpec(spec);
      const bestSearched = latestSucceededRunOfArm(experiment.id, "searched");
      const bestBaseline = latestSucceededRunOfArm(experiment.id, "generalist-baseline");
      const manifest = state.manifests.find(
        (candidate) => candidate.id === input.evidenceManifestRef,
      );
      const verification = manifest
        ? state.manifestVerifications.get(manifest.id)?.status ?? "unverified"
        : "unverified";
      // live 判定：promotionRef 指向 promotion 类账本条目且未被 reversal 顶替
      //（指向 reversal 记录 = 门重新打开——reversal 是新记录而非 mutation）。
      const promotionEntry =
        experiment.promotionRef !== null
          ? state.promotionLedger.find(
              (entry) => entry.record.id === experiment.promotionRef,
            )
          : undefined;
      const livePromotionExists =
        promotionEntry !== undefined &&
        promotionEntry.kind === "promotion" &&
        promotionIsLive(promotionEntry.record.id);
      const gate = evaluateStoryboardPromotionGate({
        experimentKnown: true,
        experimentArms: experiment.arms,
        livePromotionExists,
        candidateArm: input.candidateArm,
        searchedScore: bestSearched !== null ? scores.searched : null,
        baselineScore: bestBaseline !== null ? scores["generalist-baseline"] : null,
        evidenceManifestKnown: manifest !== undefined,
        evidenceVerified: verification === "verified",
      });
      if (!gate.allowed) {
        throw youError(
          "YOU_LAB_PROMOTION_INVALID",
          `promotion refused on ${experiment.id}: ${gate.reason}`,
          { reason: gate.reason, experimentId: experiment.id, candidateArm: input.candidateArm },
        );
      }
      const record: LabPromotionRecord = {
        id: nextId("fx-promotion"),
        experimentId: experiment.id,
        winnerArm: input.candidateArm,
        objectiveScore: scores.searched,
        baselineScore: scores["generalist-baseline"],
        evidenceManifestRef: input.evidenceManifestRef,
        decidedAt: tick(),
        simulated: true,
      };
      const entry: LabPromotionEntry = {
        record,
        kind: "promotion",
        supersedesRecordId: null,
      };
      state.promotionLedger = [...state.promotionLedger, entry];
      // experiment 的 promotionRef 经不可变替换同步（同 id 新记录，绝不覆写）。
      replaceExperiment({ ...experiment, promotionRef: record.id });
      appendEvent(
        "lab-promotion-decided",
        record.id,
        {
          promotionId: record.id,
          experimentId: record.experimentId,
          winnerArm: record.winnerArm,
          objectiveScore: record.objectiveScore,
          baselineScore: record.baselineScore,
          evidenceManifestRef: record.evidenceManifestRef,
          reversal: false,
          statusAfter: "promoted",
          simulated: true,
        },
        "user",
      );
      return entry;
    },

    async reversePromotion(input: ReversePromotionInput) {
      if (!state) throw invalidState("lab-not-loaded", "lab studio is not loaded");
      const target = state.promotionLedger.find(
        (entry) => entry.record.id === input.promotionId,
      );
      if (!target) {
        throw youError(
          "YOU_LAB_PROMOTION_INVALID",
          `promotion ${input.promotionId} not found on the ledger`,
          { reason: "unknown-promotion", promotionId: input.promotionId },
        );
      }
      if (target.kind !== "promotion") {
        throw youError(
          "YOU_LAB_PROMOTION_INVALID",
          `promotion ${input.promotionId} is already a reversal record`,
          { reason: "reversal-of-reversal", promotionId: input.promotionId },
        );
      }
      if (!promotionIsLive(target.record.id)) {
        throw youError(
          "YOU_LAB_PROMOTION_INVALID",
          `promotion ${input.promotionId} is not the live decision (already reversed)`,
          { reason: "promotion-not-live", promotionId: input.promotionId },
        );
      }
      // reversal = 新账本记录（LAB PROMOTION LAW：reversal 是新记录，绝非 mutation）。
      const record: LabPromotionRecord = {
        id: nextId("fx-promotion"),
        experimentId: target.record.experimentId,
        winnerArm: target.record.winnerArm,
        objectiveScore: target.record.objectiveScore,
        baselineScore: target.record.baselineScore,
        evidenceManifestRef: target.record.evidenceManifestRef,
        decidedAt: tick(),
        simulated: true,
      };
      const entry: LabPromotionEntry = {
        record,
        kind: "reversal",
        supersedesRecordId: target.record.id,
      };
      state.promotionLedger = [...state.promotionLedger, entry];
      const experiment = requireExperiment(target.record.experimentId);
      replaceExperiment({ ...experiment, promotionRef: record.id });
      appendEvent(
        "lab-promotion-decided",
        record.id,
        {
          promotionId: record.id,
          supersedesPromotionId: target.record.id,
          experimentId: record.experimentId,
          winnerArm: record.winnerArm,
          objectiveScore: record.objectiveScore,
          baselineScore: record.baselineScore,
          evidenceManifestRef: record.evidenceManifestRef,
          reversal: true,
          statusAfter: "reversed",
          simulated: true,
        },
        "user",
      );
      return entry;
    },
  };

  return controller;
}
