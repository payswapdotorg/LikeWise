// @zcode/you-lab — package root entry (W2C).
//
// tsx resolves a DIRECTORY argument (the station command
// `pnpm exec tsx --test packages/you-lab`) to this index module and runs it
// as the single test-runner child entry. The guard below fires only in that
// case and imports the co-located test modules (same mechanism as
// src/index.ts for the `packages/you-lab/src` directory form). Library
// imports re-export the public entry and never trigger the guard.

export * from "./src/index.js";

import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function isTestRunnerDirectoryEntry(): boolean {
  const context = process.env.NODE_TEST_CONTEXT ?? "";
  if (!context.startsWith("child")) return false;
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    const own = fileURLToPath(import.meta.url);
    // Entry may be the unresolved directory (".../packages/you-lab") — tsx
    // resolves it to THIS module — or the resolved file path itself.
    return own === join(resolve(entry), "index.ts") || own === resolve(entry);
  } catch {
    return false;
  }
}

if (isTestRunnerDirectoryEntry()) {
  await import("./src/technology/registry.test.js");
  await import("./src/technology/editorCapability.test.js");
  await import("./src/technology/captureSeedProfiles.test.js");
  await import("./src/adapters/mockEditorAdapter.test.js");
  await import("./src/organization/compiler.test.js");
  await import("./src/benchmarks/benchmark.test.js");
  await import("./src/capture/deterministicRng.test.js");
  await import("./src/capture/syntheticPayload.test.js");
  await import("./src/capture/mockSegmentationAdapter.test.js");
  await import("./src/capture/mockPoseAdapter.test.js");
  await import("./src/capture/observationScorer.test.js");
  await import("./src/capture/captureBenchmark.test.js");
  await import("./src/capture/captureEvaluation.test.js");
  await import("./src/learning/capabilityProfiles.test.js");
  await import("./src/learning/learningEvaluation.test.js");
  await import("./src/learning/mockLearningAdapter.test.js");
  await import("./src/learning/learningBenchmark.test.js");
  await import("./src/learning/learningSeam.test.js");
  await import("./src/contractSeam.test.js");
  await import("./src/consumer-sim.test.js");
  // W3C-W7C additions (reconstruction/render/editing/soul/realtime) and the
  // W8C arena-automation additions — the directory form now reports the
  // FULL suite (parity with the glob form; the W2C-era list above is kept
  // verbatim for history, the additions follow the src/index.ts order).
  await import("./src/technology/reconstructionSeedProfiles.test.js");
  await import("./src/technology/renderSeedProfiles.test.js");
  await import("./src/technology/editorSeedProfiles.test.js");
  await import("./src/reconstruction/mockReconstructionAdapter.test.js");
  await import("./src/reconstruction/colmapPhotogrammetryAdapter.test.js");
  await import("./src/reconstruction/reconstructionEvaluation.test.js");
  await import("./src/reconstruction/reconstructionBenchmark.test.js");
  await import("./src/reconstruction/reconstructionSeam.test.js");
  await import("./src/render/mockRenderAdapter.test.js");
  await import("./src/render/renderEvaluation.test.js");
  await import("./src/render/renderBenchmark.test.js");
  await import("./src/render/renderSeam.test.js");
  await import("./src/editing/capabilityProfiles.test.js");
  await import("./src/editing/editorEvaluation.test.js");
  await import("./src/editing/mockEditingAdapter.test.js");
  await import("./src/editing/roundTripBenchmark.test.js");
  await import("./src/editing/editingSeam.test.js");
  await import("./src/technology/soulSeedProfiles.test.js");
  await import("./src/soul/capabilityProfiles.test.js");
  await import("./src/soul/soulEvaluation.test.js");
  await import("./src/soul/mockSoulAdapter.test.js");
  await import("./src/soul/soulBenchmark.test.js");
  await import("./src/soul/soulSeam.test.js");
  await import("./src/realtime/realtimeAdapterSeam.test.js");
  await import("./src/technology/gapDetectionSeedProfiles.test.js");
  await import("./src/technology/retryBackoffSeedProfiles.test.js");
  await import("./src/arena/arenaAdapterSeam.test.js");
  await import("./src/arena/arenaEvaluation.test.js");
  await import("./src/arena/mockArenaAdapter.test.js");
  await import("./src/arena/gapProjections.test.js");
  await import("./src/arena/arenaBenchmark.test.js");
  await import("./src/arena/arenaSeam.test.js");
  // W9C research-organization additions — the directory form reports the
  // FULL suite (parity with the glob form).
  await import("./src/research/worlds.test.js");
  await import("./src/research/pipelineGenome.test.js");
  await import("./src/research/searchLadder.test.js");
  await import("./src/research/failureAtlas.test.js");
  await import("./src/research/promotionEvidence.test.js");
  await import("./src/research/researchSeam.test.js");
}
