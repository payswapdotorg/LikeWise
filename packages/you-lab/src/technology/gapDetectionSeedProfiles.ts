// Gap-detection technology seed profiles (W8C) — deterministic detector
// approaches for the v1 CapabilityGapCategory classes (tool/editor/model/
// skill/knowledge/data/expert): JSON Schema validation (ajv), editor config
// conformance (editorconfig-checker), evaluation harnesses
// (lm-evaluation-harness), rule-based NLP (spaCy), lexical retrieval scoring
// (rank-bm25), dataframe validation (pandera) and policy evaluation (OPA).
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W8C research seeding on 2026-10-13
// (raw.githubusercontent.com LICENSE files, the GitHub repository API and
// releases.atom feeds, the npm registry JSON API, the PyPI JSON API and the
// PyPI-hosted sdist for pandera's LICENSE.txt). The fetched evidence is
// preserved in the sandbox research logs (research-w8c/). License and
// maintenance claims are static data by ship time. Capability tags and
// compatibility summaries are YOU-lab engineering assessments (not external
// claims) — see provenance.claimBasis on each profile. Aspects that could
// not be verified stay listed in provenance.unverifiedClaims (truth law —
// never invent, never present an unverified claim as verified).

import { createRegistry, type TechnologyRegistry } from "./registry.js";
import type { TechnologyProfile } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { EDITOR_SEED_PROFILES } from "./editorSeedProfiles.js";
import { LEARNING_SEED_PROFILES } from "./learningSeedProfiles.js";
import { SOUL_SEED_PROFILES } from "./soulSeedProfiles.js";
import { REALTIME_SEED_PROFILES } from "./realtimeSeedProfiles.js";

const RESEARCH_DATE = "2026-10-13";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W8C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const GAP_DETECTION_SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "ajv",
    name: "ajv",
    kind: "library",
    capabilityTags: ["gap-detector", "gap-category:TOOL_GAP", "json-schema-validation", "deterministic-validation"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/ajv-validator/ajv/master/LICENSE",
      verified: true,
      note: "The MIT License (MIT), Copyright (c) 2015-2021 Evgeny Poberezkin, per the repository LICENSE file (master branch).",
    },
    maintenance: [
      { kind: "npm-publish", signal: "ajv@8.20.0", date: "2026-04-24", sourceUrl: "https://registry.npmjs.org/ajv", verified: true },
    ],
    repoUrl: "https://github.com/ajv-validator/ajv",
    compatibility: {
      summary: "TOOL_GAP class: deterministic JSON Schema validation fits detecting missing tool capabilities by validating capability manifests against required-capability schemas (engineering assessment; the detector arm is a simulation — real integration is W9+ compute-plane work).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/ajv-validator/ajv/master/LICENSE",
        "https://registry.npmjs.org/ajv",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "editorconfig-checker",
    name: "editorconfig-checker",
    kind: "library",
    capabilityTags: ["gap-detector", "gap-category:EDITOR_GAP", "config-conformance-check", "cli-checker"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/editorconfig-checker/editorconfig-checker.javascript/master/LICENSE",
      verified: true,
      note: "The MIT License (MIT), per the repository LICENSE file (master branch).",
    },
    maintenance: [
      { kind: "npm-publish", signal: "editorconfig-checker@7.0.0", date: "2026-08-27", sourceUrl: "https://registry.npmjs.org/editorconfig-checker", verified: true },
    ],
    repoUrl: "https://github.com/editorconfig-checker/editorconfig-checker.javascript",
    compatibility: {
      summary: "EDITOR_GAP class: deterministic editor-config conformance checking fits detecting editor-side capability gaps by validating project/editor config against declared conventions (engineering assessment; the detector arm is a simulation).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/editorconfig-checker/editorconfig-checker.javascript/master/LICENSE",
        "https://registry.npmjs.org/editorconfig-checker",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "lm-evaluation-harness",
    name: "lm-evaluation-harness",
    kind: "library",
    capabilityTags: ["gap-detector", "gap-category:MODEL_GAP", "evaluation-harness", "deterministic-scoring"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://api.github.com/repos/EleutherAI/lm-evaluation-harness",
      verified: true,
      note: "license.spdx_id \"MIT\" per the GitHub repository API (observed 2026-10-13); the raw LICENSE file fetch 404'd at main/master during research, so the API license field is the verification source.",
    },
    maintenance: [
      { kind: "github-release", signal: "v0.4.13", date: "2026-08-31", sourceUrl: "https://github.com/EleutherAI/lm-evaluation-harness/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/EleutherAI/lm-evaluation-harness",
    compatibility: {
      summary: "MODEL_GAP class: deterministic evaluation harness scoring fits detecting model-capability gaps by scoring model outputs against fixed task suites (engineering assessment; the detector arm is a simulation — model evaluation itself is compute-plane work).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://api.github.com/repos/EleutherAI/lm-evaluation-harness",
        "https://github.com/EleutherAI/lm-evaluation-harness/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the raw LICENSE file location was not verifiable during research (the GitHub API license.spdx_id is the license verification source)",
        "the release-feed <updated> timestamp is the observed maintenance signal; it was not cross-checked against independent tag publish dates",
      ],
    },
    editorCapable: false,
  },
  {
    id: "spacy",
    name: "spaCy",
    kind: "library",
    capabilityTags: ["gap-detector", "gap-category:SKILL_GAP", "rule-based-nlp", "entity-ruler", "deterministic-pipeline"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/explosion/spaCy/master/LICENSE",
      verified: true,
      note: "The MIT License (MIT), Copyright (C) 2016-2024 ExplosionAI GmbH, 2016 spaCy GmbH, per the repository LICENSE file (master branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "v3.8.16", date: "2026-08-24", sourceUrl: "https://github.com/explosion/spaCy/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/explosion/spaCy",
    compatibility: {
      summary: "SKILL_GAP class: deterministic rule-based NLP (EntityRuler/matcher pipelines over procedure documents) fits detecting missing procedural skill steps (engineering assessment; the detector arm is a simulation).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/explosion/spaCy/master/LICENSE",
        "https://github.com/explosion/spaCy/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the release-feed <updated> timestamp is the observed maintenance signal; it was not cross-checked against independent tag publish dates",
      ],
    },
    editorCapable: false,
  },
  {
    id: "rank-bm25",
    name: "rank_bm25",
    kind: "library",
    capabilityTags: ["gap-detector", "gap-category:KNOWLEDGE_GAP", "lexical-retrieval-scoring", "bm25"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/dorianbrown/rank_bm25/master/LICENSE",
      verified: true,
      note: "Apache License, Version 2.0 text, per the repository LICENSE file (master branch).",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "rank-bm25@0.2.2", date: "2022-02-16", sourceUrl: "https://pypi.org/pypi/rank-bm25/json", verified: true },
    ],
    repoUrl: "https://github.com/dorianbrown/rank_bm25",
    compatibility: {
      summary: "KNOWLEDGE_GAP class: deterministic BM25 lexical retrieval scoring fits detecting knowledge-coverage gaps by scoring retrieved evidence below coverage thresholds. Latest PyPI upload 2022-02-16 — fails the you-lab maintenance recency gate (a deliberate research finding, not an eligibility pass).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/dorianbrown/rank_bm25/master/LICENSE",
        "https://pypi.org/pypi/rank-bm25/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "commit activity after the 2022-02-16 PyPI upload was not surveyed (the PyPI upload is the maintenance signal); the maintenance gate fails on the observed signal either way",
      ],
    },
    editorCapable: false,
  },
  {
    id: "pandera",
    name: "pandera",
    kind: "library",
    capabilityTags: ["gap-detector", "gap-category:DATA_GAP", "dataframe-validation", "schema-validation"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://files.pythonhosted.org/packages/bf/56/6c86add6272b295ea77f629757c6d79a12ec30ac51e01a0428d6ff11224c/pandera-0.34.1.tar.gz",
      verified: true,
      note: "MIT License, Copyright (c) 2018 Niels Bantilan, per the LICENSE.txt inside the PyPI-hosted sdist pandera-0.34.1.tar.gz (extracted during research; the GitHub raw LICENSE fetch 404'd).",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "pandera@0.34.1", date: "2026-10-06", sourceUrl: "https://pypi.org/pypi/pandera/json", verified: true },
    ],
    repoUrl: "https://github.com/pandera-dev/pandera",
    compatibility: {
      summary: "DATA_GAP class: deterministic dataframe schema/statistical validation fits detecting data-coverage gaps by validating captured datasets against declared schemas (engineering assessment; the detector arm is a simulation).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://files.pythonhosted.org/packages/bf/56/6c86add6272b295ea77f629757c6d79a12ec30ac51e01a0428d6ff11224c/pandera-0.34.1.tar.gz",
        "https://pypi.org/pypi/pandera/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "open-policy-agent",
    name: "Open Policy Agent",
    kind: "runtime",
    capabilityTags: ["gap-detector", "gap-category:EXPERT_GAP", "policy-evaluation", "rego-policies", "decision-logging"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/open-policy-agent/opa/main/LICENSE",
      verified: true,
      note: "Apache License, Version 2.0 text, per the repository LICENSE file (main branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "v1.21.2", date: "2026-10-12", sourceUrl: "https://api.github.com/repos/open-policy-agent/opa/releases", verified: true },
    ],
    repoUrl: "https://github.com/open-policy-agent/opa",
    compatibility: {
      summary: "EXPERT_GAP class: deterministic policy evaluation (Rego policies over gap/context facts) fits deciding when a human-expert escalation is required and logging the decision (engineering assessment; the detector arm is a simulation).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/open-policy-agent/opa/main/LICENSE",
        "https://api.github.com/repos/open-policy-agent/opa/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
];

/** Registry with the W8C gap-detection additions applied over W1C + W5C + W6C + W7C. */
export function createGapDetectionRegistry(): TechnologyRegistry {
  return createRegistry([
    ...SEED_PROFILES,
    ...EDITOR_SEED_PROFILES,
    ...LEARNING_SEED_PROFILES,
    ...SOUL_SEED_PROFILES,
    ...REALTIME_SEED_PROFILES,
    ...GAP_DETECTION_SEED_PROFILES,
  ]);
}
