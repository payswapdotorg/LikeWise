// YOU lab-plane ledger replay (W9A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The lab application service appends the wave-9 events
// (lab-run-recorded / lab-evidence-published / lab-promotion-decided)
// into the W1A SolutionEventLedger machinery. Payload conventions
// follow the W1A/W8A ride-along precedent ("related-record status
// facts ride along in event payloads because the frozen
// SolutionEventType set has no per-record status events"):
//
//   lab-run-recorded        { runId, experimentId, arm, planHash,
//                              statusBefore ("" at the initial record),
//                              statusAfter, submittedAt, completedAt (""
//                              when null), evidenceManifestRef ("" when
//                              null), simulated }
//   lab-evidence-published  { manifestId, runId, experimentId,
//                              contentHash, artifactCount,
//                              artifactRef.<i>, publishedAt, simulated }
//   lab-promotion-decided   { promotionId, experimentId, winnerArm,
//                              objectiveScore, baselineScore,
//                              evidenceManifestRef, decidedAt,
//                              reversalOfPromotionId ("" when none),
//                              simulated }
//
// Fold rules (the W8A total-fold precedent):
//   - run heads: the LAST lab-run-recorded event per runId wins (the
//     immutable-replacement projection);
//   - evidence linkage: a lab-evidence-published event walks the
//     referenced run head's evidenceManifestRef (the W1A ride-along
//     fold — the run record itself is never re-emitted);
//   - promotion heads: every lab-promotion-decided appends into the
//     promotions map; promotionHeads[experimentId] walks to the newest
//     promotion id (the append-only decision ledger; reversals are new
//     records whose winnerArm is the generalist baseline).
//
// LabExperiment records are SERVICE STATE on the W9A service (the W8A
// retry-policy/provider precedent — the frozen v9 event set has no
// experiment event) and therefore do not appear in this projection;
// their facts are readable through the service seam.
//
// Deterministic: same events => same projection (compare through
// stableStringify).

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
  readonly experimentId: string;
  readonly contentHash: string;
  readonly artifactRefs: readonly string[];
  readonly publishedAt: string;
  readonly simulated: boolean;
}

/** Promotion facts as reconstructable from ledger payloads. */
export interface LabLedgerPromotionEntry {
  readonly experimentId: string;
  readonly winnerArm: string;
  readonly objectiveScore: number;
  readonly baselineScore: number;
  readonly evidenceManifestRef: string;
  readonly decidedAt: string;
  /** "" unless this record reverses an earlier promotion. */
  readonly reversalOfPromotionId: string;
  readonly simulated: boolean;
}

export interface LabPlaneProjection {
  readonly solutionId: string;
  /** runId -> run-ladder head facts. */
  readonly runs: Readonly<Record<string, LabLedgerRunEntry>>;
  /** manifestId -> published evidence-manifest facts. */
  readonly manifests: Readonly<Record<string, LabLedgerManifestEntry>>;
  /** promotionId -> promotion/reversal record facts. */
  readonly promotions: Readonly<Record<string, LabLedgerPromotionEntry>>;
  /** experimentId -> the head promotion record id (the decision-ledger head). */
  readonly promotionHeads: Readonly<Record<string, string>>;
}

/**
 * Folds lab-plane ledger events into the authoritative projection.
 * Same events => same projection (byte-identical under stableStringify).
 * Events referencing unknown records fold defensively (ignored),
 * mirroring the W1A/W3A/W7A/W8A total-fold precedent.
 */
export function replayLabLedger(events: readonly SolutionEvent[]): LabPlaneProjection {
  if (events.length === 0) {
    throw new Error("replayLabLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const runs: Record<string, LabLedgerRunEntry> = {};
  const manifests: Record<string, LabLedgerManifestEntry> = {};
  const promotions: Record<string, LabLedgerPromotionEntry> = {};
  const promotionHeads: Record<string, string> = {};

  for (const event of events) {
    switch (event.type) {
      case "lab-run-recorded": {
        const runId = textPayload(event, "runId");
        if (runId === undefined) {
          break;
        }
        runs[runId] = {
          experimentId: textPayload(event, "experimentId") ?? "",
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
        const artifactCount = numberPayload(event, "artifactCount") ?? 0;
        const artifactRefs: string[] = [];
        for (let index = 0; index < artifactCount; index += 1) {
          const ref = textPayload(event, `artifactRef.${index}`);
          if (ref !== undefined) {
            artifactRefs.push(ref);
          }
        }
        const runId = textPayload(event, "runId") ?? "";
        manifests[manifestId] = {
          runId,
          experimentId: textPayload(event, "experimentId") ?? "",
          contentHash: textPayload(event, "contentHash") ?? "",
          artifactRefs: Object.freeze(artifactRefs),
          publishedAt: textPayload(event, "publishedAt") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        // The evidence linkage walks the run head (the W1A ride-along
        // fold — the run record is replaced immutably at write time).
        const runEntry = runs[runId];
        if (runEntry !== undefined) {
          runs[runId] = { ...runEntry, evidenceManifestRef: manifestId };
        }
        break;
      }
      case "lab-promotion-decided": {
        const promotionId = textPayload(event, "promotionId");
        if (promotionId === undefined) {
          break;
        }
        const experimentId = textPayload(event, "experimentId") ?? "";
        promotions[promotionId] = {
          experimentId,
          winnerArm: textPayload(event, "winnerArm") ?? "",
          objectiveScore: numberPayload(event, "objectiveScore") ?? 0,
          baselineScore: numberPayload(event, "baselineScore") ?? 0,
          evidenceManifestRef: textPayload(event, "evidenceManifestRef") ?? "",
          decidedAt: textPayload(event, "decidedAt") ?? "",
          reversalOfPromotionId: textPayload(event, "reversalOfPromotionId") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        promotionHeads[experimentId] = promotionId;
        break;
      }
      default:
        break;
    }
  }

  return {
    solutionId,
    runs,
    manifests,
    promotions,
    promotionHeads,
  };
}
