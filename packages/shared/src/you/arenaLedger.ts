// YOU arena-plane ledger replay (W8A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The arena application service appends the v1 escalation events
// (capability-gap-detected / arena-escalation-requested /
// arena-result-applied) and the wave-8 events (arena-run-recorded /
// escalation-authorized / escalation-cancelled /
// learning-permission-recorded / gap-projection-published) into the W1A
// SolutionEventLedger machinery. Payload conventions follow the
// W1A/W7A ride-along precedent ("related-record status facts ride
// along in event payloads because the frozen SolutionEventType set has
// no per-record status events"):
//
//   capability-gap-detected  { capabilityGapId, category, confidence,
//                              escalationEligibility, intentRef ("" when
//                              null), suggestedNextAction, strategyCount,
//                              strategy.<i>, strategyOutcome.<i>,
//                              failureEvidenceCount, failureEvidenceRef.<i>,
//                              simulated }
//   arena-run-recorded       { runId, gapId, strategy, attempt,
//                              statusBefore ("" at the initial record),
//                              statusAfter, startedAt, completedAt (""
//                              when null), outcomeEvidenceRef ("" when
//                              null), simulated }
//   arena-escalation-requested  { escalationId, capabilityGapId,
//                              escalationStatusBefore, escalationStatusAfter,
//                              authorizationId ("" when none), reason (""
//                              at plain request), providerId / resultType /
//                              contentRef / contentHash / deliveredAt (""
//                              unless a delivery), simulated }
//                              — the v1 status-carrier event: request,
//                              in-progress start and delivery all ride
//                              here (the v1 solutionEscalationFlow emitted
//                              it with escalationStatusAfter "delivered").
//   escalation-authorized    { authorizationId, escalationId,
//                              capabilityGapId, authorizedBy, scope,
//                              grantedAt, expiresAt ("" when null),
//                              learningPermission,
//                              authorizationStatusAfter: "active",
//                              escalationStatusAfter, simulated }
//   escalation-cancelled     { escalationId, capabilityGapId,
//                              authorizationId ("" when none),
//                              authorizationStatusAfter: "withdrawn" |
//                              "expired", escalationStatusAfter: reason,
//                              cancelledAt, simulated }
//   learning-permission-recorded { authorizationId, escalationId,
//                              learningPermission,
//                              supersededAuthorizationId ("" when none —
//                              non-empty marks a permission CHANGE whose
//                              new grant supersedes the referenced one),
//                              recordedAt, simulated }
//   arena-result-applied     { escalationId, capabilityGapId, changeSetId
//                              ("" on rejection), escalationStatusAfter:
//                              "applied" | "rejected", reason ("" on
//                              application), simulated }
//   gap-projection-published { projectionId, gapId, projectionKind:
//                              "tool-gap" | "knowledge-gap", simulated }
//                              plus the kind facts: toolId ("" when null),
//                              requiredCapability, remediation |
//                              domain, missingKnowledgeRef ("" when null),
//                              remediation.
//
// Authorization chains reconstruct from the event stream exactly like
// the W6A supersession fold: a new grant (escalation-authorized, or
// learning-permission-recorded with a non-empty
// supersededAuthorizationId) supersedes every earlier grant of the same
// escalation (status "superseded", supersededById pointing at the
// successor — append-only linkage, never an overwrite); an
// escalation-cancelled event re-projects the referenced grant as
// "withdrawn" or "expired". Lazy expiry is NOT folded (no `now` at
// replay): the enforcement predicate (escalationAuthorization.ts
// evaluateEscalationAuthorization) stays the authority for due grants.
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

/** Gap facts as reconstructable from ledger payloads (projection head). */
export interface ArenaLedgerGapEntry {
  readonly category: string;
  readonly confidence: number;
  readonly escalationEligibility: string;
  /** "" when the gap carries no intent reference. */
  readonly intentRef: string;
  readonly suggestedNextAction: string;
  readonly strategies: readonly { readonly strategy: string; readonly outcome: string }[];
  readonly failureEvidenceRefs: readonly string[];
  readonly simulated: boolean;
}

/** Run facts as reconstructable from ledger payloads (the run-ladder head). */
export interface ArenaLedgerRunEntry {
  readonly gapId: string;
  readonly strategy: string;
  readonly attempt: number;
  readonly status: string;
  readonly startedAt: string;
  /** "" when the run has no terminal timestamp yet. */
  readonly completedAt: string;
  /** "" when the run carries no outcome evidence ref. */
  readonly outcomeEvidenceRef: string;
  readonly simulated: boolean;
}

/** Escalation facts as reconstructable from ledger payloads (the v1 ladder head). */
export interface ArenaLedgerEscalationEntry {
  readonly gapId: string;
  readonly status: string;
  /** "" until a delivery lands. */
  readonly providerId: string;
  readonly resultType: string;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly deliveredAt: string;
  /** The authorization chain head id, "" when no grant exists. */
  readonly authorizationId: string;
  readonly simulated: boolean;
}

/** Authorization-chain entry as reconstructable from ledger payloads. */
export interface ArenaLedgerAuthorizationEntry {
  readonly escalationId: string;
  readonly authorizedBy: string;
  readonly scope: string;
  readonly grantedAt: string;
  /** "" when the grant carries no expiry. */
  readonly expiresAt: string;
  readonly learningPermission: string;
  /** active | superseded | expired | withdrawn (the projected chain status). */
  readonly status: string;
  readonly reason: string;
  readonly recordedAt: string;
  /** "" unless superseded — the successor authorization id. */
  readonly supersededById: string;
  readonly simulated: boolean;
}

/** The latest learning-permission recording per escalation. */
export interface ArenaLedgerPermissionEntry {
  readonly authorizationId: string;
  readonly learningPermission: string;
  readonly recordedAt: string;
}

/** Gap-projection facts as reconstructable from ledger payloads. */
export interface ArenaLedgerProjectionEntry {
  readonly gapId: string;
  readonly kind: string;
  /** tool-gap facts ("" when not a tool-gap projection). */
  readonly toolId: string;
  readonly requiredCapability: string;
  /** knowledge-gap facts ("" when not a knowledge-gap projection). */
  readonly domain: string;
  readonly missingKnowledgeRef: string;
  readonly remediation: string;
  readonly simulated: boolean;
}

export interface ArenaPlaneProjection {
  readonly solutionId: string;
  /** gapId -> authoritative gap facts. */
  readonly gaps: Readonly<Record<string, ArenaLedgerGapEntry>>;
  /** runId -> run-ladder head facts. */
  readonly runs: Readonly<Record<string, ArenaLedgerRunEntry>>;
  /** escalationId -> v1-ladder head facts. */
  readonly escalations: Readonly<Record<string, ArenaLedgerEscalationEntry>>;
  /** authorizationId -> projected chain entry facts. */
  readonly authorizations: Readonly<Record<string, ArenaLedgerAuthorizationEntry>>;
  /** escalationId -> the latest learning-permission recording. */
  readonly learningPermissions: Readonly<Record<string, ArenaLedgerPermissionEntry>>;
  /** projectionId -> published gap-projection facts. */
  readonly projections: Readonly<Record<string, ArenaLedgerProjectionEntry>>;
}

/**
 * Folds arena-plane ledger events into the authoritative projection.
 * Same events => same projection (byte-identical under stableStringify).
 * Events referencing unknown records fold defensively (ignored),
 * mirroring the W1A/W3A/W7A total-fold precedent.
 */
export function replayArenaLedger(events: readonly SolutionEvent[]): ArenaPlaneProjection {
  if (events.length === 0) {
    throw new Error("replayArenaLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const gaps: Record<string, ArenaLedgerGapEntry> = {};
  const runs: Record<string, ArenaLedgerRunEntry> = {};
  const escalations: Record<string, ArenaLedgerEscalationEntry> = {};
  const authorizations: Record<string, ArenaLedgerAuthorizationEntry> = {};
  const learningPermissions: Record<string, ArenaLedgerPermissionEntry> = {};
  const projections: Record<string, ArenaLedgerProjectionEntry> = {};
  /** escalationId -> ordered grant ids (the chain). */
  const chains = new Map<string, string[]>();

  const ensureEscalation = (escalationId: string, gapId: string): void => {
    if (escalations[escalationId] === undefined) {
      escalations[escalationId] = {
        gapId,
        status: "requested",
        providerId: "",
        resultType: "",
        contentRef: "",
        contentHash: "",
        deliveredAt: "",
        authorizationId: "",
        simulated: true,
      };
    }
  };

  const registerGrant = (escalationId: string, authorizationId: string): void => {
    const chain = chains.get(escalationId) ?? [];
    for (const previousId of chain) {
      const previous = authorizations[previousId];
      if (previous !== undefined && previous.status === "active") {
        authorizations[previousId] = { ...previous, status: "superseded", reason: "superseded-by-successor", supersededById: authorizationId };
      }
    }
    chain.push(authorizationId);
    chains.set(escalationId, chain);
    const escalation = escalations[escalationId];
    if (escalation !== undefined) {
      escalations[escalationId] = { ...escalation, authorizationId };
    }
  };

  for (const event of events) {
    switch (event.type) {
      case "capability-gap-detected": {
        const gapId = textPayload(event, "capabilityGapId");
        if (gapId === undefined) {
          break;
        }
        const strategyCount = numberPayload(event, "strategyCount") ?? 0;
        const strategies: { strategy: string; outcome: string }[] = [];
        for (let index = 0; index < strategyCount; index += 1) {
          const strategy = textPayload(event, `strategy.${index}`);
          const outcome = textPayload(event, `strategyOutcome.${index}`);
          if (strategy !== undefined) {
            strategies.push({ strategy, outcome: outcome ?? "" });
          }
        }
        gaps[gapId] = {
          category: textPayload(event, "category") ?? "",
          confidence: numberPayload(event, "confidence") ?? 0,
          escalationEligibility: textPayload(event, "escalationEligibility") ?? "not-eligible",
          intentRef: textPayload(event, "intentRef") ?? "",
          suggestedNextAction: textPayload(event, "suggestedNextAction") ?? "",
          strategies: Object.freeze(strategies),
          failureEvidenceRefs: Object.freeze(indexedTexts(event, "failureEvidenceCount", "failureEvidenceRef")),
          simulated: booleanPayload(event, "simulated"),
        };
        break;
      }
      case "arena-run-recorded": {
        const runId = textPayload(event, "runId");
        if (runId === undefined) {
          break;
        }
        runs[runId] = {
          gapId: textPayload(event, "gapId") ?? "",
          strategy: textPayload(event, "strategy") ?? "",
          attempt: numberPayload(event, "attempt") ?? 0,
          status: textPayload(event, "statusAfter") ?? "started",
          startedAt: textPayload(event, "startedAt") ?? "",
          completedAt: textPayload(event, "completedAt") ?? "",
          outcomeEvidenceRef: textPayload(event, "outcomeEvidenceRef") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        break;
      }
      case "arena-escalation-requested": {
        const escalationId = textPayload(event, "escalationId");
        if (escalationId === undefined) {
          break;
        }
        const gapId = textPayload(event, "capabilityGapId") ?? "";
        ensureEscalation(escalationId, gapId);
        const current = escalations[escalationId];
        if (current === undefined) {
          break;
        }
        // "" means "not carried" — the head's authorization id persists.
        const authorizationIdText = textPayload(event, "authorizationId");
        const authorizationId =
          authorizationIdText !== undefined && authorizationIdText !== "" ? authorizationIdText : current.authorizationId;
        const providerId = textPayload(event, "providerId") ?? "";
        // The gap's escalation eligibility walks to "escalated" at request
        // (the W1A fold precedent); delivery/terminal facts ride elsewhere.
        const gapEntry = gaps[gapId];
        if (gapEntry !== undefined && gapEntry.escalationEligibility === "eligible") {
          gaps[gapId] = { ...gapEntry, escalationEligibility: "escalated" };
        }
        escalations[escalationId] = {
          ...current,
          gapId: current.gapId !== "" ? current.gapId : gapId,
          status: textPayload(event, "escalationStatusAfter") ?? current.status,
          authorizationId,
          ...(providerId === ""
            ? {}
            : {
                providerId,
                resultType: textPayload(event, "resultType") ?? "",
                contentRef: textPayload(event, "contentRef") ?? "",
                contentHash: textPayload(event, "contentHash") ?? "",
                deliveredAt: textPayload(event, "deliveredAt") ?? "",
              }),
        };
        break;
      }
      case "escalation-authorized": {
        const authorizationId = textPayload(event, "authorizationId");
        const escalationId = textPayload(event, "escalationId");
        if (authorizationId === undefined || escalationId === undefined) {
          break;
        }
        const gapId = textPayload(event, "capabilityGapId") ?? "";
        ensureEscalation(escalationId, gapId);
        authorizations[authorizationId] = {
          escalationId,
          authorizedBy: textPayload(event, "authorizedBy") ?? "",
          scope: textPayload(event, "scope") ?? "",
          grantedAt: textPayload(event, "grantedAt") ?? "",
          expiresAt: textPayload(event, "expiresAt") ?? "",
          learningPermission: textPayload(event, "learningPermission") ?? "none",
          status: "active",
          reason: "",
          recordedAt: textPayload(event, "grantedAt") ?? event.occurredAt,
          supersededById: "",
          simulated: booleanPayload(event, "simulated"),
        };
        registerGrant(escalationId, authorizationId);
        const escalation = escalations[escalationId];
        const statusAfter = textPayload(event, "escalationStatusAfter");
        if (escalation !== undefined && statusAfter !== undefined && statusAfter !== "") {
          escalations[escalationId] = { ...escalation, status: statusAfter };
        }
        break;
      }
      case "escalation-cancelled": {
        const escalationId = textPayload(event, "escalationId");
        if (escalationId === undefined) {
          break;
        }
        ensureEscalation(escalationId, textPayload(event, "capabilityGapId") ?? "");
        const authorizationId = textPayload(event, "authorizationId") ?? "";
        if (authorizationId !== "") {
          const entry = authorizations[authorizationId];
          if (entry !== undefined) {
            authorizations[authorizationId] = {
              ...entry,
              status: textPayload(event, "authorizationStatusAfter") ?? "withdrawn",
              reason: textPayload(event, "reason") ?? "",
              recordedAt: textPayload(event, "cancelledAt") ?? event.occurredAt,
            };
          }
        }
        const escalation = escalations[escalationId];
        if (escalation !== undefined) {
          const statusAfter = textPayload(event, "escalationStatusAfter") ?? "cancelled";
          escalations[escalationId] = { ...escalation, status: statusAfter };
        }
        break;
      }
      case "learning-permission-recorded": {
        const authorizationId = textPayload(event, "authorizationId");
        const escalationId = textPayload(event, "escalationId");
        if (authorizationId === undefined || escalationId === undefined) {
          break;
        }
        const supersededAuthorizationId = textPayload(event, "supersededAuthorizationId") ?? "";
        if (supersededAuthorizationId !== "" && authorizations[authorizationId] === undefined) {
          // A permission change registers its new grant (the successor).
          const previous = authorizations[supersededAuthorizationId];
          authorizations[authorizationId] = {
            escalationId,
            authorizedBy: previous?.authorizedBy ?? "",
            scope: previous?.scope ?? "",
            grantedAt: textPayload(event, "recordedAt") ?? event.occurredAt,
            expiresAt: previous?.expiresAt ?? "",
            learningPermission: textPayload(event, "learningPermission") ?? "none",
            status: "active",
            reason: "",
            recordedAt: textPayload(event, "recordedAt") ?? event.occurredAt,
            supersededById: "",
            simulated: booleanPayload(event, "simulated"),
          };
          registerGrant(escalationId, authorizationId);
        }
        learningPermissions[escalationId] = {
          authorizationId,
          learningPermission: textPayload(event, "learningPermission") ?? "none",
          recordedAt: textPayload(event, "recordedAt") ?? event.occurredAt,
        };
        break;
      }
      case "arena-result-applied": {
        const escalationId = textPayload(event, "escalationId");
        if (escalationId === undefined) {
          break;
        }
        ensureEscalation(escalationId, textPayload(event, "capabilityGapId") ?? "");
        const escalation = escalations[escalationId];
        if (escalation !== undefined) {
          escalations[escalationId] = {
            ...escalation,
            status: textPayload(event, "escalationStatusAfter") ?? "applied",
          };
        }
        break;
      }
      case "gap-projection-published": {
        const projectionId = textPayload(event, "projectionId");
        if (projectionId === undefined) {
          break;
        }
        const kind = textPayload(event, "projectionKind") ?? "";
        projections[projectionId] = {
          gapId: textPayload(event, "gapId") ?? "",
          kind,
          toolId: textPayload(event, "toolId") ?? "",
          requiredCapability: textPayload(event, "requiredCapability") ?? "",
          domain: textPayload(event, "domain") ?? "",
          missingKnowledgeRef: textPayload(event, "missingKnowledgeRef") ?? "",
          remediation: textPayload(event, "remediation") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        break;
      }
      default:
        break;
    }
  }

  return {
    solutionId,
    gaps,
    runs,
    escalations,
    authorizations,
    learningPermissions,
    projections,
  };
}
