// YOU editing service — import/export interchange flow (W5A —
// docs/you/EDITING_INTERCHANGE.md "Tier 4 — export/import": export ->
// user edits -> import -> diff -> validation -> candidate version ->
// accept/reject).
//
// Export: the session must exist (typed YOU_EDIT_SESSION_NOT_FOUND) and be
// OPEN; the requested format must be supported by the interchange engine
// (frozen fixture support) AND by the session's editor kind profile —
// unsupported combinations are typed YOU_IMPORT_EXPORT_FAILED refusals,
// never a silent fallback to another format. The package is assembled
// DETERMINISTICALLY (canonical JSON, no timestamps — byte-identical for
// the same editing state), stored through the wave-2 content store and
// recorded as a content-addressed succeeded ImportExportResult (the
// operation's value carries the package bytes; the record/event stay
// ref/hash-only). Event: import-export-completed.
//
// Import: imported content is untrusted until validated — the package is
// parsed per format (typed refusals) and, when session-bound, the manifest
// must address the session's subject. An INVALID payload records a FAILED
// ImportExportResult (status "failed", no content binding — honest
// journaling through import-export-completed) and surfaces the typed
// YOU_IMPORT_EXPORT_FAILED refusal carrying the recorded result id. A
// valid import stores the package bytes and records a content-addressed
// succeeded result; the export->import round trip is identity-checkable
// through the package content hashes.

import type { ImportExportFormat, ImportExportResult, OpaqueId } from "@zcode/shared";
import {
  buildImportExportResult,
  buildInterchangePackage,
  FIXTURE_INTERCHANGE_PIPELINE,
  FIXTURE_INTERCHANGE_PRIVACY,
  FIXTURE_INTERCHANGE_RENDERER,
  FIXTURE_INTERCHANGE_RIGHTS,
  isSupportedInterchangeFormat,
  parseInterchangePackage,
  type InterchangeManifest,
} from "../../../shared/src/you/importExport.js";
import type { EditingContentDeps, EditingPlaneRecord, EditingServiceResult, EditorCapabilityRegistry } from "./editingServiceTypes.js";
import { editingFailure, requireEditingSession, sessionNotOpen } from "./editingServiceTypes.js";
import { appendImportExportCompleted } from "./editingLedgerOps.js";

export interface ExportFromSessionInput {
  readonly sessionId: OpaqueId;
  readonly format: ImportExportFormat;
}

function importExportFailed(detail: string, reason: string, details: Record<string, string | number | boolean> = {}) {
  return editingFailure("YOU_IMPORT_EXPORT_FAILED", `import/export failed: ${detail}`, { reason, detail, ...details });
}

/** Session-scoped edit facts for the tier-4 edit/ section (deterministic from plane state). */
function sessionEditFacts(plane: EditingPlaneRecord, sessionId: OpaqueId): { changeSetCount: number; candidateCount: number } {
  const changeSetIds = new Set<OpaqueId>(plane.changeSetIdsBySession.get(sessionId) ?? []);
  let candidateCount = 0;
  for (const candidate of plane.candidates.values()) {
    if (changeSetIds.has(candidate.changeSetId)) {
      candidateCount += 1;
    }
  }
  return { changeSetCount: changeSetIds.size, candidateCount };
}

/**
 * Deterministically exports the session's subject through the tier-4
 * interchange: assembles the format-typed package, stores it and records
 * the content-addressed succeeded result. The returned value carries the
 * package bytes (operational value — never inlined in records/events).
 */
export function exportFromSessionOp(
  plane: EditingPlaneRecord,
  deps: EditingContentDeps,
  editorRegistry: EditorCapabilityRegistry,
  workspaceIdentity: string,
  input: ExportFromSessionInput,
): EditingServiceResult<{ readonly result: ImportExportResult; readonly packageBytes: Uint8Array; readonly manifest: InterchangeManifest }> {
  const found = requireEditingSession(plane, input.sessionId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const session = found.session;
  if (session.status !== "open") {
    return sessionNotOpen(input.sessionId, session.status);
  }
  if (!isSupportedInterchangeFormat(input.format)) {
    return importExportFailed(`interchange format "${input.format}" is not supported by the interchange engine`, "unsupported-format", {
      format: input.format,
    });
  }
  const profile = editorRegistry.resolve(session.editorKind);
  if (profile === null) {
    return editingFailure("YOU_EDITOR_UNSUPPORTED", `editor kind "${session.editorKind}" is not registered`, {
      reason: "unregistered-editor-kind",
      editorKind: session.editorKind,
    });
  }
  if (!profile.supportsFormats.includes(input.format)) {
    return importExportFailed(`editor kind "${session.editorKind}" does not support interchange format "${input.format}"`, "editor-format-unsupported", {
      editorKind: session.editorKind,
      format: input.format,
    });
  }
  const subject = plane.subjects.get(session.subjectArtifactId);
  if (subject === undefined) {
    return editingFailure("YOU_INVALID_STATE", "unknown subject artifact", {
      reason: "unknown-subject-artifact",
      subjectArtifactId: session.subjectArtifactId,
    });
  }
  const content = deps.store.get(subject.contentRef);
  if (content === null) {
    return editingFailure("YOU_INVALID_STATE", "the subject content does not resolve in the content store", {
      reason: "subject-content-unresolved",
      subjectArtifactId: session.subjectArtifactId,
      contentRef: subject.contentRef,
    });
  }
  const manifest: InterchangeManifest = {
    youObjectId: subject.id,
    youObjectHash: subject.contentHash,
    sourceEvidenceRefs: [],
    renderer: FIXTURE_INTERCHANGE_RENDERER,
    pipeline: FIXTURE_INTERCHANGE_PIPELINE,
    editorTarget: session.editorKind,
    supportedRoundTripPath: input.format,
    roundTripSafe: profile.roundTripSafe,
    provenance: `fixture:w5a-interchange:${workspaceIdentity}`,
    rights: FIXTURE_INTERCHANGE_RIGHTS,
    privacy: FIXTURE_INTERCHANGE_PRIVACY,
  };
  const packageBytes = buildInterchangePackage({
    format: input.format,
    manifest,
    content,
    contentRef: subject.contentRef,
    editFacts: sessionEditFacts(plane, input.sessionId),
    provenanceFacts: { sessionId: input.sessionId, workspaceIdentity },
  });
  const binding = deps.store.put(packageBytes);
  const result = buildImportExportResult(
    {
      sessionId: input.sessionId,
      format: input.format,
      status: "succeeded",
      contentRef: binding.contentRef,
      contentHash: binding.contentHash,
      completedAt: deps.clock.now(),
    },
    { ids: deps.ids },
  );
  plane.importExports.set(result.id, result);
  plane.importExportDirections.set(result.id, "export");
  appendImportExportCompleted(plane, result, "export", packageBytes.byteLength);
  return { ok: true, value: { result, packageBytes, manifest } };
}

export interface ImportEditPackageInput {
  readonly sessionId?: OpaqueId | null;
  readonly format: ImportExportFormat;
  readonly packageBytes: Uint8Array;
}

/**
 * Validates + imports a tier-4 package. A structurally invalid payload —
 * or a session-bound package that addresses a different subject — records
 * the honest FAILED ImportExportResult (journaled through
 * import-export-completed) and returns the typed YOU_IMPORT_EXPORT_FAILED
 * refusal carrying the recorded result id. A valid import stores the
 * package bytes and records the content-addressed succeeded result.
 */
export function importEditPackageOp(
  plane: EditingPlaneRecord,
  deps: EditingContentDeps,
  input: ImportEditPackageInput,
): EditingServiceResult<{ readonly result: ImportExportResult }> {
  if (!isSupportedInterchangeFormat(input.format)) {
    return importExportFailed(`interchange format "${input.format}" is not supported by the interchange engine`, "unsupported-format", {
      format: input.format,
    });
  }
  const sessionId = input.sessionId ?? null;
  if (sessionId !== null) {
    const found = requireEditingSession(plane, sessionId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    if (found.session.status !== "open") {
      return sessionNotOpen(sessionId, found.session.status);
    }
  }
  const parsed = parseInterchangePackage(input.format, input.packageBytes);
  if (!parsed.ok) {
    return failedImportRecord(plane, deps, input, sessionId, parsed.code, parsed.detail);
  }
  if (sessionId !== null) {
    const session = plane.sessions.get(sessionId);
    const subjectId = session?.subjectArtifactId ?? "";
    if (parsed.package.manifest.youObjectId !== subjectId) {
      return failedImportRecord(
        plane,
        deps,
        input,
        sessionId,
        "subject-mismatch",
        `the package addresses subject "${parsed.package.manifest.youObjectId}" but the session edits "${subjectId}"`,
      );
    }
  }
  const binding = deps.store.put(input.packageBytes);
  const result = buildImportExportResult(
    {
      sessionId,
      format: input.format,
      status: "succeeded",
      contentRef: binding.contentRef,
      contentHash: binding.contentHash,
      completedAt: deps.clock.now(),
    },
    { ids: deps.ids },
  );
  plane.importExports.set(result.id, result);
  plane.importExportDirections.set(result.id, "import");
  appendImportExportCompleted(plane, result, "import", input.packageBytes.byteLength);
  return { ok: true, value: { result } };
}

/** Records the honest FAILED result, then surfaces the typed refusal (its details carry the result id). */
function failedImportRecord(
  plane: EditingPlaneRecord,
  deps: EditingContentDeps,
  input: ImportEditPackageInput,
  sessionId: OpaqueId | null,
  reason: string,
  detail: string,
): { readonly ok: false; readonly error: import("@zcode/shared").YouError } {
  const result = buildImportExportResult(
    {
      sessionId,
      format: input.format,
      status: "failed",
      contentRef: null,
      contentHash: null,
      completedAt: deps.clock.now(),
    },
    { ids: deps.ids },
  );
  plane.importExports.set(result.id, result);
  plane.importExportDirections.set(result.id, "import");
  appendImportExportCompleted(plane, result, "import", 0);
  return importExportFailed(detail, reason, { resultId: result.id });
}
