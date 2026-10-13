// YOU Lab Studio — per-workspace 表面实例注册表（W9B）。
//
// 模式对齐 W1B solutionSurfaceRegistry / W2B captureStudioRegistry / W3B
// twinStudioRegistry / W4B performanceStudioRegistry / W5B editingStudioRegistry /
// W6B learningStudioRegistry / W7B avatarStudioRegistry / W8B
// escalationStudioRegistry（acquire/release；ADR-002：持久表面，release 后实例
// 保留，Phase 0 无逐出）。每个 workspace 独立（store + controller），避免跨
// workspace 串状态。
import { createSimulatedLabStudioController } from "./labSimulatedController.js";
import { createLabPaneStore, type LabPaneStoreApi } from "./labStudioStore.js";
import type { LabStudioController } from "./labController.js";

export interface LabSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: LabPaneStoreApi;
  readonly controller: LabStudioController;
}

const registry = new Map<string, LabSurfaceInstance>();

export function acquireLabStudio(workspaceKey: string): LabSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: LabSurfaceInstance = {
    workspaceKey,
    store: createLabPaneStore(),
    // TODO(T9): bind to Worker A 的 lab 持久化服务 —— Phase 0 使用确定性模拟控制器
    //（fixture-simulated，明确标注）。
    controller: createSimulatedLabStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetLabStudioRegistryForTests(): void {
  registry.clear();
}
