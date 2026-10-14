import assert from "node:assert/strict";
import test from "node:test";
import {
  IMPORT_SCAN_CLASSES,
  IMPORT_SEVERITIES,
  IMPORT_VERDICTS,
  constructImportReleaseRecord,
  constructImportSecurityVerdict,
  evaluateImportScanVerdict,
  importAdmissionDecision,
  isImportScanClass,
  isImportVerdict,
  isReleasableStatus,
  validateImportReleaseInput,
  validateImportScanInput,
} from "./importSecurity.js";

const VALID_SCAN = {
  artifactRef: "you_content_fixture01",
  scanClass: "artifact-bundle",
  findings: [{ signature: "signature:metadata-stale", severity: "low" as const }],
};

test("the sanctioned scan classes are the frozen six; the verdicts and severities are the frozen three", () => {
  assert.deepEqual(IMPORT_SCAN_CLASSES, [
    "artifact-bundle",
    "asset-mesh",
    "material-texture",
    "avatar-vrm",
    "editor-plugin",
    "pipeline-config",
  ]);
  assert.deepEqual(IMPORT_VERDICTS, ["clean", "quarantined", "rejected"]);
  assert.deepEqual(IMPORT_SEVERITIES, ["low", "medium", "high"]);
  assert.ok(isImportScanClass("artifact-bundle"));
  assert.ok(!isImportScanClass("Artifact-Bundle"));
  assert.ok(!isImportScanClass(""));
  assert.ok(!isImportScanClass("sound-fx"));
  assert.ok(isImportVerdict("clean"));
  assert.ok(isImportVerdict("quarantined"));
  assert.ok(isImportVerdict("rejected"));
  assert.ok(!isImportVerdict("released"));
});

test("the deterministic verdict rule: high rejects, medium quarantines, otherwise clean", () => {
  assert.equal(evaluateImportScanVerdict([]), "clean");
  assert.equal(evaluateImportScanVerdict([{ signature: "s1", severity: "low" }]), "clean");
  assert.equal(evaluateImportScanVerdict([{ signature: "s1", severity: "low" }, { signature: "s2", severity: "medium" }]), "quarantined");
  assert.equal(evaluateImportScanVerdict([{ signature: "s1", severity: "medium" }]), "quarantined");
  assert.equal(evaluateImportScanVerdict([{ signature: "s1", severity: "high" }]), "rejected");
  // High outranks medium (the high finding is checked first — fixed order).
  assert.equal(
    evaluateImportScanVerdict([
      { signature: "s1", severity: "medium" },
      { signature: "s2", severity: "high" },
    ]),
    "rejected",
  );
});

test("the scan-intake validator refuses malformed refs, classes and findings", () => {
  assert.equal(validateImportScanInput({ ...VALID_SCAN, artifactRef: "" })?.reason, "artifact-ref-empty");
  assert.equal(validateImportScanInput({ ...VALID_SCAN, scanClass: "sound-fx" })?.reason, "scan-class-invalid");
  assert.equal(
    validateImportScanInput({ ...VALID_SCAN, findings: [{ signature: "s1", severity: "ultra" as never }] })?.reason,
    "finding-severity-invalid",
  );
  assert.equal(
    validateImportScanInput({ ...VALID_SCAN, findings: [{ signature: "", severity: "low" }] })?.reason,
    "finding-signature-empty",
  );
  assert.equal(
    validateImportScanInput({ ...VALID_SCAN, findings: [{ signature: "s1", severity: "low" }, { signature: "s1", severity: "high" }] })
      ?.reason,
    "finding-duplicate",
  );
  assert.equal(validateImportScanInput({ ...VALID_SCAN, findings: "none" as never })?.reason, "findings-malformed");
  assert.equal(validateImportScanInput(VALID_SCAN), null);
});

test("constructImportSecurityVerdict freezes the verdict and enforces the quarantinedAt consistency gate", () => {
  const quarantined = constructImportSecurityVerdict({
    id: "you_import-verdict_0001",
    artifactRef: "you_content_fixture01",
    scanClass: "avatar-vrm",
    verdict: "quarantined",
    quarantinedAt: "2026-01-01T00:00:01.000Z",
  });
  assert.ok(quarantined.ok);
  if (quarantined.ok) {
    assert.equal(quarantined.verdict.verdict, "quarantined");
    assert.equal(quarantined.verdict.quarantinedAt, "2026-01-01T00:00:01.000Z");
    assert.equal(quarantined.verdict.simulated, true);
    assert.ok(Object.isFrozen(quarantined.verdict));
  }
  // A quarantined verdict REQUIRES its timestamp.
  const missingTimestamp = constructImportSecurityVerdict({
    id: "you_import-verdict_0002",
    artifactRef: "you_content_fixture01",
    scanClass: "avatar-vrm",
    verdict: "quarantined",
    quarantinedAt: null,
  });
  assert.equal(missingTimestamp.ok, false);
  if (!missingTimestamp.ok) {
    assert.equal(missingTimestamp.refusal.reason, "quarantined-at-missing");
  }
  // A clean verdict NEVER carries one.
  const inconsistent = constructImportSecurityVerdict({
    id: "you_import-verdict_0003",
    artifactRef: "you_content_fixture01",
    scanClass: "artifact-bundle",
    verdict: "clean",
    quarantinedAt: "2026-01-01T00:00:01.000Z",
  });
  assert.equal(inconsistent.ok, false);
  if (!inconsistent.ok) {
    assert.equal(inconsistent.refusal.reason, "quarantined-at-inconsistent");
  }
  const clean = constructImportSecurityVerdict({
    id: "you_import-verdict_0004",
    artifactRef: "you_content_fixture01",
    scanClass: "artifact-bundle",
    verdict: "clean",
    quarantinedAt: null,
  });
  assert.ok(clean.ok);
  if (clean.ok) {
    assert.equal(clean.verdict.quarantinedAt, null);
  }
  const badVerdict = constructImportSecurityVerdict({
    id: "you_import-verdict_0005",
    artifactRef: "you_content_fixture01",
    scanClass: "artifact-bundle",
    verdict: "released" as never,
    quarantinedAt: null,
  });
  assert.equal(badVerdict.ok, false);
  if (!badVerdict.ok) {
    assert.equal(badVerdict.refusal.reason, "verdict-invalid");
  }
});

test("the release record constructs immutably and validates its intake", () => {
  const release = constructImportReleaseRecord({
    id: "you_import-release_0001",
    artifactRef: "you_content_fixture01",
    releasedBy: "you_user_0000000000000001",
    reason: "reviewed-by-operator",
    releasedAt: "2026-01-01T00:00:02.000Z",
  });
  assert.ok(release.ok);
  if (release.ok) {
    assert.equal(release.release.releasedBy, "you_user_0000000000000001");
    assert.equal(release.release.simulated, true);
    assert.ok(Object.isFrozen(release.release));
  }
  assert.equal(validateImportReleaseInput({ releasedBy: "", reason: "r" })?.reason, "released-by-empty");
  assert.equal(validateImportReleaseInput({ releasedBy: "u1", reason: "  " })?.reason, "release-reason-empty");
  assert.equal(
    constructImportReleaseRecord({ id: "x", artifactRef: "", releasedBy: "u1", reason: "r", releasedAt: "t" }).ok,
    false,
  );
  assert.equal(
    constructImportReleaseRecord({ id: "x", artifactRef: "a", releasedBy: "u1", reason: "r", releasedAt: "" }).ok,
    false,
  );
});

test("the admission gate: only clean and released imports enter evidence (fail-closed)", () => {
  assert.deepEqual(importAdmissionDecision(null), { allowed: false, reason: "unscanned-import" });
  assert.deepEqual(importAdmissionDecision("quarantined"), { allowed: false, reason: "import-quarantined" });
  assert.deepEqual(importAdmissionDecision("rejected"), { allowed: false, reason: "import-rejected" });
  assert.deepEqual(importAdmissionDecision("clean"), { allowed: true, reason: "scanned-clean" });
  assert.deepEqual(importAdmissionDecision("released"), { allowed: true, reason: "released" });
});

test("only a quarantined import is releasable (the explicit release record is the only path out)", () => {
  assert.equal(isReleasableStatus(null), false);
  assert.equal(isReleasableStatus("quarantined"), true);
  assert.equal(isReleasableStatus("released"), false);
  assert.equal(isReleasableStatus("clean"), false);
  assert.equal(isReleasableStatus("rejected"), false);
});
