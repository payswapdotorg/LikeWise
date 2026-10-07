// YOU Solution Studio — 可编辑导出包模型（W1B）。
//
// 遵循 docs/you/CONTRACTS.md "Artifact identity"：导出包必须保留 source/manifest/
// provenance/intent/consent/editor 信息/export 格式/版本 lineage。序列化确定性：
// 固定键序 + JSON.stringify，同一版本重复导出字节一致（FIXTURES 法则 2/8）。
import type {
  ConsentReference,
  EditorRecommendation,
  OpaqueId,
  ProvenanceRecord,
  SolutionVersion,
  YouError,
} from "@zcode/shared";

/** Phase-0 导出包格式版本（外部编辑器经 adapter 往返的稳定信封）。 */
export const SOLUTION_PACKAGE_FORMAT_VERSION = "you-solution-package/1" as const;

/** Phase 0 剧本意图（Intent 契约尚未冻结；仅作为包内只读上下文携带）。 */
export interface SolutionPackageIntentRef {
  readonly id: OpaqueId;
  readonly text: string;
}

/** 可编辑导出包 manifest。 */
export interface SolutionPackageManifest {
  readonly formatVersion: typeof SOLUTION_PACKAGE_FORMAT_VERSION;
  /** ISO-8601；fixture 模式下来自注入时钟（此处为剧本时钟的确定性输出）。 */
  readonly exportedAt: string;
  readonly solution: {
    readonly id: OpaqueId;
    readonly workspaceIdentity: string;
    readonly displayName: string;
  };
  /** 被导出的 canonical 版本（不可变记录的完整拷贝）。 */
  readonly version: SolutionVersion;
  /** 祖先版本 id，最旧在前（version lineage）。 */
  readonly lineage: readonly OpaqueId[];
  readonly provenance: ProvenanceRecord;
  readonly editor: EditorRecommendation;
  readonly consent: ConsentReference;
  readonly intent: SolutionPackageIntentRef | null;
  /** Truth law：模拟管线产物恒为 true。 */
  readonly simulated: boolean;
}

export function buildSolutionPackageManifest(input: {
  version: SolutionVersion;
  lineage: readonly OpaqueId[];
  editor: EditorRecommendation;
  consent: ConsentReference;
  exportedAt: string;
  intent: SolutionPackageIntentRef | null;
  workspaceIdentity: string;
  displayName: string;
}): SolutionPackageManifest {
  return {
    formatVersion: SOLUTION_PACKAGE_FORMAT_VERSION,
    exportedAt: input.exportedAt,
    solution: {
      id: input.version.solutionId,
      workspaceIdentity: input.workspaceIdentity,
      displayName: input.displayName,
    },
    version: input.version,
    lineage: [...input.lineage],
    provenance: input.version.provenance,
    editor: input.editor,
    consent: input.consent,
    intent: input.intent,
    simulated: true,
  };
}

/** 确定性序列化：固定键序（对象字面量构造顺序）+ 2 空格缩进。 */
export function serializeSolutionPackageManifest(manifest: SolutionPackageManifest): string {
  return JSON.stringify(
    {
      formatVersion: manifest.formatVersion,
      exportedAt: manifest.exportedAt,
      solution: {
        id: manifest.solution.id,
        workspaceIdentity: manifest.solution.workspaceIdentity,
        displayName: manifest.solution.displayName,
      },
      version: {
        id: manifest.version.id,
        solutionId: manifest.version.solutionId,
        version: manifest.version.version,
        parentVersionId: manifest.version.parentVersionId,
        state: {
          entities: manifest.version.state.entities,
          environment: manifest.version.state.environment,
          quality: manifest.version.state.quality,
          simulated: manifest.version.state.simulated,
        },
        provenance: manifest.version.provenance,
      },
      lineage: manifest.lineage,
      provenance: manifest.provenance,
      editor: {
        editorId: manifest.editor.editorId,
        editorName: manifest.editor.editorName,
        rationale: manifest.editor.rationale,
        exportFormat: manifest.editor.exportFormat,
      },
      consent: {
        policyId: manifest.consent.policyId,
        state: manifest.consent.state,
        learningPermission: manifest.consent.learningPermission,
      },
      intent: manifest.intent,
      simulated: manifest.simulated,
    },
    null,
    2,
  );
}

/** 解析失败时抛出的 typed error（truthful，不静默吞掉字段缺失）。 */
export class SolutionPackageParseError extends Error {
  readonly youError: YouError;

  constructor(message: string) {
    const youError: YouError = {
      code: "YOU_PROTOCOL_VIOLATION",
      message: `Invalid solution package: ${message}`,
      details: {},
      simulated: true,
    };
    super(youError.message);
    this.name = "SolutionPackageParseError";
    this.youError = youError;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 解析 + 结构校验。宽松字段（缺 lineage/consent 等）按可解释错误抛出。 */
export function parseSolutionPackageManifest(json: string): SolutionPackageManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SolutionPackageParseError("not valid JSON");
  }
  if (!isRecord(parsed)) {
    throw new SolutionPackageParseError("root must be an object");
  }
  if (parsed.formatVersion !== SOLUTION_PACKAGE_FORMAT_VERSION) {
    throw new SolutionPackageParseError(`unsupported formatVersion ${String(parsed.formatVersion)}`);
  }
  const { solution, version, lineage, provenance, editor, consent } = parsed;
  if (!isRecord(solution) || !isRecord(version) || !isRecord(editor) || !isRecord(consent)) {
    throw new SolutionPackageParseError("solution/version/editor/consent sections missing");
  }
  if (!Array.isArray(lineage) || lineage.some((id) => typeof id !== "string")) {
    throw new SolutionPackageParseError("lineage must be a list of ids");
  }
  if (!isRecord(version.state) || !Array.isArray(version.state.entities)) {
    throw new SolutionPackageParseError("version.state.entities missing");
  }
  if (typeof version.id !== "string" || typeof version.solutionId !== "string") {
    throw new SolutionPackageParseError("version identity missing");
  }
  return {
    formatVersion: SOLUTION_PACKAGE_FORMAT_VERSION,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : "",
    solution: {
      id: String(solution.id ?? ""),
      workspaceIdentity: String(solution.workspaceIdentity ?? ""),
      displayName: String(solution.displayName ?? ""),
    },
    version: version as unknown as SolutionVersion,
    lineage: lineage as OpaqueId[],
    provenance: (isRecord(provenance) ? provenance : {}) as unknown as ProvenanceRecord,
    editor: {
      editorId: String(editor.editorId ?? ""),
      editorName: String(editor.editorName ?? ""),
      rationale: String(editor.rationale ?? ""),
      exportFormat: String(editor.exportFormat ?? ""),
    },
    consent: {
      policyId: String(consent.policyId ?? ""),
      state: (consent.state as ConsentReference["state"]) ?? "unknown",
      learningPermission: consent.learningPermission === true,
    },
    intent: isRecord(parsed.intent)
      ? {
          id: String(parsed.intent.id ?? ""),
          text: String(parsed.intent.text ?? ""),
        }
      : null,
    simulated: parsed.simulated === true,
  };
}

// ---------------------------------------------------------------------------
// Truthful diff（re-import 与 canonical 的差异投影）
// ---------------------------------------------------------------------------

export type SolutionEntityDiffKind =
  | "added"
  | "removed"
  | "transform-changed"
  | "attributes-changed";

export interface SolutionEntityDiffEntry {
  readonly entityId: OpaqueId;
  readonly label: string;
  readonly kind: SolutionEntityDiffKind;
  readonly detail: string;
}

export interface SolutionQualityDiffEntry {
  readonly deficiencyClass: string;
  readonly before: number;
  readonly after: number;
}

export interface SolutionImportDiff {
  readonly entityChanges: readonly SolutionEntityDiffEntry[];
  readonly qualityChanges: readonly SolutionQualityDiffEntry[];
  readonly environmentChanged: boolean;
  readonly environmentDetail: string;
  readonly identical: boolean;
}

function formatVec(values: readonly number[]): string {
  return `[${values.map((value) => value.toFixed(2)).join(", ")}]`;
}

/** 与当前 canonical 版本逐实体/逐质量类/环境对比；排序按 entityId（稳定输出）。 */
export function diffSolutionVersionAgainst(
  candidate: SolutionVersion,
  current: SolutionVersion,
): SolutionImportDiff {
  const entityChanges: SolutionEntityDiffEntry[] = [];
  const candidateIds = new Set(candidate.state.entities.map((entity) => entity.id));
  const currentById = new Map(current.state.entities.map((entity) => [entity.id, entity]));
  for (const entity of candidate.state.entities) {
    const before = currentById.get(entity.id);
    if (!before) {
      entityChanges.push({
        entityId: entity.id,
        label: entity.label,
        kind: "added",
        detail: "entity only exists in the imported package",
      });
      continue;
    }
    const transformChanged =
      before.transform.position.some((value, index) => value !== entity.transform.position[index]) ||
      before.transform.rotation.some((value, index) => value !== entity.transform.rotation[index]) ||
      before.transform.scale.some((value, index) => value !== entity.transform.scale[index]);
    if (transformChanged) {
      entityChanges.push({
        entityId: entity.id,
        label: entity.label,
        kind: "transform-changed",
        detail: `position ${formatVec([...before.transform.position])} → ${formatVec([...entity.transform.position])}; rotation ${formatVec([...before.transform.rotation])} → ${formatVec([...entity.transform.rotation])}`,
      });
    } else {
      const attributesChanged = Object.keys({
        ...before.attributes,
        ...entity.attributes,
      }).some((key) => before.attributes[key] !== entity.attributes[key]);
      if (attributesChanged) {
        entityChanges.push({
          entityId: entity.id,
          label: entity.label,
          kind: "attributes-changed",
          detail: "attributes differ between versions",
        });
      }
    }
  }
  for (const entity of current.state.entities) {
    if (!candidateIds.has(entity.id)) {
      entityChanges.push({
        entityId: entity.id,
        label: entity.label,
        kind: "removed",
        detail: "entity only exists in the current canonical version",
      });
    }
  }
  entityChanges.sort((a, b) => (a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0));

  const qualityClasses = Array.from(
    new Set([...Object.keys(current.state.quality), ...Object.keys(candidate.state.quality)]),
  ).sort();
  const qualityChanges: SolutionQualityDiffEntry[] = qualityClasses
    .filter((cls) => (current.state.quality[cls] ?? 0) !== (candidate.state.quality[cls] ?? 0))
    .map((cls) => ({
      deficiencyClass: cls,
      before: current.state.quality[cls] ?? 0,
      after: candidate.state.quality[cls] ?? 0,
    }));

  const env = current.state.environment;
  const nextEnv = candidate.state.environment;
  const environmentChanged =
    env.keyLightDirection.some((value, index) => value !== nextEnv.keyLightDirection[index]) ||
    env.ambientIntensity !== nextEnv.ambientIntensity ||
    env.background !== nextEnv.background;

  return {
    entityChanges,
    qualityChanges,
    environmentChanged,
    environmentDetail: environmentChanged
      ? `ambient ${env.ambientIntensity.toFixed(2)} → ${nextEnv.ambientIntensity.toFixed(2)}; key light ${formatVec([...env.keyLightDirection])} → ${formatVec([...nextEnv.keyLightDirection])}`
      : "",
    identical:
      entityChanges.length === 0 && qualityChanges.length === 0 && !environmentChanged,
  };
}
