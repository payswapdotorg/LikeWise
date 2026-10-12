// Soul technology seed profiles (W7C) — the W7C LLM/VLM provider and
// state-routing registry additions across the order's first two candidate
// classes: LLM/VLM providers (open-weight serving stacks: vllm,
// text-generation-inference; inference runtimes: llama.cpp, ollama;
// multimodal VLM/open-weight families: qwen3-vl, llama-3 — the latter
// deliberately exercising the not-production-friendly custom-license
// branch) and state-routing approaches (system-one/system-two routing
// implementations: routellm; speculative-decode class: eagle, medusa).
// The third W7C class — realtime media stacks — lives in
// realtimeSeedProfiles.ts (the W4C renderSeedProfiles/renderMotionSeedProfiles
// two-file precedent for one wave's additions).
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W7C research seeding on 2026-10-12
// (raw.githubusercontent.com LICENSE files, the github.com releases.atom /
// commits.atom feeds, and rfc-editor.org for the WHIP RFC; the datatracker
// API was inaccessible from the sandbox — HTTP 403 — so the WHIP publication
// DAY could not be verified and stays month-precision, never an invented
// day). The fetched evidence is preserved in the sandbox research logs
// (research-w7c/). License and maintenance claims are static data by ship
// time. Capability tags and compatibility summaries are YOU-lab engineering
// assessments (not external claims) — see provenance.claimBasis on each
// profile. Aspects that could not be verified stay listed in
// provenance.unverifiedClaims (truth law — never invent, never present an
// unverified claim as verified).
//
// PROFILE REUSE (the W3C/W4C/W5C/W6C precedents): createSoulRegistry()
// composes the W1C seed profiles + the W5C editor ecosystem + the W6C
// learning additions + these nine soul/provider additions + the W7C
// realtime additions (realtimeSeedProfiles.ts). Nothing here duplicates an
// existing profile id.

import { createRegistry, type TechnologyRegistry } from "./registry.js";
import type { TechnologyProfile } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { EDITOR_SEED_PROFILES } from "./editorSeedProfiles.js";
import { LEARNING_SEED_PROFILES } from "./learningSeedProfiles.js";
import { REALTIME_SEED_PROFILES } from "./realtimeSeedProfiles.js";

const RESEARCH_DATE = "2026-10-12";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W7C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const SOUL_SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "vllm",
    name: "vLLM",
    kind: "library",
    capabilityTags: ["llm-serving", "open-weight-serving", "text-generation", "vision-input", "continuous-batching", "python-library"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/vllm-project/vllm/main/LICENSE",
      verified: true,
      note: "Apache License 2.0 text, per the vllm-project/vllm repository LICENSE file (main branch); head and tail of the fetched file match the Apache 2.0 text.",
    },
    maintenance: [
      { kind: "github-release", signal: "v0.31.0", date: "2026-10-06", sourceUrl: "https://github.com/vllm-project/vllm/releases.atom", verified: true },
      { kind: "github-release", signal: "proto-v0.5.0", date: "2026-10-09", sourceUrl: "https://github.com/vllm-project/vllm/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/vllm-project/vllm",
    compatibility: {
      summary: "Open-weight LLM/VLM serving stack (W7C serving-stack class): paged-attention/continuous-batching inference server for open-weight models — a fit for serving SoulBindings over system-one and system-two routes.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/vllm-project/vllm/main/LICENSE",
        "https://github.com/vllm-project/vllm/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the newest release tag observed is proto-v0.5.0 (2026-10-09), a protos sidecar package tag, while the newest core release observed is v0.31.0 (2026-10-06); the alignment between repository tags and the PyPI vllm package not verified at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "llama-cpp",
    name: "llama.cpp",
    kind: "library",
    capabilityTags: ["inference-runtime", "gguf-weights", "text-generation", "vision-input", "cpu-inference", "cpp-library"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/ggml-org/llama.cpp/master/LICENSE",
      verified: true,
      note: "MIT License, Copyright (c) 2023-2026 The ggml authors, per the ggml-org/llama.cpp repository LICENSE file (master branch — the repository's default branch is master; the main branch does not exist).",
    },
    maintenance: [
      { kind: "github-release", signal: "b11559", date: "2026-10-11", sourceUrl: "https://github.com/ggml-org/llama.cpp/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/ggml-org/llama.cpp",
    compatibility: {
      summary: "Local inference runtime (W7C inference-runtime class): GGUF open-weight execution on CPU/GPU with multimodal (vision) support — a fit for locally-possessed Souls over both routing profiles; the freshest permissive-licensed candidate at research time.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/ggml-org/llama.cpp/master/LICENSE",
        "https://github.com/ggml-org/llama.cpp/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the b-numbered tags are the repository's own release practice (b11559 observed latest); package-registry feeds (none canonical for llama.cpp) not consulted at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "ollama",
    name: "Ollama",
    kind: "runtime",
    capabilityTags: ["inference-runtime", "model-serving", "text-generation", "vision-input", "local-daemon"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/ollama/ollama/main/LICENSE",
      verified: true,
      note: "MIT License, Copyright (c) Ollama, per the ollama/ollama repository LICENSE file (main branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "v0.40.3", date: "2026-10-11", sourceUrl: "https://github.com/ollama/ollama/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/ollama/ollama",
    compatibility: {
      summary: "Local model-serving daemon (W7C inference-runtime class): bundled open-weight model runner with a local API — a fit for locally-possessed Souls over both routing profiles.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/ollama/ollama/main/LICENSE",
        "https://github.com/ollama/ollama/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the alignment between repository tags and the distributed desktop binaries not verified at research time (the GitHub release feed is the maintenance signal)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "text-generation-inference",
    name: "Text Generation Inference (TGI)",
    kind: "runtime",
    capabilityTags: ["llm-serving", "open-weight-serving", "text-generation", "rust-server", "docker-deploy"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/huggingface/text-generation-inference/main/LICENSE",
      verified: true,
      note: "Apache License 2.0 text, per the huggingface/text-generation-inference repository LICENSE file (main branch).",
    },
    maintenance: [
      { kind: "github-commit", signal: "commits/main (latest observed: 'docs: add AWS (EC2/SageMaker) deployment + benchmarking guide (#3352)')", date: "2026-03-21", sourceUrl: "https://github.com/huggingface/text-generation-inference/commits/main.atom", verified: true },
      { kind: "github-release", signal: "v3.3.7", date: "2025-12-19", sourceUrl: "https://github.com/huggingface/text-generation-inference/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/huggingface/text-generation-inference",
    compatibility: {
      summary: "Open-weight LLM serving stack (W7C serving-stack class): Rust/Python inference server with tensor parallelism for open-weight models — a fit for serving SoulBindings over both routing profiles.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/huggingface/text-generation-inference/main/LICENSE",
        "https://github.com/huggingface/text-generation-inference/commits/main.atom",
        "https://github.com/huggingface/text-generation-inference/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "repository commit activity (2026-03-21) is fresher than the latest observed release v3.3.7 (2025-12-19); the alignment between the repository and the Docker images on the registry not verified at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "qwen3-vl",
    name: "Qwen3-VL",
    kind: "library",
    capabilityTags: ["vlm-family", "open-weights", "text-generation", "vision-input", "apache-licensed-weights"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/QwenLM/Qwen3-VL/main/LICENSE",
      verified: true,
      note: "Apache License 2.0 text, per the QwenLM/Qwen3-VL repository LICENSE file (main branch). The older QwenLM/Qwen2.5-VL repository 301-redirects to Qwen3-VL (the family line consolidated repos).",
    },
    maintenance: [
      { kind: "github-commit", signal: "commits/main (latest observed: 'Merge pull request #1971 from 2003jiahang/patch-1')", date: "2026-01-30", sourceUrl: "https://github.com/QwenLM/Qwen3-VL/commits/main.atom", verified: true },
    ],
    repoUrl: "https://github.com/QwenLM/Qwen3-VL",
    compatibility: {
      summary: "Multimodal open-weight VLM family (W7C vlm-family class): vision-language model line spanning small (system-one) and large (system-two) variants — a fit for multimodal SoulBindings with image understanding.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/QwenLM/Qwen3-VL/main/LICENSE",
        "https://github.com/QwenLM/Qwen3-VL/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the releases feed lists no entries (the commit feed is the maintenance signal); the alignment between the repository and the Hugging Face weight releases not verified at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "llama-3",
    name: "Llama 3 (llama-models)",
    kind: "library",
    capabilityTags: ["llm-family", "open-weights", "text-generation", "vision-input", "community-license"],
    license: {
      spdxId: null,
      name: "LLAMA 3.1 Community License Agreement",
      sourceUrl: "https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama3_1/LICENSE",
      verified: true,
      note: "Custom non-SPDX license: 'LLAMA 3.1 COMMUNITY LICENSE AGREEMENT' (Llama 3.1 Version Release Date: July 23, 2024), per the meta-llama/llama-models repository — NOT in the you-lab permissive SPDX set; this profile deliberately exercises the not-production-friendly branch (the W6C pm4py precedent).",
    },
    maintenance: [
      { kind: "github-commit", signal: "commits/main (latest observed: 'feat(cli): add llama-models CLI for standalone model management (#403)')", date: "2025-10-10", sourceUrl: "https://github.com/meta-llama/llama-models/commits/main.atom", verified: true },
      { kind: "github-release", signal: "v0.2.0", date: "2025-04-05", sourceUrl: "https://github.com/meta-llama/llama-models/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/meta-llama/llama-models",
    compatibility: {
      summary: "Open-weight model family (W7C vlm-family class): Meta's Llama line spanning text-only and vision variants, served through any open-weight serving stack. Custom community license — not production-friendly without legal review.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama3_1/LICENSE",
        "https://github.com/meta-llama/llama-models/commits/main.atom",
        "https://github.com/meta-llama/llama-models/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the standalone Meta-Llama-3 repositories were consolidated into llama-models (the standalone URLs 404 at research time); the mapping between llama-models releases/commits and the distributed weight versions not verified at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "routellm",
    name: "RouteLLM",
    kind: "library",
    capabilityTags: ["state-routing", "system-one-system-two", "cost-aware-routing", "router-framework", "text-endpoints", "python-library"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/lm-sys/RouteLLM/main/LICENSE",
      verified: true,
      note: "Apache License 2.0 text, per the lm-sys/RouteLLM repository LICENSE file (main branch — the organization is lm-sys; the lmsys spelling does not resolve).",
    },
    maintenance: [
      { kind: "github-commit", signal: "commits/main (latest observed: 'create /health endpoint for health checks')", date: "2024-08-10", sourceUrl: "https://github.com/lm-sys/RouteLLM/commits/main.atom", verified: true },
    ],
    repoUrl: "https://github.com/lm-sys/RouteLLM",
    compatibility: {
      summary: "System-one/system-two routing framework (W7C state-routing class): routes queries between strong (system-two) and weak (system-one) LLM endpoints by learned/cost-aware router policies — the routing-profile pattern of the frozen v7 SoulRoutingProfile.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/lm-sys/RouteLLM/main/LICENSE",
        "https://github.com/lm-sys/RouteLLM/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the releases feed lists no entries (the commit feed is the maintenance signal); commit activity after 2024-08-10 not observed at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "eagle",
    name: "EAGLE (speculative decoding)",
    kind: "library",
    capabilityTags: ["speculative-decode", "draft-model", "decoding-acceleration", "text-decoding", "python-library"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/SafeAILab/EAGLE/main/LICENSE",
      verified: true,
      note: "Apache License 2.0, Copyright 2025 SafeAI Lab (SAIL), per the SafeAILab/EAGLE repository LICENSE file (main branch); head and tail of the fetched file match the Apache 2.0 text.",
    },
    maintenance: [
      { kind: "github-commit", signal: "commits/main (latest observed: 'Add GLM-4.7-Flash EAGLE-3 community model')", date: "2026-02-20", sourceUrl: "https://github.com/SafeAILab/EAGLE/commits/main.atom", verified: true },
    ],
    repoUrl: "https://github.com/SafeAILab/EAGLE",
    compatibility: {
      summary: "Speculative-decode class (W7C): draft-model decoding acceleration (EAGLE-3 line) that pulls deep system-two turns toward interactive latency — an acceleration layer over a serving stack, not a SoulBinding backend by itself.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/SafeAILab/EAGLE/main/LICENSE",
        "https://github.com/SafeAILab/EAGLE/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the releases feed lists no entries (the commit feed is the maintenance signal); the alignment between the repository and the pip-installable eagle packages not verified at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "medusa",
    name: "Medusa (speculative decoding)",
    kind: "library",
    capabilityTags: ["speculative-decode", "multi-head-decoding", "decoding-acceleration", "text-decoding", "python-library"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/FasterDecoding/Medusa/main/LICENSE",
      verified: true,
      note: "Apache License 2.0 text, per the FasterDecoding/Medusa repository LICENSE file (main branch).",
    },
    maintenance: [
      { kind: "github-commit", signal: "commits/main (latest observed: 'Merge pull request #97 from Narsil/medusa2')", date: "2024-04-18", sourceUrl: "https://github.com/FasterDecoding/Medusa/commits/main.atom", verified: true },
      { kind: "github-release", signal: "Medusa-v0.1", date: "2023-09-11", sourceUrl: "https://github.com/FasterDecoding/Medusa/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/FasterDecoding/Medusa",
    compatibility: {
      summary: "Speculative-decode class (W7C): multi-head decoding acceleration — the same acceleration layer pattern as EAGLE; repository activity observed stale at research time.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/FasterDecoding/Medusa/main/LICENSE",
        "https://github.com/FasterDecoding/Medusa/commits/main.atom",
        "https://github.com/FasterDecoding/Medusa/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the commit feed (2024-04-18) is fresher than the only observed release Medusa-v0.1 (2023-09-11); activity after 2024-04-18 not observed at research time",
      ],
    },
    editorCapable: false,
  },
];

/** Registry with the W7C soul/realtime additions applied over W1C + W5C + W6C. */
export function createSoulRegistry(): TechnologyRegistry {
  return createRegistry([
    ...SEED_PROFILES,
    ...EDITOR_SEED_PROFILES,
    ...LEARNING_SEED_PROFILES,
    ...SOUL_SEED_PROFILES,
    ...REALTIME_SEED_PROFILES,
  ]);
}
