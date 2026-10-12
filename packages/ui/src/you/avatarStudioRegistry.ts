// YOU Avatar Studio — per-workspace 表面实例注册表（W7B）。
//
// 模式对齐 W1B solutionSurfaceRegistry / W2B captureStudioRegistry / W3B
// twinStudioRegistry / W4B performanceStudioRegistry / W5B editingStudioRegistry /
// W6B learningStudioRegistry（acquire/release；ADR-002：持久表面，release 后实例
// 保留，Phase 0 无逐出）。每个 workspace 独立（store + controller），避免跨
// workspace 串状态。
import { createSimulatedAvatarStudioController } from "./avatarSimulatedController.js";
import {
  createAvatarPaneStore,
  type AvatarPaneStoreApi,
} from "./avatarStudioStore.js";
import type { AvatarStudioController } from "./avatarController.js";

export interface AvatarSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: AvatarPaneStoreApi;
  readonly controller: AvatarStudioController;
}

const registry = new Map<string, AvatarSurfaceInstance>();

export function acquireAvatarStudio(workspaceKey: string): AvatarSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: AvatarSurfaceInstance = {
    workspaceKey,
    store: createAvatarPaneStore(),
    // TODO(T7): bind to W7A 的 embodiment 服务 —— Phase 0 使用确定性模拟控制器
    //（fixture-simulated，明确标注）。
    controller: createSimulatedAvatarStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetAvatarStudioRegistryForTests(): void {
  registry.clear();
}
