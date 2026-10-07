// W1B logic tests — 确定性投影与 selector 映射（node:test）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  describeSolutionSelector,
  findSolutionEntityAt,
  orbitSolutionCamera,
  panSolutionCamera,
  projectSolutionPoint,
  resetSolutionCamera,
  sortEntitiesByDepth,
  solutionRegionBounds,
  solutionRegionEntityIds,
  solutionSelectorEntityIds,
  zoomSolutionCamera,
  SOLUTION_CAMERA_DEFAULT,
  SOLUTION_CAMERA_MAX_PITCH,
  SOLUTION_CAMERA_MAX_ZOOM,
  SOLUTION_CAMERA_MIN_PITCH,
  SOLUTION_CAMERA_MIN_ZOOM,
  type SolutionCameraState,
} from "./solutionProjection.js";
import { STORYBOARD_ENTITIES, STORYBOARD_REGIONS } from "./solutionStoryboard.js";

const VIEWPORT = { width: 400, height: 300 };

test("projection is deterministic: same inputs produce byte-identical outputs", () => {
  const first = projectSolutionPoint(
    SOLUTION_CAMERA_DEFAULT,
    [0.3, 1.28, 0],
    VIEWPORT,
  );
  const second = projectSolutionPoint(
    SOLUTION_CAMERA_DEFAULT,
    [0.3, 1.28, 0],
    VIEWPORT,
  );
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.stringify(first), JSON.stringify(second));
});

test("projection maps the synthetic human into the viewport with sane spread", () => {
  const head = projectSolutionPoint(SOLUTION_CAMERA_DEFAULT, [0, 1.62, 0], VIEWPORT);
  const legs = projectSolutionPoint(SOLUTION_CAMERA_DEFAULT, [0, 0.42, 0], VIEWPORT);
  const armLeft = projectSolutionPoint(SOLUTION_CAMERA_DEFAULT, [-0.3, 1.28, 0], VIEWPORT);
  const armRight = projectSolutionPoint(SOLUTION_CAMERA_DEFAULT, [0.3, 1.28, 0], VIEWPORT);

  // 头在腿上方，双臂水平分开。
  assert.ok(head.y < legs.y, "head should project above legs");
  assert.ok(armLeft.x < armRight.x, "left arm should project left of right arm");
  // 所有关键点都落在视口内。
  for (const point of [head, legs, armLeft, armRight]) {
    assert.ok(point.x >= 0 && point.x <= VIEWPORT.width);
    assert.ok(point.y >= 0 && point.y <= VIEWPORT.height);
  }
});

test("projection survives degenerate viewport sizes without throwing", () => {
  const point = projectSolutionPoint(SOLUTION_CAMERA_DEFAULT, [1, 2, 3], { width: 0, height: 0 });
  assert.ok(Number.isFinite(point.x));
  assert.ok(Number.isFinite(point.y));
});

test("camera transitions are pure and clamped", () => {
  const base: SolutionCameraState = { yaw: 1, pitch: 0.2, zoom: 1, panX: 0, panY: 0 };
  const orbited = orbitSolutionCamera(base, 0.25, 5);
  assert.equal(orbited.yaw, 1.25);
  assert.equal(orbited.pitch, SOLUTION_CAMERA_MAX_PITCH);
  assert.equal(orbitSolutionCamera(base, 0, -5).pitch, SOLUTION_CAMERA_MIN_PITCH);
  // 输入不被修改（纯函数）。
  assert.equal(base.pitch, 0.2);

  const panned = panSolutionCamera(base, 10, -4);
  assert.deepEqual([panned.panX, panned.panY], [10, -4]);

  assert.equal(zoomSolutionCamera(base, 100).zoom, SOLUTION_CAMERA_MAX_ZOOM);
  assert.equal(zoomSolutionCamera(base, 0.001).zoom, SOLUTION_CAMERA_MIN_ZOOM);
  assert.deepEqual(resetSolutionCamera(), SOLUTION_CAMERA_DEFAULT);
});

test("hit testing picks the nearest entity within the radius and null outside", () => {
  const headAnchor = projectSolutionPoint(
    SOLUTION_CAMERA_DEFAULT,
    STORYBOARD_ENTITIES.find((entity) => entity.id === "fx-human-head")!.transform.position,
    VIEWPORT,
  );
  const hit = findSolutionEntityAt(
    SOLUTION_CAMERA_DEFAULT,
    STORYBOARD_ENTITIES,
    VIEWPORT,
    { x: headAnchor.x + 2, y: headAnchor.y + 2 },
  );
  assert.equal(hit?.id, "fx-human-head");

  const miss = findSolutionEntityAt(SOLUTION_CAMERA_DEFAULT, STORYBOARD_ENTITIES, VIEWPORT, {
    x: -999,
    y: -999,
  });
  assert.equal(miss, null);
});

test("depth sorting is stable and puts farther entities first", () => {
  const sorted = sortEntitiesByDepth(SOLUTION_CAMERA_DEFAULT, STORYBOARD_ENTITIES, VIEWPORT);
  assert.equal(sorted.length, STORYBOARD_ENTITIES.length);
  const depths = sorted.map((entity) =>
    projectSolutionPoint(SOLUTION_CAMERA_DEFAULT, entity.transform.position, VIEWPORT).depth,
  );
  for (let i = 1; i < depths.length; i += 1) {
    assert.ok(depths[i - 1]! >= depths[i]!, "painter order must be far-to-near");
  }
  // 稳定性：重复排序结果一致。
  assert.deepEqual(
    sorted.map((entity) => entity.id),
    sortEntitiesByDepth(SOLUTION_CAMERA_DEFAULT, STORYBOARD_ENTITIES, VIEWPORT).map(
      (entity) => entity.id,
    ),
  );
});

test("region membership and bounds resolve from the storyboard", () => {
  assert.deepEqual(solutionRegionEntityIds("region.face"), ["fx-human-head"]);
  const hands = solutionRegionEntityIds("region.hands");
  assert.equal(hands.length, 4);
  assert.deepEqual(solutionRegionEntityIds("region.unknown"), []);

  const bounds = solutionRegionBounds(
    SOLUTION_CAMERA_DEFAULT,
    STORYBOARD_ENTITIES,
    VIEWPORT,
    "region.face",
  );
  assert.ok(bounds);
  assert.ok(bounds!.width > 0 && bounds!.height > 0);
  assert.equal(solutionRegionBounds(SOLUTION_CAMERA_DEFAULT, STORYBOARD_ENTITIES, VIEWPORT, "nope"), null);
});

test("selector mapping: entity / region / quality map to the right entity sets", () => {
  assert.deepEqual(
    solutionSelectorEntityIds({ kind: "entity", entityId: "fx-human-head" }, STORYBOARD_ENTITIES),
    ["fx-human-head"],
  );
  assert.deepEqual(
    solutionSelectorEntityIds({ kind: "entity", entityId: "missing" }, STORYBOARD_ENTITIES),
    [],
  );
  const regionIds = solutionSelectorEntityIds(
    { kind: "region", regionId: "region.hands" },
    STORYBOARD_ENTITIES,
  );
  assert.equal(regionIds.length, 4);
  // quality selector 不定位实体（类级缺陷）。
  assert.deepEqual(
    solutionSelectorEntityIds({ kind: "quality", deficiencyClass: "geometry" }, STORYBOARD_ENTITIES),
    [],
  );
});

test("describeSolutionSelector produces readable labels for all selector kinds", () => {
  const entity = describeSolutionSelector(
    { kind: "entity", entityId: "fx-human-head" },
    STORYBOARD_ENTITIES,
  );
  assert.equal(entity.kind, "entity");
  assert.equal(entity.label, "Head");

  const region = describeSolutionSelector(
    { kind: "region", regionId: "region.face" },
    STORYBOARD_ENTITIES,
  );
  assert.equal(region.kind, "region");
  assert.equal(region.label, STORYBOARD_REGIONS.find((r) => r.id === "region.face")!.label);

  const quality = describeSolutionSelector(
    { kind: "quality", deficiencyClass: "geometry" },
    STORYBOARD_ENTITIES,
  );
  assert.equal(quality.kind, "quality");
  assert.equal(quality.label, "geometry");
});
