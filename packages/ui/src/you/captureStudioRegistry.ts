// YOU Capture Studio — per-workspace 表面实例注册表（W2B）。
//
// 模式对齐 W1B solutionSurfaceRegistry（acquire/release；ADR-002：持久表面，
// release 后实例保留，Phase 0 无逐出）。每个 workspace 独立（store + controller），
// 避免跨 workspace 串状态。
import { createSimulatedCaptureStudioController } from "./captureSimulatedController.js";
import { createCapturePaneStore, type CapturePaneStoreApi } from "./captureStudioStore.js";
import type { CaptureStudioController } from "./captureController.js";

export interface CaptureSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: CapturePaneStoreApi;
  readonly controller: CaptureStudioController;
}

const registry = new Map<string, CaptureSurfaceInstance>();

export function acquireCaptureStudio(workspaceKey: string): CaptureSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: CaptureSurfaceInstance = {
    workspaceKey,
    store: createCapturePaneStore(),
    // TODO(T2): bind to Worker A 的 evidence/capture/consent 服务 —— Phase 0 使用
    // 确定性模拟控制器（fixture-simulated，明确标注）。
    controller: createSimulatedCaptureStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetCaptureStudioRegistryForTests(): void {
  registry.clear();
}
