// Editor technology seed profiles (W5C) — the W5C editor-ecosystem registry
// additions: native editors (VS Code-class), embedded hosts (Monaco-class,
// CodeMirror-class, ProseMirror-class), external pipelines (Godot-class scene
// editing, GIMP/Krita image editors, Kdenlive video editor) and the glTF
// interchange format.
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W5C research seeding on 2026-10-11
// (GitHub raw LICENSE files, GitHub releases atom feeds, unpkg package files,
// the npm registry JSON API, GitLab GNOME raw files and release feeds). The
// fetched evidence is preserved in the sandbox research logs. License and
// maintenance claims are static data by ship time. Capability tags and
// compatibility summaries are YOU-lab engineering assessments (not external
// claims) — see provenance.claimBasis on each profile. Aspects that could not
// be verified stay listed in provenance.unverifiedClaims (truth law — never
// invent, never present an unverified claim as verified).
//
// PROFILE REUSE (the W3C smplx / W4C blender precedents): the W1C registry
// already covers part of the W5C candidate classes — blender (external DCC
// editing), excalidraw / svg-edit / openreel (embedded 2D/video), three-js /
// react-three-fiber (Tier 1 native), openusd (USD-class interchange),
// gltf-transform (glTF-class toolchain) and opentimelineio (editorial
// timeline interchange). Those profiles are REUSED, not duplicated; the W5C
// additions below are the nine editor technologies not yet registered
// anywhere. All W5C editor-capable ids resolve through createEditorRegistry()
// (see editing/capabilityProfiles.ts and editing/editorEvaluation.ts).

import { createRegistry, type TechnologyRegistry } from "./registry.js";
import type { TechnologyProfile } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";

const RESEARCH_DATE = "2026-10-11";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W5C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const EDITOR_SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "codemirror",
    name: "CodeMirror 6",
    kind: "library",
    capabilityTags: ["code-editing", "embedded-editor", "browser-editor", "text-editing", "json"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/codemirror/dev/main/LICENSE",
      verified: true,
      note: "Copyright (C) 2018 by Marijn Haverbeke, per the codemirror/dev repository LICENSE file (main branch).",
    },
    maintenance: [
      { kind: "npm-publish", signal: "@codemirror/state@6.7.6", date: "2026-09-22", sourceUrl: "https://registry.npmjs.org/@codemirror/state", verified: true },
    ],
    repoUrl: "https://github.com/codemirror/dev",
    compatibility: {
      summary: "CodeMirror-class embedded editor toolkit (CodeMirror 6): modular browser text editing; hosts compose the @codemirror/* packages (W5C embedded class).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/codemirror/dev/main/LICENSE",
        "https://registry.npmjs.org/@codemirror/state",
        "https://github.com/codemirror/dev/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the codemirror/dev GitHub releases feed has not published since Version 0.16.0 (2020-12-28) — npm publishes of the @codemirror/* packages are the live maintenance signal (repository release practice unverified)",
      ],
    },
    editorCapable: true,
  },
  {
    id: "gimp",
    name: "GIMP",
    kind: "editor",
    capabilityTags: ["image-editing", "raster-graphics", "desktop-editor", "png", "jpeg", "webp"],
    license: {
      spdxId: "GPL-3.0-or-later",
      name: "GNU General Public License v3.0 or later",
      sourceUrl: "https://gitlab.gnome.org/GNOME/gimp/-/raw/master/app/main.c",
      verified: true,
      note: "Repository COPYING is the GPLv3 text; the app/main.c file header states 'either version 3 of the License, or (at your option) any later version'; libgimp library files state LGPL-3.0-or-later (per-file boundaries apply).",
    },
    maintenance: [
      { kind: "gitlab-release", signal: "GIMP 3.2.6", date: "2026-09-10", sourceUrl: "https://gitlab.gnome.org/GNOME/gimp/-/releases", verified: true },
    ],
    repoUrl: "https://gitlab.gnome.org/GNOME/gimp",
    compatibility: {
      summary: "External raster image editor (W5C external class): pixel-level round-trip via PNG (lossless raster, layers flattened); XCF is the native non-interchange format.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://gitlab.gnome.org/GNOME/gimp/-/raw/master/app/main.c",
        "https://gitlab.gnome.org/GNOME/gimp/-/raw/master/COPYING",
        "https://gitlab.gnome.org/GNOME/gimp/-/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "per-file license boundaries (GPL application core vs LGPL libgimp) require per-module review at adoption time",
      ],
    },
    editorCapable: true,
  },
  {
    id: "gltf",
    name: "glTF (Khronos specification)",
    kind: "format",
    capabilityTags: ["gltf", "scene-interchange", "3d-interchange", "asset-interchange"],
    license: {
      spdxId: "CC-BY-4.0",
      name: "Creative Commons Attribution 4.0 International",
      sourceUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF/main/README.md",
      verified: true,
      note: "Repository README header: 'Copyright 2014-2021 The Khronos Group Inc. SPDX-License-Identifier: CC-BY-4.0' (covers the specification repository materials).",
    },
    maintenance: [
      { kind: "github-commit", signal: "commits/main (latest observed: 'Update binary buffer and chunk size limits to reflect actual limits')", date: "2026-10-09", sourceUrl: "https://github.com/KhronosGroup/glTF/commits/main.atom", verified: true },
    ],
    repoUrl: "https://github.com/KhronosGroup/glTF",
    compatibility: {
      summary: "glTF-class 3D scene interchange format (W5C interchange class): the registered format specification; the glTF-Transform library is the separately registered processing toolchain.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/KhronosGroup/glTF/main/README.md",
        "https://github.com/KhronosGroup/glTF/commits/main.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "whether every artifact in the repository (specification documents, JSON schemas, sample assets) shares the README CC-BY-4.0 license — per-directory review pending",
      ],
    },
    editorCapable: false,
  },
  {
    id: "godot",
    name: "Godot Engine",
    kind: "editor",
    capabilityTags: ["scene-editing", "game-engine", "desktop-editor", "gltf", "scene-graph", "3d-render"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/godotengine/godot/master/LICENSE.txt",
      verified: true,
      note: "Copyright (c) 2014-present Godot Engine contributors (see AUTHORS), per the repository LICENSE.txt (master branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "4.7.2-stable", date: "2026-08-22", sourceUrl: "https://github.com/godotengine/godot/releases", verified: true },
    ],
    repoUrl: "https://github.com/godotengine/godot",
    compatibility: {
      summary: "Godot-class external scene editor / game engine (W5C external class): 3D scene editing with glTF import/export interchange.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/godotengine/godot/master/LICENSE.txt",
        "https://github.com/godotengine/godot/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "portions of the Godot codebase (vendored third-party modules) carry their own licenses — per-directory review required at adoption",
      ],
    },
    editorCapable: true,
  },
  {
    id: "kdenlive",
    name: "Kdenlive",
    kind: "editor",
    capabilityTags: ["video-editing", "timeline", "desktop-editor", "mp4", "webm", "editorial-timeline"],
    license: {
      spdxId: "GPL-3.0-only OR LicenseRef-KDE-Accepted-GPL",
      name: "GPL-3.0-only OR LicenseRef-KDE-Accepted-GPL (sampled SPDX expression)",
      sourceUrl: "https://raw.githubusercontent.com/KDE/kdenlive/master/src/main.cpp",
      verified: true,
      note: "src/main.cpp carries 'SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-KDE-Accepted-GPL'; the repository COPYING is the GPLv3 text; per-file expressions vary and need repo-wide review.",
    },
    maintenance: [
      { kind: "github-release", signal: "v26.08.2", date: "2026-10-08", sourceUrl: "https://github.com/KDE/kdenlive/releases", verified: true },
    ],
    repoUrl: "https://github.com/KDE/kdenlive",
    compatibility: {
      summary: "External video editor (W5C external class): timeline editing with rendered-media output; editorial timeline interchange via OpenTimelineIO is a separately registered candidate.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/KDE/kdenlive/master/src/main.cpp",
        "https://raw.githubusercontent.com/KDE/kdenlive/master/COPYING",
        "https://github.com/KDE/kdenlive/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "repo-wide SPDX uniformity unverified (sampled src/main.cpp only)",
        "canonical KDE invent repository path not fetched during research; evidence gathered from the read-only GitHub mirror",
      ],
    },
    editorCapable: true,
  },
  {
    id: "krita",
    name: "Krita",
    kind: "editor",
    capabilityTags: ["image-editing", "raster-graphics", "painting", "desktop-editor", "png", "jpeg", "webp"],
    license: {
      spdxId: "GPL-3.0-only",
      name: "GNU General Public License Version 3 (Krita as a whole)",
      sourceUrl: "https://raw.githubusercontent.com/KDE/krita/master/README.md",
      verified: true,
      note: "Repository README: 'Krita as a whole is licensed under the GNU Public License, Version 3. Individual files may have a different, but compatible license.'; COPYING is the GPLv3 text; no 'or later' language was found in the fetched evidence.",
    },
    maintenance: [
      { kind: "github-release", signal: "v6.0.4.1", date: "2026-10-01", sourceUrl: "https://github.com/KDE/krita/releases", verified: true },
    ],
    repoUrl: "https://github.com/KDE/krita",
    compatibility: {
      summary: "External raster/painting image editor (W5C external class): pixel round-trip via PNG; the KRA native format is not an interchange format.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/KDE/krita/master/README.md",
        "https://raw.githubusercontent.com/KDE/krita/master/COPYING",
        "https://github.com/KDE/krita/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "canonical KDE invent repository path not fetched during research; evidence gathered from the read-only GitHub mirror",
        "individual-file license exceptions (README notes 'a different, but compatible license') require per-file review at adoption",
      ],
    },
    editorCapable: true,
  },
  {
    id: "monaco-editor",
    name: "Monaco Editor",
    kind: "editor",
    capabilityTags: ["code-editing", "embedded-editor", "browser-editor", "text-editing", "json", "edit-interchange"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://unpkg.com/monaco-editor@0.57.0/LICENSE",
      verified: true,
      note: "Copyright (c) 2016 - present Microsoft Corporation, per the LICENSE file shipped inside the monaco-editor@0.57.0 npm package; the npm registry license field also reads MIT.",
    },
    maintenance: [
      { kind: "github-release", signal: "v0.57.0", date: "2026-09-24", sourceUrl: "https://github.com/microsoft/monaco-editor/releases", verified: true },
      { kind: "npm-publish", signal: "monaco-editor@0.57.0", date: "2026-09-24", sourceUrl: "https://registry.npmjs.org/monaco-editor", verified: true },
    ],
    repoUrl: "https://github.com/microsoft/monaco-editor",
    compatibility: {
      summary: "Monaco-class embedded web editor (the VS Code editor component): browser embedding for text/JSON artifact editing; Monaco web hosts wrap this component (W5C embedded class).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://unpkg.com/monaco-editor@0.57.0/LICENSE",
        "https://registry.npmjs.org/monaco-editor",
        "https://github.com/microsoft/monaco-editor/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the repository root license file was not directly reachable during research (raw fetches returned 404); the license basis is the file shipped inside the published npm package plus the npm registry license field",
      ],
    },
    editorCapable: true,
  },
  {
    id: "prosemirror",
    name: "ProseMirror",
    kind: "library",
    capabilityTags: ["rich-text", "structured-document", "embedded-editor", "browser-editor", "json"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/ProseMirror/prosemirror/master/LICENSE",
      verified: true,
      note: "Copyright (C) 2015-2017 by Marijn Haverbeke, per the ProseMirror/prosemirror repository LICENSE file (master branch); the prosemirror-state npm package license field also reads MIT.",
    },
    maintenance: [
      { kind: "npm-publish", signal: "prosemirror-state@1.4.4", date: "2025-10-23", sourceUrl: "https://registry.npmjs.org/prosemirror-state", verified: true },
    ],
    repoUrl: "https://github.com/ProseMirror/prosemirror",
    compatibility: {
      summary: "ProseMirror-class embedded rich-text surface: schema-validated structured document editing; document JSON round-trips through its own model (W5C embedded class).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/ProseMirror/prosemirror/master/LICENSE",
        "https://registry.npmjs.org/prosemirror-state",
        "https://github.com/ProseMirror/prosemirror/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the ProseMirror/prosemirror GitHub releases feed has not published since Version 0.10.1 (2016-09-12) — npm publishes of the prosemirror-* packages are the live maintenance signal",
        "markdown round-trip fidelity depends on the separate prosemirror-markdown package (not verified during research)",
      ],
    },
    editorCapable: true,
  },
  {
    id: "vscode",
    name: "Visual Studio Code",
    kind: "editor",
    capabilityTags: ["code-editing", "extensible-editor", "desktop-editor", "text-editing", "json", "edit-interchange"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/microsoft/vscode/master/LICENSE.txt",
      verified: true,
      note: "Copyright (c) 2015 - present Microsoft Corporation, per the repository LICENSE.txt (master branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "1.141.0", date: "2026-10-07", sourceUrl: "https://github.com/microsoft/vscode/releases", verified: true },
    ],
    repoUrl: "https://github.com/microsoft/vscode",
    compatibility: {
      summary: "VS Code-class extensible native editor (W5C native class): precise text/JSON artifact editing with an extension surface; distributed Microsoft-branded product builds differ from the MIT repository source (telemetry/marketplace) — engineering assessment.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/microsoft/vscode/master/LICENSE.txt",
        "https://github.com/microsoft/vscode/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the shipped Microsoft-branded product binary is not built verbatim from the MIT repository source (product differences unverified at research time)",
      ],
    },
    editorCapable: true,
  },
];

/** Default editor registry: W1C seed profiles + the W5C researched additions. */
export function createEditorRegistry(): TechnologyRegistry {
  return createRegistry([...SEED_PROFILES, ...EDITOR_SEED_PROFILES]);
}
