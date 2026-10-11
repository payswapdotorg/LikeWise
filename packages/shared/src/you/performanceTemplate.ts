// YOU performance template library (W4A — docs/you/CONTRACTS.md
// "Performance / render": "templates parameterize timelines for reuse").
//
// A PerformanceTemplate is a named, parameterized recipe: an immutable
// timeline plus a plain-record parameter schema (string | number |
// boolean values — no nested structures). Name uniqueness is enforced by
// the performance application service (the library state owner); this
// module owns the pure construction/validation/instantiation machinery.
//
// Deterministic instantiation (frozen acceptance): instantiating a
// template produces a Performance whose timeline is the template timeline
// VERBATIM — the same deep-frozen record (same id, same cues, same
// durationMs), shared by reference because immutable records may be
// shared truthfully. Bound parameters never mutate the timeline; they
// ride along as plain-record facts recorded by the service (event payload
// param.<key> facts).
//
// Parameter binding model (plain-record schema): the template record
// declares keys with default values; instantiation overrides are applied
// on top. Missing keys fall back to the declared defaults
// (deterministic); unknown keys and primitive-type mismatches are typed
// refusals — never a silent coercion.

import type { OpaqueId, Performance, PerformanceTemplate, PerformanceTimeline } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { validatePerformanceTimeline } from "./performanceTimeline.js";
import { deepFreeze } from "./serialize.js";

/** Plain-record parameter value (frozen v4 contract shape). */
export type ParameterValue = string | number | boolean;
export type ParameterRecord = Readonly<Record<string, ParameterValue>>;

/** Returns a validation reason for an illegal template name, or null when legal. */
export function validatePerformanceTemplateName(name: string): string | null {
  if (typeof name !== "string" || name.trim().length === 0) {
    return "template name must be a non-empty string";
  }
  if (name !== name.trim()) {
    return "template name must not carry surrounding whitespace";
  }
  return null;
}

/**
 * Validates a plain-record parameter schema/override: keys are non-empty
 * trimmed strings; values are strings, finite numbers or booleans (no
 * NaN/Infinity, no nested structures). Returns a reason, or null.
 */
export function validatePlainParameterRecord(parameters: ParameterRecord): string | null {
  for (const [key, value] of Object.entries(parameters)) {
    if (key.trim().length === 0) {
      return "parameter keys must be non-empty strings";
    }
    if (key !== key.trim()) {
      return `parameter key "${key}" must not carry surrounding whitespace`;
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      return `parameter "${key}" must be a finite number`;
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      return `parameter "${key}" must be a string, number or boolean`;
    }
  }
  return null;
}

export type PerformanceTemplateRefusalCode = "invalid-name" | "invalid-parameters" | "invalid-timeline";

export type PerformanceTemplateRefusal =
  | { readonly ok: false; readonly code: "invalid-name"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-parameters"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-timeline"; readonly detail: string; readonly refusal: unknown };

export interface PerformanceTemplateIntake {
  readonly name: string;
  readonly timeline: PerformanceTimeline;
  /** Declared parameter schema with defaults (plain record). */
  readonly parameters?: ParameterRecord;
}

/** Creates the immutable, deep-frozen PerformanceTemplate (id from the factory). */
export function createPerformanceTemplate(
  intake: PerformanceTemplateIntake,
  deps: { readonly ids: YouIdFactory },
): { readonly ok: true; readonly template: PerformanceTemplate } | PerformanceTemplateRefusal {
  const nameReason = validatePerformanceTemplateName(intake.name);
  if (nameReason !== null) {
    return { ok: false, code: "invalid-name", detail: nameReason };
  }
  const parameters = intake.parameters ?? {};
  const parameterReason = validatePlainParameterRecord(parameters);
  if (parameterReason !== null) {
    return { ok: false, code: "invalid-parameters", detail: parameterReason };
  }
  const timelineCheck = validatePerformanceTimeline(intake.timeline);
  if (!timelineCheck.ok) {
    return {
      ok: false,
      code: "invalid-timeline",
      detail: `${timelineCheck.code}: ${timelineCheck.detail}`,
      refusal: timelineCheck,
    };
  }
  const template: PerformanceTemplate = deepFreeze({
    id: deps.ids.next("performance-template"),
    name: intake.name,
    timeline: intake.timeline,
    parameters: deepFreeze({ ...parameters }),
  });
  return { ok: true, template };
}

export type TemplateParameterBindRefusalCode = "unknown-parameter" | "parameter-type-mismatch";

export type TemplateParameterBindRefusal =
  | { readonly ok: false; readonly code: "unknown-parameter"; readonly detail: string; readonly key: string }
  | {
      readonly ok: false;
      readonly code: "parameter-type-mismatch";
      readonly detail: string;
      readonly key: string;
      readonly expected: "string" | "number" | "boolean";
    };

/**
 * Binds instantiation overrides onto the template defaults. Missing keys
 * fall back to the declared defaults; unknown keys, primitive-type
 * mismatches and non-finite numbers are typed refusals (never a silent
 * coercion or drop). Deterministic: the bound record iterates template
 * keys in sorted order.
 */
export function bindTemplateParameters(
  template: PerformanceTemplate,
  overrides: ParameterRecord,
): { readonly ok: true; readonly parameters: ParameterRecord } | TemplateParameterBindRefusal {
  for (const [key, value] of Object.entries(overrides)) {
    const expected = template.parameters[key];
    if (expected === undefined) {
      return {
        ok: false,
        code: "unknown-parameter",
        detail: `template "${template.name}" does not declare parameter "${key}"`,
        key,
      };
    }
    if (typeof value !== typeof expected) {
      return {
        ok: false,
        code: "parameter-type-mismatch",
        detail: `parameter "${key}" expects ${typeof expected}, got ${typeof value}`,
        key,
        expected: typeof expected as "string" | "number" | "boolean",
      };
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      return {
        ok: false,
        code: "parameter-type-mismatch",
        detail: `parameter "${key}" must be a finite number`,
        key,
        expected: "number",
      };
    }
  }
  const bound: Record<string, ParameterValue> = {};
  for (const key of Object.keys(template.parameters).sort()) {
    bound[key] = template.parameters[key] as ParameterValue;
  }
  for (const [key, value] of Object.entries(overrides)) {
    bound[key] = value;
  }
  return { ok: true, parameters: deepFreeze(bound) };
}

export interface InstantiateTemplateInput {
  readonly twinVersionId: OpaqueId;
  /** Overrides on top of the template defaults (missing keys use defaults). */
  readonly parameters?: ParameterRecord;
}

/**
 * Deterministic template instantiation: the produced Performance carries
 * the template timeline VERBATIM (the same frozen record) and
 * `basedOnTemplateId` linkage to the template. Bound parameters return
 * alongside (recorded by the service as event payload facts — the frozen
 * Performance shape carries no parameters field).
 */
export function instantiatePerformanceTemplate(
  template: PerformanceTemplate,
  input: InstantiateTemplateInput,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
):
  | {
      readonly ok: true;
      readonly performance: Performance;
      readonly parameters: ParameterRecord;
    }
  | TemplateParameterBindRefusal {
  const bound = bindTemplateParameters(template, input.parameters ?? {});
  if (!bound.ok) {
    return bound;
  }
  const performance: Performance = deepFreeze({
    id: deps.ids.next("performance"),
    twinVersionId: input.twinVersionId,
    timeline: template.timeline,
    basedOnTemplateId: template.id,
    createdAt: deps.clock.now(),
  });
  return { ok: true, performance, parameters: bound.parameters };
}
