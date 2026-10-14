// YOU Release Studio — ReleaseStudioController 端口（W12B）。
//
// 边界（docs/you/WORK_ORDERS.md W12B / docs/you/CONTRACTS.md "Wave-12 contract
// freeze (v12)"）：
// - 本文件只定义 UI 消费的服务端口；launch-gate 的 canonical truth 属于 Worker
//   A 的 launch-gate authority 服务（W12A：20 点 checklist 装配、operator
//   sign-off、release declaration）与 Worker C 的 gate-evidence 服务（W12C：
//   evidence bundle builder、checklist derivation、golden gate run）。UI 不实现
//   领域逻辑。
// - 端口形状镜像 W12A/W12C 服务接缝 1:1（launch-gate check / operator signoff /
//   release declaration —— T12 换绑时逐方法对位，W8B-W11B 先例同款）。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v12 `you/contract.ts`），禁止
//   本地重声明。
// - Phase 0 的实现是 `releaseSimulatedController.ts` 的确定性剧本；
//   TODO(T12): bind to Worker A/C 的 launch-gate 服务（TL 在 T12 换绑本端口）。
// - LAUNCH GATE LAW：a point passes ONLY with a successful E2eJourneyRecord
//   reference —— never a bare assertion；the gate passes ONLY when all 20
//   points pass（YOU_LAUNCH_GATE_INVALID）。
// - OPERATOR SIGNOFF LAW：the signoff references a COMPLETE passing checklist；
//   it is immutable；one release declaration per signoff
//   （YOU_OPERATOR_SIGNOFF_INVALID）。
// - RELEASE DECLARATION LAW：the declaration carries the full evidence bundle
//   AND rollback evidence —— the production-eligibility law carried to the
//   release（YOU_RELEASE_DECLARATION_INVALID）。
// - 事件词汇（frozen additive wave-12）：launch-gate-checked /
//   operator-signoff-recorded / release-declared + solution-created。
import type {
  LaunchGateChecklistRecord,
  OpaqueId,
  OperatorSignoffRecord,
  ReleaseDeclarationRecord,
  SolutionEvent,
  YouError,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 记录）
// ---------------------------------------------------------------------------

export interface ReleaseStudioLoadRequest {
  readonly workspaceKey: string;
}

/** 装配一次 launch-gate check（20 点 checklist 从 journey evidence 派生）。 */
export interface RunLaunchGateCheckInput {
  readonly journeyId: string;
}

/** 记录一次 operator sign-off（引用最新 COMPLETE passing checklist）。 */
export interface RecordOperatorSignoffInput {
  readonly operatorId: string;
}

/**
 * 声明一次 release（引用最新 live signoff + evidence bundle + rollback
 * evidence——RELEASE DECLARATION LAW 的两端都必须显式给到）。
 */
export interface DeclareReleaseInput {
  readonly evidenceBundleId: string;
  readonly rollbackEvidenceId: string;
}

// ---------------------------------------------------------------------------
// 注册面视图（W12A/W12C 服务接缝的声明侧镜像；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** gate journey 注册面视图（20 点 launch-gate 步骤表 + 证据覆盖面）。 */
export interface ReleaseJourneyView {
  readonly id: string;
  readonly journeyId: string;
  readonly steps: readonly string[];
  /** 已有成功 E2eJourneyRecord 证据的步骤数（1..20）。 */
  readonly evidenceSteps: number;
  /** 形状合法（未注册 journey = 诚实 typed 拒绝路径）。 */
  readonly valid: boolean;
}

/** release operator 注册面视图（sign-off 动作的签署者来源）。 */
export interface ReleaseOperatorView {
  readonly id: string;
  /** 操作者内容寻址标签（signedBy 落账值）。 */
  readonly operatorRef: string;
  readonly displayName: string;
  /** 形状合法（未注册 operator = 诚实 typed 拒绝路径）。 */
  readonly valid: boolean;
}

/** evidence bundle 注册面视图（W12C bundle builder 的声明侧镜像）。 */
export interface ReleaseEvidenceBundleView {
  readonly id: string;
  /** bundle 内容寻址标签（evidenceBundleRef 落账值）。 */
  readonly bundleRef: string;
  /** bundle 内的 E2eJourneyRecord 数（full bundle 显示面）。 */
  readonly journeyCount: number;
  /** 形状合法（未注册 bundle = 诚实 typed 拒绝路径）。 */
  readonly valid: boolean;
}

/** rollback evidence 注册面视图（W10C production-eligibility 的声明侧镜像）。 */
export interface ReleaseRollbackEvidenceView {
  readonly id: string;
  /** rollback 证据内容寻址标签（rollbackEvidenceRef 落账值）。 */
  readonly rollbackRef: string;
  /** 演练描述（verbatim）。 */
  readonly drill: string;
  /** 形状合法（未注册 rollback = 诚实 typed 拒绝路径）。 */
  readonly valid: boolean;
}

export interface ReleaseStudioSnapshot {
  readonly displayName: string;
  /** 表面身份（workspace 级；一个 workspace 一个 release 表面）。 */
  readonly studioId: OpaqueId;
  /** gate journey 注册面（launch-gate check 动作的数据源）。 */
  readonly journeys: readonly ReleaseJourneyView[];
  /** release operator 注册面（signoff 动作的数据源）。 */
  readonly operators: readonly ReleaseOperatorView[];
  /** evidence bundle 注册面（declaration 动作的数据源之一）。 */
  readonly evidenceBundles: readonly ReleaseEvidenceBundleView[];
  /** rollback evidence 注册面（declaration 动作的数据源之一）。 */
  readonly rollbackEvidence: readonly ReleaseRollbackEvidenceView[];
  /** launch-gate checklist 记录（不可变；id 升序）。 */
  readonly checklists: readonly LaunchGateChecklistRecord[];
  /** operator sign-off 记录（不可变；id 升序）。 */
  readonly signoffs: readonly OperatorSignoffRecord[];
  /** release declaration 记录（不可变；id 升序）。 */
  readonly declarations: readonly ReleaseDeclarationRecord[];
  /** append-only 事件账本投影（v12 launch-gate 事件）。 */
  readonly events: readonly SolutionEvent[];
  /** 服务端投影时刻（确定性——非 UI 本地时钟）。 */
  readonly projectedAt: string;
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class ReleaseStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "ReleaseStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Release Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T12 换绑 Worker A/C
 * 的 launch-gate 服务。方法走应用服务权威（UI/HTTP/SDK/MCP 同一权威）。
 */
export interface ReleaseStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实门。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：release 平面已存在时返回当前快照，不重建。 */
  load(request: ReleaseStudioLoadRequest): Promise<ReleaseStudioSnapshot>;
  refresh(): Promise<ReleaseStudioSnapshot>;

  // -- launch gate 平面（LAUNCH GATE LAW） --
  /**
   * 装配一次 20 点 checklist：point N 的通过仅来自 point-N journey evidence
   *（W12C derivation 的端口面）；未注册 journey ⇒ typed
   * YOU_LAUNCH_GATE_INVALID 拒绝（fail closed）；launch-gate-checked 事件。
   * incomplete checklist 是诚实落账态（16/20 的 checklist 落账为未过门——
   * 绝不装扮成通过）。
   */
  runLaunchGateCheck(
    input: RunLaunchGateCheckInput,
  ): Promise<LaunchGateChecklistRecord>;

  // -- operator signoff 平面（OPERATOR SIGNOFF LAW） --
  /**
   * 记录一次 sign-off：引用最新 COMPLETE passing checklist（无 checklist /
   * 最新 checklist 未过门 ⇒ typed YOU_OPERATOR_SIGNOFF_INVALID——signoff
   * without a passing gate 绝不落账）；checklist 已被签署 ⇒ typed 拒绝
   *（signoff 是一次性最终决定）；未注册 operator ⇒ typed 拒绝；
   * operator-signoff-recorded 事件。
   */
  recordOperatorSignoff(
    input: RecordOperatorSignoffInput,
  ): Promise<OperatorSignoffRecord>;

  // -- release declaration 平面（RELEASE DECLARATION LAW） --
  /**
   * 声明一次 release：引用最新 live signoff + full evidence bundle + rollback
   * evidence；无 signoff / signoff 已声明（one release per signoff）/ 未注册
   * 或空 bundle / 缺 rollback evidence ⇒ typed
   * YOU_RELEASE_DECLARATION_INVALID；release-declared 事件。
   */
  declareRelease(
    input: DeclareReleaseInput,
  ): Promise<ReleaseDeclarationRecord>;
}

// ---------------------------------------------------------------------------
// Sign-off / declaration 门纯投影（「checklist-complete-passing +
// one-release-per-signoff + bundle-and-rollback-both-required」必须可见且可
// 测；UI 显示面——服务端独立强制）
// ---------------------------------------------------------------------------

export interface ReleaseSignoffGateView {
  readonly allowed: boolean;
  readonly reason:
    | "granted"
    | "no-checklist"
    | "gate-not-passing"
    | "checklist-already-signed"
    | "unknown-operator";
}

/**
 * 快照事实 + 草稿 → 门视图（求值固定序；fail closed；投影只显示，服务端独立
 * 强制）。signoff 引用 COMPLETE passing checklist 是 OPERATOR SIGNOFF LAW 的
 * 显示面。
 */
export function projectReleaseSignoffGate(
  snapshot: ReleaseStudioSnapshot | null,
  operatorId: string | null,
): ReleaseSignoffGateView {
  const operator = snapshot?.operators.find(
    (candidate) => candidate.id === operatorId,
  );
  if (!snapshot || operatorId === null) {
    return { allowed: false, reason: "unknown-operator" };
  }
  const latest = snapshot.checklists.at(-1) ?? null;
  if (!latest) {
    return { allowed: false, reason: "no-checklist" };
  }
  if (!releaseChecklistGatePasses(latest)) {
    return { allowed: false, reason: "gate-not-passing" };
  }
  if (releaseChecklistIsSigned(snapshot, latest.id)) {
    return { allowed: false, reason: "checklist-already-signed" };
  }
  if (!operator || !operator.valid) {
    return { allowed: false, reason: "unknown-operator" };
  }
  return { allowed: true, reason: "granted" };
}

export interface ReleaseDeclarationGateView {
  readonly allowed: boolean;
  readonly reason:
    | "granted"
    | "no-signoff"
    | "signoff-already-declared"
    | "unknown-evidence-bundle"
    | "empty-evidence-bundle"
    | "missing-rollback-evidence";
}

/**
 * 快照事实 + 草稿 → declaration 门视图（求值固定序；fail closed；投影只显示，
 * 服务端独立强制）。evidence bundle + rollback evidence 双在场是 RELEASE
 * DECLARATION LAW 的显示面。
 */
export function projectReleaseDeclarationGate(
  snapshot: ReleaseStudioSnapshot | null,
  evidenceBundleId: string | null,
  rollbackEvidenceId: string | null,
): ReleaseDeclarationGateView {
  if (!snapshot) {
    return { allowed: false, reason: "no-signoff" };
  }
  const latestSignoff = snapshot.signoffs.at(-1) ?? null;
  if (!latestSignoff) {
    return { allowed: false, reason: "no-signoff" };
  }
  if (
    snapshot.declarations.some(
      (declaration) => declaration.signoffRef === latestSignoff.id,
    )
  ) {
    return { allowed: false, reason: "signoff-already-declared" };
  }
  const bundle = snapshot.evidenceBundles.find(
    (candidate) => candidate.id === evidenceBundleId,
  );
  if (!bundle || !bundle.valid) {
    return { allowed: false, reason: "unknown-evidence-bundle" };
  }
  if (bundle.journeyCount <= 0) {
    return { allowed: false, reason: "empty-evidence-bundle" };
  }
  const rollback = snapshot.rollbackEvidence.find(
    (candidate) => candidate.id === rollbackEvidenceId,
  );
  if (!rollback || !rollback.valid) {
    return { allowed: false, reason: "missing-rollback-evidence" };
  }
  return { allowed: true, reason: "granted" };
}

// ---------------------------------------------------------------------------
// 快照选择器（W1B–W11B currentSolutionVersion 等同款模式）
// ---------------------------------------------------------------------------

/** checklist 记录列表（id 升序）。 */
export function orderedReleaseChecklists(
  snapshot: ReleaseStudioSnapshot | null,
): readonly LaunchGateChecklistRecord[] {
  if (!snapshot) return [];
  return snapshot.checklists;
}

/** 按 id 解析 checklist 记录（未知 id → null；UI 显式呈现未知态，不猜测）。 */
export function releaseChecklistById(
  snapshot: ReleaseStudioSnapshot | null,
  checklistId: string | null,
): LaunchGateChecklistRecord | null {
  if (!snapshot || checklistId === null) return null;
  return snapshot.checklists.find((entry) => entry.id === checklistId) ?? null;
}

/** 最新 live checklist（id 升序末位；无 → null）。 */
export function liveReleaseChecklist(
  snapshot: ReleaseStudioSnapshot | null,
): LaunchGateChecklistRecord | null {
  if (!snapshot) return null;
  return snapshot.checklists.at(-1) ?? null;
}

/** checklist 的门通过态（LAUNCH GATE LAW 投影：20 点齐且全过）。 */
export function releaseChecklistGatePasses(
  checklist: LaunchGateChecklistRecord,
): boolean {
  return checklist.points.length === 20 && checklist.points.every(
    (point) => point.passed,
  );
}

/** checklist 是否已被签署（OPERATOR SIGNOFF LAW 投影：一次性最终决定）。 */
export function releaseChecklistIsSigned(
  snapshot: ReleaseStudioSnapshot | null,
  checklistId: string,
): boolean {
  if (!snapshot) return false;
  return snapshot.signoffs.some(
    (signoff) => signoff.checklistRef === checklistId,
  );
}

/** signoff 记录列表（id 升序）。 */
export function orderedReleaseSignoffs(
  snapshot: ReleaseStudioSnapshot | null,
): readonly OperatorSignoffRecord[] {
  if (!snapshot) return [];
  return snapshot.signoffs;
}

/** 按 id 解析 signoff 记录（未知 id → null）。 */
export function releaseSignoffById(
  snapshot: ReleaseStudioSnapshot | null,
  signoffId: string | null,
): OperatorSignoffRecord | null {
  if (!snapshot || signoffId === null) return null;
  return snapshot.signoffs.find((entry) => entry.id === signoffId) ?? null;
}

/** 最新 live signoff（id 升序末位；无 → null）。 */
export function liveReleaseSignoff(
  snapshot: ReleaseStudioSnapshot | null,
): OperatorSignoffRecord | null {
  if (!snapshot) return null;
  return snapshot.signoffs.at(-1) ?? null;
}

/** signoff 是否已携带 declaration（OPERATOR SIGNOFF LAW 投影：one per signoff）。 */
export function releaseSignoffIsDeclared(
  snapshot: ReleaseStudioSnapshot | null,
  signoffId: string,
): boolean {
  if (!snapshot) return false;
  return snapshot.declarations.some(
    (declaration) => declaration.signoffRef === signoffId,
  );
}

/** declaration 记录列表（id 升序）。 */
export function orderedReleaseDeclarations(
  snapshot: ReleaseStudioSnapshot | null,
): readonly ReleaseDeclarationRecord[] {
  if (!snapshot) return [];
  return snapshot.declarations;
}

/** 按 id 解析 declaration 记录（未知 id → null）。 */
export function releaseDeclarationById(
  snapshot: ReleaseStudioSnapshot | null,
  declarationId: string | null,
): ReleaseDeclarationRecord | null {
  if (!snapshot || declarationId === null) return null;
  return (
    snapshot.declarations.find((entry) => entry.id === declarationId) ?? null
  );
}
