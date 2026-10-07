import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { SolutionIdentity, SolutionMessage, SolutionRuntimeEvent } from "./contract.js";
import { buildFixtureSnapshot, listFixtureRegions } from "./fixture.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableEquals } from "./serialize.js";
import { SolutionProtocolRuntime } from "./protocol.js";
import { applyPatchOperations, SolutionVersionChain } from "./versioning.js";

const SOLUTION: SolutionIdentity = {
  id: "you_solution_protocol1",
  workspaceIdentity: "ws-protocol",
  displayName: "Protocol Test",
};

function makeRuntime(): {
  runtime: SolutionProtocolRuntime;
  ready: SolutionMessage;
  versions: () => readonly import("./contract.js").SolutionVersion[];
  rootId: string;
} {
  const deps = {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(31)),
  };
  const created = SolutionVersionChain.createRoot({
    solution: SOLUTION,
    snapshot: buildFixtureSnapshot("protocol-test"),
    provenanceSource: "fixture:protocol-test",
    deps,
  });
  const opened = SolutionProtocolRuntime.open({
    solution: SOLUTION,
    versionResolver: (versionId) => created.chain.get(versionId),
    initialVersionId: created.root.id,
    deps,
  });
  return { runtime: opened.runtime, ready: opened.ready, versions: () => created.chain.versions(), rootId: created.root.id };
}

function send(runtime: SolutionProtocolRuntime, command: import("./contract.js").SolutionHostCommand): readonly SolutionMessage[] {
  return runtime.handleHostMessage(runtime.buildHostMessage(command));
}

function singleEvent(messages: readonly SolutionMessage[]): SolutionRuntimeEvent {
  assert.equal(messages.length, 1);
  const message = messages[0];
  assert.ok(message !== undefined);
  assert.equal(message.direction, "solution-to-host");
  return message.event;
}

test("open emits a typed, envelope-carrying ready event", () => {
  const { ready } = makeRuntime();
  assert.equal(ready.direction, "solution-to-host");
  assert.equal(ready.protocolVersion, "you-solution/1");
  assert.equal(ready.solutionId, SOLUTION.id);
  assert.equal(ready.workspaceIdentity, "ws-protocol");
  assert.equal(ready.correlationId, null);
  assert.deepEqual(ready.event, { type: "ready" });
  assert.match(ready.timestamp ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("load_version (known) -> rendered with drawn frame stats", () => {
  const { runtime, rootId } = makeRuntime();
  const responses = send(runtime, { type: "load_version", versionId: rootId });
  assert.deepEqual(singleEvent(responses).type === "rendered" ? singleEvent(responses) : null, {
    type: "rendered",
    frameStats: { drawn: true },
  });
  assert.equal(runtime.runtimeState().currentVersionId, rootId);
});

test("load_version (unknown) -> typed runtime_error YOU_VERSION_NOT_FOUND", () => {
  const { runtime } = makeRuntime();
  const responses = send(runtime, { type: "load_version", versionId: "you_version_missing01" });
  const event = singleEvent(responses);
  assert.equal(event.type, "runtime_error");
  if (event.type === "runtime_error") {
    assert.equal(event.error.code, "YOU_VERSION_NOT_FOUND");
    assert.equal(event.error.simulated, true);
    assert.deepEqual(event.error.details, { versionId: "you_version_missing01" });
  }
});

test("responses always correlate to the request message id", () => {
  const { runtime, rootId } = makeRuntime();
  const request = runtime.buildHostMessage({ type: "load_version", versionId: rootId });
  const [response] = runtime.handleHostMessage(request);
  assert.ok(response !== undefined);
  assert.equal(response.correlationId, request.messageId);
  assert.equal(response.protocolVersion, "you-solution/1");
});

test("set_selection round-trips entity, region, quality and null selectors", () => {
  const { runtime, rootId, versions } = makeRuntime();
  const root = versions().find((version) => version.id === rootId);
  assert.ok(root !== undefined);
  const human = root.state.entities.find((entity) => entity.kind === "synthetic-human");
  assert.ok(human !== undefined);
  const region = listFixtureRegions(root.state)[0];
  assert.ok(region !== undefined);

  const entityResponse = singleEvent(send(runtime, { type: "set_selection", selection: { kind: "entity", entityId: human.id } }));
  assert.deepEqual(entityResponse, { type: "selection_changed", selection: { kind: "entity", entityId: human.id } });

  const regionResponse = singleEvent(
    send(runtime, { type: "set_selection", selection: { kind: "region", regionId: region.regionId } }),
  );
  assert.equal(regionResponse.type, "selection_changed");

  const qualityResponse = singleEvent(
    send(runtime, { type: "set_selection", selection: { kind: "quality", deficiencyClass: "geometry" } }),
  );
  assert.equal(qualityResponse.type, "selection_changed");

  const nullResponse = singleEvent(send(runtime, { type: "set_selection", selection: null }));
  assert.deepEqual(nullResponse, { type: "selection_changed", selection: null });
  assert.equal(runtime.runtimeState().selection, null);
});

test("set_selection with an unknown target -> runtime_error YOU_PROTOCOL_VIOLATION", () => {
  const { runtime } = makeRuntime();
  const event = singleEvent(send(runtime, { type: "set_selection", selection: { kind: "entity", entityId: "you_entity_missing01" } }));
  assert.equal(event.type, "runtime_error");
  if (event.type === "runtime_error") {
    assert.equal(event.error.code, "YOU_PROTOCOL_VIOLATION");
    assert.equal(event.error.details.reason, "unknown-selector-target");
  }
});

test("set_compare_version: known -> rendered, unknown -> YOU_VERSION_NOT_FOUND, null clears", () => {
  const { runtime, rootId } = makeRuntime();
  assert.equal(singleEvent(send(runtime, { type: "set_compare_version", versionId: rootId })).type, "rendered");
  assert.equal(runtime.runtimeState().compareVersionId, rootId);
  const unknown = singleEvent(send(runtime, { type: "set_compare_version", versionId: "you_version_missing01" }));
  assert.equal(unknown.type, "runtime_error");
  if (unknown.type === "runtime_error") {
    assert.equal(unknown.error.code, "YOU_VERSION_NOT_FOUND");
  }
  assert.equal(singleEvent(send(runtime, { type: "set_compare_version", versionId: null })).type, "rendered");
  assert.equal(runtime.runtimeState().compareVersionId, null);
});

test("patch_projection on the current base -> change_proposed with overlay visible", () => {
  const { runtime, rootId, versions } = makeRuntime();
  const root = versions().find((version) => version.id === rootId);
  assert.ok(root !== undefined);
  const patch = {
    baseVersionId: rootId,
    operations: [{ op: "adjust_quality" as const, deficiencyClass: "geometry", delta: 0.15 }],
  };
  const proposed = singleEvent(send(runtime, { type: "patch_projection", patch }));
  assert.equal(proposed.type, "change_proposed");
  if (proposed.type === "change_proposed") {
    assert.match(proposed.changeSetId, /^you_changeset_[0-9a-f]{16}$/);
  }
  const expected = applyPatchOperations(root.state, patch.operations);
  assert.ok(stableEquals(runtime.projectionState(), expected));
  assert.deepEqual(runtime.pendingProjectionPatch(), patch);

  const snapshotResponse = singleEvent(send(runtime, { type: "request_snapshot", purpose: "agent-observation" }));
  assert.equal(snapshotResponse.type, "snapshot_ready");
  if (snapshotResponse.type === "snapshot_ready") {
    const snapshot = runtime.getSnapshot(snapshotResponse.snapshotId);
    assert.ok(snapshot !== null);
    assert.equal(snapshot.purpose, "agent-observation");
    assert.ok(stableEquals(snapshot.state, expected));
  }
});

test("patch_projection with a stale base -> runtime_error YOU_INVALID_STATE", () => {
  const { runtime } = makeRuntime();
  const event = singleEvent(
    send(runtime, {
      type: "patch_projection",
      patch: { baseVersionId: "you_version_stale00001", operations: [{ op: "adjust_quality", deficiencyClass: "geometry", delta: 0.1 }] },
    }),
  );
  assert.equal(event.type, "runtime_error");
  if (event.type === "runtime_error") {
    assert.equal(event.error.code, "YOU_INVALID_STATE");
    assert.equal(event.error.details.reason, "stale-base-version");
  }
});

test("patch_projection with an invalid operation -> runtime_error YOU_PROTOCOL_VIOLATION", () => {
  const { runtime, rootId } = makeRuntime();
  const event = singleEvent(
    send(runtime, {
      type: "patch_projection",
      patch: { baseVersionId: rootId, operations: [{ op: "remove_entity", entityId: "you_entity_missing01" }] },
    }),
  );
  assert.equal(event.type, "runtime_error");
  if (event.type === "runtime_error") {
    assert.equal(event.error.code, "YOU_PROTOCOL_VIOLATION");
    assert.equal(event.error.details.reason, "invalid-operation");
  }
});

test("request_focus: valid selector -> rendered; unknown -> YOU_PROTOCOL_VIOLATION", () => {
  const { runtime, rootId, versions } = makeRuntime();
  const root = versions().find((version) => version.id === rootId);
  assert.ok(root !== undefined);
  const human = root.state.entities.find((entity) => entity.kind === "synthetic-human");
  assert.ok(human !== undefined);
  assert.equal(
    singleEvent(send(runtime, { type: "request_focus", selector: { kind: "entity", entityId: human.id } })).type,
    "rendered",
  );
  const bad = singleEvent(send(runtime, { type: "request_focus", selector: { kind: "region", regionId: "nope::head" } }));
  assert.equal(bad.type, "runtime_error");
});

test("request_upload echoes the artifact id; empty id is rejected", () => {
  const { runtime } = makeRuntime();
  const echoed = singleEvent(send(runtime, { type: "request_upload", artifactId: "you_artifact_abc12345" }));
  assert.deepEqual(echoed, { type: "upload_requested", artifactId: "you_artifact_abc12345" });
  const empty = singleEvent(send(runtime, { type: "request_upload", artifactId: "" }));
  assert.equal(empty.type, "runtime_error");
});

test("dispose emits nothing and poisons further commands with YOU_INVALID_STATE", () => {
  const { runtime, rootId } = makeRuntime();
  assert.deepEqual(send(runtime, { type: "dispose" }), []);
  const event = singleEvent(send(runtime, { type: "load_version", versionId: rootId }));
  assert.equal(event.type, "runtime_error");
  if (event.type === "runtime_error") {
    assert.equal(event.error.code, "YOU_INVALID_STATE");
    assert.equal(event.error.details.reason, "runtime-disposed");
  }
});

test("envelope violations produce typed YOU_PROTOCOL_VIOLATION errors", () => {
  const { runtime } = makeRuntime();
  const wrongDirection = runtime.notify({ type: "ready" });
  const directionError = singleEvent(runtime.handleHostMessage(wrongDirection));
  assert.equal(directionError.type, "runtime_error");
  if (directionError.type === "runtime_error") {
    assert.equal(directionError.error.code, "YOU_PROTOCOL_VIOLATION");
    assert.equal(directionError.error.details.reason, "wrong-direction");
  }

  const base = runtime.buildHostMessage({ type: "request_snapshot", purpose: "export" });
  const wrongSolution: SolutionMessage = { ...base, solutionId: "you_solution_other0001" };
  const solutionError = singleEvent(runtime.handleHostMessage(wrongSolution));
  assert.equal(solutionError.type, "runtime_error");
  if (solutionError.type === "runtime_error") {
    assert.equal(solutionError.error.code, "YOU_PROTOCOL_VIOLATION");
    assert.equal(solutionError.error.details.reason, "solution-mismatch");
  }

  const wrongVersion = { ...base, protocolVersion: "you-solution/0" } as unknown as SolutionMessage;
  const versionError = singleEvent(runtime.handleHostMessage(wrongVersion));
  assert.equal(versionError.type, "runtime_error");
  if (versionError.type === "runtime_error") {
    assert.equal(versionError.error.code, "YOU_PROTOCOL_VIOLATION");
    assert.equal(versionError.error.details.reason, "protocol-version-mismatch");
  }
});

test("notify wraps service-originated events in solution-to-host envelopes", () => {
  const { runtime } = makeRuntime();
  const message = runtime.notify({ type: "feedback_submitted", feedbackRequestId: "you_feedback_00000001" });
  assert.equal(message.direction, "solution-to-host");
  assert.equal(message.correlationId, null);
  assert.deepEqual(message.event, { type: "feedback_submitted", feedbackRequestId: "you_feedback_00000001" });
});
