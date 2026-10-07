// YOU Solution Studio — SolutionStatePatch 的纯函数应用器（W1B）。
//
// 这是模拟控制器的私有算术：对 frozen contract 的 `SolutionPatchOperation` 做纯应用。
// TODO(T1): Worker A 的 Solution runtime 提供规范实现后由 solutionService 接管。
import type {
  SolutionEntity,
  SolutionEnvironmentState,
  SolutionPatchOperation,
  SolutionStatePatch,
  SolutionStateSnapshot,
} from "@zcode/shared";
import { clampQualityScore } from "./solutionStoryboard.js";
import type { SolutionImportDiff } from "./solutionExportModel.js";

/** 纯应用 patch：返回新快照，不修改输入（不可变记录语义）。 */
export function applySolutionStatePatch(
  base: SolutionStateSnapshot,
  patch: SolutionStatePatch,
): SolutionStateSnapshot {
  let state = base;
  for (const operation of patch.operations) {
    state = applyOperation(state, operation);
  }
  return state;
}

function applyOperation(
  state: SolutionStateSnapshot,
  operation: SolutionPatchOperation,
): SolutionStateSnapshot {
  switch (operation.op) {
    case "upsert_entity": {
      const index = state.entities.findIndex((entity) => entity.id === operation.entity.id);
      const entities = [...state.entities];
      if (index >= 0) {
        entities[index] = operation.entity;
      } else {
        entities.push(operation.entity);
      }
      return { ...state, entities };
    }
    case "remove_entity":
      return {
        ...state,
        entities: state.entities.filter((entity) => entity.id !== operation.entityId),
      };
    case "update_environment":
      return {
        ...state,
        environment: { ...state.environment, ...operation.environment },
      };
    case "adjust_quality": {
      const before = state.quality[operation.deficiencyClass] ?? 0;
      return {
        ...state,
        quality: {
          ...state.quality,
          [operation.deficiencyClass]: clampQualityScore(before + operation.delta),
        },
      };
    }
  }
}

/**
 * 由真实 diff 推导 importer ChangeSet 的操作集
 * （truthful：导入提议 = 逐条观测到的差异，不隐式整包覆盖）。
 */
export function deriveOperationsFromDiff(
  diff: SolutionImportDiff,
  candidateEntity: (id: string) => SolutionEntity | undefined,
  candidateEnvironment: SolutionEnvironmentState,
): SolutionPatchOperation[] {
  const operations: SolutionPatchOperation[] = [];
  for (const change of diff.entityChanges) {
    if (change.kind === "removed") {
      operations.push({ op: "remove_entity", entityId: change.entityId });
      continue;
    }
    const candidate = candidateEntity(change.entityId);
    if (candidate) {
      operations.push({ op: "upsert_entity", entity: candidate });
    }
  }
  for (const quality of diff.qualityChanges) {
    operations.push({
      op: "adjust_quality",
      deficiencyClass: quality.deficiencyClass,
      delta: Math.round((quality.after - quality.before) * 100) / 100,
    });
  }
  if (diff.environmentChanged) {
    operations.push({
      op: "update_environment",
      environment: {
        keyLightDirection: candidateEnvironment.keyLightDirection,
        ambientIntensity: candidateEnvironment.ambientIntensity,
        background: candidateEnvironment.background,
      },
    });
  }
  return operations;
}
