/* oxlint-disable eslint(max-lines) -- 模拟控制器按 ReleaseStudioController 端口逐方法实现（Phase-0 剧本状态机：launch-gate check 装配门（LAUNCH GATE LAW 逐点证据派生）+ operator signoff 门（引用完整过门 checklist 的一次性最终决定）+ release declaration 门（bundle+rollback 双在场、one release per signoff））；T12 换绑 Worker A/C 的 launch-gate 服务后本文件整体退役，拆分只会增加退役成本。 */
// YOU Release Studio — 确定性模拟控制器（W12B，Phase 0）。
//
// 这是 `ReleaseStudioController` 端口的确定性剧本实现（W12A 的 launch-gate
// authority 服务与 W12C 的 gate-evidence 服务在并行 wave 合入；本实现只到 T12
// 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自
//   StoryboardClock（统一经 tick() 包装——消费计数使快照 projectedAt 锚定确定性，
//   绝不 Date.now）；
// - LAUNCH GATE LAW：checklist point N 的通过仅来自 point-N journey evidence
//   引用（W12C derivation 的端口面——前 evidenceSteps 点携带 content-addressed
//   journey evidence ref，其余点 ref 为 null 且 passed=false）；绝无 bare
//   assertion 落账；未注册 journey ⇒ typed YOU_LAUNCH_GATE_INVALID；
// - OPERATOR SIGNOFF LAW：signoff 引用最新 COMPLETE passing checklist（无
//   checklist / 未过门 ⇒ typed YOU_OPERATOR_SIGNOFF_INVALID——signoff without a
//   passing gate 绝不落账）；checklist 已被签署 ⇒ typed 拒绝（signoff 是一次性
//   不可变最终决定）；未注册 operator ⇒ typed 拒绝；
// - RELEASE DECLARATION LAW：declaration 引用最新 live signoff + full evidence
//   bundle + rollback evidence（无 signoff / signoff 已声明——one release per
//   signoff / 未注册或空 bundle / 缺 rollback ⇒ typed
//   YOU_RELEASE_DECLARATION_INVALID）；
// - 事件词汇（frozen additive wave-12）：launch-gate-checked /
//   operator-signoff-recorded / release-declared + solution-created。
import type {
  LaunchGateChecklistPoint,
  LaunchGateChecklistRecord,
  OpaqueId,
  OperatorSignoffRecord,
  ReleaseDeclarationRecord,
  SolutionEvent,
  SolutionEventType,
  YouError,
} from "@zcode/shared";
import {
  ReleaseStudioError,
  releaseChecklistGatePasses,
  releaseChecklistIsSigned,
  releaseSignoffIsDeclared,
  type DeclareReleaseInput,
  type RecordOperatorSignoffInput,
  type ReleaseStudioController,
  type ReleaseStudioLoadRequest,
  type ReleaseStudioSnapshot,
  type RunLaunchGateCheckInput,
} from "./releaseController.js";
import { StoryboardClock } from "./solutionStoryboard.js";
import {
  storyboardChecklistPointPasses,
} from "./releaseStoryboardLaws.js";
import {
  RELEASE_STORYBOARD_DISPLAY_NAME,
  RELEASE_STORYBOARD_EVIDENCE_BUNDLES,
  RELEASE_STORYBOARD_JOURNEYS,
  RELEASE_STORYBOARD_LAUNCH_GATE_POINT_DESCRIPTIONS,
  RELEASE_STORYBOARD_OPERATORS,
  RELEASE_STORYBOARD_ROLLBACK_EVIDENCE,
  RELEASE_STORYBOARD_SOLUTION_ID,
  compareReleaseStoryboardId,
  releaseContentBinding,
  storyboardReleaseEvidenceBundleById,
  storyboardReleaseJourneyById,
  storyboardReleaseOperatorById,
  storyboardReleaseRollbackEvidenceById,
} from "./releaseStoryboard.js";

interface SimulatedReleaseState {
  readonly studioId: OpaqueId;
  readonly displayName: string;
  checklists: LaunchGateChecklistRecord[];
  signoffs: OperatorSignoffRecord[];
  declarations: ReleaseDeclarationRecord[];
  events: SolutionEvent[];
}

/** 与 solutionStoryboard.ts 私有纪元一致的镜像字面量（时钟锚）。 */
const STORYBOARD_EPOCH_MS = Date.UTC(2025, 5, 2, 9, 0, 0, 0);

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): ReleaseStudioError {
  return new ReleaseStudioError({ code, message, details, simulated: true });
}

function invalidState(
  reason: string,
  message: string,
  details: Record<string, string | number | boolean> = {},
): ReleaseStudioError {
  return youError("YOU_INVALID_STATE", message, { reason, ...details });
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 releaseStudioRegistry）；
 * `load` 幂等：状态存在即复用（release 平面是持久 workspace 表面）。
 */
export function createSimulatedReleaseStudioController(): ReleaseStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let consumedTicks = 0;
  let state: SimulatedReleaseState | null = null;

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
        id: nextId("fx-r-event"),
        solutionId: RELEASE_STORYBOARD_SOLUTION_ID,
        type,
        occurredAt: tick(),
        subjectRef,
        payload,
        provenance: {
          source: "you-phase0-release-storyboard",
          generator,
          createdAt: tick(),
          lineage: [],
        },
      },
    ];
  };

  // -------------------------------------------------------------------------
  // 快照
  // -------------------------------------------------------------------------

  const snapshot = (): ReleaseStudioSnapshot => {
    if (!state) {
      throw invalidState("release-not-loaded", "release studio is not loaded");
    }
    const journeys = RELEASE_STORYBOARD_JOURNEYS.map((entry) => ({
      id: entry.id,
      journeyId: entry.journeyId,
      steps: [...entry.steps],
      evidenceSteps: entry.evidenceSteps,
      valid: entry.valid,
    }));
    const operators = RELEASE_STORYBOARD_OPERATORS.map((entry) => ({
      id: entry.id,
      operatorRef: releaseContentBinding(`operator:${entry.operatorKey}`).contentRef,
      displayName: entry.displayName,
      valid: entry.valid,
    }));
    const evidenceBundles = RELEASE_STORYBOARD_EVIDENCE_BUNDLES.map((entry) => ({
      id: entry.id,
      bundleRef: releaseContentBinding(`bundle:${entry.bundleKey}`).contentRef,
      journeyCount: entry.journeyCount,
      valid: entry.valid,
    }));
    const rollbackEvidence = RELEASE_STORYBOARD_ROLLBACK_EVIDENCE.map((entry) => ({
      id: entry.id,
      rollbackRef: releaseContentBinding(`rollback:${entry.rollbackKey}`).contentRef,
      drill: entry.drill,
      valid: entry.valid,
    }));
    return {
      displayName: state.displayName,
      studioId: state.studioId,
      journeys,
      operators,
      evidenceBundles,
      rollbackEvidence,
      checklists: [...state.checklists]
        .sort((a, b) => compareReleaseStoryboardId(a.id, b.id))
        .map((entry) => ({
          ...entry,
          points: entry.points.map((point) => ({ ...point })),
        })),
      signoffs: [...state.signoffs]
        .sort((a, b) => compareReleaseStoryboardId(a.id, b.id))
        .map((entry) => ({ ...entry })),
      declarations: [...state.declarations]
        .sort((a, b) => compareReleaseStoryboardId(a.id, b.id))
        .map((entry) => ({ ...entry })),
      events: state.events,
      projectedAt: clockNow(),
      simulated: true,
    };
  };

  const bootstrap = (request: ReleaseStudioLoadRequest): void => {
    state = {
      studioId: "fx-release-studio-001",
      displayName: RELEASE_STORYBOARD_DISPLAY_NAME,
      checklists: [],
      signoffs: [],
      declarations: [],
      events: [],
    };
    appendEvent("solution-created", state.studioId, {
      surface: "release-studio",
      workspaceKey: request.workspaceKey,
      studioId: state.studioId,
      journeyCount: RELEASE_STORYBOARD_JOURNEYS.length,
      operatorCount: RELEASE_STORYBOARD_OPERATORS.length,
      bundleCount: RELEASE_STORYBOARD_EVIDENCE_BUNDLES.length,
      rollbackCount: RELEASE_STORYBOARD_ROLLBACK_EVIDENCE.length,
      simulated: true,
    });
  };

  // -------------------------------------------------------------------------
  // 端口实现（逐方法对位 ReleaseStudioController）
  // -------------------------------------------------------------------------

  const controller: ReleaseStudioController = {
    backing: "fixture-simulated",

    async load(
      request: ReleaseStudioLoadRequest,
    ): Promise<ReleaseStudioSnapshot> {
      if (!state) {
        bootstrap(request);
      }
      return snapshot();
    },

    async refresh(): Promise<ReleaseStudioSnapshot> {
      if (!state) {
        throw invalidState("release-not-loaded", "release studio is not loaded");
      }
      return snapshot();
    },

    async runLaunchGateCheck(
      input: RunLaunchGateCheckInput,
    ): Promise<LaunchGateChecklistRecord> {
      if (!state) {
        throw invalidState("release-not-loaded", "release studio is not loaded");
      }
      const journey = storyboardReleaseJourneyById(input.journeyId);
      if (!journey || !journey.valid) {
        throw youError(
          "YOU_LAUNCH_GATE_INVALID",
          `journey ${input.journeyId} not found — every launch-gate checklist references a registered journey (fail closed)`,
          { reason: "unknown-journey", journeyId: input.journeyId },
        );
      }
      // LAUNCH GATE LAW：point N 的通过仅来自 point-N journey evidence 引用——
      // 前 evidenceSteps 点携带 content-addressed evidence ref；其余点 ref null
      // 且 passed=false（bare assertion 绝不落账；incomplete checklist 诚实落账）。
      const points: LaunchGateChecklistPoint[] = journey.steps.map(
        (stepName, index) => {
          const pointNumber = index + 1;
          const hasEvidence = pointNumber <= journey.evidenceSteps;
          const evidenceRef = hasEvidence
            ? releaseContentBinding(
                `journey:${journey.journeyId}:step:${pointNumber}:${stepName}`,
              ).contentRef
            : null;
          return {
            point: pointNumber,
            description:
              RELEASE_STORYBOARD_LAUNCH_GATE_POINT_DESCRIPTIONS[index] ??
              stepName,
            journeyEvidenceRef: evidenceRef,
            passed: storyboardChecklistPointPasses(evidenceRef),
          };
        },
      );
      const record: LaunchGateChecklistRecord = {
        id: nextId("fx-r-checklist"),
        points,
        checkedAt: clockNow(),
        simulated: true,
      };
      state.checklists = [...state.checklists, record];
      const pointsPassed = points.filter((point) => point.passed).length;
      appendEvent("launch-gate-checked", record.id, {
        checklistId: record.id,
        journeyId: journey.journeyId,
        pointsTotal: points.length,
        pointsPassed,
        gatePassed: releaseChecklistGatePasses(record),
        simulated: true,
      });
      return {
        ...record,
        points: record.points.map((point) => ({ ...point })),
      };
    },

    async recordOperatorSignoff(
      input: RecordOperatorSignoffInput,
    ): Promise<OperatorSignoffRecord> {
      if (!state) {
        throw invalidState("release-not-loaded", "release studio is not loaded");
      }
      const operator = storyboardReleaseOperatorById(input.operatorId);
      if (!operator || !operator.valid) {
        throw youError(
          "YOU_OPERATOR_SIGNOFF_INVALID",
          `operator ${input.operatorId} not found — every sign-off is signed by a registered release operator (fail closed)`,
          { reason: "unknown-operator", operatorId: input.operatorId },
        );
      }
      const latest = state.checklists.at(-1) ?? null;
      if (!latest) {
        throw youError(
          "YOU_OPERATOR_SIGNOFF_INVALID",
          "no launch-gate checklist is recorded — a sign-off references a COMPLETE passing checklist (a sign-off without a passing gate never lands)",
          { reason: "no-checklist" },
        );
      }
      if (!releaseChecklistGatePasses(latest)) {
        throw youError(
          "YOU_OPERATOR_SIGNOFF_INVALID",
          `checklist ${latest.id} has not passed the gate (${latest.points.filter((point) => point.passed).length}/${latest.points.length} points) — a sign-off references a COMPLETE passing checklist, never a partial one`,
          {
            reason: "gate-not-passing",
            checklistId: latest.id,
            pointsTotal: latest.points.length,
          },
        );
      }
      if (releaseChecklistIsSigned(snapshot(), latest.id)) {
        throw youError(
          "YOU_OPERATOR_SIGNOFF_INVALID",
          `checklist ${latest.id} is already signed — the sign-off is a final immutable decision taken exactly once`,
          { reason: "checklist-already-signed", checklistId: latest.id },
        );
      }
      const record: OperatorSignoffRecord = {
        id: nextId("fx-r-signoff"),
        checklistRef: latest.id,
        signedBy: releaseContentBinding(`operator:${operator.operatorKey}`).contentRef,
        signedAt: clockNow(),
        simulated: true,
      };
      state.signoffs = [...state.signoffs, record];
      appendEvent("operator-signoff-recorded", record.id, {
        signoffId: record.id,
        checklistRef: record.checklistRef,
        signedBy: record.signedBy,
        signedAt: record.signedAt,
        simulated: true,
      });
      return { ...record };
    },

    async declareRelease(
      input: DeclareReleaseInput,
    ): Promise<ReleaseDeclarationRecord> {
      if (!state) {
        throw invalidState("release-not-loaded", "release studio is not loaded");
      }
      const latestSignoff = state.signoffs.at(-1) ?? null;
      if (!latestSignoff) {
        throw youError(
          "YOU_RELEASE_DECLARATION_INVALID",
          "no operator sign-off is recorded — a release declaration references a sign-off (a declaration without a sign-off never lands)",
          { reason: "no-signoff" },
        );
      }
      if (releaseSignoffIsDeclared(snapshot(), latestSignoff.id)) {
        throw youError(
          "YOU_RELEASE_DECLARATION_INVALID",
          `sign-off ${latestSignoff.id} already carries a release declaration — one release declaration per sign-off`,
          { reason: "signoff-already-declared", signoffId: latestSignoff.id },
        );
      }
      const bundle = storyboardReleaseEvidenceBundleById(input.evidenceBundleId);
      if (!bundle || !bundle.valid) {
        throw youError(
          "YOU_RELEASE_DECLARATION_INVALID",
          `evidence bundle ${input.evidenceBundleId} not found — every declaration carries the FULL evidence bundle (fail closed)`,
          { reason: "unknown-evidence-bundle", bundleId: input.evidenceBundleId },
        );
      }
      if (bundle.journeyCount <= 0) {
        throw youError(
          "YOU_RELEASE_DECLARATION_INVALID",
          `evidence bundle ${bundle.bundleKey} is empty (${bundle.journeyCount} journey records) — the declaration carries the FULL evidence bundle, never an empty one`,
          { reason: "empty-evidence-bundle", bundleId: bundle.id },
        );
      }
      const rollback = storyboardReleaseRollbackEvidenceById(
        input.rollbackEvidenceId,
      );
      if (!rollback || !rollback.valid) {
        throw youError(
          "YOU_RELEASE_DECLARATION_INVALID",
          `rollback evidence ${input.rollbackEvidenceId} not found — the declaration carries rollback evidence (the production-eligibility law carried to the release)`,
          { reason: "missing-rollback-evidence", rollbackId: input.rollbackEvidenceId },
        );
      }
      const record: ReleaseDeclarationRecord = {
        id: nextId("fx-r-declaration"),
        signoffRef: latestSignoff.id,
        evidenceBundleRef: releaseContentBinding(`bundle:${bundle.bundleKey}`).contentRef,
        rollbackEvidenceRef: releaseContentBinding(
          `rollback:${rollback.rollbackKey}`,
        ).contentRef,
        declaredAt: clockNow(),
        simulated: true,
      };
      state.declarations = [...state.declarations, record];
      appendEvent("release-declared", record.id, {
        declarationId: record.id,
        signoffRef: record.signoffRef,
        evidenceBundleRef: record.evidenceBundleRef,
        rollbackEvidenceRef: record.rollbackEvidenceRef,
        declaredAt: record.declaredAt,
        simulated: true,
      });
      return { ...record };
    },
  };

  return controller;
}
