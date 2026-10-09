// Consumer-simulation test: a test file that imports the package entry under
// node:test (child context with ITS OWN argv[1]) must not trigger the you-lab
// suite-entry guard in index.ts. This is the T1-integration safety property.
// The entry import is deferred into the test callback: in directory mode
// index.ts imports this module from inside its guard block, and by callback
// time index evaluation is complete (no module-evaluation-time cycle).
// W2C: the package-root directory (`pnpm exec tsx --test packages/you-lab`,
// resolved by tsx to the package-root index.ts) is also a legitimate single
// suite runner entry — accepted below alongside the W1C forms.
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("consumer: importing the package entry under node:test does not double-run the suite", async () => {
  // The suite-entry guard in index.ts fires only when index.ts IS the runner
  // directory entry. In file mode the runner entry is THIS file; in W1C
  // directory mode it is the package src directory; in the W2C station form
  // it is the package root directory (resolved by tsx to the root index.ts).
  // All three modes yield exactly one suite run (the guard never re-enters
  // through this import).
  const entry = resolve(process.argv[1] ?? "");
  const own = fileURLToPath(import.meta.url);
  const packageDir = dirname(own);
  const packageRoot = dirname(packageDir);
  assert.ok(
    entry === own || entry === packageDir || entry === packageRoot,
    `unexpected runner entry: ${entry}`,
  );

  const mod = await import("./index.js");
  const registry = mod.createDefaultRegistry();
  const fixture = mod.BENCHMARK_FIXTURES[0];
  assert.ok(fixture);
  const plan = mod.compileOrganization(fixture.intent, registry);
  assert.equal(plan.planId.length, 8);
  assert.equal(plan.compilerVersion, "you-lab-organization-compiler/1");
});
