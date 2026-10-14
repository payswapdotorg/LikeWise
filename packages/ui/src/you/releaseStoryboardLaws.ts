// YOU Release Studio — W12B 剧本法则（无状态校验器 + 法则评估器）。
//
// 从 `releaseStoryboard.ts` 按模块内聚拆分（保持仓库 400 行纪律——与
// W4B-W11B 的 laws 拆分同款先例）：本文件承载 W12A launch-gate 服务语义的
// UI 侧镜像 —— checklist point 通过法则（LAUNCH GATE LAW：point passes ONLY
// with a successful E2eJourneyRecord reference —— never a bare assertion）/
// sign-off 门（OPERATOR SIGNOFF LAW：signoff references a COMPLETE passing
// checklist; immutable; one release declaration per signoff）/ declaration
// 法则（RELEASE DECLARATION LAW：evidence bundle + rollback evidence 都必须在
// 场）。全部无状态、无随机（FIXTURES 法则 1/2；时间比较由调用方传入事实——
// 校验器自身无时钟）；契约类型一律从 `@zcode/shared` 导入（frozen v12）。
import type {
  LaunchGateChecklistRecord,
  OperatorSignoffRecord,
  ReleaseDeclarationRecord,
} from "@zcode/shared";
import { RELEASE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS } from "./releaseStoryboard.js";

// ---------------------------------------------------------------------------
// Checklist 法则（LAUNCH GATE LAW：a point passes ONLY with a successful
// E2eJourneyRecord reference —— never a bare assertion；the gate passes ONLY
// when all 20 points pass）
// ---------------------------------------------------------------------------

/**
 * point 是否可判为通过（LAUNCH GATE LAW 的求值核）：仅当 journey evidence
 * 引用在场（非 null）才允许 passed=true——bare assertion 永远不是通过依据。
 */
export function storyboardChecklistPointPasses(
  journeyEvidenceRef: string | null,
): boolean {
  return journeyEvidenceRef !== null;
}

/** checklist 的点数是否齐 20（完整 checklist 的形状前提）。 */
export function storyboardChecklistIsComplete(
  pointsTotal: number,
): boolean {
  return pointsTotal === RELEASE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS;
}

/** checklist 的门态（次要显示——每点 pass 态本身才是 launch-gate 陈述）。 */
export function storyboardChecklistGateState(
  pointsTotal: number,
  pointsPassed: number,
): "all-points-passed" | "incomplete" | "empty" {
  if (pointsTotal <= 0 || pointsPassed <= 0) return "empty";
  if (
    storyboardChecklistIsComplete(pointsTotal) &&
    pointsPassed >= pointsTotal
  ) {
    return "all-points-passed";
  }
  return "incomplete";
}

/**
 * checklist 记录是否处于 gate-passing 态（LAUNCH GATE LAW：the gate passes
 * ONLY when all 20 points pass——20 点齐且全过）。
 */
export function storyboardChecklistGatePasses(
  checklist: LaunchGateChecklistRecord,
): boolean {
  return (
    storyboardChecklistIsComplete(checklist.points.length) &&
    checklist.points.every((point) => point.passed)
  );
}

// ---------------------------------------------------------------------------
// Sign-off 门法则（OPERATOR SIGNOFF LAW：the signoff references a COMPLETE
// passing checklist; it is immutable; one release declaration per signoff）
// ---------------------------------------------------------------------------

/** sign-off 门 reason 分类（固定求值序，fail closed）。 */
export type StoryboardSignoffGateReason =
  | "granted"
  | "no-checklist"
  | "gate-not-passing"
  | "checklist-already-signed"
  | "unknown-operator";

export interface StoryboardSignoffGate {
  readonly allowed: boolean;
  readonly reason: StoryboardSignoffGateReason;
}

/**
 * sign-off 门固定求值序（W12A 服务强制面的 UI 侧镜像）：无 checklist ->
 * 最新 checklist 未过门 -> checklist 已被签署（signoff 是一次性最终决定）->
 * 未注册 operator -> granted。
 */
export function evaluateStoryboardSignoffGate(input: {
  readonly checklistExists: boolean;
  readonly checklistGatePasses: boolean;
  readonly checklistAlreadySigned: boolean;
  readonly operatorKnown: boolean;
}): StoryboardSignoffGate {
  if (!input.checklistExists) {
    return { allowed: false, reason: "no-checklist" };
  }
  if (!input.checklistGatePasses) {
    return { allowed: false, reason: "gate-not-passing" };
  }
  if (input.checklistAlreadySigned) {
    return { allowed: false, reason: "checklist-already-signed" };
  }
  if (!input.operatorKnown) {
    return { allowed: false, reason: "unknown-operator" };
  }
  return { allowed: true, reason: "granted" };
}

/**
 * checklist 是否已被签署（OPERATOR SIGNOFF LAW「immutable」的显示面：signoff
 * 落账后该 checklist 的签署即定局——重复签署是 typed 拒绝路径）。
 */
export function storyboardChecklistIsSigned(
  signoffs: readonly OperatorSignoffRecord[],
  checklistId: string,
): boolean {
  return signoffs.some(
    (signoff) => signoff.checklistRef === checklistId,
  );
}

/**
 * signoff 是否已携带 release declaration（OPERATOR SIGNOFF LAW「one release
 * declaration per signoff」的显示面）。
 */
export function storyboardSignoffIsDeclared(
  declarations: readonly ReleaseDeclarationRecord[],
  signoffId: string,
): boolean {
  return declarations.some(
    (declaration) => declaration.signoffRef === signoffId,
  );
}

// ---------------------------------------------------------------------------
// Declaration 门法则（RELEASE DECLARATION LAW：the declaration carries the
// full evidence bundle AND rollback evidence —— the production-eligibility law
// carried to the release）
// ---------------------------------------------------------------------------

/** declaration 门 reason 分类（固定求值序，fail closed）。 */
export type StoryboardDeclarationGateReason =
  | "granted"
  | "no-signoff"
  | "signoff-already-declared"
  | "unknown-evidence-bundle"
  | "empty-evidence-bundle"
  | "missing-rollback-evidence";

export interface StoryboardDeclarationGate {
  readonly allowed: boolean;
  readonly reason: StoryboardDeclarationGateReason;
}

/**
 * declaration 门固定求值序（W12A 服务强制面的 UI 侧镜像）：无 signoff ->
 * signoff 已声明（one release per signoff）-> 未注册 bundle -> 空 bundle（非
 * full evidence bundle）-> 缺 rollback evidence -> granted。
 */
export function evaluateStoryboardDeclarationGate(input: {
  readonly signoffExists: boolean;
  readonly signoffAlreadyDeclared: boolean;
  readonly evidenceBundleKnown: boolean;
  readonly evidenceBundleIsFull: boolean;
  readonly rollbackEvidenceKnown: boolean;
}): StoryboardDeclarationGate {
  if (!input.signoffExists) {
    return { allowed: false, reason: "no-signoff" };
  }
  if (input.signoffAlreadyDeclared) {
    return { allowed: false, reason: "signoff-already-declared" };
  }
  if (!input.evidenceBundleKnown) {
    return { allowed: false, reason: "unknown-evidence-bundle" };
  }
  if (!input.evidenceBundleIsFull) {
    return { allowed: false, reason: "empty-evidence-bundle" };
  }
  if (!input.rollbackEvidenceKnown) {
    return { allowed: false, reason: "missing-rollback-evidence" };
  }
  return { allowed: true, reason: "granted" };
}

/**
 * evidence bundle 是否「full」（RELEASE DECLARATION LAW：carries the FULL
 * evidence bundle——零 journey 的 bundle 不是声明依据）。
 */
export function storyboardEvidenceBundleIsFull(
  journeyCount: number,
): boolean {
  return journeyCount > 0;
}
