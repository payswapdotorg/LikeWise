// YOU Conformance Studio — per-workspace 表面实例注册表（W11B）。
//
// 模式对齐 W1B solutionSurfaceRegistry / … / W9B labStudioRegistry / W10B
// hardeningStudioRegistry（acquire/release；ADR-002：持久表面，release 后实例
// 保留，Phase 0 无逐出）。每个 workspace 独立（store + controller），避免跨
// workspace 串状态。
import { createSimulatedConformanceStudioController } from "./conformanceSimulatedController.js";
import {
  createConformancePaneStore,
  type ConformancePaneStoreApi,
} from "./conformanceStudioStore.js";
import type { ConformanceStudioController } from "./conformanceController.js";

export interface ConformanceSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: ConformancePaneStoreApi;
  readonly controller: ConformanceStudioController;
}

const registry = new Map<string, ConformanceSurfaceInstance>();

export function acquireConformanceStudio(
  workspaceKey: string,
): ConformanceSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: ConformanceSurfaceInstance = {
    workspaceKey,
    store: createConformancePaneStore(),
    // TODO(T11): bind to Worker A/C 的 hardening-verification 服务 —— Phase 0
    // 使用确定性模拟控制器（fixture-simulated，明确标注）。
    controller: createSimulatedConformanceStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetConformanceStudioRegistryForTests(): void {
  registry.clear();
}
