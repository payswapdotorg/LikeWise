import assert from "node:assert/strict";
import test from "node:test";
import type { CaptureSession, EvidenceRequest } from "./contract.js";
import { createConsentReference } from "./feedback.js";
import {
  buildCaptureGuideSteps,
  CAPTURE_SESSION_TRANSITIONS,
  createCaptureSession,
  isLegalCaptureSessionTransition,
  isTerminalCaptureSessionStatus,
  modalitiesForEvidenceType,
  transitionCaptureSession,
} from "./evidenceCapture.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";

function makeDeps() {
  return { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(42)) };
}

function makeSessionWith(deps: ReturnType<typeof makeDeps>): CaptureSession {
  const steps = buildCaptureGuideSteps({ targetDeficiency: "identity", preferredFraming: "framing A" }, "reference-image", deps.ids);
  return createCaptureSession(
    {
      evidenceRequestId: "you_evidence_request01",
      scope: "USER",
      guideSteps: steps,
      consent: createConsentReference("unknown", false),
      provenanceSource: "test",
    },
    deps,
  );
}

function makeSession(): CaptureSession {
  return makeSessionWith(makeDeps());
}

test("capture session transition table is the frozen machine", () => {
  assert.deepEqual(CAPTURE_SESSION_TRANSITIONS.requested, ["consent-pending", "expired"]);
  assert.deepEqual(CAPTURE_SESSION_TRANSITIONS["consent-pending"], ["active", "declined", "expired"]);
  assert.deepEqual(CAPTURE_SESSION_TRANSITIONS.active, ["completed", "declined", "expired"]);
  assert.deepEqual(CAPTURE_SESSION_TRANSITIONS.completed, []);
  assert.deepEqual(CAPTURE_SESSION_TRANSITIONS.declined, []);
  assert.deepEqual(CAPTURE_SESSION_TRANSITIONS.expired, []);
  assert.equal(isTerminalCaptureSessionStatus("completed"), true);
  assert.equal(isTerminalCaptureSessionStatus("declined"), true);
  assert.equal(isTerminalCaptureSessionStatus("expired"), true);
  assert.equal(isTerminalCaptureSessionStatus("active"), false);
});

test("capture session state machine: all legal transitions succeed and illegal ones throw", () => {
  const deps = makeDeps();
  // requested -> consent-pending -> active -> completed (happy path, one shared clock)
  const session = makeSessionWith(deps);
  assert.equal(session.status, "requested");
  const pending = transitionCaptureSession(session, "consent-pending", deps.clock);
  assert.equal(pending.status, "consent-pending");
  assert.equal(pending.completedAt, null);
  const active = transitionCaptureSession(pending, "active", deps.clock);
  assert.equal(active.status, "active");
  const completed = transitionCaptureSession(active, "completed", deps.clock);
  assert.equal(completed.status, "completed");
  // Only the "completed" transition consumes a clock tick (tick 2 after startedAt).
  assert.equal(completed.completedAt, "2026-01-01T00:00:01.000Z");
  // Alternative legal paths
  const declined = transitionCaptureSession(transitionCaptureSession(makeSession(), "consent-pending", deps.clock), "declined", deps.clock);
  assert.equal(declined.status, "declined");
  assert.equal(declined.completedAt, null);
  const expiredFromPending = transitionCaptureSession(transitionCaptureSession(makeSession(), "consent-pending", deps.clock), "expired", deps.clock);
  assert.equal(expiredFromPending.status, "expired");
  const expiredFromActive = transitionCaptureSession(transitionCaptureSession(transitionCaptureSession(makeSession(), "consent-pending", deps.clock), "active", deps.clock), "expired", deps.clock);
  assert.equal(expiredFromActive.status, "expired");
  const expiredFromRequested = transitionCaptureSession(makeSession(), "expired", deps.clock);
  assert.equal(expiredFromRequested.status, "expired");

  // Illegal transitions throw.
  const illegal: readonly [CaptureSession["status"], CaptureSession["status"]][] = [
    ["requested", "active"],
    ["requested", "completed"],
    ["requested", "declined"],
    ["consent-pending", "completed"],
    ["consent-pending", "consent-pending"],
    ["active", "consent-pending"],
    ["active", "active"],
    ["completed", "active"],
    ["completed", "expired"],
    ["declined", "active"],
    ["expired", "active"],
  ];
  for (const [from, to] of illegal) {
    assert.equal(isLegalCaptureSessionTransition(from, to), false, `${from} -> ${to}`);
    let base: CaptureSession | undefined;
    const deps2 = makeDeps();
    switch (from) {
      case "requested":
        base = makeSession();
        break;
      case "consent-pending":
        base = transitionCaptureSession(makeSession(), "consent-pending", deps2.clock);
        break;
      case "active":
        base = transitionCaptureSession(transitionCaptureSession(makeSession(), "consent-pending", deps2.clock), "active", deps2.clock);
        break;
      case "completed":
        base = transitionCaptureSession(transitionCaptureSession(transitionCaptureSession(makeSession(), "consent-pending", deps2.clock), "active", deps2.clock), "completed", deps2.clock);
        break;
      case "declined":
        base = transitionCaptureSession(transitionCaptureSession(makeSession(), "consent-pending", deps2.clock), "declined", deps2.clock);
        break;
      case "expired":
        base = transitionCaptureSession(makeSession(), "expired", deps2.clock);
        break;
    }
    assert.ok(base !== undefined);
    assert.throws(() => transitionCaptureSession(base as CaptureSession, to, deps2.clock), /illegal capture session transition/, `${from} -> ${to}`);
  }
});

test("transitions return NEW immutable records; the source session is never mutated", () => {
  const deps = makeDeps();
  const session = makeSession();
  const pending = transitionCaptureSession(session, "consent-pending", deps.clock);
  assert.notEqual(session, pending);
  assert.equal(session.status, "requested");
  assert.ok(Object.isFrozen(session));
  assert.ok(Object.isFrozen(pending));
  assert.throws(() => {
    (pending as unknown as { status: string }).status = "completed";
  }, TypeError);
});

test("createCaptureSession requires guide steps and freezes the record", () => {
  const deps = makeDeps();
  assert.throws(
    () =>
      createCaptureSession(
        { evidenceRequestId: null, scope: "USER", guideSteps: [], consent: createConsentReference("unknown", false), provenanceSource: "test" },
        deps,
      ),
    /at least one guide step/,
  );
  const session = makeSession();
  assert.equal(session.evidenceRequestId, "you_evidence_request01");
  assert.equal(session.scope, "USER");
  assert.match(session.id, /^you_capture-session_[0-9a-f]{16}$/);
  assert.equal(session.startedAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(session.provenance.lineage, []);
  assert.ok(Object.isFrozen(session));
  assert.ok(Object.isFrozen(session.guideSteps));
});

test("guide steps are deterministic and sorted by construction order per modality", () => {
  const build = () => buildCaptureGuideSteps({ targetDeficiency: "geometry", preferredFraming: "wide shot" }, "fixture", createRngIdFactory(createDeterministicRng(9)));
  const first = build();
  const second = build();
  assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
  assert.equal(first.length, 1);
  assert.equal(first[0]?.requiredModality, "image");
  assert.equal(first[0]?.targetDeficiency, "geometry");
  assert.equal(first[0]?.preferredFraming, "wide shot");
  assert.match(first[0]?.instruction ?? "", /^capture image evidence \(wide shot\) to resolve "geometry"$/);
  assert.ok(Object.isFrozen(first[0]));

  const multi = buildCaptureGuideSteps(
    { targetDeficiency: "identity", preferredFraming: null, requiredModalities: ["video", "depth", "measurement"] },
    "fixture",
    createRngIdFactory(createDeterministicRng(9)),
  );
  assert.deepEqual(
    multi.map((s) => s.requiredModality),
    ["video", "depth", "measurement"],
  );
  assert.equal(multi[0]?.targetDeficiency, "identity");
  assert.equal(multi[0]?.preferredFraming, null);
  assert.match(multi[1]?.instruction ?? "", /^capture depth evidence /);
});

test("evidence-type to modality mapping is deterministic", () => {
  assert.deepEqual(modalitiesForEvidenceType("reference-image"), ["image"]);
  assert.deepEqual(modalitiesForEvidenceType("reference-video"), ["video"]);
  assert.deepEqual(modalitiesForEvidenceType("measurement"), ["measurement"]);
  assert.deepEqual(modalitiesForEvidenceType("document"), ["document"]);
  assert.deepEqual(modalitiesForEvidenceType("fixture"), ["image"]);
  assert.deepEqual(modalitiesForEvidenceType("unknown-type"), ["image"]);
});

test("guide spec derivation from an EvidenceRequest is lossless", () => {
  const request: EvidenceRequest = {
    id: "you_evidence_request02",
    targetDeficiency: "motion-naturalness",
    evidenceType: "reference-video",
    preferredFraming: "tight framing",
    reason: "test",
    privacyRequirements: "fixture-only",
    retention: "session-only",
    status: "requested",
  };
  const steps = buildCaptureGuideSteps(
    { targetDeficiency: request.targetDeficiency, preferredFraming: request.preferredFraming },
    request.evidenceType,
    createRngIdFactory(createDeterministicRng(3)),
  );
  assert.equal(steps[0]?.requiredModality, "video");
  assert.equal(steps[0]?.targetDeficiency, "motion-naturalness");
  assert.equal(steps[0]?.preferredFraming, "tight framing");
});
