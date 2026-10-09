// @zcode/you-lab — public entry (W1C: Technology/Editor/Lab foundation; W2C:
// capture technology candidates, capture adapters and benchmarks).
//
// Provider-neutral editor and organization capability infrastructure:
// technology registry, editor capability profiles, the editor adapter seam,
// the deterministic Organization Compiler, benchmark fixtures/arms/runner,
// and the single seam onto the frozen YOU contract v1. W2C adds the
// provider-neutral capture adapter seam with deterministic mock adapters,
// researched capture-technology registry profiles, capture candidate
// evaluation criteria, the deterministic capture benchmark, and the v2
// EvidenceRecord/qualityObservations seam mapping.

import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export {
  createRegistry,
  validateRegistryIntegrity,
  type LicenseClaim,
  type MaintenanceSignal,
  type MaintenanceSignalKind,
  type RegistryIntegrityReport,
  type TechnologyKind,
  type TechnologyProfile,
  type TechnologyProvenance,
  type TechnologyRegistry,
} from "./technology/registry.js";

export { SEED_PROFILES, createDefaultRegistry } from "./technology/seedProfiles.js";

export {
  CAPTURE_SEED_PROFILES,
  createCaptureRegistry,
} from "./technology/captureSeedProfiles.js";

export {
  deriveEditorCapabilityProfiles,
  integrationTierFor,
  type EditorCapabilityProfile,
  type FormatSupportEntry,
  type IntegrationTier,
  type RoundTripRisk,
} from "./technology/editorCapability.js";

export {
  applyCandidateOperations,
  type CandidateOperation,
  type EditorAdapter,
  type EditorArtifact,
  type EditorDiffReport,
  type EditorExportRequest,
  type EditorImportResult,
  type EditorValidationReport,
  type NeutralCanonicalState,
  type NeutralEntity,
  type NeutralEnvironment,
} from "./adapters/editorAdapterSeam.js";

export { createMockEditorAdapter, mockEditArtifact, roundTripState, type MockEditSpec } from "./adapters/mockEditorAdapter.js";

export {
  validateOrganizationPlan,
  organizationCompilerVersion,
  type BindingKind,
  type CapabilityRequirement,
  type EditorPreference,
  type OrganizationBinding,
  type OrganizationConstraints,
  type OrganizationIntent,
  type OrganizationPlan,
  type OrganizationPlanStep,
  type OutputKind,
  type PlanValidation,
  type PrivacyPolicy,
} from "./organization/model.js";

export { compileOrganization, decomposeIntent, digestIntent, scoreCandidate, type CandidateScore } from "./organization/compiler.js";

export {
  generalistBaselineArm,
  handDesignedArm,
  searchedArm,
  type ArmKind,
  type OrganizationCandidate,
} from "./benchmarks/arms.js";

export { BENCHMARK_FIXTURES, GOLDEN_ARM_OVERALL, GOLDEN_REPORT_RUN_ID, FIXTURE_SET_VERSION, type BenchmarkFixture } from "./benchmarks/fixtures.js";

export {
  runBenchmark,
  type ArmResult,
  type BenchmarkReport,
  type FixtureArmScore,
  type MetricField,
} from "./benchmarks/runner.js";

export { scoreOrganization, SCORER_VERSION, type OrganizationScoreParts } from "./benchmarks/scorer.js";

export {
  recommendationForArtifact,
  toEditorRecommendation,
  toSolutionPatchOperations,
  toEvidenceRecord,
  toEvidenceReview,
  toQualityObservations,
  type CaptureEvidenceContext,
  type EvidenceReviewConstruction,
  type QualityObservationEntry,
} from "./contractSeam.js";

export { canonicalJson, daysBetweenIso, fnv1a32, roundTo, sortedUnique } from "./determinism.js";

// ---------------------------------------------------------------------------
// W2C: capture adapter seam, deterministic mocks, evaluation and benchmark
// ---------------------------------------------------------------------------

export {
  clamp01,
  labelForMeanChroma,
  NEUTRAL_SKELETON,
  NEUTRAL_SKELETON_MODEL,
  PERSON_LABEL_CHROMA_THRESHOLD,
  PROP_LABEL_CHROMA_THRESHOLD,
  type CaptureAdapter,
  type CaptureAdapterProfile,
  type CaptureCapability,
  type CaptureObservation,
  type CaptureObservationBatch,
  type NeutralBlock,
  type NeutralCaptureFrame,
  type NeutralCaptureModality,
  type NeutralCapturePayload,
  type PoseLandmark,
  type PoseObservation,
  type RuntimeClass,
  type SegmentationObservation,
  type SegmentedRegion,
  type SkeletonJointSpec,
} from "./capture/captureAdapterSeam.js";

export { createDeterministicRng, seedToUint32, unitFrom, type DeterministicRng } from "./capture/deterministicRng.js";

export {
  generateSyntheticCapture,
  type CaptureGroundTruth,
  type GroundTruthFrame,
  type GroundTruthRegion,
  type SyntheticCaptureFixture,
  type SyntheticCaptureSpec,
} from "./capture/syntheticPayload.js";

export { createMockSegmentationAdapter, mockSegmentationGenerator, type MockSegmentationConfig } from "./capture/mockSegmentationAdapter.js";

export { createMockPoseAdapter, mockPoseGenerator, type MockPoseConfig } from "./capture/mockPoseAdapter.js";

export {
  captureCandidateIdsForFamily,
  deriveCaptureCandidateProfiles,
  type CaptureCandidateFamily,
  type CaptureCandidateProfile,
  type CaptureEvaluationCriteria,
} from "./capture/captureEvaluation.js";

export {
  POSE_CANDIDATES,
  SEGMENTATION_CANDIDATES,
  createStandardCaptureCandidates,
  type PoseCandidateSpec,
  type SegmentationCandidateSpec,
} from "./capture/captureCandidates.js";

export {
  CAPTURE_BENCHMARK_FIXTURES,
  CAPTURE_FIXTURE_SET_VERSION,
  type CaptureBenchmarkFixture,
} from "./capture/captureFixtures.js";

export {
  runCaptureBenchmark,
  type CandidateCaptureResult,
  type CaptureBenchmarkReport,
  type FixtureCandidateScore,
} from "./capture/captureRunner.js";

export {
  POSE_ERROR_SCALE,
  POSE_WEIGHTS,
  SCORER_CAPTURE_VERSION,
  SEGMENTATION_WEIGHTS,
  poseQualityEntries,
  segmentationQualityEntries,
  scorePoseObservations,
  scoreSegmentationObservations,
  type PoseQualityParts,
  type SegmentationQualityParts,
} from "./capture/observationScorer.js";

// ---------------------------------------------------------------------------
// Test-suite entry for the station command
//
// `pnpm exec tsx --test packages/you-lab/src` passes the DIRECTORY to the
// node:test runner; tsx resolves that directory to THIS index module and runs
// it as a single child entry. When — and only when — this module is that
// entry, the co-located test modules are imported so the full suite executes
// under the exact station command. Library imports never trigger this:
// NODE_TEST_CONTEXT is set only by the node:test runner, and the argv check
// ensures argv[1] resolves to THIS directory (a test file that imports the
// package under node:test sees its own path in argv[1]). Glob invocation
// (`tsx --test "packages/you-lab/src/**/*.test.ts"`) runs each test module
// directly and never enters this branch.

function isTestRunnerDirectoryEntry(): boolean {
  const context = process.env.NODE_TEST_CONTEXT ?? "";
  if (!context.startsWith("child")) return false;
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return fileURLToPath(import.meta.url) === join(resolve(entry), "index.ts");
  } catch {
    return false;
  }
}

if (isTestRunnerDirectoryEntry()) {
  await import("./technology/registry.test.js");
  await import("./technology/editorCapability.test.js");
  await import("./technology/captureSeedProfiles.test.js");
  await import("./adapters/mockEditorAdapter.test.js");
  await import("./organization/compiler.test.js");
  await import("./benchmarks/benchmark.test.js");
  await import("./capture/deterministicRng.test.js");
  await import("./capture/syntheticPayload.test.js");
  await import("./capture/mockSegmentationAdapter.test.js");
  await import("./capture/mockPoseAdapter.test.js");
  await import("./capture/observationScorer.test.js");
  await import("./capture/captureBenchmark.test.js");
  await import("./capture/captureEvaluation.test.js");
  await import("./contractSeam.test.js");
  await import("./consumer-sim.test.js");
}
