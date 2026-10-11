// YOU W4A performance fixture scenario — shared constants, types and
// helpers.
//
// The scenario runner (performanceFixtureScenario.ts) orchestrates the
// full wave-4 arrow; this module carries its frozen fixture definition
// (FIXTURES.md law 2: seeds are stable constants) plus the step/trace
// types and the pure helpers both modules share.

import type { OpaqueId, RenderArtifact, RenderJobResult } from "@zcode/shared";

export const PERFORMANCE_SCENARIO_SOLUTION_ID = "you_w4a_scenario_solution01";
export const PERFORMANCE_SCENARIO_SEED = "you-w4a-performance-scenario";
/** Twin-plane seed (the scenario wires the real wave-3 TwinService for the binding). */
export const TWIN_WIRING_SEED = "you-w4a-performance-scenario-twin";

/** The scenario template: three tracks, five cues, 5000ms (frozen fixture definition). */
export const SCENARIO_TEMPLATE_CUE_SPECS = [
  { track: "motion", startMs: 0, endMs: 2000 },
  { track: "motion", startMs: 2000, endMs: 4000 },
  { track: "cue", startMs: 500, endMs: 1500 },
  { track: "cue", startMs: 2500, endMs: 3500 },
  { track: "layer", startMs: 4000, endMs: 5000 },
] as const;

/** The scenario template's declared parameters (plain-record schema). */
export const SCENARIO_TEMPLATE_PARAMETERS = {
  greeting: "Hello from the scenario twin",
  intensity: 0.8,
  loop: false,
} as const;

export interface PerformanceScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface PerformanceScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly twinId: OpaqueId;
  readonly twinVersionId: OpaqueId;
  readonly templateId: OpaqueId;
  readonly instantiatedPerformanceId: OpaqueId;
  readonly directPerformanceId: OpaqueId;
  readonly renderJobId: OpaqueId;
  readonly failedJobId: OpaqueId;
  readonly artifactIds: readonly OpaqueId[];
  readonly acceptedReviewId: OpaqueId;
  readonly rejectedReviewId: OpaqueId;
  readonly withdrawnReviewId: OpaqueId;
  readonly reReviewId: OpaqueId;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly performanceStoreSize: number;
  readonly projectionMatchesReplay: boolean;
  readonly steps: readonly PerformanceScenarioStep[];
}

export interface PerformanceScenarioOptions {
  readonly solutionId?: OpaqueId;
  readonly performanceSeed?: string;
  readonly twinSeed?: string;
}

export function outcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}

/** Artifact content-hash summary (job -> artifacts lineage facts). */
export function artifactLineageSummary(artifacts: readonly RenderArtifact[]): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const [index, artifact] of artifacts.entries()) {
    summary[`artifact${index + 1}Id`] = artifact.id;
    summary[`artifact${index + 1}Kind`] = artifact.kind;
    summary[`artifact${index + 1}Hash`] = artifact.contentHash.slice(0, 8);
  }
  return summary;
}

/** Honest completion facts of a render result (truth law markers). */
export function renderResultFacts(result: RenderJobResult): Record<string, string | number | boolean> {
  return {
    jobId: result.jobId,
    status: result.status,
    artifactCount: result.artifacts.length,
    latencyNotMeasured: result.effortObservations["latencyMs.measured"] === false,
    latencyMarker: String(result.effortObservations["latencyMs"]),
    simulated: result.simulated,
  };
}
