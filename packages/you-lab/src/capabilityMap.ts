// Provider-neutral capability domain map shared by the Organization Compiler,
// the benchmark arms and the benchmark scorer. This is YOU-lab-owned
// engineering vocabulary (an assessment table, not external claims) and it
// carries no provider-specific semantics: technologies only enter through
// capability tags declared in the technology registry.

import type { OutputKind } from "./organization/model.js";

export type PlanStage = "decompose" | "construct" | "edit" | "review";

export interface CapabilityDomainSpec {
  /** Stable domain id, e.g. "scene-render". */
  readonly domain: string;
  /** Which plan stage a binding for this domain lands in. */
  readonly stage: "construct" | "edit" | "review";
  /** Lab role from the docs/you/LAB.md role vocabulary. */
  readonly role: string;
  /** Technology capability tags that satisfy this domain. */
  readonly satisfyingTags: readonly string[];
  /** True when the domain is owned by a lab role and needs no technology binding. */
  readonly roleOnly?: boolean;
  readonly description: string;
}

export const CAPABILITY_DOMAINS: readonly CapabilityDomainSpec[] = [
  { domain: "scene-render", stage: "construct", role: "rendering specialist", satisfyingTags: ["3d-render", "react-integration"], description: "Render a 3D scene to an interactive viewport or image." },
  { domain: "scene-construction", stage: "construct", role: "integration engineer", satisfyingTags: ["scene-graph", "3d-modeling", "react-integration"], description: "Assemble entities, transforms and hierarchy." },
  { domain: "asset-optimization", stage: "construct", role: "cost optimizer", satisfyingTags: ["gltf-processing", "asset-optimization", "format-conversion"], description: "Optimize, deduplicate and compress 3D assets." },
  { domain: "avatar-rig", stage: "construct", role: "geometry specialist", satisfyingTags: ["vrm-avatar", "humanoid-rig", "rigging"], description: "Humanoid rig setup and skeleton binding." },
  { domain: "avatar-expression", stage: "construct", role: "face specialist", satisfyingTags: ["expression", "avatar-animation", "animation"], description: "Facial expressions and blendshape control." },
  { domain: "motion", stage: "construct", role: "motion specialist", satisfyingTags: ["animation", "avatar-animation"], description: "Body motion and animation retargeting." },
  { domain: "facial-expression", stage: "construct", role: "face specialist", satisfyingTags: ["expression"], description: "Face-specific articulation." },
  { domain: "image-composition", stage: "construct", role: "rendering specialist", satisfyingTags: ["3d-render", "canvas-2d"], description: "Compose a still image output." },
  { domain: "environment-staging", stage: "construct", role: "geometry specialist", satisfyingTags: ["scene-graph", "3d-render"], description: "Environment, background and props staging." },
  { domain: "lighting", stage: "construct", role: "rendering specialist", satisfyingTags: ["scene-graph", "3d-render"], description: "Key/ambient lighting setup." },
  { domain: "gltf-interchange", stage: "construct", role: "integration engineer", satisfyingTags: ["gltf", "gltf-processing"], description: "GLB/glTF import and export." },
  { domain: "vrm-avatar-output", stage: "construct", role: "geometry specialist", satisfyingTags: ["vrm", "vrm-avatar"], description: "VRM avatar output." },
  { domain: "svg-output", stage: "construct", role: "editor/tool specialist", satisfyingTags: ["svg", "svg-edit", "diagram"], description: "SVG vector output." },
  { domain: "rendered-media-output", stage: "construct", role: "rendering specialist", satisfyingTags: ["mp4", "webm", "video-editing"], description: "Rendered video/media output." },
  { domain: "vector-2d-composition", stage: "construct", role: "editor/tool specialist", satisfyingTags: ["vector-2d", "canvas-2d", "svg-edit", "diagram"], description: "2D vector composition." },
  { domain: "annotation-edit", stage: "edit", role: "editor/tool specialist", satisfyingTags: ["annotation", "diagram", "svg-edit"], description: "Annotate or diagram over content." },
  { domain: "editorial-timeline", stage: "edit", role: "editor/tool specialist", satisfyingTags: ["editorial-timeline", "timeline", "timeline-interchange"], description: "Editorial timeline editing." },
  { domain: "media-composition", stage: "edit", role: "editor/tool specialist", satisfyingTags: ["video-editing", "editorial-timeline"], description: "Media sequence composition." },
  { domain: "timeline-interchange", stage: "edit", role: "editor/tool specialist", satisfyingTags: ["otio", "editorial-timeline"], description: "OpenTimelineIO interchange." },
  { domain: "usd-interchange", stage: "construct", role: "integration engineer", satisfyingTags: ["usd", "scene-interchange"], description: "OpenUSD scene interchange." },
  { domain: "obj-interchange", stage: "construct", role: "integration engineer", satisfyingTags: [], description: "OBJ interchange (no registry candidate — deliberate gap fixture)." },
  { domain: "quality-verification", stage: "review", role: "evaluator", satisfyingTags: [], roleOnly: true, description: "Plan-level quality verification performed by the evaluator role." },
];

/** Base domains per output kind (deterministic decomposition seed). */
export const OUTPUT_KIND_DOMAINS: Readonly<Record<OutputKind, readonly string[]>> = {
  "3d-scene": ["scene-render", "scene-construction"],
  avatar: ["avatar-rig", "avatar-expression", "scene-render"],
  image: ["scene-render", "image-composition"],
  video: ["scene-render", "media-composition", "editorial-timeline"],
  diagram: ["vector-2d-composition", "annotation-edit"],
  annotation: ["vector-2d-composition", "annotation-edit"],
  "timeline-edit": ["editorial-timeline", "media-composition"],
};

/** Extra domain added when a required format needs a dedicated interchange capability. */
export const FORMAT_DOMAINS: Readonly<Record<string, string>> = {
  gltf: "gltf-interchange",
  glb: "gltf-interchange",
  vrm: "vrm-avatar-output",
  svg: "svg-output",
  mp4: "rendered-media-output",
  webm: "rendered-media-output",
  otio: "timeline-interchange",
  usd: "usd-interchange",
  obj: "obj-interchange",
};

/** Intent text keywords (lowercase) that add a domain. Sorted by keyword. */
export const INTENT_KEYWORDS: readonly { readonly keyword: string; readonly domain: string }[] = [
  { keyword: "animate", domain: "motion" },
  { keyword: "background", domain: "environment-staging" },
  { keyword: "environment", domain: "environment-staging" },
  { keyword: "expression", domain: "facial-expression" },
  { keyword: "face", domain: "facial-expression" },
  { keyword: "light", domain: "lighting" },
  { keyword: "motion", domain: "motion" },
  { keyword: "prop", domain: "scene-construction" },
  { keyword: "walk", domain: "motion" },
];

/** Quality-driven domain (high quality bar pulls in asset optimization). */
export const QUALITY_DOMAIN: { readonly domain: string; readonly threshold: number } = {
  domain: "asset-optimization",
  threshold: 0.7,
};

export function findDomainSpec(domain: string): CapabilityDomainSpec | null {
  for (const spec of CAPABILITY_DOMAINS) {
    if (spec.domain === domain) return spec;
  }
  return null;
}
