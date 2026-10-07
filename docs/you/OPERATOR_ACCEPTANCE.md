# YOU Operator Acceptance

## Purpose

The operator is the first product-quality gate for the Solution environment.

The operator must be able to judge the experience without reading source code.

## Phase 0 acceptance

### Workspace

- [ ] Solution opens as a native ZCode workspace surface.
- [ ] Solution behaves like Browser/Artifact for focus, close, reopen and ordering.
- [ ] Layout persists.
- [ ] Theme works.
- [ ] Keyboard navigation works.
- [ ] Narrow web layout remains functional.

### Virtual environment

- [ ] Synthetic human/environment renders deterministically.
- [ ] Camera controls work.
- [ ] Object/region selection works.
- [ ] Quality/uncertainty is visible without implying scientific validity.
- [ ] Before/after view works.
- [ ] Version history is understandable.

### Conversation loop

- [ ] User can express intent naturally.
- [ ] Agent can inspect Solution state.
- [ ] Agent can propose a change.
- [ ] Agent change becomes visible in Solution.
- [ ] User can reject it.
- [ ] User can accept it.

### Feedback loop

- [ ] User can select a region.
- [ ] User can describe a deficiency.
- [ ] Feedback becomes a canonical FeedbackRequest.
- [ ] Agent asks for targeted evidence when necessary.
- [ ] User can attach fixture evidence.
- [ ] Deterministic mock processing produces a measurable fixture improvement.

### Manual takeover

- [ ] User can enter Edit mode.
- [ ] User can perform a small manual correction.
- [ ] EditSession is created.
- [ ] Before/after is shown.
- [ ] User can accept/revert.
- [ ] User can explicitly permit learning.
- [ ] No learning occurs without permission.

### Export/interchange

- [ ] User sees a recommended editor.
- [ ] User can export an editable package.
- [ ] Manifest records lineage/provenance.
- [ ] Re-import produces a candidate version.
- [ ] YOU computes a truthful diff.
- [ ] User accepts/rejects the imported version.

### Learning

- [ ] Repeat the same intent.
- [ ] Agent can use an accepted user correction.
- [ ] The UI explains that prior learning influenced the new result.
- [ ] User-scoped preference is distinguishable from universal learning.

### Capability gap

- [ ] Deliberate fixture produces a known capability gap.
- [ ] Agent records attempted strategies.
- [ ] Agent proposes safe alternatives.
- [ ] Agent can recommend Arena escalation.
- [ ] User can authorize the escalation.
- [ ] Mock Arena returns a typed expert result.
- [ ] YOU reviews and applies the result through its own authority.

### Trust

- [ ] Demo is explicitly labeled deterministic/simulated.
- [ ] No raw biometric data is required for the demo.
- [ ] No fake provider success is shown.
- [ ] Errors are truthful.
- [ ] User can inspect what will be learned.

## Operator evidence

Record:

- browser/desktop version;
- OS;
- viewport;
- exact build SHA;
- video/screenshot evidence;
- test command;
- known limitations.

Operator acceptance is a gate, not a suggestion.
