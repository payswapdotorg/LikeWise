// Retry/backoff technology seed profiles (W8C) — the W8C retry/backoff
// registry additions across the order's four candidate classes: circuit
// breakers (opossum), hedged requests (@grpc/grpc-js per the gRPC client
// retry design — an engineering assessment, see unverifiedClaims),
// exponential backoff with jitter (p-retry — the README-documented
// `randomize` option multiplies timeouts by a factor between 1 and 2) and
// token-bucket rate limiting (bottleneck — 2019-stale, deliberately
// exercising the maintenance-gate failure branch).
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W8C research seeding on 2026-10-13
// (raw.githubusercontent.com LICENSE files, the npm registry JSON API and the
// p-retry README). The fetched evidence is preserved in the sandbox research
// logs (research-w8c/). License and maintenance claims are static data by
// ship time. Capability tags and compatibility summaries are YOU-lab
// engineering assessments (not external claims) — see provenance.claimBasis
// on each profile. Aspects that could not be verified stay listed in
// provenance.unverifiedClaims (truth law — never invent, never present an
// unverified claim as verified).

import { createRegistry, type TechnologyRegistry } from "./registry.js";
import type { TechnologyProfile } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { EDITOR_SEED_PROFILES } from "./editorSeedProfiles.js";
import { LEARNING_SEED_PROFILES } from "./learningSeedProfiles.js";
import { SOUL_SEED_PROFILES } from "./soulSeedProfiles.js";
import { REALTIME_SEED_PROFILES } from "./realtimeSeedProfiles.js";
import { GAP_DETECTION_SEED_PROFILES } from "./gapDetectionSeedProfiles.js";

const RESEARCH_DATE = "2026-10-13";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W8C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const RETRY_BACKOFF_SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "opossum",
    name: "opossum",
    kind: "library",
    capabilityTags: ["retry-backoff", "backoff-class:circuit-breaker", "failure-accrual", "fallback-handling"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/nodeshift/opossum/main/LICENSE",
      verified: true,
      note: "Apache License, Version 2.0 text, per the repository LICENSE file (main branch).",
    },
    maintenance: [
      { kind: "npm-publish", signal: "opossum@10.0.0", date: "2026-06-24", sourceUrl: "https://registry.npmjs.org/opossum", verified: true },
    ],
    repoUrl: "https://github.com/nodeshift/opossum",
    compatibility: {
      summary: "circuit-breaker class: failure-accrual breaker with fallback support fits guarding arena provider calls against cascading failure (engineering assessment; the seam arm is a simulation — real integration is W9+ compute-plane work).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/nodeshift/opossum/main/LICENSE",
        "https://registry.npmjs.org/opossum",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "grpc-js",
    name: "@grpc/grpc-js",
    kind: "library",
    capabilityTags: ["retry-backoff", "backoff-class:hedged-request", "rpc-client", "client-side-retry"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://registry.npmjs.org/@grpc/grpc-js",
      verified: true,
      note: "license \"Apache-2.0\" per the npm registry metadata for @grpc/grpc-js@1.14.6 (the package's declared license field; observed 2026-10-13).",
    },
    maintenance: [
      { kind: "npm-publish", signal: "@grpc/grpc-js@1.14.6", date: "2026-10-08", sourceUrl: "https://registry.npmjs.org/@grpc/grpc-js", verified: true },
    ],
    repoUrl: "https://github.com/grpc/grpc-node",
    compatibility: {
      summary: "hedged-request class: the gRPC JavaScript client's server-side-retry/hedging design (duplicate a slow request against another backend) fits latency-guarded arena provider calls (engineering assessment; the seam arm is a simulation).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://registry.npmjs.org/@grpc/grpc-js",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "hedged-request support per the gRPC client retry design (gRFC A6) was not re-verified against the gRFC document during research — the class assignment is an engineering assessment",
        "the GitHub raw LICENSE file was not fetched for this profile (the npm registry license metadata is the verification source)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "p-retry",
    name: "p-retry",
    kind: "library",
    capabilityTags: ["retry-backoff", "backoff-class:exponential-backoff-jitter", "bounded-retry", "promise-retry"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/sindresorhus/p-retry/main/license",
      verified: true,
      note: "MIT License, Copyright (c) Sindre Sorhus, per the repository license file (main branch — the file is lowercase \"license\").",
    },
    maintenance: [
      { kind: "npm-publish", signal: "p-retry@8.0.1", date: "2026-09-01", sourceUrl: "https://registry.npmjs.org/p-retry", verified: true },
    ],
    repoUrl: "https://github.com/sindresorhus/p-retry",
    compatibility: {
      summary: "exponential-backoff-with-jitter class: bounded promise retry with factor-based exponential timeouts and the README-documented `randomize` option (multiplies timeouts by a factor between 1 and 2 — jitter) fits the frozen ArenaRetryPolicy ladder shape (maxAttempts + backoffClass; engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/sindresorhus/p-retry/main/license",
        "https://raw.githubusercontent.com/sindresorhus/p-retry/main/readme.md",
        "https://registry.npmjs.org/p-retry",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "bottleneck",
    name: "Bottleneck",
    kind: "library",
    capabilityTags: ["retry-backoff", "backoff-class:token-bucket", "rate-limiting", "reservoir-scheduling"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/SGrondin/bottleneck/master/LICENSE",
      verified: true,
      note: "The MIT License (MIT), Copyright (c) 2014 Simon Grondin, per the repository LICENSE file (master branch).",
    },
    maintenance: [
      { kind: "npm-publish", signal: "bottleneck@2.19.5", date: "2019-08-03", sourceUrl: "https://registry.npmjs.org/bottleneck", verified: true },
    ],
    repoUrl: "https://github.com/SGrondin/bottleneck",
    compatibility: {
      summary: "token-bucket class: a task scheduler / rate limiter with reservoir semantics fits consumption-governed arena provider calls. Latest npm publish 2019-08-03 — fails the you-lab maintenance recency gate (a deliberate research finding, not an eligibility pass).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/SGrondin/bottleneck/master/LICENSE",
        "https://raw.githubusercontent.com/SGrondin/bottleneck/master/README.md",
        "https://registry.npmjs.org/bottleneck",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the README describes a \"Task Scheduler and Rate Limiter\" with reservoir intervals; the literal \"token bucket\" strategy naming was not found in the README during research — the token-bucket class assignment is an engineering assessment over the reservoir semantics",
      ],
    },
    editorCapable: false,
  },
];

/** Registry with the W8C retry/backoff additions applied over W1C + W5C + W6C + W7C + the W8C gap-detection additions. */
export function createRetryBackoffRegistry(): TechnologyRegistry {
  return createRegistry([
    ...SEED_PROFILES,
    ...EDITOR_SEED_PROFILES,
    ...LEARNING_SEED_PROFILES,
    ...SOUL_SEED_PROFILES,
    ...REALTIME_SEED_PROFILES,
    ...GAP_DETECTION_SEED_PROFILES,
    ...RETRY_BACKOFF_SEED_PROFILES,
  ]);
}

/**
 * Registry with all W8C arena-automation additions (gap-detection +
 * retry/backoff) applied over the full W1C..W7C stack — the convenience
 * composition for the arena evaluation/benchmark path.
 */
export function createArenaRegistry(): TechnologyRegistry {
  return createRetryBackoffRegistry();
}
