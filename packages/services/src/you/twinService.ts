// YOU twin application service — the single authority over
// twin/reconstruction truth (docs/you/CONTRACTS.md "State ownership":
// TwinVersion = twin service; WORK_ORDERS.md W3A).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one twin plane per solution
// (append-only SolutionEventLedger + twin version chains +
// reconstruction jobs + the deficiency-remediation registry) and the
// twin content store. The evidence authority stays the wave-2 evidence
// service, reached only through the injected TwinEvidencePort seam
// (binding-time consent enforcement — withdrawal blocks NEW
// bindings/processing; already-published immutable versions keep their
// provenance). Phase 0 is fully deterministic: injected clock + seeded
// RNG; everything simulated stays labeled `simulated: true` (truth law).

import type {
  EvidenceRequest,
  HtirDomainBlock,
  HtirDomainKind,
  OpaqueId,
  ReconstructionJobResult,
  ReconstructionJobSpec,
  SolutionEvent,
  TwinDeficiencyClass,
  TwinQualityState,
  TwinVersion,
} from "@zcode/shared";
import { createDeterministicClock, type YouClock } from "../../../shared/src/you/clock.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import { createHtirDomainBlock } from "../../../shared/src/you/htirDomain.js";
import { replayTwinLedger, type TwinPlaneProjection } from "../../../shared/src/you/twinLedger.js";
import {
  assessTwinQuality,
  twinDeficiencyKey,
  type RemediationEvidenceRequestInput,
} from "../../../shared/src/you/twinQuality.js";
import { appendTwinQualityAssessed, appendTwinVersionPromotion, appendTwinVersionPublished } from "./twinLedgerOps.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { unsupportedReconstructionDomains } from "../../../shared/src/you/reconstruction.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import { createTwinRecord, TwinVersionChain, type TwinRecord } from "../../../shared/src/you/twinVersioning.js";
import {
  openRemediationEvidenceRequestOp,
  remediationRequestOfDeficiencyOp,
} from "./twinRemediationFlow.js";
import { buildTwinPlaneProjection } from "./twinProjection.js";
import { resolveEvidenceBindingsOp, type EvidenceBindingInput } from "./twinBindingFlow.js";
import {
  completeReconstructionJobOp,
  failReconstructionJobOp,
  startReconstructionJobOp,
  submitReconstructionJobOp,
} from "./twinReconstructionFlow.js";
import type {
  ReconstructionJobState,
  TwinEvidencePort,
  TwinPlaneRecord,
  TwinServiceDeps,
  TwinServiceResult,
} from "./twinServiceTypes.js";
import { requireTwinVersion, sortedMapKeys, twinFailure } from "./twinServiceTypes.js";

export interface TwinServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
  readonly contentStore?: EvidenceContentStore;
  /** Evidence-authority seam (wave-2 service adapter); required for evidence-bound operations. */
  readonly evidencePort?: TwinEvidencePort;
}

/** The application-service authority over twin/reconstruction truth. */
export class TwinService {
  private readonly planes = new Map<OpaqueId, TwinPlaneRecord>();
  private readonly deps: TwinServiceDeps;
  private readonly contentStore: EvidenceContentStore;
  private readonly evidencePort: TwinEvidencePort | null;
  private readonly lastQualityAssessment = new Map<OpaqueId, TwinQualityState>();

  private constructor(
    readonly workspaceIdentity: string,
    clock: YouClock,
    ids: YouIdFactory,
    contentStore: EvidenceContentStore,
    evidencePort: TwinEvidencePort | null,
  ) {
    this.deps = { clock, ids };
    this.contentStore = contentStore;
    this.evidencePort = evidencePort;
  }

  /** Creates a deterministic service (injected clock + seeded ids/content). */
  static create(config: TwinServiceConfig): TwinService {
    const seed = config.seed ?? "you-w3a-twin-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new TwinService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
      config.contentStore ?? createFixtureEvidenceContentStore(),
      config.evidencePort ?? null,
    );
  }

  // -- twins -------------------------------------------------------------

  /** Creates a twin (no versions yet; identity enters the ledger at first publication). */
  createTwin(
    solutionId: OpaqueId,
    input: { readonly displayName?: string; readonly provenanceSource?: string } = {},
  ): TwinServiceResult<{ readonly twin: TwinRecord }> {
    const plane = this.planeFor(solutionId);
    let twin: TwinRecord;
    try {
      twin = createTwinRecord(
        {
          workspaceIdentity: this.workspaceIdentity,
          displayName: input.displayName ?? `Twin ${sortedMapKeys(plane.twins).length + 1}`,
          provenanceSource: input.provenanceSource ?? "fixture:twin-service",
        },
        this.deps,
      ).twin;
    } catch (error) {
      return twinFailure("YOU_INVALID_STATE", "invalid twin intake", {
        reason: "invalid-twin-intake",
        detail: String(error instanceof Error ? error.message : error),
      });
    }
    plane.twins.set(twin.id, { record: twin, chain: TwinVersionChain.open(twin.id, this.deps) });
    return { ok: true, value: { twin } };
  }

  /** Publishes the next candidate TwinVersion (monotonic number; immutable once published). */
  publishTwinVersion(
    solutionId: OpaqueId,
    twinId: OpaqueId,
    input: {
      readonly domainBlocks: readonly HtirDomainBlock[];
      readonly evidence?: EvidenceBindingInput;
      readonly provenanceSource?: string;
      readonly generator?: import("@zcode/shared").AuthorType;
    },
  ): TwinServiceResult<{ readonly version: TwinVersion }> {
    const plane = this.planeFor(solutionId);
    const state = plane.twins.get(twinId);
    if (state === undefined) {
      return unknownTwin(twinId);
    }
    const bindings = this.resolveBindings(input.evidence);
    if (!bindings.ok) {
      return bindings;
    }
    const quality = assessTwinQuality(
      { domainBlocks: input.domainBlocks, evidenceBindings: bindings.value.bindings },
      this.deps,
      { remediation: this.remediationLookup(plane) },
    );
    const published = state.chain.publish({
      domainBlocks: input.domainBlocks,
      evidenceBindings: bindings.value.bindings,
      quality,
      provenanceSource: input.provenanceSource ?? "fixture:twin-version",
      generator: input.generator,
    });
    if (!published.ok) {
      const code = published.code === "invalid-domain-blocks" ? "YOU_HTIR_DOMAIN_INVALID" : "YOU_INVALID_STATE";
      return twinFailure(code, published.detail, { reason: published.code, twinId });
    }
    const version = published.version;
    this.lastQualityAssessment.set(version.id, quality);
    appendTwinVersionPublished(plane, version, state.record.displayName);
    appendTwinQualityAssessed(plane, version.id, quality);
    return { ok: true, value: { version } };
  }

  /** Promotes a candidate to canonical; the previous canonical is superseded (append-only linkage). */
  promoteTwinVersion(
    solutionId: OpaqueId,
    twinId: OpaqueId,
    versionId: OpaqueId,
  ): TwinServiceResult<{ readonly version: TwinVersion; readonly superseded: TwinVersion | null }> {
    const plane = this.planeFor(solutionId);
    const found = requireTwinVersion(plane, twinId, versionId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    const promoted = found.state.chain.promote(versionId);
    if (!promoted.ok) {
      const code = promoted.code === "not-found" ? "YOU_VERSION_NOT_FOUND" : "YOU_IMMUTABLE_VIOLATION";
      return twinFailure(code, `cannot promote twin version: ${promoted.detail}`, {
        reason: promoted.code,
        twinId,
        versionId,
      });
    }
    appendTwinVersionPromotion(plane, promoted.promoted, promoted.superseded);
    return { ok: true, value: { version: promoted.promoted, superseded: promoted.superseded } };
  }

  /** Deterministic quality re-projection of a published version (journaling twin-quality-assessed). */
  assessTwinQualityOf(solutionId: OpaqueId, twinId: OpaqueId, versionId: OpaqueId): TwinServiceResult<{ readonly quality: TwinQualityState }> {
    const plane = this.planeFor(solutionId);
    const found = requireTwinVersion(plane, twinId, versionId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    const quality = assessTwinQuality(
      { domainBlocks: found.version.domainBlocks, evidenceBindings: found.version.evidenceBindings },
      this.deps,
      { remediation: this.remediationLookup(plane) },
    );
    this.lastQualityAssessment.set(versionId, quality);
    appendTwinQualityAssessed(plane, versionId, quality);
    return { ok: true, value: { quality } };
  }

  // -- remediation ---------------------------------------------------------

  /** Opens the targeted EvidenceRequest remediating one deficiency (W2 seam; flows through capture). */
  openRemediationEvidenceRequest(
    solutionId: OpaqueId,
    twinId: OpaqueId,
    versionId: OpaqueId,
    deficiencyId: OpaqueId,
    input: RemediationEvidenceRequestInput = {},
  ): TwinServiceResult<{ readonly request: EvidenceRequest; readonly alreadyLinked: boolean }> {
    return openRemediationEvidenceRequestOp(this.planeFor(solutionId), this.deps, twinId, versionId, deficiencyId, input);
  }

  /** The remediation request serving one published deficiency (registry lookup), or null. */
  remediationRequestOfDeficiency(
    solutionId: OpaqueId,
    twinId: OpaqueId,
    versionId: OpaqueId,
    deficiencyId: OpaqueId,
  ): TwinServiceResult<{ readonly request: EvidenceRequest | null }> {
    return remediationRequestOfDeficiencyOp(this.planeFor(solutionId), twinId, versionId, deficiencyId);
  }

  // -- reconstruction ------------------------------------------------------

  /** Submits a reconstruction job (support-validated first; consent-enforced; queued). */
  submitReconstructionJob(
    solutionId: OpaqueId,
    input: {
      readonly twinVersionId: OpaqueId;
      readonly method: import("@zcode/shared").ReconstructionMethod;
      readonly targetDomains: readonly HtirDomainKind[];
      readonly evidence?: EvidenceBindingInput;
    },
  ): TwinServiceResult<{ readonly spec: ReconstructionJobSpec }> {
    const plane = this.planeFor(solutionId);
    // Fail fast on the spec shape: an unsupported method/domain combination
    // is rejected regardless of evidence/consent state (never a fallback).
    const unsupported = unsupportedReconstructionDomains(input.method, input.targetDomains);
    if (input.targetDomains.length === 0 || unsupported.length > 0) {
      return twinFailure(
        "YOU_RECONSTRUCTION_UNSUPPORTED",
        `unsupported reconstruction method/domain combination: method "${input.method}" does not support target domain(s): ${unsupported.join(", ")}`,
        {
          reason: "unsupported-method-domain-combination",
          method: input.method,
          unsupportedDomains: unsupported.join(","),
        },
      );
    }
    const bindings = this.resolveBindings(input.evidence);
    if (!bindings.ok) {
      return bindings;
    }
    return submitReconstructionJobOp(plane, this.deps, {
      twinVersionId: input.twinVersionId,
      method: input.method,
      targetDomains: input.targetDomains,
      evidenceBindings: bindings.value.bindings,
    });
  }

  startReconstructionJob(solutionId: OpaqueId, jobId: OpaqueId): TwinServiceResult<{ readonly status: string }> {
    return startReconstructionJobOp(this.planeFor(solutionId), jobId);
  }

  completeReconstructionJob(
    solutionId: OpaqueId,
    jobId: OpaqueId,
  ): TwinServiceResult<{ readonly result: ReconstructionJobResult }> {
    return completeReconstructionJobOp(this.planeFor(solutionId), this.deps, this.contentStore, jobId);
  }

  failReconstructionJob(solutionId: OpaqueId, jobId: OpaqueId, reason: string): TwinServiceResult<{ readonly result: ReconstructionJobResult }> {
    return failReconstructionJobOp(this.planeFor(solutionId), this.deps, jobId, reason);
  }

  /** Publishes a new candidate TwinVersion from a completed job's produced blocks (consent re-enforced). */
  publishVersionFromJobResult(
    solutionId: OpaqueId,
    twinId: OpaqueId,
    jobId: OpaqueId,
  ): TwinServiceResult<{ readonly version: TwinVersion }> {
    const plane = this.planeFor(solutionId);
    const job = plane.jobs.get(jobId);
    if (job === undefined) {
      return twinFailure("YOU_INVALID_STATE", "unknown reconstruction job", { reason: "unknown-reconstruction-job", jobId });
    }
    if (job.result === null || job.result.status !== "completed") {
      return twinFailure("YOU_INVALID_STATE", "only a completed reconstruction job can publish a version", {
        reason: "job-not-completed",
        jobId,
        jobStatus: job.status,
      });
    }
    return this.publishTwinVersion(solutionId, twinId, {
      domainBlocks: job.result.producedDomainBlocks,
      evidence: { bindings: job.spec.evidenceBindings },
      provenanceSource: `fixture:reconstruction:${jobId}`,
    });
  }

  reconstructionJobOf(solutionId: OpaqueId, jobId: OpaqueId): TwinServiceResult<{ readonly spec: ReconstructionJobSpec; readonly status: string; readonly result: ReconstructionJobResult | null }> {
    const job = this.planeFor(solutionId).jobs.get(jobId);
    return job === undefined
      ? twinFailure("YOU_INVALID_STATE", "unknown reconstruction job", { reason: "unknown-reconstruction-job", jobId })
      : { ok: true, value: { spec: job.spec, status: job.status, result: job.result } };
  }

  // -- fixture content -----------------------------------------------------

  /**
   * Deterministically synthesizes domain blocks (fixture mode): payload
   * bytes derive from the seed text, content is stored through the twin
   * content store (contentRef + sha-256 contentHash), confidence is the
   * deterministic fixture value derived from the stored content hash.
   */
  synthesizeDomainBlocks(
    solutionId: OpaqueId,
    input: { readonly domains: readonly HtirDomainKind[]; readonly seedText: string; readonly provenanceSource: string },
  ): TwinServiceResult<{ readonly blocks: readonly HtirDomainBlock[] }> {
    this.planeFor(solutionId);
    const rng = createDeterministicRng(seedFromString(`${input.seedText}:${[...input.domains].sort().join(",")}`));
    const blocks: HtirDomainBlock[] = [];
    for (const domain of [...input.domains].sort()) {
      blocks.push(
        createHtirDomainBlock(
          { domain, rng, provenanceSource: input.provenanceSource, generator: "fixture", simulated: true },
          { clock: this.deps.clock, ids: this.deps.ids, store: this.contentStore },
        ),
      );
    }
    return { ok: true, value: { blocks: Object.freeze(blocks) } };
  }

  // -- reads / projection / persistence ------------------------------------

  twinOf(solutionId: OpaqueId, twinId: OpaqueId): TwinServiceResult<{ readonly twin: TwinRecord }> {
    const state = this.planeFor(solutionId).twins.get(twinId);
    return state === undefined ? unknownTwin(twinId) : { ok: true, value: { twin: state.record } };
  }

  twinVersionOf(solutionId: OpaqueId, twinId: OpaqueId, versionId: OpaqueId): TwinServiceResult<{ readonly version: TwinVersion }> {
    const found = requireTwinVersion(this.planeFor(solutionId), twinId, versionId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { version: found.version } };
  }

  twinVersionsOf(solutionId: OpaqueId, twinId: OpaqueId): TwinServiceResult<{ readonly versions: readonly TwinVersion[] }> {
    const state = this.planeFor(solutionId).twins.get(twinId);
    return state === undefined ? unknownTwin(twinId) : { ok: true, value: { versions: state.chain.versions() } };
  }

  canonicalVersionOf(solutionId: OpaqueId, twinId: OpaqueId): TwinServiceResult<{ readonly version: TwinVersion | null }> {
    const state = this.planeFor(solutionId).twins.get(twinId);
    return state === undefined ? unknownTwin(twinId) : { ok: true, value: { version: state.chain.currentCanonical() } };
  }

  /** Live authoritative projection (same shape as replayTwinLedger output). */
  projectionOf(solutionId: OpaqueId): TwinServiceResult<TwinPlaneProjection> {
    return { ok: true, value: buildTwinPlaneProjection(this.planeFor(solutionId), this.lastQualityAssessment) };
  }

  ledgerEventsOf(solutionId: OpaqueId): TwinServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): TwinServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): TwinServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Number of stored twin content refs (fixture observability). */
  contentStoreSize(): number {
    return this.contentStore.size;
  }

  /** Replays a persisted ledger through the shared twin-plane fold. */
  static replay(events: readonly SolutionEvent[]): TwinPlaneProjection {
    return replayTwinLedger(events);
  }

  // -- internals -----------------------------------------------------------

  private resolveBindings(input: EvidenceBindingInput | undefined): TwinServiceResult<{ readonly bindings: readonly import("@zcode/shared").TwinEvidenceBinding[] }> {
    if (this.evidencePort === null) {
      const hasBindings = (input?.evidenceIds?.length ?? 0) > 0 || (input?.bindings?.length ?? 0) > 0;
      if (!hasBindings) {
        return { ok: true, value: { bindings: [] } };
      }
      return twinFailure("YOU_INVALID_STATE", "evidence-bound operations require an evidence port", {
        reason: "evidence-port-not-configured",
      });
    }
    return resolveEvidenceBindingsOp(this.evidencePort, input ?? {});
  }

  private remediationLookup(plane: TwinPlaneRecord): { resolve(cls: TwinDeficiencyClass, domain: HtirDomainKind): OpaqueId | null } {
    return {
      resolve: (cls, domain) => plane.remediationByDeficiencyKey.get(twinDeficiencyKey(cls, domain)) ?? null,
    };
  }

  /** Lazily opens (and caches) the twin plane for one solution. */
  private planeFor(solutionId: OpaqueId): TwinPlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: TwinPlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.deps),
      twins: new Map(),
      jobs: new Map(),
      remediationRequests: new Map(),
      remediationByDeficiencyKey: new Map(),
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

function unknownTwin<T>(twinId: OpaqueId): TwinServiceResult<T> {
  return twinFailure("YOU_TWIN_NOT_FOUND", "unknown twin", { reason: "unknown-twin", twinId });
}

/** Creates the deterministic twin application service. */
export function createTwinService(config: TwinServiceConfig): TwinService {
  return TwinService.create(config);
}

export type { ReconstructionJobState, TwinEvidencePort };
