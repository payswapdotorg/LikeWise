// YOU Release Studio — per-workspace 表面实例注册表（W12B）。
//
// 模式对齐 W1B solutionSurfaceRegistry / … / W10B hardeningStudioRegistry /
// W11B conformanceStudioRegistry（acquire/release；ADR-002：持久表面，release 后
// 实例保留，Phase 0 无逐出）。每个 workspace 独立（store + controller），避免跨
// workspace 串状态。
import { createSimulatedReleaseStudioController } from "./releaseSimulatedController.js";
import {
  createReleasePaneStore,
  type ReleasePaneStoreApi,
} from "./releaseStudioStore.js";
import type { ReleaseStudioController } from "./releaseController.js";

export interface ReleaseSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: ReleasePaneStoreApi;
  readonly controller: ReleaseStudioController;
}

const registry = new Map<string, ReleaseSurfaceInstance>();

export function acquireReleaseStudio(
  workspaceKey: string,
): ReleaseSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: ReleaseSurfaceInstance = {
    workspaceKey,
    store: createReleasePaneStore(),
    // TODO(T12): bind to Worker A/C 的 launch-gate 服务 —— Phase 0
    // 使用确定性模拟控制器（fixture-simulated，明确标注）。
    controller: createSimulatedReleaseStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetReleaseStudioRegistryForTests(): void {
  registry.clear();
}
