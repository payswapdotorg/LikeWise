// YOU Solution service — ledger-backed mutation helper.
//
// Every canonical mutation flows through proposeAndAccept: propose a
// ChangeSet (verification attached), append change-proposed, accept into
// a new immutable version (or append change-rejected), append
// change-accepted + version-published, and refresh the protocol runtime.
// This is the ONLY path from a mutation to canonical truth.

import type { AuthorType, OpaqueId, SolutionPatchOperation, SolutionSelector } from "@zcode/shared";
import type { ChangeSet, SolutionVersion } from "@zcode/shared";
import type { SolutionRecord } from "./solutionServiceTypes.js";
import { qualityPayload } from "./solutionServiceTypes.js";

export interface ProposeAndAcceptInput {
  readonly baseVersionId: OpaqueId;
  readonly operations: readonly SolutionPatchOperation[];
  readonly intentRef: OpaqueId | null;
  readonly authorType: AuthorType;
  readonly targetRef?: SolutionSelector | null;
  readonly evidenceRefs?: readonly OpaqueId[];
  readonly changePayload?: Record<string, string | number | boolean>;
  readonly acceptPayload?: Record<string, string | number | boolean>;
  readonly versionPayload?: Record<string, string | number | boolean>;
}

export type ProposeAndAcceptResult =
  | { readonly version: SolutionVersion; readonly changeSet: ChangeSet }
  | null;

/** Proposes, verifies, accepts and records one ChangeSet (or rejects it). */
export function proposeAndAccept(
  record: SolutionRecord,
  input: ProposeAndAcceptInput,
): ProposeAndAcceptResult {
  const changeSet = record.chain.propose({
    baseVersionId: input.baseVersionId,
    operations: input.operations,
    intentRef: input.intentRef,
    targetRef: input.targetRef ?? null,
    evidenceRefs: input.evidenceRefs,
    authorType: input.authorType,
  });
  record.changeSets.set(changeSet.id, changeSet);
  record.ledger.append({
    type: "change-proposed",
    subjectRef: changeSet.id,
    generator: input.authorType,
    payload: {
      changeSetId: changeSet.id,
      inputVersionId: changeSet.inputVersionId,
      authorType: changeSet.authorType,
      operationCount: changeSet.proposedOperations.length,
      ...input.changePayload,
    },
  });
  const accepted = record.chain.accept(changeSet);
  if (!accepted.ok) {
    record.ledger.append({
      type: "change-rejected",
      subjectRef: changeSet.id,
      generator: input.authorType,
      payload: { changeSetId: changeSet.id, reason: accepted.code },
    });
    const rejected = record.chain.reject(changeSet);
    record.changeSets.set(changeSet.id, rejected);
    return null;
  }
  record.changeSets.set(accepted.changeSet.id, accepted.changeSet);
  record.ledger.append({
    type: "change-accepted",
    subjectRef: accepted.changeSet.id,
    generator: input.authorType,
    payload: {
      changeSetId: accepted.changeSet.id,
      resultingVersionId: accepted.version.id,
      versionNumber: accepted.version.version,
      authorType: accepted.changeSet.authorType,
      ...input.acceptPayload,
    },
  });
  emitVersionPublished(record, accepted.version, input.versionPayload);
  record.runtime.handleHostMessage(
    record.runtime.buildHostMessage({ type: "load_version", versionId: accepted.version.id }),
  );
  return { version: accepted.version, changeSet: accepted.changeSet };
}

/** Appends the version-published event with the flattened quality map. */
export function emitVersionPublished(
  record: SolutionRecord,
  version: SolutionVersion,
  extra?: Record<string, string | number | boolean>,
): void {
  record.ledger.append({
    type: "version-published",
    subjectRef: version.id,
    generator: version.provenance.generator,
    payload: {
      versionId: version.id,
      versionNumber: version.version,
      parentVersionId: version.parentVersionId ?? "",
      authorType: version.provenance.generator,
      ...qualityPayload(version.state.quality),
      ...extra,
    },
  });
}

/** Sorted id -> status map for the live projection. */
export function statusMap<T>(store: Map<OpaqueId, T>, statusOf: (entry: T) => string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [id, entry] of [...store.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const status = statusOf(entry);
    if (status.length > 0) {
      result[id] = status;
    }
  }
  return result;
}

/** Escalation statuses keyed by escalation id (matches replayLedger). */
export function escalationStatusMap(record: SolutionRecord): Record<string, string> {
  const result: Record<string, string> = {};
  for (const gap of [...record.gaps.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const escalation = gap.arenaEscalationRef;
    if (escalation !== null) {
      result[escalation.escalationId] = escalation.status;
    }
  }
  return result;
}
