// YOU guided capture session state machine (W2A — docs/you/CONTRACTS.md
// "Evidence / capture / consent", wave-2 freeze).
//
// A CaptureSession is a guided capture flow bound to an EvidenceRequest
// (or spontaneous). Status truth = the evidence application service; this
// module owns the pure transition table and the CaptureGuideStep
// construction helpers. Records are immutable: every transition returns a
// NEW CaptureSession (deep-frozen), never an in-place mutation.
//
// Legal transitions:
//   requested       -> consent-pending | expired
//   consent-pending -> active | declined | expired
//   active          -> completed | declined | expired
//   completed / declined / expired are terminal.

import type {
  AuthorType,
  CaptureGuideStep,
  CaptureModality,
  CaptureSession,
  CaptureSessionStatus,
  ConsentReference,
  EvidenceRequest,
  EvidenceType,
  LearningScope,
  OpaqueId,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { deepFreeze } from "./serialize.js";

export const CAPTURE_SESSION_TRANSITIONS: Readonly<
  Record<CaptureSessionStatus, readonly CaptureSessionStatus[]>
> = {
  requested: ["consent-pending", "expired"],
  "consent-pending": ["active", "declined", "expired"],
  active: ["completed", "declined", "expired"],
  completed: [],
  declined: [],
  expired: [],
};

export function isTerminalCaptureSessionStatus(status: CaptureSessionStatus): boolean {
  return CAPTURE_SESSION_TRANSITIONS[status].length === 0;
}

export function isLegalCaptureSessionTransition(from: CaptureSessionStatus, to: CaptureSessionStatus): boolean {
  return CAPTURE_SESSION_TRANSITIONS[from].includes(to);
}

/** Returns a NEW CaptureSession with the status transitioned (immutable). */
export function transitionCaptureSession(
  session: CaptureSession,
  status: CaptureSessionStatus,
  clock: YouClock,
): CaptureSession {
  if (!isLegalCaptureSessionTransition(session.status, status)) {
    throw new Error(`illegal capture session transition ${session.status} -> ${status}`);
  }
  return deepFreeze({
    ...session,
    status,
    completedAt: status === "completed" ? clock.now() : session.completedAt,
  });
}

export interface CaptureSessionIntake {
  readonly evidenceRequestId: OpaqueId | null;
  readonly scope: LearningScope;
  readonly guideSteps: readonly CaptureGuideStep[];
  readonly consent: ConsentReference;
  readonly provenanceSource: string;
  readonly generator?: AuthorType;
}

/** Creates an immutable CaptureSession (initial status "requested"). */
export function createCaptureSession(
  intake: CaptureSessionIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): CaptureSession {
  if (intake.guideSteps.length === 0) {
    throw new Error("CaptureSession requires at least one guide step");
  }
  const startedAt = deps.clock.now();
  return deepFreeze({
    id: deps.ids.next("capture-session"),
    evidenceRequestId: intake.evidenceRequestId,
    scope: intake.scope,
    guideSteps: Object.freeze([...intake.guideSteps]),
    status: "requested",
    consent: intake.consent,
    startedAt,
    completedAt: null,
    provenance: deepFreeze({
      source: intake.provenanceSource,
      generator: intake.generator ?? "user",
      createdAt: startedAt,
      lineage: Object.freeze([]),
    }),
  });
}

/** Deterministic evidence-type -> capture modality mapping (fixture definition). */
export const EVIDENCE_TYPE_MODALITIES: Readonly<Record<string, readonly CaptureModality[]>> = {
  "reference-image": ["image"],
  "reference-video": ["video"],
  measurement: ["measurement"],
  document: ["document"],
  fixture: ["image"],
};

export function modalitiesForEvidenceType(evidenceType: EvidenceType): readonly CaptureModality[] {
  return EVIDENCE_TYPE_MODALITIES[evidenceType] ?? ["image"];
}

export interface CaptureGuideSpec {
  /** Deficiency the capture should resolve (from the EvidenceRequest when bound). */
  readonly targetDeficiency?: string | null;
  readonly preferredFraming?: string | null;
  /** Ordered modalities; defaults to the evidence-type mapping. */
  readonly requiredModalities?: readonly CaptureModality[];
}

/**
 * Builds deterministic CaptureGuideSteps: one step per required modality,
 * instruction text derived only from the spec (stable wording, no ambient
 * input). Step order follows the modality order given.
 */
export function buildCaptureGuideSteps(
  spec: CaptureGuideSpec,
  evidenceType: EvidenceType,
  deps: YouIdFactory,
): CaptureGuideStep[] {
  const modalities = spec.requiredModalities ?? modalitiesForEvidenceType(evidenceType);
  if (modalities.length === 0) {
    throw new Error("capture guide requires at least one modality");
  }
  const framing =
    spec.preferredFraming ?? "synthetic reference framing, deterministic seed, medium quality";
  const deficiency = spec.targetDeficiency ?? "unspecified-deficiency";
  return modalities.map((modality) =>
    deepFreeze({
      id: deps.next("capture-guide-step"),
      instruction: `capture ${modality} evidence (${framing}) to resolve "${deficiency}"`,
      targetDeficiency: spec.targetDeficiency ?? null,
      preferredFraming: spec.preferredFraming ?? null,
      requiredModality: modality,
    }),
  );
}

/** Derives a guide spec from an EvidenceRequest (targeted capture). */
export function guideSpecForEvidenceRequest(request: EvidenceRequest): CaptureGuideSpec {
  return {
    targetDeficiency: request.targetDeficiency,
    preferredFraming: request.preferredFraming,
  };
}
