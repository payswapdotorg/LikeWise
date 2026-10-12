// Learning technology seed profiles (W6C) — the W6C organization-learning
// registry additions across the order's three candidate classes:
// organization-improvement methods (rule-induction: wittgenstein;
// preference-learning: mord; bandit/selection: mabwiser, vowpal-wabbit),
// tool/editor-selection learners (contextual ranking: lightgbm, xgboost;
// cost-aware selection: smac) and pipeline-improvement methods
// (program synthesis: prose; workflow mining: pm4py — AGPL-3.0, deliberately
// exercising the not-production-friendly branch).
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W6C research seeding on 2026-10-12
// (GitHub raw LICENSE files, the GitHub releases/commits feeds, and the PyPI
// registry JSON API). The fetched evidence is preserved in the sandbox
// research logs. License and maintenance claims are static data by ship
// time. Capability tags and compatibility summaries are YOU-lab engineering
// assessments (not external claims) — see provenance.claimBasis on each
// profile. Aspects that could not be verified stay listed in
// provenance.unverifiedClaims (truth law — never invent, never present an
// unverified claim as verified).
//
// PROFILE REUSE (the W3C/W4C/W5C precedents): createLearningRegistry()
// composes the W1C seed profiles + the W5C editor ecosystem (the
// tool/editor-selection surface the learners select among) + these nine
// learning-method additions. Nothing here duplicates an existing profile id.

import { createRegistry, type TechnologyRegistry } from "./registry.js";
import type { TechnologyProfile } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { EDITOR_SEED_PROFILES } from "./editorSeedProfiles.js";

const RESEARCH_DATE = "2026-10-12";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W6C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const LEARNING_SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "wittgenstein",
    name: "Wittgenstein",
    kind: "library",
    capabilityTags: ["rule-induction", "ripper", "takeover-outcomes", "organization-rules", "python-library"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/imoscovitz/wittgenstein/master/LICENSE",
      verified: true,
      note: "Copyright (c) 2019 Ilan Moscovitz, per the repository LICENSE file (master branch); the PyPI metadata carries the MIT classifier.",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "wittgenstein@0.3.5", date: "2026-04-20", sourceUrl: "https://pypi.org/pypi/wittgenstein/json", verified: true },
    ],
    repoUrl: "https://github.com/imoscovitz/wittgenstein",
    compatibility: {
      summary: "RIPPER/IREP-class interpretable rule induction (W6C rule-induction class): learns ordered IF-THEN rule sets from labeled outcomes — a fit for turning labeled manual-takeover outcomes into auditable organization rules.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/imoscovitz/wittgenstein/master/LICENSE",
        "https://pypi.org/pypi/wittgenstein/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the GitHub repository publishes no releases feed (no GitHub release observed at research time) — the PyPI upload is the live maintenance signal (repository release practice unverified)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "mord",
    name: "mord (ordinal regression)",
    kind: "library",
    capabilityTags: ["preference-learning", "ordinal-regression", "preference-feedback", "preference-models", "python-library"],
    license: {
      spdxId: "BSD-3-Clause",
      name: "3-Clause BSD License",
      sourceUrl: "https://raw.githubusercontent.com/fabianp/mord/master/LICENSE.txt",
      verified: true,
      note: "Repository LICENSE.txt is the '3-Clause BSD License' text (Copyright 2018 Fabian Pedregosa-Izquierdo and mord developer); GitHub's automated license detection reports 'Other' — the raw file was fetched and matches the 3-Clause BSD text.",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "mord@0.7", date: "2023-05-26", sourceUrl: "https://pypi.org/pypi/mord/json", verified: true },
    ],
    repoUrl: "https://github.com/fabianp/mord",
    compatibility: {
      summary: "Ordinal-regression preference learning (W6C preference-learning class): graded feedback/edit-session signals fit monotone preference models — a fit for editor defaults and personalization weights.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/fabianp/mord/master/LICENSE.txt",
        "https://pypi.org/pypi/mord/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "repository activity after the 0.7 PyPI upload (2023-05-26) not verified at research time; GitHub license auto-detection reports 'Other' while the fetched LICENSE.txt matches the 3-Clause BSD text",
      ],
    },
    editorCapable: false,
  },
  {
    id: "mabwiser",
    name: "MABWiser",
    kind: "library",
    capabilityTags: ["bandit-selection", "contextual-bandits", "reward-streams", "selection-policies", "python-library"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/fidelity/mabwiser/master/LICENSE",
      verified: true,
      note: "Apache License 2.0 text, per the fidelity/mabwiser repository LICENSE file (master branch); the PyPI metadata carries the Apache Software License classifier.",
    },
    maintenance: [
      { kind: "github-release", signal: "2.7.4", date: "2024-09-05", sourceUrl: "https://github.com/fidelity/mabwiser/releases", verified: true },
    ],
    repoUrl: "https://github.com/fidelity/mabwiser",
    compatibility: {
      summary: "Contextual multi-armed bandit selection by Fidelity (W6C bandit/selection class): takeover rewards over tool/editor arms learn greedy/thompson/ucb selection policies.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/fidelity/mabwiser/master/LICENSE",
        "https://github.com/fidelity/mabwiser/releases",
        "https://pypi.org/pypi/mabwiser/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the PyPI upload of 2.7.4 (2024-08-30) precedes the GitHub release tag by six days; repository activity after the 2.7.4 release not verified at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "vowpal-wabbit",
    name: "Vowpal Wabbit",
    kind: "library",
    capabilityTags: ["bandit-selection", "online-learning", "reward-streams", "context-features", "selection-policies", "online-personalization", "python-library"],
    license: {
      spdxId: "BSD-3-Clause",
      name: "BSD 3-Clause License",
      sourceUrl: "https://raw.githubusercontent.com/VowpalWabbit/vowpal_wabbit/master/LICENSE",
      verified: true,
      note: "Repository LICENSE is the 3-clause BSD redistribution text (Copyright Microsoft Corp 2012-2014, Yahoo! Inc. 2007-2012, and many individual contributors); the PyPI metadata carries the BSD 3-Clause License field.",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "vowpalwabbit@9.11.9", date: "2026-09-27", sourceUrl: "https://pypi.org/pypi/vowpalwabbit/json", verified: true },
    ],
    repoUrl: "https://github.com/VowpalWabbit/vowpal_wabbit",
    compatibility: {
      summary: "Online learning with contextual-bandit reductions (W6C bandit/selection class): streaming takeover/intent signals learn selection policies and personalization weights incrementally — the freshest permissive-licensed candidate at research time.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/VowpalWabbit/vowpal_wabbit/master/LICENSE",
        "https://pypi.org/pypi/vowpalwabbit/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the exact alignment between the vowpalwabbit 9.11.9 PyPI package and the repository's release tags not verified at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "lightgbm",
    name: "LightGBM",
    kind: "library",
    capabilityTags: ["contextual-ranking", "learning-to-rank", "context-features", "ranked-shortlists", "python-library"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/lightgbm-org/LightGBM/main/LICENSE",
      verified: true,
      note: "The MIT License (MIT), Copyright (c) Microsoft Corporation, Copyright (c) The LightGBM developers, per the repository LICENSE file (main branch); the repository moved from microsoft/LightGBM to the lightgbm-org org (the old URL redirects).",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "lightgbm@4.7.0", date: "2026-07-18", sourceUrl: "https://pypi.org/pypi/lightgbm/json", verified: true },
    ],
    repoUrl: "https://github.com/lightgbm-org/LightGBM",
    compatibility: {
      summary: "Gradient-boosted learning-to-rank (W6C contextual-ranking class): context features from takeover/edit sessions produce ranked tool/editor shortlists via the ranking objectives.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/lightgbm-org/LightGBM/main/LICENSE",
        "https://pypi.org/pypi/lightgbm/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "npm/CRAN package feeds not consulted at research time (the PyPI upload is the maintenance signal)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "xgboost",
    name: "XGBoost",
    kind: "library",
    capabilityTags: ["contextual-ranking", "gradient-boosting", "context-features", "ranked-shortlists", "selection-policies", "python-library"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/dmlc/xgboost/master/LICENSE",
      verified: true,
      note: "Apache License 2.0 text, per the dmlc/xgboost repository LICENSE file (master branch); the repository bundles per-component notices (LICENSE, NOTICE).",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "xgboost@3.4.1", date: "2026-08-15", sourceUrl: "https://pypi.org/pypi/xgboost/json", verified: true },
    ],
    repoUrl: "https://github.com/dmlc/xgboost",
    compatibility: {
      summary: "Gradient-boosted ranking objectives (rank:ndcg / rank:pairwise — W6C contextual-ranking class): takeover-context features produce ranked tool/editor selection shortlists.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/dmlc/xgboost/master/LICENSE",
        "https://pypi.org/pypi/xgboost/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "per-binding package feeds beyond PyPI (CRAN, JVM artifacts) not consulted at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "smac",
    name: "SMAC3",
    kind: "library",
    capabilityTags: ["cost-aware-selection", "bayesian-optimization", "cost-observations", "cost-aware-configurations", "python-library"],
    license: {
      spdxId: "BSD-3-Clause",
      name: "BSD 3-Clause License",
      sourceUrl: "https://raw.githubusercontent.com/automl/SMAC3/main/LICENSE.txt",
      verified: true,
      note: "Repository LICENSE.txt header: 'SMAC License — BSD 3-Clause License, Copyright (c) 2025, Leibniz University Hannover - Institute of AI'; GitHub's automated detection reports 'Other' — the raw file was fetched and states the BSD 3-Clause License.",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "smac@2.4.1", date: "2026-09-10", sourceUrl: "https://pypi.org/pypi/smac/json", verified: true },
    ],
    repoUrl: "https://github.com/automl/SMAC3",
    compatibility: {
      summary: "Cost-aware Bayesian optimization / algorithm configuration (W6C cost-aware-selection class): observed takeover costs and capability gaps drive cost-aware pipeline and organization configuration.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/automl/SMAC3/main/LICENSE.txt",
        "https://pypi.org/pypi/smac/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the PyPI package name is 'smac' while the repository is SMAC3; GitHub license auto-detection reports 'Other' while the fetched LICENSE.txt states the BSD 3-Clause License",
      ],
    },
    editorCapable: false,
  },
  {
    id: "prose",
    name: "Microsoft PROSE SDK",
    kind: "library",
    capabilityTags: ["program-synthesis", "programming-by-example", "demonstration-streams", "synthesized-programs", "dotnet-sdk"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/microsoft/prose/main/LICENSE",
      verified: true,
      note: "The MIT License (MIT), Copyright (c) 2015 Microsoft, per the repository LICENSE file (main branch; the same file is present on master).",
    },
    maintenance: [
      { kind: "github-commit", signal: "commits/main (latest observed: 'Merge pull request #84 from microsoft/t-smhatre/swe-sharp-bench')", date: "2025-11-19", sourceUrl: "https://github.com/microsoft/prose/commits/main.atom", verified: true },
    ],
    repoUrl: "https://github.com/microsoft/prose",
    compatibility: {
      summary: "Programming-by-example program synthesis (W6C program-synthesis class): takeover demonstrations synthesize pipeline programs and transformation steps. Distributed as the Microsoft.ProgramSynthesis .NET SDK.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/microsoft/prose/main/LICENSE",
        "https://github.com/microsoft/prose/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the repository publishes no GitHub releases (the commit feed is the maintenance signal); the alignment between the repository and the Microsoft.ProgramSynthesis NuGet packages not verified at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "pm4py",
    name: "PM4Py",
    kind: "library",
    capabilityTags: ["workflow-mining", "process-mining", "event-log-streams", "mined-workflows", "python-library"],
    license: {
      spdxId: "AGPL-3.0",
      name: "GNU Affero General Public License v3.0",
      sourceUrl: "https://raw.githubusercontent.com/process-intelligence-solutions/pm4py/release/LICENSE",
      verified: true,
      note: "Repository LICENSE is the GNU Affero General Public License v3.0 text (release branch); the repository moved from pm4py/pm4py to process-intelligence-solutions (the old URL redirects). AGPL-3.0 is NOT in the you-lab permissive SPDX set — this profile deliberately exercises the not-production-friendly branch.",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "pm4py@2.7.23.9", date: "2026-10-09", sourceUrl: "https://pypi.org/pypi/pm4py/json", verified: true },
    ],
    repoUrl: "https://github.com/process-intelligence-solutions/pm4py",
    compatibility: {
      summary: "Process mining over event logs (W6C workflow-mining class): edit-session/repeated-intent event streams mine workflow models for pipeline improvement. AGPL-3.0 — not production-friendly without legal review.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/process-intelligence-solutions/pm4py/release/LICENSE",
        "https://pypi.org/pypi/pm4py/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the availability of separate commercial licensing for pm4py not verified at research time",
      ],
    },
    editorCapable: false,
  },
];

/** Registry with the W6C learning additions applied over W1C + W5C. */
export function createLearningRegistry(): TechnologyRegistry {
  return createRegistry([
    ...SEED_PROFILES,
    ...EDITOR_SEED_PROFILES,
    ...LEARNING_SEED_PROFILES,
  ]);
}
