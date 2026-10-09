// YOU Capture Studio — 视图纯投影（W2B）。
//
// 只做确定性视图数学：引导采集进度、键盘转移（与 Solution 视口同级的键盘可用性）、
// 保留/同意显示辅助。无 DOM、无随机、无计时器（FIXTURES 法则 1/2）。
import type { CaptureSession, ConsentState } from "@zcode/shared";
import type { CaptureStepBinding } from "./captureController.js";

// ---------------------------------------------------------------------------
// 引导采集进度
// ---------------------------------------------------------------------------

export interface CaptureProgress {
  readonly totalSteps: number;
  /** 至少捕获过一次的引导步骤数。 */
  readonly capturedSteps: number;
  /** 已捕获的步骤 id 集合（稳定：按会话 guideSteps 顺序）。 */
  readonly capturedStepIds: readonly string[];
  /** 是否全部步骤均已捕获（可完成会话）。 */
  readonly complete: boolean;
}

/** 由步骤绑定集合推导会话进度（绑定是服务端事实的只读投影；追加序稳定）。 */
export function projectCaptureProgress(
  session: CaptureSession,
  stepBindings: readonly CaptureStepBinding[],
): CaptureProgress {
  const capturedStepIds = session.guideSteps
    .map((step) => step.id)
    .filter((stepId) =>
      stepBindings.some(
        (binding) => binding.captureSessionId === session.id && binding.stepId === stepId,
      ),
    );
  return {
    totalSteps: session.guideSteps.length,
    capturedSteps: capturedStepIds.length,
    capturedStepIds,
    complete:
      session.guideSteps.length > 0 && capturedStepIds.length === session.guideSteps.length,
  };
}

// ---------------------------------------------------------------------------
// 键盘转移（与 Solution 视口一致的键盘导航可用性；纯函数可测）
// ---------------------------------------------------------------------------

export type CaptureGuideKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "capture" }
  | { readonly kind: "none" };

/**
 * 引导步骤列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末步；Enter：捕获当前步（仅 active 会话）；
 * - 其余键 no-op。与 Solution 视口同款「键盘完全可用」的表面语义。
 */
export function resolveCaptureGuideKeyboardTransition(
  key: string,
  state: {
    readonly sessionActive: boolean;
    readonly totalSteps: number;
  },
): CaptureGuideKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalSteps };
    case "End":
      return { kind: "move", delta: state.totalSteps };
    case "Enter":
      return state.sessionActive ? { kind: "capture" } : { kind: "none" };
    default:
      return { kind: "none" };
  }
}

/** 步骤光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampGuideStepIndex(index: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  return Math.min(totalSteps - 1, Math.max(0, index));
}

// ---------------------------------------------------------------------------
// 显示辅助（确定性）
// ---------------------------------------------------------------------------

/** 保留显示态（truth law：清除后的记录仍显示，但标注不可用）。 */
export type EvidenceAvailability = "available" | "expired" | "purged";

export function projectEvidenceAvailability(
  evidenceId: string,
  retention: {
    readonly expiredEvidenceIds: readonly string[];
    readonly purgedEvidenceIds: readonly string[];
  },
): EvidenceAvailability {
  if (retention.purgedEvidenceIds.includes(evidenceId)) return "purged";
  if (retention.expiredEvidenceIds.includes(evidenceId)) return "expired";
  return "available";
}

/** 同意状态的稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
export function compareConsentStateRank(a: ConsentState, b: ConsentState): number {
  const rank: Record<ConsentState, number> = {
    granted: 0,
    unknown: 1,
    denied: 2,
    expired: 3,
    withdrawn: 4,
  };
  return rank[a] - rank[b];
}
