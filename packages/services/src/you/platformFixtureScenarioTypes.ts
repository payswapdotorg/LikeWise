// YOU W10A platform fixture scenario — shared constants, types and
// helpers.
//
// The scenario runner (platformFixtureScenario.ts) orchestrates the full
// W10A hardening arrow; this module carries its frozen fixture
// definition (FIXTURES.md law 2: seeds are stable constants) plus the
// step/trace types and the pure helpers both modules share.

import type { OpaqueId } from "@zcode/shared";

export const PLATFORM_SCENARIO_SOLUTION_ID = "you_w10a_scenario_solution01";
export const PLATFORM_SCENARIO_SEED = "you-w10a-platform-scenario";

/**
 * The scenario scan policy: 2 requests per 60s window on the import:scan
 * scope, deny action. The window is large enough that the two scripted
 * scans (A clean, B quarantined) share it; the third scan (D) exhausts
 * the burst and the scenario then burns 70 ticks to roll the window.
 */
export const PLATFORM_SCENARIO_SCAN_POLICY_INPUT = {
  scope: "import:scan",
  windowS: 60,
  burst: 2,
  action: "deny" as const,
};

/** Clean import (artifact-bundle; a low finding stays clean). */
export const PLATFORM_SCENARIO_IMPORT_A_REF = "you_content_importA_fixture_01";
export const PLATFORM_SCENARIO_IMPORT_A_SCAN = {
  artifactRef: PLATFORM_SCENARIO_IMPORT_A_REF,
  scanClass: "artifact-bundle",
  findings: [{ signature: "signature:metadata-stale", severity: "low" as const }],
} as const;

/** Quarantined import (avatar-vrm; a medium finding quarantines). */
export const PLATFORM_SCENARIO_IMPORT_B_REF = "you_content_importB_fixture_01";
export const PLATFORM_SCENARIO_IMPORT_B_SCAN = {
  artifactRef: PLATFORM_SCENARIO_IMPORT_B_REF,
  scanClass: "avatar-vrm",
  findings: [{ signature: "signature:embedded-script", severity: "medium" as const }],
} as const;

/** Rejected import (avatar-vrm; a high finding rejects — terminal). */
export const PLATFORM_SCENARIO_IMPORT_D_REF = "you_content_importD_fixture_01";
export const PLATFORM_SCENARIO_IMPORT_D_SCAN = {
  artifactRef: PLATFORM_SCENARIO_IMPORT_D_REF,
  scanClass: "avatar-vrm",
  findings: [{ signature: "signature:remote-execution", severity: "high" as const }],
} as const;

/** An import ref that is never scanned (the unscanned-admission refusal). */
export const PLATFORM_SCENARIO_IMPORT_C_REF = "you_content_importC_fixture_01";

/** The explicit release facts for the quarantined import B. */
export const PLATFORM_SCENARIO_RELEASE_INPUT = {
  releasedBy: "you_user_0000000000000001",
  reason: "fixture-release-reviewed",
} as const;

/** The retention subjects: S1 consent-protected (granted), S2 free (withdrawn). */
export const PLATFORM_SCENARIO_RETENTION_S1_REF = "you_retention-subject_fixture01";
export const PLATFORM_SCENARIO_RETENTION_S2_REF = "you_retention-subject_fixture02";
export const PLATFORM_SCENARIO_RETENTION_CLASS = "project-retention";
export const PLATFORM_SCENARIO_RETENTION_CONSENT_PROTECTED = "granted" as const;
export const PLATFORM_SCENARIO_RETENTION_CONSENT_FREE = "withdrawn" as const;

/**
 * The DR snapshot bytes (fixture definition — deterministic synthetic
 * content, no PII). Snapshot one verifies; snapshot two's expected hash
 * is tampered (the first hex digit flipped) for the unverifiable path.
 */
export const PLATFORM_SCENARIO_DR_SNAPSHOT_ONE_TEXT = "you-w10a-dr-snapshot-fixture-01";
export const PLATFORM_SCENARIO_DR_SNAPSHOT_TWO_TEXT = "you-w10a-dr-snapshot-fixture-02";

/** Tampers a sha-256 hex digest's first character (0 <-> 1). */
export function tamperHash(contentHash: string): string {
  const first = contentHash.slice(0, 1);
  const flipped = first === "0" ? "1" : "0";
  return `${flipped}${contentHash.slice(1)}`;
}

/** Deterministic fixture bytes for a text literal (charCodeAt, no ambient encoding). */
export function fixtureBytes(text: string): Uint8Array {
  return Uint8Array.from([...text].map((character) => character.charCodeAt(0) & 0xff));
}

/** Clock ticks to burn past the 60s scan window (the roll demonstration). */
export const PLATFORM_SCENARIO_TICKS_TO_BURN = 70;

export interface PlatformScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface PlatformScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly scanPolicyId: OpaqueId;
  readonly importVerdictIds: readonly OpaqueId[];
  readonly releaseId: OpaqueId;
  readonly retentionRecordId: OpaqueId;
  readonly drRestoreIds: readonly OpaqueId[];
  readonly activeDrRestoreId: OpaqueId | null;
  readonly scanWalk: readonly string[];
  readonly refusalOutcomes: Readonly<Record<string, string>>;
  readonly eventCounts: Readonly<Record<string, number>>;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly projectionMatchesReplay: boolean;
  readonly simulated: boolean;
  readonly steps: readonly PlatformScenarioStep[];
}

export interface PlatformScenarioOptions {
  readonly solutionId?: OpaqueId;
  readonly seed?: string;
}

export function outcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}
