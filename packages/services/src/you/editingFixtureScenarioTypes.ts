// YOU W5A editing fixture scenario — shared constants, types and helpers.
//
// The scenario runner (editingFixtureScenario.ts) orchestrates the full
// wave-5 arrow; this module carries its frozen fixture definition
// (FIXTURES.md law 2: seeds are stable constants) plus the step/trace
// types and the pure helpers both modules share.

import type { OpaqueId } from "@zcode/shared";

export const EDITING_SCENARIO_SOLUTION_ID = "you_w5a_scenario_solution01";
export const EDITING_SCENARIO_SEED = "you-w5a-editing-scenario";
/** Twin-plane seed (the scenario wires the real wave-3 TwinService for the binding). */
export const TWIN_WIRING_SEED = "you-w5a-editing-scenario-twin";
/** Performance-plane seed (the scenario wires the real wave-4 PerformanceService render artifact as the subject). */
export const PERFORMANCE_WIRING_SEED = "you-w5a-editing-scenario-performance";

/** The rendered timeline the scenario's render job turns into the subject artifact (frozen fixture definition). */
export const SCENARIO_RENDER_CUE_SPECS = [
  { track: "motion", startMs: 0, endMs: 2000 },
  { track: "cue", startMs: 1500, endMs: 2500 },
] as const;

/** The first change set's ordered op specs (the open-session full arrow). */
export const SCENARIO_OP_SPECS_1 = [{ kind: "transform" }, { kind: "material" }, { kind: "annotation" }] as const;

/** The second change set's ordered op specs (the post-import edited change, applied to the first candidate). */
export const SCENARIO_OP_SPECS_2 = [{ kind: "material" }, { kind: "metadata" }] as const;

/** The abandoned-session path's ordered op specs. */
export const SCENARIO_OP_SPECS_3 = [{ kind: "transform" }] as const;

export interface EditingScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface EditingScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly twinId: OpaqueId;
  readonly twinVersionId: OpaqueId;
  readonly performanceId: OpaqueId;
  readonly renderJobId: OpaqueId;
  readonly renderArtifactId: OpaqueId;
  readonly subjectId: OpaqueId;
  readonly committedSessionId: OpaqueId;
  readonly abandonedSessionId: OpaqueId;
  readonly changeSetIds: readonly OpaqueId[];
  readonly candidateIds: readonly OpaqueId[];
  readonly exportResultId: OpaqueId;
  readonly failedImportResultId: OpaqueId;
  readonly importResultId: OpaqueId;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly editingStoreSize: number;
  readonly projectionMatchesReplay: boolean;
  readonly steps: readonly EditingScenarioStep[];
}

export interface EditingScenarioOptions {
  readonly solutionId?: OpaqueId;
  readonly editingSeed?: string;
  readonly twinSeed?: string;
  readonly performanceSeed?: string;
}

/** Builds one recorded scenario step (shared by the wiring + scenario runners). */
export function scenarioStep(index: number, name: string, facts: Record<string, string | number | boolean>): EditingScenarioStep {
  return { step: index, name, facts };
}

/** Unwraps a typed service result or throws with the refusal code (scenario invariant). */
export function scenarioMust<T>(
  result: { readonly ok: boolean; readonly value?: T; readonly error?: { readonly code: string; readonly message: string } },
  where: string,
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`scenario failed at ${where}: ${result.error?.code ?? "unknown"} ${result.error?.message ?? ""}`);
  }
  return result.value;
}

export function outcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}

/** First 8 hex chars of a sha-256 content hash (compact lineage facts). */
export function shortHash(hash: string): string {
  return hash.slice(0, 8);
}

/**
 * Deterministically tampers an interchange package for the failed-import
 * path: replaces the content base64 with the encoding of a fixed junk
 * byte pattern of the SAME length (valid base64, correct byteLength, wrong
 * bytes) — the import must refuse with the typed content-hash-mismatch
 * refusal, never a silent repair.
 */
export function tamperInterchangeContent(packageBytes: Uint8Array): Uint8Array {
  const document = JSON.parse(new TextDecoder().decode(packageBytes)) as Record<string, unknown>;
  const sectionKey = document["format"] === "json" ? "content" : document["format"] === "scene-package" ? "scene" : "source";
  const section = document[sectionKey] as Record<string, unknown> | undefined;
  if (section === undefined || typeof section["contentBase64"] !== "string") {
    throw new Error("tamperInterchangeContent requires a content section with contentBase64");
  }
  const original = Buffer.from(section["contentBase64"], "base64");
  const junk = new Uint8Array(original.byteLength);
  for (let index = 0; index < junk.length; index += 1) {
    junk[index] = (index * 7 + 13) & 0xff;
  }
  section["contentBase64"] = Buffer.from(junk).toString("base64");
  return new TextEncoder().encode(JSON.stringify(document));
}
