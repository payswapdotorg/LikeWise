// YOU W5A editing fixture scenario — subject wiring prologue.
//
// The deterministic wiring that provides the editing plane's subject
// artifact (the W4A precedent: the scenario wires the REAL wave-3
// TwinService and the REAL wave-4 PerformanceService, sharing one wave-2
// fixture content store with the editing service):
//
//   twin wiring (createTwin -> synthesizeDomainBlocks -> publishTwinVersion
//   -> promoteTwinVersion) -> performance publication (deterministic
//   timeline over the canonical twin version) -> render job (image-render:
//   queued -> running -> completed) -> the produced image render artifact
//   binds into the editing plane by content ref (registerSubject).
//
// Every step is deterministic with recorded facts (FIXTURES.md laws);
// fixture render output stays `simulated: true` (truth law). The editing
// service is created here because the subject registration shares the
// store; the scenario runner continues from the returned editing service.

import type { OpaqueId } from "@zcode/shared";
import { createFixtureEvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { createPerformanceService, type PerformanceService } from "./performanceService.js";
import { createTwinService, type TwinService } from "./twinService.js";
import { createEditingService, type EditingService } from "./editingService.js";
import {
  EDITING_SCENARIO_SEED,
  PERFORMANCE_WIRING_SEED,
  SCENARIO_RENDER_CUE_SPECS,
  scenarioMust,
  scenarioStep,
  shortHash,
  TWIN_WIRING_SEED,
  type EditingScenarioOptions,
  type EditingScenarioStep,
} from "./editingFixtureScenarioTypes.js";

/** The wiring result consumed by the scenario runner. */
export interface SubjectWiring {
  readonly editing: EditingService;
  readonly twinId: OpaqueId;
  readonly twinVersionId: OpaqueId;
  readonly performanceId: OpaqueId;
  readonly renderJobId: OpaqueId;
  readonly renderArtifactId: OpaqueId;
  readonly subjectId: OpaqueId;
  /** The five wiring steps (indices 1-5 of the scenario trace). */
  readonly steps: readonly EditingScenarioStep[];
}

/** Wires the real wave-3/wave-4 services and registers the editing subject. */
export function wireEditingSubject(options: EditingScenarioOptions, solutionId: OpaqueId): SubjectWiring {
  const store = createFixtureEvidenceContentStore();
  const twin: TwinService = createTwinService({
    workspaceIdentity: "ws-w5a-scenario-twin",
    seed: options.twinSeed ?? TWIN_WIRING_SEED,
  });
  const performance: PerformanceService = createPerformanceService({
    workspaceIdentity: "ws-w5a-scenario-performance",
    seed: options.performanceSeed ?? PERFORMANCE_WIRING_SEED,
    contentStore: store,
  });
  const editing: EditingService = createEditingService({
    workspaceIdentity: "ws-w5a-scenario-editing",
    seed: options.editingSeed ?? EDITING_SCENARIO_SEED,
    contentStore: store,
  });

  const steps: EditingScenarioStep[] = [];

  const createdTwin = scenarioMust(twin.createTwin(solutionId, { displayName: "Scenario Editing Twin" }), "createTwin");
  steps.push(scenarioStep(1, "twin-created", { twinId: createdTwin.twin.id, displayName: createdTwin.twin.displayName }));

  const twinBlocks = scenarioMust(
    twin.synthesizeDomainBlocks(solutionId, {
      domains: ["identity-binding", "morphology", "geometry-skeleton"],
      seedText: "w5a-scenario-twin-v1",
      provenanceSource: "fixture:w5a-scenario",
    }),
    "synthesizeDomainBlocks",
  );
  const twinVersion = scenarioMust(
    twin.publishTwinVersion(solutionId, createdTwin.twin.id, { domainBlocks: twinBlocks.blocks, provenanceSource: "fixture:w5a-scenario" }),
    "publishTwinVersion",
  ).version;
  const promoted = scenarioMust(twin.promoteTwinVersion(solutionId, createdTwin.twin.id, twinVersion.id), "promoteTwinVersion");
  steps.push(
    scenarioStep(2, "twin-version-canonical", {
      twinVersionId: promoted.version.id,
      versionNumber: promoted.version.version,
      status: promoted.version.status,
      domainBlockCount: promoted.version.domainBlocks.length,
    }),
  );

  const timeline = scenarioMust(
    performance.synthesizePerformanceTimeline(solutionId, { cueSpecs: [...SCENARIO_RENDER_CUE_SPECS], seedText: "w5a-scenario-render" }),
    "synthesizeRenderTimeline",
  ).timeline;
  const publishedPerformance = scenarioMust(performance.publishPerformance(solutionId, { twinVersionId: promoted.version.id, timeline }), "publishPerformance").performance;
  steps.push(
    scenarioStep(3, "performance-published", {
      performanceId: publishedPerformance.id,
      twinVersionId: publishedPerformance.twinVersionId,
      cueCount: publishedPerformance.timeline.cues.length,
      durationMs: publishedPerformance.timeline.durationMs,
    }),
  );

  const renderSpec = scenarioMust(
    performance.submitRenderJob(solutionId, { performanceId: publishedPerformance.id, method: "image-render", outputKinds: ["image"] }),
    "submitRenderJob",
  ).spec;
  scenarioMust(performance.startRenderJob(solutionId, renderSpec.id), "startRenderJob");
  const renderResult = scenarioMust(performance.completeRenderJob(solutionId, renderSpec.id), "completeRenderJob").result;
  const artifacts = scenarioMust(performance.artifactsOfJob(solutionId, renderSpec.id), "artifactsOfJob");
  const subjectArtifact = artifacts[0];
  if (subjectArtifact === undefined || subjectArtifact.kind !== "image") {
    throw new Error("scenario expected the completed render job to carry one image artifact");
  }
  steps.push(
    scenarioStep(4, "render-job-completed", {
      jobId: renderSpec.id,
      status: renderResult.status,
      artifactCount: artifacts.length,
      artifactKind: subjectArtifact.kind,
      artifactContentHash: shortHash(subjectArtifact.contentHash),
      simulated: renderResult.simulated,
    }),
  );

  const subject = scenarioMust(
    editing.registerSubject(solutionId, { contentRef: subjectArtifact.contentRef, contentHash: subjectArtifact.contentHash }),
    "registerSubject",
  ).subject;
  steps.push(
    scenarioStep(5, "subject-registered", {
      subjectId: subject.id,
      contentRef: subject.contentRef,
      contentHash: shortHash(subject.contentHash),
      simulated: subject.simulated,
    }),
  );

  return {
    editing,
    twinId: createdTwin.twin.id,
    twinVersionId: promoted.version.id,
    performanceId: publishedPerformance.id,
    renderJobId: renderSpec.id,
    renderArtifactId: subjectArtifact.id,
    subjectId: subject.id,
    steps,
  };
}
