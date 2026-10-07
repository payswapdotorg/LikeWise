// YOU Solution Studio — per-workspace 表面实例注册表（W1B）。
//
// 背景：ZCode 壳可以同时打开多个 workspace（分屏），每个 workspace 的 Side Pane 独立；
// Solution 表面因此需要 per-workspaceKey 的（store + controller）实例，避免跨 workspace
// 串状态。模式对齐 `packages/ui/src/v4/sessionsIndexRegistry.ts`（acquire/release）。
// ADR-002：Solution 是持久表面——release 后实例保留（Phase 0 无逐出；workspace 数量有限）。
import { createSimulatedSolutionSurfaceController } from "./solutionSimulatedController.js";
import { createSolutionPaneStore, type SolutionPaneStoreApi } from "./solutionStore.js";
import type { SolutionSurfaceController } from "./solutionController.js";

export interface SolutionSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: SolutionPaneStoreApi;
  readonly controller: SolutionSurfaceController;
}

const registry = new Map<string, SolutionSurfaceInstance>();

export function acquireSolutionSurface(workspaceKey: string): SolutionSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: SolutionSurfaceInstance = {
    workspaceKey,
    store: createSolutionPaneStore(),
    // TODO(T1): bind to solutionService —— Phase 0 使用确定性模拟控制器。
    controller: createSimulatedSolutionSurfaceController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetSolutionSurfaceRegistryForTests(): void {
  registry.clear();
}
