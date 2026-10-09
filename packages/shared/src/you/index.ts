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
