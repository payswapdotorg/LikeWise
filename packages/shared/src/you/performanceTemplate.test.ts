import assert from "node:assert/strict";
import test from "node:test";
import type { PerformanceTemplate } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createFixtureEvidenceContentStore } from "./evidenceStore.js";
import { createDeterministicRng } from "./rng.js";
import { deepFreeze, stableStringify } from "./serialize.js";
import { createPerformanceCue, createPerformanceTimeline, validatePerformanceTimeline } from "./performanceTimeline.js";
import {
  bindTemplateParameters,
  createPerformanceTemplate,
  instantiatePerformanceTemplate,
  validatePlainParameterRecord,
  validatePerformanceTemplateName,
  type ParameterRecord,
} from "./performanceTemplate.js";

function makeDeps() {
  return {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0010)),
  };
}

function makeTimeline(seed: number) {
  const { ids } = makeDeps();
  const store = createFixtureEvidenceContentStore();
  return createPerformanceTimeline(
    [
      createPerformanceCue({ track: "motion", startMs: 0, endMs: 2000, rng: createDeterministicRng(seed) }, { ids, store }),
      createPerformanceCue({ track: "cue", startMs: 2000, endMs: 3000, rng: createDeterministicRng(seed + 1) }, { ids, store }),
    ],
    { ids },
  );
}

function makeTemplate(parameters: ParameterRecord = { intensity: 0.8, greeting: "Hello", loop: false }): PerformanceTemplate {
  const deps = makeDeps();
  const created = createPerformanceTemplate({ name: "Greeting Wave", timeline: makeTimeline(11), parameters }, deps);
  assert.ok(created.ok);
  return created.template;
}

test("template names must be non-empty trimmed strings", () => {
  assert.equal(validatePerformanceTemplateName("Greeting Wave"), null);
  assert.ok(validatePerformanceTemplateName("") !== null);
  assert.ok(validatePerformanceTemplateName("  ") !== null);
  assert.ok(validatePerformanceTemplateName(" padded ") !== null);
});

test("plain-record parameter validation accepts primitives and refuses junk", () => {
  assert.equal(validatePlainParameterRecord({}), null);
  assert.equal(validatePlainParameterRecord({ a: "x", b: 1, c: true }), null);
  assert.ok(validatePlainParameterRecord({ " ": 1 }) !== null);
  assert.ok(validatePlainParameterRecord({ " x": 1 }) !== null);
  assert.ok(validatePlainParameterRecord({ nan: Number.NaN }) !== null);
  assert.ok(validatePlainParameterRecord({ inf: Number.POSITIVE_INFINITY }) !== null);
  // The frozen contract type forbids nested values at compile time; the
  // runtime validator also refuses them for untrusted input.
  assert.ok(validatePlainParameterRecord(deepFreeze({ nested: { x: 1 } as unknown as string })) !== null);
});

test("createPerformanceTemplate validates name, parameters and timeline (typed refusals)", () => {
  const deps = makeDeps();
  const badName = createPerformanceTemplate({ name: "", timeline: makeTimeline(1) }, deps);
  assert.ok(!badName.ok);
  assert.equal(badName.code, "invalid-name");

  const badParams = createPerformanceTemplate({ name: "T", timeline: makeTimeline(2), parameters: { broken: Number.NaN } }, deps);
  assert.ok(!badParams.ok);
  assert.equal(badParams.code, "invalid-parameters");

  const validTimeline = makeTimeline(3);
  const invalidTimeline = { ...validTimeline, cues: [...validTimeline.cues, validTimeline.cues[0]!] };
  const badTimeline = createPerformanceTemplate({ name: "T", timeline: invalidTimeline }, deps);
  assert.ok(!badTimeline.ok);
  assert.equal(badTimeline.code, "invalid-timeline");

  const ok = createPerformanceTemplate({ name: "T", timeline: makeTimeline(4) }, deps);
  assert.ok(ok.ok);
  assert.ok(ok.template.id.startsWith("you_performance-template_"));
  assert.deepEqual(ok.template.parameters, {});
  assert.ok(Object.isFrozen(ok.template));
  assert.ok(Object.isFrozen(ok.template.parameters));
});

test("template timelines must themselves pass stateless validation (duplicate ids refused)", () => {
  const deps = makeDeps();
  const timeline = makeTimeline(5);
  const duplicated = { ...timeline, cues: [timeline.cues[0]!, timeline.cues[0]!] };
  const refused = createPerformanceTemplate({ name: "T", timeline: duplicated }, deps);
  assert.ok(!refused.ok);
  assert.equal(refused.code, "invalid-timeline");
  assert.ok(refused.detail.includes("invalid-cue"));
});

test("parameter binding: missing keys fall back to declared defaults", () => {
  const template = makeTemplate();
  const bound = bindTemplateParameters(template, {});
  assert.ok(bound.ok);
  assert.deepEqual(bound.parameters, { greeting: "Hello", intensity: 0.8, loop: false });

  const partial = bindTemplateParameters(template, { intensity: 0.25 });
  assert.ok(partial.ok);
  assert.deepEqual(partial.parameters, { greeting: "Hello", intensity: 0.25, loop: false });
  // Bound records are frozen (immutable outputs).
  assert.ok(Object.isFrozen(partial.parameters));
});

test("parameter binding: unknown keys are typed refusals", () => {
  const template = makeTemplate();
  const refused = bindTemplateParameters(template, { surprise: 1 });
  assert.ok(!refused.ok);
  assert.equal(refused.code, "unknown-parameter");
  assert.equal(refused.key, "surprise");
  assert.ok(refused.detail.includes("does not declare"));
});

test("parameter binding: primitive-type mismatches are typed refusals", () => {
  const template = makeTemplate();
  const stringForNumber = bindTemplateParameters(template, { intensity: "high" });
  assert.ok(!stringForNumber.ok);
  assert.equal(stringForNumber.code, "parameter-type-mismatch");
  assert.equal(stringForNumber.key, "intensity");
  assert.equal(stringForNumber.expected, "number");

  const boolForString = bindTemplateParameters(template, { greeting: true });
  assert.ok(!boolForString.ok);
  assert.equal(boolForString.code, "parameter-type-mismatch");
  assert.equal(boolForString.expected, "string");

  const nonFinite = bindTemplateParameters(template, { intensity: Number.NaN });
  assert.ok(!nonFinite.ok);
  assert.equal(nonFinite.code, "parameter-type-mismatch");
});

test("deterministic instantiation: the timeline is the template timeline VERBATIM", () => {
  const template = makeTemplate();
  const deps = makeDeps();
  const first = instantiatePerformanceTemplate(template, { twinVersionId: "you_twin-version_demo", parameters: { intensity: 0.5 } }, deps);
  assert.ok(first.ok);
  const { performance, parameters } = first;
  assert.equal(performance.basedOnTemplateId, template.id);
  assert.equal(performance.twinVersionId, "you_twin-version_demo");
  // Verbatim: the SAME frozen record (identical id, cues and durationMs).
  assert.equal(performance.timeline, template.timeline);
  assert.equal(performance.timeline.id, template.timeline.id);
  assert.equal(performance.timeline.durationMs, template.timeline.durationMs);
  assert.deepEqual(performance.timeline.cues, template.timeline.cues);
  assert.deepEqual(parameters, { greeting: "Hello", intensity: 0.5, loop: false });
  assert.ok(Object.isFrozen(performance));

  // Refused instantiation parameters return the typed binding refusals.
  const refused = instantiatePerformanceTemplate(template, { twinVersionId: "v", parameters: { nope: true } }, deps);
  assert.ok(!refused.ok);
  assert.equal(refused.code, "unknown-parameter");
});

test("instantiation is deterministic for identical inputs (byte-identical replay)", () => {
  const template = makeTemplate();
  const run = () => {
    const deps = makeDeps();
    const made = instantiatePerformanceTemplate(template, { twinVersionId: "you_twin-version_demo" }, deps);
    assert.ok(made.ok);
    return made;
  };
  const first = run();
  const second = run();
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(first.performance.createdAt, second.performance.createdAt);
  // The performed timeline still passes stateless validation.
  assert.deepEqual(validatePerformanceTimeline(first.performance.timeline), { ok: true });
});

test("templates built from the same inputs are identical under canonical serialization", () => {
  const build = () => createPerformanceTemplate({ name: "Same", timeline: makeTimeline(21), parameters: { k: 1 } }, makeDeps());
  const first = build();
  const second = build();
  assert.ok(first.ok && second.ok);
  assert.equal(stableStringify(first.template), stableStringify(second.template));
});
