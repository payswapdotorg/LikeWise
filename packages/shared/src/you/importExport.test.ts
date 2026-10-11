import assert from "node:assert/strict";
import test from "node:test";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { sha256Hex } from "./evidenceStore.js";
import { stableStringify } from "./serialize.js";
import {
  buildImportExportResult,
  buildInterchangePackage,
  FIXTURE_INTERCHANGE_PIPELINE,
  FIXTURE_INTERCHANGE_PRIVACY,
  FIXTURE_INTERCHANGE_RENDERER,
  FIXTURE_INTERCHANGE_RIGHTS,
  FIXTURE_INTERCHANGE_SUPPORT,
  isSupportedInterchangeFormat,
  parseInterchangePackage,
  type InterchangeManifest,
} from "./importExport.js";

const CONTENT = new Uint8Array(64);
for (let index = 0; index < CONTENT.length; index += 1) {
  CONTENT[index] = (index * 5 + 1) & 0xff;
}

function manifestOf(): InterchangeManifest {
  return {
    youObjectId: "you_editing-subject_0001",
    youObjectHash: sha256Hex(CONTENT),
    sourceEvidenceRefs: [],
    renderer: FIXTURE_INTERCHANGE_RENDERER,
    pipeline: FIXTURE_INTERCHANGE_PIPELINE,
    editorTarget: "external",
    supportedRoundTripPath: "edit-interchange",
    roundTripSafe: true,
    provenance: "fixture:w5a-interchange:test",
    rights: FIXTURE_INTERCHANGE_RIGHTS,
    privacy: FIXTURE_INTERCHANGE_PRIVACY,
  };
}

function packageFor(format: string): Uint8Array {
  assert.ok(isSupportedInterchangeFormat(format));
  return buildInterchangePackage({
    format,
    manifest: manifestOf(),
    content: CONTENT,
    contentRef: `you_content_${sha256Hex(CONTENT).slice(0, 16)}`,
    editFacts: { changeSetCount: 2, candidateCount: 2 },
    provenanceFacts: { sessionId: "you_editing-session_0001", workspaceIdentity: "ws-test" },
  });
}

test("the fixture engine supports the three tier-4 interchange formats", () => {
  assert.deepEqual(FIXTURE_INTERCHANGE_SUPPORT, ["edit-interchange", "json", "scene-package"]);
  assert.ok(isSupportedInterchangeFormat("json"));
  assert.ok(isSupportedInterchangeFormat("edit-interchange"));
  assert.ok(isSupportedInterchangeFormat("scene-package"));
  assert.ok(!isSupportedInterchangeFormat("glb"));
  assert.ok(!isSupportedInterchangeFormat("obj"));
});

test("export assembly is deterministic and format-typed (byte-identical for the same state)", () => {
  for (const format of FIXTURE_INTERCHANGE_SUPPORT) {
    const first = packageFor(format);
    const second = packageFor(format);
    assert.deepEqual(first, second, `${format} assembly is deterministic`);
    const document = JSON.parse(new TextDecoder().decode(first)) as Record<string, unknown>;
    assert.equal(document["format"], format);
    assert.ok(document["manifest"] !== undefined);
  }

  // Different formats assemble different bytes.
  assert.notDeepEqual(packageFor("json"), packageFor("edit-interchange"));
  assert.notDeepEqual(packageFor("scene-package"), packageFor("json"));

  // Unsupported assembly throws (the service maps the typed refusal first).
  assert.throws(
    () =>
      buildInterchangePackage({
        format: "glb",
        manifest: manifestOf(),
        content: CONTENT,
        contentRef: "you_content_x",
        editFacts: { changeSetCount: 0, candidateCount: 0 },
        provenanceFacts: { sessionId: null, workspaceIdentity: "ws-test" },
      }),
    /unsupported interchange format/,
  );
});

test("the edit-interchange package carries the tier-4 sections and the manifest fields", () => {
  const bytes = packageFor("edit-interchange");
  const document = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  for (const section of ["manifest", "source", "preview", "provenance", "intent", "edit"]) {
    assert.ok(document[section] !== undefined, `section ${section}`);
  }
  const manifest = document["manifest"] as Record<string, unknown>;
  assert.equal(manifest["youObjectId"], "you_editing-subject_0001");
  assert.equal(manifest["youObjectHash"], sha256Hex(CONTENT));
  assert.equal(manifest["editorTarget"], "external");
  assert.equal(manifest["supportedRoundTripPath"], "edit-interchange");
  assert.equal(manifest["roundTripSafe"], true);
  assert.deepEqual(manifest["sourceEvidenceRefs"], []);
  for (const field of ["renderer", "pipeline", "provenance", "rights", "privacy"]) {
    assert.equal(typeof manifest[field], "string");
  }
  const edit = document["edit"] as Record<string, unknown>;
  assert.equal(edit["changeSetCount"], 2);
  assert.equal(edit["candidateCount"], 2);
});

test("round trip: assembled packages parse back with content identity", () => {
  for (const format of FIXTURE_INTERCHANGE_SUPPORT) {
    const bytes = packageFor(format);
    const parsed = parseInterchangePackage(format, bytes);
    assert.ok(parsed.ok, `${format} round trip`);
    assert.deepEqual(parsed.package.content, CONTENT);
    assert.equal(parsed.package.contentHash, sha256Hex(CONTENT));
    assert.equal(parsed.package.manifest.youObjectId, "you_editing-subject_0001");
    assert.equal(parsed.package.manifest.editorTarget, "external");
  }
});

test("validated import refuses invalid payloads with typed refusals (never a silent repair)", () => {
  // Not JSON at all.
  const invalidJson = parseInterchangePackage("json", new TextEncoder().encode("this is not json"));
  assert.ok(!invalidJson.ok);
  assert.equal(invalidJson.code, "invalid-json");

  // JSON but not an object.
  const jsonArray = parseInterchangePackage("json", new TextEncoder().encode("[1,2,3]"));
  assert.ok(!jsonArray.ok);
  assert.equal(jsonArray.code, "invalid-json");

  // Format tag mismatch.
  const mismatch = parseInterchangePackage("json", packageFor("scene-package"));
  assert.ok(!mismatch.ok);
  assert.equal(mismatch.code, "format-mismatch");

  // Unsupported format.
  const unsupported = parseInterchangePackage("glb", packageFor("json"));
  assert.ok(!unsupported.ok);
  assert.equal(unsupported.code, "unsupported-format");

  // Missing manifest.
  const noManifest = JSON.parse(new TextDecoder().decode(packageFor("json"))) as Record<string, unknown>;
  delete noManifest["manifest"];
  const missingManifest = parseInterchangePackage("json", new TextEncoder().encode(JSON.stringify(noManifest)));
  assert.ok(!missingManifest.ok);
  assert.equal(missingManifest.code, "invalid-manifest");

  // Manifest with a non-sha-256 youObjectHash.
  const badManifest = JSON.parse(new TextDecoder().decode(packageFor("json"))) as Record<string, unknown>;
  (badManifest["manifest"] as Record<string, unknown>)["youObjectHash"] = "zz";
  const invalidManifest = parseInterchangePackage("json", new TextEncoder().encode(JSON.stringify(badManifest)));
  assert.ok(!invalidManifest.ok);
  assert.equal(invalidManifest.code, "invalid-manifest");

  // Missing content section.
  const noContent = JSON.parse(new TextDecoder().decode(packageFor("json"))) as Record<string, unknown>;
  delete noContent["content"];
  const missingContent = parseInterchangePackage("json", new TextEncoder().encode(JSON.stringify(noContent)));
  assert.ok(!missingContent.ok);
  assert.equal(missingContent.code, "missing-content");

  // Tampered content: same length, different bytes => hash mismatch.
  const tampered = JSON.parse(new TextDecoder().decode(packageFor("json"))) as Record<string, unknown>;
  const section = tampered["content"] as Record<string, unknown>;
  const junk = new Uint8Array(CONTENT.length);
  junk[0] = 0xff;
  section["contentBase64"] = Buffer.from(junk).toString("base64");
  const hashMismatch = parseInterchangePackage("json", new TextEncoder().encode(JSON.stringify(tampered)));
  assert.ok(!hashMismatch.ok);
  assert.equal(hashMismatch.code, "content-hash-mismatch");

  // Declared byteLength inconsistent with the decoded bytes.
  const wrongLength = JSON.parse(new TextDecoder().decode(packageFor("json"))) as Record<string, unknown>;
  (wrongLength["content"] as Record<string, unknown>)["byteLength"] = 3;
  const lengthMismatch = parseInterchangePackage("json", new TextEncoder().encode(JSON.stringify(wrongLength)));
  assert.ok(!lengthMismatch.ok);
  assert.equal(lengthMismatch.code, "invalid-content");

  // Missing tier-4 section in an edit-interchange package.
  const noPreview = JSON.parse(new TextDecoder().decode(packageFor("edit-interchange"))) as Record<string, unknown>;
  delete noPreview["preview"];
  const missingSection = parseInterchangePackage("edit-interchange", new TextEncoder().encode(JSON.stringify(noPreview)));
  assert.ok(!missingSection.ok);
  assert.equal(missingSection.code, "missing-section");
});

test("buildImportExportResult is content-addressed when succeeded and honest when failed", () => {
  const ids = createRngIdFactory(createDeterministicRng(0x5eed_0054));
  const succeeded = buildImportExportResult(
    {
      sessionId: "you_editing-session_0001",
      format: "edit-interchange",
      status: "succeeded",
      contentRef: "you_content_abc",
      contentHash: "a".repeat(64),
      completedAt: "2026-01-01T00:00:00.000Z",
    },
    { ids },
  );
  assert.ok(succeeded.id.startsWith("you_import-export_"));
  assert.equal(succeeded.status, "succeeded");
  assert.equal(succeeded.contentRef, "you_content_abc");
  assert.equal(succeeded.simulated, true);
  assert.ok(Object.isFrozen(succeeded));

  const failed = buildImportExportResult(
    { sessionId: null, format: "json", status: "failed", contentRef: null, contentHash: null, completedAt: "2026-01-01T00:00:00.000Z" },
    { ids },
  );
  assert.equal(failed.status, "failed");
  assert.equal(failed.contentRef, null);
  assert.equal(failed.contentHash, null);
  assert.equal(failed.sessionId, null);

  // A failed result never carries a content binding (truth law).
  assert.throws(() =>
    buildImportExportResult(
      { sessionId: null, format: "json", status: "failed", contentRef: "you_content_abc", contentHash: "a".repeat(64), completedAt: "t" },
      { ids },
    ),
  );
});

test("assembly embeds no timestamps: package bytes are a pure function of the exported state", () => {
  const first = packageFor("edit-interchange");
  const second = packageFor("edit-interchange");
  const text = new TextDecoder().decode(first);
  assert.ok(!text.includes("completedAt"));
  assert.ok(!text.includes("proposedAt"));
  assert.ok(!text.includes("openedAt"));
  assert.equal(stableStringify(JSON.parse(text)), stableStringify(JSON.parse(new TextDecoder().decode(second))));
});
