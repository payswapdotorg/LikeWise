// YOU Twin Studio — per-workspace 表面实例注册表（W3B）。
//
// 模式对齐 W1B solutionSurfaceRegistry / W2B captureStudioRegistry（acquire/release；
// ADR-002：持久表面，release 后实例保留，Phase 0 无逐出）。每个 workspace 独立
// （store + controller），避免跨 workspace 串状态。
import { createSimulatedTwinStudioController } from "./twinSimulatedController.js";
import { createTwinPaneStore, type TwinPaneStoreApi } from "./twinStudioStore.js";
import type { TwinStudioController } from "./twinController.js";

export interface TwinSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: TwinPaneStoreApi;
  readonly controller: TwinStudioController;
}

const registry = new Map<string, TwinSurfaceInstance>();

export function acquireTwinStudio(workspaceKey: string): TwinSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: TwinSurfaceInstance = {
    workspaceKey,
    store: createTwinPaneStore(),
    // TODO(T3): bind to Worker A 的 twin/reconstruction 服务 —— Phase 0 使用
    // 确定性模拟控制器（fixture-simulated，明确标注）。
    controller: createSimulatedTwinStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetTwinStudioRegistryForTests(): void {
  registry.clear();
}
