// YOU lab-plane ledger replay (W9A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The lab application service appends the wave-9 events
// (lab-run-recorded / lab-evidence-published / lab-promotion-decided)
// into the W1A SolutionEventLedger machinery. Payload conventions
// follow the W1A/W7A/W8A ride-along precedent ("related-record status
// facts ride along in event payloads because the frozen
// SolutionEventType set has no per-record status events"):
//
//   lab-run-recorded       { runId, experimentId, arm, planHash,
//                            statusBefore ("" at the initial record),
//                            statusAfter, submittedAt, completedAt (""
//                            when null), evidenceManifestRef ("" when
//                            null), simulated }
//                            plus the EXPERIMENT DECLARATION FACTS
//                            ride-along (the frozen wave-9 event set has
//                            no experiment-declaration event — the W6A
//                            service-state precedent): every run event
//                            carries experimentIntentRef /
//                            experimentConstraintsHash /
//                            experimentObjective / experimentArmCount /
//                            experimentArm.<i>; experiments materialize
//                            in the ledger through their runs, like
//                            arena providers materialize through
//                            delivery facts.
//   lab-evidence-published { manifestId, runId, contentHash,
//                            artifactCount, artifactRef.<i>,
//                            artifactHash.<i>, publishedAt, simulated }
//   lab-promotion-decided  { promotionId, experimentId, decisionKind:
//                            "promote" | "reverse", winnerArm,
//                            objectiveScore, baselineScore,
//                            evidenceManifestRef, supersedesPromotionId
//                            ("" when none — non-empty marks the
//                            superseded head), experimentPromotionRefBefore
//                            ("" when null), experimentPromotionRefAfter,
//                            decidedAt, simulated }
//
// The fold reconstructs: the experiment heads (declaration facts +
// the promotion head linkage moved by lab-promotion-decided), the run
// heads (statusAfter is authoritative; lab-evidence-published moves
// the run's evidenceManifestRef), the manifests, the promotion records
// and the append-only per-experiment decision chains. Deterministic:
// same events => same projection (compare through stableStringify).
// Events referencing unknown records fold defensively (ignored),
// mirroring the W1A/W3A/W7A/W8A total-fold precedent.

import type { SolutionEvent } from "./contract.js";

function textPayload(event: SolutionEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function numberPayload(event: SolutionEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

function booleanPayload(event: SolutionEvent, key: string): boolean {
  const value = event.payload[key];
  return typeof value === "boolean" ? value : true;
}

function indexedTexts(event: SolutionEvent, countKey: string, prefix: string): string[] {
  const count = numberPayload(event, countKey) ?? 0;
  const values: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = textPayload(event, `${prefix}.${index}`);
    if (value !== undefined) {
      values.push(value);
    }
  }
  return values;
}

/** Experiment facts as reconstructable from ledger payloads (the head). */
export interface LabLedgerExperimentEntry {
  readonly intentRef: string;
  readonly constraintsHash: string;
  readonly objective: string;
  readonly arms: readonly string[];
  /** "" until a promotion decision lands (the head linkage). */
  readonly promotionRef: string;
  readonly simulated: boolean;
}

/** Run facts as reconstructable from ledger payloads (the ladder head). */
export interface LabLedgerRunEntry {
  readonly experimentId: string;
  readonly arm: string;
  readonly planHash: string;
  readonly status: string;
  readonly submittedAt: string;
  /** "" when the run has no terminal timestamp yet. */
  readonly completedAt: string;
  /** "" when the run carries no evidence manifest ref. */
  readonly evidenceManifestRef: string;
  readonly simulated: boolean;
}

/** Manifest facts as reconstructable from ledger payloads. */
export interface LabLedgerManifestEntry {
  readonly runId: string;
  readonly contentHash: string;
  readonly artifactRefs: readonly string[];
  readonly artifactHashes: readonly string[];
  readonly publishedAt: string;
  readonly simulated: boolean;
}

/** Promotion facts as reconstructable from ledger payloads. */
export interface LabLedgerPromotionEntry {
  readonly experimentId: string;
  readonly decisionKind: string;
  readonly winnerArm: string;
  readonly objectiveScore: number;
  readonly baselineScore: number;
  readonly evidenceManifestRef: string;
  /** "" when the decision opened the chain (no superseded head). */
  readonly supersedesPromotionId: string;
  readonly decidedAt: string;
  readonly simulated: boolean;
}

export interface LabPlaneProjection {
  readonly solutionId: string;
  /** experimentId -> authoritative experiment head facts. */
  readonly experiments: Readonly<Record<string, LabLedgerExperimentEntry>>;
  /** runId -> run-ladder head facts. */
  readonly runs: Readonly<Record<string, LabLedgerRunEntry>>;
  /** manifestId -> evidence manifest facts. */
  readonly manifests: Readonly<Record<string, LabLedgerManifestEntry>>;
  /** promotionId -> promotion decision facts. */
  readonly promotions: Readonly<Record<string, LabLedgerPromotionEntry>>;
  /** experimentId -> ordered promotion decision ids (append-only chains). */
  readonly promotionChains: Readonly<Record<string, readonly string[]>>;
}

/**
 * Folds lab-plane ledger events into the authoritative projection.
 * Same events => same projection (byte-identical under stableStringify).
 */
export function replayLabLedger(events: readonly SolutionEvent[]): LabPlaneProjection {
  if (events.length === 0) {
    throw new Error("replayLabLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const experiments: Record<string, LabLedgerExperimentEntry> = {};
  const runs: Record<string, LabLedgerRunEntry> = {};
  const manifests: Record<string, LabLedgerManifestEntry> = {};
  const promotions: Record<string, LabLedgerPromotionEntry> = {};
  const promotionChains: Record<string, string[]> = {};

  for (const event of events) {
    switch (event.type) {
      case "lab-run-recorded": {
        const runId = textPayload(event, "runId");
        if (runId === undefined) {
          break;
        }
        const experimentId = textPayload(event, "experimentId") ?? "";
        // The declaration facts ride along (immutable; re-recorded
        // idempotently — the promotion linkage is never clobbered).
        if (experimentId !== "") {
          experiments[experimentId] = {
            intentRef: textPayload(event, "experimentIntentRef") ?? experiments[experimentId]?.intentRef ?? "",
            constraintsHash:
              textPayload(event, "experimentConstraintsHash") ?? experiments[experimentId]?.constraintsHash ?? "",
            objective: textPayload(event, "experimentObjective") ?? experiments[experimentId]?.objective ?? "",
            arms: Object.freeze(indexedTexts(event, "experimentArmCount", "experimentArm")),
            promotionRef: experiments[experimentId]?.promotionRef ?? "",
            simulated: booleanPayload(event, "simulated"),
          };
        }
        runs[runId] = {
          experimentId,
          arm: textPayload(event, "arm") ?? "",
          planHash: textPayload(event, "planHash") ?? "",
          status: textPayload(event, "statusAfter") ?? "submitted",
          submittedAt: textPayload(event, "submittedAt") ?? "",
          completedAt: textPayload(event, "completedAt") ?? "",
          evidenceManifestRef: textPayload(event, "evidenceManifestRef") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        break;
      }
      case "lab-evidence-published": {
        const manifestId = textPayload(event, "manifestId");
        if (manifestId === undefined) {
          break;
        }
        const runId = textPayload(event, "runId") ?? "";
        const artifactRefs = indexedTexts(event, "artifactCount", "artifactRef");
        const artifactHashes = indexedTexts(event, "artifactCount", "artifactHash");
        manifests[manifestId] = {
          runId,
          contentHash: textPayload(event, "contentHash") ?? "",
          artifactRefs: Object.freeze(artifactRefs),
          artifactHashes: Object.freeze(artifactHashes),
          publishedAt: textPayload(event, "publishedAt") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        // The manifest publication moves the run head's evidence ref.
        const run = runs[runId];
        if (run !== undefined) {
          runs[runId] = { ...run, evidenceManifestRef: manifestId };
        }
        break;
      }
      case "lab-promotion-decided": {
        const promotionId = textPayload(event, "promotionId");
        const experimentId = textPayload(event, "experimentId");
        if (promotionId === undefined || experimentId === undefined) {
          break;
        }
        promotions[promotionId] = {
          experimentId,
          decisionKind: textPayload(event, "decisionKind") ?? "promote",
          winnerArm: textPayload(event, "winnerArm") ?? "",
          objectiveScore: numberPayload(event, "objectiveScore") ?? 0,
          baselineScore: numberPayload(event, "baselineScore") ?? 0,
          evidenceManifestRef: textPayload(event, "evidenceManifestRef") ?? "",
          supersedesPromotionId: textPayload(event, "supersedesPromotionId") ?? "",
          decidedAt: textPayload(event, "decidedAt") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        const chain = promotionChains[experimentId] ?? [];
        chain.push(promotionId);
        promotionChains[experimentId] = chain;
        const experiment = experiments[experimentId];
        if (experiment !== undefined) {
          experiments[experimentId] = {
            ...experiment,
            promotionRef: textPayload(event, "experimentPromotionRefAfter") ?? experiment.promotionRef,
          };
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    solutionId,
    experiments,
    runs,
    manifests,
    promotions,
    promotionChains,
  };
}
