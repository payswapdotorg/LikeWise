// YOU Editing Studio — per-workspace 表面实例注册表（W5B）。
//
// 模式对齐 W1B solutionSurfaceRegistry / W2B captureStudioRegistry / W3B
// twinStudioRegistry / W4B performanceStudioRegistry（acquire/release；
// ADR-002：持久表面，release 后实例保留，Phase 0 无逐出）。每个 workspace 独立
//（store + controller），避免跨 workspace 串状态。
import { createSimulatedEditingStudioController } from "./editingSimulatedController.js";
import {
  createEditingPaneStore,
  type EditingPaneStoreApi,
} from "./editingStudioStore.js";
import type { EditingStudioController } from "./editingController.js";

export interface EditingSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: EditingPaneStoreApi;
  readonly controller: EditingStudioController;
}

const registry = new Map<string, EditingSurfaceInstance>();

export function acquireEditingStudio(workspaceKey: string): EditingSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: EditingSurfaceInstance = {
    workspaceKey,
    store: createEditingPaneStore(),
    // TODO(T5): bind to Worker A 的 editing 服务 —— Phase 0 使用确定性模拟控制器
    //（fixture-simulated，明确标注）。
    controller: createSimulatedEditingStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetEditingStudioRegistryForTests(): void {
  registry.clear();
}
