// YOU immutable TwinVersion lifecycle (W3A — docs/you/CONTRACTS.md
// "A TwinVersion is immutable: acceptance promotes a candidate to
// canonical and publishes a new version; newer canonical versions
// supersede older ones through append-only linkage — never overwrite").
//
// Immutability model (the established wave-2 precedent for status-bearing
// immutable records — see evidenceRecord.ts `transitionEvidenceReview`):
//   - Published TwinVersion records are deep-frozen; NO field is ever
//     mutated in place (an attempt throws by construction).
//   - Lifecycle transitions (candidate -> canonical, canonical ->
//     superseded) are IMMUTABLE RECORD REPLACEMENTS: the chain stores a
//     brand-new frozen record under the same id. The version's identity
//     and content (twinId, version number, domainBlocks, evidenceBindings,
//     quality, provenance, createdAt) are byte-identical across every
//     transition — only the status field differs, and every transition is
//     journaled append-only in the event ledger, so the full status
//     history (candidate -> canonical -> superseded) is preserved and
//     replayable. Supersession linkage is additionally recorded in the
//     chain's append-only linkage maps (supersededBy / supersedes).
//   - Version numbers are monotonic per twin: each publication assigns
//     last version + 1, and a published number is never reused.
//
// Status transition table (append-only):
//   candidate -> canonical   (promotion by acceptance)
//   canonical -> superseded  (demotion by a newer promotion)
//   candidate -> superseded  (demotion without ever being canonical)
//   everything else is illegal.

import type {
  AuthorType,
  HtirDomainBlock,
  OpaqueId,
  ProvenanceRecord,
  TwinEvidenceBinding,
  TwinQualityState,
  TwinVersion,
  TwinVersionStatus,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { validateHtirDomainBlocks } from "./htirDomain.js";
import { deepFreeze } from "./serialize.js";

export interface TwinVersioningDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/** Legal status transitions (append-only lifecycle; no status is ever "un-done"). */
export const TWIN_VERSION_TRANSITIONS: Readonly<Record<TwinVersionStatus, readonly TwinVersionStatus[]>> = {
  candidate: ["canonical", "superseded"],
  canonical: ["superseded"],
  superseded: [],
};

export function isLegalTwinVersionTransition(from: TwinVersionStatus, to: TwinVersionStatus): boolean {
  return TWIN_VERSION_TRANSITIONS[from].includes(to);
}

/** Returns a NEW deep-frozen TwinVersion with the status transitioned. */
export function transitionTwinVersionStatus(version: TwinVersion, status: TwinVersionStatus): TwinVersion {
  if (!isLegalTwinVersionTransition(version.status, status)) {
    throw new Error(`illegal twin version transition ${version.status} -> ${status}`);
  }
  return deepFreeze({ ...version, status });
}

/** The twin aggregate record (service-level identity; no contract Twin shape is frozen). */
export interface TwinRecord {
  readonly id: OpaqueId;
  readonly workspaceIdentity: string;
  readonly displayName: string;
  readonly createdAt: string;
  readonly provenance: ProvenanceRecord;
}

export interface CreateTwinInput {
  readonly workspaceIdentity: string;
  readonly displayName: string;
  readonly provenanceSource: string;
  readonly generator?: AuthorType;
}

/** Creates the immutable twin record (no versions yet). */
export function createTwinRecord(
  input: CreateTwinInput,
  deps: TwinVersioningDeps,
): { readonly twin: TwinRecord } {
  if (input.displayName.trim().length === 0) {
    throw new Error("twin displayName must be non-empty");
  }
  const createdAt = deps.clock.now();
  const twin: TwinRecord = deepFreeze({
    id: deps.ids.next("twin"),
    workspaceIdentity: input.workspaceIdentity,
    displayName: input.displayName,
    createdAt,
    provenance: deepFreeze({
      source: input.provenanceSource,
      generator: input.generator ?? "fixture",
      createdAt,
      lineage: Object.freeze([]),
    }),
  });
  return { twin };
}

export interface PublishTwinVersionInput {
  readonly domainBlocks: readonly HtirDomainBlock[];
  readonly evidenceBindings: readonly TwinEvidenceBinding[];
  readonly quality: TwinQualityState;
  readonly provenanceSource: string;
  readonly generator?: AuthorType;
  /** Ancestors, oldest first (e.g. the reconstruction job that produced the blocks). */
  readonly lineage?: readonly OpaqueId[];
}

/** Typed publication refusal (mapped to YouError by the service). */
export type PublishTwinVersionRefusal =
  | { readonly ok: false; readonly code: "invalid-domain-blocks"; readonly detail: string }
  | { readonly ok: false; readonly code: "empty-version"; readonly detail: string };

/**
 * The append-only TwinVersion chain for one twin. Publications only append
 * monotonic versions (status "candidate"); promotions replace the promoted
 * record with its canonical successor record and demote the previous
 * canonical through supersession linkage — content is never rewritten.
 */
export class TwinVersionChain {
  private readonly versionList: TwinVersion[] = [];
  private readonly byId = new Map<OpaqueId, TwinVersion>();
  private readonly supersededByMap = new Map<OpaqueId, OpaqueId>();
  private readonly supersedesMap = new Map<OpaqueId, OpaqueId>();

  private constructor(
    private readonly deps: TwinVersioningDeps,
    private readonly twinId: OpaqueId,
  ) {}

  static open(twinId: OpaqueId, deps: TwinVersioningDeps): TwinVersionChain {
    return new TwinVersionChain(deps, twinId);
  }

  /** Frozen copy of the published versions, oldest first. */
  versions(): readonly TwinVersion[] {
    return Object.freeze([...this.versionList]);
  }

  get(versionId: OpaqueId): TwinVersion | null {
    return this.byId.get(versionId) ?? null;
  }

  /** Highest published version number (0 before the first publication). */
  get latestVersionNumber(): number {
    return this.versionList.length === 0 ? 0 : (this.versionList[this.versionList.length - 1]?.version ?? 0);
  }

  /** The current canonical version, or null before the first promotion. */
  currentCanonical(): TwinVersion | null {
    let canonical: TwinVersion | null = null;
    for (const version of this.versionList) {
      if (version.status === "canonical") {
        canonical = version;
      }
    }
    return canonical;
  }

  /** superseded versionId -> the version that superseded it. */
  supersededBy(versionId: OpaqueId): OpaqueId | null {
    return this.supersededByMap.get(versionId) ?? null;
  }

  /** superseding versionId -> the version it superseded (null when none). */
  supersedes(versionId: OpaqueId): OpaqueId | null {
    return this.supersedesMap.get(versionId) ?? null;
  }

  /** Append-only linkage snapshot (superseded -> superseding), stable order. */
  supersessionLinks(): Readonly<Record<string, string>> {
    const links: Record<string, string> = {};
    for (const key of [...this.supersededByMap.keys()].sort()) {
      const value = this.supersededByMap.get(key);
      if (value !== undefined) {
        links[key] = value;
      }
    }
    return deepFreeze(links);
  }

  /**
   * Publishes the next candidate version (monotonic number). Refuses
   * (typed result, no state change) on invalid or empty domain blocks.
   */
  publish(input: PublishTwinVersionInput): { readonly ok: true; readonly version: TwinVersion } | PublishTwinVersionRefusal {
    if (input.domainBlocks.length === 0) {
      return { ok: false, code: "empty-version", detail: "a twin version requires at least one domain block" };
    }
    const blockReason = validateHtirDomainBlocks(input.domainBlocks);
    if (blockReason !== null) {
      return { ok: false, code: "invalid-domain-blocks", detail: blockReason };
    }
    const parent = this.versionList[this.versionList.length - 1];
    const lineage: OpaqueId[] = [...(input.lineage ?? [])];
    if (parent !== undefined) {
      lineage.push(parent.id);
    }
    const createdAt = this.deps.clock.now();
    const version: TwinVersion = deepFreeze({
      id: this.deps.ids.next("twin-version"),
      twinId: this.twinId,
      version: this.latestVersionNumber + 1,
      status: "candidate",
      domainBlocks: deepFreeze([...input.domainBlocks]),
      evidenceBindings: deepFreeze([...input.evidenceBindings]),
      quality: input.quality,
      createdAt,
      provenance: deepFreeze({
        source: input.provenanceSource,
        generator: input.generator ?? "fixture",
        createdAt,
        lineage: Object.freeze(lineage),
      }),
    });
    this.versionList.push(version);
    this.byId.set(version.id, version);
    return { ok: true, version };
  }

  /**
   * Promotion by acceptance: the candidate becomes canonical; the previous
   * canonical (when one exists) is demoted to superseded with append-only
   * linkage. Content never changes; every transition is journaled by the
   * service around this pure call.
   */
  promote(
    versionId: OpaqueId,
  ):
    | {
        readonly ok: true;
        readonly promoted: TwinVersion;
        readonly superseded: TwinVersion | null;
      }
    | {
        readonly ok: false;
        readonly code: "not-found" | "not-candidate";
        readonly detail: string;
      } {
    const candidate = this.byId.get(versionId);
    if (candidate === undefined) {
      return { ok: false, code: "not-found", detail: versionId };
    }
    if (candidate.status !== "candidate") {
      return { ok: false, code: "not-candidate", detail: `status is ${candidate.status}` };
    }
    const previousCanonical = this.currentCanonical();
    const promoted = transitionTwinVersionStatus(candidate, "canonical");
    this.replace(candidate, promoted);
    let superseded: TwinVersion | null = null;
    if (previousCanonical !== null && previousCanonical.id !== promoted.id) {
      superseded = transitionTwinVersionStatus(previousCanonical, "superseded");
      this.replace(previousCanonical, superseded);
      this.supersededByMap.set(superseded.id, promoted.id);
      this.supersedesMap.set(promoted.id, superseded.id);
    }
    return { ok: true, promoted, superseded };
  }

  /** Immutable record replacement under the same id (content identical, status moved). */
  private replace(previous: TwinVersion, next: TwinVersion): void {
    const index = this.versionList.findIndex((version) => version.id === previous.id);
    if (index < 0) {
      throw new Error(`twin version ${previous.id} is not part of the chain`);
    }
    this.versionList[index] = next;
    this.byId.set(next.id, next);
  }
}
