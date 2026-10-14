// YOU Hardening Studio — per-workspace 表面实例注册表（W10B）。
//
// 模式对齐 W1B solutionSurfaceRegistry / W2B captureStudioRegistry / W3B
// twinStudioRegistry / W4B performanceStudioRegistry / W5B editingStudioRegistry /
// W6B learningStudioRegistry / W7B avatarStudioRegistry / W8B
// escalationStudioRegistry / W9B labStudioRegistry（acquire/release；ADR-002：
// 持久表面，release 后实例保留，Phase 0 无逐出）。每个 workspace 独立（store +
// controller），避免跨 workspace 串状态。
import { createSimulatedHardeningStudioController } from "./hardeningSimulatedController.js";
import {
  createHardeningPaneStore,
  type HardeningPaneStoreApi,
} from "./hardeningStudioStore.js";
import type { HardeningStudioController } from "./hardeningController.js";

export interface HardeningSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: HardeningPaneStoreApi;
  readonly controller: HardeningStudioController;
}

const registry = new Map<string, HardeningSurfaceInstance>();

export function acquireHardeningStudio(
  workspaceKey: string,
): HardeningSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: HardeningSurfaceInstance = {
    workspaceKey,
    store: createHardeningPaneStore(),
    // TODO(T10): bind to Worker A/C 的 hardening 服务 —— Phase 0 使用确定性模拟
    // 控制器（fixture-simulated，明确标注）。
    controller: createSimulatedHardeningStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetHardeningStudioRegistryForTests(): void {
  registry.clear();
}
