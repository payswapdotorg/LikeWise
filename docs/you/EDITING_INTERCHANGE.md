# YOU Editing, Export, Import and Interchange

## Goal

Keep the user inside YOU whenever the task can be completed safely and well enough.

When the capability gap is editing rather than reconstruction, the system should recommend an appropriate editor and preserve a reversible relationship between the YOU object and the edited artifact.

## Integration tiers

### Tier 1 — native

Built directly into the Solution runtime.

Initial target:

- Three.js / React Three Fiber
- YOU-native selection, transform, annotation and material controls

### Tier 2 — embedded open source

Candidates:

- SVG-Edit — browser SVG editing;
- Excalidraw — annotation/diagramming;
- Three.js Editor — 3D reference/editor surface;
- OpenReel Video — browser video editing;
- other open-source tools discovered by the Technology Registry.

Verify current license and commercial terms at adoption time.

### Tier 3 — external professional application

Initial target:

- Blender

The desktop application may use ZCode platform abstractions to launch/open external tools where supported by the platform. Do not directly reference Electron APIs from shared UI.

### Tier 4 — export/import

When no integration is suitable:

export -> user edits -> import -> diff -> validation -> candidate version -> accept/reject.

## Formats

Priority exchange formats:

### 3D
- GLB/glTF first
- VRM for compatible humanoid/avatar use cases
- OpenUSD where high-end interchange is justified
- OBJ/FBX only through explicit adapters because of weaker round-trip guarantees or licensing/format constraints

### 2D
- PNG/JPEG/WebP
- SVG for vector content
- layered formats only when a valid adapter exists

### Video
- MP4/WebM as rendered media
- OpenTimelineIO as an editorial timeline interchange candidate

### Animation
- glTF animation
- VRM
- BVH through optional adapter
- application-specific retargeting adapters

## Editable artifact package

Each export should contain:

```
manifest.you.json
source/
preview/
provenance/
intent/
edit/
```

The manifest records:

- YOU object and version;
- source evidence references where permitted;
- renderer;
- pipeline;
- editor target;
- supported round-trip path;
- provenance;
- rights/license;
- privacy constraints.

## EditSession rules

A user may:

- correct;
- edit;
- teach.

The system must be able to:

- begin;
- pause;
- save;
- export;
- import;
- compare;
- accept;
- discard;
- revert.

Canonical state is never overwritten silently.

## Round-trip evaluation

Every editor adapter receives benchmark measurements:

- import fidelity;
- export fidelity;
- geometry preservation;
- rig preservation;
- materials;
- animation;
- identity preservation;
- metadata/provenance preservation;
- editability;
- latency;
- user effort.

The Lab should optimize total task completion, not raw editor feature count.

## Manual learning

If the edit was observed inside YOU:

record action trajectory.

If external:

compare before/after and infer only what can be supported.

If ambiguity remains, tell the user that only outcome-level learning was captured.

## User preferences

Preference learning is separately permissioned and scoped.

Example:

"Make my avatar's eyes slightly larger."

can become a user-scoped preference rather than a global reconstruction rule.

## Safety

Imported content is untrusted until validated.

Editor adapters must not execute arbitrary imported scripts/macros without explicit policy.

External app integration must not expose secrets or unrelated workspace content.

## Initial technology research URLs

- Three.js: https://github.com/mrdoob/three.js
- React Three Fiber: https://github.com/pmndrs/react-three-fiber
- glTF-Transform: https://github.com/donmccurdy/glTF-Transform
- three-vrm: https://github.com/pixiv/three-vrm
- SVG-Edit: https://github.com/SVG-Edit/svgedit
- Excalidraw: https://github.com/excalidraw/excalidraw
- OpenReel: https://github.com/Augani/openreel-video
- OpenTimelineIO: https://github.com/AcademySoftwareFoundation/OpenTimelineIO
- Blender: https://github.com/blender/blender
- OpenUSD: https://github.com/PixarAnimationStudios/OpenUSD

These are research candidates, not automatic approvals. License/terms/maintenance/compatibility must be recorded before production adoption.
