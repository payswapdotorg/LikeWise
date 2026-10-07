// YOU Solution protocol runtime (docs/you/CONTRACTS.md "Solution protocol").
//
// Handles frozen wave-1 host commands and produces typed, envelope
// carrying runtime events. The runtime is the Solution-side half of the
// host bridge: it tracks the loaded version, selection, compare version
// and a non-canonical projection overlay. Canonical truth changes only
// through the versioning authority; patch_projection affects the live
// projection view and emits change_proposed.
//
// Error mapping (typed YouError, always simulated: true — truth law):
//   wrong envelope/direction/version/solutionId -> YOU_PROTOCOL_VIOLATION
//   unknown versionId (load/compare)            -> YOU_VERSION_NOT_FOUND
//   unknown selector target                     -> YOU_PROTOCOL_VIOLATION
//   stale patch base / disposed runtime         -> YOU_INVALID_STATE

import type {
  OpaqueId,
  SolutionHostCommand,
  SolutionIdentity,
  SolutionMessage,
  SolutionProtocolEnvelope,
  SolutionRuntimeEvent,
  SolutionSelector,
  SolutionStatePatch,
  SolutionStateSnapshot,
  SolutionVersion,
  YouError,
  YouProtocolVersion,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import { validateSelectorTarget } from "./feedback.js";
import type { YouIdFactory } from "./ids.js";
import { applyPatchOperations } from "./versioning.js";

export const YOU_SOLUTION_PROTOCOL_VERSION: YouProtocolVersion = "you-solution/1";

export interface ProtocolRuntimeDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

export interface SolutionProtocolRuntimeOptions {
  readonly solution: SolutionIdentity;
  readonly versionResolver: (versionId: OpaqueId) => SolutionVersion | null;
  readonly initialVersionId: OpaqueId;
  readonly deps: ProtocolRuntimeDeps;
}

export interface RuntimeSnapshotRecord {
  readonly snapshotId: OpaqueId;
  readonly purpose: "agent-observation" | "user-comparison" | "export";
  readonly state: SolutionStateSnapshot;
  readonly createdAt: string;
}

export interface SolutionRuntimeStateView {
  readonly currentVersionId: OpaqueId;
  readonly selection: SolutionSelector | null;
  readonly compareVersionId: OpaqueId | null;
  readonly disposed: boolean;
}

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): YouError {
  return { code, message, details, simulated: true };
}

/** Typed runtime over one Solution's version set. */
export class SolutionProtocolRuntime {
  private disposed = false;
  private selection: SolutionSelector | null = null;
  private compareVersionId: OpaqueId | null = null;
  private overlay: SolutionStatePatch | null = null;
  private readonly snapshots = new Map<OpaqueId, RuntimeSnapshotRecord>();

  private constructor(
    private readonly solution: SolutionIdentity,
    private readonly versionResolver: (versionId: OpaqueId) => SolutionVersion | null,
    private currentVersionId: OpaqueId,
    private readonly deps: ProtocolRuntimeDeps,
  ) {}

  /** Opens the runtime; emits the initial `ready` event to the host. */
  static open(options: SolutionProtocolRuntimeOptions): {
    readonly runtime: SolutionProtocolRuntime;
    readonly ready: SolutionMessage;
  } {
    const runtime = new SolutionProtocolRuntime(
      options.solution,
      options.versionResolver,
      options.initialVersionId,
      options.deps,
    );
    return { runtime, ready: runtime.notify({ type: "ready" }) };
  }

  /** Builds a host-to-solution message (test/service helper). */
  buildHostMessage(command: SolutionHostCommand): SolutionMessage {
    return {
      protocolVersion: YOU_SOLUTION_PROTOCOL_VERSION,
      messageId: this.deps.ids.next("message"),
      correlationId: null,
      solutionId: this.solution.id,
      workspaceIdentity: this.solution.workspaceIdentity,
      timestamp: this.deps.clock.now(),
      direction: "host-to-solution",
      command,
    };
  }

  /** Wraps a runtime event into a solution-to-host message. */
  notify(event: SolutionRuntimeEvent): SolutionMessage {
    return this.messageFor(event, null);
  }

  /** Handles one host command; returns the typed responses. */
  handleHostMessage(message: SolutionMessage): readonly SolutionMessage[] {
    if (message.direction !== "host-to-solution") {
      return [this.errorFor(message.messageId, youError("YOU_PROTOCOL_VIOLATION", "expected a host-to-solution message", { reason: "wrong-direction", actualDirection: message.direction }))];
    }
    if (message.protocolVersion !== YOU_SOLUTION_PROTOCOL_VERSION) {
      return [this.errorFor(message.messageId, youError("YOU_PROTOCOL_VIOLATION", "unsupported protocol version", { reason: "protocol-version-mismatch", expected: YOU_SOLUTION_PROTOCOL_VERSION, actual: message.protocolVersion }))];
    }
    if (message.solutionId !== this.solution.id) {
      return [this.errorFor(message.messageId, youError("YOU_PROTOCOL_VIOLATION", "message targets a different solution", { reason: "solution-mismatch", expected: this.solution.id, actual: message.solutionId }))];
    }
    if (this.disposed) {
      return [this.errorFor(message.messageId, youError("YOU_INVALID_STATE", "runtime is disposed", { reason: "runtime-disposed" }))];
    }
    return this.dispatch(message);
  }

  /** Current runtime state view. */
  runtimeState(): SolutionRuntimeStateView {
    return {
      currentVersionId: this.currentVersionId,
      selection: this.selection,
      compareVersionId: this.compareVersionId,
      disposed: this.disposed,
    };
  }

  getSnapshot(snapshotId: OpaqueId): RuntimeSnapshotRecord | null {
    return this.snapshots.get(snapshotId) ?? null;
  }

  /** The pending projection overlay, if any (agent-applied patch). */
  pendingProjectionPatch(): SolutionStatePatch | null {
    return this.overlay;
  }

  /** Current projection state (base version + overlay). */
  projectionState(): SolutionStateSnapshot {
    const base = this.resolveCurrent();
    return this.overlay === null ? base.state : applyPatchOperations(base.state, this.overlay.operations);
  }

  private dispatch(message: SolutionMessage & { readonly command: SolutionHostCommand }): readonly SolutionMessage[] {
    const command = message.command;
    const reply = message.messageId;
    switch (command.type) {
      case "load_version": {
        const version = this.versionResolver(command.versionId);
        if (version === null || version.solutionId !== this.solution.id) {
          return [this.errorFor(reply, youError("YOU_VERSION_NOT_FOUND", "unknown solution version", { versionId: command.versionId }))];
        }
        this.currentVersionId = version.id;
        this.overlay = null;
        return [this.messageFor({ type: "rendered", frameStats: { drawn: true } }, reply)];
      }
      case "set_selection": {
        if (command.selection !== null && !this.selectorResolves(command.selection)) {
          return [this.errorFor(reply, youError("YOU_PROTOCOL_VIOLATION", "selector does not resolve in the current state", { reason: "unknown-selector-target", selectorKind: command.selection.kind }))];
        }
        this.selection = command.selection;
        return [this.messageFor({ type: "selection_changed", selection: command.selection }, reply)];
      }
      case "set_compare_version": {
        if (command.versionId !== null) {
          const version = this.versionResolver(command.versionId);
          if (version === null || version.solutionId !== this.solution.id) {
            return [this.errorFor(reply, youError("YOU_VERSION_NOT_FOUND", "unknown compare version", { versionId: command.versionId }))];
          }
        }
        this.compareVersionId = command.versionId;
        return [this.messageFor({ type: "rendered", frameStats: { drawn: true } }, reply)];
      }
      case "patch_projection": {
        if (command.patch.baseVersionId !== this.currentVersionId) {
          return [this.errorFor(reply, youError("YOU_INVALID_STATE", "patch base does not match the loaded version", { reason: "stale-base-version", expected: this.currentVersionId, actual: command.patch.baseVersionId }))];
        }
        const invalid = this.findInvalidOperation(command.patch);
        if (invalid !== null) {
          return [this.errorFor(reply, youError("YOU_PROTOCOL_VIOLATION", "invalid patch operation", { reason: "invalid-operation", detail: invalid }))];
        }
        this.overlay = command.patch;
        return [this.messageFor({ type: "change_proposed", changeSetId: this.deps.ids.next("changeset") }, reply)];
      }
      case "request_snapshot": {
        const snapshotId = this.deps.ids.next("snapshot");
        this.snapshots.set(snapshotId, {
          snapshotId,
          purpose: command.purpose,
          state: this.projectionState(),
          createdAt: this.deps.clock.now(),
        });
        return [this.messageFor({ type: "snapshot_ready", snapshotId }, reply)];
      }
      case "request_focus": {
        if (!this.selectorResolves(command.selector)) {
          return [this.errorFor(reply, youError("YOU_PROTOCOL_VIOLATION", "focus selector does not resolve in the current state", { reason: "unknown-selector-target", selectorKind: command.selector.kind }))];
        }
        return [this.messageFor({ type: "rendered", frameStats: { drawn: true } }, reply)];
      }
      case "request_upload": {
        if (command.artifactId.length === 0) {
          return [this.errorFor(reply, youError("YOU_PROTOCOL_VIOLATION", "artifactId must be non-empty", { reason: "invalid-artifact-id" }))];
        }
        return [this.messageFor({ type: "upload_requested", artifactId: command.artifactId }, reply)];
      }
      case "dispose": {
        this.disposed = true;
        // The frozen contract defines no disposal acknowledgement event.
        return [];
      }
      default:
        return [this.errorFor(reply, youError("YOU_PROTOCOL_VIOLATION", "unknown command", { reason: "unknown-command" }))];
    }
  }

  private selectorResolves(selector: SolutionSelector): boolean {
    return validateSelectorTarget(selector, this.projectionState());
  }

  private findInvalidOperation(patch: SolutionStatePatch): string | null {
    const state = this.resolveCurrent().state;
    for (const operation of patch.operations) {
      switch (operation.op) {
        case "upsert_entity":
          if (operation.entity.id.length === 0) {
            return "upsert_entity with empty id";
          }
          break;
        case "remove_entity":
          if (!state.entities.some((entity) => entity.id === operation.entityId)) {
            return `remove_entity target does not exist: ${operation.entityId}`;
          }
          break;
        case "adjust_quality":
          if (operation.deficiencyClass.length === 0 || !Number.isFinite(operation.delta)) {
            return "adjust_quality with empty class or non-finite delta";
          }
          break;
        case "update_environment":
          if (operation.environment.background !== undefined && operation.environment.background.length === 0) {
            return "update_environment with empty background";
          }
          break;
      }
    }
    return null;
  }

  private resolveCurrent(): SolutionVersion {
    const version = this.versionResolver(this.currentVersionId);
    if (version === null) {
      throw new Error(`current version ${this.currentVersionId} cannot be resolved`);
    }
    return version;
  }

  private messageFor(event: SolutionRuntimeEvent, correlationId: OpaqueId | null): SolutionMessage {
    const envelope: SolutionProtocolEnvelope = {
      protocolVersion: YOU_SOLUTION_PROTOCOL_VERSION,
      messageId: this.deps.ids.next("message"),
      correlationId,
      solutionId: this.solution.id,
      workspaceIdentity: this.solution.workspaceIdentity,
      timestamp: this.deps.clock.now(),
    };
    return { ...envelope, direction: "solution-to-host", event };
  }

  private errorFor(correlationId: OpaqueId | null, error: YouError): SolutionMessage {
    return this.messageFor({ type: "runtime_error", error }, correlationId);
  }
}
