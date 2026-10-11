// Reconstruction technology seed profiles (W3C) — explicit-geometry family.
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W3C research seeding on 2026-10-11
// (GitHub raw LICENSE files, GitHub commits/releases/tags atom feeds, PyPI
// JSON API). The fetched evidence is preserved in the sandbox research logs.
// License/maintenance claims are static data by ship time. Capability tags and
// compatibility summaries are YOU-lab engineering assessments (not external
// claims) — see provenance.claimBasis on each profile. Unverifiable aspects
// stay listed in provenance.unverifiedClaims (truth law — never invent).
import { createRegistry, type TechnologyRegistry } from "./registry.js";
import type { TechnologyProfile } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { CAPTURE_SEED_PROFILES } from "./captureSeedProfiles.js";
import { NEURAL_RECONSTRUCTION_SEED_PROFILES } from "./reconstructionNeuralSeedProfiles.js";

const RESEARCH_DATE = "2026-10-11";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W3C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const GEOMETRY_RECONSTRUCTION_SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "colmap",
    name: "COLMAP (SfM/MVS photogrammetry)",
    kind: "library",
    capabilityTags: ["multi-view-reconstruction", "structure-from-motion", "mesh-reconstruction", "server-inference", "texture-mapping"],
    license: {
      spdxId: "BSD-3-Clause",
      name: "BSD 3-Clause 'New'/'Modified' License (COLMAP)",
      sourceUrl: "https://github.com/colmap/colmap/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at repo main is the new BSD text for 'The COLMAP library' (Copyright ETH Zurich and UNC Chapel Hill; 2016-2026 The COLMAP Contributors). The file itself warns that building with separately-licensed dependencies may affect the resulting license — dependency selection stays a build-time legal check.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to colmap main (Preserve quadratic roots across coefficient scales #4838)", date: "2026-10-11", sourceUrl: "https://github.com/colmap/colmap/commits/main", verified: true },
      { kind: "github-release", signal: "4.2.1", date: "2026-09-29", sourceUrl: "https://github.com/colmap/colmap/releases", verified: true },
    ],
    repoUrl: "https://github.com/colmap/colmap",
    compatibility: {
      summary: "C++ SfM/MVS photogrammetry suite (GUI + CLI + pycolmap bindings) producing cameras, sparse/dense point clouds and textured meshes from unordered image collections; CPU or CUDA; the classic explicit-geometry reconstruction path. Permissive BSD-3-Clause plus very active maintenance make it the strongest production-eligible reconstruction candidate at research time.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/colmap/colmap/blob/main/LICENSE",
        "https://github.com/colmap/colmap/commits/main",
        "https://github.com/colmap/colmap/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "per-build effective license when linking optional separately-licensed dependencies (the LICENSE text itself flags this) not audited during research",
        "pycolmap package-channel licensing/maintenance not fetched during research (repo-level facts verified)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "openmvs",
    name: "OpenMVS (multi-view stereo)",
    kind: "library",
    capabilityTags: ["multi-view-reconstruction", "mesh-reconstruction", "texture-mapping", "server-inference"],
    license: {
      spdxId: "AGPL-3.0-or-later",
      name: "GNU Affero General Public License v3.0 or later",
      sourceUrl: "https://github.com/cdcseacave/openMVS/blob/develop/LICENSE",
      verified: true,
      note: "LICENSE at repo develop is the standard GNU AGPL v3 text; the grant clause reads 'either version 3 of the License, or (at your option) any later version'. AGPL carries source-disclosure obligations for network use — production adoption requires legal review.",
    },
    maintenance: [
      { kind: "github-commit", signal: "last commit to openMVS develop (viewer: point-cloud confidence filter)", date: "2026-10-01", sourceUrl: "https://github.com/cdcseacave/openMVS/commits/develop", verified: true },
      { kind: "github-release", signal: "RoMa v2 ONNX model (base, fp32)", date: "2026-09-09", sourceUrl: "https://github.com/cdcseacave/openMVS/releases", verified: true },
    ],
    repoUrl: "https://github.com/cdcseacave/openMVS",
    compatibility: {
      summary: "C++ multi-view stereo complement to SfM front-ends (dense reconstruction, mesh refinement, texturing); active development at research time. AGPL-3.0-or-later licensing is a deployment constraint for closed-source products.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/cdcseacave/openMVS/blob/develop/LICENSE",
        "https://github.com/cdcseacave/openMVS/commits/develop",
        "https://github.com/cdcseacave/openMVS/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "'or later' reading is from the standard AGPL appendix clause in the fetched text — not a legal determination",
        "third-party dependency licenses inside the build not audited during research",
      ],
    },
    editorCapable: false,
  },
  {
    id: "open3d",
    name: "Open3D (3D data processing / depth pipelines)",
    kind: "library",
    capabilityTags: ["depth-processing", "tsdf-reconstruction", "point-cloud-processing", "mesh-processing", "server-inference"],
    license: {
      spdxId: "MIT",
      name: "MIT License (Open3D)",
      sourceUrl: "https://github.com/isl-org/Open3D/blob/main/LICENSE",
      verified: true,
      note: "LICENSE at repo main is the MIT text ('The MIT License (MIT) Open3D: www.open3d.org'); PyPI metadata for open3d also declares MIT.",
    },
    maintenance: [
      { kind: "github-release", signal: "v0.20 release", date: "2026-09-29", sourceUrl: "https://github.com/isl-org/Open3D/releases", verified: true },
      { kind: "github-commit", signal: "last commit to Open3D main (Fix release packaging and CI uploads for v0.20 release #7563)", date: "2026-09-16", sourceUrl: "https://github.com/isl-org/Open3D/commits/main", verified: true },
      { kind: "pypi-upload", signal: "open3d@0.20.0", date: "2026-09-16", sourceUrl: "https://pypi.org/pypi/open3d/json", verified: true },
    ],
    repoUrl: "https://github.com/isl-org/Open3D",
    compatibility: {
      summary: "C++/Python library for 3D data processing: RGB-D/depth-sensor pipelines, TSDF fusion, point-cloud registration and mesh utilities, with visualizer; MIT-licensed and actively maintained — the depth-sensor-pipeline candidate.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/isl-org/Open3D/blob/main/LICENSE",
        "https://github.com/isl-org/Open3D/releases",
        "https://github.com/isl-org/Open3D/commits/main",
        "https://pypi.org/pypi/open3d/json",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "per-platform sensor-driver coverage (RealSense/Kinect/Primesense backends) not exhaustively verified during research",
        "optional CUDA-module build implications not audited during research",
      ],
    },
    editorCapable: false,
  },
];

/** Registry with the W3C reconstruction additions applied over W1C+W2C. */
export function createReconstructionRegistry(): TechnologyRegistry {
  return createRegistry([
    ...SEED_PROFILES,
    ...CAPTURE_SEED_PROFILES,
    ...GEOMETRY_RECONSTRUCTION_SEED_PROFILES,
    ...NEURAL_RECONSTRUCTION_SEED_PROFILES,
  ]);
}
