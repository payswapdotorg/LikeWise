// YOU Release Studio — 确定性 operator demo 驱动器（W12B）。
//
// 覆盖 W12B 验收的完整 launch-gate 箭头（W12A/W12C fixture 场景的 UI 侧镜像）：
// 加载 → 16/20 诚实 incomplete checklist（LAUNCH GATE LAW：无证据点绝不通过）→
// 未过门 signoff 拒绝（OPERATOR SIGNOFF LAW）→ 无 signoff declaration 拒绝
//（RELEASE DECLARATION LAW）→ 20/20 golden checklist → signoff 落账（signed-by
// / signed-at / 被引用 checklist）→ 未知 operator 拒绝 / 重复签署拒绝 → 空
// bundle 拒绝 / 缺 rollback 拒绝 → declaration 落账（bundle + rollback 链接）→
// 重复声明拒绝（one release per signoff）→ 终态总览。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed
// error 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import {
  ReleaseStudioError,
  releaseChecklistGatePasses,
  type ReleaseStudioController,
} from "./releaseController.js";
import type {
  ReleaseDemoStep,
  ReleaseDemoStepId,
} from "./releaseStudioDemoSteps.js";
export {
  RELEASE_DEMO_STEPS,
  RELEASE_DEMO_TOTAL_STEPS,
  type ReleaseDemoStep,
  type ReleaseDemoStepId,
} from "./releaseStudioDemoSteps.js";
import type { ReleasePanelId } from "./releaseStudioStore.js";

/** 步骤对视图状态的提示（由 useReleaseStudio 应用；驱动器不直接写 store）。 */
export interface ReleaseDemoUiHint {
  readonly panel?: ReleasePanelId;
  readonly selectedChecklistId?: string | null;
  readonly selectedSignoffId?: string | null;
  readonly selectedDeclarationId?: string | null;
}

export interface ReleaseDemoStepOutcome {
  readonly stepId: ReleaseDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（checklist / signoff / declaration 等）。 */
  readonly refs: readonly string[];
  readonly uiHint: ReleaseDemoUiHint;
}

function outcome(
  stepId: ReleaseDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: ReleaseDemoUiHint = {},
): ReleaseDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<ReleaseStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof ReleaseStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error(
    "demo: expected a typed ReleaseStudioError, but the operation succeeded",
  );
}

/**
 * 执行一步剧本。控制器必须已 load（load 步骤负责加载）。
 * 每步只做确定性操作；非法状态会抛出端口级 typed error（非预期错误直接上抛）。
 */
export async function runReleaseDemoStep(
  controller: ReleaseStudioController,
  demoStep: ReleaseDemoStep,
): Promise<ReleaseDemoStepOutcome> {
  switch (demoStep.id) {
    case "load": {
      const snapshot = await controller.load({
        workspaceKey: "you-w12b-release-demo",
      });
      return outcome(
        "load",
        `Release plane loaded (${snapshot.studioId}, ${snapshot.journeys.length} gate journeys, ${snapshot.operators.length} release operators, ${snapshot.evidenceBundles.length} evidence bundles, ${snapshot.rollbackEvidence.length} rollback evidence entries). The 20-point checklist, the sign-off state and the release declaration all render from these controller projections — zero business logic in the UI. No checklist, sign-off or declaration exists yet: the honest starting state.`,
        [snapshot.studioId],
        { panel: "checklist" },
      );
    }
    case "checklist-partial": {
      const checklist = await controller.runLaunchGateCheck({
        journeyId: "journey-gate-partial",
      });
      const passed = checklist.points.filter((point) => point.passed).length;
      const missing = checklist.points.filter(
        (point) => point.journeyEvidenceRef === null,
      ).length;
      return outcome(
        "checklist-partial",
        `Checklist ${checklist.id} assembled from journey-gate-partial-016: ${passed}/${checklist.points.length} points pass (each with a journey-evidence link), ${missing} points carry no evidence — the LAUNCH GATE LAW never dresses a point as passed without evidence, so the checklist lands incomplete and the gate does not pass.`,
        [checklist.id],
        { panel: "checklist", selectedChecklistId: checklist.id },
      );
    }
    case "signoff-incomplete-checklist-refusal": {
      const error = await expectTypedError(() =>
        controller.recordOperatorSignoff({ operatorId: "operator-aria" }),
      );
      return outcome(
        "signoff-incomplete-checklist-refusal",
        `${error.youError.code}: ${error.youError.message} — the sign-off references a COMPLETE passing checklist; a partial checklist keeps the gate closed (the honest state).`,
        [],
        { panel: "signoff" },
      );
    }
    case "declaration-before-signoff-refusal": {
      const error = await expectTypedError(() =>
        controller.declareRelease({
          evidenceBundleId: "bundle-golden-journey-set",
          rollbackEvidenceId: "rollback-dr-verified",
        }),
      );
      return outcome(
        "declaration-before-signoff-refusal",
        `${error.youError.code}: ${error.youError.message} — the declaration references a sign-off; declaring before any sign-off exists is a typed refusal, never a silent repair.`,
        [],
        { panel: "declaration" },
      );
    }
    case "checklist-golden": {
      const checklist = await controller.runLaunchGateCheck({
        journeyId: "journey-gate-golden",
      });
      const passed = checklist.points.filter((point) => point.passed).length;
      return outcome(
        "checklist-golden",
        `Checklist ${checklist.id} assembled from launch-gate-001: ${passed}/${checklist.points.length} points pass, every point carries a journey-evidence link — the gate passes ONLY when all 20 points pass; the launch-gate-checked event journals the counts verbatim.`,
        [checklist.id],
        { panel: "checklist", selectedChecklistId: checklist.id },
      );
    }
    case "signoff-land": {
      const snapshot = await controller.refresh();
      const latest = snapshot.checklists.at(-1);
      if (!latest) throw new Error("demo: latest checklist missing");
      if (!releaseChecklistGatePasses(latest)) {
        throw new Error("demo: latest checklist does not pass the gate");
      }
      const signoff = await controller.recordOperatorSignoff({
        operatorId: "operator-aria",
      });
      return outcome(
        "signoff-land",
        `Sign-off landed: ${signoff.id} — signed by ${signoff.signedBy} (Aria, the registered release operator) at ${signoff.signedAt}, referencing checklist ${signoff.checklistRef} (20/20 points, gate passed). The OperatorSignoffRecord is immutable and the operator-signoff-recorded event is journaled.`,
        [signoff.id],
        { panel: "signoff", selectedSignoffId: signoff.id },
      );
    }
    case "signoff-unknown-operator-refusal": {
      const error = await expectTypedError(() =>
        controller.recordOperatorSignoff({
          operatorId: "operator-unknown-legacy",
        }),
      );
      return outcome(
        "signoff-unknown-operator-refusal",
        `${error.youError.code}: ${error.youError.message} — every sign-off is signed by a registered release operator (fail closed); the UI never guesses an operator.`,
        [],
        { panel: "signoff" },
      );
    }
    case "signoff-duplicate-refusal": {
      const error = await expectTypedError(() =>
        controller.recordOperatorSignoff({ operatorId: "operator-aria" }),
      );
      return outcome(
        "signoff-duplicate-refusal",
        `${error.youError.code}: ${error.youError.message} — the sign-off is a final immutable decision taken exactly once; re-signing the same checklist is a typed refusal.`,
        [],
        { panel: "signoff" },
      );
    }
    case "declaration-empty-bundle-refusal": {
      const error = await expectTypedError(() =>
        controller.declareRelease({
          evidenceBundleId: "bundle-empty",
          rollbackEvidenceId: "rollback-dr-verified",
        }),
      );
      return outcome(
        "declaration-empty-bundle-refusal",
        `${error.youError.code}: ${error.youError.message} — the declaration carries the FULL evidence bundle (the 20-point golden journey plus the failure-injection recovery runs); an empty bundle is a typed refusal, never a silent pass.`,
        [],
        { panel: "declaration" },
      );
    }
    case "declaration-missing-rollback-refusal": {
      const error = await expectTypedError(() =>
        controller.declareRelease({
          evidenceBundleId: "bundle-golden-journey-set",
          rollbackEvidenceId: "rollback-unregistered",
        }),
      );
      return outcome(
        "declaration-missing-rollback-refusal",
        `${error.youError.code}: ${error.youError.message} — the production-eligibility law carried to the release: rollback evidence (the DR-verified restore drill) is required, and its absence is a typed refusal.`,
        [],
        { panel: "declaration" },
      );
    }
    case "declaration-land": {
      const declaration = await controller.declareRelease({
        evidenceBundleId: "bundle-golden-journey-set",
        rollbackEvidenceId: "rollback-dr-verified",
      });
      return outcome(
        "declaration-land",
        `Release declared: ${declaration.id} — sign-off ${declaration.signoffRef}, evidence bundle ${declaration.evidenceBundleRef} (21 journey records: the 20-point golden journey + the failure-injection recovery runs), rollback evidence ${declaration.rollbackEvidenceRef} (DR restore verified), declared at ${declaration.declaredAt}. The release-declared event is journaled and the record is immutable.`,
        [declaration.id],
        { panel: "declaration", selectedDeclarationId: declaration.id },
      );
    }
    case "declaration-duplicate-refusal": {
      const error = await expectTypedError(() =>
        controller.declareRelease({
          evidenceBundleId: "bundle-golden-journey-set",
          rollbackEvidenceId: "rollback-dr-verified",
        }),
      );
      return outcome(
        "declaration-duplicate-refusal",
        `${error.youError.code}: ${error.youError.message} — one release declaration per sign-off; a second declaration on the same sign-off is a typed refusal.`,
        [],
        { panel: "declaration" },
      );
    }
    case "final-state": {
      const snapshot = await controller.refresh();
      const goldenChecklists = snapshot.checklists.filter(
        (checklist) => releaseChecklistGatePasses(checklist),
      ).length;
      const incompleteChecklists =
        snapshot.checklists.length - goldenChecklists;
      return outcome(
        "final-state",
        `Final state: ${snapshot.checklists.length} checklist record(s) (${goldenChecklists} golden 20/20, ${incompleteChecklists} honest incomplete), ${snapshot.signoffs.length} sign-off(s) with signed-by / signed-at / checklist references, ${snapshot.declarations.length} release declaration(s) with evidence-bundle + rollback links; ${snapshot.events.length} events journaled (launch-gate-checked / operator-signoff-recorded / release-declared).`,
        [],
        { panel: "declaration" },
      );
    }
  }
}
