import assert from "node:assert/strict";
import test from "node:test";
import type { HtirDomainBlock, TwinEvidenceBinding } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { createHtirDomainBlock } from "./htirDomain.js";
import { createRngIdFactory } from "./ids.js";
import { createFixtureEvidenceContentStore } from "./evidenceStore.js";
import { createDeterministicRng } from "./rng.js";
import { deepFreeze, stableStringify } from "./serialize.js";
import {
  assessTwinQuality,
  createRemediationEvidenceRequest,
  FIXTURE_TWIN_DEFICIENCY_THRESHOLD,
  FIXTURE_TWIN_REQUIRED_DOMAINS,
  twinDeficiencyKey,
  twinDomainScores,
} from "./twinQuality.js";
import type { TwinDeficiency } from "./contract.js";

function makeDeps() {
  return {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0003)),
    store: createFixtureEvidenceContentStore(),
  };
}

function blockAt(deps: ReturnType<typeof makeDeps>, domain: string, confidence: number): HtirDomainBlock {
  return createHtirDomainBlock(
    { domain: domain as HtirDomainBlock["domain"], bytes: new Uint8Array([confidence * 100]), confidence, provenanceSource: "test:quality", simulated: true },
    deps,
  );
}

function bindingFor(evidenceId: string): TwinEvidenceBinding {
  return deepFreeze({
    evidenceId,
    evidenceContentHash: `hash-${evidenceId}`,
    consent: { policyId: `policy-${evidenceId}`, state: "granted", learningPermission: false },
  });
}

test("twinDomainScores take the minimum block confidence per domain, rounded to 4 decimals", () => {
  const deps = makeDeps();
  const blocks = [
    blockAt(deps, "geometry-skeleton", 0.91234),
    blockAt(deps, "geometry-skeleton", 0.711111), // duplicate domain not possible via validate, but score math is per-block
    blockAt(deps, "morphology", 0.8),
  ];
  const scores = twinDomainScores(blocks);
  assert.equal(scores["geometry-skeleton"], 0.7111);
  assert.equal(scores["morphology"], 0.8);
  assert.deepEqual(Object.keys(scores), ["geometry-skeleton", "morphology"]);
});

test("quality projection emits coverage-gap deficiencies for missing required domains", () => {
  const deps = makeDeps();
  const quality = assessTwinQuality({ domainBlocks: [blockAt(deps, "style", 0.99)], evidenceBindings: [bindingFor("e1")] }, deps);
  const coverage = quality.deficiencies.filter((deficiency) => deficiency.deficiencyClass === "coverage-gap");
  assert.equal(coverage.length, FIXTURE_TWIN_REQUIRED_DOMAINS.length);
  for (const deficiency of coverage) {
    assert.equal(deficiency.severity, 1);
    assert.ok(deficiency.remediationHint !== null);
    assert.equal(deficiency.remediationEvidenceRequestId, null);
  }
  assert.deepEqual(
    coverage.map((deficiency) => deficiency.domain).sort(),
    [...FIXTURE_TWIN_REQUIRED_DOMAINS].sort(),
  );
});

test("quality projection maps low scores to the frozen domain deficiency classes", () => {
  const deps = makeDeps();
  const blocks = [
    blockAt(deps, "identity-binding", 0.9),
    blockAt(deps, "morphology", 0.9),
    blockAt(deps, "geometry-skeleton", 0.9),
    blockAt(deps, "face-hands", 0.6),
    blockAt(deps, "appearance-materials", 0.5),
    blockAt(deps, "motion-profile", 0.7),
  ];
  const quality = assessTwinQuality({ domainBlocks: blocks, evidenceBindings: [bindingFor("e1")] }, deps);
  const byDomain = new Map(quality.deficiencies.map((deficiency) => [deficiency.domain, deficiency]));
  const faceHands = byDomain.get("face-hands");
  const appearance = byDomain.get("appearance-materials");
  const motion = byDomain.get("motion-profile");
  assert.ok(faceHands !== undefined);
  assert.equal(faceHands.deficiencyClass, "geometric-error");
  assert.equal(faceHands.severity, 0.4);
  assert.ok(appearance !== undefined);
  assert.equal(appearance.deficiencyClass, "appearance-error");
  assert.equal(appearance.severity, 0.5);
  assert.ok(motion !== undefined);
  assert.equal(motion.deficiencyClass, "articulation-error");
  assert.equal(motion.severity, 0.3);
  // No deficiency for domains at or above the threshold.
  assert.equal(byDomain.has("geometry-skeleton"), false);
});

test("unmapped domains (identity-binding, voice, extensions) never get fabricated deficiency classes", () => {
  const deps = makeDeps();
  const blocks = [
    blockAt(deps, "identity-binding", 0.5),
    blockAt(deps, "voice", 0.4),
    blockAt(deps, "custom-extension", 0.3),
    blockAt(deps, "morphology", 0.9),
    blockAt(deps, "geometry-skeleton", 0.9),
  ];
  const quality = assessTwinQuality({ domainBlocks: blocks, evidenceBindings: [bindingFor("e1")] }, deps);
  // identity-binding is required and present, so only low scores matter.
  for (const deficiency of quality.deficiencies) {
    assert.notEqual(deficiency.domain, "voice");
    assert.notEqual(deficiency.domain, "custom-extension");
    assert.notEqual(deficiency.domain, "identity-binding");
  }
  // Scores are still visible for every domain.
  assert.equal(quality.domainScores["voice"], 0.4);
  assert.equal(quality.domainScores["custom-extension"], 0.3);
});

test("a version without evidence bindings carries a provenance-missing deficiency", () => {
  const deps = makeDeps();
  const withBindings = assessTwinQuality(
    { domainBlocks: [blockAt(deps, "style", 0.9)], evidenceBindings: [bindingFor("e1")] },
    deps,
  );
  const withoutBindings = assessTwinQuality({ domainBlocks: [blockAt(deps, "style", 0.9)], evidenceBindings: [] }, deps);
  assert.equal(withBindings.deficiencies.some((deficiency) => deficiency.deficiencyClass === "provenance-missing"), false);
  const provenanceMissing = withoutBindings.deficiencies.find((deficiency) => deficiency.deficiencyClass === "provenance-missing");
  assert.ok(provenanceMissing !== undefined);
  assert.equal(provenanceMissing.severity, 1);
});

test("the remediation lookup populates remediationEvidenceRequestId on matching deficiencies", () => {
  const deps = makeDeps();
  const blocks = [
    blockAt(deps, "identity-binding", 0.9),
    blockAt(deps, "morphology", 0.9),
    blockAt(deps, "geometry-skeleton", 0.9),
    blockAt(deps, "face-hands", 0.6),
  ];
  const remediation = {
    resolve: (deficiencyClass: string, domain: string) =>
      deficiencyClass === "geometric-error" && domain === "face-hands" ? "you_evidence-request_remediation01" : null,
  };
  const quality = assessTwinQuality({ domainBlocks: blocks, evidenceBindings: [bindingFor("e1")] }, deps, { remediation });
  const faceHands = quality.deficiencies.find((deficiency) => deficiency.domain === "face-hands");
  assert.ok(faceHands !== undefined);
  assert.equal(faceHands.remediationEvidenceRequestId, "you_evidence-request_remediation01");
  assert.ok(faceHands.remediationHint !== null);
});

test("quality projection is deterministic: same inputs => byte-identical state (sorted deficiencies)", () => {
  const depsA = makeDeps();
  const depsB = makeDeps();
  const build = (deps: ReturnType<typeof makeDeps>) => {
    const blocks = [
      blockAt(deps, "identity-binding", 0.9),
      blockAt(deps, "morphology", 0.55),
      blockAt(deps, "geometry-skeleton", 0.9),
      blockAt(deps, "face-hands", 0.6),
    ];
    return assessTwinQuality({ domainBlocks: blocks, evidenceBindings: [bindingFor("e1"), bindingFor("e2")] }, deps);
  };
  const first = build(depsA);
  const second = build(depsB);
  assert.equal(stableStringify(first), stableStringify(second));
  // Deficiency list ordering is by id (stable across runs given same id seed).
  const ids = second.deficiencies.map((deficiency) => deficiency.id);
  assert.deepEqual([...ids].sort(), ids);
  assert.ok(Object.isFrozen(second));
  assert.ok(Object.isFrozen(second.deficiencies[0]));
});

test("createRemediationEvidenceRequest builds a targeted, deterministic W2-seam request", () => {
  const deps = makeDeps();
  const deficiency: TwinDeficiency = deepFreeze({
    id: "you_twin-deficiency_test01",
    deficiencyClass: "geometric-error",
    domain: "face-hands",
    severity: 0.42,
    remediationHint: "capture targeted evidence",
    remediationEvidenceRequestId: null,
  });
  const request = createRemediationEvidenceRequest(deficiency, "you_twin-version_v1", deps);
  assert.match(request.id, /^you_evidence-request_[0-9a-f]{16}$/);
  assert.equal(request.targetDeficiency, twinDeficiencyKey("geometric-error", "face-hands"));
  assert.equal(request.status, "requested");
  assert.ok(request.reason.includes("geometric-error"));
  assert.ok(request.reason.includes("face-hands"));
  assert.ok(request.reason.includes("you_twin-version_v1"));
  assert.ok(request.privacyRequirements.length > 0);
  assert.ok(Object.isFrozen(request));
  const custom = createRemediationEvidenceRequest(deficiency, "you_twin-version_v1", deps, { reason: "custom reason" });
  assert.equal(custom.reason, "custom reason");
});

test("fixture deficiency threshold is the frozen 0.75 constant", () => {
  assert.equal(FIXTURE_TWIN_DEFICIENCY_THRESHOLD, 0.75);
});
