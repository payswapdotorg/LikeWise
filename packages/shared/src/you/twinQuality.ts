// YOU deterministic twin quality projection (W3A — docs/you/CONTRACTS.md
// "Twin quality is a deterministic projection onto a TwinVersion:
// domain-keyed scores plus typed deficiencies with remediation hints. A
// deficiency may reference a targeted EvidenceRequest (the wave-2 capture
// machinery) — quality improvement flows through evidence capture, never
// through silent mutation").
//
// Fixture quality model (frozen fixture definition, v1):
//   - domainScores: for every domain with at least one block, the score is
//     roundQualityScore(min(block confidences)) — the weakest block governs
//     the domain, deterministic and order-independent.
//   - deficiencies (emitted sorted by id; ids from the injected factory):
//       1. "coverage-gap" (severity 1) for every required domain with no
//          block. Required fixture domains: identity-binding, morphology,
//          geometry-skeleton.
//       2. one low-score deficiency per mapped domain whose score is below
//          FIXTURE_TWIN_DEFICIENCY_THRESHOLD, severity = 1 - score, class
//          from the frozen domain -> class table (geometric-error /
//          appearance-error / articulation-error). Unmapped domains
//          (identity-binding, voice, extensions) contribute scores but no
//          invented deficiency class — no class is fabricated for them.
//       3. "provenance-missing" (severity 1) when a version carries no
//          evidence bindings (no provenance trail into the evidence plane).
//   - remediationEvidenceRequestId is populated from the service's
//     remediation registry (keyed by deficiency class + domain); requests
//     are created through the wave-2 capture machinery, never by mutation.

import type {
  EvidenceRequest,
  HtirDomainBlock,
  HtirDomainKind,
  OpaqueId,
  TwinDeficiency,
  TwinDeficiencyClass,
  TwinEvidenceBinding,
  TwinQualityState,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { roundQualityScore } from "./quality.js";
import { deepFreeze } from "./serialize.js";

/** Fixture-required twin domains (frozen fixture definition). */
export const FIXTURE_TWIN_REQUIRED_DOMAINS: readonly HtirDomainKind[] = [
  "identity-binding",
  "morphology",
  "geometry-skeleton",
];

/** Score below which a mapped domain is deficient (fixture definition). */
export const FIXTURE_TWIN_DEFICIENCY_THRESHOLD = 0.75;

/**
 * Frozen domain -> low-score deficiency class table (fixture definition).
 * Domains absent from this table never get a fabricated class.
 */
export const FIXTURE_TWIN_DOMAIN_DEFICIENCY_CLASSES: Readonly<Record<string, TwinDeficiencyClass>> = {
  "appearance-materials": "appearance-error",
  "articulation-blendshapes": "articulation-error",
  "face-hands": "geometric-error",
  "geometry-skeleton": "geometric-error",
  hair: "appearance-error",
  morphology: "geometric-error",
  "motion-profile": "articulation-error",
  "neural-appearance": "appearance-error",
  style: "appearance-error",
};

/** Stable remediation-registry key for one deficiency facet. */
export function twinDeficiencyKey(deficiencyClass: TwinDeficiencyClass, domain: HtirDomainKind): string {
  return `${deficiencyClass}:${domain}`;
}

export interface TwinQualityRemediationLookup {
  /** deficiencyKey (class:domain) -> targeted EvidenceRequest id, or null. */
  resolve(deficiencyClass: TwinDeficiencyClass, domain: HtirDomainKind): OpaqueId | null;
}

export interface TwinQualityDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

export interface AssessTwinQualityOptions {
  /** Remediation registry consulted to populate remediation links. */
  readonly remediation?: TwinQualityRemediationLookup;
}

/** Deterministic domain-keyed scores over a domain-block list. */
export function twinDomainScores(blocks: readonly HtirDomainBlock[]): Readonly<Record<string, number>> {
  const scores: Record<string, number> = {};
  const byDomain = new Map<HtirDomainKind, number>();
  for (const block of blocks) {
    const current = byDomain.get(block.domain);
    byDomain.set(block.domain, current === undefined ? block.confidence : Math.min(current, block.confidence));
  }
  for (const domain of [...byDomain.keys()].sort()) {
    const score = byDomain.get(domain);
    if (score !== undefined) {
      scores[domain] = roundQualityScore(score);
    }
  }
  return scores;
}

/**
 * Deterministic quality projection over a twin version's domain blocks
 * and evidence bindings (fixture model v1 — see the module header). The
 * same inputs always produce the same quality state on every platform.
 */
export function assessTwinQuality(
  input: {
    readonly domainBlocks: readonly HtirDomainBlock[];
    readonly evidenceBindings: readonly TwinEvidenceBinding[];
  },
  deps: TwinQualityDeps,
  options: AssessTwinQualityOptions = {},
): TwinQualityState {
  const remediation = options.remediation;
  const scores = twinDomainScores(input.domainBlocks);
  const domains = new Set(input.domainBlocks.map((block) => block.domain));
  const deficiencies: TwinDeficiency[] = [];

  const pushDeficiency = (
    deficiencyClass: TwinDeficiencyClass,
    domain: HtirDomainKind,
    severity: number,
    remediationHint: string | null,
  ): void => {
    deficiencies.push(
      deepFreeze({
        id: deps.ids.next("twin-deficiency"),
        deficiencyClass,
        domain,
        severity: roundQualityScore(severity),
        remediationHint,
        remediationEvidenceRequestId: remediation?.resolve(deficiencyClass, domain) ?? null,
      }),
    );
  };

  for (const domain of FIXTURE_TWIN_REQUIRED_DOMAINS) {
    if (!domains.has(domain)) {
      pushDeficiency(
        "coverage-gap",
        domain,
        1,
        `capture evidence targeting the "${domain}" domain and publish a new twin version`,
      );
    }
  }

  for (const domain of Object.keys(scores).sort()) {
    const score = scores[domain];
    if (score === undefined || score >= FIXTURE_TWIN_DEFICIENCY_THRESHOLD) {
      continue;
    }
    const deficiencyClass = FIXTURE_TWIN_DOMAIN_DEFICIENCY_CLASSES[domain];
    if (deficiencyClass === undefined) {
      continue;
    }
    pushDeficiency(
      deficiencyClass,
      domain,
      1 - score,
      `capture targeted evidence for the "${domain}" domain to lift the ${deficiencyClass} score above ${FIXTURE_TWIN_DEFICIENCY_THRESHOLD}`,
    );
  }

  if (input.evidenceBindings.length === 0) {
    pushDeficiency("provenance-missing", "identity-binding", 1, "bind evidence records when publishing the next twin version");
  }

  deficiencies.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return deepFreeze({
    domainScores: deepFreeze({ ...scores }),
    deficiencies: Object.freeze(deficiencies),
    assessedAt: deps.clock.now(),
  });
}

export interface RemediationEvidenceRequestInput {
  /** Overrides the default reason (the default records deficiency facts). */
  readonly reason?: string;
  readonly preferredFraming?: string | null;
  readonly privacyRequirements?: string;
  readonly retention?: string;
}

/**
 * Constructs the targeted EvidenceRequest that would remediate one twin
 * deficiency (W2 seam — the request flows through the wave-2 capture
// machinery; quality never improves by silent mutation).
 */
export function createRemediationEvidenceRequest(
  deficiency: TwinDeficiency,
  twinVersionId: OpaqueId,
  deps: TwinQualityDeps,
  input: RemediationEvidenceRequestInput = {},
): EvidenceRequest {
  const deficiencyKey = twinDeficiencyKey(deficiency.deficiencyClass, deficiency.domain);
  return deepFreeze({
    id: deps.ids.next("evidence-request"),
    targetDeficiency: deficiencyKey,
    evidenceType: "reference-image",
    preferredFraming: input.preferredFraming ?? `synthetic framing targeting the "${deficiency.domain}" domain`,
    reason:
      input.reason ??
      `remediate twin deficiency ${deficiency.id} (class ${deficiency.deficiencyClass}, domain ${deficiency.domain}, severity ${deficiency.severity}) on twin version ${twinVersionId}`,
    privacyRequirements: input.privacyRequirements ?? "fixture-only; no biometric data; consent enforced at binding time",
    retention: input.retention ?? "project-retention",
    status: "requested",
  });
}
