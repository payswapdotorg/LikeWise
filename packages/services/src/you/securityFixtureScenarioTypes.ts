// YOU W11A security fixture scenario — shared constants, types and
// helpers.
//
// The scenario runner (securityFixtureScenario.ts) orchestrates the full
// W11A hardening-verification arrow (docs/you/WORK_ORDERS.md W11A);
// this module carries its frozen fixture definition (FIXTURES.md law 2:
// seeds are stable constants) plus the step/trace types and the pure
// helpers both modules share.

import type { OpaqueId } from "@zcode/shared";
import type { SecurityReviewFinding } from "../../../shared/src/you/securityReview.js";

export const SECURITY_SCENARIO_SOLUTION_ID = "you_w11a_scenario_solution01";
export const SECURITY_SCENARIO_SEED = "you-w11a-security-scenario";

/**
 * The scenario threat-model entries: T1 mitigated (export-leak with a
 * mitigation ref and an honestly stated residual), T2 unmitigated
 * (provider-failure with mitigationRef null — the residual is stated
 * honestly anyway; that is the honesty law).
 */
export const SECURITY_SCENARIO_THREAT_ONE = {
  threatClass: "export-leak",
  vector: "export bundles embed provenance metadata for sensitive-media subjects",
  mitigationRef: "you_mitigation_export-md_00000001",
  residual: "provenance stripping covers known exporters; novel exporters remain unreviewed until W12",
} as const;

export const SECURITY_SCENARIO_THREAT_TWO = {
  threatClass: "provider-failure",
  vector: "a provider outage stalls every render job mid-flight with no drain",
  mitigationRef: null,
  residual: "no circuit breaker is wired yet; jobs stall until the provider recovers or an operator intervenes",
} as const;

/**
 * The scenario review: two findings recorded verbatim (one medium, one
 * high) over the export surface the threat model covered.
 */
export const SECURITY_SCENARIO_REVIEW_SCOPE = "you_scope_export-review_01";
export const SECURITY_SCENARIO_REVIEW_FINDINGS: readonly SecurityReviewFinding[] = [
  { signature: "signature:export-metadata-leak", severity: "medium", description: "export bundles embed provenance metadata for sensitive-media subjects" },
  { signature: "signature:editor-plugin-unsigned", severity: "high", description: "the editor-plugin scan class admits unsigned plugin manifests" },
];

/** The separate acceptance decision for the scenario review. */
export const SECURITY_SCENARIO_ACCEPTANCE_INPUT = {
  acceptedBy: "you_user_0000000000000001",
  reason: "fixture-acceptance-reviewed",
} as const;

/**
 * The scenario load test: simulated-labeled (the truth law — Phase 0
// has no real harness), finite positive peak/p99, one listed regression.
 */
export const SECURITY_SCENARIO_LOAD_TEST = {
  scenarioRef: "you_scenario_peak-render_01",
  source: "simulated",
  peakRps: 240.5,
  p99Ms: 180.25,
} as const;

export const SECURITY_SCENARIO_LOAD_TEST_REGRESSIONS = [
  "p99 regressed at peak rps",
  "export throughput flat at 200 rps",
] as const;

export interface SecurityScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface SecurityScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly threatEntryIds: readonly OpaqueId[];
  readonly reviewIds: readonly OpaqueId[];
  readonly acceptedReviewId: OpaqueId;
  readonly acceptanceId: OpaqueId;
  /** The zero-findings review used for the acceptance-without-findings refusal. */
  readonly cleanReviewId: OpaqueId;
  readonly loadTestReportId: OpaqueId;
  readonly chainWalk: readonly string[];
  readonly refusalOutcomes: Readonly<Record<string, string>>;
  readonly eventCounts: Readonly<Record<string, number>>;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly projectionMatchesReplay: boolean;
  readonly simulated: boolean;
  readonly steps: readonly SecurityScenarioStep[];
}

export interface SecurityScenarioOptions {
  readonly solutionId?: OpaqueId;
  readonly seed?: string;
}

export function outcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}
