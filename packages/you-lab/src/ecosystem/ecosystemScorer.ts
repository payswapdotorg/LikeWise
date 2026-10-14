// Deterministic ecosystem fidelity scorer (W10C).
//
// The ecosystem fidelity score is a COMPUTED fixture objective
// (deterministic arithmetic over the intended fulfillment model — the
// canonical seeded (style × export) fidelity surface under the requested
// breaker class applied to the resolved matrix row — and the adapter's
// fulfillment payload map) — it is explicitly not a user study, not a live
// measurement, and not a scientific claim about any real ecosystem
// technology. Effort, latency and cost are recorded by the runner as
// "not-measured (simulated)" markers; they are never faked here.

import { roundTo } from "../determinism.js";
import type { NeutralArenaBackoffClass } from "../arena/arenaAdapterSeam.js";
import {
  aggregateEcosystemDigest,
  encodeEcosystemFulfillment,
  intendedBreakerQualityAt,
  intendedFulfillmentFidelityAt,
  type NeutralEcosystemOutput,
  type NeutralProviderMatrixEntry,
  type ProviderMatrixRegistry,
} from "./providerMatrixSeam.js";
import type { EcosystemRequestContext } from "./ecosystemFixtures.js";

/** Score weights (authored fixture definition — asserted in tests; the W5C..W8C 0.6/0.2/0.2 shape). */
export const ECOSYSTEM_FIDELITY_WEIGHTS = { fulfillmentCoverage: 0.6, payloadFaithfulness: 0.2, recordIntegrity: 0.2 } as const;

export const SCORER_ECOSYSTEM_VERSION =
  "you-lab-ecosystem-scorer/1 (deterministic fixture objective — computed, not measured)";

/**
 * The intended fulfillment payload map for (matrix row, request): every
 * requested (style × export) pair under the canonical seeded model with
 * the breaker-quality multiplier under the REQUESTED class (full
 * coverage, exact fidelity — computed, not measured).
 */
export function intendedPayloadMapFor(
  entry: NeutralProviderMatrixEntry,
  request: EcosystemRequestContext,
): Readonly<Record<string, Record<string, unknown>>> {
  const payloads: Record<string, Record<string, unknown>> = {};
  const quality = intendedBreakerQualityAt(entry.providerKind, request.budget.breakerClass);
  // A styles-only request (no export refs) serves one "no-export"
  // fulfillment pair per style (the uniform (style × export) surface).
  const effectiveExportRefs = request.exportRefs.length > 0 ? request.exportRefs : [""];
  for (const styleRef of request.styleRefs) {
    for (const exportRef of effectiveExportRefs) {
      const fidelity = roundTo(intendedFulfillmentFidelityAt(entry.providerKind, styleRef, exportRef) * quality, 4);
      payloads[`${styleRef}|${exportRef}`] = encodeEcosystemFulfillment(
        entry,
        {
          requestId: request.requestId,
          providerKind: request.providerKind,
          region: request.region,
          styleRefs: request.styleRefs,
          exportRefs: request.exportRefs,
          budget: request.budget,
          declaredCostUnits: request.declaredCostUnits,
          declaredLatencyS: request.declaredLatencyS,
          productionMode: request.productionMode,
          submittedAt: request.submittedAt,
        },
        styleRef,
        exportRef,
        request.budget.breakerClass,
        fidelity,
      );
    }
  }
  return payloads;
}

/** Deterministic digest over the intended payload map under the requested class (golden fixture objective). */
export function intendedPayloadDigestFor(entry: NeutralProviderMatrixEntry, request: EcosystemRequestContext): string {
  return aggregateEcosystemDigest(intendedPayloadMapFor(entry, request), request.budget.breakerClass);
}

export interface EcosystemFidelityParts {
  /** Fraction of requested (style × export) pairs served by the adapter. */
  readonly fulfillmentCoverage: number;
  /**
   * Fraction of served payload content recovered exactly (thirds:
   * fidelity value match, breaker-class match, export-class match —
   * matched against the intended model under the REQUESTED class).
   */
  readonly payloadFaithfulness: number;
  /** Fraction of the output's structural record laws held (identity threading, digest binding, honest markers). */
  readonly recordIntegrity: number;
  readonly fidelityScore: number;
}

/**
 * Score an ecosystem fulfillment: compare the adapter's payload map
 * against the intended model over the resolved matrix row (the canonical
 * seeded (style × export) surface under the requested breaker class), and
 * verify the output's structural laws (request/entry identity threading,
 * content-addressing digest binding, simulated marker).
 */
export function scoreEcosystemFulfillment(
  matrix: ProviderMatrixRegistry,
  request: EcosystemRequestContext,
  output: NeutralEcosystemOutput,
): EcosystemFidelityParts {
  const entry = matrix.resolve(request.providerKind, request.region);
  // Fulfillment coverage: fraction of requested (style × export) pairs
  // served (a styles-only request counts one "no-export" pair per style —
  // the uniform surface; serving pairs that were never requested voids
  // coverage — an adapter never mints unrequested fulfillments).
  const effectiveRequestExportRefs = request.exportRefs.length > 0 ? request.exportRefs : [""];
  const requestedPairCount = request.styleRefs.length * effectiveRequestExportRefs.length;
  const servedPairCount = Object.keys(output.payloads).length;
  const fulfillmentCoverage = requestedPairCount === 0
    ? (servedPairCount === 0 ? 1 : 0)
    : Math.min(servedPairCount, requestedPairCount) / requestedPairCount;

  // Payload faithfulness: thirds over fidelity match, breaker-class match
  // and export-class match PER REQUESTED PAIR against the intended model
  // under the REQUESTED class (a misderiving adapter answers under a
  // different class and loses fidelity credit — visible, never
  // rewritten; a request asking for nothing is trivially faithful).
  let faithfulness: number;
  if (requestedPairCount === 0) {
    faithfulness = servedPairCount === 0 ? 1 : 0;
  } else {
    const intended = intendedPayloadMapFor(entry ?? {
      id: output.matrixEntryId,
      providerKind: request.providerKind,
      region: request.region,
      capabilityClasses: [],
      eligible: true,
      simulated: true,
    }, request);
    let credit = 0;
    for (const [key, payload] of Object.entries(output.payloads)) {
      const intendedPayload = intended[key];
      if (!intendedPayload) continue;
      if (Number(payload.fidelity) === Number(intendedPayload.fidelity)) credit += 1 / 3;
      if (String(payload.breakerClass) === request.budget.breakerClass) credit += 1 / 3;
      if (String(payload.export) === String(intendedPayload.export)) credit += 1 / 3;
    }
    faithfulness = credit / requestedPairCount;
  }

  // Record integrity: identity threading (request + matrix row), digest
  // binding, simulated marker, and budget-decision identity threading.
  const identityOk =
    output.requestId === request.requestId &&
    output.matrixEntryId === (entry ? entry.id : output.matrixEntryId) &&
    output.simulated === true &&
    output.budgetDecision.requestId === request.requestId &&
    output.budgetDecision.allowed === true;
  const hashBinds = output.resultContentHash === aggregateEcosystemDigest(output.payloads, declaredClassOf(output));
  const recordIntegrity = identityOk && hashBinds ? 1 : 0;

  return {
    fulfillmentCoverage: roundTo(fulfillmentCoverage, 4),
    payloadFaithfulness: roundTo(faithfulness, 4),
    recordIntegrity: roundTo(recordIntegrity, 4),
    fidelityScore: roundTo(
      ECOSYSTEM_FIDELITY_WEIGHTS.fulfillmentCoverage * fulfillmentCoverage +
        ECOSYSTEM_FIDELITY_WEIGHTS.payloadFaithfulness * faithfulness +
        ECOSYSTEM_FIDELITY_WEIGHTS.recordIntegrity * recordIntegrity,
      4,
    ),
  };
}

/**
 * The breaker class an output's payloads declare they ran under (the
 * envelope binds the payload's own declared class — a misderivation stays
 * visible and never breaks the hash binding; the W7C misroute / W8C
 * misbackoff precedent; an empty map has no declared class — the
 * class-less empty envelope the digest derives identically either way).
 */
function declaredClassOf(output: NeutralEcosystemOutput): NeutralArenaBackoffClass {
  const firstKey = Object.keys(output.payloads).sort()[0];
  if (firstKey === undefined) return "token-bucket";
  return String(output.payloads[firstKey]!.breakerClass ?? "token-bucket") as NeutralArenaBackoffClass;
}
