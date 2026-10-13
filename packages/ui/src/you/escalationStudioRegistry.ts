// YOU Escalation Studio — per-workspace 表面实例注册表（W8B）。
//
// 模式对齐 W1B solutionSurfaceRegistry / W2B captureStudioRegistry / W3B
// twinStudioRegistry / W4B performanceStudioRegistry / W5B editingStudioRegistry /
// W6B learningStudioRegistry / W7B avatarStudioRegistry（acquire/release；
// ADR-002：持久表面，release 后实例保留，Phase 0 无逐出）。
// 每个 workspace 独立（store + controller），避免跨 workspace 串状态。
import { createSimulatedEscalationStudioController } from "./escalationSimulatedController.js";
import {
  createEscalationPaneStore,
  type EscalationPaneStoreApi,
} from "./escalationStudioStore.js";
import type { EscalationStudioController } from "./escalationController.js";

export interface EscalationSurfaceInstance {
  readonly workspaceKey: string;
  readonly store: EscalationPaneStoreApi;
  readonly controller: EscalationStudioController;
}

const registry = new Map<string, EscalationSurfaceInstance>();

export function acquireEscalationStudio(workspaceKey: string): EscalationSurfaceInstance {
  const existing = registry.get(workspaceKey);
  if (existing) {
    return existing;
  }
  const instance: EscalationSurfaceInstance = {
    workspaceKey,
    store: createEscalationPaneStore(),
    // TODO(T8): bind to Worker A 的 arena 服务 —— Phase 0 使用确定性模拟控制器
    //（fixture-simulated，明确标注）。
    controller: createSimulatedEscalationStudioController(),
  };
  registry.set(workspaceKey, instance);
  return instance;
}

/** 测试辅助：清空注册表（生产路径不调用）。 */
export function resetEscalationStudioRegistryForTests(): void {
  registry.clear();
}
