// Deterministic mock render adapter (W4C).
//
// Implements the provider-neutral RenderAdapter seam as an explicit
// SIMULATION of a render provider: a pure function of the request. Per
// requested output kind it synthesizes seed-derived payload bytes (content
// addressed by sha-256), computes a deterministic fidelity from its
// configuration plus the consumed performance-timeline features, and applies
// seeded per-kind dropout. Its configuration parameters are fixture inputs
// exercising the seam — NOT assessments of any real render technology (truth
// law; labeled `simulated: true`). No clock, no Math.random, no network.

import { sortedUnique } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import {
  assertRenderRequestSupported,
  clampFidelity,
  isSha256Hex,
  neutralRenderArtifactId,
  neutralRenderContentRef,
  NEUTRAL_RENDER_SUPPORT,
  notMeasuredRenderEffortFields,
  sha256Hex,
  synthesizeNeutralRenderBytes,
  type NeutralRenderOutputKind,
  type NeutralRenderRequest,
  type NeutralRenderMethod,
  type NeutralRenderArtifact,
  type RenderAdapter,
  type RenderAdapterProfile,
  type RenderOutput,
} from "./renderAdapterSeam.js";

const GENERATOR = "you-lab-mock-render-adapter/1";

export interface MockRenderConfig {
  /** Stable adapter id, e.g. "mock-render-image-precise". */
  readonly id: string;
  /** The method family this mock simulates. */
  readonly method: NeutralRenderMethod;
  /** Base fidelity at zero observable timeline quality. */
  readonly fidelityBase: number;
  /** How strongly observable timeline quality lifts fidelity (0..1). */
  readonly timelineSensitivity: number;
  /** Seeded per-kind dropout probability in [0, 1]. */
  readonly artifactDropoutRate: number;
  /** Seeded per-kind fidelity micro-jitter amplitude (0..1). */
  readonly fidelityJitter: number;
}

export function createMockRenderAdapter(config: MockRenderConfig): RenderAdapter {
  const profile: RenderAdapterProfile = {
    id: config.id,
    technologyId: null,
    methods: [config.method],
    supportedOutputKinds: NEUTRAL_RENDER_SUPPORT[config.method] ?? [],
    runtimeClass: "local-cpu",
    deterministic: true,
    determinismNote: "pure function of the request; seeded mulberry32/hash derivations only",
    productionEligible: null,
    eligibilityBasis: "pure mock (technologyId: null) — fixture input, never a technology assessment",
  };
  return {
    profile,
    render(request: NeutralRenderRequest): RenderOutput {
      assertRenderRequestSupported(profile, request);
      const warnings: string[] = [];
      const artifacts: NeutralRenderArtifact[] = [];
      for (const kind of [...request.outputKinds].sort()) {
        if (unitFrom(config.id, request.requestId, kind) < config.artifactDropoutRate) {
          warnings.push(`${kind}: seeded dropout — artifact not produced`);
          continue;
        }
        artifacts.push(buildArtifact(config, request, kind));
      }
      return {
        adapterId: config.id,
        requestId: request.requestId,
        status: "completed",
        failureReason: null,
        producedArtifacts: artifacts,
        warnings: sortedUnique(warnings),
        effort: notMeasuredRenderEffortFields(),
        simulated: true,
      };
    },
  };
}

function buildArtifact(
  config: MockRenderConfig,
  request: NeutralRenderRequest,
  kind: NeutralRenderOutputKind,
): NeutralRenderArtifact {
  const payload = synthesizeNeutralRenderBytes(config.id, request.requestId, kind);
  const contentHash = sha256Hex(payload);
  const lift = timelineLift(request);
  const jitter = (unitFrom("fidelity", config.id, request.requestId, kind) - 0.5) * 2 * config.fidelityJitter;
  const fidelity = clampFidelity(config.fidelityBase + config.timelineSensitivity * lift + jitter);
  return {
    artifactId: neutralRenderArtifactId(config.id, request.requestId, kind),
    kind,
    contentRef: neutralRenderContentRef(config.id, request.requestId, kind),
    contentHash,
    fidelity,
    simulated: true,
    generator: GENERATOR,
    payload,
  };
}

/**
 * Observable performance-timeline quality lift in [0, 1]: cue density
 * (material to render), track variety and span coverage — deterministic
 * arithmetic over the consumed timeline (never a scientific claim). Cues are
 * ordered by startMs (timeline law), so the last cue carries the greatest
 * endMs.
 */
export function timelineLift(request: NeutralRenderRequest): number {
  const { cues, durationMs } = request.timeline;
  if (cues.length === 0 || durationMs <= 0) return 0;
  const density = Math.min(1, cues.length / 9);
  const tracks = new Set(cues.map((cue) => cue.track));
  const variety = Math.min(1, tracks.size / 3);
  const lastEndMs = cues[cues.length - 1]?.endMs ?? 0;
  const coverage = Math.min(1, lastEndMs / durationMs);
  return 0.5 * density + 0.3 * variety + 0.2 * coverage;
}

/** Generator label for provenance wiring (never a real-provider claim). */
export function mockRenderGenerator(): string {
  return GENERATOR;
}

/** Re-exported for convenience in tests asserting hash well-formedness. */
export { isSha256Hex };
