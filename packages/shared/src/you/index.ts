// Test-discovery entry for the station's directory-form invocation:
//   pnpm exec tsx --test packages/shared/src/you
// Node's test runner treats a directory argument as a module entry, so
// this file imports every co-located test file to register them. It is
// NOT a production barrel — production code imports `you/contract.js`
// (re-exported through the @zcode/shared entry) or specific modules by
// relative path; nothing should import this file.
import "./clock.test.js";
import "./rng.test.js";
import "./serialize.test.js";
import "./fixture.test.js";
import "./quality.test.js";
import "./versioning.test.js";
import "./events.test.js";
import "./protocol.test.js";
import "./feedback.test.js";
import "./editSession.test.js";
import "./learning.test.js";
import "./artifact.test.js";
import "./gap.test.js";
import "./evidenceStore.test.js";
import "./evidenceConsent.test.js";
import "./evidenceCapture.test.js";
import "./evidenceRecord.test.js";
import "./evidenceRetention.test.js";
import "./evidenceLedger.test.js";
import "./htirDomain.test.js";
import "./twinBinding.test.js";
import "./twinQuality.test.js";
import "./twinVersioning.test.js";
import "./reconstruction.test.js";
import "./twinLedger.test.js";
import "./performanceTimeline.test.js";
import "./performanceTemplate.test.js";
import "./renderJob.test.js";
import "./renderArtifact.test.js";
import "./performanceLedger.test.js";
import "./editingSession.test.js";
import "./editChangeSet.test.js";
import "./candidateVersion.test.js";
import "./importExport.test.js";
import "./editingLedger.test.js";
import "./learningSignal.test.js";
import "./learningRights.test.js";
import "./learningRecord.test.js";
import "./learningPreference.test.js";
import "./learningTrajectory.test.js";
import "./learningLedger.test.js";
import "./embodimentLadder.test.js";
import "./soulBinding.test.js";
import "./bodyRegistry.test.js";
import "./embodimentLedger.test.js";
import "./arenaRunLadder.test.js";
import "./arenaRetryPolicy.test.js";
import "./arenaEscalationLadder.test.js";
import "./escalationAuthorization.test.js";
import "./arenaClient.test.js";
import "./gapProjections.test.js";
import "./arenaLedger.test.js";
import "./labRunLadder.test.js";
import "./labExperiment.test.js";
import "./labEvidence.test.js";
import "./labPromotion.test.js";
import "./labLedger.test.js";
import "./rateLimitPolicy.test.js";
import "./importSecurity.test.js";
import "./retentionEnforcement.test.js";
import "./drRestore.test.js";
import "./platformLedger.test.js";
