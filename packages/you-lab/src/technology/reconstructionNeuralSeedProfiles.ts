// Reconstruction technology seed profiles (W3C) — implicit / neural /
// fast-optimization family. See reconstructionSeedProfiles.ts for the
// provenance header (same one-time 2026-10-11 research seeding; evidence
// preserved in the sandbox research logs; truth law — never invent).
import type { TechnologyProfile } from "./registry.js";

const RESEARCH_DATE = "2026-10-11";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W3C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const NEURAL_RECONSTRUCTION_SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "pifu",
    name: "PIFu (pixel-aligned implicit function)",
    kind: "library",
    capabilityTags: ["human-reconstruction", "implicit-surface", "single-image", "server-inference"],
    license: {
      spdxId: "MIT",
      name: "MIT License (PIFu)",
      sourceUrl: "https://github.com/shunsukesaito/PIFu/blob/master/LICENSE.txt",
      verified: true,
      note: "LICENSE.txt at repo master is the MIT text ('Copyright (c) 2019 Shunsuke Saito, Zeng Huang, and Ryota Natsume') — verified by reading the fetched file.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to PIFu master (Merge PR #125 dependabot/pip/pillow-9.0.0)", date: "2022-01-13", sourceUrl: "https://github.com/shunsukesaito/PIFu/commits/master", verified: true },
    ],
    repoUrl: "https://github.com/shunsukesaito/PIFu",
    compatibility: {
      summary: "Python/PyTorch pixel-aligned implicit function for clothed-human reconstruction from single/multi images. MIT-licensed (rare among human-research repos) but effectively frozen since 2022 at research time.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/shunsukesaito/PIFu/blob/master/LICENSE.txt",
        "https://github.com/shunsukesaito/PIFu/commits/master",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "pretrained-model download/hosting terms not fetched during research (code license verified; weight terms separate)",
        "no formal GitHub releases/tags — version pinning relies on commits",
      ],
    },
    editorCapable: false,
  },
  {
    id: "pifuhd",
    name: "PIFuHD (high-resolution PIFu)",
    kind: "library",
    capabilityTags: ["human-reconstruction", "implicit-surface", "single-image", "server-inference"],
    license: {
      spdxId: null,
      name: "CC BY-NC 4.0 (Attribution-NonCommercial 4.0 International)",
      sourceUrl: "https://github.com/facebookresearch/pifuhd/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at repo main states the source code is licensed under 'Attribution-NonCommercial 4.0 International' and carries the full Creative Commons BY-NC 4.0 text. Non-commercial — production use blocked without separate licensing.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to pifuhd main (Merge PR #164 from ipsavitsky/main)", date: "2023-03-26", sourceUrl: "https://github.com/facebookresearch/pifuhd/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/facebookresearch/pifuhd",
    compatibility: {
      summary: "Python/PyTorch multi-level pixel-aligned implicit reconstruction at higher detail (375k-vertex output). Research-grade, frozen since 2023; CC BY-NC 4.0 blocks production use.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/facebookresearch/pifuhd/blob/main/LICENSE",
        "https://github.com/facebookresearch/pifuhd/commits/main",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "no formal GitHub releases/tags — version pinning relies on commits",
        "pretrained-checkpoint redistribution terms not fetched during research",
      ],
    },
    editorCapable: false,
  },
  {
    id: "icon",
    name: "ICON (implicit clothed humans)",
    kind: "library",
    capabilityTags: ["human-reconstruction", "implicit-surface", "smpl-fitting", "server-inference"],
    license: {
      spdxId: null,
      name: "Software Copyright License for non-commercial scientific research purposes (ICON)",
      sourceUrl: "https://github.com/YuliangXiu/ICON/blob/master/LICENSE",
      verified: true,
      note: "Custom, non-SPDX research-only license covering the ICON model, data and software together. Non-commercial research use only — production use blocked without a separate commercial license.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to ICON master (update on PRT renderer dependency #237)", date: "2023-11-23", sourceUrl: "https://github.com/YuliangXiu/ICON/commits/master", verified: true },
      { kind: "github-release", signal: "ICON v.1.1.0 (tag)", date: "2022-08-05", sourceUrl: "https://github.com/YuliangXiu/ICON/tags", verified: true },
    ],
    repoUrl: "https://github.com/YuliangXiu/ICON",
    compatibility: {
      summary: "Python/PyTorch implicit reconstruction with SMPL-X-guided normals/occupancy for clothed humans. Depends on registration-gated SMPL-X model files (chain constraint, see the smplx profile); train frozen since 2023.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/YuliangXiu/ICON/blob/master/LICENSE",
        "https://github.com/YuliangXiu/ICON/commits/master",
        "https://github.com/YuliangXiu/ICON/tags",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "SMPL-X model-file dependency chain terms not re-verified here (covered by the W2C smplx profile)",
        "normal-predictor checkpoint terms not fetched during research",
      ],
    },
    editorCapable: false,
  },
  {
    id: "econ",
    name: "ECON (implicit clothed humans, omni-supervised)",
    kind: "library",
    capabilityTags: ["human-reconstruction", "implicit-surface", "smpl-fitting", "normal-estimation", "server-inference"],
    license: {
      spdxId: null,
      name: "Software Copyright License for non-commercial scientific research purposes (ECON)",
      sourceUrl: "https://github.com/YuliangXiu/ECON/blob/master/LICENSE",
      verified: true,
      note: "Custom, non-SPDX research-only license (same family as ICON) covering the ECON model, data and software together. Non-commercial research use only — production use blocked without a separate commercial license.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to ECON master (sapiens normal support)", date: "2024-09-17", sourceUrl: "https://github.com/YuliangXiu/ECON/commits/master", verified: true },
    ],
    repoUrl: "https://github.com/YuliangXiu/ECON",
    compatibility: {
      summary: "Python/PyTorch implicit drape/normal-driven reconstruction producing SMPL-X-compatible clothed humans; the ICON successor. Research-only license and SMPL-X/normal-predictor dependency chain; last commit 2024 at research time.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/YuliangXiu/ECON/blob/master/LICENSE",
        "https://github.com/YuliangXiu/ECON/commits/master",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "dependency-chain licensing (SMPL-X registration-gated files, Sapiens normal-predictor checkpoints) not exhaustively verified during research",
        "no formal GitHub releases/tags — version pinning relies on commits",
      ],
    },
    editorCapable: false,
  },
  {
    id: "gaussian-splatting",
    name: "3D Gaussian Splatting (Inria reference implementation)",
    kind: "library",
    capabilityTags: ["gaussian-splatting", "radiance-field", "novel-view-synthesis", "server-inference"],
    license: {
      spdxId: null,
      name: "Gaussian-Splatting License (Inria / MPII, non-commercial research)",
      sourceUrl: "https://github.com/graphdeco-inria/gaussian-splatting/blob/main/LICENSE.md",
      verified: true,
      note: "Custom, non-SPDX license: Inria and MPII hold ownership; use granted free of charge for research/evaluation only, explicitly non-commercial, no sublicense right; the software is in the process of APP registration. Production use blocked without a separate commercial license.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to gaussian-splatting main (fix submodule name in environment.yml)", date: "2024-10-30", sourceUrl: "https://github.com/graphdeco-inria/gaussian-splatting/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/graphdeco-inria/gaussian-splatting",
    compatibility: {
      summary: "Python/CUDA reference implementation of 3D Gaussian Splatting (optimizable radiance primitives with real-time viewing); the base primitive many avatar pipelines build on. Non-commercial license; frozen since 2024 at research time; the active ecosystem lives in derivative repos (gsplat, etc. — not profiled here).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/graphdeco-inria/gaussian-splatting/blob/main/LICENSE.md",
        "https://github.com/graphdeco-inria/gaussian-splatting/commits/main",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "commercial licensing channel from Inria not fetched during research",
        "derivative ecosystem repos (permissively-licensed splatting runtimes) not profiled in this wave — separate candidates for a future registry pass",
      ],
    },
    editorCapable: false,
  },
  {
    id: "gaussianavatars",
    name: "GaussianAvatars (SMPL-X-bound gaussian avatars)",
    kind: "library",
    capabilityTags: ["gaussian-splatting", "animatable-avatar", "smpl-fitting", "radiance-field", "server-inference"],
    license: {
      spdxId: null,
      name: "CC BY-NC-SA 4.0 (Attribution-NonCommercial-ShareAlike 4.0 International)",
      sourceUrl: "https://github.com/ShenhanQian/GaussianAvatars/blob/main/LICENSE.md",
      verified: true,
      note: "LICENSE.md at repo main is titled 'GaussianAvatars License' and carries the full Creative Commons Attribution-NonCommercial-ShareAlike 4.0 text. Non-commercial plus share-alike — production use blocked.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to GaussianAvatars main (replace np.byte with np.uint8)", date: "2026-02-11", sourceUrl: "https://github.com/ShenhanQian/GaussianAvatars/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/ShenhanQian/GaussianAvatars",
    compatibility: {
      summary: "Python/CUDA animatable avatars from monocular video: gaussians bound to a rigged SMPL-X mesh triangle level. Representative of the gaussian-splatting avatar approach class; CC BY-NC-SA 4.0 and SMPL-X model-file chain constraints apply.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/ShenhanQian/GaussianAvatars/blob/main/LICENSE.md",
        "https://github.com/ShenhanQian/GaussianAvatars/commits/main",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "no formal GitHub releases/tags — version pinning relies on commits",
        "SMPL-X model-file dependency chain terms not re-verified here (covered by the W2C smplx profile)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "instantavatar",
    name: "InstantAvatar (fast monocular avatar optimization)",
    kind: "library",
    capabilityTags: ["fast-optimization", "animatable-avatar", "radiance-field", "monocular-video", "server-inference"],
    license: {
      spdxId: null,
      name: "No license file found (default: all rights reserved)",
      sourceUrl: "https://github.com/tijiang13/InstantAvatar",
      verified: true,
      note: "Verified ABSENCE at research time: no LICENSE/LICENSE.md/LICENSE.txt at repo master (all 404) and the README carries no license statement. With no license granted, default copyright (all rights reserved) applies — the repo cannot be used beyond fair-use reading without obtaining a license from the authors.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to InstantAvatar master (Update README.md)", date: "2024-07-10", sourceUrl: "https://github.com/tijiang13/InstantAvatar/commits/master", verified: true },
    ],
    repoUrl: "https://github.com/tijiang13/InstantAvatar",
    compatibility: {
      summary: "Python/CUDA fast-optimization avatar pipeline (rigged mesh + neural texture fields, ~minutes from monocular video) representing the InstantAvatar-class approach. No license file found at research time — blocked for any redistribution or production use until licensed.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/tijiang13/InstantAvatar",
        "https://github.com/tijiang13/InstantAvatar/commits/master",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "license terms outside the repo (paper/project-page terms, author-granted permissions) not found during research — absence verified only for the repository files",
        "the earlier torcheyes/InstantAvatar location now 404s; the canonical current home was resolved to tijiang13/InstantAvatar via the community awesome-list link",
      ],
    },
    editorCapable: false,
  },
  {
    id: "animatablenerf",
    name: "AnimatableNeRF (animatable radiance-field humans)",
    kind: "library",
    capabilityTags: ["radiance-field", "animatable-avatar", "monocular-video", "server-inference"],
    license: {
      spdxId: null,
      name: "Project Registration License (PRL) v1.0 (ZJU3DV)",
      sourceUrl: "https://github.com/zju3dv/animatable_nerf/blob/master/LICENSE",
      verified: true,
      note: "Custom, non-SPDX license adopted 2026-09: research/educational/personal use free without registration; company/organizational Project Use (commercial or not) is free but MUST be registered via the license's form BEFORE use, upon which permission is automatically granted; redistribution must carry the license. Usable in production only as a registered project use — registration is a real obligation, not a formality to skip.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to animatable_nerf master (Adopt Project Registration License v1.0)", date: "2026-09-15", sourceUrl: "https://github.com/zju3dv/animatable_nerf/commits/master", verified: true },
    ],
    repoUrl: "https://github.com/zju3dv/animatable_nerf",
    compatibility: {
      summary: "Python/PyTorch animatable neural radiance fields for dynamic humans from monocular video (NeRF-human class). PRL v1.0 permits registered project use including commercial; no formal releases/tags at research time.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/zju3dv/animatable_nerf/blob/master/LICENSE",
        "https://github.com/zju3dv/animatable_nerf/commits/master",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the PRL registration form (external Google form) availability and processing behavior not verified during research",
        "PRL v1.0 is not an SPDX-listed license — the summary above is an engineering reading of the fetched text, not legal advice",
      ],
    },
    editorCapable: false,
  },
];
