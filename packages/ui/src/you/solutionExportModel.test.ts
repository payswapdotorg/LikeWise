// W1B logic tests — 可编辑导出包 manifest 与 truthful diff（node:test）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  SOLUTION_PACKAGE_FORMAT_VERSION,
  buildSolutionPackageManifest,
  diffSolutionVersionAgainst,
  parseSolutionPackageManifest,
  serializeSolutionPackageManifest,
  SolutionPackageParseError,
} from "./solutionExportModel.js";
import { STORYBOARD_EDITOR_RECOMMENDATION, buildStoryboardV1State, StoryboardClock, storyboardProvenance } from "./solutionStoryboard.js";
import type { SolutionVersion } from "@zcode/shared";

function makeVersion(number: number, qualityOverride?: Record<string, number>): SolutionVersion {
  const state = buildStoryboardV1State();
  return {
    id: `fx-version-${String(number).padStart(3, "0")}`,
    solutionId: "fx-solution-001",
    version: number,
    parentVersionId: number > 1 ? `fx-version-${String(number - 1).padStart(3, "0")}` : null,
    state: qualityOverride ? { ...state, quality: { ...state.quality, ...qualityOverride } } : state,
    provenance: storyboardProvenance(new StoryboardClock()),
  };
}

test("manifest round trip: serialize -> parse preserves the contract-shaped payload", () => {
  const version = makeVersion(1);
  const manifest = buildSolutionPackageManifest({
    version,
    lineage: [],
    editor: STORYBOARD_EDITOR_RECOMMENDATION,
    consent: { policyId: "fx-consent-policy-001", state: "unknown", learningPermission: false },
    exportedAt: "2025-06-02T09:00:00.000Z",
    intent: { id: "fx-intent-001", text: "wave" },
    workspaceIdentity: "ws-a",
    displayName: "Studio Human — Aria",
  });

  const json = serializeSolutionPackageManifest(manifest);
  const parsed = parseSolutionPackageManifest(json);

  assert.equal(parsed.formatVersion, SOLUTION_PACKAGE_FORMAT_VERSION);
  assert.equal(parsed.version.id, version.id);
  assert.equal(parsed.version.state.entities.length, version.state.entities.length);
  assert.equal(parsed.editor.editorId, STORYBOARD_EDITOR_RECOMMENDATION.editorId);
  assert.equal(parsed.consent.learningPermission, false);
  assert.equal(parsed.intent?.id, "fx-intent-001");
  assert.equal(parsed.simulated, true);
  assert.deepEqual(parsed.lineage, []);
});

test("serialization is deterministic: repeated exports are byte-identical", () => {
  const version = makeVersion(2);
  const build = () =>
    buildSolutionPackageManifest({
      version,
      lineage: ["fx-version-001"],
      editor: STORYBOARD_EDITOR_RECOMMENDATION,
      consent: { policyId: "p", state: "granted", learningPermission: true },
      exportedAt: "2025-06-02T09:00:05.000Z",
      intent: null,
      workspaceIdentity: "ws-a",
      displayName: "Studio Human — Aria",
    });
  assert.equal(serializeSolutionPackageManifest(build()), serializeSolutionPackageManifest(build()));
});

test("parse rejects invalid packages with typed, truthful errors", () => {
  assert.throws(() => parseSolutionPackageManifest("not json"), SolutionPackageParseError);
  assert.throws(() => parseSolutionPackageManifest("[]"), SolutionPackageParseError);
  assert.throws(
    () => parseSolutionPackageManifest(JSON.stringify({ formatVersion: "wrong/1" })),
    SolutionPackageParseError,
  );
  assert.throws(
    () =>
      parseSolutionPackageManifest(
        JSON.stringify({ formatVersion: SOLUTION_PACKAGE_FORMAT_VERSION, version: {} }),
      ),
    SolutionPackageParseError,
  );
});

test("diff is truthful: identical versions report identical, edited ones report real changes", () => {
  const current = makeVersion(1);
  const identical = makeVersion(1);
  assert.equal(diffSolutionVersionAgainst(identical, current).identical, true);

  // 编辑：右臂旋转 + appearance 质量 + 环境（不可变记录 → 以拷贝构造）。
  const baseState = buildStoryboardV1State();
  const editedState = {
    ...baseState,
    entities: baseState.entities.map((entity) =>
      entity.id === "fx-human-arm-right"
        ? { ...entity, transform: { ...entity.transform, rotation: [0, 0, -2.05] as [number, number, number] } }
        : entity,
    ),
    quality: { ...baseState.quality, appearance: 0.83 },
    environment: { ...baseState.environment, ambientIntensity: 0.68 },
  };
  const edited: SolutionVersion = { ...current, state: editedState };

  const diff = diffSolutionVersionAgainst(edited, current);
  assert.equal(diff.identical, false);
  assert.equal(diff.environmentChanged, true);
  assert.deepEqual(
    diff.qualityChanges.map((entry) => [entry.deficiencyClass, entry.before, entry.after]),
    [["appearance", 0.61, 0.83]],
  );
  const armChange = diff.entityChanges.find((entry) => entry.entityId === "fx-human-arm-right");
  assert.equal(armChange?.kind, "transform-changed");
  assert.match(armChange!.detail, /-0\.18/);
  assert.match(armChange!.detail, /-2\.05/);

  // 增删实体被如实上报。
  const addedState = {
    ...buildStoryboardV1State(),
    entities: [
      ...buildStoryboardV1State().entities,
      {
        id: "fx-prop-extra",
        kind: "prop",
        label: "Extra prop",
        transform: {
          position: [1, 0.2, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          scale: [1, 1, 1] as [number, number, number],
        },
        attributes: {},
      },
    ],
  };
  const added: SolutionVersion = { ...current, state: addedState };
  const addedDiff = diffSolutionVersionAgainst(added, current);
  assert.equal(addedDiff.entityChanges.some((entry) => entry.kind === "added"), true);

  const removedState = {
    ...buildStoryboardV1State(),
    entities: buildStoryboardV1State().entities.filter(
      (entity) => entity.id !== "fx-light-key",
    ),
  };
  const removed: SolutionVersion = { ...current, state: removedState };
  const removedDiff = diffSolutionVersionAgainst(removed, current);
  assert.equal(
    removedDiff.entityChanges.some((entry) => entry.kind === "removed" && entry.entityId === "fx-light-key"),
    true,
  );
});
