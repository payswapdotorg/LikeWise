// Render technology seed profiles (W4C) — motion-extraction, retargeting,
// image/video/3D render families.
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W4C research seeding on 2026-10-11
// (GitHub raw LICENSE files, GitHub commits/releases atom feeds, npm registry
// and PyPI JSON APIs, vendor product pages). The fetched evidence is
// preserved in the sandbox research logs. License/maintenance claims are
// static data by ship time. Capability tags and compatibility summaries are
// YOU-lab engineering assessments (not external claims) — see
// provenance.claimBasis on each profile. Unverifiable aspects stay listed in
// provenance.unverifiedClaims (truth law — never invent).
//
// Research-time findings disclosed honestly:
// - Initial W4C research probed a WRONG org path for OpenPose
//   (CMU-Perceiving-Systems…, 404) and briefly misread the repository as
//   gone; the correct repo (CMU-Perceptual-Computing-Lab/openpose) EXISTS
//   and its W2C profile is REUSED here (truth law: the correction is
//   recorded, not hidden).
// - WHAM code was NOT FOUND at research time; the scene-class motion family
//   is registered by GVHMR in renderMotionSeedProfiles.ts (the W4C
//   motion-extraction additions live in that sibling file — the W3C
//   geometry/neural split precedent).
// - Rokoko Studio is closed-source proprietary software: its license claim
//   is marked unverified (no EULA text fetched) and its maintenance signal
//   cites the official integration plugin repo (the Studio software itself
//   has no public repository).

// - PROFILE REUSE (the W3C smplx precedent): "blender" (W1C editor
//   registry), "mediapipe", "mmpose" and "openpose" (W2C capture registry)
//   are the SAME
//   real technologies the render lane needs — their profiles are REUSED, not
//   duplicated; a registry technology has exactly one profile per registry
//   build. The W4C additions are the eleven render technologies not yet
//   registered anywhere (nine below + GVHMR/VIBE in
//   renderMotionSeedProfiles.ts). All fifteen render candidate ids resolve
//   through createRenderRegistry() (see render/renderEvaluation.ts).
import { createRegistry, type TechnologyRegistry } from "./registry.js";
import type { TechnologyProfile } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { CAPTURE_SEED_PROFILES } from "./captureSeedProfiles.js";
import { GEOMETRY_RECONSTRUCTION_SEED_PROFILES } from "./reconstructionSeedProfiles.js";
import { NEURAL_RECONSTRUCTION_SEED_PROFILES } from "./reconstructionNeuralSeedProfiles.js";
import { RENDER_MOTION_SEED_PROFILES } from "./renderMotionSeedProfiles.js";

const RESEARCH_DATE = "2026-10-11";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W4C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const RENDER_SEED_PROFILES: readonly TechnologyProfile[] = [
  // ---------------------------------------------------------------------
  // Retargeting
  // ---------------------------------------------------------------------
  {
    id: "rokoko-studio",
    name: "Rokoko Studio (motion capture + retargeting suite)",
    kind: "runtime",
    capabilityTags: ["retargeting", "motion-capture", "live-streaming", "desktop-native", "proprietary-service"],
    license: {
      spdxId: null,
      name: "Proprietary Rokoko subscription/EULA (not fetched — unverified)",
      sourceUrl: "https://www.rokoko.com/",
      verified: false,
      note: "Rokoko Studio is closed-source commercial software; the subscription EULA text was not fetched during research, so the license claim stays unverified (truth law). No open-source license is claimed.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to the official Rokoko Studio live Blender plugin (Update to 1.4.3)", date: "2025-09-11", sourceUrl: "https://github.com/Rokoko/rokoko-studio-live-blender/commits/master", verified: true },
    ],
    repoUrl: "https://www.rokoko.com/",
    compatibility: {
      summary: "Commercial motion-capture suite (suit-based and markerless capture, Actor-to-Character retargeting, live streaming into DCC tools via official plugins). Closed-source: production adoption requires a commercial subscription and legal review; the maintenance signal tracks the official integration plugin because the Studio software itself has no public repository.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://www.rokoko.com/",
        "https://github.com/Rokoko/rokoko-studio-live-blender/commits/master",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "license: Rokoko Studio EULA/subscription terms not fetched during research (vendor page only)",
        "maintenance: Rokoko Studio desktop/web release cadence not independently verifiable (signal cites the official integration plugin)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "rigify",
    name: "Rigify (Blender auto-rigging/metarig add-on)",
    kind: "library",
    capabilityTags: ["retargeting", "auto-rigging", "skeleton-generation", "desktop-native", "animation-tools"],
    license: {
      spdxId: "GPL-2.0-or-later",
      name: "GNU General Public License v2.0 or later (Rigify, in-tree Blender add-on)",
      sourceUrl: "https://github.com/blender/blender/blob/main/scripts/addons_core/rigify/__init__.py",
      verified: true,
      note: "Rigify ships in the Blender source tree (scripts/addons_core/rigify) with SPDX-License-Identifier: GPL-2.0-or-later headers; the file was fetched and read during research.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to blender main (Fix: Geometry Nodes: Quick Fur only hides node group selector…)", date: "2026-10-11", sourceUrl: "https://github.com/blender/blender/commits/main", verified: true },
      { kind: "github-release", signal: "Blender v5.2.2 (in-tree Rigify release vehicle)", date: "2026-09-14", sourceUrl: "https://github.com/blender/blender/releases", verified: true },
    ],
    repoUrl: "https://github.com/blender/blender/tree/main/scripts/addons_core/rigify",
    compatibility: {
      summary: "Blender's bundled auto-rigging system (metarig → generated rig with IK/FK controls); the Auto-Rig-class candidate with a fully public implementation. GPL-2.0-or-later (ships inside Blender) — copyleft obligations apply to derived distributions. Maintained as part of the very active Blender tree; signal granularity is repo-level (in-tree add-on), not Rigify-commit-level.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/blender/blender/blob/main/scripts/addons_core/rigify/__init__.py",
        "https://github.com/blender/blender/commits/main",
        "https://github.com/blender/blender/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "maintenance signal granularity: blender/blender repo-level activity, not Rigify-directory-specific commits",
        "Rigify Python API stability across Blender 5.x releases not audited during research",
      ],
    },
    editorCapable: false,
  },
  {
    id: "libigl",
    name: "libigl (geometry processing / mesh-deformation toolkit)",
    kind: "library",
    capabilityTags: ["retargeting", "mesh-deformation", "arap-deformation", "geometry-processing", "local-cpu"],
    license: {
      spdxId: "MPL-2.0",
      name: "Mozilla Public License 2.0 (libigl, dual-licensed MPL-2.0/GPL)",
      sourceUrl: "https://github.com/libigl/libigl/blob/main/LICENSE.MPL2",
      verified: true,
      note: "LICENSE.MPL2 at repo main is the Mozilla Public License 2.0 text; the repository also carries LICENSE.GPL (dual licensing). MPL-2.0 is file-level copyleft — weaker obligations than GPL for combined works.",
    },
    maintenance: [
      { kind: "github-release", signal: "v2.6.4", date: "2026-09-15", sourceUrl: "https://github.com/libigl/libigl/releases", verified: true },
      { kind: "github-commit", signal: "last commit to libigl main (Fix deprecation warnings in FastWindingNumbersForSoups.h #2476)", date: "2026-09-04", sourceUrl: "https://github.com/libigl/libigl/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/libigl/libigl",
    compatibility: {
      summary: "Header-only C++ geometry-processing library (ARAP deformation, skinning, bounding-volume hierarchies) — the mesh-deformation-toolkit entry of the retargeting family: deterministic CPU math for deformation-transfer/retarget building blocks. MPL-2.0 is outside the permissive SPDX shortlist used for production eligibility; file-level copyleft still applies.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/libigl/libigl/blob/main/LICENSE.MPL2",
        "https://github.com/libigl/libigl/releases",
        "https://github.com/libigl/libigl/commits/main",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "dual-license boundary (which files are MPL-only vs GPL-only) not exhaustively audited during research",
        "Python-bindings channel (igl PyPI package) maintenance not fetched during research",
      ],
    },
    editorCapable: false,
  },
  // ---------------------------------------------------------------------
  // Image render
  // ---------------------------------------------------------------------
  {
    id: "diffusers",
    name: "Hugging Face Diffusers (diffusion-class image pipelines)",
    kind: "library",
    capabilityTags: ["image-render", "diffusion-pipelines", "text-to-image", "server-inference", "local-gpu"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0 (Diffusers)",
      sourceUrl: "https://github.com/huggingface/diffusers/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at repo main is the Apache 2.0 text; PyPI metadata for diffusers also declares Apache-2.0. Note: pipeline CODE is Apache-2.0 — individual model WEIGHTS carry their own licenses (frequently non-commercial) and must be checked per model.",
    },
    maintenance: [
      { kind: "github-release", signal: "Diffusers 0.41.0: QwenImage 2.1 pipeline and more", date: "2026-10-06", sourceUrl: "https://github.com/huggingface/diffusers/releases", verified: true },
      { kind: "pypi-upload", signal: "diffusers@0.41.0", date: "2026-10-06", sourceUrl: "https://pypi.org/pypi/diffusers/json", verified: true },
      { kind: "github-commit", signal: "last commit to diffusers main ([cli] detect composite block classes in custom_blocks #15001)", date: "2026-10-10", sourceUrl: "https://github.com/huggingface/diffusers/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/huggingface/diffusers",
    compatibility: {
      summary: "The reference diffusion-model toolbox (text-to-image, image-to-image, inpainting and more as composable pipelines); very active Apache-2.0 library — the code license is production-friendly, but each checkpoint's weights license is independent and often non-commercial (recorded as a compatibility caveat, not a code-license claim).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/huggingface/diffusers/blob/main/LICENSE",
        "https://github.com/huggingface/diffusers/releases",
        "https://github.com/huggingface/diffusers/commits/main",
        "https://pypi.org/pypi/diffusers/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "per-checkpoint model weights licenses not audited during research (code license only)",
        "GPU memory requirements per pipeline not measured during research",
      ],
    },
    editorCapable: false,
  },
  // ---------------------------------------------------------------------
  // Video render
  // ---------------------------------------------------------------------
  {
    id: "animatediff",
    name: "AnimateDiff (animated-diffusion video synthesis)",
    kind: "library",
    capabilityTags: ["video-render", "animated-diffusion", "text-to-video", "motion-module", "server-inference"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0 (AnimateDiff)",
      sourceUrl: "https://github.com/guoyww/AnimateDiff/blob/main/LICENSE.txt",
      verified: true,
      note: "LICENSE.txt at repo main is the Apache 2.0 text.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to AnimateDiff main (update readme)", date: "2024-07-17", sourceUrl: "https://github.com/guoyww/AnimateDiff/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/guoyww/AnimateDiff",
    compatibility: {
      summary: "Motion-module approach for animating diffusion models (text-to-video without per-video tuning); Apache-2.0 code but research-archival maintenance at research time (last commit 2024-07) — the animated-diffusion chain family representative, honest about staleness.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/guoyww/AnimateDiff/blob/main/LICENSE.txt",
        "https://github.com/guoyww/AnimateDiff/commits/main",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "motion-module checkpoint licenses (separate from repo code) not audited during research",
        "community forks' maintenance status not researched",
      ],
    },
    editorCapable: false,
  },
  {
    id: "rife",
    name: "Practical-RIFE (real-time frame interpolation)",
    kind: "library",
    capabilityTags: ["video-render", "frame-interpolation", "real-time-interpolation", "video-pipeline", "local-gpu"],
    license: {
      spdxId: "MIT",
      name: "MIT License (Practical-RIFE)",
      sourceUrl: "https://github.com/hzwer/Practical-RIFE/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at repo main is the MIT text (Copyright (c) 2021 hzwer). The repo's README separately states commercial use of the pretrained models requires permission — recorded as an unverified claim below (model licensing, distinct from the code license).",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to Practical-RIFE main (Add Apple Silicon (MPS) support to warplayer #156)", date: "2026-08-27", sourceUrl: "https://github.com/hzwer/Practical-RIFE/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/hzwer/Practical-RIFE",
    compatibility: {
      summary: "Practical real-time intermediate flow estimation for frame interpolation (CUDA + Apple MPS backends); MIT code, active-ish maintenance at research time — the frame-interpolation-chain entry with the cleanest code license in the video family.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/hzwer/Practical-RIFE/blob/main/LICENSE",
        "https://github.com/hzwer/Practical-RIFE/commits/main",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "pretrained-model commercial-use terms referenced by the README were not fetched or interpreted during research (code MIT license verified)",
        "interpolation quality claims not measured during research",
      ],
    },
    editorCapable: false,
  },
  {
    id: "film",
    name: "FILM (Google frame interpolation for large motion)",
    kind: "library",
    capabilityTags: ["video-render", "frame-interpolation", "large-motion-interpolation", "video-pipeline", "local-gpu"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0 (FILM)",
      sourceUrl: "https://github.com/google-research/frame-interpolation/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at repo main is the Apache 2.0 text.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to frame-interpolation main (Fixes the link to FILM-GDrive Colab)", date: "2023-01-14", sourceUrl: "https://github.com/google-research/frame-interpolation/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/google-research/frame-interpolation",
    compatibility: {
      summary: "Google Research's frame interpolation for large scene motion (scale-agnostic bidirectional flow); Apache-2.0 code but dormant since 2023-01 — registered as the second frame-interpolation-chain representative with an honest staleness record.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/google-research/frame-interpolation/blob/main/LICENSE",
        "https://github.com/google-research/frame-interpolation/commits/main",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "Google Research archive status (no releases published) — maintenance evidence is commit-level only",
        "pretrained-checkpoint availability/licenses not audited during research",
      ],
    },
    editorCapable: false,
  },
  // ---------------------------------------------------------------------
  // 3D render (blender is REUSED from the W1C editor registry — same real
  // technology; three.js + gsplat are the W4C additions)
  // ---------------------------------------------------------------------
  {
    id: "three",
    name: "three.js (WebGL rasterization engine)",
    kind: "library",
    capabilityTags: ["3d-render", "rasterization", "webgl-rendering", "browser-js", "scene-graph"],
    license: {
      spdxId: "MIT",
      name: "MIT License (three.js)",
      sourceUrl: "https://github.com/mrdoob/three.js/blob/dev/LICENSE",
      verified: true,
      note: "LICENSE at repo dev is the MIT text ('The MIT License Copyright © 2010-2026 three.js authors'); npm metadata for three also declares MIT.",
    },
    maintenance: [
      { kind: "github-release", signal: "r186", date: "2026-09-24", sourceUrl: "https://github.com/mrdoob/three.js/releases", verified: true },
      { kind: "npm-publish", signal: "three@0.186.1", date: "2026-09-24", sourceUrl: "https://registry.npmjs.org/three", verified: true },
      { kind: "github-commit", signal: "last commit to three.js dev (chore(deps): update actions/setup-node digest to 949feb2 #34959)", date: "2026-10-11", sourceUrl: "https://github.com/mrdoob/three.js/commits/dev", verified: true },
    ],
    repoUrl: "https://github.com/mrdoob/three.js",
    compatibility: {
      summary: "The de-facto standard WebGL scene-graph/rasterization engine (browser JS with WASM-free pure-JS math, headless via software renderers); MIT with weekly-cadence releases and same-day commits at research time — the strongest license+maintenance 3D-render candidate and the natural profile-backing for the production-eligible evaluation adapter.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/mrdoob/three.js/blob/dev/LICENSE",
        "https://github.com/mrdoob/three.js/releases",
        "https://github.com/mrdoob/three.js/commits/dev",
        "https://registry.npmjs.org/three",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "WebGL rasterization output bit-reproducibility across GPU/driver vendors not measured (engineering expectation: not guaranteed)",
        "renderer deprecation churn (r185→r186 migration surface) not audited during research",
      ],
    },
    editorCapable: false,
  },
  {
    id: "gsplat",
    name: "gsplat (Gaussian-splatting rasterizer)",
    kind: "library",
    capabilityTags: ["3d-render", "gaussian-splatting", "cuda-rasterization", "radiance-field", "local-gpu"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0 (gsplat)",
      sourceUrl: "https://github.com/nerfstudio-project/gsplat/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at repo main is the Apache 2.0 text; PyPI metadata for gsplat also declares Apache-2.0. Distinct from the original InRIA gaussian-splatting research code (non-commercial): gsplat is the nerfstudio-project reimplementation under Apache-2.0.",
    },
    maintenance: [
      { kind: "github-release", signal: "v1.5.3", date: "2025-07-04", sourceUrl: "https://github.com/nerfstudio-project/gsplat/releases", verified: true },
      { kind: "pypi-upload", signal: "gsplat@1.5.3", date: "2025-07-04", sourceUrl: "https://pypi.org/pypi/gsplat/json", verified: true },
      { kind: "github-commit", signal: "last commit to gsplat main ([perf] 3DGS training (simple_trainer.py) on 8x B200: 13.9 ms to 9.8 m…)", date: "2026-09-19", sourceUrl: "https://github.com/nerfstudio-project/gsplat/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/nerfstudio-project/gsplat",
    compatibility: {
      summary: "nerfstudio-project's CUDA Gaussian-splatting rasterizer/trainer (the Apache-2.0 reimplementation used by nerfstudio); active at research time. CUDA-only rasterization — GPU-bounded deployment; eligibility is Apache-2.0-based and distinct from the non-commercial InRIA original.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/nerfstudio-project/gsplat/blob/main/LICENSE",
        "https://github.com/nerfstudio-project/gsplat/releases",
        "https://github.com/nerfstudio-project/gsplat/commits/main",
        "https://pypi.org/pypi/gsplat/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "CUDA compute-capability matrix per release not audited during research",
        "rendering bit-determinism across GPU vendors not measured (engineering expectation: not guaranteed)",
      ],
    },
    editorCapable: false,
  },
];

/** Registry with the W4C render additions applied over W1C+W2C+W3C. */
export function createRenderRegistry(): TechnologyRegistry {
  return createRegistry([
    ...SEED_PROFILES,
    ...CAPTURE_SEED_PROFILES,
    ...GEOMETRY_RECONSTRUCTION_SEED_PROFILES,
    ...NEURAL_RECONSTRUCTION_SEED_PROFILES,
    ...RENDER_MOTION_SEED_PROFILES,
    ...RENDER_SEED_PROFILES,
  ]);
}
