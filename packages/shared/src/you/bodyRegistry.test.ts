import assert from "node:assert/strict";
import test from "node:test";
import type { AgentBody } from "./contract.js";
import { createFixtureEvidenceContentStore, sha256Hex } from "./evidenceStore.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import {
  addressAgentBodyAppearance,
  constructAgentBody,
  sortAgentBodies,
  validateAgentBodyInput,
  verifyAgentBodyIntegrity,
  type AgentBodyInput,
} from "./bodyRegistry.js";

const APPEARANCE_SPEC = {
  silhouette: "neutral-humanoid",
  palette: ["#23313d", "#31465a"],
  restingPose: "station-standby",
};

const VALID: AgentBodyInput = {
  role: "research-companion",
  appearance: { spec: APPEARANCE_SPEC },
  capabilities: ["conversation", "screen-reading", "tool-invocation"],
  tools: ["you_tool_web_search", "you_tool_file_read"],
  policyRefs: ["you_policy_embodiment_default"],
  memoryContractRef: "you_memory_contract_session_scoped",
  evaluatorContractRef: "you_evaluator_contract_w7a",
};

function depsFor(seed: number) {
  return { ids: createRngIdFactory(createDeterministicRng(seed)), store: createFixtureEvidenceContentStore() };
}

test("the stateless validator accepts a sound body intake", () => {
  assert.equal(validateAgentBodyInput(VALID), null);
  assert.equal(validateAgentBodyInput({ ...VALID, appearance: null }), null);
  assert.equal(validateAgentBodyInput({ ...VALID, appearance: undefined }), null);
});

test("the stateless validator refuses each malformed shape with a stable reason", () => {
  const cases: [AgentBodyInput, string][] = [
    [{ ...VALID, role: "" }, "role-empty"],
    [{ ...VALID, role: "  " }, "role-empty"],
    [{ ...VALID, memoryContractRef: "" }, "memory-contract-ref-empty"],
    [{ ...VALID, evaluatorContractRef: "" }, "evaluator-contract-ref-empty"],
    [{ ...VALID, capabilities: ["ok", ""] }, "capability-invalid"],
    [{ ...VALID, tools: ["you_tool_ok", " "] }, "tool-invalid"],
    [{ ...VALID, policyRefs: [""] }, "policy-ref-invalid"],
    [
      { ...VALID, appearance: { contentRef: "you_content_deadbeef", contentHash: "nothex" } },
      "appearance-hash-malformed",
    ],
    [
      { ...VALID, appearance: { contentRef: "", contentHash: "a".repeat(64) } },
      "appearance-ref-malformed",
    ],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateAgentBodyInput(input);
    assert.notEqual(refusal, null, reason);
    assert.equal(refusal?.reason, reason);
    assert.ok(typeof refusal?.detail === "string" && refusal.detail.length > 0);
  }
});

test("construction content-addresses an inline appearance spec through the store", () => {
  const deps = depsFor(11);
  const body = constructAgentBody(VALID, deps);
  assert.equal(body.role, "research-companion");
  assert.notEqual(body.appearanceRef, null);
  assert.notEqual(body.appearanceHash, null);
  assert.match(body.appearanceHash ?? "", /^[0-9a-f]{64}$/);
  assert.equal(body.appearanceRef?.startsWith("you_content_"), true);
  // The stored bytes hash to exactly the recorded content hash.
  const bytes = deps.store.get(body.appearanceRef ?? "");
  assert.notEqual(bytes, null);
  assert.equal(sha256Hex(bytes ?? new Uint8Array()), body.appearanceHash);
  assert.ok(Object.isFrozen(body));
  assert.ok(Object.isFrozen(body.capabilities));
});

test("construction canonicalizes lists (sorted, deduplicated)", () => {
  const body = constructAgentBody(
    {
      ...VALID,
      capabilities: ["tool-invocation", "conversation", "tool-invocation"],
      tools: ["you_tool_file_read", "you_tool_web_search", "you_tool_file_read"],
      policyRefs: ["you_policy_b", "you_policy_a", "you_policy_b"],
    },
    depsFor(12),
  );
  assert.deepEqual(body.capabilities, ["conversation", "tool-invocation"]);
  assert.deepEqual(body.tools, ["you_tool_file_read", "you_tool_web_search"]);
  assert.deepEqual(body.policyRefs, ["you_policy_a", "you_policy_b"]);
});

test("a body with no appearance carries null/null (never an inlined spec)", () => {
  const body = constructAgentBody({ ...VALID, appearance: null }, depsFor(13));
  assert.equal(body.appearanceRef, null);
  assert.equal(body.appearanceHash, null);
});

test("same seed + same intake => byte-identical body", () => {
  const left = constructAgentBody(VALID, depsFor(21));
  const right = constructAgentBody(VALID, depsFor(21));
  assert.equal(stableStringify(left), stableStringify(right));
  assert.equal(left.id, right.id);
});

test("pre-addressed appearance resolves when the store holds matching bytes", () => {
  const deps = depsFor(31);
  const addressed = addressAgentBodyAppearance({ spec: APPEARANCE_SPEC }, deps.store);
  assert.ok(!("refusal" in addressed));
  const prebuilt = addressAgentBodyAppearance(
    { contentRef: addressed.appearanceRef ?? "", contentHash: addressed.appearanceHash ?? "" },
    deps.store,
  );
  assert.ok(!("refusal" in prebuilt));
  assert.deepEqual(prebuilt, addressed);
});

test("pre-addressed appearance refuses unresolved refs and hash mismatches (never a silent repair)", () => {
  const deps = depsFor(32);
  const unresolved = addressAgentBodyAppearance({ contentRef: "you_content_missing", contentHash: "a".repeat(64) }, deps.store);
  assert.ok("refusal" in unresolved);
  assert.equal(unresolved.refusal.reason, "appearance-ref-unresolved");

  const addressed = addressAgentBodyAppearance({ spec: APPEARANCE_SPEC }, deps.store);
  assert.ok(!("refusal" in addressed));
  const mismatch = addressAgentBodyAppearance(
    { contentRef: addressed.appearanceRef ?? "", contentHash: "b".repeat(64) },
    deps.store,
  );
  assert.ok("refusal" in mismatch);
  assert.equal(mismatch.refusal.reason, "appearance-hash-mismatch");
});

test("construction refuses unvalidated or unresolvable intake (programmer error)", () => {
  assert.throws(() => constructAgentBody({ ...VALID, role: "" }, depsFor(41)), /role-empty/);
  const deps = depsFor(42);
  assert.throws(
    () =>
      constructAgentBody(
        { ...VALID, appearance: { contentRef: "you_content_missing", contentHash: "a".repeat(64) } },
        deps,
      ),
    /appearance-ref-unresolved/,
  );
});

test("verifyAgentBodyIntegrity accepts canonical bodies and refuses corruption", () => {
  const body = constructAgentBody(VALID, depsFor(51));
  assert.equal(verifyAgentBodyIntegrity(body), null);

  const corrupted: AgentBody = { ...body, appearanceRef: body.appearanceRef, appearanceHash: null };
  assert.equal(verifyAgentBodyIntegrity(corrupted), "appearance-pair-inconsistent");

  const halfNull: AgentBody = { ...body, appearanceRef: null, appearanceHash: body.appearanceHash };
  assert.equal(verifyAgentBodyIntegrity(halfNull), "appearance-pair-inconsistent");

  const badHash: AgentBody = { ...body, appearanceHash: "nothex" };
  assert.equal(verifyAgentBodyIntegrity(badHash), "appearance-hash-malformed");

  const emptyRole: AgentBody = { ...body, role: " " };
  assert.equal(verifyAgentBodyIntegrity(emptyRole), "role-empty");

  const emptyMemory: AgentBody = { ...body, memoryContractRef: "" };
  assert.equal(verifyAgentBodyIntegrity(emptyMemory), "memory-contract-ref-empty");

  const emptyEvaluator: AgentBody = { ...body, evaluatorContractRef: "" };
  assert.equal(verifyAgentBodyIntegrity(emptyEvaluator), "evaluator-contract-ref-empty");

  const unsorted: AgentBody = { ...body, capabilities: ["zzz", "aaa"] };
  assert.equal(verifyAgentBodyIntegrity(unsorted), "lists-not-canonical");

  const emptyEntry: AgentBody = { ...body, policyRefs: [""] };
  assert.equal(verifyAgentBodyIntegrity(emptyEntry), "list-entry-empty");

  const badId: AgentBody = { ...body, id: "" };
  assert.equal(verifyAgentBodyIntegrity(badId), "body-id-malformed");
});

test("sortAgentBodies orders by id", () => {
  const deps = depsFor(61);
  const first = constructAgentBody(VALID, deps);
  const second = constructAgentBody({ ...VALID, role: "operations-monitor" }, { ...deps, ids: createRngIdFactory(createDeterministicRng(62)) });
  const sorted = sortAgentBodies([second, first]);
  assert.deepEqual(sorted.map((body) => body.id), [first.id, second.id].sort());
});
