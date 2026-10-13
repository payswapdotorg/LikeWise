// Test-discovery entry for the station's directory-form invocation:
//   pnpm exec tsx --test packages/services/src/you
// Node's test runner treats a directory argument as a module entry, so
// this file imports every co-located test file to register them. It is
// NOT a production barrel — nothing should import this file.
import "./solutionService.test.js";
import "./phase0Loop.test.js";
import "./evidenceService.test.js";
import "./evidenceFixtureScenario.test.js";
import "./twinService.test.js";
import "./twinFixtureScenario.test.js";
import "./performanceService.test.js";
import "./performanceFixtureScenario.test.js";
import "./editingService.test.js";
import "./editingFixtureScenario.test.js";
import "./learningService.test.js";
import "./learningFixtureScenario.test.js";
import "./embodimentService.test.js";
import "./embodimentFixtureScenario.test.js";
import "./arenaService.test.js";
import "./arenaFixtureScenario.test.js";
import "./labService.test.js";
import "./labFixtureScenario.test.js";
