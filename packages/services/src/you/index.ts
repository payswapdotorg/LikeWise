// Test-discovery entry for the station's directory-form invocation:
//   pnpm exec tsx --test packages/services/src/you
// Node's test runner treats a directory argument as a module entry, so
// this file imports every co-located test file to register them. It is
// NOT a production barrel — nothing should import this file.
import "./solutionService.test.js";
import "./phase0Loop.test.js";
import "./evidenceService.test.js";
import "./evidenceFixtureScenario.test.js";
