// YOU learning scope taxonomy (W6A — docs/you/CONTRACTS.md "Wave-6
// contract freeze (v6)": the learning SCOPE taxonomy REUSES the v1-common
// frozen `LearningScope` union verbatim — GLOBAL/TENANT/APPLICATION/
// PROJECT/USER/TWIN/ASSET/TASK, UPPERCASE literals — and is NOT
// redeclared by the v6 freeze).
//
// This module owns the frozen runtime list + the stateless literal
// validator shared by the learning plane (signal intake, preference
// projections) so every refusal reasons over the SAME taxonomy. No
// clock, no store, no ambient state (docs/you/FIXTURES.md law 1).

import type { LearningScope } from "./contract.js";

/**
 * The frozen v1-common LearningScope union as a runtime list (fixture
 * definition; the contract union stays the authority — this list must
// never drift from it).
 */
export const LEARNING_SCOPES: readonly LearningScope[] = [
  "GLOBAL",
  "TENANT",
  "APPLICATION",
  "PROJECT",
  "USER",
  "TWIN",
  "ASSET",
  "TASK",
];

/** True when the value is one of the eight frozen UPPERCASE scope literals. */
export function isLearningScopeLiteral(value: string): value is LearningScope {
  return (LEARNING_SCOPES as readonly string[]).includes(value);
}
