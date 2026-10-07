# YOU Bootstrap Status

Date: 2026-10-07

## Repository

- Canonical repository: `payswapdotorg/LikeWise`
- Default branch: `main`
- Bootstrap anchor SHA: `8e4c6cf489da92f1a602cccab2b8516f7247ea68`
- Product: YOU
- Host foundation: ZCode

## Bootstrap completion

- [x] YOU source-of-truth directory established at `docs/you/`
- [x] architecture frozen in `docs/you/ARCHITECTURE.md`
- [x] contracts frozen in `docs/you/CONTRACTS.md`
- [x] security/privacy rules established
- [x] editing/interchange architecture established
- [x] Lab organization/search architecture established
- [x] Arena boundary established
- [x] provider/editor registry rules established
- [x] implementation stages established
- [x] task ledger established
- [x] worker Work Orders established
- [x] operator gate established
- [x] TL handoff established
- [x] root AGENTS.md updated to make repository truth authoritative
- [x] README updated to identify YOU as the product being built
- [x] initial GitHub dispatch issues created

## Initial issues

- #1 YOU-000 — TL bootstrap / contract freeze / dispatch
- #2 YOU-101 — Worker A / Core/API/Domain
- #3 YOU-102 — Worker B / Studio/UX/Editors
- #4 YOU-103 — Worker C / Technology/Editor Registry/Organization Compiler

## Important audit findings

This repository is a ZCode-derived codebase, not a prior YOU implementation. Existing ZCode functionality should be reused where it is an authority (workspace/panes/browser/agent/platform/artifacts) rather than copied into a second framework.

The existing repository already contains architecture-governance and agent-browser/AI-elements skills. Workers must use them.

The product-owner biometric capture is not a prerequisite. Phase 0 uses deterministic synthetic data. Later real-human capture requires a separately authorized QA participant.

## Next action

TL completes YOU-000 from the bootstrap anchor, then dispatches YOU-101/102/103 concurrently with exact branch/base SHA and disjoint write surfaces.

No real reconstruction/GPU dependency is permitted to block Phase 0.
