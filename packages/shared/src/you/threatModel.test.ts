import assert from "node:assert/strict";
import test from "node:test";
import {
  THREAT_CLASSES,
  constructThreatModelEntry,
  isThreatClass,
  validateThreatModelInput,
  type ThreatModelInput,
} from "./threatModel.js";

const MITIGATED: ThreatModelInput = {
  threatClass: "export-leak",
  vector: "export bundles embed provenance metadata for sensitive-media subjects",
  mitigationRef: "you_mitigation_export-md_00000001",
  residual: "provenance stripping covers known exporters; novel exporters remain unreviewed until W12",
};

const UNMITIGATED: ThreatModelInput = {
  threatClass: "provider-failure",
  vector: "a provider outage stalls every render job mid-flight with no drain",
  mitigationRef: null,
  residual: "no circuit breaker is wired yet; jobs stall until the provider recovers or an operator intervenes",
};

test("the sanctioned threat classes are the frozen nine (the SECURITY.md surfaces)", () => {
  assert.deepEqual(THREAT_CLASSES, [
    "data-class-leakage",
    "consent-bypass",
    "liveness-spoof",
    "export-leak",
    "editor-escape",
    "arena-context-overreach",
    "api-abuse",
    "deepfake-impersonation",
    "provider-failure",
  ]);
  assert.ok(isThreatClass("export-leak"));
  assert.ok(!isThreatClass("Export-Leak"));
  assert.ok(!isThreatClass(""));
  assert.ok(!isThreatClass("physical-theft"));
});

test("the honesty law: an entry NEVER exists without a stated residual (never zeroed by assertion)", () => {
  assert.equal(validateThreatModelInput({ ...MITIGATED, residual: "" })?.reason, "residual-missing");
  assert.equal(validateThreatModelInput({ ...MITIGATED, residual: "   " })?.reason, "residual-missing");
  // The unmitigated case still states its residual honestly.
  assert.equal(validateThreatModelInput(UNMITIGATED), null);
  // The construct authority carries the same teeth.
  const refused = constructThreatModelEntry({ ...MITIGATED, residual: "", id: "you_threat-model_0001" });
  assert.ok(!refused.ok);
  if (!refused.ok) {
    assert.equal(refused.refusal.reason, "residual-missing");
  }
});

test("the intake validator refuses unknown classes, empty vectors and invalid mitigation refs", () => {
  assert.equal(validateThreatModelInput({ ...MITIGATED, threatClass: "physical-theft" })?.reason, "threat-class-invalid");
  assert.equal(validateThreatModelInput({ ...MITIGATED, vector: "" })?.reason, "vector-empty");
  assert.equal(validateThreatModelInput({ ...MITIGATED, vector: "   " })?.reason, "vector-empty");
  assert.equal(validateThreatModelInput({ ...MITIGATED, mitigationRef: "" as never })?.reason, "mitigation-ref-invalid");
  assert.equal(validateThreatModelInput(MITIGATED), null);
});

test("constructThreatModelEntry freezes the immutable entry (mitigated and unmitigated alike)", () => {
  const mitigated = constructThreatModelEntry({ ...MITIGATED, id: "you_threat-model_0002" });
  assert.ok(mitigated.ok);
  if (mitigated.ok) {
    assert.equal(mitigated.entry.threatClass, "export-leak");
    assert.equal(mitigated.entry.vector, MITIGATED.vector);
    assert.equal(mitigated.entry.mitigationRef, MITIGATED.mitigationRef);
    assert.equal(mitigated.entry.residual, MITIGATED.residual);
    assert.equal(mitigated.entry.simulated, true);
    assert.ok(Object.isFrozen(mitigated.entry));
  }
  const unmitigated = constructThreatModelEntry({ ...UNMITIGATED, id: "you_threat-model_0003" });
  assert.ok(unmitigated.ok);
  if (unmitigated.ok) {
    // mitigationRef null is recorded honestly — never fabricated into a ref.
    assert.equal(unmitigated.entry.mitigationRef, null);
    assert.equal(unmitigated.entry.residual.length > 0, true);
    assert.equal(unmitigated.entry.simulated, true);
    assert.ok(Object.isFrozen(unmitigated.entry));
  }
});
