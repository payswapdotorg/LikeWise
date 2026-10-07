// YOU immutable SolutionVersion chain (docs/you/CONTRACTS.md versioning).
//
// A SolutionVersion is immutable: acceptance of a candidate ChangeSet
// creates version n+1 linked to its parent; nothing is ever mutated in
// place. Published versions (and their snapshots) are deep-frozen, so a
// mutation attempt throws by construction.

import type {
  AuthorType,
  ChangeSet,
  ChangeSetVerification,
  OpaqueId,
  ProvenanceRecord,
  SolutionIdentity,
  SolutionPatchOperation,
  SolutionSelector,
  SolutionStateSnapshot,
  SolutionVersion,
  VerificationCheck,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { applyQualityDelta } from "./quality.js";
import { deepFreeze } from "./serialize.js";

export interface VersioningDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/** Pure application of patch operations over a snapshot. */
export function applyPatchOperations(
  state: SolutionStateSnapshot,
  operations: readonly SolutionPatchOperation[],
): SolutionStateSnapshot {
  let entities: SolutionEntityMutable[] = state.entities.map((entity) => entity);
  let environment: SolutionEnvironmentMutable = { ...state.environment };
  let quality: Record<string, number> = { ...state.quality };
  for (const operation of operations) {
    switch (operation.op) {
      case "upsert_entity": {
        if (operation.entity.id.length === 0) {
          throw new Error("upsert_entity requires a non-empty entity id");
        }
        const frozen = deepFreeze(operation.entity);
        const index = entities.findIndex((entity) => entity.id === frozen.id);
        if (index >= 0) {
          entities[index] = frozen;
        } else {
          entities.push(frozen);
        }
        break;
      }
      case "remove_entity":
        entities = entities.filter((entity) => entity.id !== operation.entityId);
        break;
      case "update_environment":
        environment = { ...environment, ...operation.environment };
        break;
      case "adjust_quality":
        quality = { ...applyQualityDelta(quality, operation.deficiencyClass, operation.delta) };
        break;
    }
  }
  entities.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return deepFreeze({
    entities,
    environment,
    quality,
    simulated: state.simulated,
  });
}

type SolutionEntityMutable = SolutionStateSnapshot["entities"][number];
type SolutionEnvironmentMutable = SolutionStateSnapshot["environment"];

function check(name: string, passed: boolean, detail: string): VerificationCheck {
  return { name, passed, detail };
}

/**
 * Deterministic ChangeSet verification against its base version.
 * Checks: non-empty operations, resolvable entity operations, no duplicate
 * upsert ids inside one changeset, finite quality deltas, valid
 * environment partial.
 */
export function verifyChangeSet(
  base: SolutionVersion,
  operations: readonly SolutionPatchOperation[],
): ChangeSetVerification {
  const checks: VerificationCheck[] = [];
  checks.push(check("operations-nonempty", operations.length > 0, `${operations.length} operation(s)`));

  const upsertIds = new Set<string>();
  let upsertsUnique = true;
  let upsertsValid = true;
  for (const operation of operations) {
    if (operation.op === "upsert_entity") {
      if (operation.entity.id.length === 0) {
        upsertsValid = false;
      }
      if (upsertIds.has(operation.entity.id)) {
        upsertsUnique = false;
      }
      upsertIds.add(operation.entity.id);
    }
  }
  checks.push(check("upsert-entities-valid", upsertsValid, upsertsValid ? "all upsert ids non-empty" : "empty upsert entity id"));
  checks.push(check("upsert-ids-unique", upsertsUnique, upsertsUnique ? "no duplicate upsert ids" : "duplicate upsert id in one changeset"));

  let removesResolvable = true;
  const missing: string[] = [];
  for (const operation of operations) {
    if (operation.op === "remove_entity") {
      const present = base.state.entities.some((entity) => entity.id === operation.entityId);
      if (!present) {
        removesResolvable = false;
        missing.push(operation.entityId);
      }
    }
  }
  checks.push(
    check(
      "remove-targets-resolvable",
      removesResolvable,
      removesResolvable ? "all remove targets exist in base" : `missing remove targets: ${missing.sort().join(", ")}`,
    ),
  );

  let qualityValid = true;
  for (const operation of operations) {
    if (operation.op === "adjust_quality") {
      if (operation.deficiencyClass.length === 0 || !Number.isFinite(operation.delta)) {
        qualityValid = false;
      }
    }
  }
  checks.push(check("quality-operations-valid", qualityValid, qualityValid ? "quality deltas finite and classed" : "invalid adjust_quality operation"));

  let environmentValid = true;
  for (const operation of operations) {
    if (operation.op === "update_environment") {
      const partial = operation.environment;
      if (partial.background !== undefined && partial.background.length === 0) {
        environmentValid = false;
      }
      if (
        partial.ambientIntensity !== undefined &&
        (!Number.isFinite(partial.ambientIntensity) || partial.ambientIntensity < 0)
      ) {
        environmentValid = false;
      }
      if (
        partial.keyLightDirection !== undefined &&
        (partial.keyLightDirection.length !== 3 || partial.keyLightDirection.some((axis) => !Number.isFinite(axis)))
      ) {
        environmentValid = false;
      }
    }
  }
  checks.push(check("environment-partial-valid", environmentValid, environmentValid ? "environment partial valid" : "invalid update_environment payload"));

  return deepFreeze({ checks, passed: checks.every((entry) => entry.passed) });
}

export interface ProposeChangeSetInput {
  readonly baseVersionId: OpaqueId;
  readonly operations: readonly SolutionPatchOperation[];
  readonly intentRef?: OpaqueId | null;
  readonly targetRef?: SolutionSelector | null;
  readonly evidenceRefs?: readonly OpaqueId[];
  readonly executionRef?: OpaqueId | null;
  readonly authorType: AuthorType;
}

export type AcceptChangeSetResult =
  | { readonly ok: true; readonly version: SolutionVersion; readonly changeSet: ChangeSet }
  | {
      readonly ok: false;
      readonly code: "verification-failed" | "base-not-current" | "not-proposed" | "base-unknown";
      readonly detail: string;
      readonly changeSet: ChangeSet;
    };

export interface CreateSolutionResult {
  readonly chain: SolutionVersionChain;
  readonly root: SolutionVersion;
}

/**
 * The immutable version chain for one Solution. The chain itself only
 * grows (append on acceptance); every published version is deep-frozen.
 */
export class SolutionVersionChain {
  private readonly versionList: SolutionVersion[] = [];

  private constructor(
    readonly solution: SolutionIdentity,
    private readonly deps: VersioningDeps,
  ) {}

  /** Creates the chain and its root version v1 from a fixture snapshot. */
  static createRoot(input: {
    readonly solution: SolutionIdentity;
    readonly snapshot: SolutionStateSnapshot;
    readonly provenanceSource: string;
    readonly deps: VersioningDeps;
  }): CreateSolutionResult {
    const chain = new SolutionVersionChain(input.solution, input.deps);
    const root = chain.publishVersion({
      parent: null,
      state: input.snapshot,
      generator: "fixture",
      provenanceSource: input.provenanceSource,
    });
    return { chain, root };
  }

  /** Frozen copy of the published versions, oldest first. */
  versions(): readonly SolutionVersion[] {
    return Object.freeze([...this.versionList]);
  }

  get(versionId: OpaqueId): SolutionVersion | null {
    return this.versionList.find((version) => version.id === versionId) ?? null;
  }

  current(): SolutionVersion {
    const latest = this.versionList[this.versionList.length - 1];
    if (latest === undefined) {
      throw new Error("version chain is empty");
    }
    return latest;
  }

  /** Proposes a candidate ChangeSet over the given base version. */
  propose(input: ProposeChangeSetInput): ChangeSet {
    const base = this.get(input.baseVersionId);
    const verification = base === null ? null : verifyChangeSet(base, input.operations);
    return deepFreeze({
      id: this.deps.ids.next("changeset"),
      intentRef: input.intentRef ?? null,
      targetRef: input.targetRef ?? null,
      inputVersionId: input.baseVersionId,
      proposedOperations: Object.freeze([...input.operations]),
      evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
      executionRef: input.executionRef ?? null,
      verification,
      resultingVersionId: null,
      status: "proposed",
      authorType: input.authorType,
    });
  }

  /**
   * Accepts a proposed ChangeSet: creates version n+1 with parent linkage.
   * Refuses (typed result, no state change) on failed verification,
   * unknown/stale base, or non-proposed status.
   */
  accept(changeSet: ChangeSet): AcceptChangeSetResult {
    if (changeSet.status !== "proposed") {
      return { ok: false, code: "not-proposed", detail: `status is ${changeSet.status}`, changeSet };
    }
    const base = this.get(changeSet.inputVersionId);
    if (base === null) {
      return { ok: false, code: "base-unknown", detail: changeSet.inputVersionId, changeSet };
    }
    if (base.id !== this.current().id) {
      return { ok: false, code: "base-not-current", detail: `base v${base.version} is not current`, changeSet };
    }
    const verification = changeSet.verification ?? verifyChangeSet(base, changeSet.proposedOperations);
    if (!verification.passed) {
      return { ok: false, code: "verification-failed", detail: "verification checks failed", changeSet };
    }
    const version = this.publishVersion({
      parent: base,
      state: applyPatchOperations(base.state, changeSet.proposedOperations),
      generator: changeSet.authorType,
      provenanceSource: `changeset:${changeSet.id}`,
    });
    const accepted: ChangeSet = deepFreeze({
      ...changeSet,
      verification,
      resultingVersionId: version.id,
      status: "accepted",
    });
    return { ok: true, version, changeSet: accepted };
  }

  /** Marks a proposed ChangeSet rejected (no state change otherwise). */
  reject(changeSet: ChangeSet): ChangeSet {
    if (changeSet.status !== "proposed") {
      throw new Error(`cannot reject a changeset with status ${changeSet.status}`);
    }
    return deepFreeze({ ...changeSet, status: "rejected" });
  }

  private publishVersion(input: {
    readonly parent: SolutionVersion | null;
    readonly state: SolutionStateSnapshot;
    readonly generator: AuthorType;
    readonly provenanceSource: string;
  }): SolutionVersion {
    const parent = input.parent;
    const lineage: OpaqueId[] = parent === null ? [] : [...parent.provenance.lineage, parent.id];
    const provenance: ProvenanceRecord = deepFreeze({
      source: input.provenanceSource,
      generator: input.generator,
      createdAt: this.deps.clock.now(),
      lineage: Object.freeze(lineage),
    });
    const version: SolutionVersion = deepFreeze({
      id: this.deps.ids.next("version"),
      solutionId: this.solution.id,
      version: parent === null ? 1 : parent.version + 1,
      parentVersionId: parent === null ? null : parent.id,
      state: input.state,
      provenance,
    });
    this.versionList.push(version);
    return version;
  }
}
