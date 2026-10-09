// Capture technology seed profiles (W2C).
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W2C research seeding on 2026-10-09
// (GitHub raw LICENSE files, GitHub releases/tags/commits atom feeds, npm
// registry, PyPI JSON API, GitHub repo API). The fetched evidence is
// preserved in the sandbox research logs. License/maintenance claims are
// static data by ship time. Capability tags and compatibility summaries are
// YOU-lab engineering assessments (not external claims) — see
// provenance.claimBasis on each profile. Unverifiable aspects stay listed in
// provenance.unverifiedClaims (truth law — never invent).
import type { TechnologyProfile } from "./registry.js";

import { createRegistry, type TechnologyRegistry } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";

const RESEARCH_DATE = "2026-10-09";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W2C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const CAPTURE_SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "depth-anything",
    name: "Depth-Anything (monocular depth)",
    kind: "library",
    capabilityTags: ["depth-estimation", "video-processing", "server-inference", "monocular-depth"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://github.com/DepthAnything/Depth-Anything-V2/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at Depth-Anything-V2 main is the standard Apache-2.0 text (verified by reading the file); the GitHub repo API license field also reports Apache-2.0. The V1 repo (DepthAnything/Depth-Anything) carries no LICENSE file at main (404 during research) — see unverifiedClaims.",
    },
    maintenance: [
      {
        kind: "github-commit",
        signal: "last commit to Depth-Anything-V2 main (Merge PR #319)",
        date: "2026-03-24",
        sourceUrl: "https://github.com/DepthAnything/Depth-Anything-V2/commits/main",
        verified: true,
      },
    ],
    repoUrl: "https://github.com/DepthAnything/Depth-Anything-V2",
    compatibility: {
      summary: "Python/PyTorch monocular relative-depth estimation; GPU-class local/server inference; no official npm/PyPI package found at research time (repo/pip-from-source distribution).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/DepthAnything/Depth-Anything-V2/blob/main/LICENSE",
        "https://github.com/DepthAnything/Depth-Anything-V2/commits/main",
        "https://api.github.com/repos/DepthAnything/Depth-Anything-V2",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "V1 repo (DepthAnything/Depth-Anything) has no LICENSE file at main (404 during research) — V1 licensing terms remain unverified",
        "checkpoint redistribution terms (model weight files) not fetched during research",
        "no formal GitHub releases/tags for the V2 repo at research time — version pinning relies on commits",
      ],
    },
    editorCapable: false,
  },
  {
    id: "mediapipe",
    name: "MediaPipe (Holistic / Landmarker tasks)",
    kind: "library",
    capabilityTags: ["pose-estimation", "face-landmarks", "hand-landmarks", "person-segmentation", "browser-inference", "video-processing", "server-inference"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE",
      verified: true,
      note: "LICENSE at repo master is the standard Apache-2.0 text (verified by reading the file); PyPI metadata for mediapipe also declares Apache 2.0.",
    },
    maintenance: [
      { kind: "github-release", signal: "v1.1.0", date: "2026-10-07", sourceUrl: "https://github.com/google-ai-edge/mediapipe/releases", verified: true },
      { kind: "pypi-upload", signal: "mediapipe@1.1.0", date: "2026-10-06", sourceUrl: "https://pypi.org/pypi/mediapipe/json", verified: true },
      { kind: "npm-publish", signal: "@mediapipe/tasks-vision@1.1.0", date: "2026-10-06", sourceUrl: "https://registry.npmjs.org/@mediapipe%2Ftasks-vision", verified: true },
      { kind: "npm-publish", signal: "@mediapipe/holistic@0.5.1675471629 (legacy solution package, frozen)", date: "2023-02-04", sourceUrl: "https://registry.npmjs.org/@mediapipe%2Fholistic", verified: true },
    ],
    repoUrl: "https://github.com/google-ai-edge/mediapipe",
    compatibility: {
      summary: "Cross-platform (browser WASM/GPU, Python, C++) landmark/segmentation graph framework. The legacy Holistic solution npm package has been frozen since 2023-02; the current path is the Tasks API (Pose/Face/Holistic Landmarker, ImageSegmenter) in @mediapipe/tasks-vision.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE",
        "https://github.com/google-ai-edge/mediapipe/releases",
        "https://pypi.org/pypi/mediapipe/json",
        "https://registry.npmjs.org/@mediapipe%2Ftasks-vision",
        "https://registry.npmjs.org/@mediapipe%2Fholistic",
        "https://github.com/google-ai-edge/mediapipe/blob/master/README.md",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "legacy-solutions deprecation is documented on developers.google.com/mediapipe (repo README forwards there since 2023-04) — the docs page itself was not fetched during research",
        "model-weight redistribution terms per task package not verified during research",
      ],
    },
    editorCapable: false,
  },
  {
    id: "mmpose",
    name: "MMPose (OpenMMLab pose toolbox)",
    kind: "library",
    capabilityTags: ["pose-estimation", "face-landmarks", "hand-landmarks", "server-inference", "video-processing", "whole-body-pose"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0 (with Open-MMLab copyright header)",
      sourceUrl: "https://github.com/open-mmlab/mmpose/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at repo main is the Apache-2.0 text under a 'Copyright 2018-2020 Open-MMLab. All rights reserved.' header (verified by reading the file, and at tag v0.29.0 as well); PyPI metadata for mmpose also declares Apache License 2.0.",
    },
    maintenance: [
      { kind: "github-release", signal: "MMPose v1.3.2 Release Note", date: "2024-07-12", sourceUrl: "https://github.com/open-mmlab/mmpose/releases", verified: true },
      { kind: "pypi-upload", signal: "mmpose@1.3.2", date: "2024-07-12", sourceUrl: "https://pypi.org/pypi/mmpose/json", verified: true },
    ],
    repoUrl: "https://github.com/open-mmlab/mmpose",
    compatibility: {
      summary: "Python/PyTorch pose estimation toolbox (2D/3D, body/face/hand/whole-body) with many model backends; server/local-GPU class inference. Release cadence slowed since 2024-07 at research time.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/open-mmlab/mmpose/blob/main/LICENSE",
        "https://github.com/open-mmlab/mmpose/releases",
        "https://pypi.org/pypi/mmpose/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "current default model-zoo contents and backend model licenses beyond the repo-level license not verified during research",
        "license history between the two checked refs (v0.29.0 tag and main) not exhaustively verified",
      ],
    },
    editorCapable: false,
  },
  {
    id: "openpose",
    name: "OpenPose (CMU Perceptual Computing Lab)",
    kind: "library",
    capabilityTags: ["pose-estimation", "face-landmarks", "hand-landmarks", "server-inference", "multi-person-pose"],
    license: {
      spdxId: null,
      name: "CMU OpenPose Academic/Non-Profit Noncommercial Research Use License",
      sourceUrl: "https://github.com/CMU-Perceptual-Computing-Lab/openpose/blob/master/LICENSE",
      verified: true,
      note: "Custom, non-SPDX license: personal non-exclusive non-transferable license for NONCOMMERCIAL research purposes only; commercial use requires a separate license from Carnegie Mellon University. Not OSI-approved; production use blocked without licensing review.",
    },
    maintenance: [
      { kind: "github-release", signal: "OpenPose v1.7.0", date: "2020-11-18", sourceUrl: "https://github.com/CMU-Perceptual-Computing-Lab/openpose/releases", verified: true },
      { kind: "github-commit", signal: "last commit to master ('Models working again')", date: "2024-08-03", sourceUrl: "https://github.com/CMU-Perceptual-Computing-Lab/openpose/commits/master", verified: true },
    ],
    repoUrl: "https://github.com/CMU-Perceptual-Computing-Lab/openpose",
    compatibility: {
      summary: "C++/CUDA multi-person keypoint detection (body/face/hands) with Windows portable demo; research-grade build; release train effectively frozen since 2020 (last release v1.7.0).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/CMU-Perceptual-Computing-Lab/openpose/blob/master/LICENSE",
        "https://github.com/CMU-Perceptual-Computing-Lab/openpose/releases",
        "https://github.com/CMU-Perceptual-Computing-Lab/openpose/commits/master",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "availability/terms of the hosted pretrained models (downloaded separately from GitHub releases/site) not verified during research",
        "commercial licensing terms from CMU not fetched during research",
      ],
    },
    editorCapable: false,
  },
  {
    id: "segment-anything",
    name: "Segment Anything (SAM / SAM 2)",
    kind: "library",
    capabilityTags: ["person-segmentation", "object-segmentation", "promptable-segmentation", "video-processing", "server-inference"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0 (model, checkpoints and code)",
      sourceUrl: "https://github.com/facebookresearch/segment-anything/blob/main/LICENSE",
      verified: true,
      note: "SAM repo LICENSE is the standard Apache-2.0 text and its README states 'The model is licensed under the Apache 2.0 license'; the SAM 2 repo README states 'The SAM 2 model checkpoints, SAM 2 demo code ... and SAM 2 training code are licensed under Apache 2.0' (demo fonts are SIL OFL 1.1 — irrelevant to inference use).",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to segment-anything main", date: "2024-09-18", sourceUrl: "https://github.com/facebookresearch/segment-anything/commits/main", verified: true },
      { kind: "github-commit", signal: "last commit to sam2 main", date: "2024-12-16", sourceUrl: "https://github.com/facebookresearch/sam2/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/facebookresearch/segment-anything",
    compatibility: {
      summary: "Python/PyTorch promptable image segmentation (SAM) + video segmentation (SAM 2); GPU-class local/server inference. No formal releases/tags for either repo at research time; both trains frozen (last commits 2024).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/facebookresearch/segment-anything/blob/main/LICENSE",
        "https://github.com/facebookresearch/segment-anything/blob/main/README.md",
        "https://github.com/facebookresearch/segment-anything/commits/main",
        "https://github.com/facebookresearch/sam2/blob/main/LICENSE",
        "https://github.com/facebookresearch/sam2/blob/main/README.md",
        "https://github.com/facebookresearch/sam2/commits/main",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "no formal GitHub releases or tags for either repo at research time — pinning relies on commits",
        "SA-1B dataset license (separate research license referenced in the SAM README) not fetched — dataset use is out of scope for inference adapters",
        "no official npm/PyPI package found at research time (repo/pip-from-source distribution); third-party 'segment-anything' entries on npm/PyPI carry no attributable owner and were NOT counted as maintenance evidence",
      ],
    },
    editorCapable: false,
  },
  {
    id: "smplx",
    name: "SMPL-X (SMPL/X body model family)",
    kind: "library",
    capabilityTags: ["body-mesh-reconstruction", "humanoid-rig", "shape-space", "avatar-animation"],
    license: {
      spdxId: null,
      name: "Software Copyright License for non-commercial scientific research purposes (SMPL-X/SMPLify-X Model & Software)",
      sourceUrl: "https://github.com/vchoutas/smplx/blob/master/LICENSE",
      verified: true,
      note: "Custom, non-SPDX research-only license. The repo README states the terms cover the Model & Software (meshes, blend weights, blend shapes, textures, code) together; model files additionally require registration to download. Non-commercial research use only — production use blocked without a separate commercial license.",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "smplx@0.1.28", date: "2021-05-26", sourceUrl: "https://pypi.org/pypi/smplx/json", verified: true },
      { kind: "github-commit", signal: "last commit to smplx main", date: "2023-10-12", sourceUrl: "https://github.com/vchoutas/smplx/commits/main", verified: true },
    ],
    repoUrl: "https://github.com/vchoutas/smplx",
    compatibility: {
      summary: "Python/PyTorch parametric body model family (SMPL, SMPL+H, SMPL-X) with shape/pose blend spaces; the de-facto research standard for body-mesh reconstruction output spaces. Registration-gated model files; effectively frozen codebase (last PyPI upload 2021).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/vchoutas/smplx/blob/master/LICENSE",
        "https://github.com/vchoutas/smplx/blob/master/README.md",
        "https://pypi.org/pypi/smplx/json",
        "https://github.com/vchoutas/smplx/commits/main",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "SMPL (v1) / SMPL+H website license terms (smpl.is.tue.mpg.de) not fetched during research",
        "commercial licensing channel (Meshcapade) referenced by ecosystem docs — terms not fetched and attribution not verified",
        "PyPI smplx (author Vassilis Choutas, homepage smpl-x.is.tue.mpg.de) matches the repo owner — treated as the canonical package, but the packaging license field is empty; the research-only repo LICENSE governs",
      ],
    },
    editorCapable: false,
  },
  {
    id: "tfjs-pose",
    name: "TensorFlow.js pose-detection (MoveNet / BlazePose)",
    kind: "library",
    capabilityTags: ["pose-estimation", "browser-inference", "video-processing"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://github.com/tensorflow/tfjs-models/blob/master/LICENSE",
      verified: true,
      note: "LICENSE at tfjs-models master is the standard Apache-2.0 text (verified by reading the file); the published @tensorflow-models/pose-detection package also declares Apache-2.0.",
    },
    maintenance: [
      { kind: "npm-publish", signal: "@tensorflow-models/pose-detection@2.1.3", date: "2023-08-29", sourceUrl: "https://registry.npmjs.org/@tensorflow-models%2Fpose-detection", verified: true },
      { kind: "github-release", signal: "pose-detection-v2.1.3", date: "2023-08-29", sourceUrl: "https://github.com/tensorflow/tfjs-models/releases", verified: true },
      { kind: "npm-publish", signal: "@tensorflow/tfjs@4.22.0 (runtime dependency)", date: "2024-10-21", sourceUrl: "https://registry.npmjs.org/@tensorflow%2Ftfjs", verified: true },
    ],
    repoUrl: "https://github.com/tensorflow/tfjs-models",
    compatibility: {
      summary: "Browser JS pose models on the TF.js runtime (WASM/WebGL/WebGPU): MoveNet (17 keypoints, single-pose, high fps) and MediaPipe BlazePose (33 keypoints incl. face/hands/feet; per package README). Package dormant since 2023-08 at research time.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/tensorflow/tfjs-models/blob/master/LICENSE",
        "https://registry.npmjs.org/@tensorflow-models%2Fpose-detection",
        "https://github.com/tensorflow/tfjs-models/releases",
        "https://raw.githubusercontent.com/tensorflow/tfjs-models/master/pose-detection/README.md",
        "https://registry.npmjs.org/@tensorflow%2Ftfjs",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "model-weight hosting terms on TF Hub/Kaggle model cards not verified during research (repo and package licenses verified)",
        "package dormant since the 2023-08-29 publish — continued maintenance unverified",
      ],
    },
    editorCapable: false,
  },
  {
    id: "yolo-seg",
    name: "Ultralytics YOLO (instance-segmentation family)",
    kind: "library",
    capabilityTags: ["person-segmentation", "object-segmentation", "server-inference", "video-processing"],
    license: {
      spdxId: "AGPL-3.0-only",
      name: "GNU Affero General Public License v3.0",
      sourceUrl: "https://github.com/ultralytics/ultralytics/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at repo main is the full AGPL-3.0 text with no or-later suffix (treated as AGPL-3.0-only); PyPI metadata for ultralytics declares AGPL-3.0. Ultralytics offers commercial licensing separately. AGPL carries source-disclosure obligations for network use — production adoption requires legal review.",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "ultralytics@8.4.174", date: "2026-10-06", sourceUrl: "https://pypi.org/pypi/ultralytics/json", verified: true },
      { kind: "github-release", signal: "v8.4.174", date: "2026-10-06", sourceUrl: "https://github.com/ultralytics/ultralytics/releases", verified: true },
    ],
    repoUrl: "https://github.com/ultralytics/ultralytics",
    compatibility: {
      summary: "Python/PyTorch detection + instance-segmentation family (person/object masks), very high release cadence; local-GPU/server class inference. AGPL-3.0 licensing is a deployment constraint.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/ultralytics/ultralytics/blob/main/LICENSE",
        "https://pypi.org/pypi/ultralytics/json",
        "https://github.com/ultralytics/ultralytics/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "'only' vs 'or-later' reading inferred from the LICENSE text carrying no or-later suffix — not a legal determination",
        "Ultralytics commercial licensing terms not fetched during research",
      ],
    },
    editorCapable: false,
  },
];

/** Registry with the W2C capture additions applied over the W1C seed set. */
export function createCaptureRegistry(): TechnologyRegistry {
  return createRegistry([...SEED_PROFILES, ...CAPTURE_SEED_PROFILES]);
}
