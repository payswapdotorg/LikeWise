// YOU editing application service — the single authority over
// editing/interchange truth (W5A; docs/you/CONTRACTS.md "State ownership":
// EditSession = the editing service, Worker A lane — the wave-5
// namespaced EditingSession plane).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one editing plane per solution
// (append-only SolutionEventLedger + the subject registry + immutable
// sessions + change sets + candidate lineage + import/export results) and
// the editing content store. Editor kinds register behind the injected
// EditorCapabilityRegistry seam (the W5C adapter/research lane; default =
// the frozen fixture capability matrix); interchange formats behind the
// frozen fixture engine support (shared/src/you/importExport.ts). Phase
// 0 is fully deterministic: injected clock + seeded RNG; everything
// simulated stays labeled `simulated: true` (truth law).
//
// The v1 EditSession solution-patch flow stays untouched (separate plane,
// separate records); the frozen wave-5 namespaced shapes
// (EditingSession / EditChangeSet / CandidateVersion / ImportExportResult)
// are the only contract types this service writes.

import type {
  CandidateVersion,
  EditChangeSet,
  EditChangeSetOp,
  EditorCapabilityProfile,
  EditingSession,
  ImportExportResult,
  OpaqueId,
  SolutionEvent,
} from "@zcode/shared";
import { createDeterministicClock, type YouClock } from "../../../shared/src/you/clock.js";
import { createEditChangeSetOp, validateEditChangeSet as validateChangeSetMachinery } from "../../../shared/src/you/editChangeSet.js";
import type { EditingPlaneProjection } from "../../../shared/src/you/editingLedger.js";
import { replayEditingLedger } from "../../../shared/src/you/editingLedger.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import { applyEditChangeSetOp, ancestryOfCandidateOp, candidatesOfParentOp, proposeEditChangeSetOp, resolveCandidateVersionOp, type EditingLineageView } from "./editChangeSetFlow.js";
import { exportFromSessionOp, importEditPackageOp, type ExportFromSessionInput, type ImportEditPackageInput } from "./importExportFlow.js";
import { buildEditingPlaneProjection } from "./editingProjection.js";
import { abandonEditingSessionOp, commitEditingSessionOp, openEditingSessionOp, registerSubjectOp, type OpenEditingSessionInput, type SubjectRegistrationInput } from "./editingSessionFlow.js";
import type { EditingContentDeps, EditingPlaneRecord, EditingServiceResult, EditingSubjectRecord, EditorCapabilityRegistry } from "./editingServiceTypes.js";
import { createFixtureEditorCapabilityRegistry, editingFailure } from "./editingServiceTypes.js";

export interface EditingServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
  readonly contentStore?: EvidenceContentStore;
  /** Editor capability registry seam (W5C adapter/research lane); default = frozen fixture matrix. */
  readonly editorRegistry?: EditorCapabilityRegistry;
}

/** Fixture op spec for deterministic edit-op synthesis. */
export interface FixtureEditOpSpec {
  readonly kind: string;
}

/** The application-service authority over editing/interchange truth (W5A). */
export class EditingService {
  private readonly planes = new Map<OpaqueId, EditingPlaneRecord>();
  private readonly deps: EditingServiceDepsBundle;
  private readonly contentStore: EvidenceContentStore;
  private readonly editorRegistry: EditorCapabilityRegistry;

  private constructor(
    readonly workspaceIdentity: string,
    clock: YouClock,
    ids: YouIdFactory,
    contentStore: EvidenceContentStore,
    editorRegistry: EditorCapabilityRegistry,
  ) {
    this.deps = { clock, ids };
    this.contentStore = contentStore;
    this.editorRegistry = editorRegistry;
  }

  /** Creates a deterministic service (injected clock + seeded ids/content). */
  static create(config: EditingServiceConfig): EditingService {
    const seed = config.seed ?? "you-w5a-editing-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new EditingService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
      config.contentStore ?? createFixtureEvidenceContentStore(),
      config.editorRegistry ?? createFixtureEditorCapabilityRegistry(),
    );
  }

  // -- subjects -----------------------------------------------------------

  /** Registers a subject artifact (content-addressed; append-only registry). */
  registerSubject(solutionId: OpaqueId, input: SubjectRegistrationInput): EditingServiceResult<{ readonly subject: EditingSubjectRecord }> {
    return registerSubjectOp(this.planeFor(solutionId), this.contentDeps(), input);
  }

  subjectOf(solutionId: OpaqueId, subjectArtifactId: OpaqueId): EditingServiceResult<{ readonly subject: EditingSubjectRecord }> {
    const plane = this.planeFor(solutionId);
    const subject = plane.subjects.get(subjectArtifactId);
    return subject === undefined
      ? editingFailure("YOU_INVALID_STATE", "unknown subject artifact", { reason: "unknown-subject-artifact", subjectArtifactId })
      : { ok: true, value: { subject } };
  }

  /** All registered subjects, in registration order. */
  subjectsOf(solutionId: OpaqueId): readonly EditingSubjectRecord[] {
    const plane = this.planeFor(solutionId);
    return plane.subjectIds.map((subjectId) => plane.subjects.get(subjectId)).filter((subject): subject is EditingSubjectRecord => subject !== undefined);
  }

  // -- sessions -----------------------------------------------------------

  /** Opens an editing session over a registered subject artifact. */
  openEditingSession(solutionId: OpaqueId, input: OpenEditingSessionInput): EditingServiceResult<{ readonly session: EditingSession; readonly profile: EditorCapabilityProfile }> {
    const plane = this.planeFor(solutionId);
    const opened = openEditingSessionOp(plane, this.contentDeps(), this.editorRegistry, input);
    if (!opened.ok) {
      return opened;
    }
    const profile = this.editorRegistry.resolve(opened.value.session.editorKind);
    return profile === null
      ? editingFailure("YOU_EDITOR_UNSUPPORTED", `editor kind "${opened.value.session.editorKind}" is not registered`, {
          reason: "unregistered-editor-kind",
          editorKind: opened.value.session.editorKind,
        })
      : { ok: true, value: { session: opened.value.session, profile } };
  }

  editingSessionOf(solutionId: OpaqueId, sessionId: OpaqueId): EditingServiceResult<{ readonly session: EditingSession }> {
    const plane = this.planeFor(solutionId);
    const session = plane.sessions.get(sessionId);
    return session === undefined
      ? editingFailure("YOU_EDIT_SESSION_NOT_FOUND", "unknown editing session", { reason: "unknown-editing-session", editingSessionId: sessionId })
      : { ok: true, value: { session } };
  }

  /** All sessions, sorted by id (listing; status facts included). */
  editingSessionsOf(solutionId: OpaqueId): readonly EditingSession[] {
    const plane = this.planeFor(solutionId);
    return [...plane.sessions.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  }

  /** Commits an open session (open -> committed; terminal, append-only). */
  commitEditingSession(solutionId: OpaqueId, sessionId: OpaqueId): EditingServiceResult<{ readonly session: EditingSession }> {
    return commitEditingSessionOp(this.planeFor(solutionId), sessionId);
  }

  /** Abandons an open session (open -> abandoned; terminal, append-only). */
  abandonEditingSession(solutionId: OpaqueId, sessionId: OpaqueId): EditingServiceResult<{ readonly session: EditingSession }> {
    return abandonEditingSessionOp(this.planeFor(solutionId), sessionId);
  }

  // -- edit ops + change sets ---------------------------------------------

  /**
   * Deterministically synthesizes ordered edit ops (fixture mode): one op
   * per spec in the GIVEN order (ordering is the caller's authority),
   * payload bytes derived from the seed text, stored through the editing
   * content store (payloadRef + sha-256 payloadHash).
   */
  synthesizeEditOps(
    solutionId: OpaqueId,
    input: { readonly opSpecs: readonly FixtureEditOpSpec[]; readonly seedText: string },
  ): EditingServiceResult<{ readonly ops: readonly EditChangeSetOp[] }> {
    this.planeFor(solutionId);
    if (input.opSpecs.length === 0) {
      return editingFailure("YOU_CHANGESET_INVALID", "an edit change set requires at least one op", { reason: "empty-op-list" });
    }
    const ops: EditChangeSetOp[] = [];
    for (const [index, spec] of input.opSpecs.entries()) {
      const created = createEditChangeSetOp(
        { kind: spec.kind, rng: createDeterministicRng(seedFromString(`${input.seedText}:${index}:${spec.kind}`)) },
        { ids: this.deps.ids, store: this.contentStore },
      );
      if (!created.ok) {
        return editingFailure("YOU_CHANGESET_INVALID", `invalid edit op: ${created.detail}`, { reason: created.code, opIndex: index });
      }
      ops.push(created.op);
    }
    return { ok: true, value: { ops: Object.freeze(ops) } };
  }

  /** Proposes an edit change set for an OPEN session (typed refusals). */
  proposeEditChangeSet(
    solutionId: OpaqueId,
    input: { readonly sessionId: OpaqueId; readonly ops: readonly EditChangeSetOp[] },
  ): EditingServiceResult<{ readonly changeSet: EditChangeSet }> {
    return proposeEditChangeSetOp(this.planeFor(solutionId), this.contentDeps(), input);
  }

  /** The stateless change-set validator surface (no clock, no store, no state). */
  validateEditChangeSet(changeSet: EditChangeSet): EditingServiceResult<{ readonly opCount: number }> {
    const validated = validateChangeSetMachinery(changeSet);
    if (!validated.ok) {
      return editingFailure("YOU_CHANGESET_INVALID", `invalid edit change set: ${validated.detail}`, {
        reason: validated.code,
        detail: validated.detail,
      });
    }
    return { ok: true, value: { opCount: changeSet.ops.length } };
  }

  editChangeSetOf(solutionId: OpaqueId, changeSetId: OpaqueId): EditingServiceResult<{ readonly changeSet: EditChangeSet }> {
    const plane = this.planeFor(solutionId);
    const changeSet = plane.changeSets.get(changeSetId);
    return changeSet === undefined
      ? editingFailure("YOU_INVALID_STATE", "unknown edit change set", { reason: "unknown-change-set", editChangeSetId: changeSetId })
      : { ok: true, value: { changeSet } };
  }

  /** The change sets of one session, in proposal order. */
  changeSetsOfSession(solutionId: OpaqueId, sessionId: OpaqueId): readonly EditChangeSet[] {
    const plane = this.planeFor(solutionId);
    const ids = plane.changeSetIdsBySession.get(sessionId) ?? [];
    return ids.map((changeSetId) => plane.changeSets.get(changeSetId)).filter((changeSet): changeSet is EditChangeSet => changeSet !== undefined);
  }

  // -- candidate versions + lineage ---------------------------------------

  /** Applies a validated change set to a parent version (subject root or candidate). */
  applyEditChangeSet(
    solutionId: OpaqueId,
    input: { readonly changeSetId: OpaqueId; readonly parentVersionId: OpaqueId },
  ): EditingServiceResult<{ readonly candidate: CandidateVersion }> {
    return applyEditChangeSetOp(this.planeFor(solutionId), this.contentDeps(), input);
  }

  candidateVersionOf(solutionId: OpaqueId, candidateId: OpaqueId): EditingServiceResult<{ readonly candidate: CandidateVersion }> {
    const plane = this.planeFor(solutionId);
    const candidate = plane.candidates.get(candidateId);
    return candidate === undefined
      ? editingFailure("YOU_INVALID_STATE", "unknown candidate version", { reason: "unknown-candidate-version", candidateId })
      : { ok: true, value: { candidate } };
  }

  /** The candidates proposed for one parent version, in proposal order (lineage query). */
  candidatesOfParent(solutionId: OpaqueId, parentVersionId: OpaqueId): EditingServiceResult<readonly CandidateVersion[]> {
    const plane = this.planeFor(solutionId);
    if (!plane.subjects.has(parentVersionId) && !plane.candidates.has(parentVersionId)) {
      return editingFailure("YOU_INVALID_STATE", "unknown parent version (neither a registered subject nor a proposed candidate)", {
        reason: "unknown-parent-version",
        parentVersionId,
      });
    }
    return { ok: true, value: candidatesOfParentOp(plane, parentVersionId) };
  }

  /** The root-to-leaf lineage view of a candidate (subject root first). */
  ancestryOfCandidate(solutionId: OpaqueId, candidateId: OpaqueId): EditingServiceResult<EditingLineageView> {
    return ancestryOfCandidateOp(this.planeFor(solutionId), candidateId);
  }

  /** Resolves a proposed candidate exactly once (change-accepted / change-rejected). */
  resolveCandidateVersion(
    solutionId: OpaqueId,
    input: { readonly candidateId: OpaqueId; readonly outcome: "accepted" | "rejected"; readonly reason?: string },
  ): EditingServiceResult<{ readonly candidate: CandidateVersion; readonly resolution: "accepted" | "rejected" }> {
    return resolveCandidateVersionOp(this.planeFor(solutionId), input);
  }

  /** The recorded resolution of a candidate, or null while proposed. */
  resolutionOfCandidate(solutionId: OpaqueId, candidateId: OpaqueId): "accepted" | "rejected" | null {
    return this.planeFor(solutionId).candidateResolutions.get(candidateId) ?? null;
  }

  // -- import/export ------------------------------------------------------

  /**
   * Deterministically exports the session's subject through the tier-4
   * interchange. The returned value carries the package bytes (operational
   * value — the record/event stay content-addressed ref/hash-only).
   */
  exportFromSession(
    solutionId: OpaqueId,
    input: ExportFromSessionInput,
  ): EditingServiceResult<{ readonly result: ImportExportResult; readonly packageBytes: Uint8Array }> {
    const exported = exportFromSessionOp(this.planeFor(solutionId), this.contentDeps(), this.editorRegistry, this.workspaceIdentity, input);
    return exported.ok ? { ok: true, value: { result: exported.value.result, packageBytes: exported.value.packageBytes } } : exported;
  }

  /** Validates + imports a tier-4 package (typed YOU_IMPORT_EXPORT_FAILED on invalid payloads). */
  importEditPackage(solutionId: OpaqueId, input: ImportEditPackageInput): EditingServiceResult<{ readonly result: ImportExportResult }> {
    return importEditPackageOp(this.planeFor(solutionId), this.contentDeps(), input);
  }

  importExportResultOf(solutionId: OpaqueId, resultId: OpaqueId): EditingServiceResult<{ readonly result: ImportExportResult }> {
    const plane = this.planeFor(solutionId);
    const result = plane.importExports.get(resultId);
    return result === undefined
      ? editingFailure("YOU_INVALID_STATE", "unknown import/export result", { reason: "unknown-import-export-result", resultId })
      : { ok: true, value: { result } };
  }

  /** All import/export results, sorted by id. */
  importExportResultsOf(solutionId: OpaqueId): readonly ImportExportResult[] {
    const plane = this.planeFor(solutionId);
    return [...plane.importExports.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  }

  // -- reads / projection / persistence ------------------------------------

  /** Live authoritative projection (same shape as replayEditingLedger output). */
  projectionOf(solutionId: OpaqueId): EditingServiceResult<EditingPlaneProjection> {
    return { ok: true, value: buildEditingPlaneProjection(this.planeFor(solutionId)) };
  }

  ledgerEventsOf(solutionId: OpaqueId): EditingServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): EditingServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): EditingServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Number of stored editing content refs (fixture observability). */
  contentStoreSize(): number {
    return this.contentStore.size;
  }

  /** Replays a persisted ledger through the shared editing-plane fold. */
  static replay(events: readonly SolutionEvent[]): EditingPlaneProjection {
    return replayEditingLedger(events);
  }

  // -- internals -----------------------------------------------------------

  private contentDeps(): EditingContentDeps {
    return { clock: this.deps.clock, ids: this.deps.ids, store: this.contentStore };
  }

  /** Lazily opens (and caches) the editing plane for one solution. */
  private planeFor(solutionId: OpaqueId): EditingPlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: EditingPlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.deps),
      subjects: new Map(),
      subjectIds: [],
      sessions: new Map(),
      changeSets: new Map(),
      changeSetIdsBySession: new Map(),
      candidates: new Map(),
      candidateIdsByParent: new Map(),
      candidateResolutions: new Map(),
      importExports: new Map(),
      importExportDirections: new Map(),
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

interface EditingServiceDepsBundle {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/** Creates the deterministic editing application service. */
export function createEditingService(config: EditingServiceConfig): EditingService {
  return EditingService.create(config);
}

export type { EditorCapabilityRegistry, EditingSubjectRecord };
