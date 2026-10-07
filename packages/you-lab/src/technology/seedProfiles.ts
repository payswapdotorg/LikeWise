// Seed profiles for the W1C technology registry.
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W1C research seeding on 2026-10-08
// (GitHub raw LICENSE files, GitHub releases atom feeds, npm registry, PyPI,
// blender.org). The fetched evidence is preserved in the sandbox research
// logs. License/maintenance claims are static data by ship time. Capability
// tags and compatibility summaries are YOU-lab engineering assessments (not
// external claims) — see provenance.claimBasis on each profile.
import type { TechnologyProfile } from "./registry.js";

import { createRegistry, type TechnologyRegistry } from "./registry.js";

const RESEARCH_DATE = "2026-10-08";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W1C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "blender",
    name: "Blender",
    kind: "editor",
    capabilityTags: ["3d-modeling", "sculpting", "rigging", "animation", "mesh-edit", "gltf", "3d-render", "scene-graph"],
    license: {
      spdxId: "GPL-2.0-or-later",
      name: "GNU General Public License (blender.org: source 'default being licensed as GNU GPL Version 2 or later')",
      sourceUrl: "https://www.blender.org/about/license/",
      verified: true,
      note: "In-repo COPYING points to doc/license/GPL-license.txt (GPLv2 text). blender.org states some modules use more permissive licenses (e.g. Cycles under Apache 2.0).",
    },
    maintenance: [
      { kind: "github-release", signal: "v5.2.2", date: "2026-09-14", sourceUrl: "https://github.com/blender/blender/releases", verified: true },
    ],
    repoUrl: "https://github.com/blender/blender",
    compatibility: {
      summary: "External desktop 3D application (Tier 3); deep geometry/rig/animation editing; glTF/USD interchange.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://www.blender.org/about/license/",
        "https://github.com/blender/blender/blob/main/COPYING",
        "https://github.com/blender/blender/blob/main/doc/license/GPL-license.txt",
        "https://github.com/blender/blender/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "exact per-file license boundaries (GPL vs permissive modules such as Cycles/Apache-2.0) require per-module review at adoption time",
        "VRM export from Blender requires a community add-on (not verified during research)",
      ],
    },
    editorCapable: true,
  },
  {
    id: "excalidraw",
    name: "Excalidraw",
    kind: "editor",
    capabilityTags: ["diagram", "annotation", "canvas-2d", "hand-drawn", "svg"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://github.com/excalidraw/excalidraw/blob/master/LICENSE",
      verified: true,
      note: "Copyright (c) 2020 Excalidraw, per the repo LICENSE file.",
    },
    maintenance: [
      { kind: "npm-publish", signal: "@excalidraw/excalidraw@0.18.1", date: "2026-04-20", sourceUrl: "https://registry.npmjs.org/@excalidraw/excalidraw", verified: true },
      { kind: "github-release", signal: "v0.18.1", date: "2026-04-20", sourceUrl: "https://github.com/excalidraw/excalidraw/releases", verified: true },
    ],
    repoUrl: "https://github.com/excalidraw/excalidraw",
    compatibility: {
      summary: "Browser canvas editor (Tier 2 embedded candidate) for diagrams/annotations; Excalidraw JSON plus SVG/PNG export.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/excalidraw/excalidraw/blob/master/LICENSE",
        "https://registry.npmjs.org/@excalidraw/excalidraw",
        "https://github.com/excalidraw/excalidraw/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: true,
  },
  {
    id: "gltf-transform",
    name: "glTF-Transform",
    kind: "library",
    capabilityTags: ["gltf-processing", "asset-optimization", "format-conversion", "gltf"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://github.com/donmccurdy/glTF-Transform/blob/main/LICENSE.md",
      verified: true,
      note: "Copyright (c) 2024 Don McCurdy, per the repo LICENSE.md file.",
    },
    maintenance: [
      { kind: "npm-publish", signal: "@gltf-transform/core@4.5.1", date: "2026-09-28", sourceUrl: "https://registry.npmjs.org/@gltf-transform/core", verified: true },
      { kind: "github-release", signal: "v4.5.1", date: "2026-09-28", sourceUrl: "https://github.com/donmccurdy/glTF-Transform/releases", verified: true },
    ],
    repoUrl: "https://github.com/donmccurdy/glTF-Transform",
    compatibility: {
      summary: "Node.js library/CLI for glTF/GLB processing; fits Tier 4 export/import pipeline steps.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/donmccurdy/glTF-Transform/blob/main/LICENSE.md",
        "https://registry.npmjs.org/@gltf-transform/core",
        "https://github.com/donmccurdy/glTF-Transform/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: false,
  },
  {
    id: "openreel",
    name: "OpenReel",
    kind: "editor",
    capabilityTags: ["video-editing", "timeline", "browser-editor", "mp4", "webm"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://github.com/Augani/openreel-video/blob/main/LICENSE",
      verified: true,
      note: "Copyright (c) 2024-2026 Augustus Otu and Contributors, per the repo LICENSE file.",
    },
    maintenance: [
      { kind: "github-release", signal: "OpenReel Desktop v1.0.0-alpha.17", date: "2026-08-29", sourceUrl: "https://github.com/Augani/openreel-video/releases", verified: true },
    ],
    repoUrl: "https://github.com/Augani/openreel-video",
    compatibility: {
      summary: "Browser/desktop video editor (Tier 2 candidate per docs/you/EDITING_INTERCHANGE.md); early alpha maturity.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/Augani/openreel-video/blob/main/LICENSE",
        "https://github.com/Augani/openreel-video/releases",
        "https://registry.npmjs.org/-/v1/search?text=openreel",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "no first-party npm package found at research time (npm search) — distribution beyond GitHub releases unverified",
        "project is pre-1.0 (v1.0.0-alpha.17) — long-term maintenance cadence unverified",
      ],
    },
    editorCapable: true,
  },
  {
    id: "opentimelineio",
    name: "OpenTimelineIO",
    kind: "format",
    capabilityTags: ["editorial-timeline", "timeline-interchange", "otio"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/LICENSE.txt",
      verified: true,
      note: "LICENSE.txt at repo main is the standard Apache-2.0 text (verified by reading the file).",
    },
    maintenance: [
      { kind: "pypi-upload", signal: "OpenTimelineIO 0.18.1", date: "2025-11-09", sourceUrl: "https://pypi.org/pypi/OpenTimelineIO/json", verified: true },
      { kind: "github-release", signal: "Beta 18.1 - Python Wheel Fixes", date: "2025-11-08", sourceUrl: "https://github.com/AcademySoftwareFoundation/OpenTimelineIO/releases", verified: true },
    ],
    repoUrl: "https://github.com/AcademySoftwareFoundation/OpenTimelineIO",
    compatibility: {
      summary: "Editorial timeline interchange format (Python/C++ SDK); Tier 4 interchange path for video editorial.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/LICENSE.txt",
        "https://pypi.org/pypi/OpenTimelineIO/json",
        "https://github.com/AcademySoftwareFoundation/OpenTimelineIO/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: ["release train is labeled Beta (0.18.x) — stability characterization beyond fetched signals unverified"],
    },
    editorCapable: false,
  },
  {
    id: "openusd",
    name: "OpenUSD",
    kind: "format",
    capabilityTags: ["usd", "scene-interchange", "layered-composition"],
    license: {
      spdxId: null,
      name: "TOMORROW OPEN SOURCE TECHNOLOGY LICENSE 1.0",
      sourceUrl: "https://github.com/PixarAnimationStudios/OpenUSD/blob/master/LICENSE.txt",
      verified: true,
      note: "Custom non-SPDX license; per its preamble it differs from Apache License 2.0 in Section 6 (Trademarks). Legal review required before production adoption.",
    },
    maintenance: [
      { kind: "github-release", signal: "v26.11-alpha", date: "2026-10-05", sourceUrl: "https://github.com/PixarAnimationStudios/OpenUSD/releases", verified: true },
    ],
    repoUrl: "https://github.com/PixarAnimationStudios/OpenUSD",
    compatibility: {
      summary: "High-end layered scene interchange; Tier 4 interchange path where justified (docs/you/EDITING_INTERCHANGE.md).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/PixarAnimationStudios/OpenUSD/blob/master/LICENSE.txt",
        "https://github.com/PixarAnimationStudios/OpenUSD/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "custom license terms beyond the fetched preamble (full clause review pending)",
        "v26.11-alpha is a pre-release tag",
      ],
    },
    editorCapable: false,
  },
  {
    id: "react-three-fiber",
    name: "React Three Fiber",
    kind: "library",
    capabilityTags: ["3d-render", "react-integration", "declarative-scene", "gltf"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE",
      verified: true,
      note: "Copyright (c) 2019-2025 Poimandres, per the repo LICENSE file.",
    },
    maintenance: [
      { kind: "npm-publish", signal: "@react-three/fiber@9.8.1", date: "2026-09-24", sourceUrl: "https://registry.npmjs.org/@react-three/fiber", verified: true },
      { kind: "github-release", signal: "v9.8.1", date: "2026-09-24", sourceUrl: "https://github.com/pmndrs/react-three-fiber/releases", verified: true },
    ],
    repoUrl: "https://github.com/pmndrs/react-three-fiber",
    compatibility: {
      summary: "Tier 1 native declarative React scene graph over three.js; matches the ZCode React stack.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE",
        "https://registry.npmjs.org/@react-three/fiber",
        "https://github.com/pmndrs/react-three-fiber/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: true,
  },
  {
    id: "svg-edit",
    name: "SVG-Edit",
    kind: "editor",
    capabilityTags: ["svg-edit", "vector-2d", "browser-editor", "annotation", "svg"],
    license: {
      spdxId: "(MIT AND Apache-2.0 AND ISC AND LGPL-3.0-or-later AND X11)",
      name: "Aggregate: MIT core plus bundled components (MIT/Apache-2.0/ISC/LGPL-3.0-or-later/X11)",
      sourceUrl: "https://registry.npmjs.org/svgedit",
      verified: true,
      note: "Core MIT per package LICENSE-MIT.txt (SVG-edit authors); npm license field declares the aggregate; licenseInfo.json maps per-file licenses (LGPL-3.0-or-later jsPDF plugin, X11 jsPDF, Apache-2.0 extensions). Per-file review required at adoption.",
    },
    maintenance: [
      { kind: "npm-publish", signal: "svgedit@7.4.2", date: "2026-07-11", sourceUrl: "https://registry.npmjs.org/svgedit", verified: true },
      { kind: "github-release", signal: "v7.4.2", date: "2026-07-11", sourceUrl: "https://github.com/SVG-Edit/svgedit/releases", verified: true },
    ],
    repoUrl: "https://github.com/SVG-Edit/svgedit",
    compatibility: {
      summary: "Browser SVG editor (Tier 2 embedded candidate); 2D vector editing only — 3D canonical state needs projected interchange.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://registry.npmjs.org/svgedit",
        "https://registry.npmjs.org/svgedit/-/svgedit-7.4.2.tgz",
        "https://github.com/SVG-Edit/svgedit/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "repo-level LICENSE file not found at standard paths during research; license basis is the published npm package contents",
      ],
    },
    editorCapable: true,
  },
  {
    id: "three-js",
    name: "Three.js",
    kind: "library",
    capabilityTags: ["3d-render", "scene-graph", "gltf", "webgl", "viewport"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://github.com/mrdoob/three.js/blob/master/LICENSE",
      verified: true,
      note: "Copyright (c) 2010-2026 three.js authors, per the repo LICENSE file.",
    },
    maintenance: [
      { kind: "npm-publish", signal: "three@0.186.1", date: "2026-09-24", sourceUrl: "https://registry.npmjs.org/three", verified: true },
      { kind: "github-release", signal: "r186", date: "2026-09-24", sourceUrl: "https://github.com/mrdoob/three.js/releases", verified: true },
    ],
    repoUrl: "https://github.com/mrdoob/three.js",
    compatibility: {
      summary: "Tier 1 native rendering runtime per docs/you/EDITING_INTERCHANGE.md; WebGL-oriented; glTF loading.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/mrdoob/three.js/blob/master/LICENSE",
        "https://registry.npmjs.org/three",
        "https://github.com/mrdoob/three.js/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [],
    },
    editorCapable: true,
  },
  {
    id: "three-vrm",
    name: "three-vrm",
    kind: "library",
    capabilityTags: ["vrm-avatar", "humanoid-rig", "expression", "avatar-animation", "vrm", "gltf"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://github.com/pixiv/three-vrm/blob/master/LICENSE",
      verified: true,
      note: "Copyright (c) 2019-2026 pixiv Inc., per the repo LICENSE file.",
    },
    maintenance: [
      { kind: "npm-publish", signal: "@pixiv/three-vrm@3.5.5 (latest stable)", date: "2026-07-09", sourceUrl: "https://registry.npmjs.org/@pixiv/three-vrm", verified: true },
      { kind: "github-release", signal: "v3.6.0-beta.0 (prerelease)", date: "2026-09-25", sourceUrl: "https://github.com/pixiv/three-vrm/releases", verified: true },
    ],
    repoUrl: "https://github.com/pixiv/three-vrm",
    compatibility: {
      summary: "VRM avatar runtime on top of three.js; humanoid rig, expressions and animation playback.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://github.com/pixiv/three-vrm/blob/master/LICENSE",
        "https://registry.npmjs.org/@pixiv/three-vrm",
        "https://github.com/pixiv/three-vrm/releases",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: ["v3.6.0-beta.0 is a prerelease tag, not a stable release"],
    },
    editorCapable: false,
  },
];

/** Default registry seeded with the W1C researched candidate set. */
export function createDefaultRegistry(): TechnologyRegistry {
  return createRegistry(SEED_PROFILES);
}
