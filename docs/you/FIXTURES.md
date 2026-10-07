# YOU Deterministic Fixture Strategy

Authority for all Phase-0 fixtures. The Phase-0 demo is **deterministic and
explicitly simulated** (`docs/you/OPERATOR_ACCEPTANCE.md` — Trust). No real
reconstruction, no biometric media, no network, no nondeterminism.

## Laws

1. **No ambient nondeterminism.** Fixture code never calls `Date.now()`,
   `Math.random()`, `performance.now()` or any network/timing API. Clocks and
   RNG are injected (`DeterministicClock`, `DeterministicRng`).
2. **Fixed seeds.** Every fixture scenario declares a stable seed constant.
   Same seed + same input ⇒ byte-identical output on every run and platform.
3. **Injectable clock.** Timestamps are produced by an injected clock that
   returns ISO-8601 strings from a fixed epoch counter in fixture mode.
4. **Stable ordering.** Map/set iteration is never relied upon; iteration
   order is explicitly sorted (by id) wherever output ordering matters.
5. **Measurable improvement.** Fixture "improvement" is a deterministic
   arithmetic delta over `SolutionQualityMap` scores, so before/after
   comparison and the acceptance loop are verifiable numbers, not vibes.
6. **Truth law.** Every fixture-driven output carries `simulated: true`
   (`contract.ts`). Mocks are never reported as completed work
   (`docs/you/CONTRACTS.md` error semantics).
7. **No PII / no biometric data.** The synthetic human is generated from
   seed parameters only. Fixture "evidence" is synthetic.
8. **Golden expectations.** Tests assert exact outputs (snapshots/hashes).
   Any intentional change to a golden expectation is a new fixture version
   with provenance — never an in-place edit of recorded expectations.
9. **Mock Arena.** Arena expert results come from a fixture table keyed by
   capability-gap category and return typed `ArenaExpertResult` payloads.
10. **Append-only history.** Fixture event ledgers only append; replaying a
    ledger reproduces state exactly.

## Wave-1 ownership

- Worker A owns the fixture runtime in `packages/shared/src/you/**`
  (deterministic clock/rng, synthetic-human fixture, quality-delta model,
  event ledger) plus its tests.
- Worker C owns Lab-side benchmark fixtures in `packages/you-lab/**`
  (organization-compiler inputs, mock editor/technology candidates) — C
  consumes A's fixture laws but writes only inside its own package.
- Worker B demonstrates the operator loop against the deterministic fixture
  state; B adds no fixture generators of its own.

## The Phase-0 loop fixture

One scripted scenario must exercise the full gate
(`docs/you/OPERATOR_ACCEPTANCE.md`):

`intent -> Solution -> feedback -> evidence request -> deterministic
improvement -> manual takeover -> EditSession -> export/editor ->
re-import/diff -> learning (with permission) -> repeated intent ->
CapabilityGap -> Arena mock`

Every arrow above is a deterministic step with a golden expectation.
