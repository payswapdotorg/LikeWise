import assert from "node:assert/strict";
import test from "node:test";
import type { LearningRightUsage, LearningRecord, OpaqueId } from "@zcode/shared";
import { ConsentRegistry, createConsentPolicy } from "../../../shared/src/you/evidenceConsent.js";
import { LEARNING_RECORD_TRANSITIONS } from "../../../shared/src/you/learningRecord.js";
import { INERT_LEARNING_RIGHTS, learningGrantHash, type LearningGrantFacts } from "../../../shared/src/you/learningRights.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createLearningService, LearningService } from "./learningService.js";
import { createEvidenceService } from "./evidenceService.js";
import { createEvidenceServicePort, createRegistryBackedConsentPort, type LearningConsentPort } from "./learningServiceTypes.js";

const SOLUTION = "you_w6a_service_test";

function must<T>(
  result: { readonly ok: boolean; readonly value?: T; readonly error?: { readonly code: string; readonly message: string } },
  where: string,
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`test failed at ${where}: ${result.error?.code ?? "unknown"}`);
  }
  return result.value;
}

function makeService(seed: string): LearningService {
  return createLearningService({ workspaceIdentity: "ws-w6a-service-test", seed });
}

/** A granted learning-consent instrument registered in a wave-2 ConsentRegistry. */
function grantedRegistry(): { registry: ConsentRegistry; policyId: OpaqueId } {
  const registry = new ConsentRegistry();
  const policy = createConsentPolicy("you_consent-policy_w6atest00000001", {
    purposes: ["solution-generation", "learning"],
    scope: "USER",
    operationalUse: true,
    learningReuse: true,
    retention: { policy: "project-retention", deleteAfter: null, reason: "test" },
    revocable: true,
  });
  registry.registerPolicy(policy);
  registry.recordDecision(policy.id, "granted");
  return { registry, policyId: policy.id };
}

function portFor(registry: ConsentRegistry): LearningConsentPort {
  return createRegistryBackedConsentPort(registry);
}

/** Full happy-path record: signal -> candidate -> validated with live rights. */
function validatedRecord(
  service: LearningService,
  port: LearningConsentPort,
  policyId: OpaqueId,
  options: { readonly usage?: readonly LearningRightUsage[]; readonly seed?: string; readonly kind?: "feedback" } = {},
): string {
  const seed = options.seed ?? "test-record";
  const evidence = must(service.synthesizeLearningContent(SOLUTION, { seedText: `${seed}-evidence` }), "evidence");
  const signal = must(
    service.captureSignal(SOLUTION, { kind: options.kind ?? "feedback", scope: "USER", evidenceRefs: [evidence.contentRef] }),
    "captureSignal",
  ).signal;
  const content = must(service.synthesizeLearningContent(SOLUTION, { seedText: `${seed}-content` }), "content");
  const rights = must(
    service.issueRights(port, { consentRef: policyId, usage: options.usage ?? ["personalization", "tool-selection"] }),
    "issueRights",
  ).rights;
  const record = must(
    service.openCandidateRecord(SOLUTION, {
      signalId: signal.id,
      contentRef: content.contentRef,
      contentHash: content.contentHash,
      rights,
    }),
    "openCandidateRecord",
  ).record;
  must(service.validateRecord(SOLUTION, { recordId: record.id }), "validateRecord");
  return record.id;
}

// ---------------------------------------------------------------------------
// Error taxonomy: the four frozen v6 codes + the state codes
// ---------------------------------------------------------------------------

test("unknown learning records are typed YOU_LEARNING_RECORD_NOT_FOUND (read, validate, reject, use, derive)", () => {
  const service = makeService("errors");
  const { policyId } = grantedRegistry();
  const port = portFor(grantedRegistry().registry);

  const read = service.recordOf(SOLUTION, "you_learning-record_missing00000");
  assert.ok(!read.ok);
  assert.equal(read.error.code, "YOU_LEARNING_RECORD_NOT_FOUND");
  assert.equal(read.error.details["reason"], "unknown-learning-record");
  assert.equal(read.error.details["recordId"], "you_learning-record_missing00000");

  const validated = service.validateRecord(SOLUTION, { recordId: "you_learning-record_missing00000" });
  assert.ok(!validated.ok);
  assert.equal(validated.error.code, "YOU_LEARNING_RECORD_NOT_FOUND");

  const rejected = service.rejectRecord(SOLUTION, { recordId: "you_learning-record_missing00000", reason: "x" });
  assert.ok(!rejected.ok);
  assert.equal(rejected.error.code, "YOU_LEARNING_RECORD_NOT_FOUND");

  const used = service.useRecord(SOLUTION, port, { recordId: "you_learning-record_missing00000", usage: "personalization" });
  assert.ok(!used.ok);
  assert.equal(used.error.code, "YOU_LEARNING_RECORD_NOT_FOUND");

  const derived = service.derivePreference(SOLUTION, port, { recordId: "you_learning-record_missing00000", key: "k", value: "v" });
  assert.ok(!derived.ok);
  assert.equal(derived.error.code, "YOU_LEARNING_RECORD_NOT_FOUND");
  void policyId;
});

test("malformed signals are typed YOU_LEARNING_SIGNAL_INVALID with the stateless reason codes", () => {
  const service = makeService("signal-errors");
  const cases: readonly { readonly input: Parameters<typeof service.captureSignal>[1]; readonly reason: string }[] = [
    { input: { kind: "telepathy" as unknown as "feedback", scope: "USER", evidenceRefs: ["you_content_0000000000000000"] }, reason: "invalid-kind" },
    { input: { kind: "feedback", scope: "user" as unknown as "USER", evidenceRefs: ["you_content_0000000000000000"] }, reason: "invalid-scope" },
    { input: { kind: "feedback", scope: "USER", evidenceRefs: [] }, reason: "empty-evidence-refs" },
    { input: { kind: "feedback", scope: "USER", evidenceRefs: [""] }, reason: "invalid-evidence-ref" },
    { input: { kind: "feedback", scope: "USER", evidenceRefs: [" you_content_0000000000000000"] }, reason: "invalid-evidence-ref" },
    {
      input: { kind: "feedback", scope: "USER", evidenceRefs: ["you_content_0000000000000000", "you_content_0000000000000000"] },
      reason: "invalid-evidence-ref",
    },
    { input: { kind: "feedback", scope: "USER", evidenceRefs: ["you_content_0000000000000000"], subjectRef: "" }, reason: "invalid-subject-ref" },
  ];
  for (const testCase of cases) {
    const outcome = service.captureSignal(SOLUTION, testCase.input);
    assert.ok(!outcome.ok, JSON.stringify(testCase.input));
    assert.equal(outcome.error.code, "YOU_LEARNING_SIGNAL_INVALID");
    assert.equal(outcome.error.details["reason"], testCase.reason);
  }
  // Nothing was captured by the refused intakes.
  assert.equal(service.signalsOf(SOLUTION).length, 0);
});

test("preference scope violations are typed YOU_PREFERENCE_SCOPE_INVALID (literal + mismatch)", () => {
  const service = makeService("pref-errors");
  const { registry, policyId } = grantedRegistry();
  const port = portFor(registry);
  const recordId = validatedRecord(service, port, policyId, { seed: "pref-errors" });

  const badLiteral = service.setOperatorPreference(SOLUTION, { scope: "planet" as unknown as "USER", key: "k", value: "v" });
  assert.ok(!badLiteral.ok);
  assert.equal(badLiteral.error.code, "YOU_PREFERENCE_SCOPE_INVALID");
  assert.equal(badLiteral.error.details["reason"], "invalid-scope");

  const mismatch = service.derivePreference(SOLUTION, port, { recordId, key: "k", value: "v", scope: "TENANT" });
  assert.ok(!mismatch.ok);
  assert.equal(mismatch.error.code, "YOU_PREFERENCE_SCOPE_INVALID");
  assert.equal(mismatch.error.details["reason"], "scope-mismatch");

  // Structural intake refusals stay YOU_INVALID_STATE.
  const badKey = service.setOperatorPreference(SOLUTION, { scope: "USER", key: " padded", value: "v" });
  assert.ok(!badKey.ok);
  assert.equal(badKey.error.code, "YOU_INVALID_STATE");
  assert.equal(badKey.error.details["reason"], "invalid-key");
});

// ---------------------------------------------------------------------------
// The validation ladder at the service seam
// ---------------------------------------------------------------------------

test("the service enforces the ladder transition table with typed refusals and no state change", () => {
  assert.deepEqual(LEARNING_RECORD_TRANSITIONS, {
    candidate: ["validated", "rejected"],
    validated: ["superseded"],
    rejected: [],
    superseded: [],
  });

  const service = makeService("ladder");
  const { registry, policyId } = grantedRegistry();
  const port = portFor(registry);
  const recordId = validatedRecord(service, port, policyId, { seed: "ladder" });

  // Double validation refuses (validated is only supersedeable).
  const again = service.validateRecord(SOLUTION, { recordId });
  assert.ok(!again.ok);
  assert.equal(again.error.code, "YOU_INVALID_STATE");
  assert.equal(again.error.details["reason"], "record-not-candidate");
  assert.equal(again.error.details["status"], "validated");

  // Rejecting a validated record refuses.
  const rejectValidated = service.rejectRecord(SOLUTION, { recordId, reason: "x" });
  assert.ok(!rejectValidated.ok);
  assert.equal(rejectValidated.error.code, "YOU_INVALID_STATE");

  // Superseding a NON-validated target refuses (only validated records supersede).
  const evidence = must(service.synthesizeLearningContent(SOLUTION, { seedText: "ladder-candidate-evidence" }), "evidence");
  const signal = must(
    service.captureSignal(SOLUTION, { kind: "edit-session", scope: "USER", evidenceRefs: [evidence.contentRef] }),
    "captureSignal:candidate",
  ).signal;
  const content = must(service.synthesizeLearningContent(SOLUTION, { seedText: "ladder-candidate-content" }), "content");
  const candidate = must(
    service.openCandidateRecord(SOLUTION, { signalId: signal.id, contentRef: content.contentRef, contentHash: content.contentHash }),
    "openCandidateRecord",
  ).record;
  const evidence2 = must(service.synthesizeLearningContent(SOLUTION, { seedText: "ladder-candidate2-evidence" }), "evidence2");
  const signal2 = must(
    service.captureSignal(SOLUTION, { kind: "feedback", scope: "USER", evidenceRefs: [evidence2.contentRef] }),
    "captureSignal:candidate2",
  ).signal;
  const content2 = must(service.synthesizeLearningContent(SOLUTION, { seedText: "ladder-candidate2-content" }), "content2");
  const candidate2 = must(
    service.openCandidateRecord(SOLUTION, { signalId: signal2.id, contentRef: content2.contentRef, contentHash: content2.contentHash }),
    "openCandidateRecord:2",
  ).record;
  const supersedeCandidateTarget = service.validateRecord(SOLUTION, { recordId: candidate2.id, supersedesRecordId: candidate.id });
  assert.ok(!supersedeCandidateTarget.ok);
  assert.equal(supersedeCandidateTarget.error.code, "YOU_INVALID_STATE");
  assert.equal(supersedeCandidateTarget.error.details["reason"], "record-not-validated");

  // Self-supersession refuses (the record must be a candidate; the target must differ).
  const self = service.validateRecord(SOLUTION, { recordId: candidate2.id, supersedesRecordId: candidate2.id });
  assert.ok(!self.ok);
  assert.equal(self.error.code, "YOU_INVALID_STATE");
  assert.equal(self.error.details["reason"], "self-supersession");

  // Superseding an unknown record is YOU_LEARNING_RECORD_NOT_FOUND.
  const unknownTarget = service.validateRecord(SOLUTION, { recordId: candidate.id, supersedesRecordId: "you_learning-record_missing00000" });
  assert.ok(!unknownTarget.ok);
  assert.equal(unknownTarget.error.code, "YOU_LEARNING_RECORD_NOT_FOUND");

  // The refusing calls left the record untouched.
  const record = must(service.recordOf(SOLUTION, recordId), "recordOf").record;
  assert.equal(record.status, "validated");
  assert.equal(record.supersededById, null);
});

test("candidate -> validated | rejected transitions append ledger events; supersession links without mutation", () => {
  const service = makeService("ladder-events");
  const { registry, policyId } = grantedRegistry();
  const port = portFor(registry);

  // A is validated; B stays a candidate until its superseding validation.
  const recordIdA = validatedRecord(service, port, policyId, { seed: "ladder-a" });
  const rightsB = must(service.issueRights(port, { consentRef: policyId, usage: ["pipeline-improvement"] }), "issueRights:B").rights;
  const evidenceB = must(service.synthesizeLearningContent(SOLUTION, { seedText: "ladder-b-evidence" }), "evidenceB");
  const signalB = must(
    service.captureSignal(SOLUTION, { kind: "repeated-intent", scope: "USER", evidenceRefs: [evidenceB.contentRef] }),
    "captureSignal:B",
  ).signal;
  const contentB = must(service.synthesizeLearningContent(SOLUTION, { seedText: "ladder-b-content" }), "contentB");
  const recordIdB = must(
    service.openCandidateRecord(SOLUTION, { signalId: signalB.id, contentRef: contentB.contentRef, contentHash: contentB.contentHash, rights: rightsB }),
    "openCandidateRecord:B",
  ).record.id;

  const eventsBefore = must(service.ledgerEventsOf(SOLUTION), "eventsBefore");
  const supersededInstanceBefore = must(service.recordOf(SOLUTION, recordIdA), "recordBefore").record;

  const supersession = must(service.validateRecord(SOLUTION, { recordId: recordIdB, supersedesRecordId: recordIdA }), "supersede");
  assert.equal(supersession.superseded?.status, "superseded");
  assert.equal(supersession.superseded?.supersededById, recordIdB);
  assert.equal(supersession.record.status, "validated");

  // The pre-supersession instance is untouched (append-only linkage, never in-place mutation).
  assert.equal(supersededInstanceBefore.status, "validated");
  assert.equal(supersededInstanceBefore.supersededById, null);

  // Exactly one event was appended; every earlier event is a stable prefix.
  const eventsAfter = must(service.ledgerEventsOf(SOLUTION), "eventsAfter");
  assert.equal(eventsAfter.length, eventsBefore.length + 1);
  assert.deepEqual(eventsAfter.slice(0, eventsBefore.length), eventsBefore);
  assert.equal(eventsAfter[eventsAfter.length - 1]?.type, "learning-record-validated");
  assert.equal(eventsAfter[eventsAfter.length - 1]?.payload["supersedesRecordId"], recordIdA);

  // The rejected path appends learning-record-rejected.
  const evidence = must(service.synthesizeLearningContent(SOLUTION, { seedText: "ladder-reject-evidence" }), "evidence");
  const signal = must(
    service.captureSignal(SOLUTION, { kind: "expert-intervention", scope: "USER", evidenceRefs: [evidence.contentRef] }),
    "captureSignal:reject",
  ).signal;
  const content = must(service.synthesizeLearningContent(SOLUTION, { seedText: "ladder-reject-content" }), "content");
  const doomed = must(
    service.openCandidateRecord(SOLUTION, { signalId: signal.id, contentRef: content.contentRef, contentHash: content.contentHash }),
    "openCandidateRecord:doomed",
  ).record;
  const rejected = must(service.rejectRecord(SOLUTION, { recordId: doomed.id, reason: "test-rejection" }), "rejectRecord");
  assert.equal(rejected.record.status, "rejected");
  const finalEvents = must(service.ledgerEventsOf(SOLUTION), "finalEvents");
  assert.equal(finalEvents[finalEvents.length - 1]?.type, "learning-record-rejected");
  assert.equal(finalEvents[finalEvents.length - 1]?.payload["reason"], "test-rejection");
});

// ---------------------------------------------------------------------------
// Rights enforcement (the RIGHTS LAW)
// ---------------------------------------------------------------------------

test("records without rights are inert: the inert grant refuses every usage", () => {
  const service = makeService("inert");
  const { registry, policyId } = grantedRegistry();
  const port = portFor(registry);
  void policyId;

  const evidence = must(service.synthesizeLearningContent(SOLUTION, { seedText: "inert-evidence" }), "evidence");
  const signal = must(
    service.captureSignal(SOLUTION, { kind: "edit-session", scope: "USER", evidenceRefs: [evidence.contentRef] }),
    "captureSignal",
  ).signal;
  const content = must(service.synthesizeLearningContent(SOLUTION, { seedText: "inert-content" }), "content");
  const record = must(
    service.openCandidateRecord(SOLUTION, { signalId: signal.id, contentRef: content.contentRef, contentHash: content.contentHash, rights: null }),
    "openCandidateRecord",
  ).record;
  assert.deepEqual(record.rights, INERT_LEARNING_RIGHTS);
  must(service.validateRecord(SOLUTION, { recordId: record.id }), "validateRecord");

  for (const usage of ["organization-improvement", "tool-selection", "personalization"] as const) {
    const outcome = service.useRecord(SOLUTION, port, { recordId: record.id, usage });
    assert.ok(!outcome.ok, usage);
    assert.equal(outcome.error.code, "YOU_LEARNING_RIGHTS_REQUIRED");
    assert.equal(outcome.error.details["reason"], "rights-inert");
  }
});

test("usage outside the grant refuses with usage-not-granted (the grant lists its classes)", () => {
  const service = makeService("outside-grant");
  const { registry, policyId } = grantedRegistry();
  const port = portFor(registry);
  const recordId = validatedRecord(service, port, policyId, { seed: "outside", usage: ["tool-selection"] });

  const outcome = service.useRecord(SOLUTION, port, { recordId, usage: "personalization" });
  assert.ok(!outcome.ok);
  assert.equal(outcome.error.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(outcome.error.details["reason"], "usage-not-granted");

  const within = service.useRecord(SOLUTION, port, { recordId, usage: "tool-selection" });
  assert.ok(within.ok);
});

test("rights issuance enforces the live wave-2 grant (no second consent path)", () => {
  const service = makeService("issuance");
  const registry = new ConsentRegistry();

  // Unresolvable ref.
  const unresolvable = service.issueRights(portFor(registry), { consentRef: "you_consent-policy_missing00000", usage: ["tool-selection"] });
  assert.ok(!unresolvable.ok);
  assert.equal(unresolvable.error.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(unresolvable.error.details["reason"], "consent-unresolvable");

  // Undecided state.
  const undecidedPolicy = createConsentPolicy("you_consent-policy_w6atest00000002", {
    purposes: ["learning"],
    scope: "USER",
    operationalUse: true,
    learningReuse: true,
    retention: { policy: "project-retention", deleteAfter: null, reason: "test" },
    revocable: true,
  });
  registry.registerPolicy(undecidedPolicy);
  const undecided = service.issueRights(portFor(registry), { consentRef: undecidedPolicy.id, usage: ["tool-selection"] });
  assert.ok(!undecided.ok);
  assert.equal(undecided.error.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(undecided.error.details["reason"], "consent-unknown");

  // Granted but no learning reuse.
  const noReusePolicy = createConsentPolicy("you_consent-policy_w6atest00000003", {
    purposes: ["learning"],
    scope: "USER",
    operationalUse: true,
    learningReuse: false,
    retention: { policy: "project-retention", deleteAfter: null, reason: "test" },
    revocable: true,
  });
  registry.registerPolicy(noReusePolicy);
  registry.recordDecision(noReusePolicy.id, "granted");
  const noReuse = service.issueRights(portFor(registry), { consentRef: noReusePolicy.id, usage: ["tool-selection"] });
  assert.ok(!noReuse.ok);
  assert.equal(noReuse.error.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(noReuse.error.details["reason"], "learning-reuse-not-permitted");

  // Granted, learning reuse, but the "learning" purpose is not covered.
  const noPurposePolicy = createConsentPolicy("you_consent-policy_w6atest00000004", {
    purposes: ["export"],
    scope: "USER",
    operationalUse: true,
    learningReuse: true,
    retention: { policy: "project-retention", deleteAfter: null, reason: "test" },
    revocable: true,
  });
  registry.registerPolicy(noPurposePolicy);
  registry.recordDecision(noPurposePolicy.id, "granted");
  const noPurpose = service.issueRights(portFor(registry), { consentRef: noPurposePolicy.id, usage: ["tool-selection"] });
  assert.ok(!noPurpose.ok);
  assert.equal(noPurpose.error.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(noPurpose.error.details["reason"], "purpose-not-covered");

  // Structural intake refusals stay YOU_INVALID_STATE (a fully granted instrument).
  const fullPolicy = createConsentPolicy("you_consent-policy_w6atest00000005", {
    purposes: ["learning"],
    scope: "USER",
    operationalUse: true,
    learningReuse: true,
    retention: { policy: "project-retention", deleteAfter: null, reason: "test" },
    revocable: true,
  });
  registry.registerPolicy(fullPolicy);
  registry.recordDecision(fullPolicy.id, "granted");
  const badUsage = service.issueRights(portFor(registry), { consentRef: fullPolicy.id, usage: ["telekinesis" as unknown as "tool-selection"] });
  assert.ok(!badUsage.ok);
  assert.equal(badUsage.error.code, "YOU_INVALID_STATE");
  const granted = service.issueRights(portFor(registry), { consentRef: fullPolicy.id, usage: ["tool-selection"] });
  assert.ok(granted.ok);
});

test("consent withdrawal and expiry block usage live (fail closed); expiry on the rights refuses", () => {
  const service = makeService("withdrawal");
  const { registry, policyId } = grantedRegistry();
  const port = portFor(registry);
  const recordId = validatedRecord(service, port, policyId, { seed: "withdrawal" });

  // Live usage works before withdrawal.
  assert.ok(service.useRecord(SOLUTION, port, { recordId, usage: "personalization" }).ok);

  registry.withdraw(policyId);
  const withdrawn = service.useRecord(SOLUTION, port, { recordId, usage: "personalization" });
  assert.ok(!withdrawn.ok);
  assert.equal(withdrawn.error.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(withdrawn.error.details["reason"], "consent-withdrawn");

  // A second instrument: granted now, expired later (the registry's expiry path).
  const expiringPolicy = createConsentPolicy("you_consent-policy_w6atest00000005", {
    purposes: ["learning"],
    scope: "USER",
    operationalUse: true,
    learningReuse: true,
    retention: { policy: "project-retention", deleteAfter: null, reason: "test" },
    revocable: true,
  });
  registry.registerPolicy(expiringPolicy);
  registry.recordDecision(expiringPolicy.id, "granted");
  const expiringRecordId = validatedRecord(service, port, expiringPolicy.id, { seed: "expiring" });
  assert.ok(service.useRecord(SOLUTION, port, { recordId: expiringRecordId, usage: "personalization" }).ok);
  registry.expire(expiringPolicy.id);
  const expired = service.useRecord(SOLUTION, port, { recordId: expiringRecordId, usage: "personalization" });
  assert.ok(!expired.ok);
  assert.equal(expired.error.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(expired.error.details["reason"], "consent-expired");

  // Rights-level expiry: the grant is live but the RIGHTS carry a past expiresAt
  // (issued under a still-granted instrument).
  const lastingPolicy = createConsentPolicy("you_consent-policy_w6atest00000006", {
    purposes: ["learning"],
    scope: "USER",
    operationalUse: true,
    learningReuse: true,
    retention: { policy: "project-retention", deleteAfter: null, reason: "test" },
    revocable: true,
  });
  registry.registerPolicy(lastingPolicy);
  registry.recordDecision(lastingPolicy.id, "granted");
  const pastRights = must(
    service.issueRights(port, { consentRef: lastingPolicy.id, usage: ["tool-selection"], expiresAt: "2020-01-01T00:00:00.000Z" }),
    "issueRights:past",
  ).rights;
  const evidence = must(service.synthesizeLearningContent(SOLUTION, { seedText: "rights-expiry-evidence" }), "evidence");
  const signal = must(
    service.captureSignal(SOLUTION, { kind: "repeated-intent", scope: "USER", evidenceRefs: [evidence.contentRef] }),
    "captureSignal:expiry",
  ).signal;
  const content = must(service.synthesizeLearningContent(SOLUTION, { seedText: "rights-expiry-content" }), "content");
  const expiredRightsRecord = must(
    service.openCandidateRecord(SOLUTION, { signalId: signal.id, contentRef: content.contentRef, contentHash: content.contentHash, rights: pastRights }),
    "openCandidateRecord:expiry",
  ).record;
  must(service.validateRecord(SOLUTION, { recordId: expiredRightsRecord.id }), "validateRecord:expiry");
  const rightsExpired = service.useRecord(SOLUTION, port, { recordId: expiredRightsRecord.id, usage: "tool-selection" });
  assert.ok(!rightsExpired.ok);
  assert.equal(rightsExpired.error.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(rightsExpired.error.details["reason"], "rights-expired");
});

test("a changed grant (hash mismatch) refuses: the rights bind the issuance facts", () => {
  const service = makeService("hash-mismatch");
  const { registry, policyId } = grantedRegistry();
  const port = portFor(registry);
  const recordId = validatedRecord(service, port, policyId, { seed: "hash" });

  // A port that serves DIFFERENT facts for the same ref (a re-registered
  // policy under the same id — the recorded consentHash no longer matches).
  const originalRecord = must(service.recordOf(SOLUTION, recordId), "recordOf").record;
  const changedFacts: LearningGrantFacts = {
    policyId,
    state: "granted",
    scope: "USER",
    purposes: ["learning", "export", "solution-generation"],
    learningReuse: true,
    operationalUse: true,
  };
  assert.notEqual(learningGrantHash(changedFacts), originalRecord.rights.consentHash);
  const changedPort: LearningConsentPort = { resolveLearningGrant: (ref) => (ref === policyId ? changedFacts : null) };

  const outcome = service.useRecord(SOLUTION, changedPort, { recordId, usage: "personalization" });
  assert.ok(!outcome.ok);
  assert.equal(outcome.error.code, "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(outcome.error.details["reason"], "consent-hash-mismatch");

  // The unchanged port still allows the same usage.
  assert.ok(service.useRecord(SOLUTION, port, { recordId, usage: "personalization" }).ok);
});

test("the evidence-service port resolves live grants over the public wave-2 API", () => {
  const service = makeService("evidence-port");
  const evidence = createEvidenceService({ workspaceIdentity: "ws-w6a-port-test", seed: "port-test" });
  const policy = must(
    evidence.registerConsentPolicy(SOLUTION, {
      purposes: ["solution-generation", "learning"],
      scope: "USER",
      operationalUse: true,
      learningReuse: true,
      retention: { policy: "project-retention", deleteAfter: null, reason: "test" },
      revocable: true,
    }),
    "registerConsentPolicy",
  ).policy;
  must(evidence.grantConsent(SOLUTION, policy.id), "grantConsent");
  const port = createEvidenceServicePort(evidence, SOLUTION, [policy]);

  const grant = port.resolveLearningGrant(policy.id);
  assert.ok(grant !== null);
  assert.equal(grant.state, "granted");
  assert.equal(grant.learningReuse, true);
  assert.deepEqual([...grant.purposes].sort(), ["learning", "solution-generation"]);
  assert.equal(port.resolveLearningGrant("you_consent-policy_missing00000"), null);

  const recordId = validatedRecord(service, port, policy.id, { seed: "port" });
  assert.ok(service.useRecord(SOLUTION, port, { recordId, usage: "personalization" }).ok);
  must(evidence.withdrawConsent(SOLUTION, policy.id), "withdrawConsent");
  const refused = service.useRecord(SOLUTION, port, { recordId, usage: "personalization" });
  assert.ok(!refused.ok);
  assert.equal(refused.error.details["reason"], "consent-withdrawn");
});

// ---------------------------------------------------------------------------
// Preference projections (lineage; never mutate the ledger)
// ---------------------------------------------------------------------------

test("preference derivation carries lineage, upserts by scope+key and never mutates the ledger", () => {
  const service = makeService("preferences");
  const { registry, policyId } = grantedRegistry();
  const port = portFor(registry);
  const recordId = validatedRecord(service, port, policyId, { seed: "preferences" });

  const recordsBefore = service.recordsOf(SOLUTION).map((record) => stableStringify(record));
  const eventsBefore = must(service.ledgerEventsOf(SOLUTION), "eventsBefore");

  const first = must(
    service.derivePreference(SOLUTION, port, { recordId, key: "preferred-editor", value: "fixture-editor-v1" }),
    "derivePreference:first",
  ).preference;
  assert.equal(first.derivedFromRecordId, recordId);
  assert.equal(first.scope, "USER");

  // Upsert: the second derivation replaces the projection value, keeps the lineage.
  const second = must(
    service.derivePreference(SOLUTION, port, { recordId, key: "preferred-editor", value: "fixture-editor-v2" }),
    "derivePreference:second",
  );
  assert.equal(second.previous?.value, "fixture-editor-v1");
  assert.equal(second.preference.derivedFromRecordId, recordId);
  assert.equal(second.preference.value, "fixture-editor-v2");

  const live = service.preferenceOf(SOLUTION, "USER", "preferred-editor");
  assert.ok(live !== null);
  assert.equal(live.value, "fixture-editor-v2");
  assert.equal(live.id, second.preference.id);
  assert.equal(service.preferencesOf(SOLUTION).length, 1);

  // Projections never mutate the ledger: record state identical; earlier
  // events are a stable prefix (only preference-updated appends).
  const recordsAfter = service.recordsOf(SOLUTION).map((record) => stableStringify(record));
  assert.deepEqual(recordsAfter, recordsBefore);
  const eventsAfter = must(service.ledgerEventsOf(SOLUTION), "eventsAfter");
  assert.equal(eventsAfter.length, eventsBefore.length + 2);
  assert.deepEqual(eventsAfter.slice(0, eventsBefore.length), eventsBefore);
  for (const appended of eventsAfter.slice(eventsBefore.length)) {
    assert.equal(appended.type, "preference-updated");
  }

  // Only validated records project; candidates refuse with the state code.
  const evidence = must(service.synthesizeLearningContent(SOLUTION, { seedText: "pref-candidate-evidence" }), "evidence");
  const signal = must(
    service.captureSignal(SOLUTION, { kind: "manual-takeover", scope: "USER", evidenceRefs: [evidence.contentRef] }),
    "captureSignal:candidate",
  ).signal;
  const content = must(service.synthesizeLearningContent(SOLUTION, { seedText: "pref-candidate-content" }), "content");
  const candidate = must(
    service.openCandidateRecord(SOLUTION, { signalId: signal.id, contentRef: content.contentRef, contentHash: content.contentHash }),
    "openCandidateRecord:candidate",
  ).record;
  const fromCandidate = service.derivePreference(SOLUTION, port, { recordId: candidate.id, key: "k", value: "v" });
  assert.ok(!fromCandidate.ok);
  assert.equal(fromCandidate.error.code, "YOU_INVALID_STATE");
  assert.equal(fromCandidate.error.details["reason"], "record-not-validated");
});

// ---------------------------------------------------------------------------
// Trajectories
// ---------------------------------------------------------------------------

test("trajectory references record ordered content-addressed steps and replay byte-identically", () => {
  const service = makeService("trajectory");
  const stepsA = must(service.synthesizeTrajectorySteps(SOLUTION, { seedText: "traj", stepCount: 3 }), "stepsA").stepRefs;
  const stepsB = must(service.synthesizeTrajectorySteps(SOLUTION, { seedText: "traj", stepCount: 3 }), "stepsB").stepRefs;
  assert.deepEqual(stepsA, stepsB); // same seed => same content-addressed refs

  const trajectory = must(service.recordTrajectory(SOLUTION, { scope: "TASK", stepRefs: stepsA }), "recordTrajectory").trajectory;
  assert.equal(trajectory.stepRefs.length, 3);
  assert.equal(trajectory.simulated, true);

  const replayA = must(service.replayTrajectory(SOLUTION, trajectory.id), "replayA");
  const replayB = must(service.replayTrajectory(SOLUTION, trajectory.id), "replayB");
  assert.equal(replayA.replayHash, replayB.replayHash);
  assert.deepEqual(Buffer.from(replayA.bytes), Buffer.from(replayB.bytes));
  assert.equal(replayA.bytes.byteLength, 3 * 256);

  // Different seed => different replay.
  const otherSteps = must(service.synthesizeTrajectorySteps(SOLUTION, { seedText: "other", stepCount: 3 }), "otherSteps").stepRefs;
  const other = must(service.recordTrajectory(SOLUTION, { scope: "TASK", stepRefs: otherSteps }), "otherTrajectory").trajectory;
  const otherReplay = must(service.replayTrajectory(SOLUTION, other.id), "otherReplay");
  assert.notEqual(otherReplay.replayHash, replayA.replayHash);

  // Malformed step refs refuse.
  const badSteps = service.recordTrajectory(SOLUTION, { scope: "TASK", stepRefs: [] });
  assert.ok(!badSteps.ok);
  assert.equal(badSteps.error.code, "YOU_INVALID_STATE");
  assert.equal(badSteps.error.details["reason"], "empty-step-refs");

  // Unknown trajectory refuses.
  const unknown = service.replayTrajectory(SOLUTION, "you_learning-trajectory_missing");
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.code, "YOU_INVALID_STATE");
  assert.equal(unknown.error.details["reason"], "unknown-trajectory");
});

// ---------------------------------------------------------------------------
// Determinism + the ledger readout
// ---------------------------------------------------------------------------

test("the service is deterministic for a fixed seed: identical ids, timestamps and ledger hash", () => {
  const run = (): string => {
    const service = makeService("determinism");
    const { registry, policyId } = grantedRegistry();
    const port = portFor(registry);
    const recordId = validatedRecord(service, port, policyId, { seed: "determinism" });
    must(service.derivePreference(SOLUTION, port, { recordId, key: "preferred-editor", value: "fixture-editor" }), "derivePreference");
    return must(service.serializeLedgerOf(SOLUTION), "serializeLedgerOf");
  };
  assert.equal(run(), run());
});

test("the live LEDGER projection equals the replay fold exactly (append-only state reproduction)", () => {
  const service = makeService("projection");
  const { registry, policyId } = grantedRegistry();
  const port = portFor(registry);

  const recordIdA = validatedRecord(service, port, policyId, { seed: "projection-a" });
  // B stays a candidate; its validation supersedes A.
  const rightsB = must(service.issueRights(port, { consentRef: policyId, usage: ["pipeline-improvement"] }), "issueRights:B").rights;
  const evidenceB = must(service.synthesizeLearningContent(SOLUTION, { seedText: "projection-b-evidence" }), "evidenceB");
  const signalB = must(
    service.captureSignal(SOLUTION, { kind: "capability-gap", scope: "USER", evidenceRefs: [evidenceB.contentRef] }),
    "captureSignal:B",
  ).signal;
  const contentB = must(service.synthesizeLearningContent(SOLUTION, { seedText: "projection-b-content" }), "contentB");
  const recordIdB = must(
    service.openCandidateRecord(SOLUTION, { signalId: signalB.id, contentRef: contentB.contentRef, contentHash: contentB.contentHash, rights: rightsB }),
    "openCandidateRecord:B",
  ).record.id;
  must(service.validateRecord(SOLUTION, { recordId: recordIdB, supersedesRecordId: recordIdA }), "supersede");
  must(
    service.setOperatorPreference(SOLUTION, { scope: "GLOBAL", key: "organization-baseline", value: "fixture-baseline" }),
    "setOperatorPreference",
  );

  // An open candidate stays OUT of the ledger projection (pre-validation service state).
  const evidence = must(service.synthesizeLearningContent(SOLUTION, { seedText: "projection-candidate-evidence" }), "evidence");
  const signal = must(
    service.captureSignal(SOLUTION, { kind: "capability-gap", scope: "USER", evidenceRefs: [evidence.contentRef] }),
    "captureSignal:candidate",
  ).signal;
  const content = must(service.synthesizeLearningContent(SOLUTION, { seedText: "projection-candidate-content" }), "content");
  must(
    service.openCandidateRecord(SOLUTION, { signalId: signal.id, contentRef: content.contentRef, contentHash: content.contentHash }),
    "openCandidateRecord:candidate",
  );

  const events = must(service.ledgerEventsOf(SOLUTION), "ledgerEventsOf");
  const projection = must(service.projectionOf(SOLUTION), "projectionOf");
  const replayed = LearningService.replay(events);
  assert.equal(stableStringify(projection), stableStringify(replayed));

  const record = projection.records[recordIdB];
  assert.ok(record !== undefined);
  assert.equal(record.status, "validated");
  assert.equal(projection.records[recordIdA]?.status, "superseded");
  assert.equal(projection.records[recordIdA]?.supersededById, recordIdB);
  assert.ok(projection.preferences["GLOBAL::organization-baseline"] !== undefined);
});

test("records and signals are served frozen; store listings are sorted by id", () => {
  const service = makeService("frozen");
  const { registry, policyId } = grantedRegistry();
  const port = portFor(registry);
  const recordId = validatedRecord(service, port, policyId, { seed: "frozen" });

  const record: LearningRecord = must(service.recordOf(SOLUTION, recordId), "recordOf").record;
  assert.ok(Object.isFrozen(record));
  assert.ok(Object.isFrozen(record.rights));
  assert.ok(Object.isFrozen(record.rights.usage));
  assert.throws(() => {
    (record as { status: string }).status = "rejected";
  }, TypeError);

  const signal = must(service.signalOf(SOLUTION, record.signalId), "signalOf").signal;
  assert.ok(Object.isFrozen(signal));
  assert.ok(Object.isFrozen(signal.evidenceRefs));

  const recordIds = service.recordsOf(SOLUTION).map((entry) => entry.id);
  assert.deepEqual(recordIds, [...recordIds].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)));
  const signalIds = service.signalsOf(SOLUTION).map((entry) => entry.id);
  assert.deepEqual(signalIds, [...signalIds].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)));
});
