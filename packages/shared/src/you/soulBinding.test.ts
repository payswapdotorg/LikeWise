import assert from "node:assert/strict";
import test from "node:test";
import type { SoulBinding } from "./contract.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import {
  canonicalStringList,
  constructSoulBinding,
  isCanonicalList,
  isSoulRoutingProfile,
  sortSoulBindings,
  SOUL_ROUTING_PROFILES,
  validateSoulBindingInput,
  verifySoulBindingIntegrity,
  type SoulBindingInput,
} from "./soulBinding.js";

const VALID: SoulBindingInput = {
  providerKind: "synthetic-llm",
  modelRef: "fixture-loom-1",
  routingProfile: "system-one",
  capabilities: ["streaming", "fast-reply"],
};

function idsFor(seed: number) {
  return createRngIdFactory(createDeterministicRng(seed));
}

test("routing profiles are exactly system-one and system-two", () => {
  assert.deepEqual(SOUL_ROUTING_PROFILES, ["system-one", "system-two"]);
  assert.equal(isSoulRoutingProfile("system-one"), true);
  assert.equal(isSoulRoutingProfile("system-two"), true);
  assert.equal(isSoulRoutingProfile("system-zero"), false);
  assert.equal(isSoulRoutingProfile("gpt-4o"), false);
});

test("the stateless validator accepts a sound provider-neutral binding", () => {
  assert.equal(validateSoulBindingInput(VALID), null);
  assert.equal(validateSoulBindingInput({ ...VALID, capabilities: undefined }), null);
});

test("the stateless validator refuses each malformed shape with a stable reason", () => {
  const cases: [SoulBindingInput, string][] = [
    [{ ...VALID, providerKind: "" }, "provider-kind-empty"],
    [{ ...VALID, providerKind: "   " }, "provider-kind-empty"],
    [{ ...VALID, modelRef: "" }, "model-ref-empty"],
    [{ ...VALID, routingProfile: "system-three" as SoulBindingInput["routingProfile"] }, "routing-profile-invalid"],
    [{ ...VALID, capabilities: ["ok", ""] }, "capability-invalid"],
    [{ ...VALID, capabilities: ["ok", " "] }, "capability-invalid"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateSoulBindingInput(input);
    assert.notEqual(refusal, null, reason);
    assert.equal(refusal?.reason, reason);
    assert.ok(typeof refusal?.detail === "string" && refusal.detail.length > 0);
  }
});

test("construction canonicalizes capabilities (sorted, deduplicated) and freezes the record", () => {
  const binding = constructSoulBinding({ ...VALID, capabilities: ["fast-reply", "streaming", "fast-reply"] }, {
    ids: idsFor(7),
  });
  assert.deepEqual(binding.capabilities, ["fast-reply", "streaming"]);
  assert.ok(Object.isFrozen(binding));
  assert.ok(Object.isFrozen(binding.capabilities));
  assert.equal(binding.id.startsWith("you_soul-binding_"), true);
});

test("construction refuses unvalidated intake (programmer error, never a silent record)", () => {
  assert.throws(() => constructSoulBinding({ ...VALID, providerKind: "" }, { ids: idsFor(1) }), /provider-kind-empty/);
});

test("same seed + same intake => byte-identical binding", () => {
  const left = constructSoulBinding(VALID, { ids: idsFor(42) });
  const right = constructSoulBinding(VALID, { ids: idsFor(42) });
  assert.equal(stableStringify(left), stableStringify(right));
});

test("verifySoulBindingIntegrity accepts canonical bindings and refuses corruption", () => {
  const binding = constructSoulBinding(VALID, { ids: idsFor(3) });
  assert.equal(verifySoulBindingIntegrity(binding), null);

  const unsorted: SoulBinding = {
    ...binding,
    capabilities: ["streaming", "fast-reply"],
  };
  assert.equal(verifySoulBindingIntegrity(unsorted), "capabilities-not-canonical");

  const duplicated: SoulBinding = {
    ...binding,
    capabilities: ["fast-reply", "fast-reply", "streaming"],
  };
  assert.equal(verifySoulBindingIntegrity(duplicated), "capabilities-not-canonical");

  const badProfile: SoulBinding = { ...binding, routingProfile: "system-three" as SoulBinding["routingProfile"] };
  assert.equal(verifySoulBindingIntegrity(badProfile), "routing-profile-invalid");

  const badId: SoulBinding = { ...binding, id: "" };
  assert.equal(verifySoulBindingIntegrity(badId), "binding-id-malformed");
});

test("canonicalStringList / isCanonicalList round-trip", () => {
  assert.deepEqual(canonicalStringList(["b", "a", "b"]), ["a", "b"]);
  assert.deepEqual(canonicalStringList(undefined), []);
  assert.equal(isCanonicalList(["a", "b"]), true);
  assert.equal(isCanonicalList(["b", "a"]), false);
  assert.equal(isCanonicalList(["a", "a"]), false);
});

test("sortSoulBindings orders by id", () => {
  const first = constructSoulBinding(VALID, { ids: idsFor(5) });
  const second = constructSoulBinding({ ...VALID, routingProfile: "system-two" }, { ids: idsFor(6) });
  const sorted = sortSoulBindings([second, first]);
  assert.deepEqual(sorted.map((binding) => binding.id), [first.id, second.id].sort());
});
