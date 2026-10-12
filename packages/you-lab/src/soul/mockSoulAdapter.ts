// Deterministic mock soul adapter (W7C).
//
// Implements the provider-neutral soul seam against pure mock candidates.
// The mock transforms the invocation's routed prompt context into
// content-addressed response records — contentRef + contentHash = sha-256 of
// the canonical payload bytes — with seeded degradation knobs (context
// ingestion dropout, response-value drift, modality folding, routing
// misrouting) so the soul benchmark can score different fidelity classes
// across the order's candidate classes. PURE MOCKS (technologyId: null):
// their parameters are fixture inputs exercising the seam, NOT assessments
// of any real soul technology. No clock, no Math.random, no network — all
// degradation is derived from hash-keyed streams (unitFrom), so every value
// is a pure function of (adapterId, requestId, contextRef, route).
//
// ROUTING HONESTY: when honorsRoutingProfile is false the mock answers on
// the flipped route (system-one <-> system-two) — the response records and
// payloads carry the route ACTUALLY used, and the misroute stays visible in
// warnings (truth law — a misroute is never rewritten into a correct one).

import { canonicalJson, roundTo } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import {
  assertSoulRequestSupported,
  encodeSoulPayload,
  intendedResponseTopicAt,
  intendedResponseValueAt,
  neutralSoulContentRef,
  neutralSoulResponseId,
  notMeasuredSoulEffortFields,
  projectedEmbodimentStateFor,
  sha256Hex,
  type NeutralLatencyClass,
  type NeutralSoulClass,
  type NeutralSoulModality,
  type NeutralSoulOutput,
  type NeutralSoulRequest,
  type NeutralSoulResponseRecord,
  type NeutralSoulRoutingProfile,
  type ResponseContentEntry,
  type SoulAdapter,
  type SoulAdapterProfile,
} from "./soulAdapterSeam.js";

const GENERATOR = "you-lab-mock-soul-adapter/1";

/** Mock degradation configuration (fixture input, not a technology assessment). */
export interface MockSoulConfig {
  readonly id: string;
  readonly soulClass: NeutralSoulClass;
  readonly supportedModalities: readonly NeutralSoulModality[];
  readonly supportedRoutingProfiles: readonly NeutralSoulRoutingProfile[];
  readonly latencyClass: NeutralLatencyClass;
  /** Seeded per-context-ref ingestion probability (0..1): fraction of the prompt's context actually addressed. */
  readonly contextIngestRate: number;
  /** Seeded relative drift applied to response values (0..1). */
  readonly responseDrift: number;
  /** Whether distinct output modalities survive (false: every record folds into the first requested modality). */
  readonly preservesModalities: boolean;
  /** Whether the adapter answers on the requested route (false: answers on the flipped route — visible misroute). */
  readonly honorsRoutingProfile: boolean;
}

/** Flip a routing profile (system-one <-> system-two); open-union values pass through unchanged. */
function flipRoutingProfile(profile: NeutralSoulRoutingProfile): NeutralSoulRoutingProfile {
  if (profile === "system-one") return "system-two";
  if (profile === "system-two") return "system-one";
  return profile;
}

export function createMockSoulAdapter(config: MockSoulConfig): SoulAdapter {
  const profile: SoulAdapterProfile = {
    id: config.id,
    technologyId: null,
    soulClass: config.soulClass,
    supportedModalities: config.supportedModalities,
    supportedRoutingProfiles: config.supportedRoutingProfiles,
    latencyClass: config.latencyClass,
    adapterKind: "mock",
    deterministic: true,
    determinismNote: "pure mock: all degradation is seed-derived (unitFrom keyed streams); byte-identical replay from the seed",
    productionEligible: null,
    eligibilityBasis: "pure mock candidate — no registry backing, no eligibility claim",
  };
  return {
    profile,
    invoke(request: NeutralSoulRequest): NeutralSoulOutput {
      assertSoulRequestSupported(profile, request);
      const route = config.honorsRoutingProfile
        ? request.prompt.routingProfile
        : flipRoutingProfile(request.prompt.routingProfile);
      const entries = buildResponseEntries(config, request, route);
      const records: NeutralSoulResponseRecord[] = [];
      const payloads: Record<string, Record<string, unknown>> = {};
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        if (!entry) continue;
        const payload = encodeSoulPayload(entry, request, route);
        const payloadHash = sha256Hex(canonicalJson(payload));
        const recordId = neutralSoulResponseId(config.id, request.requestId, entry.contextRef);
        records.push({
          id: recordId,
          bindingId: request.binding.id,
          requestId: request.requestId,
          routingProfile: route,
          modality: entry.modality,
          embodimentState: projectedEmbodimentStateFor(entry.modality),
          contentRef: neutralSoulContentRef(config.id, request.requestId, index),
          contentHash: payloadHash,
          completedAt: request.submittedAt,
          simulated: true,
        });
        payloads[recordId] = payload;
      }
      const warnings: string[] = [];
      if (!config.honorsRoutingProfile) {
        warnings.push(
          `routing misroute: the request route '${request.prompt.routingProfile}' was answered on '${route}' (visible misroute — never rewritten)`,
        );
      }
      if (!config.preservesModalities) {
        warnings.push("output modalities folded into a single over-general modality (modality fidelity loss)");
      }
      const dropped = request.prompt.contextRefs.length - entries.length;
      if (dropped > 0) {
        warnings.push(`${dropped} context ref(s) not addressed by the mock soul (seeded coverage loss)`);
      }
      return {
        adapterId: config.id,
        requestId: request.requestId,
        records,
        payloads,
        responseContentHash: responseContentDigest(entries, route),
        warnings: [...new Set(warnings)].sort(),
        effort: notMeasuredSoulEffortFields(),
        simulated: true,
      };
    },
  };
}

/** Build the degraded response-content entries for (config, request, route). */
function buildResponseEntries(
  config: MockSoulConfig,
  request: NeutralSoulRequest,
  route: NeutralSoulRoutingProfile,
): ResponseContentEntry[] {
  const requested = request.prompt.requestedModalities;
  const entries: ResponseContentEntry[] = [];
  for (let index = 0; index < request.prompt.contextRefs.length; index++) {
    const contextRef = request.prompt.contextRefs[index];
    if (!contextRef) continue;
    const ingested = unitFrom(config.id, request.requestId, contextRef, "ingest") < config.contextIngestRate;
    if (!ingested) continue;
    const drift = 1 + (unitFrom(config.id, request.requestId, contextRef, "drift") * 2 - 1) * config.responseDrift;
    const modality = config.preservesModalities
      ? (requested[index % requested.length] ?? requested[0])!
      : requested[0]!;
    entries.push({
      topic: intendedResponseTopicAt(index),
      value: roundTo(intendedResponseValueAt(contextRef, route) * drift, 4),
      contextRef,
      modality,
    });
  }
  return entries;
}

/** Canonical-JSON digest over the response-content entries under the actual route (deterministic). */
function responseContentDigest(entries: readonly ResponseContentEntry[], route: NeutralSoulRoutingProfile): string {
  return sha256Hex(
    canonicalJson(
      entries.map((entry) => ({ topic: entry.topic, value: entry.value, contextRef: entry.contextRef, modality: entry.modality, route })),
    ),
  );
}

/** Generator label for provenance wiring (honest mock scope). */
export function mockSoulGenerator(): string {
  return GENERATOR;
}
