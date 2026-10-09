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
  await import("./src/contractSeam.test.js");
  await import("./src/consumer-sim.test.js");
}
