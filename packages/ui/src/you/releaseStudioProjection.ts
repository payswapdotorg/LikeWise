// YOU Release Studio — 视图纯投影（W12B）。
//
// 只做确定性视图数学：launch-gate checklist 行（20 点 pass 态 + journey-evidence
// 链接 verbatim——LAUNCH GATE LAW 的可见面）、operator sign-off 行（signed-by /
// signed-at / 被引用 checklist 的门态——OPERATOR SIGNOFF LAW 的可见面）、
// release declaration 行（signoff 链接 + evidence bundle + rollback 链接——
// RELEASE DECLARATION LAW 的可见面）、区域 loading/empty 视图模型、键盘转移
//（与兄弟表面同级的键盘可用性）、各平面草稿视图模型。无 DOM、无随机、无计时器
//（FIXTURES 法则 1/2）。
import type {
  LaunchGateChecklistRecord,
  OperatorSignoffRecord,
  ReleaseDeclarationRecord,
} from "@zcode/shared";
import type {
  ReleaseDeclarationGateView,
  ReleaseSignoffGateView,
  ReleaseStudioSnapshot,
} from "./releaseController.js";
import {
  releaseChecklistById,
  releaseChecklistGatePasses,
  releaseChecklistIsSigned,
  releaseSignoffIsDeclared,
} from "./releaseController.js";
import {
  storyboardChecklistGateState,
} from "./releaseStoryboardLaws.js";

// ---------------------------------------------------------------------------
// Checklist 显示行（LAUNCH GATE LAW：a point passes ONLY with a successful
// E2eJourneyRecord reference —— never a bare assertion）
// ---------------------------------------------------------------------------

export interface ReleaseChecklistPointRow {
  readonly point: number;
  readonly description: string;
  /** journey evidence 引用（null = 无证据——该点绝不显示为通过）。 */
  readonly journeyEvidenceRef: string | null;
  readonly passed: boolean;
}

export interface ReleaseChecklistRow {
  readonly checklistId: string;
  readonly checkedAt: string;
  readonly pointsTotal: number;
  readonly pointsPassed: number;
  /** counts 复合（显示面主文案："{passed}/{total}"——绝不 bare pass）。 */
  readonly countsLabel: string;
  /** 门态（次要显示——每点 pass 态本身才是 launch-gate 陈述）。 */
  readonly gateState: "all-points-passed" | "incomplete" | "empty";
  /** checklist 是否已被签署（OPERATOR SIGNOFF LAW 显示面）。 */
  readonly signed: boolean;
  /** 20 点逐点投影（pass 态 + journey-evidence 链接 verbatim）。 */
  readonly points: readonly ReleaseChecklistPointRow[];
  readonly accessibleLabel: string;
}

export function projectReleaseChecklistRows(
  snapshot: ReleaseStudioSnapshot | null,
  checklists: readonly LaunchGateChecklistRecord[],
): readonly ReleaseChecklistRow[] {
  return checklists.map((checklist) => {
    const pointsPassed = checklist.points.filter(
      (point) => point.passed,
    ).length;
    return {
      checklistId: checklist.id,
      checkedAt: checklist.checkedAt,
      pointsTotal: checklist.points.length,
      // LAUNCH GATE LAW 显示面：counts verbatim 同框——绝不 bare pass。
      pointsPassed,
      countsLabel: `${pointsPassed}/${checklist.points.length}`,
      gateState: storyboardChecklistGateState(
        checklist.points.length,
        pointsPassed,
      ),
      signed: releaseChecklistIsSigned(snapshot, checklist.id),
      points: checklist.points.map((point) => ({
        point: point.point,
        description: point.description,
        journeyEvidenceRef: point.journeyEvidenceRef,
        passed: point.passed,
      })),
      accessibleLabel: `launch-gate checklist ${checklist.id}: ${pointsPassed} of ${checklist.points.length} points passed${releaseChecklistGatePasses(checklist) ? ", gate passed" : pointsPassed <= 0 ? ", gate not evaluated" : ", gate not passed"}${releaseChecklistIsSigned(snapshot, checklist.id) ? ", signed off" : ""}, checked ${checklist.checkedAt}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Sign-off 显示行（OPERATOR SIGNOFF LAW：signed-by / signed-at / 被引用
// checklist——引用 COMPLETE passing checklist 的一次性最终决定）
// ---------------------------------------------------------------------------

export interface ReleaseSignoffRow {
  readonly signoffId: string;
  /** 签署者内容寻址标签（signedBy 落账值，verbatim）。 */
  readonly signedBy: string;
  /** 注册面解析的签署者显示名（未知 → null——UI 不猜测）。 */
  readonly signedByDisplayName: string | null;
  readonly signedAt: string;
  /** 被引用 checklist id。 */
  readonly checklistRef: string;
  /** 被引用 checklist 的 counts 复合（未知 → null）。 */
  readonly checklistCountsLabel: string | null;
  /** 被引用 checklist 是否处于 gate-passing 态（未知 → null）。 */
  readonly checklistGatePasses: boolean | null;
  /** 本 signoff 是否已携带 declaration（one release per signoff 显示面）。 */
  readonly declared: boolean;
  readonly accessibleLabel: string;
}

export function projectReleaseSignoffRows(
  snapshot: ReleaseStudioSnapshot | null,
  signoffs: readonly OperatorSignoffRecord[],
): readonly ReleaseSignoffRow[] {
  return signoffs.map((signoff) => {
    const checklist = releaseChecklistById(snapshot, signoff.checklistRef);
    const pointsPassed = checklist
      ? checklist.points.filter((point) => point.passed).length
      : null;
    const operator = snapshot?.operators.find(
      (candidate) => candidate.operatorRef === signoff.signedBy,
    );
    return {
      signoffId: signoff.id,
      // OPERATOR SIGNOFF LAW 显示面：signed-by / signed-at verbatim。
      signedBy: signoff.signedBy,
      signedByDisplayName: operator?.displayName ?? null,
      signedAt: signoff.signedAt,
      checklistRef: signoff.checklistRef,
      checklistCountsLabel:
        checklist && pointsPassed !== null
          ? `${pointsPassed}/${checklist.points.length}`
          : null,
      checklistGatePasses: checklist
        ? releaseChecklistGatePasses(checklist)
        : null,
      declared: releaseSignoffIsDeclared(snapshot, signoff.id),
      accessibleLabel: `operator sign-off ${signoff.id}: signed by ${signoff.signedBy}${operator ? ` (${operator.displayName})` : ""} at ${signoff.signedAt}, referencing checklist ${signoff.checklistRef}${checklist && pointsPassed !== null ? ` (${pointsPassed}/${checklist.points.length} points, gate ${releaseChecklistGatePasses(checklist) ? "passed" : "not passed"})` : ""}${releaseSignoffIsDeclared(snapshot, signoff.id) ? ", release declared" : ""}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Declaration 显示行（RELEASE DECLARATION LAW：evidence bundle + rollback
// 链接——production-eligibility law carried to the release）
// ---------------------------------------------------------------------------

export interface ReleaseDeclarationRow {
  readonly declarationId: string;
  readonly signoffRef: string;
  /** evidence bundle 内容寻址标签（evidenceBundleRef 落账值，verbatim）。 */
  readonly evidenceBundleRef: string;
  /** 注册面解析的 bundle journey 计数（未知 → null）。 */
  readonly evidenceBundleJourneyCount: number | null;
  /** rollback evidence 内容寻址标签（rollbackEvidenceRef 落账值，verbatim）。 */
  readonly rollbackEvidenceRef: string;
  /** 注册面解析的 rollback 演练描述（未知 → null）。 */
  readonly rollbackDrill: string | null;
  readonly declaredAt: string;
  readonly accessibleLabel: string;
}

export function projectReleaseDeclarationRows(
  snapshot: ReleaseStudioSnapshot | null,
  declarations: readonly ReleaseDeclarationRecord[],
): readonly ReleaseDeclarationRow[] {
  return declarations.map((declaration) => {
    const bundle = snapshot?.evidenceBundles.find(
      (candidate) => candidate.bundleRef === declaration.evidenceBundleRef,
    );
    const rollback = snapshot?.rollbackEvidence.find(
      (candidate) => candidate.rollbackRef === declaration.rollbackEvidenceRef,
    );
    return {
      declarationId: declaration.id,
      signoffRef: declaration.signoffRef,
      // RELEASE DECLARATION LAW 显示面：bundle + rollback 链接 verbatim。
      evidenceBundleRef: declaration.evidenceBundleRef,
      evidenceBundleJourneyCount: bundle?.journeyCount ?? null,
      rollbackEvidenceRef: declaration.rollbackEvidenceRef,
      rollbackDrill: rollback?.drill ?? null,
      declaredAt: declaration.declaredAt,
      accessibleLabel: `release declaration ${declaration.id}: sign-off ${declaration.signoffRef}, evidence bundle ${declaration.evidenceBundleRef}${bundle ? ` (${bundle.journeyCount} journey records)` : ""}, rollback evidence ${declaration.rollbackEvidenceRef}${rollback ? ` (${rollback.drill})` : ""}, declared ${declaration.declaredAt}`,
    };
  });
}

// ---------------------------------------------------------------------------
// 区域视图模型（每个面板区域的 loading / empty / ready）
// ---------------------------------------------------------------------------

export type ReleaseRegionView = "loading" | "empty" | "ready";

/** 列表区域的确定性视图模型（无快照 → loading；有快照无数据 → empty）。 */
export function projectReleaseListRegionView(
  hasSnapshot: boolean,
  count: number,
): ReleaseRegionView {
  if (!hasSnapshot) return "loading";
  if (count === 0) return "empty";
  return "ready";
}

// ---------------------------------------------------------------------------
// 键盘转移（与 Solution/Capture/…/Conformance 表面一致的键盘导航可用性）
// ---------------------------------------------------------------------------

export type ReleaseListKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "select" }
  | { readonly kind: "none" };

/**
 * checklist 记录列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末项；Enter：选中当前记录（检视详情）；
 * - 其余键 no-op。
 */
export function resolveReleaseKeyboardTransition(
  key: string,
  state: { readonly totalChecklists: number },
): ReleaseListKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalChecklists };
    case "End":
      return { kind: "move", delta: state.totalChecklists };
    case "Enter":
      return { kind: "select" };
    default:
      return { kind: "none" };
  }
}

/** checklist 光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampReleaseIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, index));
}

// ---------------------------------------------------------------------------
// 草稿视图（各平面挑选的纯视图模型）
// ---------------------------------------------------------------------------

export interface ChecklistDraftView {
  readonly journeyId: string;
  /** run 按钮禁用原因（null = 可执行——incomplete journey 是诚实落账态，非 UI
   *  禁用：让 16/20 的 checklist 可见可测）。 */
  readonly disabledReason: "unknown-journey" | null;
  readonly totalSteps: number | null;
  /** 该 journey 的证据覆盖投影（前 evidenceSteps 点将有 journey evidence）。 */
  readonly evidenceSteps: number | null;
}

/** checklist 草稿 + 注册面 → run 确认区视图模型。 */
export function projectChecklistDraftView(
  draft: { readonly journeyId: string },
  journeys: readonly {
    readonly id: string;
    readonly steps: readonly string[];
    readonly evidenceSteps: number;
    readonly valid: boolean;
  }[],
): ChecklistDraftView {
  const journey = journeys.find((entry) => entry.id === draft.journeyId);
  if (!journey || !journey.valid) {
    return {
      journeyId: draft.journeyId,
      disabledReason: "unknown-journey",
      totalSteps: null,
      evidenceSteps: null,
    };
  }
  return {
    journeyId: draft.journeyId,
    disabledReason: null,
    totalSteps: journey.steps.length,
    evidenceSteps: journey.evidenceSteps,
  };
}

/** signoff 门草稿视图（门显示独立呈现——服务端独立强制）。 */
export interface SignoffDraftView {
  readonly operatorId: string;
  /** 门显示（projectReleaseSignoffGate 的投影面）。 */
  readonly gate: ReleaseSignoffGateView;
}

/** signoff 草稿 → record 确认区视图模型。 */
export function projectSignoffDraftView(
  draft: { readonly operatorId: string },
  gate: ReleaseSignoffGateView,
): SignoffDraftView {
  return { ...draft, gate };
}

/** declaration 门草稿视图（门显示独立呈现——服务端独立强制）。 */
export interface DeclarationDraftView {
  readonly evidenceBundleId: string;
  readonly rollbackEvidenceId: string;
  /** 门显示（projectReleaseDeclarationGate 的投影面）。 */
  readonly gate: ReleaseDeclarationGateView;
}

/** declaration 草稿 → declare 确认区视图模型。 */
export function projectDeclarationDraftView(
  draft: {
    readonly evidenceBundleId: string;
    readonly rollbackEvidenceId: string;
  },
  gate: ReleaseDeclarationGateView,
): DeclarationDraftView {
  return { ...draft, gate };
}
