// YOU Solution service — editor recommendation, export and re-import
// interchange flow (docs/you/EDITING_INTERCHANGE.md). External editors
// are adapters; re-imports become candidate versions through YOU's own
// versioning authority.

import type { OpaqueId, SolutionPatchOperation } from "@zcode/shared";
import {
  buildArtifactPackage,
  reImportArtifactPackage,
  recommendEditorForSnapshot,
  simulateExternalEdit,
} from "../../../shared/src/you/artifact.js";
import { proposeAndAccept } from "./solutionLedgerOps.js";
import type {
  ReImportOutcome,
  SolutionRecord,
  SolutionServiceDeps,
  SolutionServiceResult,
} from "./solutionServiceTypes.js";
import { failure } from "./solutionServiceTypes.js";

/** Deterministic editor recommendation (external editors are adapters). */
export function recommendEditorOp(
  record: SolutionRecord,
): SolutionServiceResult<{ readonly editorId: string; readonly exportFormat: string }> {
  const recommendation = recommendEditorForSnapshot(record.chain.current().state);
  record.runtime.notify({ type: "editor_requested", recommendation });
  return { ok: true, value: { editorId: recommendation.editorId, exportFormat: recommendation.exportFormat } };
}

/** Exports the content-addressed editable package for the current version. */
export function exportSolutionOp(
  record: SolutionRecord,
  deps: SolutionServiceDeps,
): SolutionServiceResult<{ readonly artifact: import("../../../shared/src/you/artifact.js").SolutionArtifactPackage }> {
  const current = record.chain.current();
  const artifact = buildArtifactPackage(current, recommendEditorForSnapshot(current.state), deps);
  record.artifacts.set(artifact.id, artifact);
  return { ok: true, value: { artifact } };
}

/** Simulated external edit + truthful diff + re-import as candidate version. */
export function simulateExternalEditAndReImportOp(
  record: SolutionRecord,
  deps: SolutionServiceDeps,
  artifactId: OpaqueId,
  input: { readonly operations: readonly SolutionPatchOperation[] },
): SolutionServiceResult<ReImportOutcome> {
  const artifact = record.artifacts.get(artifactId);
  if (artifact === undefined) {
    return failure("YOU_INVALID_STATE", "unknown artifact", { reason: "unknown-artifact", artifactId });
  }
  const edited = simulateExternalEdit(artifact, input.operations, deps);
  record.artifacts.set(edited.id, edited);
  const current = record.chain.current();
  const reImported = reImportArtifactPackage(edited, current);
  const applied = proposeAndAccept(record, {
    baseVersionId: current.id,
    operations: reImported.operations,
    intentRef: record.intent.id,
    authorType: "importer",
    changePayload: { actor: "importer", artifactId: edited.id, simulated: true },
    versionPayload: { actor: "importer", artifactId: edited.id },
  });
  if (applied === null) {
    return failure("YOU_INVALID_STATE", "re-import changeset was rejected", { reason: "reimport-failed", artifactId: edited.id });
  }
  return {
    ok: true,
    value: { editedArtifact: edited, diff: reImported.diff, version: applied.version, changeSet: applied.changeSet },
  };
}
