import assert from "node:assert/strict";
import test from "node:test";
import type { CandidateVersion, EditChangeSetOp, EditingSession } from "@zcode/shared";
import { sha256Hex } from "../../../shared/src/you/evidenceStore.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { EDITING_SESSION_TRANSITIONS } from "../../../shared/src/you/editingSession.js";
import { createEditingService, EditingService, type FixtureEditOpSpec } from "./editingService.js";
import { createFixtureEditorCapabilityRegistry, type EditorCapabilityRegistry } from "./editingServiceTypes.js";

const SOLUTION = "you_w5a_service_test";

function must<T>(
  result: { readonly ok: boolean; readonly value?: T; readonly error?: { readonly code: string; readonly message: string } },
  where: string,
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`test failed at ${where}: ${result.error?.code ?? "unknown"}`);
  }
  return result.value;
}

function makeService(seed: string): EditingService {
  return createEditingService({ workspaceIdentity: "ws-w5a-service-test", seed });
}

function makeSubject(service: EditingService): string {
  const bytes = new Uint8Array(128);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * 3 + 7) & 0xff;
  }
  const registered = service.registerSubject(SOLUTION, { bytes });
  assert.ok(registered.ok);
  return registered.value.subject.id;
}

function openSession(service: EditingService, subjectId: string, editorKind = "external"): string {
  const opened = service.openEditingSession(SOLUTION, { subjectArtifactId: subjectId, editorKind });
  assert.ok(opened.ok);
  return opened.value.session.id;
}

function opsFor(service: EditingService, seedText: string, kinds: readonly string[] = ["transform", "material"]): readonly EditChangeSetOp[] {
  const synthesized = service.synthesizeEditOps(SOLUTION, {
    opSpecs: kinds.map((kind) => ({ kind }) satisfies FixtureEditOpSpec),
    seedText,
  });
  assert.ok(synthesized.ok);
  return synthesized.value.ops;
}

function propose(service: EditingService, sessionId: string, ops: readonly EditChangeSetOp[]): string {
  const proposed = service.proposeEditChangeSet(SOLUTION, { sessionId, ops });
  assert.ok(proposed.ok);
  return proposed.value.changeSet.id;
}

// ---------------------------------------------------------------------------
// Error taxonomy: YOU_EDIT_SESSION_NOT_FOUND
// ---------------------------------------------------------------------------

test("unknown editing sessions are typed YOU_EDIT_SESSION_NOT_FOUND (read, close, propose-against, export)", () => {
  const service = makeService("errors");
  const subjectId = makeSubject(service);

  const read = service.editingSessionOf(SOLUTION, "you_editing-session_missing");
  assert.ok(!read.ok);
  assert.equal(read.error.code, "YOU_EDIT_SESSION_NOT_FOUND");
  assert.equal(read.error.details["reason"], "unknown-editing-session");
  assert.equal(read.error.details["editingSessionId"], "you_editing-session_missing");

  const commit = service.commitEditingSession(SOLUTION, "you_editing-session_missing");
  assert.ok(!commit.ok);
  assert.equal(commit.error.code, "YOU_EDIT_SESSION_NOT_FOUND");

  const abandon = service.abandonEditingSession(SOLUTION, "you_editing-session_missing");
  assert.ok(!abandon.ok);
  assert.equal(abandon.error.code, "YOU_EDIT_SESSION_NOT_FOUND");

  const proposed = service.proposeEditChangeSet(SOLUTION, { sessionId: "you_editing-session_missing", ops: opsFor(service, "s") });
  assert.ok(!proposed.ok);
  assert.equal(proposed.error.code, "YOU_EDIT_SESSION_NOT_FOUND");

  const exported = service.exportFromSession(SOLUTION, { sessionId: "you_editing-session_missing", format: "json" });
  assert.ok(!exported.ok);
  assert.equal(exported.error.code, "YOU_EDIT_SESSION_NOT_FOUND");

  // Subject still registered; no session was created by the failed reads.
  assert.equal(service.editingSessionsOf(SOLUTION).length, 0);
  assert.ok(service.subjectOf(SOLUTION, subjectId).ok);
});

// ---------------------------------------------------------------------------
// Session lifecycle: open -> committed | abandoned; terminals locked
// ---------------------------------------------------------------------------

test("the session lifecycle is open -> committed | abandoned with terminals locked (typed refusals)", () => {
  const service = makeService("lifecycle");
  assert.deepEqual(EDITING_SESSION_TRANSITIONS, {
    open: ["committed", "abandoned"],
    committed: [],
    abandoned: [],
  } as const);

  const subjectId = makeSubject(service);
  const sessionId = openSession(service, subjectId);

  const committed = service.commitEditingSession(SOLUTION, sessionId);
  assert.ok(committed.ok);
  assert.equal(committed.value.session.status, "committed");
  assert.equal(committed.value.session.id, sessionId);

  // Terminal: every further transition is the typed illegal-transition refusal.
  for (const attempt of [
    () => service.commitEditingSession(SOLUTION, sessionId),
    () => service.abandonEditingSession(SOLUTION, sessionId),
  ]) {
    const refused = attempt();
    assert.ok(!refused.ok);
    assert.equal(refused.error.code, "YOU_INVALID_STATE");
    assert.equal(refused.error.details["reason"], "illegal-editing-session-transition");
    assert.equal(refused.error.details["fromStatus"], "committed");
  }

  // The abandoned terminal behaves identically.
  const sessionId2 = openSession(service, subjectId);
  const abandoned = service.abandonEditingSession(SOLUTION, sessionId2);
  assert.ok(abandoned.ok);
  assert.equal(abandoned.value.session.status, "abandoned");
  const refused = service.commitEditingSession(SOLUTION, sessionId2);
  assert.ok(!refused.ok);
  assert.equal(refused.error.details["fromStatus"], "abandoned");

  // Immutable record replacement: same id, same openedAt, only the status moved.
  const reread = service.editingSessionOf(SOLUTION, sessionId);
  assert.ok(reread.ok);
  assert.equal(committed.value.session.openedAt, reread.value.session.openedAt);
  assert.ok(Object.isFrozen(committed.value.session));
  assert.equal(service.editingSessionsOf(SOLUTION).length, 2);
});

test("open sessions require a REGISTERED subject and a REGISTERED editor kind", () => {
  const service = makeService("open-refusals");
  const subjectId = makeSubject(service);

  const unknownSubject = service.openEditingSession(SOLUTION, { subjectArtifactId: "you_editing-subject_missing", editorKind: "native" });
  assert.ok(!unknownSubject.ok);
  assert.equal(unknownSubject.error.code, "YOU_INVALID_STATE");
  assert.equal(unknownSubject.error.details["reason"], "unknown-subject-artifact");

  const unregisteredEditor = service.openEditingSession(SOLUTION, { subjectArtifactId: subjectId, editorKind: "quantum-editor" });
  assert.ok(!unregisteredEditor.ok);
  assert.equal(unregisteredEditor.error.code, "YOU_EDITOR_UNSUPPORTED");
  assert.equal(unregisteredEditor.error.details["reason"], "unregistered-editor-kind");

  // The fixture registry resolves the three taxonomy kinds.
  const registry: EditorCapabilityRegistry = createFixtureEditorCapabilityRegistry();
  for (const kind of ["native", "embedded", "external"]) {
    const profile = registry.resolve(kind);
    assert.ok(profile !== null, kind);
    assert.ok(profile.supportsFormats.length > 0);
  }
  assert.equal(registry.resolve("quantum-editor"), null);

  // The open surface returns the resolved profile alongside the session.
  const opened = service.openEditingSession(SOLUTION, { subjectArtifactId: subjectId, editorKind: "embedded" });
  assert.ok(opened.ok);
  assert.equal(opened.value.profile.editorKind, "embedded");
  assert.equal(opened.value.profile.id, "you-fixture-editor-embedded");
});

test("subject registration content-addresses bytes and verifies explicit bindings", () => {
  const service = makeService("subjects");
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);

  const registered = service.registerSubject(SOLUTION, { bytes });
  assert.ok(registered.ok);
  const subject = registered.value.subject;
  assert.ok(subject.contentRef.startsWith("you_content_"));
  assert.equal(subject.contentHash, sha256Hex(bytes));
  assert.equal(subject.simulated, true);
  assert.ok(Object.isFrozen(subject));

  // By-ref registration with the correct binding resolves through the store.
  const byRef = service.registerSubject(SOLUTION, { contentRef: subject.contentRef, contentHash: subject.contentHash });
  assert.ok(byRef.ok);

  // A dangling ref is a typed refusal; a wrong hash is a typed mismatch — never a silent repair.
  const dangling = service.registerSubject(SOLUTION, { contentRef: "you_content_missing", contentHash: "a".repeat(64) });
  assert.ok(!dangling.ok);
  assert.equal(dangling.error.code, "YOU_INVALID_STATE");
  assert.equal(dangling.error.details["reason"], "unresolved-content-ref");

  const mismatch = service.registerSubject(SOLUTION, { contentRef: subject.contentRef, contentHash: "b".repeat(64) });
  assert.ok(!mismatch.ok);
  assert.equal(mismatch.error.code, "YOU_CONTENT_HASH_MISMATCH");

  assert.equal(service.subjectsOf(SOLUTION).length, 2);
  assert.ok(!service.subjectOf(SOLUTION, "you_editing-subject_missing").ok);
});

// ---------------------------------------------------------------------------
// Change-set validation: typed YOU_CHANGESET_INVALID refusals
// ---------------------------------------------------------------------------

test("change-set proposal refuses empty op lists and invalid ops with typed YOU_CHANGESET_INVALID", () => {
  const service = makeService("changeset-refusals");
  const subjectId = makeSubject(service);
  const sessionId = openSession(service, subjectId);

  const empty = service.proposeEditChangeSet(SOLUTION, { sessionId, ops: [] });
  assert.ok(!empty.ok);
  assert.equal(empty.error.code, "YOU_CHANGESET_INVALID");
  assert.equal(empty.error.details["reason"], "empty-op-list");

  const emptySynth = service.synthesizeEditOps(SOLUTION, { opSpecs: [], seedText: "s" });
  assert.ok(!emptySynth.ok);
  assert.equal(emptySynth.error.code, "YOU_CHANGESET_INVALID");

  const ops = opsFor(service, "bad-ops");
  const emptyKind = service.proposeEditChangeSet(SOLUTION, { sessionId, ops: [{ ...ops[0]!, kind: "" }] });
  assert.ok(!emptyKind.ok);
  assert.equal(emptyKind.error.code, "YOU_CHANGESET_INVALID");
  assert.equal(emptyKind.error.details["reason"], "invalid-op");

  const badHash = service.proposeEditChangeSet(SOLUTION, { sessionId, ops: [{ ...ops[0]!, payloadHash: "not-hex" }] });
  assert.ok(!badHash.ok);
  assert.equal(badHash.error.code, "YOU_CHANGESET_INVALID");

  const duplicateIds = service.proposeEditChangeSet(SOLUTION, { sessionId, ops: [ops[0]!, { ...ops[1]!, id: ops[0]!.id }] });
  assert.ok(!duplicateIds.ok);
  assert.equal(duplicateIds.error.code, "YOU_CHANGESET_INVALID");

  // No change set was recorded by the refusals.
  assert.equal(service.changeSetsOfSession(SOLUTION, sessionId).length, 0);
});

test("proposal and application require an OPEN session (typed session-not-open refusals)", () => {
  const service = makeService("open-only");
  const subjectId = makeSubject(service);
  const sessionId = openSession(service, subjectId);
  const changeSetId = propose(service, sessionId, opsFor(service, "s"));
  const committed = service.commitEditingSession(SOLUTION, sessionId);
  assert.ok(committed.ok);

  const proposed = service.proposeEditChangeSet(SOLUTION, { sessionId, ops: opsFor(service, "s2") });
  assert.ok(!proposed.ok);
  assert.equal(proposed.error.code, "YOU_INVALID_STATE");
  assert.equal(proposed.error.details["reason"], "session-not-open");

  const applied = service.applyEditChangeSet(SOLUTION, { changeSetId, parentVersionId: subjectId });
  assert.ok(!applied.ok);
  assert.equal(applied.error.code, "YOU_INVALID_STATE");
  assert.equal(applied.error.details["reason"], "session-not-open");
});

test("the stateless validator surface validates proposed change sets without touching the clock", () => {
  const service = makeService("validator");
  const subjectId = makeSubject(service);
  const sessionId = openSession(service, subjectId);
  const changeSetId = propose(service, sessionId, opsFor(service, "s"));
  const changeSet = must(service.editChangeSetOf(SOLUTION, changeSetId), "editChangeSetOf").changeSet;
  assert.ok(changeSet !== undefined);

  const validated = service.validateEditChangeSet(changeSet);
  assert.ok(validated.ok);
  assert.equal(validated.value.opCount, 2);

  const invalid = service.validateEditChangeSet({ ...changeSet, ops: [] });
  assert.ok(!invalid.ok);
  assert.equal(invalid.error.code, "YOU_CHANGESET_INVALID");
  assert.equal(invalid.error.details["reason"], "empty-op-list");

  const unknown = service.editChangeSetOf(SOLUTION, "you_edit-change-set_missing");
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.code, "YOU_INVALID_STATE");
  assert.equal(unknown.error.details["reason"], "unknown-change-set");
});

// ---------------------------------------------------------------------------
// Candidate-version lineage
// ---------------------------------------------------------------------------

test("applying a validated change set produces an immutable content-addressed CandidateVersion", () => {
  const service = makeService("apply");
  const subjectId = makeSubject(service);
  const sessionId = openSession(service, subjectId);
  const changeSetId = propose(service, sessionId, opsFor(service, "apply-1"));

  const applied = service.applyEditChangeSet(SOLUTION, { changeSetId, parentVersionId: subjectId });
  assert.ok(applied.ok);
  const candidate: CandidateVersion = applied.value.candidate;
  assert.equal(candidate.changeSetId, changeSetId);
  assert.equal(candidate.parentVersionId, subjectId);
  assert.ok(candidate.contentRef.startsWith("you_content_"));
  assert.equal(candidate.contentHash.length, 64);
  assert.equal(candidate.simulated, true);
  assert.ok(Object.isFrozen(candidate));
  assert.throws(() => {
    (candidate as { simulated: boolean }).simulated = false;
  }, TypeError);

  // Unknown change set / unknown parent are typed refusals.
  const unknownChangeSet = service.applyEditChangeSet(SOLUTION, { changeSetId: "you_edit-change-set_missing", parentVersionId: subjectId });
  assert.ok(!unknownChangeSet.ok);
  assert.equal(unknownChangeSet.error.details["reason"], "unknown-change-set");

  const unknownParent = service.applyEditChangeSet(SOLUTION, { changeSetId, parentVersionId: "you_editing-subject_missing" });
  assert.ok(!unknownParent.ok);
  assert.equal(unknownParent.error.code, "YOU_INVALID_STATE");
  assert.equal(unknownParent.error.details["reason"], "unknown-parent-version");

  const lineage = service.candidatesOfParent(SOLUTION, subjectId);
  assert.ok(lineage.ok);
  assert.equal(lineage.value.length, 1);
  assert.equal(lineage.value[0]?.id, candidate.id);

  const unknownLineageParent = service.candidatesOfParent(SOLUTION, "you_editing-subject_missing");
  assert.ok(!unknownLineageParent.ok);
  assert.equal(unknownLineageParent.error.details["reason"], "unknown-parent-version");

  assert.ok(service.candidateVersionOf(SOLUTION, candidate.id).ok);
  const unknownCandidate = service.candidateVersionOf(SOLUTION, "you_candidate-version_missing");
  assert.ok(!unknownCandidate.ok);
  assert.equal(unknownCandidate.error.details["reason"], "unknown-candidate-version");
});

test("apply-time payload binding verification refuses unresolved refs and hash mismatches", () => {
  const service = makeService("binding-verification");
  const subjectId = makeSubject(service);
  const sessionId = openSession(service, subjectId);
  const ops = opsFor(service, "binding");

  // A payloadRef that does not resolve in the store.
  const unresolved = service.proposeEditChangeSet(SOLUTION, {
    sessionId,
    ops: [{ ...ops[0]!, payloadRef: "you_content_missing", payloadHash: ops[0]!.payloadHash }],
  });
  assert.ok(unresolved.ok);
  const unresolvedApplied = service.applyEditChangeSet(SOLUTION, { changeSetId: unresolved.value.changeSet.id, parentVersionId: subjectId });
  assert.ok(!unresolvedApplied.ok);
  assert.equal(unresolvedApplied.error.code, "YOU_CHANGESET_INVALID");
  assert.equal(unresolvedApplied.error.details["reason"], "payload-unresolved");

  // A payloadHash that does not match the stored bytes.
  const tampered = service.proposeEditChangeSet(SOLUTION, {
    sessionId,
    ops: [{ ...ops[0]!, payloadHash: "c".repeat(64) }],
  });
  assert.ok(tampered.ok);
  const tamperedApplied = service.applyEditChangeSet(SOLUTION, { changeSetId: tampered.value.changeSet.id, parentVersionId: subjectId });
  assert.ok(!tamperedApplied.ok);
  assert.equal(tamperedApplied.error.code, "YOU_CHANGESET_INVALID");
  assert.equal(tamperedApplied.error.details["reason"], "payload-hash-mismatch");

  // No candidate was produced by the refusals.
  assert.equal(must(service.candidatesOfParent(SOLUTION, subjectId), "candidatesOfParent").length, 0);
});

test("parent -> candidate lineage is queryable in proposal order, with the root-to-leaf ancestry", () => {
  const service = makeService("lineage");
  const subjectId = makeSubject(service);
  const sessionId = openSession(service, subjectId);

  const changeSetId1 = propose(service, sessionId, opsFor(service, "lineage-1"));
  const candidate1 = must(service.applyEditChangeSet(SOLUTION, { changeSetId: changeSetId1, parentVersionId: subjectId }), "apply1").candidate;
  const changeSetId2 = propose(service, sessionId, opsFor(service, "lineage-2"));
  const candidate2 = must(service.applyEditChangeSet(SOLUTION, { changeSetId: changeSetId2, parentVersionId: candidate1.id }), "apply2").candidate;
  const changeSetId3 = propose(service, sessionId, opsFor(service, "lineage-3"));
  const candidate3 = must(service.applyEditChangeSet(SOLUTION, { changeSetId: changeSetId3, parentVersionId: subjectId }), "apply3").candidate;

  // Sibling candidates under the subject root keep proposal order.
  const rootChildren = must(service.candidatesOfParent(SOLUTION, subjectId), "rootChildren");
  assert.deepEqual(
    rootChildren.map((candidate) => candidate.id),
    [candidate1.id, candidate3.id],
  );
  // The deep child hangs off candidate1.
  const deepChildren = must(service.candidatesOfParent(SOLUTION, candidate1.id), "deepChildren");
  assert.deepEqual(
    deepChildren.map((candidate) => candidate.id),
    [candidate2.id],
  );

  // The ancestry walks root -> leaf.
  const ancestry = service.ancestryOfCandidate(SOLUTION, candidate2.id);
  assert.ok(ancestry.ok);
  assert.equal(ancestry.value.subject.id, subjectId);
  assert.deepEqual(
    ancestry.value.candidates.map((candidate) => candidate.id),
    [candidate1.id, candidate2.id],
  );
  assert.notEqual(candidate1.contentHash, candidate2.contentHash);

  const unknownAncestry = service.ancestryOfCandidate(SOLUTION, "you_candidate-version_missing");
  assert.ok(!unknownAncestry.ok);
  assert.equal(unknownAncestry.error.details["reason"], "unknown-candidate-version");
});

test("candidates resolve exactly once (change-accepted / change-rejected) while the session is open", () => {
  const service = makeService("resolution");
  const subjectId = makeSubject(service);
  const sessionId = openSession(service, subjectId);
  const changeSetId = propose(service, sessionId, opsFor(service, "resolve"));
  const candidate = must(service.applyEditChangeSet(SOLUTION, { changeSetId, parentVersionId: subjectId }), "applyResolve").candidate;

  assert.equal(service.resolutionOfCandidate(SOLUTION, candidate.id), null);
  const accepted = service.resolveCandidateVersion(SOLUTION, { candidateId: candidate.id, outcome: "accepted" });
  assert.ok(accepted.ok);
  assert.equal(accepted.value.resolution, "accepted");
  assert.equal(service.resolutionOfCandidate(SOLUTION, candidate.id), "accepted");

  // Exactly once: the second resolution is the typed refusal.
  const again = service.resolveCandidateVersion(SOLUTION, { candidateId: candidate.id, outcome: "rejected" });
  assert.ok(!again.ok);
  assert.equal(again.error.code, "YOU_INVALID_STATE");
  assert.equal(again.error.details["reason"], "candidate-already-resolved");

  // Unknown candidate resolution is a typed refusal.
  const unknown = service.resolveCandidateVersion(SOLUTION, { candidateId: "you_candidate-version_missing", outcome: "accepted" });
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.details["reason"], "unknown-candidate-version");

  // Resolution requires the session to still be open.
  const sessionId2 = openSession(service, subjectId);
  const changeSetId2 = propose(service, sessionId2, opsFor(service, "resolve-2"));
  const candidate2 = must(service.applyEditChangeSet(SOLUTION, { changeSetId: changeSetId2, parentVersionId: subjectId }), "applyResolve2").candidate;
  const abandoned = service.abandonEditingSession(SOLUTION, sessionId2);
  assert.ok(abandoned.ok);
  const late = service.resolveCandidateVersion(SOLUTION, { candidateId: candidate2.id, outcome: "rejected" });
  assert.ok(!late.ok);
  assert.equal(late.error.details["reason"], "session-not-open");
});

// ---------------------------------------------------------------------------
// Import/export flows
// ---------------------------------------------------------------------------

test("deterministic export: byte-identical packages, content-addressed results", () => {
  const service = makeService("export");
  const subjectId = makeSubject(service);
  // The native fixture profile supports every fixture interchange format.
  const sessionId = openSession(service, subjectId, "native");

  const first = service.exportFromSession(SOLUTION, { sessionId, format: "edit-interchange" });
  assert.ok(first.ok);
  assert.equal(first.value.result.status, "succeeded");
  assert.equal(first.value.result.sessionId, sessionId);
  assert.equal(first.value.result.format, "edit-interchange");
  assert.ok(first.value.result.contentRef !== null && first.value.result.contentRef.startsWith("you_content_"));
  assert.equal(first.value.result.contentHash, sha256Hex(first.value.packageBytes));
  assert.ok(Object.isFrozen(first.value.result));

  // Re-export of the same state: byte-identical package, idempotent store.
  const second = service.exportFromSession(SOLUTION, { sessionId, format: "edit-interchange" });
  assert.ok(second.ok);
  assert.deepEqual(first.value.packageBytes, second.value.packageBytes);
  assert.equal(first.value.result.contentHash, second.value.result.contentHash);

  // Every registered format assembles through the same deterministic engine.
  for (const format of ["json", "scene-package"] as const) {
    const exported = service.exportFromSession(SOLUTION, { sessionId, format });
    assert.ok(exported.ok, format);
    assert.equal(exported.value.result.format, format);
  }

  // Terminal sessions cannot export.
  const committed = service.commitEditingSession(SOLUTION, sessionId);
  assert.ok(committed.ok);
  const refused = service.exportFromSession(SOLUTION, { sessionId, format: "json" });
  assert.ok(!refused.ok);
  assert.equal(refused.error.details["reason"], "session-not-open");
});

test("export refusals: unsupported engine format and editor-format mismatch are typed YOU_IMPORT_EXPORT_FAILED", () => {
  const service = makeService("export-refusals");
  const subjectId = makeSubject(service);

  // The embedded fixture profile supports json + edit-interchange, not scene-package.
  const sessionId = openSession(service, subjectId, "embedded");
  const editorFormat = service.exportFromSession(SOLUTION, { sessionId, format: "scene-package" });
  assert.ok(!editorFormat.ok);
  assert.equal(editorFormat.error.code, "YOU_IMPORT_EXPORT_FAILED");
  assert.equal(editorFormat.error.details["reason"], "editor-format-unsupported");

  // No engine support for an arbitrary extension format.
  const unsupported = service.exportFromSession(SOLUTION, { sessionId, format: "glb" });
  assert.ok(!unsupported.ok);
  assert.equal(unsupported.error.code, "YOU_IMPORT_EXPORT_FAILED");
  assert.equal(unsupported.error.details["reason"], "unsupported-format");

  assert.equal(service.importExportResultsOf(SOLUTION).length, 0);
});

test("validated import: round-trip identity, subject binding and the null-session path", () => {
  const service = makeService("import");
  const subjectId = makeSubject(service);
  const sessionId = openSession(service, subjectId);

  const exported = service.exportFromSession(SOLUTION, { sessionId, format: "edit-interchange" });
  assert.ok(exported.ok);

  const imported = service.importEditPackage(SOLUTION, { sessionId, format: "edit-interchange", packageBytes: exported.value.packageBytes });
  assert.ok(imported.ok);
  assert.equal(imported.value.result.status, "succeeded");
  assert.equal(imported.value.result.sessionId, sessionId);
  // Round-trip identity: the imported package is the exported package.
  assert.equal(imported.value.result.contentHash, exported.value.result.contentHash);

  // A session-less import records the null session binding.
  const sessionless = service.importEditPackage(SOLUTION, { sessionId: null, format: "edit-interchange", packageBytes: exported.value.packageBytes });
  assert.ok(sessionless.ok);
  assert.equal(sessionless.value.result.sessionId, null);

  // Importing a package that addresses a DIFFERENT subject is a typed refusal.
  const otherSubjectId = makeSubject(service);
  const otherSessionId = openSession(service, otherSubjectId);
  const crossSubject = service.importEditPackage(SOLUTION, { sessionId: otherSessionId, format: "edit-interchange", packageBytes: exported.value.packageBytes });
  assert.ok(!crossSubject.ok);
  assert.equal(crossSubject.error.code, "YOU_IMPORT_EXPORT_FAILED");
  assert.equal(crossSubject.error.details["reason"], "subject-mismatch");
  const crossResultId = String(crossSubject.error.details["resultId"] ?? "");
  assert.notEqual(crossResultId, "");
  const crossRecord = service.importExportResultOf(SOLUTION, crossResultId);
  assert.ok(crossRecord.ok);
  assert.equal(crossRecord.value.result.status, "failed");
  assert.equal(crossRecord.value.result.contentRef, null);
});

test("invalid payloads record the honest failed result and surface typed YOU_IMPORT_EXPORT_FAILED", () => {
  const service = makeService("invalid-import");
  const subjectId = makeSubject(service);
  // The native fixture profile supports the json interchange format.
  const sessionId = openSession(service, subjectId, "native");
  const exported = service.exportFromSession(SOLUTION, { sessionId, format: "json" });
  assert.ok(exported.ok);

  // Tampered content (same length, different bytes): hash mismatch.
  const tamperedDocument = JSON.parse(new TextDecoder().decode(exported.value.packageBytes)) as Record<string, unknown>;
  const section = tamperedDocument["content"] as Record<string, unknown>;
  const junk = new Uint8Array(128);
  junk[0] = 0xab;
  section["contentBase64"] = Buffer.from(junk).toString("base64");
  const tamperedBytes = new TextEncoder().encode(JSON.stringify(tamperedDocument));
  const tamperedImport = service.importEditPackage(SOLUTION, { sessionId, format: "json", packageBytes: tamperedBytes });
  assert.ok(!tamperedImport.ok);
  assert.equal(tamperedImport.error.code, "YOU_IMPORT_EXPORT_FAILED");
  assert.equal(tamperedImport.error.details["reason"], "content-hash-mismatch");

  // Not JSON at all.
  const junkImport = service.importEditPackage(SOLUTION, { sessionId, format: "json", packageBytes: new TextEncoder().encode("junk") });
  assert.ok(!junkImport.ok);
  assert.equal(junkImport.error.code, "YOU_IMPORT_EXPORT_FAILED");
  assert.equal(junkImport.error.details["reason"], "invalid-json");

  // Unsupported import format (intake-level refusal: no record, W4A precedent).
  const unsupported = service.importEditPackage(SOLUTION, { sessionId, format: "fbx", packageBytes: exported.value.packageBytes });
  assert.ok(!unsupported.ok);
  assert.equal(unsupported.error.details["reason"], "unsupported-format");

  // Every invalid-PAYLOAD refusal recorded an honest failed result (queryable, journaled).
  const results = service.importExportResultsOf(SOLUTION);
  const failed = results.filter((result) => result.status === "failed");
  assert.equal(failed.length, 2);
  assert.equal(results.length, 3);
  for (const result of failed) {
    assert.equal(result.contentRef, null);
    assert.equal(result.contentHash, null);
    assert.equal(result.simulated, true);
    assert.ok(service.importExportResultOf(SOLUTION, result.id).ok);
  }
  const unknownResult = service.importExportResultOf(SOLUTION, "you_import-export_missing");
  assert.ok(!unknownResult.ok);
  assert.equal(unknownResult.error.details["reason"], "unknown-import-export-result");
});

// ---------------------------------------------------------------------------
// Ledger integration + projection/replay equivalence
// ---------------------------------------------------------------------------

test("the ledger journals the full editing lifecycle; the live projection equals the replay fold", () => {
  const service = makeService("ledger");
  const subjectId = makeSubject(service);
  const sessionId = openSession(service, subjectId);
  const changeSetId = propose(service, sessionId, opsFor(service, "ledger-1"));
  const candidate1 = must(service.applyEditChangeSet(SOLUTION, { changeSetId, parentVersionId: subjectId }), "applyLedger1").candidate;
  const exported = service.exportFromSession(SOLUTION, { sessionId, format: "edit-interchange" });
  assert.ok(exported.ok);
  const imported = service.importEditPackage(SOLUTION, { sessionId, format: "edit-interchange", packageBytes: exported.value.packageBytes });
  assert.ok(imported.ok);
  const changeSetId2 = propose(service, sessionId, opsFor(service, "ledger-2"));
  const candidate2 = must(service.applyEditChangeSet(SOLUTION, { changeSetId: changeSetId2, parentVersionId: candidate1.id }), "applyLedger2").candidate;
  assert.ok(service.resolveCandidateVersion(SOLUTION, { candidateId: candidate2.id, outcome: "accepted" }).ok);
  assert.ok(service.commitEditingSession(SOLUTION, sessionId).ok);

  const events = must(service.ledgerEventsOf(SOLUTION), "ledgerEventsOf");
  assert.deepEqual(
    events.map((event) => event.type),
    [
      "edit-session-opened",
      "change-proposed",
      "change-set-applied",
      "candidate-version-proposed",
      "import-export-completed",
      "import-export-completed",
      "change-proposed",
      "change-set-applied",
      "candidate-version-proposed",
      "change-accepted",
      "edit-session-closed",
    ],
  );

  // Append-only: the ledger never rewrites or removes entries.
  const serialized = must(service.serializeLedgerOf(SOLUTION), "serializeLedgerOf");
  assert.ok(serialized.length > 0);
  const replayedOnce = must(service.ledgerEventsOf(SOLUTION), "ledgerEventsOf2");
  assert.equal(serialized, stableStringify(replayedOnce));

  // Projection == replay (FIXTURES.md law 10).
  const projection = must(service.projectionOf(SOLUTION), "projectionOf");
  const replayed = EditingService.replay(events);
  assert.equal(stableStringify(projection), stableStringify(replayed));

  // The replayed projection carries the session status, the ops, the lineage and the resolutions.
  assert.equal(replayed.editingSessions[sessionId]?.status, "committed");
  assert.equal(replayed.changeSets[changeSetId]?.ops.length, 2);
  assert.deepEqual(replayed.candidateIdsByParent[subjectId], [candidate1.id]);
  assert.deepEqual(replayed.candidateIdsByParent[candidate1.id], [candidate2.id]);
  assert.equal(replayed.candidateResolutions[candidate2.id], "accepted");
  assert.equal(replayed.importExports[exported.value.result.id]?.direction, "export");
  assert.equal(replayed.importExports[imported.value.result.id]?.direction, "import");

  // Deterministic ledger hash.
  assert.equal(must(service.ledgerHashOf(SOLUTION), "ledgerHash1"), must(service.ledgerHashOf(SOLUTION), "ledgerHash2"));
});

test("the full service is deterministic: same seed => byte-identical ledgers and records", () => {
  const run = (seed: string) => {
    const service = makeService(seed);
    const subjectId = makeSubject(service);
    const sessionId = openSession(service, subjectId);
    const changeSetId = propose(service, sessionId, opsFor(service, "determinism"));
    const candidate = must(service.applyEditChangeSet(SOLUTION, { changeSetId, parentVersionId: subjectId }), "apply").candidate;
    const session: EditingSession = must(service.editingSessionOf(SOLUTION, sessionId), "editingSessionOf").session;
    return {
      subjectId,
      sessionId,
      changeSetId,
      candidateId: candidate.id,
      candidateHash: candidate.contentHash,
      ledgerHash: must(service.ledgerHashOf(SOLUTION), "ledgerHash"),
      openedAt: session.openedAt,
    };
  };
  const first = run("determinism-seed");
  const second = run("determinism-seed");
  assert.deepEqual(first, second);

  const other = run("determinism-seed-alt");
  assert.notEqual(first.ledgerHash, other.ledgerHash);
  assert.notEqual(first.candidateId, other.candidateId);
});
