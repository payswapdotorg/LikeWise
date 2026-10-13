import assert from "node:assert/strict";
import test from "node:test";
import type { ArenaProviderDescriptor, CapabilityGapCategory } from "./contract.js";
import { ARENA_MOCK_EXPERT_RESULTS, ARENA_FIXTURE_DELIVERED_AT } from "./gap.js";
import { createDeterministicClock } from "./clock.js";
import { createFixtureEvidenceContentStore } from "./evidenceStore.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import {
  constructArenaProviderDescriptor,
  createFixtureArenaClient,
  sortArenaProviderDescriptors,
  validateArenaProviderInput,
  type ArenaInvocation,
  type ArenaProviderLookup,
} from "./arenaClient.js";

const DEPS = {
  clock: createDeterministicClock(),
  ids: createRngIdFactory(createDeterministicRng(8808)),
  store: createFixtureEvidenceContentStore(),
};

const TOOL_GAP_PROVIDER_INPUT = {
  providerKind: "synthetic-arena-fixture",
  capabilityClasses: ["TOOL_GAP", "EDITOR_GAP"],
  endpointRef: null,
};

function toolProvider(): ArenaProviderDescriptor {
  const result = constructArenaProviderDescriptor(TOOL_GAP_PROVIDER_INPUT, { nextId: DEPS.ids.next });
  assert.ok(result.ok);
  return result.ok ? result.descriptor : (undefined as never);
}

function lookupWith(descriptors: readonly ArenaProviderDescriptor[]): ArenaProviderLookup {
  const map = new Map(descriptors.map((descriptor) => [descriptor.id, descriptor]));
  return { descriptorOf: (providerId: string): ArenaProviderDescriptor | null => map.get(providerId) ?? null };
}

function invocation(providerId: string, category: CapabilityGapCategory = "TOOL_GAP"): ArenaInvocation {
  return {
    providerId,
    escalationId: "you_escalation_0000000000000001",
    gapId: "you_gap_0000000000000001",
    category,
    minimumContext: ["intent-reference", "capability-gap-record"],
  };
}

test("the stateless provider validator refuses malformed intake with stable reasons", () => {
  const cases: readonly [Record<string, unknown>, string][] = [
    [{ ...TOOL_GAP_PROVIDER_INPUT, providerKind: "" }, "provider-kind-empty"],
    [{ ...TOOL_GAP_PROVIDER_INPUT, providerKind: "  " }, "provider-kind-empty"],
    [{ ...TOOL_GAP_PROVIDER_INPUT, capabilityClasses: [] }, "capability-classes-empty"],
    [{ ...TOOL_GAP_PROVIDER_INPUT, capabilityClasses: ["TOOL_GAP", ""] }, "capability-class-invalid"],
    [{ ...TOOL_GAP_PROVIDER_INPUT, capabilityClasses: ["TOOL_GAP", "TOOL_GAP"] }, "capability-class-duplicate"],
    [{ ...TOOL_GAP_PROVIDER_INPUT, endpointRef: "" }, "endpoint-ref-invalid"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateArenaProviderInput(input as typeof TOOL_GAP_PROVIDER_INPUT);
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  assert.equal(validateArenaProviderInput(TOOL_GAP_PROVIDER_INPUT), null);
});

test("constructArenaProviderDescriptor canonicalizes capability classes and freezes", () => {
  const descriptor = toolProvider();
  assert.equal(descriptor.providerKind, "synthetic-arena-fixture");
  assert.deepEqual(descriptor.capabilityClasses, ["EDITOR_GAP", "TOOL_GAP"]);
  assert.equal(descriptor.endpointRef, null);
  assert.match(descriptor.id, /^you_arena-provider_[0-9a-f]{16}$/);
  assert.ok(Object.isFrozen(descriptor));
  assert.ok(Object.isFrozen(descriptor.capabilityClasses));
});

test("sortArenaProviderDescriptors orders by id (stable ordering)", () => {
  const a = { ...toolProvider(), id: "you_arena-provider_000000000000000a" };
  const b = { ...toolProvider(), id: "you_arena-provider_000000000000000b" };
  assert.deepEqual(sortArenaProviderDescriptors([b, a]).map((descriptor) => descriptor.id), [
    "you_arena-provider_000000000000000a",
    "you_arena-provider_000000000000000b",
  ]);
});

test("the fixture client delivers the frozen v1 mock result, content-addressed and simulated", () => {
  const provider = toolProvider();
  const client = createFixtureArenaClient(lookupWith([provider]), DEPS);
  const result = client.invoke(invocation(provider.id));
  assert.ok(result.ok);
  if (!result.ok) {
    return;
  }
  const delivery = result.delivery;
  assert.equal(delivery.providerId, provider.id);
  assert.equal(delivery.escalationId, "you_escalation_0000000000000001");
  assert.deepEqual(delivery.expertResult, ARENA_MOCK_EXPERT_RESULTS.TOOL_GAP);
  assert.equal(delivery.expertResult.deliveredAt, ARENA_FIXTURE_DELIVERED_AT);
  assert.equal(delivery.simulated, true);
  // Content addressing: the stored bytes hash to the recorded binding.
  assert.match(delivery.contentHash, /^[0-9a-f]{64}$/);
  const stored = DEPS.store.get(delivery.contentRef);
  assert.ok(stored !== null);
  assert.equal(stableStringify(JSON.parse(new TextDecoder().decode(stored))), stableStringify(delivery.expertResult));
  // The envelope timestamp comes from the injected clock.
  assert.equal(delivery.deliveredAt, "2026-01-01T00:00:00.000Z");
});

test("the fixture client is deterministic: same invocation, same delivery", () => {
  const provider = toolProvider();
  const first = createFixtureArenaClient(lookupWith([provider]), {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(1)),
    store: createFixtureEvidenceContentStore(),
  });
  const second = createFixtureArenaClient(lookupWith([provider]), {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(1)),
    store: createFixtureEvidenceContentStore(),
  });
  const a = first.invoke(invocation(provider.id));
  const b = second.invoke(invocation(provider.id));
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) {
    return;
  }
  assert.equal(stableStringify(a.delivery), stableStringify(b.delivery));
});

test("fail-closed: an unknown provider refuses with typed YOU_ARENA_ADAPTER_UNSUPPORTED", () => {
  const provider = toolProvider();
  const client = createFixtureArenaClient(lookupWith([provider]), DEPS);
  const refused = client.invoke(invocation("you_arena-provider_missing0000000"));
  assert.ok(!refused.ok);
  if (refused.ok) {
    return;
  }
  assert.equal(refused.error.code, "YOU_ARENA_ADAPTER_UNSUPPORTED");
  assert.equal(refused.error.details["reason"], "provider-unknown");
  assert.equal(refused.error.details["providerId"], "you_arena-provider_missing0000000");
  assert.equal(refused.error.simulated, true);
});

test("fail-closed: a capability mismatch refuses with the same typed code", () => {
  const provider = toolProvider();
  const client = createFixtureArenaClient(lookupWith([provider]), DEPS);
  const refused = client.invoke(invocation(provider.id, "KNOWLEDGE_GAP"));
  assert.ok(!refused.ok);
  if (refused.ok) {
    return;
  }
  assert.equal(refused.error.code, "YOU_ARENA_ADAPTER_UNSUPPORTED");
  assert.equal(refused.error.details["reason"], "provider-capability-mismatch");
});

test("fail-closed: a category with no fixture result refuses (never a silent fallback)", () => {
  // A provider that claims every category but the fixture table covers all
  // seven v1 categories — the guard fires only if the table ever narrows;
  // exercise it through a hand-built table-less lookup instead.
  const provider = toolProvider();
  const client = createFixtureArenaClient(lookupWith([provider]), DEPS);
  const refused = client.invoke(invocation(provider.id, "EDITOR_GAP"));
  assert.ok(refused.ok); // EDITOR_GAP has a fixture result in the frozen v1 table.
  const emptyLookup: ArenaProviderLookup = { descriptorOf: () => null };
  const closed = createFixtureArenaClient(emptyLookup, DEPS);
  const unknown = closed.invoke(invocation(provider.id));
  assert.ok(!unknown.ok);
  if (unknown.ok) {
    return;
  }
  assert.equal(unknown.error.code, "YOU_ARENA_ADAPTER_UNSUPPORTED");
  assert.equal(unknown.error.details["reason"], "provider-unknown");
});
