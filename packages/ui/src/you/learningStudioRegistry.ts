// YOU Learning Studio — per-workspace 表面实例注册表（W6B）。
//
// 模式对齐 W1B solutionSurfaceRegistry / W2B captureStudioRegistry / W3B
// twinStudioRegistry / W4B performanceStudioRegistry / W5B editingStudioRegistry
//（acquire/release；ADR-002：持久表面，release 后实例保留，Phase 0 无逐出）。
// 每个 workspace 独立（store + controller），避免跨 workspace 串状态。
import { createSimulatedLearningStudioController } from "./learningSimulatedController.js";
import {
  createLearningPaneStore,
  type LearningPaneStoreApi,
} from "./learningStudioStore.js";
import type { LearningStudioController } from "./learningController.js";

export interface LearningSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: LearningPaneStoreApi;
  readonly controller: LearningStudioController;
}

const registry = new Map<string, LearningSurfaceInstance>();

export function acquireLearningStudio(workspaceKey: string): LearningSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: LearningSurfaceInstance = {
    workspaceKey,
    store: createLearningPaneStore(),
    // TODO(T6): bind to Worker A 的 learning 服务 —— Phase 0 使用确定性模拟控制器
    //（fixture-simulated，明确标注）。
    controller: createSimulatedLearningStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetLearningStudioRegistryForTests(): void {
  registry.clear();
}
