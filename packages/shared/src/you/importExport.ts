// YOU import/export interchange machinery (W5A — docs/you/CONTRACTS.md
// "Wave-5 contract freeze (v5)", frozen ImportExportFormat /
// ImportExportStatus / ImportExportResult; docs/you/EDITING_INTERCHANGE.md
// "Tier 4 — export/import": export -> user edits -> import -> diff ->
// validation -> candidate version -> accept/reject).
//
// Format-typed interchange: every package is a canonical JSON document
// (stableStringify — recursively sorted keys) encoded as UTF-8 bytes, so
// the same editing state assembles BYTE-IDENTICAL package content on every
// run and platform (FIXTURES.md law 2). The document embeds no timestamps:
// package bytes are a pure function of the exported state.
//
// The editable artifact package follows EDITING_INTERCHANGE.md: a manifest
// (YOU object + version, source evidence refs, renderer, pipeline, editor
// target, supported round-trip path, provenance, rights/license, privacy
// constraints) plus the sections of the tier-4 exchange (source content,
// preview, provenance, intent, edit). Envelopes per format:
//   json             { format, manifest, content }
//   edit-interchange { format, manifest, source, preview, provenance,
//                      intent, edit }
//   scene-package    { format, scene, manifest }
//
// Imported content is untrusted until validated (EDITING_INTERCHANGE.md
// "Safety"): parseInterchangePackage refuses invalid payloads with typed
// refusals — a content/hash binding mismatch is a typed refusal, never a
// silent repair (the wave-2 law). The editing application service maps the
// refusals to the frozen YOU_IMPORT_EXPORT_FAILED error; succeeded results
// are content-addressed (contentRef + contentHash only — content bytes are
// never inlined in records or events).

import type { ImportExportFormat, ImportExportResult, OpaqueId } from "./contract.js";
import type { YouIdFactory } from "./ids.js";
import { sha256Hex } from "./evidenceStore.js";
import { isSha256Hex } from "./performanceTimeline.js";
import { deepFreeze, stableStringify } from "./serialize.js";

/**
 * Formats the fixture interchange engine can assemble and validate (frozen
 * fixture definition — the `edit-interchange` family is defined by
 * docs/you/EDITING_INTERCHANGE.md). Real adapters (Worker C lane) register
 * behind the same seam; unsupported formats are typed refusals, never a
 * silent fallback to another format.
 */
export const FIXTURE_INTERCHANGE_SUPPORT: readonly ImportExportFormat[] = ["edit-interchange", "json", "scene-package"];

export function isSupportedInterchangeFormat(format: ImportExportFormat): boolean {
  return FIXTURE_INTERCHANGE_SUPPORT.includes(format);
}

/** Fixture manifest facts (truth law: fixture markers, never invented real ones). */
export const FIXTURE_INTERCHANGE_RENDERER = "fixture-renderer (simulated)";
export const FIXTURE_INTERCHANGE_PIPELINE = "you-w5a-fixture-interchange (simulated)";
export const FIXTURE_INTERCHANGE_RIGHTS = "fixture-only (simulated)";
export const FIXTURE_INTERCHANGE_PRIVACY = "no-pii (fixture)";

/** The editable artifact package manifest (EDITING_INTERCHANGE.md "The manifest records"). */
export interface InterchangeManifest {
  readonly youObjectId: string;
  readonly youObjectHash: string;
  readonly sourceEvidenceRefs: readonly string[];
  readonly renderer: string;
  readonly pipeline: string;
  readonly editorTarget: string;
  readonly supportedRoundTripPath: string;
  readonly roundTripSafe: boolean;
  readonly provenance: string;
  readonly rights: string;
  readonly privacy: string;
}

export interface InterchangeContentSection {
  readonly contentRef: string;
  readonly contentHash: string;
  readonly byteLength: number;
  readonly contentBase64: string;
}

/** Typed interchange refusal codes (mapped to YOU_IMPORT_EXPORT_FAILED by the service). */
export type InterchangeRefusalCode =
  | "unsupported-format"
  | "invalid-json"
  | "format-mismatch"
  | "invalid-manifest"
  | "missing-content"
  | "invalid-content"
  | "content-hash-mismatch"
  | "missing-section";

export type InterchangeRefusal = { readonly ok: false; readonly code: InterchangeRefusalCode; readonly detail: string };

export interface InterchangeAssemblyInput {
  readonly format: ImportExportFormat;
  readonly manifest: InterchangeManifest;
  readonly content: Uint8Array;
  readonly contentRef: string;
  /** Session-scoped edit facts (the edit/ section of the tier-4 package). */
  readonly editFacts: { readonly changeSetCount: number; readonly candidateCount: number };
  readonly provenanceFacts: { readonly sessionId: OpaqueId | null; readonly workspaceIdentity: string };
}

function contentSection(content: Uint8Array, contentRef: string): InterchangeContentSection {
  return {
    contentRef,
    contentHash: sha256Hex(content),
    byteLength: content.byteLength,
    contentBase64: Buffer.from(content).toString("base64"),
  };
}

/**
 * Deterministic export assembly: builds the format-typed canonical JSON
 * document and encodes it as UTF-8 bytes. Same inputs => byte-identical
 * package (no timestamps, no ambient state; stableStringify key order).
 */
export function buildInterchangePackage(input: InterchangeAssemblyInput): Uint8Array {
  if (!isSupportedInterchangeFormat(input.format)) {
    throw new Error(`unsupported interchange format "${input.format}"`);
  }
  const section = contentSection(input.content, input.contentRef);
  let document: Record<string, unknown>;
  if (input.format === "json") {
    document = { format: input.format, manifest: input.manifest, content: section };
  } else if (input.format === "scene-package") {
    document = { format: input.format, scene: section, manifest: input.manifest };
  } else {
    document = {
      format: input.format,
      manifest: input.manifest,
      source: section,
      preview: { kind: "none", note: "simulated fixture preview placeholder" },
      provenance: {
        sessionId: input.provenanceFacts.sessionId ?? "",
        workspaceIdentity: input.provenanceFacts.workspaceIdentity,
        simulated: true,
      },
      intent: { note: "fixture scenario interchange" },
      edit: {
        changeSetCount: input.editFacts.changeSetCount,
        candidateCount: input.editFacts.candidateCount,
        simulated: true,
      },
    };
  }
  return new TextEncoder().encode(stableStringify(document));
}

export interface ParsedInterchangePackage {
  readonly manifest: InterchangeManifest;
  readonly content: Uint8Array;
  readonly contentHash: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function requireText(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Validates + extracts the manifest section (typed invalid-manifest refusals). */
function parseManifest(document: Record<string, unknown>): { readonly ok: true; readonly manifest: InterchangeManifest } | InterchangeRefusal {
  const raw = asRecord(document["manifest"]);
  if (raw === null) {
    return { ok: false, code: "invalid-manifest", detail: "the package requires a manifest object" };
  }
  const youObjectId = requireText(raw, "youObjectId");
  const youObjectHash = raw["youObjectHash"];
  if (youObjectId === null) {
    return { ok: false, code: "invalid-manifest", detail: "the manifest requires a non-empty youObjectId" };
  }
  if (typeof youObjectHash !== "string" || !isSha256Hex(youObjectHash)) {
    return { ok: false, code: "invalid-manifest", detail: "the manifest requires a sha-256 youObjectHash" };
  }
  const textFields: readonly [string][] = [
    ["renderer"],
    ["pipeline"],
    ["editorTarget"],
    ["supportedRoundTripPath"],
    ["provenance"],
    ["rights"],
    ["privacy"],
  ];
  const manifestText: Record<string, string> = {};
  for (const [key] of textFields) {
    const value = requireText(raw, key);
    if (value === null) {
      return { ok: false, code: "invalid-manifest", detail: `the manifest requires a non-empty ${key}` };
    }
    manifestText[key] = value;
  }
  if (typeof raw["roundTripSafe"] !== "boolean") {
    return { ok: false, code: "invalid-manifest", detail: "the manifest requires a boolean roundTripSafe" };
  }
  const evidenceRefsRaw = raw["sourceEvidenceRefs"];
  if (!Array.isArray(evidenceRefsRaw) || evidenceRefsRaw.some((entry) => typeof entry !== "string")) {
    return { ok: false, code: "invalid-manifest", detail: "the manifest requires a string[] sourceEvidenceRefs" };
  }
  return {
    ok: true,
    manifest: {
      youObjectId,
      youObjectHash,
      sourceEvidenceRefs: Object.freeze([...evidenceRefsRaw]),
      renderer: manifestText["renderer"] ?? "",
      pipeline: manifestText["pipeline"] ?? "",
      editorTarget: manifestText["editorTarget"] ?? "",
      supportedRoundTripPath: manifestText["supportedRoundTripPath"] ?? "",
      roundTripSafe: raw["roundTripSafe"],
      provenance: manifestText["provenance"] ?? "",
      rights: manifestText["rights"] ?? "",
      privacy: manifestText["privacy"] ?? "",
    },
  };
}

/** Strict base64 decode (lenient Buffer.from would silently repair junk). */
function decodeBase64Strict(text: string): Uint8Array | null {
  const normalized = text.replace(/\s/g, "");
  if (normalized.length === 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    return null;
  }
  const decoded = Buffer.from(normalized, "base64");
  return decoded.toString("base64") === normalized ? Uint8Array.from(decoded) : null;
}

/** Validates + extracts the content section of a format envelope. */
function parseContentSection(
  document: Record<string, unknown>,
  sectionKey: string,
  manifest: InterchangeManifest,
): { readonly ok: true; readonly content: Uint8Array } | InterchangeRefusal {
  const raw = asRecord(document[sectionKey]);
  if (raw === null) {
    return { ok: false, code: "missing-content", detail: `the package requires a "${sectionKey}" content section` };
  }
  const contentHash = raw["contentHash"];
  if (typeof contentHash !== "string" || !isSha256Hex(contentHash)) {
    return { ok: false, code: "invalid-content", detail: "the content section requires a sha-256 contentHash" };
  }
  const byteLength = raw["byteLength"];
  if (typeof byteLength !== "number" || !Number.isInteger(byteLength) || byteLength < 0) {
    return { ok: false, code: "invalid-content", detail: "the content section requires a non-negative integer byteLength" };
  }
  const contentBase64 = raw["contentBase64"];
  if (typeof contentBase64 !== "string") {
    return { ok: false, code: "invalid-content", detail: "the content section requires a contentBase64 string" };
  }
  const content = decodeBase64Strict(contentBase64);
  if (content === null) {
    return { ok: false, code: "invalid-content", detail: "the content section carries invalid base64" };
  }
  if (content.byteLength !== byteLength) {
    return {
      ok: false,
      code: "invalid-content",
      detail: `the content byteLength ${content.byteLength} does not match the declared ${byteLength}`,
    };
  }
  const actualHash = sha256Hex(content);
  if (actualHash !== contentHash || actualHash !== manifest.youObjectHash) {
    return {
      ok: false,
      code: "content-hash-mismatch",
      detail: "the imported content hash does not match the manifest binding (never silently repaired)",
    };
  }
  return { ok: true, content };
}

/**
 * Validated import: parses the format-typed package, validates the
 * manifest, decodes the content and verifies the sha-256 binding. Returns
 * the manifest + content bytes on success, or the FIRST typed refusal.
 */
export function parseInterchangePackage(
  format: ImportExportFormat,
  bytes: Uint8Array,
): { readonly ok: true; readonly package: ParsedInterchangePackage } | InterchangeRefusal {
  if (!isSupportedInterchangeFormat(format)) {
    return { ok: false, code: "unsupported-format", detail: `unsupported interchange format "${format}"` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, code: "invalid-json", detail: "the package must be a JSON document" };
  }
  const document = asRecord(parsed);
  if (document === null) {
    return { ok: false, code: "invalid-json", detail: "the package must be a JSON object" };
  }
  if (document["format"] !== format) {
    return {
      ok: false,
      code: "format-mismatch",
      detail: `the package format tag "${String(document["format"])}" does not match the declared "${format}"`,
    };
  }
  const manifest = parseManifest(document);
  if (!manifest.ok) {
    return manifest;
  }
  const sectionKey = format === "json" ? "content" : format === "scene-package" ? "scene" : "source";
  const content = parseContentSection(document, sectionKey, manifest.manifest);
  if (!content.ok) {
    return content;
  }
  if (format === "edit-interchange") {
    for (const section of ["preview", "provenance", "intent", "edit"]) {
      if (asRecord(document[section]) === null) {
        return { ok: false, code: "missing-section", detail: `an edit-interchange package requires a "${section}" section` };
      }
    }
  }
  return {
    ok: true,
    package: {
      manifest: manifest.manifest,
      content: content.content,
      contentHash: sha256Hex(content.content),
    },
  };
}

export interface ImportExportResultInput {
  readonly sessionId: OpaqueId | null;
  readonly format: ImportExportFormat;
  readonly status: "succeeded" | "failed";
  readonly contentRef: string | null;
  readonly contentHash: string | null;
  readonly completedAt: string;
}

/** Builds the immutable ImportExportResult (content-addressed when succeeded). */
export function buildImportExportResult(input: ImportExportResultInput, deps: { readonly ids: YouIdFactory }): ImportExportResult {
  if (input.status === "failed" && (input.contentRef !== null || input.contentHash !== null)) {
    throw new Error("a failed import/export result carries no content binding");
  }
  return deepFreeze({
    id: deps.ids.next("import-export"),
    sessionId: input.sessionId,
    format: input.format,
    status: input.status,
    contentRef: input.contentRef,
    contentHash: input.contentHash,
    completedAt: input.completedAt,
    simulated: true,
  });
}
