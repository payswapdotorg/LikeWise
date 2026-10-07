// Deterministic benchmark fixtures (W1C) — docs/you/FIXTURES.md.
//
// Every fixture declares a stable seed constant and golden expectations.
// Golden expectations are recorded values (computed once by the shipped
// compiler/scorer and embedded); an intentional change to any golden is a NEW
// fixture version with provenance — never an in-place edit.

import type { OrganizationIntent } from "../organization/model.js";
import type { ArmKind } from "./arms.js";

export interface BenchmarkFixture {
  readonly fixtureId: string;
  readonly seed: string;
  readonly intent: OrganizationIntent;
  /** Golden: requirement domains decomposed by the compiler (sorted). */
  readonly expectedRequirementDomains: readonly string[];
  /** Golden: plan digest produced by the deterministic compiler. */
  readonly expectedPlanDigest: string;
}

export const BENCHMARK_FIXTURES: readonly BenchmarkFixture[] = [
  {
    fixtureId: "fixture-avatar-vrm-export",
    seed: "w1c-fixture-01",
    intent: {
      text: "Create an avatar of my synthetic human and export it for external editing",
      constraints: {
        outputKind: "avatar",
        requiredFormats: ["vrm"],
        qualityTarget: 0.8,
        latencyBudgetUnits: 100,
        costBudgetUnits: 50,
        privacyPolicy: "allow-external-editor",
        platform: "desktop",
        editorPreference: "prefer-external",
      },
    },
    expectedRequirementDomains: ["asset-optimization", "avatar-expression", "avatar-rig", "quality-verification", "scene-render", "vrm-avatar-output"],
    expectedPlanDigest: "8d1b6d4d",
  },
  {
    fixtureId: "fixture-scene-web",
    seed: "w1c-fixture-02",
    intent: {
      text: "Build a 3d scene with props and lighting for the web workspace",
      constraints: {
        outputKind: "3d-scene",
        requiredFormats: ["gltf"],
        qualityTarget: 0.6,
        latencyBudgetUnits: 80,
        costBudgetUnits: 30,
        privacyPolicy: "local-only",
        platform: "web",
        editorPreference: "prefer-native",
      },
    },
    expectedRequirementDomains: ["gltf-interchange", "lighting", "quality-verification", "scene-construction", "scene-render"],
    expectedPlanDigest: "63220faa",
  },
  {
    fixtureId: "fixture-diagram-annotation",
    seed: "w1c-fixture-03",
    intent: {
      text: "Annotate the captured reference with a diagram",
      constraints: {
        outputKind: "annotation",
        requiredFormats: ["svg"],
        qualityTarget: 0.5,
        latencyBudgetUnits: 40,
        costBudgetUnits: 10,
        privacyPolicy: "local-only",
        platform: "web",
        editorPreference: "none",
      },
    },
    expectedRequirementDomains: ["annotation-edit", "quality-verification", "svg-output", "vector-2d-composition"],
    expectedPlanDigest: "b5ac62b7",
  },
  {
    fixtureId: "fixture-video-timeline",
    seed: "w1c-fixture-04",
    intent: {
      text: "Compose a rendered video with an editorial timeline",
      constraints: {
        outputKind: "video",
        requiredFormats: ["mp4"],
        qualityTarget: 0.7,
        latencyBudgetUnits: 200,
        costBudgetUnits: 120,
        privacyPolicy: "allow-remote-compute",
        platform: "desktop",
        editorPreference: "prefer-external",
      },
    },
    expectedRequirementDomains: ["asset-optimization", "editorial-timeline", "media-composition", "quality-verification", "rendered-media-output", "scene-render"],
    expectedPlanDigest: "5b572239",
  },
  {
    fixtureId: "fixture-gap-obj",
    seed: "w1c-fixture-05",
    intent: {
      text: "Export the scene mesh to OBJ for a legacy toolchain",
      constraints: {
        outputKind: "3d-scene",
        requiredFormats: ["obj"],
        qualityTarget: 0.6,
        latencyBudgetUnits: 60,
        costBudgetUnits: 20,
        privacyPolicy: "local-only",
        platform: "desktop",
        editorPreference: "none",
      },
    },
    expectedRequirementDomains: ["obj-interchange", "quality-verification", "scene-construction", "scene-render"],
    expectedPlanDigest: "c808adb1",
  },
];

/** Golden: overall arm quality scores over the seeded fixture set. */
export const GOLDEN_ARM_OVERALL: Readonly<Record<ArmKind, number>> = {
  "generalist-baseline": 0.684,
  "hand-designed": 0.8867,
  searched: 0.9,
};

/** Golden: full-report digest over the seeded fixture set (byte-identical replay). */
export const GOLDEN_REPORT_RUN_ID = "a12cf51c";

export const FIXTURE_SET_VERSION = "w1c-benchmark-fixtures/1 (seeded 2026-10-08; golden expectations recorded from the shipped compiler and scorer)";
