// Deterministic benchmark runner (W1C).
//
// Runs the three comparison arms (docs/you/LAB.md) over the seeded fixture
// set and records results as STRUCTURED FIELDS. Truth law: quality scores are
// computed fixture objective values (deterministic arithmetic — labeled as
// computed, not measured); manual-effort/latency/cost are recorded as explicit
// "not-measured (simulated)" markers — never faked numbers; privacy is
// derived from the bound technologies (all seed registry candidates are local
// open-source, so localOnly is a claim about the fixture registry, labeled
// accordingly). No clock, no randomness, no network.

import { canonicalJson, fnv1a32 } from "../determinism.js";
import { compileOrganization } from "../organization/compiler.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import { generalistBaselineArm, handDesignedArm, searchedArm, type ArmKind, type OrganizationCandidate } from "./arms.js";
import { FIXTURE_SET_VERSION, type BenchmarkFixture } from "./fixtures.js";

export type MetricField =
  | { readonly kind: "not-measured"; readonly marker: "not-measured (simulated)" }
  | {
      readonly kind: "estimate";
      readonly value: number;
      readonly unit: string;
      readonly simulated: true;
      readonly basis: string;
    }
  | { readonly kind: "measured"; readonly value: number; readonly unit: string; readonly source: string };

export interface FixtureArmScore {
  readonly fixtureId: string;
  readonly qualityScore: number;
}

export interface ArmResult {
  readonly arm: ArmKind;
  readonly label: string;
  readonly fixtureScores: readonly FixtureArmScore[];
  /** Mean of fixture quality scores (deterministic arithmetic). */
  readonly overallQualityScore: number;
  readonly manualEffort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
  readonly privacy: {
    readonly policy: string;
    readonly localOnly: boolean;
    readonly note: string;
  };
}

export interface BenchmarkReport {
  readonly runId: string;
  readonly fixtureSetVersion: string;
  readonly armResults: readonly ArmResult[];
  readonly notes: readonly string[];
}

const ARM_ORDER: readonly ArmKind[] = ["generalist-baseline", "hand-designed", "searched"];

export function runBenchmark(
  fixtures: readonly BenchmarkFixture[],
  registry: TechnologyRegistry,
): BenchmarkReport {
  const armResults: ArmResult[] = ARM_ORDER.map((arm) => {
    const fixtureScores: FixtureArmScore[] = fixtures.map((fixture) => {
      const plan = compileOrganization(fixture.intent, registry);
      const candidate = buildArm(arm, fixture.intent, plan.requirements, registry);
      return { fixtureId: fixture.fixtureId, qualityScore: candidate.qualityScore };
    });
    const mean =
      fixtureScores.length === 0
        ? 0
        : fixtureScores.reduce((sum, entry) => sum + entry.qualityScore, 0) / fixtureScores.length;
    return {
      arm,
      label: describeArm(arm),
      fixtureScores,
      overallQualityScore: Math.round(mean * 10_000) / 10_000,
      manualEffort: notMeasured(),
      latency: notMeasured(),
      cost: notMeasured(),
      privacy: {
        policy: describePrivacyPolicies(fixtures),
        localOnly: true,
        note: "all seed registry candidates are local open-source technologies (fixture claim about the seeded registry, not a live deployment property)",
      },
    };
  });
  const notes = [
    "quality scores are computed deterministic fixture objective values (you-lab benchmark scorer) — not user studies and not live measurements",
    "manual-effort, latency and cost are not-measured (simulated) markers; no measurement was performed and none is implied",
    "the searched arm is promoted only when it beats the baseline under this fixture objective (asserted in tests)",
  ];
  const reportWithoutId = {
    fixtureSetVersion: FIXTURE_SET_VERSION,
    armResults,
    notes,
  };
  return { runId: fnv1a32(canonicalJson(reportWithoutId)), ...reportWithoutId };
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}

function describeArm(arm: ArmKind): string {
  switch (arm) {
    case "generalist-baseline":
      return "generalist baseline: one technology bound to every requirement";
    case "hand-designed":
      return "hand-designed organization: authored domain-to-technology mapping";
    case "searched":
      return "searched organization: deterministic exhaustive search over the fixture space";
  }
}

function describePrivacyPolicies(fixtures: readonly BenchmarkFixture[]): string {
  const policies = [...new Set(fixtures.map((fixture) => fixture.intent.constraints.privacyPolicy))].sort();
  return policies.join("|");
}

function buildArm(
  arm: ArmKind,
  intent: BenchmarkFixture["intent"],
  requirements: ReturnType<typeof compileOrganization>["requirements"],
  registry: TechnologyRegistry,
): OrganizationCandidate {
  if (arm === "generalist-baseline") return generalistBaselineArm(intent, requirements, registry);
  if (arm === "hand-designed") return handDesignedArm(intent, requirements, registry);
  return searchedArm(intent, requirements, registry);
}
