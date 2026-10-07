// YOU Solution Studio — 确定性 2.5D 投影（W1B）。
//
// Phase-0 viewport 的轻量「3D-ish」投影：yaw/pitch 轨道 + 弱透视 + zoom/pan。
// 纯函数、无计时器、无随机——同一输入恒等输出（FIXTURES 法则 1/2）。
// 这不是渲染引擎，也不暗示科学度量；仅是 canonical 状态的一个确定性可导航投影。
import type { SolutionEntity, SolutionSelector } from "@zcode/shared";
import { STORYBOARD_REGIONS } from "./solutionStoryboard.js";

export interface SolutionCameraState {
  /** 水平轨道角（弧度）。 */
  readonly yaw: number;
  /** 垂直轨道角（弧度，向上为正）。 */
  readonly pitch: number;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export const SOLUTION_CAMERA_DEFAULT: SolutionCameraState = {
  yaw: 0.65,
  pitch: 0.42,
  zoom: 1,
  panX: 0,
  panY: 0,
};

export const SOLUTION_CAMERA_MIN_PITCH = -0.15;
export const SOLUTION_CAMERA_MAX_PITCH = 1.35;
export const SOLUTION_CAMERA_MIN_ZOOM = 0.5;
export const SOLUTION_CAMERA_MAX_ZOOM = 2.5;
export const SOLUTION_CAMERA_ZOOM_STEP = 1.12;
export const SOLUTION_CAMERA_ORBIT_STEP = Math.PI / 24;
export const SOLUTION_CAMERA_PAN_STEP = 32;
export const SOLUTION_CAMERA_RESET_KEY = "0";
/** 命中测试半径（px）；小于该距离的点击视为未命中。 */
export const SOLUTION_HIT_RADIUS_PX = 14;

export interface SolutionViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface SolutionScreenPoint {
  readonly x: number;
  readonly y: number;
  /** 旋转后的深度（越大越远）；painter 排序用。 */
  readonly depth: number;
  /** 该点的屏幕像素/世界单位比例（glyph 尺寸用）。 */
  readonly scale: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 世界坐标 → 屏幕坐标（弱透视）。视口尺寸非正数时退化为 1×1，保持纯函数可测。 */
export function projectSolutionPoint(
  camera: SolutionCameraState,
  world: readonly [number, number, number],
  viewport: SolutionViewportSize,
): SolutionScreenPoint {
  const width = viewport.width > 0 ? viewport.width : 1;
  const height = viewport.height > 0 ? viewport.height : 1;
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const x1 = world[0] * cosYaw - world[2] * sinYaw;
  const z1 = world[0] * sinYaw + world[2] * cosYaw;
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const y2 = world[1] * cosPitch - z1 * sinPitch;
  const z2 = world[1] * sinPitch + z1 * cosPitch;
  const focal = 6;
  const perspective = focal / (focal + z2 + 4);
  const baseScale = Math.min(width, height) / 3.2;
  const scale = baseScale * camera.zoom * perspective;
  return {
    x: width / 2 + camera.panX + x1 * scale,
    y: height / 2 + camera.panY - y2 * scale,
    depth: z2,
    scale,
  };
}

/** 相机转移（纯）：轨道/平移/缩放/复位。 */
export function orbitSolutionCamera(
  camera: SolutionCameraState,
  deltaYaw: number,
  deltaPitch: number,
): SolutionCameraState {
  return {
    ...camera,
    yaw: camera.yaw + deltaYaw,
    pitch: clamp(camera.pitch + deltaPitch, SOLUTION_CAMERA_MIN_PITCH, SOLUTION_CAMERA_MAX_PITCH),
  };
}

export function panSolutionCamera(
  camera: SolutionCameraState,
  deltaX: number,
  deltaY: number,
): SolutionCameraState {
  return { ...camera, panX: camera.panX + deltaX, panY: camera.panY + deltaY };
}

export function zoomSolutionCamera(
  camera: SolutionCameraState,
  factor: number,
): SolutionCameraState {
  return {
    ...camera,
    zoom: clamp(camera.zoom * factor, SOLUTION_CAMERA_MIN_ZOOM, SOLUTION_CAMERA_MAX_ZOOM),
  };
}

export function resetSolutionCamera(): SolutionCameraState {
  return SOLUTION_CAMERA_DEFAULT;
}

/** painter 排序：远的先画（稳定——同深度保持输入顺序）。 */
export function sortEntitiesByDepth(
  camera: SolutionCameraState,
  entities: readonly SolutionEntity[],
  viewport: SolutionViewportSize,
): readonly SolutionEntity[] {
  return entities
    .map((entity, index) => ({
      entity,
      index,
      depth: projectSolutionPoint(camera, entity.transform.position, viewport).depth,
    }))
    .sort((a, b) => b.depth - a.depth || a.index - b.index)
    .map((entry) => entry.entity);
}

/** 命中测试：投影每个实体锚点，取屏幕距离最近且在半径内者。 */
export function findSolutionEntityAt(
  camera: SolutionCameraState,
  entities: readonly SolutionEntity[],
  viewport: SolutionViewportSize,
  point: { readonly x: number; readonly y: number },
  radiusPx: number = SOLUTION_HIT_RADIUS_PX,
): SolutionEntity | null {
  let best: SolutionEntity | null = null;
  let bestDistance = radiusPx;
  for (const entity of entities) {
    const projected = projectSolutionPoint(camera, entity.transform.position, viewport);
    const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
    if (distance <= bestDistance) {
      best = entity;
      bestDistance = distance;
    }
  }
  return best;
}

/** 区域（region selector）成员解析；未知区域返回空。 */
export function solutionRegionEntityIds(regionId: string): readonly string[] {
  return STORYBOARD_REGIONS.find((region) => region.id === regionId)?.entityIds ?? [];
}

/** 把 selector 解析为实体 id 列表（quality selector 不定位实体）。 */
export function solutionSelectorEntityIds(
  selector: SolutionSelector,
  entities: readonly SolutionEntity[],
): readonly string[] {
  switch (selector.kind) {
    case "entity":
      return entities.some((entity) => entity.id === selector.entityId)
        ? [selector.entityId]
        : [];
    case "region":
      return solutionRegionEntityIds(selector.regionId).filter((id) =>
        entities.some((entity) => entity.id === id),
      );
    case "quality":
      return [];
  }
}

/** 区域外接矩形（屏幕空间）；空区域返回 null。 */
export function solutionRegionBounds(
  camera: SolutionCameraState,
  entities: readonly SolutionEntity[],
  viewport: SolutionViewportSize,
  regionId: string,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null {
  const ids = new Set(solutionRegionEntityIds(regionId));
  const members = entities.filter((entity) => ids.has(entity.id));
  if (members.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const entity of members) {
    const projected = projectSolutionPoint(camera, entity.transform.position, viewport);
    minX = Math.min(minX, projected.x);
    minY = Math.min(minY, projected.y);
    maxX = Math.max(maxX, projected.x);
    maxY = Math.max(maxY, projected.y);
  }
  const pad = 18;
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

/** selector 的可读描述（无 React 依赖，供 UI 与测试共用）。 */
export function describeSolutionSelector(
  selector: SolutionSelector,
  entities: readonly SolutionEntity[],
): { kind: string; label: string; detail: string } {
  switch (selector.kind) {
    case "entity": {
      const entity = entities.find((candidate) => candidate.id === selector.entityId);
      return {
        kind: "entity",
        label: entity?.label ?? selector.entityId,
        detail: entity ? `${entity.kind} · ${entity.id}` : selector.entityId,
      };
    }
    case "region": {
      const region = STORYBOARD_REGIONS.find((candidate) => candidate.id === selector.regionId);
      return {
        kind: "region",
        label: region?.label ?? selector.regionId,
        detail: `${selector.regionId} · ${solutionRegionEntityIds(selector.regionId).length} entities`,
      };
    }
    case "quality":
      return {
        kind: "quality",
        label: selector.deficiencyClass,
        detail: `deficiency class: ${selector.deficiencyClass}`,
      };
  }
}
