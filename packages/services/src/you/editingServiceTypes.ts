// YOU editing application service — shared internal types and helpers.
//
// The application service (editingService.ts) is the single authority over
// editing/interchange truth (docs/you/CONTRACTS.md "State ownership":
// EditSession = the editing service, Worker A lane — the wave-5 namespaced
// EditingSession plane; the v1 EditSession solution-patch flow keeps its
// own authority untouched). The flow modules (editingSessionFlow.ts,
// editChangeSetFlow.ts, importExportFlow.ts) operate on the per-solution
// editing-plane records the service owns, mutating only through immutable
// record replacement + append-only ledger events (editingLedgerOps.ts).
//
// Editor kinds register behind the EditorCapabilityRegistry seam (the W5C
// adapter/research lane; the profile is researched data, never a runtime
// authority); the default registry is the frozen fixture support matrix.
// Interchange formats register through the frozen fixture engine support
// (shared/src/you/importExport.ts FIXTURE_INTERCHANGE_SUPPORT). The
// service never falls back to an unregistered editor kind or an
// unsupported format (typed YOU_EDITOR_UNSUPPORTED /
// YOU_IMPORT_EXPORT_FAILED).
//
// Cross-plane note: subject artifacts (render artifacts or other
// content-addressed records) are REGISTERED into the editing plane by
// content binding; the originating plane stays the owner of its truth.
// The v1 EditSession solution-patch flow is untouched by this plane.

import type { CandidateVersion, EditChangeSet, EditorCapabilityProfile, EditorKind, EditingSession, ImportExportResult, OpaqueId, YouError } from "@zcode/shared";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type EditingServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function editingFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

export interface EditingServiceDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/** Shared deps bundle for flows that construct content-addressed records. */
export interface EditingContentDeps extends EditingServiceDeps {
  readonly store: EvidenceContentStore;
}

/**
 * Registry seam over the editor adapter/research lane (W5C): resolves the
 * capability profile of an editor kind, or null when unregistered.
 */
export interface EditorCapabilityRegistry {
  resolve(editorKind: EditorKind): EditorCapabilityProfile | null;
}

/**
 * Frozen fixture editor capability matrix (fixture definition — the three
 * EditorKind taxonomy entries of docs/you/EDITING_INTERCHANGE.md's
 * integration tiers). Real editors (Worker C lane) register behind the
 * same seam; an unregistered kind is a typed YOU_EDITOR_UNSUPPORTED
 * refusal, never a silent fallback.
 */
export const FIXTURE_EDITOR_CAPABILITY_PROFILES: readonly EditorCapabilityProfile[] = [
  {
    id: "you-fixture-editor-native",
    editorKind: "native",
    displayName: "Fixture Native Editor (tier 1)",
    supportsFormats: ["edit-interchange", "json", "scene-package"],
    roundTripSafe: true,
    notes: "fixture profile (simulated); tier-1 native runtime controls",
  },
  {
    id: "you-fixture-editor-embedded",
    editorKind: "embedded",
    displayName: "Fixture Embedded Editor (tier 2)",
    supportsFormats: ["edit-interchange", "json"],
    roundTripSafe: true,
    notes: "fixture profile (simulated); tier-2 embedded open-source surface",
  },
  {
    id: "you-fixture-editor-external",
    editorKind: "external",
    displayName: "Fixture External Editor (tier 3)",
    supportsFormats: ["edit-interchange", "scene-package"],
    roundTripSafe: true,
    notes: "fixture profile (simulated); tier-3 external professional application",
  },
];

/** The frozen fixture registry (default): backed by the fixture profiles. */
export function createFixtureEditorCapabilityRegistry(): EditorCapabilityRegistry {
  const byKind = new Map<EditorKind, EditorCapabilityProfile>();
  for (const profile of FIXTURE_EDITOR_CAPABILITY_PROFILES) {
    byKind.set(profile.editorKind, profile);
  }
  return {
    resolve(editorKind: EditorKind) {
      return byKind.get(editorKind) ?? null;
    },
  };
}

/**
 * One registered subject artifact (service state, not ledger truth — the
 * frozen wave-5 event set defines no subject event; the W4A template
 * library precedent). Content-addressed on the wave-2 store abstraction.
 */
export interface EditingSubjectRecord {
  readonly id: OpaqueId;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly simulated: boolean;
}

/**
 * One solution's editing plane: ledger, subject registry, sessions, change
 * sets, candidate lineage and import/export results. The service is the
 * sole writer; flows receive the record and return new immutable values.
 */
export interface EditingPlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  /** subjectArtifactId -> immutable content binding (append-only). */
  readonly subjects: Map<OpaqueId, EditingSubjectRecord>;
  /** subject ids in registration order (listing). */
  readonly subjectIds: OpaqueId[];
  /** editingSessionId -> EditingSession (immutable replacement on terminal). */
  readonly sessions: Map<OpaqueId, EditingSession>;
  /** editChangeSetId -> immutable EditChangeSet (append-only). */
  readonly changeSets: Map<OpaqueId, EditChangeSet>;
  /** editingSessionId -> change-set ids in proposal order. */
  readonly changeSetIdsBySession: Map<OpaqueId, OpaqueId[]>;
  /** candidateId -> immutable CandidateVersion (append-only). */
  readonly candidates: Map<OpaqueId, CandidateVersion>;
  /** parentVersionId -> candidate ids in proposal order (lineage). */
  readonly candidateIdsByParent: Map<OpaqueId, OpaqueId[]>;
  /** candidateId -> accepted | rejected (resolved candidates only). */
  readonly candidateResolutions: Map<OpaqueId, "accepted" | "rejected">;
  /** resultId -> immutable ImportExportResult (append-only). */
  readonly importExports: Map<OpaqueId, ImportExportResult>;
  /** resultId -> export | import (direction truth, mirrored from the ledger events). */
  readonly importExportDirections: Map<OpaqueId, "export" | "import">;
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedIds<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The editing-session lookup helper (typed YOU_EDIT_SESSION_NOT_FOUND). */
export function requireEditingSession(
  plane: EditingPlaneRecord,
  sessionId: OpaqueId,
): { readonly session: EditingSession } | { readonly error: YouError } {
  const session = plane.sessions.get(sessionId);
  if (session === undefined) {
    return {
      error: {
        code: "YOU_EDIT_SESSION_NOT_FOUND",
        message: "unknown editing session",
        details: { reason: "unknown-editing-session", editingSessionId: sessionId },
        simulated: true,
      },
    };
  }
  return { session };
}

/** Refusal for operations that require an OPEN session (typed YOU_INVALID_STATE). */
export function sessionNotOpen(sessionId: OpaqueId, status: string): { readonly ok: false; readonly error: YouError } {
  return editingFailure("YOU_INVALID_STATE", `editing session ${sessionId} is ${status}, not open`, {
    reason: "session-not-open",
    editingSessionId: sessionId,
    status,
  });
}
