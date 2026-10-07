/* oxlint-disable eslint(max-lines) -- 视口面板集中承载 SVG 场景投影、相机/命中交互与质量图例；拆散会让共享的呈现提示表与交互状态跨文件跳转，先保持单文件收口。 */
// YOU Solution Studio — Solution 视口面板（W1B）。
//
// canonical 状态的确定性 2.5D 投影（solutionProjection 纯函数）：
// - 相机控制：拖动 orbit / Shift-拖动 pan / 滚轮缩放 / 键盘（方向键、+/-、0 复位）；
// - 语义选择：点击实体 / 区域轮廓 / Select 控件 → SolutionSelector（entity/region/quality）；
// - 质量叠加：fixture 分数图例，明确标注不构成科学度量。
// 无计时器、无随机；同一 (camera, entities, viewport) 恒等渲染。
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useStore } from "zustand";
import type { SolutionEntity, SolutionSelector } from "@zcode/shared";
import { cn } from "@/components/lib/utils.js";
import { Button } from "@/components/ui/button.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.js";
import { RotateCcwIcon } from "lucide-react";
import { currentSolutionVersion } from "@/you/solutionController.js";
import {
  SOLUTION_CAMERA_ORBIT_STEP,
  SOLUTION_CAMERA_ZOOM_STEP,
  describeSolutionSelector,
  findSolutionEntityAt,
  projectSolutionPoint,
  sortEntitiesByDepth,
  solutionRegionBounds,
  type SolutionCameraState,
} from "@/you/solutionProjection.js";
import { STORYBOARD_REGIONS } from "@/you/solutionStoryboard.js";
import type { UseSolutionSurfaceBinding } from "@/you/useSolutionSurface.js";
import { useYouMessages } from "@/you/youMessages.js";

/** 实体呈现提示（纯展示数据；canonical attributes 不承担渲染职责）。 */
const ENTITY_VISUALS: Record<
  string,
  { shape: "ellipse" | "rounded"; w: number; h: number; rotateByTransformZ?: boolean }
> = {
  "fx-human-root": { shape: "ellipse", w: 0.1, h: 0.1 },
  "fx-human-head": { shape: "ellipse", w: 0.22, h: 0.26 },
  "fx-human-torso": { shape: "rounded", w: 0.36, h: 0.62 },
  "fx-human-arm-left": { shape: "rounded", w: 0.08, h: 0.52, rotateByTransformZ: true },
  "fx-human-arm-right": { shape: "rounded", w: 0.08, h: 0.52, rotateByTransformZ: true },
  "fx-human-hand-left": { shape: "ellipse", w: 0.09, h: 0.09 },
  "fx-human-hand-right": { shape: "ellipse", w: 0.09, h: 0.09 },
  "fx-human-legs": { shape: "rounded", w: 0.3, h: 0.84 },
  "fx-env-ground": { shape: "ellipse", w: 4.2, h: 1.3 },
  "fx-env-backdrop": { shape: "rounded", w: 4.1, h: 2.6 },
  "fx-light-key": { shape: "ellipse", w: 0.16, h: 0.16 },
  "fx-camera-main": { shape: "rounded", w: 0.18, h: 0.14 },
};

const DEFAULT_VIEWPORT = { width: 360, height: 280 };
const DRAG_CLICK_THRESHOLD_PX = 3;

interface DragState {
  pointerId: number;
  /** 最近一次指针位置（相对 svg 的坐标）；初始为 pointerdown 落点。 */
  lastX: number;
  lastY: number;
  mode: "orbit" | "pan";
  moved: boolean;
}

export function SolutionViewportPanel({ binding }: { binding: UseSolutionSurfaceBinding }) {
  const { formatMessage } = useYouMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const camera = useStore(binding.store, (state) => state.camera);
  const selection = useStore(binding.store, (state) => state.selection);
  const showRegions = useStore(binding.store, (state) => state.showRegions);
  const showQuality = useStore(binding.store, (state) => state.showQuality);
  const mode = useStore(binding.store, (state) => state.mode);
  const [size, setSize] = useState(DEFAULT_VIEWPORT);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const version = snapshot ? currentSolutionVersion(snapshot) : null;
  const entities = useMemo(() => version?.state.entities ?? [], [version]);
  const orderedEntities = useMemo(
    () => sortEntitiesByDepth(camera, entities, size),
    [camera, entities, size],
  );

  // 滚轮缩放需要非 passive 监听，才能阻止页面滚动。
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      binding.store.getState().zoomCamera(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [binding.store]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX - rect.left,
      lastY: event.clientY - rect.top,
      mode: event.shiftKey ? "pan" : "orbit",
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (
        Math.hypot(point.x - drag.lastX, point.y - drag.lastY) > DRAG_CLICK_THRESHOLD_PX
      ) {
        drag.moved = true;
      }
      if (!drag.moved) return;
      const store = binding.store.getState();
      if (drag.mode === "pan") {
        store.panCamera(point.x - drag.lastX, point.y - drag.lastY);
      } else {
        store.orbitCamera((point.x - drag.lastX) * 0.012, -(point.y - drag.lastY) * 0.012);
      }
      drag.lastX = point.x;
      drag.lastY = point.y;
    },
    [binding.store],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || drag.moved) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const store = binding.store.getState();
      const hit = findSolutionEntityAt(camera, entities, size, point);
      store.setSelection(hit ? { kind: "entity", entityId: hit.id } : null);
    },
    [binding.store, camera, entities, size],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<SVGSVGElement>) => {
      const store = binding.store.getState();
      switch (event.key) {
        case "ArrowLeft":
          store.orbitCamera(-SOLUTION_CAMERA_ORBIT_STEP, 0);
          break;
        case "ArrowRight":
          store.orbitCamera(SOLUTION_CAMERA_ORBIT_STEP, 0);
          break;
        case "ArrowUp":
          store.orbitCamera(0, SOLUTION_CAMERA_ORBIT_STEP / 2);
          break;
        case "ArrowDown":
          store.orbitCamera(0, -SOLUTION_CAMERA_ORBIT_STEP / 2);
          break;
        case "+":
        case "=":
          store.zoomCamera(SOLUTION_CAMERA_ZOOM_STEP);
          break;
        case "-":
        case "_":
          store.zoomCamera(1 / SOLUTION_CAMERA_ZOOM_STEP);
          break;
        case "0":
          store.resetCamera();
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [binding.store],
  );

  const selectionDescription = selection
    ? describeSolutionSelector(selection, entities)
    : null;
  const selectionValue = selection
    ? selection.kind === "entity"
      ? `entity:${selection.entityId}`
      : selection.kind === "region"
        ? `region:${selection.regionId}`
        : `quality:${selection.deficiencyClass}`
    : "none";

  const qualityEntries = useMemo(() => {
    if (!version) return [];
    return Object.entries(version.state.quality).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [version]);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="you-solution-viewport">
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface"
      >
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          tabIndex={0}
          role="application"
          aria-label={formatMessage({ id: "you.solution.viewport.hint" })}
          className={cn(
            "block h-full w-full touch-none outline-none",
            "focus-visible:ring-[3px] focus-visible:ring-ring/50",
          )}
          data-testid="you-solution-viewport-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          onKeyDown={handleKeyDown}
        >
          <SolutionScene
            camera={camera}
            entities={orderedEntities}
            viewport={size}
            selection={selection}
            showRegions={showRegions}
            onSelect={(next) => binding.store.getState().setSelection(next)}
            mode={mode}
          />
        </svg>
        <span
          className="pointer-events-none absolute right-2 top-2 rounded-md border border-border bg-background/85 px-1.5 py-0.5 font-mono text-ui-xs text-foreground-subtle"
          data-testid="you-solution-camera-readout"
        >
          {formatMessage({ id: "you.solution.viewport.camera" })} y{camera.yaw.toFixed(2)} p
          {camera.pitch.toFixed(2)} z{camera.zoom.toFixed(2)}
        </span>
        <span className="sr-only" role="status" data-testid="you-solution-selection-status">
          {selectionDescription
            ? `${selectionDescription.kind}: ${selectionDescription.label}`
            : formatMessage({ id: "you.solution.viewport.noSelection" })}
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 px-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title={formatMessage({ id: "you.solution.viewport.reset" })}
          aria-label={formatMessage({ id: "you.solution.viewport.reset" })}
          onClick={() => binding.store.getState().resetCamera()}
          data-testid="you-solution-camera-reset"
        >
          <RotateCcwIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={showRegions ? "secondary" : "ghost"}
          size="sm"
          className="h-6 px-1.5 text-ui-xs"
          aria-pressed={showRegions}
          onClick={() => binding.store.getState().toggleRegions()}
        >
          {formatMessage({ id: "you.solution.viewport.regions" })}
        </Button>
        <Button
          type="button"
          variant={showQuality ? "secondary" : "ghost"}
          size="sm"
          className="h-6 px-1.5 text-ui-xs"
          aria-pressed={showQuality}
          onClick={() => binding.store.getState().toggleQuality()}
        >
          {formatMessage({ id: "you.solution.viewport.quality" })}
        </Button>
        <div className="ml-auto flex min-w-0 items-center">
          <Select
            value={selectionValue}
            onValueChange={(value) => {
              if (value === "none") {
                binding.store.getState().setSelection(null);
                return;
              }
              const separatorIndex = value.indexOf(":");
              const kind = value.slice(0, separatorIndex);
              const id = value.slice(separatorIndex + 1);
              const next: SolutionSelector =
                kind === "entity"
                  ? { kind: "entity", entityId: id }
                  : kind === "region"
                    ? { kind: "region", regionId: id }
                    : { kind: "quality", deficiencyClass: id };
              binding.store.getState().setSelection(next);
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-6 max-w-44 gap-1 rounded-md px-1.5 text-ui-xs"
              aria-label={formatMessage({ id: "you.solution.viewport.noSelection" })}
              data-testid="you-solution-selection-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-ui-xs">
                {formatMessage({ id: "you.solution.viewport.noSelection" })}
              </SelectItem>
              {entities.map((entity) => (
                <SelectItem key={entity.id} value={`entity:${entity.id}`} className="text-ui-xs">
                  {entity.label}
                </SelectItem>
              ))}
              {STORYBOARD_REGIONS.map((region) => (
                <SelectItem key={region.id} value={`region:${region.id}`} className="text-ui-xs">
                  {formatMessage({ id: "you.solution.viewport.regions" })} · {region.label}
                </SelectItem>
              ))}
              {qualityEntries.map(([cls]) => (
                <SelectItem key={cls} value={`quality:${cls}`} className="text-ui-xs">
                  {formatMessage({ id: "you.solution.viewport.quality" })} · {cls}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="shrink-0 px-3 pt-1 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.solution.viewport.hint" })}
      </p>
      <p className="shrink-0 px-3 pb-2 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.solution.viewport.keyboardHint" })}
      </p>

      {showQuality && version ? (
        <div
          className="shrink-0 border-t border-border px-3 py-2"
          data-testid="you-solution-quality-legend"
        >
          <div className="flex flex-col gap-1">
            {qualityEntries.map(([cls, score]) => (
              <div key={cls} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-ui-xs text-foreground-subtle">
                  {cls}
                </span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      score < 0.55 ? "bg-warning" : "bg-foreground-subtle",
                    )}
                    style={{ width: `${Math.round(score * 100)}%` }}
                  />
                </span>
                <span
                  className={cn(
                    "w-9 shrink-0 text-right font-mono text-ui-xs",
                    score < 0.55 ? "text-warning" : "text-foreground-subtle",
                  )}
                >
                  {score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.solution.viewport.qualityCaption" })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SolutionScene({
  camera,
  entities,
  viewport,
  selection,
  showRegions,
  onSelect,
  mode,
}: {
  camera: SolutionCameraState;
  entities: readonly SolutionEntity[];
  viewport: { width: number; height: number };
  selection: SolutionSelector | null;
  showRegions: boolean;
  onSelect: (selector: SolutionSelector | null) => void;
  mode: "view" | "edit";
}) {
  const selectedEntityIds = useMemo(() => {
    if (!selection) return new Set<string>();
    if (selection.kind === "entity") return new Set([selection.entityId]);
    if (selection.kind === "region") {
      const region = STORYBOARD_REGIONS.find((candidate) => candidate.id === selection.regionId);
      return new Set(region?.entityIds ?? []);
    }
    return new Set<string>();
  }, [selection]);

  return (
    <g>
      {showRegions
        ? STORYBOARD_REGIONS.map((region) => {
            const bounds = solutionRegionBounds(camera, entities, viewport, region.id);
            if (!bounds) return null;
            const active = selection?.kind === "region" && selection.regionId === region.id;
            return (
              <rect
                key={region.id}
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                rx={8}
                className={cn(
                  "cursor-pointer",
                  active
                    ? "fill-[color-mix(in_oklab,var(--color-brand)_10%,transparent)] stroke-[var(--color-brand)]"
                    : "fill-transparent stroke-foreground-subtlest",
                )}
                strokeWidth={active ? 1.5 : 1}
                strokeDasharray={active ? undefined : "4 4"}
                onClick={(event: ReactMouseEvent) => {
                  event.stopPropagation();
                  onSelect({ kind: "region", regionId: region.id });
                }}
              >
                <title>{region.label}</title>
              </rect>
            );
          })
        : null}
      {entities.map((entity) => {
        const anchor = projectSolutionPoint(camera, entity.transform.position, viewport);
        const visual = ENTITY_VISUALS[entity.id] ?? { shape: "ellipse", w: 0.12, h: 0.12 };
        const w = Math.max(visual.w * anchor.scale, 3);
        const h = Math.max(visual.h * anchor.scale, 3);
        const selected = selectedEntityIds.has(entity.id);
        const rotation = visual.rotateByTransformZ ? (entity.transform.rotation[2] ?? 0) : 0;
        const commonProps = {
          className: cn(
            "cursor-pointer",
            selected
              ? "fill-[color-mix(in_oklab,var(--color-brand)_18%,transparent)] stroke-[var(--color-brand)]"
              : entity.kind === "environment"
                ? "fill-surface-hover stroke-foreground-subtlest"
                : "fill-[color-mix(in_oklab,var(--color-foreground)_14%,transparent)] stroke-foreground-subtle",
            mode === "edit" && !selected && "opacity-90",
          ),
          strokeWidth: selected ? 2 : 1,
          onClick: (event: ReactMouseEvent) => {
            event.stopPropagation();
            onSelect({ kind: "entity", entityId: entity.id });
          },
        };
        return (
          <g
            key={entity.id}
            transform={`rotate(${(-rotation * 180) / Math.PI} ${anchor.x} ${anchor.y})`}
          >
            {visual.shape === "ellipse" ? (
              <ellipse cx={anchor.x} cy={anchor.y} rx={w / 2} ry={h / 2} {...commonProps}>
                <title>{entity.label}</title>
              </ellipse>
            ) : (
              <rect
                x={anchor.x - w / 2}
                y={anchor.y - h / 2}
                width={w}
                height={h}
                rx={Math.min(w, h) / 2.5}
                {...commonProps}
              >
                <title>{entity.label}</title>
              </rect>
            )}
            {selected ? (
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={Math.max(w, h) / 2 + 5}
                fill="none"
                stroke="var(--color-brand)"
                strokeWidth={1}
                strokeDasharray="3 3"
                pointerEvents="none"
              />
            ) : null}
            <text
              x={anchor.x + w / 2 + 3}
              y={anchor.y + 3}
              className="pointer-events-none fill-current text-foreground-subtlest text-ui-xs"
            >
              {entity.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
