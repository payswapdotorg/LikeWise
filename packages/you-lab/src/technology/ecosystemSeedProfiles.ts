/* eslint-disable max-lines -- the W10C stage-10 ecosystem research roster (27 REAL approaches with full verified license/maintenance provenance across the seven ecosystem classes: virtual try-on, game/VRM/GLB exports, AR, realtime telepresence, customer-owned compute, additional regional providers, additional styles) is one research-seeding file BY DESIGN (the W2C..W8C per-wave seed-profile precedent — splitting the roster would scatter the truth-law provenance surface), so the per-file line budget is intentionally waived here. */
// Stage-10 ecosystem technology seed profiles (W10C) — the W10C ecosystem
// registry additions across the seven stage-10 ecosystem classes: virtual
// try-on (idm-vton, ootdiffusion), game/VRM/GLB exports (babylonjs,
// playcanvas, vrm-specification), AR (model-viewer, arjs, webxr-device-api),
// realtime telepresence (jitsi-meet, galene, mozilla-hubs), customer-owned
// compute (llamafile, localai, gpt4all, jan), additional regional providers
// — the closed class researched ONLY through published documentation per
// docs/you/PROVIDER_ECOSYSTEM.md (deepseek-api, zhipu-bigmodel,
// moonshot-platform, volcengine-doubao, naver-ncloud, upstage-solar,
// sarvam-api) — and additional styles (diffusers, ip-adapter, safetensors,
// sd-scripts, comfyui).
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W10C research seeding on 2026-10-14
// (raw.githubusercontent.com license files, the npm registry JSON API, the
// pypi registry JSON API, github.com releases/commits atom feeds, codeload
// tarballs and the providers' published documentation portals). The fetched
// evidence is preserved in the sandbox research logs (research-w10c/).
// License and maintenance claims are static data by ship time. Capability
// tags and compatibility summaries are YOU-lab engineering assessments (not
// external claims) — see provenance.claimBasis on each profile. Aspects that
// could not be verified stay listed in provenance.unverifiedClaims (truth
// law — never invent, never present an unverified claim as verified).
//
// HONEST RESEARCH FINDINGS (2026-10-14): every open-source virtual-try-on
// approach researched (IDM-VTON, OOTDiffusion) is CC-BY-NC-SA-4.0 licensed
// — the class has NO production-eligible open-source candidate this pass;
// the AR class pick is @google/model-viewer (Apache-2.0, freshest verified
// maintenance); customer-compute carries one deliberate maintenance-gate
// failure (gpt4all — last release 2025-02-25); the style-pipeline class
// carries one maintenance failure (ip-adapter — last commit 2024-06-28) and
// one license-gate failure (comfyui — GPL-3.0); a Japan-market regional
// provider could NOT be verified this pass (llm-jp repository probes 404) —
// no JP matrix region is minted (truth law — never invent coverage).

import { createRegistry, type TechnologyRegistry } from "./registry.js";
import type { TechnologyProfile } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { EDITOR_SEED_PROFILES } from "./editorSeedProfiles.js";
import { LEARNING_SEED_PROFILES } from "./learningSeedProfiles.js";
import { SOUL_SEED_PROFILES } from "./soulSeedProfiles.js";
import { REALTIME_SEED_PROFILES } from "./realtimeSeedProfiles.js";
import { GAP_DETECTION_SEED_PROFILES } from "./gapDetectionSeedProfiles.js";
import { RETRY_BACKOFF_SEED_PROFILES } from "./retryBackoffSeedProfiles.js";

const RESEARCH_DATE = "2026-10-14";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W10C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const ECOSYSTEM_SEED_PROFILES: readonly TechnologyProfile[] = [
  // -------------------------------------------------------------------------
  // Class 1: virtual try-on (both canonical approaches are NC-licensed — the
  // honest research finding: no production-eligible open-source try-on this
  // pass; the matrix gates the class researched-only).
  // -------------------------------------------------------------------------
  {
    id: "idm-vton",
    name: "IDM-VTON",
    kind: "library",
    capabilityTags: ["ecosystem-class:virtual-try-on", "try-on", "garment-transfer", "diffusion-model"],
    license: {
      spdxId: "CC-BY-NC-SA-4.0",
      name: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International",
      sourceUrl: "https://raw.githubusercontent.com/yisol/IDM-VTON/main/LICENSE.txt",
      verified: true,
      note: "Attribution-NonCommercial-ShareAlike 4.0 International, per the repository LICENSE.txt (main branch).",
    },
    maintenance: [
      { kind: "github-commit", signal: "yisol/IDM-VTON@main (last observed commit)", date: "2025-03-07", sourceUrl: "https://github.com/yisol/IDM-VTON/commits/main.atom", verified: true },
    ],
    repoUrl: "https://github.com/yisol/IDM-VTON",
    compatibility: {
      summary: "virtual-try-on class: identity-preserving diffusion try-on over dense correspondence research code fits garment visualization research; the CC-BY-NC-SA license blocks production use and the last observed commit predates the maintenance gate (engineering assessment; a simulation seam covers the class).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/yisol/IDM-VTON/main/LICENSE.txt",
        "https://github.com/yisol/IDM-VTON/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "ootdiffusion",
    name: "OOTDiffusion",
    kind: "library",
    capabilityTags: ["ecosystem-class:virtual-try-on", "try-on", "garment-transfer", "diffusion-model"],
    license: {
      spdxId: "CC-BY-NC-SA-4.0",
      name: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International",
      sourceUrl: "https://raw.githubusercontent.com/levihsu/OOTDiffusion/main/LICENSE",
      verified: true,
      note: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International, per the repository LICENSE (main branch).",
    },
    maintenance: [
      { kind: "github-commit", signal: "levihsu/OOTDiffusion@main (last observed commit)", date: "2024-05-13", sourceUrl: "https://github.com/levihsu/OOTDiffusion/commits/main.atom", verified: true },
    ],
    repoUrl: "https://github.com/levihsu/OOTDiffusion",
    compatibility: {
      summary: "virtual-try-on class: outfitting try-on diffusion research code; NC license blocks production and the last observed commit is far outside the maintenance gate (engineering assessment; a simulation seam covers the class).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/levihsu/OOTDiffusion/main/LICENSE",
        "https://github.com/levihsu/OOTDiffusion/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },

  // -------------------------------------------------------------------------
  // Class 2: game/VRM/GLB exports.
  // -------------------------------------------------------------------------
  {
    id: "babylonjs",
    name: "Babylon.js",
    kind: "library",
    capabilityTags: ["ecosystem-class:game-export", "game-engine", "gltf-export", "webgl-render", "webgpu-render"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/license.md",
      verified: true,
      note: "Apache License 2.0, per the repository license.md (master branch, titled \"Apache License 2.0 (Apache)\") and the npm registry license field for babylonjs@9.30.0.",
    },
    maintenance: [
      { kind: "npm-publish", signal: "babylonjs@9.30.0", date: "2026-10-08", sourceUrl: "https://registry.npmjs.org/babylonjs", verified: true },
    ],
    repoUrl: "https://github.com/BabylonJS/Babylon.js",
    compatibility: {
      summary: "game-export class: a WebGL/WebGPU engine with a glTF/GLB serializer fits authoring and exporting game-ready avatar scenes from the YOU editing plane (engineering assessment; the seam arm is a simulation — real integration is post-W10 compute-plane work).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/license.md",
        "https://registry.npmjs.org/babylonjs",
        "https://github.com/BabylonJS/Babylon.js/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the glTF/GLB serializer's export fidelity for skinned avatar meshes was not exercised during research — the export-capability assignment is an engineering assessment over the documented serializer",
      ],
    },
    editorCapable: false,
  },
  {
    id: "playcanvas",
    name: "PlayCanvas Engine",
    kind: "library",
    capabilityTags: ["ecosystem-class:game-export", "game-engine", "webgl-render", "webgpu-render"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/playcanvas/engine/main/LICENSE",
      verified: true,
      note: "MIT License, Copyright (c) 2011-2026 PlayCanvas Ltd., per the repository LICENSE (main branch).",
    },
    maintenance: [
      { kind: "npm-publish", signal: "playcanvas@2.23.2", date: "2026-10-09", sourceUrl: "https://registry.npmjs.org/playcanvas", verified: true },
    ],
    repoUrl: "https://github.com/playcanvas/engine",
    compatibility: {
      summary: "game-export class: an open WebGL/WebGPU game engine fits lightweight interactive avatar experiences; conservative export surface (GLB interchange via the engine's asset pipeline; engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/playcanvas/engine/main/LICENSE",
        "https://registry.npmjs.org/playcanvas",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the repository license file was fetched from the main branch — the 2.24.0-beta.10 prerelease line (npm, 2026-10-13) was observed but not treated as the maintenance signal (the stable 2.23.2 publish is the signal)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "vrm-specification",
    name: "VRM Specification",
    kind: "format",
    capabilityTags: ["ecosystem-class:vrm-export", "vrm-1.0", "avatar-format", "gltf-extension"],
    license: {
      spdxId: null,
      name: "Unverified — no repository license file found",
      sourceUrl: "https://github.com/vrm-c/vrm-specification",
      verified: false,
      note: "the vrm-specification repository (master tarball inspected 2026-10-14) carries no top-level or nested license file; sample ASSETS reference the separate \"VRM Public License 1.0\" which governs the samples, not the specification documents; the spec-document license remains unverified (truth law).",
    },
    maintenance: [
      { kind: "github-commit", signal: "vrm-c/vrm-specification@master (last observed commit)", date: "2026-10-02", sourceUrl: "https://github.com/vrm-c/vrm-specification/commits/master.atom", verified: true },
    ],
    repoUrl: "https://github.com/vrm-c/vrm-specification",
    compatibility: {
      summary: "vrm-export class: the VRM 1.0 glTF extension specification (humanoid rig, expressions, spring bones) defines the avatar export format the matrix gates; the license is unverified so the class stays researched-only until a license is verified.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/vrm-c/vrm-specification",
        "https://codeload.github.com/vrm-c/vrm-specification/tar.gz/refs/heads/master",
        "https://github.com/vrm-c/vrm-specification/commits/master.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "license: no license file exists anywhere in the repository tarball (root, specification/, samples/ searched) — the specification document license is unverified and blocks eligibility",
        "the VRM Public License 1.0 referenced by sample-asset READMEs was fetched only as a mention, not as the specification's own license",
      ],
    },
    editorCapable: false,
  },

  // -------------------------------------------------------------------------
  // Class 3: AR.
  // -------------------------------------------------------------------------
  {
    id: "model-viewer",
    name: "model-viewer",
    kind: "library",
    capabilityTags: ["ecosystem-class:ar", "web-ar-viewer", "ar-quick-look", "scene-viewer", "gltf-viewing"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://registry.npmjs.org/@google/model-viewer",
      verified: true,
      note: "license \"Apache-2.0\" per the npm registry metadata for @google/model-viewer@4.4.0 (the package's declared license field; observed 2026-10-14).",
    },
    maintenance: [
      { kind: "npm-publish", signal: "@google/model-viewer@4.4.0", date: "2026-10-09", sourceUrl: "https://registry.npmjs.org/@google/model-viewer", verified: true },
    ],
    repoUrl: "https://github.com/google/model-viewer",
    compatibility: {
      summary: "AR class: Google's web component for 3D/AR viewing (AR Quick Look on iOS via USDZ, Scene Viewer on Android) fits the ecosystem gate's AR export lane with the freshest verified maintenance of the researched AR candidates (engineering assessment; the seam arm is a simulation).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://registry.npmjs.org/@google/model-viewer",
        "https://github.com/google/model-viewer/commits/master.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the repository raw LICENSE file was not fetched for this profile (the npm registry license metadata is the verification source); AR Quick Look / Scene Viewer behavior is documented but was not exercised during research",
      ],
    },
    editorCapable: false,
  },
  {
    id: "arjs",
    name: "AR.js",
    kind: "library",
    capabilityTags: ["ecosystem-class:ar", "marker-based-ar", "location-based-ar", "web-ar"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/AR-js-org/AR.js/master/LICENSE",
      verified: true,
      note: "MIT License, Copyright (c) 2020 AR.js, per the repository LICENSE (master branch).",
    },
    maintenance: [
      { kind: "npm-publish", signal: "@ar-js-org/ar.js@3.4.8", date: "2026-03-16", sourceUrl: "https://registry.npmjs.org/@ar-js-org/ar.js", verified: true },
    ],
    repoUrl: "https://github.com/AR-js-org/AR.js",
    compatibility: {
      summary: "AR class: marker/location-based WebAR over the browser stack fits camera-anchored avatar overlay research; maintenance is inside the recency gate but slower than model-viewer (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/AR-js-org/AR.js/master/LICENSE",
        "https://registry.npmjs.org/@ar-js-org/ar.js",
        "https://github.com/AR-js-org/AR.js/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the legacy npm package name ar.js (jeromeetienne/AR.js, MIT, 2.2.2 published 2020-02-29) was observed as the stale upstream line — the maintained @ar-js-org scope is the researched candidate",
      ],
    },
    editorCapable: false,
  },
  {
    id: "webxr-device-api",
    name: "WebXR Device API (specification)",
    kind: "format",
    capabilityTags: ["ecosystem-class:ar", "webxr-standard", "immersive-sessions", "ar-vr-device-api"],
    license: {
      spdxId: null,
      name: "W3C Software and Document License (2015 version)",
      sourceUrl: "https://raw.githubusercontent.com/immersive-web/webxr/main/LICENSE.md",
      verified: true,
      note: "the repository LICENSE.md states all documents are licensed under the W3C Software and Document License; the linked 2015 version page (w3c.org/Consortium/Legal/2015/copyright-software-and-document, fetched 2026-10-14, title \"Software and Document license - 2015 version\") names the license — a custom W3C form, not in the permissive SPDX production set.",
    },
    maintenance: [
      { kind: "github-commit", signal: "immersive-web/webxr@main (last observed commit)", date: "2026-09-10", sourceUrl: "https://github.com/immersive-web/webxr/commits/main.atom", verified: true },
    ],
    repoUrl: "https://github.com/immersive-web/webxr",
    compatibility: {
      summary: "AR class: the W3C immersive-sessions standard underlies every WebAR candidate in the class; the W3C software+document license sits outside the permissive SPDX production set so the standard gates as a specification reference, not a production pick (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/immersive-web/webxr/main/LICENSE.md",
        "https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document",
        "https://github.com/immersive-web/webxr/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the SPDX id mapping (W3C-20150513) was not asserted — the license is recorded by its observed name and source URL only",
      ],
    },
    editorCapable: false,
  },

  // -------------------------------------------------------------------------
  // Class 4: realtime telepresence.
  // -------------------------------------------------------------------------
  {
    id: "jitsi-meet",
    name: "Jitsi Meet",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:realtime-telepresence", "video-conferencing", "sfu-client", "self-hostable"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/jitsi/jitsi-meet/master/LICENSE",
      verified: true,
      note: "Apache License Version 2.0, per the repository LICENSE (master branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "jitsi-meet release 9512", date: "2026-10-14", sourceUrl: "https://github.com/jitsi/jitsi-meet/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/jitsi/jitsi-meet",
    compatibility: {
      summary: "telepresence class: a self-hostable full conferencing stack (client + SFU) fits realtime avatar telepresence research with the freshest release feed of the class (engineering assessment; the seam arm is a simulation).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/jitsi/jitsi-meet/master/LICENSE",
        "https://github.com/jitsi/jitsi-meet/releases.atom",
        "https://github.com/jitsi/jitsi-meet/commits/master.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "galene",
    name: "Galène",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:realtime-telepresence", "sfu-server", "go-server", "self-hostable"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://github.com/jech/galene/blob/master/LICENCE",
      verified: true,
      note: "MIT License, Copyright (c) 2020 by Juliusz Chroboczek, per the repository LICENCE file (British spelling; master tarball fetched from codeload and inspected 2026-10-14).",
    },
    maintenance: [
      { kind: "github-release", signal: "galene-1.2.1", date: "2026-09-08", sourceUrl: "https://github.com/jech/galene/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/jech/galene",
    compatibility: {
      summary: "telepresence class: a minimal self-hostable Go SFU fits low-footprint customer-owned telepresence deployments alongside the heavier conferencing stacks (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://codeload.github.com/jech/galene/tar.gz/refs/heads/master",
        "https://github.com/jech/galene/releases.atom",
        "https://github.com/jech/galene/commits/master.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "mozilla-hubs",
    name: "Mozilla Hubs",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:realtime-telepresence", "virtual-rooms", "webxr-social"],
    license: {
      spdxId: "MPL-2.0",
      name: "Mozilla Public License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/mozilla/hubs/master/LICENSE",
      verified: true,
      note: "Mozilla Public License Version 2.0, per the repository LICENSE (master branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "prod-2026-03-11", date: "2026-03-12", sourceUrl: "https://github.com/mozilla/hubs/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/mozilla/hubs",
    compatibility: {
      summary: "telepresence class: an open WebXR social-rooms platform; MPL-2.0 sits outside the permissive SPDX production set (the W8C gate) and the hosted-service sunset status is unverified — researched-only this pass (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/mozilla/hubs/master/LICENSE",
        "https://github.com/mozilla/hubs/releases.atom",
        "https://github.com/mozilla/hubs/commits/master.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the Mozilla Hubs hosted-service sunset status was NOT re-verified during this pass (no announcement page fetched); only repository commits (2026-08-23) and the last release (prod-2026-03-11, 2026-03-12) were observed",
      ],
    },
    editorCapable: false,
  },

  // -------------------------------------------------------------------------
  // Class 5: customer-owned compute.
  // -------------------------------------------------------------------------
  {
    id: "llamafile",
    name: "llamafile",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:customer-compute", "local-inference", "single-file-runtime", "gguf-weights"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/Mozilla-Ocho/llamafile/main/LICENSE",
      verified: true,
      note: "The Apache 2.0 License, Copyright 2023 Mozilla Foundation, per the repository LICENSE (main branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "llamafile v0.10.6", date: "2026-09-15", sourceUrl: "https://github.com/Mozilla-Ocho/llamafile/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/Mozilla-Ocho/llamafile",
    compatibility: {
      summary: "customer-compute class: a single-file local LLM runtime (weights + runtime in one executable) fits air-gapped customer-owned deployments of the soul plane; Apache-2.0 with fresh maintenance (engineering assessment; the seam arm is a simulation).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/Mozilla-Ocho/llamafile/main/LICENSE",
        "https://github.com/Mozilla-Ocho/llamafile/releases.atom",
        "https://github.com/Mozilla-Ocho/llamafile/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "localai",
    name: "LocalAI",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:customer-compute", "local-inference", "drop-in-api-server", "self-hosted"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/mudler/LocalAI/master/LICENSE",
      verified: true,
      note: "MIT License, Copyright (c) 2023-2025 Ettore Di Giacinto (mudler@localai.io), per the repository LICENSE (master branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "v4.11.0", date: "2026-10-02", sourceUrl: "https://github.com/mudler/LocalAI/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/mudler/LocalAI",
    compatibility: {
      summary: "customer-compute class: a self-hosted drop-in OpenAI-style API server fits customer-owned compute where the YOU stack must keep a stable API shape on-premises (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/mudler/LocalAI/master/LICENSE",
        "https://github.com/mudler/LocalAI/releases.atom",
        "https://github.com/mudler/LocalAI/commits/master.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "gpt4all",
    name: "GPT4All",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:customer-compute", "local-inference", "desktop-app", "chat-ui"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/nomic-ai/gpt4all/main/LICENSE.txt",
      verified: true,
      note: "MIT License, Copyright (c) 2023 Nomic, Inc., per the repository LICENSE.txt (main branch, full MIT text).",
    },
    maintenance: [
      { kind: "github-release", signal: "v3.10.0", date: "2025-02-25", sourceUrl: "https://github.com/nomic-ai/gpt4all/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/nomic-ai/gpt4all",
    compatibility: {
      summary: "customer-compute class: a desktop local-LLM application; permissive MIT license but the last release (2025-02-25) and last observed commit (2025-05-27) fall outside the maintenance recency gate — a deliberate research finding, not an eligibility pass (the W8C bottleneck precedent).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/nomic-ai/gpt4all/main/LICENSE.txt",
        "https://github.com/nomic-ai/gpt4all/releases.atom",
        "https://github.com/nomic-ai/gpt4all/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "jan",
    name: "Jan",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:customer-compute", "local-inference", "desktop-app", "chat-ui"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/janhq/jan/main/LICENSE",
      verified: true,
      note: "Apache License, Version 2.0, Copyright 2025 Menlo Research, per the repository LICENSE (main branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "0.8.6", date: "2026-10-09", sourceUrl: "https://github.com/janhq/jan/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/janhq/jan",
    compatibility: {
      summary: "customer-compute class: an open local-LLM desktop app with an extension API fits user-owned soul-plane compute with an actively maintained release feed (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/janhq/jan/main/LICENSE",
        "https://github.com/janhq/jan/releases.atom",
        "https://github.com/janhq/jan/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },

  // -------------------------------------------------------------------------
  // Class 6: additional regional providers — the CLOSED class, researched
  // only through published documentation (docs/you/PROVIDER_ECOSYSTEM.md).
  // The maintenance signal is the observed documentation-portal liveness on
  // the research date (never a software release claim). API/provider terms
  // are not open-source licenses: spdxId stays null and every terms-level
  // claim carries unverified markers (truth law).
  // -------------------------------------------------------------------------
  {
    id: "deepseek-api",
    name: "DeepSeek API",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:regional-provider", "closed-provider", "llm-api", "region:cn"],
    license: {
      spdxId: null,
      name: "DeepSeek API provider terms (closed provider — not an open-source license)",
      sourceUrl: "https://api-docs.deepseek.com/",
      verified: false,
      note: "the API documentation portal was live on the research date (HTTP 200, observed page title \"Your First API Call | DeepSeek API Docs\"); the provider terms document itself was not reviewed — closed-provider API terms are pending review and never count as a permissive SPDX license.",
    },
    maintenance: [
      { kind: "provider-docs-portal", signal: "api-docs.deepseek.com live (observed title)", date: "2026-10-14", sourceUrl: "https://api-docs.deepseek.com/", verified: true },
    ],
    repoUrl: "https://www.deepseek.com/",
    compatibility: {
      summary: "regional-provider class (China market): a published LLM API investigated only through its documentation portal; researched-only — the ecosystem gate keeps closed regional providers ineligible pending API-terms review (PROVIDER_ECOSYSTEM.md closed-provider rule).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://api-docs.deepseek.com/",
        "https://platform.deepseek.com/",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "license: the DeepSeek API terms of service were not reviewed — only the documentation portal liveness and page title were observed",
        "the platform.deepseek.com console returned HTTP 403 to automated fetching on the research date (app-console bot protection); console behavior is unverified",
        "model availability and pricing claims were not extracted from the docs portal during this pass",
      ],
    },
    editorCapable: false,
  },
  {
    id: "zhipu-bigmodel",
    name: "Zhipu BigModel Platform",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:regional-provider", "closed-provider", "llm-api", "region:cn"],
    license: {
      spdxId: null,
      name: "Zhipu BigModel provider terms (closed provider — not an open-source license)",
      sourceUrl: "https://open.bigmodel.cn/",
      verified: false,
      note: "the BigModel platform portal was live on the research date (HTTP 200, observed page title \"智谱丨BigModel 平台\"); the provider terms document itself was not reviewed — closed-provider API terms are pending review.",
    },
    maintenance: [
      { kind: "provider-docs-portal", signal: "open.bigmodel.cn live (observed title)", date: "2026-10-14", sourceUrl: "https://open.bigmodel.cn/", verified: true },
    ],
    repoUrl: "https://open.bigmodel.cn/",
    compatibility: {
      summary: "regional-provider class (China market): the Zhipu GLM open platform, researched only through its published documentation; researched-only (engineering assessment; the matrix gates it ineligible pending terms review).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://open.bigmodel.cn/",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "license: the Zhipu BigModel API terms of service were not reviewed — only the portal liveness and page title were observed",
        "GLM model family availability on the platform was not extracted from the page during this pass",
      ],
    },
    editorCapable: false,
  },
  {
    id: "moonshot-platform",
    name: "Moonshot Kimi API Platform",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:regional-provider", "closed-provider", "llm-api", "region:cn"],
    license: {
      spdxId: null,
      name: "Moonshot provider terms (closed provider — not an open-source license)",
      sourceUrl: "https://platform.moonshot.cn/",
      verified: false,
      note: "the Kimi API open platform portal was live on the research date (HTTP 200, observed page title \"Kimi API 开放平台\"); the provider terms document itself was not reviewed — closed-provider API terms are pending review.",
    },
    maintenance: [
      { kind: "provider-docs-portal", signal: "platform.moonshot.cn live (observed title)", date: "2026-10-14", sourceUrl: "https://platform.moonshot.cn/", verified: true },
    ],
    repoUrl: "https://platform.moonshot.cn/",
    compatibility: {
      summary: "regional-provider class (China market): the Moonshot Kimi API platform, researched only through its published documentation; researched-only (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://platform.moonshot.cn/",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "license: the Moonshot platform terms of service were not reviewed — only the portal liveness and page title were observed",
      ],
    },
    editorCapable: false,
  },
  {
    id: "volcengine-doubao",
    name: "Volcano Engine (ByteDance) Model Services",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:regional-provider", "closed-provider", "llm-api", "region:cn"],
    license: {
      spdxId: null,
      name: "Volcano Engine provider terms (closed provider — not an open-source license)",
      sourceUrl: "https://www.volcengine.com/",
      verified: false,
      note: "the Volcano Engine portal was live on the research date (HTTP 200, ~118KB JavaScript-rendered document); no title or model-service facts could be extracted from the rendered shell — the provider terms and the Doubao model service specifics are unverified.",
    },
    maintenance: [
      { kind: "provider-docs-portal", signal: "www.volcengine.com live (JS-rendered shell)", date: "2026-10-14", sourceUrl: "https://www.volcengine.com/", verified: true },
    ],
    repoUrl: "https://www.volcengine.com/",
    compatibility: {
      summary: "regional-provider class (China market): ByteDance's Volcano Engine model services (the Doubao line), researched through the portal's published documentation; the page is JS-rendered so this profile carries the heaviest unverified load of the CN set (truth law — never invent the model surface).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://www.volcengine.com/",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "license: the Volcano Engine terms of service were not reviewed — only portal liveness was observed",
        "the Doubao model family name was not extractable from the JS-rendered portal during this pass; the profile records the platform, not any specific model claim",
        "maintenance: portal liveness is the only signal — no product-release cadence was observed",
      ],
    },
    editorCapable: false,
  },
  {
    id: "naver-ncloud",
    name: "NAVER Cloud Platform (CLOVA)",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:regional-provider", "closed-provider", "llm-api", "region:kr"],
    license: {
      spdxId: null,
      name: "NAVER Cloud Platform provider terms (closed provider — not an open-source license)",
      sourceUrl: "https://www.ncloud.com/",
      verified: false,
      note: "the NAVER Cloud Platform portal was live on the research date (HTTP 200, observed page title \"NAVER CLOUD PLATFORM 네이버 클라우드 플랫폼\"); the provider terms document and the CLOVA LLM API specifics were not reviewed/extracted.",
    },
    maintenance: [
      { kind: "provider-docs-portal", signal: "www.ncloud.com live (observed title)", date: "2026-10-14", sourceUrl: "https://www.ncloud.com/", verified: true },
    ],
    repoUrl: "https://www.ncloud.com/",
    compatibility: {
      summary: "regional-provider class (South Korea market): NAVER's cloud platform (the CLOVA AI line), researched only through its published documentation; researched-only (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://www.ncloud.com/",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "license: the NAVER Cloud Platform terms of service were not reviewed — only the portal liveness and page title were observed",
        "the CLOVA LLM API surface was not extracted from the portal during this pass (the platform title is the only verified fact)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "upstage-solar",
    name: "Upstage Solar",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:regional-provider", "closed-provider", "llm-api", "region:kr"],
    license: {
      spdxId: null,
      name: "Upstage provider terms (closed provider — not an open-source license)",
      sourceUrl: "https://www.upstage.ai/",
      verified: false,
      note: "the Upstage site was live on the research date (HTTP 200, observed page title \"Upstage AI - Building intelligence for the future of work\" with visible \"Solar LLM\" / \"Solar Chat\" references); the provider API terms document was not reviewed.",
    },
    maintenance: [
      { kind: "provider-docs-portal", signal: "www.upstage.ai live (observed title + Solar references)", date: "2026-10-14", sourceUrl: "https://www.upstage.ai/", verified: true },
    ],
    repoUrl: "https://www.upstage.ai/",
    compatibility: {
      summary: "regional-provider class (South Korea market): Upstage's Solar LLM line, researched through the company's published site; researched-only (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://www.upstage.ai/",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "license: the Upstage API terms of service were not reviewed — only the site liveness, title and Solar naming were observed",
      ],
    },
    editorCapable: false,
  },
  {
    id: "sarvam-api",
    name: "Sarvam AI API",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:regional-provider", "closed-provider", "llm-api", "region:in"],
    license: {
      spdxId: null,
      name: "Sarvam AI provider terms (closed provider — not an open-source license)",
      sourceUrl: "https://platform.sarvam.ai/",
      verified: false,
      note: "the Sarvam platform portal returned HTTP 403 to automated fetching on the research date — the portal's contents, the provider terms and the service surface are ALL unverified; the profile records the India-market candidate with an honest unverified load.",
    },
    maintenance: [
      { kind: "provider-docs-portal", signal: "platform.sarvam.ai unreachable (HTTP 403 from this sandbox)", date: "2026-10-14", sourceUrl: "https://platform.sarvam.ai/", verified: false },
    ],
    repoUrl: "https://www.sarvam.ai/",
    compatibility: {
      summary: "regional-provider class (India market): the Sarvam AI platform — the ONLY verified fact is that the platform portal refused automated fetching (HTTP 403) on the research date; every deeper claim stays unverified (truth law — never invent coverage).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://platform.sarvam.ai/",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "license: the Sarvam API terms of service were not reviewed — the portal itself was unfetchable (HTTP 403)",
        "maintenance: no documentation-portal liveness could be verified — the only observed fact is the HTTP 403 refusal on 2026-10-14",
        "the Sarvam model/API surface is entirely unverified this pass (no page content was ever fetched)",
      ],
    },
    editorCapable: false,
  },

  // -------------------------------------------------------------------------
  // Class 7: additional styles.
  // -------------------------------------------------------------------------
  {
    id: "diffusers",
    name: "Hugging Face Diffusers",
    kind: "library",
    capabilityTags: ["ecosystem-class:style-pipeline", "diffusion-pipelines", "lora-support", "style-transfer"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/huggingface/diffusers/main/LICENSE",
      verified: true,
      note: "Apache License Version 2.0, per the repository LICENSE (main branch) and the pypi metadata license field \"Apache 2.0 License\" for diffusers 0.41.0.",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "diffusers 0.41.0", date: "2026-10-06", sourceUrl: "https://pypi.org/pypi/diffusers/json", verified: true },
    ],
    repoUrl: "https://github.com/huggingface/diffusers",
    compatibility: {
      summary: "style-pipeline class: the standard diffusion pipeline library (LoRA/adapter-based style application) is the backbone for the authored style vocabulary behind the ecosystem gate (engineering assessment; the seam arm is a simulation).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/huggingface/diffusers/main/LICENSE",
        "https://pypi.org/pypi/diffusers/json",
        "https://github.com/huggingface/diffusers/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "ip-adapter",
    name: "IP-Adapter",
    kind: "library",
    capabilityTags: ["ecosystem-class:style-pipeline", "style-reference-adapter", "image-prompt-adapter"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/tencent-ailab/IP-Adapter/main/LICENSE",
      verified: true,
      note: "Apache License Version 2.0, per the repository LICENSE (main branch).",
    },
    maintenance: [
      { kind: "github-commit", signal: "tencent-ailab/IP-Adapter@main (last observed commit)", date: "2024-06-28", sourceUrl: "https://github.com/tencent-ailab/IP-Adapter/commits/main.atom", verified: true },
    ],
    repoUrl: "https://github.com/tencent-ailab/IP-Adapter",
    compatibility: {
      summary: "style-pipeline class: reference-image style adapters fit style conditioning research; Apache-2.0 but the last observed commit (2024-06-28) is far outside the maintenance recency gate — a deliberate research finding, not an eligibility pass.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/tencent-ailab/IP-Adapter/main/LICENSE",
        "https://github.com/tencent-ailab/IP-Adapter/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "safetensors",
    name: "safetensors",
    kind: "library",
    capabilityTags: ["ecosystem-class:style-pipeline", "tensor-serialization", "safe-model-format"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/huggingface/safetensors/main/LICENSE",
      verified: true,
      note: "Apache License Version 2.0, per the repository LICENSE (main branch); the pypi license metadata field for safetensors 0.8.0 was null (the GitHub LICENSE file is the verification source).",
    },
    maintenance: [
      { kind: "github-release", signal: "v0.9.0-rc.1", date: "2026-09-23", sourceUrl: "https://github.com/huggingface/safetensors/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/huggingface/safetensors",
    compatibility: {
      summary: "style-pipeline class: the safe tensor container underpins style-model artifacts with memory-mapped loading; permissive and maintained (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/huggingface/safetensors/main/LICENSE",
        "https://github.com/huggingface/safetensors/releases.atom",
        "https://pypi.org/pypi/safetensors/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the pypi license field for safetensors was null at fetch time — the GitHub LICENSE file is the sole license verification source for this profile",
      ],
    },
    editorCapable: false,
  },
  {
    id: "sd-scripts",
    name: "kohya-ss sd-scripts",
    kind: "library",
    capabilityTags: ["ecosystem-class:style-pipeline", "lora-training", "fine-tuning"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/kohya-ss/sd-scripts/main/LICENSE.md",
      verified: true,
      note: "Apache License Version 2.0, per the repository LICENSE.md (main branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "Version 0.12.0", date: "2026-09-24", sourceUrl: "https://github.com/kohya-ss/sd-scripts/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/kohya-ss/sd-scripts",
    compatibility: {
      summary: "style-pipeline class: LoRA training scripts fit authoring new style classes on customer-owned compute; permissive and maintained (engineering assessment).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/kohya-ss/sd-scripts/main/LICENSE.md",
        "https://github.com/kohya-ss/sd-scripts/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "comfyui",
    name: "ComfyUI",
    kind: "runtime",
    capabilityTags: ["ecosystem-class:style-pipeline", "node-graph-ui", "diffusion-workflow"],
    license: {
      spdxId: "GPL-3.0",
      name: "GNU General Public License v3",
      sourceUrl: "https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/LICENSE",
      verified: true,
      note: "GNU GENERAL PUBLIC LICENSE Version 3, per the repository LICENSE (master branch); GPL-3.0 sits outside the permissive SPDX production set (the W8C gate).",
    },
    maintenance: [
      { kind: "github-release", signal: "v0.40.0", date: "2026-10-13", sourceUrl: "https://github.com/comfyanonymous/ComfyUI/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/comfyanonymous/ComfyUI",
    compatibility: {
      summary: "style-pipeline class: a node-graph diffusion workflow UI with an exceptionally fresh release feed, but the GPL-3.0 license blocks the production-friendliness gate — a deliberate license-branch failure (the W8C pm4py precedent).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/LICENSE",
        "https://github.com/comfyanonymous/ComfyUI/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
];

/** Registry with the W10C ecosystem additions applied over the full W1C..W8C stack. */
export function createEcosystemRegistry(): TechnologyRegistry {
  return createRegistry([
    ...SEED_PROFILES,
    ...EDITOR_SEED_PROFILES,
    ...LEARNING_SEED_PROFILES,
    ...SOUL_SEED_PROFILES,
    ...REALTIME_SEED_PROFILES,
    ...GAP_DETECTION_SEED_PROFILES,
    ...RETRY_BACKOFF_SEED_PROFILES,
    ...ECOSYSTEM_SEED_PROFILES,
  ]);
}

/**
 * Registry with all W10C ecosystem-plane additions (the seven stage-10
 * ecosystem classes) applied over the full W1C..W9C stack — the convenience
 * composition for the ecosystem evaluation/matrix/benchmark path.
 */
export function createStage10EcosystemRegistry(): TechnologyRegistry {
  return createEcosystemRegistry();
}
