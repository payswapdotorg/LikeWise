// Deterministic mock ecosystem adapter (W10C).
//
// Implements the provider-neutral ecosystem seam against pure mock
// candidates. The mock resolves the request through the ProviderMatrix
// (the fail-closed gate runs before any mock behavior), then serves each
// requested (style × export) pair with a seeded-degradation fidelity
// payload — resultContentHash = sha-256 over the canonical payload map —
// with knobs (style coverage dropout, export folding, fidelity drift,
// breaker-class misderivation) so the ecosystem benchmark can score
// different fidelity classes across the order's candidate classes. PURE
// MOCKS (technologyId: null): their parameters are fixture inputs
// exercising the seam, NOT assessments of any real ecosystem technology.
// No clock, no Math.random, no network — all degradation derives from
// hash-keyed streams (unitFrom), so every value is a pure function of
// (adapterId, requestId, providerKind, styleRef, exportRef).
//
// BREAKER HONESTY: when honorsBreakerClass is false the mock derives its
// fidelity under the token-bucket quality band — the payload carries the
// class ACTUALLY used, and the misderivation stays visible in warnings
// (truth law — never rewritten into a correct one).

import { roundTo } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import type { NeutralArenaBackoffClass } from "../arena/arenaAdapterSeam.js";
import {
  aggregateEcosystemDigest,
  assertEcosystemRequestSupported,
  encodeEcosystemFulfillment,
  intendedBreakerQualityAt,
  intendedFulfillmentFidelityAt,
  notMeasuredEcosystemEffortFields,
  type EcosystemAdapter,
  type EcosystemAdapterProfile,
  type NeutralEcosystemOutput,
  type NeutralEcosystemRequest,
  type ProviderMatrixRegistry,
} from "./providerMatrixSeam.js";
import { enforceCostLatencyBudget } from "./budgetGuardSeam.js";
import type { ProductionEligibilityLedger } from "./eligibilityLedger.js";

const GENERATOR = "you-lab-mock-ecosystem-adapter/1";

/** Mock degradation configuration (fixture input, not a technology assessment). */
export interface MockEcosystemConfig {
  readonly id: string;
  /** Regions the mock adapter serves (fixture vocabulary). */
  readonly servedRegions: readonly string[];
  /** Style classes the mock serves (fixture vocabulary). */
  readonly servedStyles: readonly string[];
  /** Export classes the mock serves (fixture vocabulary). */
  readonly servedExports: readonly string[];
  /** Seeded per-(style,export) fulfillment probability (0..1): the fraction of requested pairs actually served. */
  readonly fulfillmentRate: number;
  /** Seeded relative drift applied to fulfillment fidelity values (0..1). */
  readonly fidelityDrift: number;
  /** Whether distinct export classes survive (false: every fulfillment folds its export into the first requested export — visible folding). */
  readonly preservesExportClasses: boolean;
  /** Whether fidelity derives under the requested breaker class (false: derives under the token-bucket band — visible misderivation). */
  readonly honorsBreakerClass: boolean;
}

export function createMockEcosystemAdapter(config: MockEcosystemConfig): EcosystemAdapter {
  const profile: EcosystemAdapterProfile = {
    id: config.id,
    technologyId: null,
    servedRegions: config.servedRegions,
    servedStyles: config.servedStyles,
    servedExports: config.servedExports,
    adapterKind: "mock",
    deterministic: true,
    determinismNote: "pure mock: all degradation is seed-derived (unitFrom keyed streams); byte-identical replay from the seed",
    productionEligible: null,
    eligibilityBasis: "pure mock candidate — no registry backing, no eligibility claim",
  };
  return {
    profile,
    fulfill(request: NeutralEcosystemRequest, matrix: ProviderMatrixRegistry, ledger: ProductionEligibilityLedger): NeutralEcosystemOutput {
      // The shared fail-closed gate runs FIRST (the ECOSYSTEM GATE LAW, the
      // budget law and the production eligibility law cannot be bypassed
      // by any mock behavior).
      const entry = assertEcosystemRequestSupported(profile, request, matrix, ledger);
      const actualClass: NeutralArenaBackoffClass = config.honorsBreakerClass
        ? request.budget.breakerClass
        : "token-bucket";
      const payloads: Record<string, Record<string, unknown>> = {};
      const servedStyles: string[] = [];
      const servedExports: string[] = [];
      // A styles-only request (no export refs) serves one "no-export"
      // fulfillment pair per style — the (style × export) surface stays
      // uniform and every style derives a scored payload.
      const effectiveExportRefs = request.exportRefs.length > 0 ? request.exportRefs : [""];
      const requestedExports = config.preservesExportClasses
        ? effectiveExportRefs
        : [effectiveExportRefs[0]!];
      for (const styleRef of request.styleRefs) {
        for (const exportRef of requestedExports) {
          const served = unitFrom(config.id, request.requestId, `${entry.providerKind}|${styleRef}|${exportRef}`, "serve") < config.fulfillmentRate;
          if (!served) continue;
          const drift = 1 + (unitFrom(config.id, request.requestId, `${styleRef}|${exportRef}`, "drift") * 2 - 1) * config.fidelityDrift;
          const quality = intendedBreakerQualityAt(entry.providerKind, actualClass);
          const fidelity = roundTo(intendedFulfillmentFidelityAt(entry.providerKind, styleRef, exportRef) * quality * drift, 4);
          payloads[`${styleRef}|${exportRef}`] = encodeEcosystemFulfillment(entry, request, styleRef, exportRef, actualClass, fidelity);
          if (!servedStyles.includes(styleRef)) servedStyles.push(styleRef);
          if (!servedExports.includes(exportRef)) servedExports.push(exportRef);
        }
      }
      const warnings: string[] = [];
      if (!config.honorsBreakerClass) {
        warnings.push(
          `breaker misderivation: the requested class '${request.budget.breakerClass}' was derived under '${actualClass}' (visible misderivation — never rewritten)`,
        );
      }
      if (!config.preservesExportClasses && request.exportRefs.length > 1) {
        warnings.push(`export classes folded into '${request.exportRefs[0]}' (export-class fidelity loss)`);
      }
      const dropped = request.styleRefs.length * (request.exportRefs.length > 0 ? request.exportRefs.length : 1) - Object.keys(payloads).length;
      if (dropped > 0) {
        warnings.push(`${dropped} requested (style × export) fulfillment(s) not served by the mock ecosystem (seeded coverage loss)`);
      }
      // The immutable budget-guard decision appended to the output: the
      // gate already enforced the budget BEFORE the effect; the record
      // recomputes deterministically from the same inputs (byte-identical
      // — one law, one derivation).
      const budgetDecision = enforceCostLatencyBudget(request.budget, request.declaredCostUnits, request.declaredLatencyS, {
        requestId: request.requestId,
        scope: request.budget.scope,
        submittedAt: request.submittedAt,
      });
      return {
        adapterId: config.id,
        requestId: request.requestId,
        matrixEntryId: entry.id,
        servedStyles: [...servedStyles].sort(),
        servedExports: [...servedExports].sort(),
        budgetDecision,
        payloads,
        resultContentHash: aggregateEcosystemDigest(payloads, actualClass),
        warnings: [...new Set(warnings)].sort(),
        effort: notMeasuredEcosystemEffortFields(),
        simulated: true,
      };
    },
  };
}

/** Generator label for provenance wiring (honest mock scope). */
export function mockEcosystemGenerator(): string {
  return GENERATOR;
}
