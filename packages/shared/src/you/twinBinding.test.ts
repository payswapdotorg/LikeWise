import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceRecord } from "./contract.js";
import { deepFreeze, stableStringify } from "./serialize.js";
import {
  bindingTimeConsentReference,
  constructTwinEvidenceBinding,
  evidenceHashesOfBindings,
  evidenceIdsOfBindings,
  sortTwinEvidenceBindings,
  TWIN_BINDING_PURPOSE,
  verifyTwinEvidenceBinding,
} from "./twinBinding.js";

function recordFor(evidenceId: string, contentHash: string, state: "granted" | "withdrawn" = "granted"): EvidenceRecord {
  return deepFreeze({
    id: evidenceId,
    evidenceRequestId: null,
    captureSessionId: null,
    evidenceType: "fixture",
    modality: "image",
    contentRef: `you_content_${contentHash.slice(0, 16)}`,
    contentHash,
    privacyClass: "sensitive-media",
    retention: { policy: "project-retention", deleteAfter: null, reason: "test" },
    consent: { policyId: `policy-${evidenceId}`, state, learningPermission: false },
    capturedAt: "2026-01-01T00:00:00.000Z",
    provenance: { source: "test", generator: "fixture", createdAt: "2026-01-01T00:00:00.000Z", lineage: [] },
    simulated: true,
  });
}

test("the twin binding purpose is solution-generation", () => {
  assert.equal(TWIN_BINDING_PURPOSE, "solution-generation");
});

test("constructTwinEvidenceBinding records the binding-time live consent state, not the capture snapshot", () => {
  const record = recordFor("you_evidence_e1", "a".repeat(64)); // capture-time state: granted
  const binding = constructTwinEvidenceBinding({ record, liveConsentState: "withdrawn" });
  assert.equal(binding.evidenceId, "you_evidence_e1");
  assert.equal(binding.evidenceContentHash, "a".repeat(64));
  assert.equal(binding.consent.policyId, "policy-you_evidence_e1");
  assert.equal(binding.consent.state, "withdrawn");
  assert.equal(binding.consent.learningPermission, false);
  assert.ok(Object.isFrozen(binding));
  assert.ok(Object.isFrozen(binding.consent));
});

test("bindingTimeConsentReference mirrors the recorded reference shape", () => {
  const record = recordFor("you_evidence_e2", "b".repeat(64));
  const reference = bindingTimeConsentReference(record, "expired");
  assert.deepEqual(stableStringify(reference), stableStringify(constructTwinEvidenceBinding({ record, liveConsentState: "expired" }).consent));
});

test("verifyTwinEvidenceBinding detects id and content-hash mismatches, passes sound bindings", () => {
  const record = recordFor("you_evidence_e3", "c".repeat(64));
  const sound = constructTwinEvidenceBinding({ record, liveConsentState: "granted" });
  assert.equal(verifyTwinEvidenceBinding(sound, record), null);
  const wrongId = { ...sound, evidenceId: "you_evidence_other" };
  assert.match(verifyTwinEvidenceBinding(wrongId, record) ?? "", /but the record is/);
  const wrongHash = { ...sound, evidenceContentHash: "0".repeat(64) };
  assert.match(verifyTwinEvidenceBinding(wrongHash, record) ?? "", /does not match record/);
});

test("binding helpers sort stably and derive deterministic evidence hashes", () => {
  const recordA = recordFor("you_evidence_b", "1".repeat(64));
  const recordC = recordFor("you_evidence_a", "2".repeat(64));
  const bindings = [
    constructTwinEvidenceBinding({ record: recordA, liveConsentState: "granted" }),
    constructTwinEvidenceBinding({ record: recordC, liveConsentState: "granted" }),
  ];
  const sorted = sortTwinEvidenceBindings(bindings);
  assert.deepEqual(
    sorted.map((binding) => binding.evidenceId),
    ["you_evidence_a", "you_evidence_b"],
  );
  assert.deepEqual(evidenceIdsOfBindings(sorted), ["you_evidence_a", "you_evidence_b"]);
  assert.deepEqual(evidenceHashesOfBindings(sorted), ["2".repeat(64), "1".repeat(64)]);
});
