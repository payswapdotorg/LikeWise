// YOU W3A twin fixture scenario — shared constants, types and helpers.
//
// The scenario runner (twinFixtureScenario.ts) orchestrates the full
// twin arrow; this module carries its frozen fixture definition
// (FIXTURES.md law 2: seeds are stable constants) plus the step/trace
// types and the pure helpers both modules share.

import type { OpaqueId, TwinVersion } from "@zcode/shared";

export const TWIN_SCENARIO_SOLUTION_ID = "you_w3a_scenario_solution01";
export const TWIN_SCENARIO_SEED = "you-w3a-twin-scenario";
/**
 * Evidence-plane seed, selected at fixture-design time so the golden story
 * holds end-to-end: v2 carries a face-hands geometric-error deficiency, the
 * targeted remediation evidence resolves it on v3 (all deficiencies clear).
 * The seed is part of the frozen fixture definition (FIXTURES.md law 2).
 */
export const EVIDENCE_SCENARIO_SEED = "you-w3a-twin-scenario-evidence-7";

/** v1 seed domains (identity-binding + morphology + geometry-skeleton + two improvement targets). */
export const TWIN_SCENARIO_V1_DOMAINS = [
  "appearance-materials",
  "face-hands",
  "geometry-skeleton",
  "identity-binding",
  "morphology",
] as const;

/** Reconstruction target domains. */
export const TWIN_SCENARIO_RECON_TARGETS = ["appearance-materials", "face-hands", "geometry-skeleton"] as const;

export interface TwinScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface TwinScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly twinId: OpaqueId;
  readonly sessionId: OpaqueId;
  readonly remediationSessionId: OpaqueId;
  readonly remediationRequestId: OpaqueId;
  readonly evidenceIds: readonly OpaqueId[];
  readonly remediationEvidenceId: OpaqueId;
  readonly versions: Readonly<Record<string, { readonly id: OpaqueId; readonly version: number; readonly status: string }>>;
  readonly jobId: OpaqueId;
  readonly remediationJobId: OpaqueId;
  readonly finalCanonicalVersionId: OpaqueId | null;
  readonly finalSupersededBy: Readonly<Record<string, string>>;
  readonly v1FaceHandsScore: number;
  readonly v3FaceHandsScore: number;
  readonly faceHandsRemediationLinkedOnV3: boolean;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly twinStoreSize: number;
  readonly projectionMatchesReplay: boolean;
  readonly steps: readonly TwinScenarioStep[];
}

export interface TwinScenarioOptions {
  readonly solutionId?: OpaqueId;
  readonly twinSeed?: string;
  readonly evidenceSeed?: string;
}

/** Domains retained from the previous version when assembling a post-reconstruction version. */
export function retainedBlocks(
  previous: readonly import("@zcode/shared").HtirDomainBlock[],
  produced: readonly import("@zcode/shared").HtirDomainBlock[],
): readonly import("@zcode/shared").HtirDomainBlock[] {
  const producedDomains = new Set(produced.map((block) => block.domain));
  return previous.filter((block) => !producedDomains.has(block.domain));
}

export function faceHandsScoreOf(version: TwinVersion): number {
  return version.quality.domainScores["face-hands"] ?? 0;
}

export function outcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}

/** Stable v{n} -> summary map over a version list (trace assembly). */
export function versionSummariesOf(
  versions: readonly TwinVersion[],
): Record<string, { id: string; version: number; status: string }> {
  const summaries: Record<string, { id: string; version: number; status: string }> = {};
  for (const version of versions) {
    summaries[`v${version.version}`] = { id: version.id, version: version.version, status: version.status };
  }
  return summaries;
}
