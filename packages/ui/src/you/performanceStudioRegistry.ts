// YOU Performance Studio — per-workspace 表面实例注册表（W4B）。
//
// 模式对齐 W1B solutionSurfaceRegistry / W2B captureStudioRegistry / W3B
// twinStudioRegistry（acquire/release；ADR-002：持久表面，release 后实例保留，
// Phase 0 无逐出）。每个 workspace 独立（store + controller），避免跨 workspace 串状态。
import { createSimulatedPerformanceStudioController } from "./performanceSimulatedController.js";
import {
  createPerformancePaneStore,
  type PerformancePaneStoreApi,
} from "./performanceStudioStore.js";
import type { PerformanceStudioController } from "./performanceController.js";

export interface PerformanceSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: PerformancePaneStoreApi;
  readonly controller: PerformanceStudioController;
}

const registry = new Map<string, PerformanceSurfaceInstance>();

export function acquirePerformanceStudio(workspaceKey: string): PerformanceSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: PerformanceSurfaceInstance = {
    workspaceKey,
    store: createPerformancePaneStore(),
    // TODO(T4): bind to Worker A 的 performance/render 服务 —— Phase 0 使用
    // 确定性模拟控制器（fixture-simulated，明确标注）。
    controller: createSimulatedPerformanceStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetPerformanceStudioRegistryForTests(): void {
  registry.clear();
}
