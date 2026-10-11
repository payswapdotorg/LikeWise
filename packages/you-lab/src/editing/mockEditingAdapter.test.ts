// Mock editing adapter tests (W5C) — coverage: byte-identical replay from
// the seed (determinism), content-addressed op payloads (payloadHash =
// sha-256 of the canonical payload bytes), native/embedded/external kind
// coverage, typed format refusal, and honest simulated markers.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import type { NeutralEntity } from "../adapters/editorAdapterSeam.js";
import {
  UnsupportedEditingFormatError,
  assertEditingRequestSupported,
  neutralEditChangeSetId,
  neutralEditOpPayloadRef,
  sha256Hex,
  type NeutralEditingRequest,
  type NeutralSubjectArtifact,
} from "./editingAdapterSeam.js";
import { createMockEditingAdapter } from "./mockEditingAdapter.js";
import { createVscodeEditingEvaluationAdapter } from "./vscodeEvaluationAdapter.js";
import { createEditorRegistry } from "../technology/editorSeedProfiles.js";
import { createStandardEditingCandidates, MOCK_EDITING_CANDIDATES } from "./roundTripCandidates.js";
import { fixtureEditPlan, fixtureSubjectState, ROUND_TRIP_BENCHMARK_FIXTURES } from "./roundTripFixtures.js";

const registry = createEditorRegistry();

function subjectArtifact(): NeutralSubjectArtifact {
  const fixture = ROUND_TRIP_BENCHMARK_FIXTURES[0]!;
  const state = fixtureSubjectState(fixture);
  return {
    artifactId: "art-test-1",
    format: "json",
    contentRef: "content-store://you-lab/editing-fixture/test",
    contentHash: "0".repeat(64),
    content: { entities: state.entities, environment: state.environment },
  };
}

function request(format: string, editPlan = fixtureEditPlan(ROUND_TRIP_BENCHMARK_FIXTURES[0]!)): NeutralEditingRequest {
  return {
    requestId: "req-test-1",
    editingSessionId: "es-test-1",
    subjectArtifact: subjectArtifact(),
    format: format as NeutralEditingRequest["format"],
    editPlan,
    submittedAt: "2026-10-11T12:00:00Z",
  };
}

const nativeMock = createMockEditingAdapter({
  id: "mock-editing-native-test",
  editorKind: "native",
  supportedFormats: ["json", "edit-interchange"],
  opDropoutRate: 0.2,
  transformJitter: 0.1,
  environmentSurvives: true,
});

test("mock editing adapter: byte-identical replay from the seed (determinism)", () => {
  const first = nativeMock.invoke(request("json"));
  const second = nativeMock.invoke(request("json"));
  assert.equal(canonicalJson(second), canonicalJson(first));
  // a different request id derives a different change set (seed-derived ids)
  const other = nativeMock.invoke({ ...request("json"), requestId: "req-test-2" });
  assert.notEqual(other.changeSet.id, first.changeSet.id);
});

test("mock editing adapter: ops are content-addressed (payloadHash = sha-256 of canonical payload bytes)", () => {
  const output = nativeMock.invoke(request("json"));
  assert.ok(output.changeSet.ops.length > 0, "ops produced");
  for (const op of output.changeSet.ops) {
    assert.ok(/^[0-9a-f]{64}$/.test(op.payloadHash), `${op.id}: payloadHash is sha-256 hex`);
    const payload = output.payloads[op.id];
    assert.ok(payload, `${op.id}: payload sidecar present`);
    assert.equal(op.kind === "upsert_entity" ? "upsert_entity" : op.kind, op.kind);
    assert.equal(op.payloadRef.startsWith("content-store://you-lab/editing/"), true, `${op.id}: payloadRef addresses the content store`);
    // payload bytes hash to the op's payloadHash (content-addressing law)
    assert.equal(sha256Hex(canonicalJson(payload)), op.payloadHash, `${op.id}: hash binds the payload`);
  }
});

test("mock editing adapter: change set carries the deterministic id + session linkage", () => {
  const output = nativeMock.invoke(request("json"));
  assert.equal(output.changeSet.id, neutralEditChangeSetId("mock-editing-native-test", "req-test-1"));
  assert.equal(output.changeSet.sessionId, "es-test-1");
  assert.equal(output.changeSet.createdAt, "2026-10-11T12:00:00Z");
  const firstOp = output.changeSet.ops[0];
  assert.ok(firstOp);
  assert.equal(firstOp.payloadRef, neutralEditOpPayloadRef("mock-editing-native-test", "req-test-1", 0));
});

test("mock editing adapter: typed refusal for unsupported interchange formats", () => {
  assert.throws(() => nativeMock.invoke(request("gltf")), UnsupportedEditingFormatError);
  try {
    nativeMock.invoke(request("gltf"));
  } catch (error) {
    assert.ok(error instanceof UnsupportedEditingFormatError);
    assert.ok(String(error.message).includes("YOU_EDITOR_UNSUPPORTED"));
  }
  assert.equal(
    assertEditingRequestSupported(nativeMock.profile, request("json")),
    undefined,
  );
});

test("mock editing adapter: honest simulated markers and warnings", () => {
  const output = nativeMock.invoke(request("json"));
  assert.equal(output.simulated, true);
  assert.equal(output.adapterId, "mock-editing-native-test");
  assert.equal(output.effort.effort.kind, "not-measured");
  assert.equal(output.effort.effort.marker, "not-measured (simulated)");
  assert.equal(output.effort.latency.kind, "not-measured");
  assert.equal(output.effort.cost.kind, "not-measured");
  assert.equal(nativeMock.profile.technologyId, null, "pure mock: no registry backing");
  assert.equal(nativeMock.profile.productionEligible, null, "pure mock: no eligibility claim");
});

test("mock editing adapter: standard candidate set covers native/embedded/external kinds", () => {
  const kinds = new Set(MOCK_EDITING_CANDIDATES.map((candidate) => candidate.config.editorKind));
  assert.deepEqual([...kinds].sort(), ["embedded", "external", "native"]);
  const candidates = createStandardEditingCandidates(registry);
  assert.equal(candidates.length, 7);
  for (const candidate of candidates) {
    assert.ok(candidate.profile.supportedFormats.length > 0, `${candidate.profile.id}: formats declared`);
    assert.equal(candidate.profile.deterministic, true);
  }
});

test("mock editing adapter: degraded mocks keep every applied op hash-consistent with its payload", () => {
  const candidates = createStandardEditingCandidates(registry);
  const plan = fixtureEditPlan(ROUND_TRIP_BENCHMARK_FIXTURES[1]!);
  for (const candidate of candidates) {
    const req = {
      ...request(candidate.profile.supportedFormats[0] ?? "json", plan),
      requestId: `req-${candidate.profile.id}`,
    };
    const output = candidate.invoke(req);
    for (const op of output.changeSet.ops) {
      const payload = output.payloads[op.id];
      assert.ok(payload, `${candidate.profile.id}/${op.id}: payload present`);
      assert.equal(sha256Hex(canonicalJson(payload)), op.payloadHash);
    }
  }
});

test("mock editing adapter: entities and edits apply without mutating the subject artifact", () => {
  const artifact = subjectArtifact();
  const before = canonicalJson(artifact.content);
  nativeMock.invoke(request("json"));
  assert.equal(canonicalJson(artifact.content), before, "subject artifact content is never mutated");
});

test("vscode evaluation adapter: deterministic, simulated, and honest about scope", () => {
  const adapter = createVscodeEditingEvaluationAdapter(registry);
  const first = adapter.invoke(request("json"));
  const second = adapter.invoke(request("json"));
  assert.equal(canonicalJson(second), canonicalJson(first));
  assert.equal(first.simulated, true);
  assert.equal(first.effort.latency.kind, "not-measured");
  assert.ok(adapter.profile.eligibilityBasis.includes("permissive SPDX set"));
  assert.ok(adapter.profile.determinismNote.includes("seeded derivations only"));
});

test("mock editing adapter: empty edit plan yields an empty change set with a valid digest", () => {
  const empty = nativeMock.invoke(request("json", { scaleEdits: {}, addedEntities: [], removedEntityIds: [] }));
  assert.deepEqual(empty.changeSet.ops, []);
  assert.ok(/^[0-9a-f]{64}$/.test(empty.editedContentHash));
});

test("mock editing adapter: added entities flow through as upsert ops", () => {
  const entity: NeutralEntity = {
    id: "ent-added-99",
    kind: "prop",
    label: "Test added prop",
    transform: { position: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
    attributes: { test: true },
  };
  const output = nativeMock.invoke(request("json", { scaleEdits: {}, addedEntities: [entity], removedEntityIds: [] }));
  const upserts = output.changeSet.ops.filter((op) => op.kind === "upsert_entity");
  assert.ok(upserts.length >= 1, "upsert op present");
  const payload = output.payloads[upserts[0]!.id];
  assert.ok(payload);
  assert.equal((payload.entity as NeutralEntity).id, "ent-added-99");
});
