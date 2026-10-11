// Motion-extraction render technology seed profiles (W4C) — the
// world-grounded / video-3D-motion additions.
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W4C research seeding on 2026-10-11
// (GitHub raw LICENSE files, GitHub commits atom feeds). The fetched evidence
// is preserved in the sandbox research logs. License/maintenance claims are
// static data by ship time. Capability tags and compatibility summaries are
// YOU-lab engineering assessments (not external claims) — see
// provenance.claimBasis on each profile. Unverifiable aspects stay listed in
// provenance.unverifiedClaims (truth law — never invent).
//
// Research-time findings disclosed honestly:
// - WHAM (world-grounded human motion, CVPR 2024) code was NOT FOUND at
//   research time (facebookresearch/wham and zju3dv/wham 404; the project
//   pages say code "will be available for research purposes"). The
//   scene-class world-grounded motion family is therefore registered by its
//   real, verifiable representative GVHMR (zju3dv/GVHMR) — no entry claims
//   to be WHAM.
// - The MediaPipe / mmpose / openpose motion-extraction candidates of this
//   family are REUSED from the W2C capture registry (see
//   renderSeedProfiles.ts for the reuse note) — only GVHMR and VIBE are
//   W4C additions here.
import type { TechnologyProfile } from "./registry.js";

const RESEARCH_DATE = "2026-10-11";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W4C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const RENDER_MOTION_SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "gvhmr",
    name: "GVHMR (world-grounded human motion recovery, scene-class)",
    kind: "library",
    capabilityTags: ["motion-extraction", "world-grounded-motion", "smpl-body-mesh", "gravity-view-coordinates", "server-inference"],
    license: {
      spdxId: null,
      name: "Custom non-commercial license (GVHMR, Zhejiang University 3D Vision Group)",
      sourceUrl: "https://github.com/zju3dv/GVHMR/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at repo main grants permission to use, copy, modify and distribute for educational, research and non-profit purposes only; derivative works must be open-source and commercial use is prohibited (commercial contact via the license text) — production use blocked without legal review.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to GVHMR main (Revert 'Adopt Project Registration License v1.0')", date: "2026-09-15", sourceUrl: "https://github.com/zju3dv/GVHMR/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/zju3dv/GVHMR",
    compatibility: {
      summary: "World-grounded human motion recovery from monocular video via gravity-view coordinates (SIGGRAPH Asia 2024 / TPAMI 2026); the real, verifiable scene-class (WHAM-class) representative — registered because the WHAM code repositories were not found at research time. Active commits but non-commercial licensed.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/zju3dv/GVHMR/blob/main/LICENSE",
        "https://github.com/zju3dv/GVHMR/commits/main",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "pretrained-checkpoint availability and their separate license terms not audited during research",
        "no releases published at research time — maintenance evidence is commit-level only",
      ],
    },
    editorCapable: false,
  },  {
    id: "vibe",
    name: "VIBE (video-based 3D human motion recovery)",
    kind: "library",
    capabilityTags: ["motion-extraction", "3d-human-motion", "smpl-body-mesh", "video-inference", "server-inference"],
    license: {
      spdxId: null,
      name: "Software Copyright License for non-commercial scientific research purposes (VIBE)",
      sourceUrl: "https://github.com/mkocabas/VIBE/blob/master/LICENSE",
      verified: true,
      note: "LICENSE at repo master is a custom non-commercial scientific-research license (not an SPDX identifier); commercial use requires a separate UCL Business PLC license per the license text — production use blocked without legal review.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to VIBE master (Merge pull request #266 from silvercondor/master)", date: "2022-08-09", sourceUrl: "https://github.com/mkocabas/VIBE/commits/master", verified: true },
    ],
    repoUrl: "https://github.com/mkocabas/VIBE",
    compatibility: {
      summary: "Research reference for video-based 3D human motion recovery (SMPL body mesh + motion from monocular video, HMR-class); the WHAM code repositories were not found at research time (the code was never released at the probed paths), so the video-3D-motion class is registered by its real, verifiable representatives (this entry and GVHMR). Archived/stale (last commit 2022) and non-commercial licensed.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/mkocabas/VIBE/blob/master/LICENSE",
        "https://github.com/mkocabas/VIBE/commits/master",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "WHAM code not found at research time (facebookresearch/wham, zju3dv/wham 404; project pages defer code release); no claim is made about WHAM",
        "pretrained-checkpoint availability after repo archival not verified during research",
      ],
    },
    editorCapable: false,
  },
];
