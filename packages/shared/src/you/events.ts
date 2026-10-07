// YOU append-only SolutionEvent ledger (docs/you/FIXTURES.md law 10).
//
// The ledger only appends. Replaying a persisted ledger reproduces the
// authoritative projection exactly: version chain, current version, the
// quality map of every published version, and the statuses of feedback,
// evidence, edit sessions, changesets, capability gaps and Arena
// escalations. Related-record status facts ride along in event payloads
// (e.g. change-accepted carries feedbackStatusAfter) because the frozen
// SolutionEventType set has no per-record status events.

import type { AuthorType, OpaqueId, SolutionEvent, SolutionEventType } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { deepFreeze, stableStringify } from "./serialize.js";

export interface EventDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

export interface SolutionEventInput {
  readonly type: SolutionEventType;
  readonly subjectRef?: OpaqueId | null;
  readonly payload?: Readonly<Record<string, string | number | boolean>>;
  readonly generator?: AuthorType;
}

/** Append-only event ledger for one Solution. */
export class SolutionEventLedger {
  private readonly entries: SolutionEvent[] = [];

  constructor(
    readonly solutionId: OpaqueId,
    private readonly deps: EventDeps,
  ) {}

  /** Appends one event. The ledger never rewrites or removes entries. */
  append(input: SolutionEventInput): SolutionEvent {
    const previous = this.entries[this.entries.length - 1];
    const lineage: OpaqueId[] = previous === undefined ? [] : [...previous.provenance.lineage, previous.id];
    const occurredAt = this.deps.clock.now();
    const event: SolutionEvent = deepFreeze({
      id: this.deps.ids.next("event"),
      solutionId: this.solutionId,
      type: input.type,
      occurredAt,
      subjectRef: input.subjectRef ?? null,
      payload: deepFreeze({ ...input.payload }),
      provenance: deepFreeze({
        source: "solution-event-ledger",
        generator: input.generator ?? "agent",
        createdAt: occurredAt,
        lineage: Object.freeze(lineage),
      }),
    });
    this.entries.push(event);
    return event;
  }

  /** Frozen copy of all entries, oldest first. */
  events(): readonly SolutionEvent[] {
    return Object.freeze([...this.entries]);
  }

  get size(): number {
    return this.entries.length;
  }

  /** Canonical JSON serialization (stable key order). */
  serialize(): string {
    return stableStringify(this.entries);
  }
}

/** Minimal shape validation for persisted ledger JSON. */
export function parseLedgerEvents(text: string): readonly SolutionEvent[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }
  const events: SolutionEvent[] = [];
  for (const entry of parsed) {
    if (entry === null || typeof entry !== "object") {
      return null;
    }
    const record = entry as Record<string, unknown>;
    const id = record.id;
    const solutionId = record.solutionId;
    const type = record.type;
    const occurredAt = record.occurredAt;
    if (typeof id !== "string" || typeof solutionId !== "string" || typeof type !== "string" || typeof occurredAt !== "string") {
      return null;
    }
    events.push(entry as SolutionEvent);
  }
  return events;
}

/** A version entry as reconstructable from ledger payloads. */
export interface LedgerVersionEntry {
  readonly versionId: string;
  readonly versionNumber: number;
  readonly parentVersionId: string;
  readonly authorType: string;
  readonly quality: Readonly<Record<string, number>>;
}

export interface SolutionLedgerProjection {
  readonly solutionId: string;
  readonly currentVersionId: string | null;
  readonly versions: readonly LedgerVersionEntry[];
  readonly feedback: Readonly<Record<string, string>>;
  readonly evidence: Readonly<Record<string, string>>;
  readonly editSessions: Readonly<Record<string, string>>;
  readonly changeSets: Readonly<Record<string, string>>;
  readonly capabilityGaps: Readonly<Record<string, string>>;
  readonly arenaEscalations: Readonly<Record<string, string>>;
}

function textPayload(event: SolutionEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function numberPayload(event: SolutionEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * Folds ledger events into the authoritative projection. Deterministic:
 * same events => same projection (maps keyed by id; compare through
 * stableStringify).
 */
export function replayLedger(events: readonly SolutionEvent[]): SolutionLedgerProjection {
  if (events.length === 0) {
    throw new Error("replayLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const versions: LedgerVersionEntry[] = [];
  let currentVersionId: string | null = null;
  const feedback: Record<string, string> = {};
  const evidence: Record<string, string> = {};
  const editSessions: Record<string, string> = {};
  const changeSets: Record<string, string> = {};
  const gaps: Record<string, string> = {};
  const escalations: Record<string, string> = {};

  for (const event of events) {
    switch (event.type) {
      case "version-published": {
        const quality: Record<string, number> = {};
        for (const [key, value] of Object.entries(event.payload)) {
          if (key.startsWith("quality.") && typeof value === "number") {
            quality[key.slice("quality.".length)] = value;
          }
        }
        versions.push({
          versionId: textPayload(event, "versionId") ?? "",
          versionNumber: numberPayload(event, "versionNumber") ?? versions.length + 1,
          parentVersionId: textPayload(event, "parentVersionId") ?? "",
          authorType: textPayload(event, "authorType") ?? "agent",
          quality,
        });
        const versionId = textPayload(event, "versionId");
        if (versionId !== undefined) {
          currentVersionId = versionId;
        }
        break;
      }
      case "feedback-submitted": {
        const id = textPayload(event, "feedbackRequestId");
        if (id !== undefined) {
          feedback[id] = "open";
        }
        break;
      }
      case "evidence-requested": {
        const id = textPayload(event, "evidenceRequestId");
        if (id !== undefined) {
          evidence[id] = "requested";
        }
        break;
      }
      case "evidence-provided": {
        const id = textPayload(event, "evidenceRequestId");
        if (id !== undefined) {
          evidence[id] = "provided";
        }
        break;
      }
      case "edit-session-opened": {
        const id = textPayload(event, "editSessionId");
        if (id !== undefined) {
          editSessions[id] = "open";
        }
        break;
      }
      case "edit-session-closed": {
        const id = textPayload(event, "editSessionId");
        if (id !== undefined) {
          editSessions[id] = "closed";
        }
        break;
      }
      case "change-proposed": {
        const id = textPayload(event, "changeSetId");
        if (id !== undefined) {
          changeSets[id] = "proposed";
        }
        break;
      }
      case "change-accepted": {
        const id = textPayload(event, "changeSetId");
        if (id !== undefined) {
          changeSets[id] = "accepted";
        }
        const feedbackId = textPayload(event, "addressesFeedbackId");
        const feedbackStatus = textPayload(event, "feedbackStatusAfter");
        if (feedbackId !== undefined && feedbackStatus !== undefined) {
          feedback[feedbackId] = feedbackStatus;
        }
        const evidenceId = textPayload(event, "addressesEvidenceId");
        const evidenceStatus = textPayload(event, "evidenceStatusAfter");
        if (evidenceId !== undefined && evidenceStatus !== undefined) {
          evidence[evidenceId] = evidenceStatus;
        }
        break;
      }
      case "change-rejected": {
        const id = textPayload(event, "changeSetId");
        if (id !== undefined) {
          changeSets[id] = "rejected";
        }
        break;
      }
      case "capability-gap-detected": {
        const id = textPayload(event, "capabilityGapId");
        if (id !== undefined) {
          gaps[id] = textPayload(event, "escalationEligibility") ?? "not-eligible";
        }
        break;
      }
      case "arena-escalation-requested": {
        const escalationId = textPayload(event, "escalationId");
        if (escalationId !== undefined) {
          escalations[escalationId] = textPayload(event, "escalationStatusAfter") ?? "requested";
        }
        const gapId = textPayload(event, "capabilityGapId");
        if (gapId !== undefined) {
          gaps[gapId] = "escalated";
        }
        break;
      }
      case "arena-result-applied": {
        const escalationId = textPayload(event, "escalationId");
        if (escalationId !== undefined) {
          escalations[escalationId] = "applied";
        }
        const gapId = textPayload(event, "capabilityGapId");
        if (gapId !== undefined) {
          gaps[gapId] = "applied";
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    solutionId,
    currentVersionId,
    versions,
    feedback,
    evidence,
    editSessions,
    changeSets,
    capabilityGaps: gaps,
    arenaEscalations: escalations,
  };
}
