// YOU Twin Studio — 视图纯投影（W3B）。
//
// 只做确定性视图数学：质量地图（可访问、非仅颜色）、缺陷清单投影、版本对比
// （分数/缺陷/溯源 delta）、重建作业 effort 观察（not-measured 诚实标记）、
// 键盘转移（与 Solution/Capture 表面同级的键盘可用性）。无 DOM、无随机、
// 无计时器（FIXTURES 法则 1/2）。
import type {
  ProvenanceRecord,
  ReconstructionJobResult,
  TwinDeficiency,
  TwinVersion,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 质量地图（accessible：每行都带数值文本 + 文本级 level；不依赖颜色单独传达含义）
// ---------------------------------------------------------------------------

/** 确定性 level 阈值（0.85+ strong / 0.75..0.85 adequate / <0.75 low；与缺陷阈值 0.75 对齐）。 */
export const TWIN_QUALITY_LEVEL_STRONG_THRESHOLD = 0.85;

export type TwinQualityScoreLevel = "strong" | "adequate" | "low";

export interface TwinQualityMapRow {
  readonly domain: string;
  readonly score: number;
  readonly percent: number;
  readonly level: TwinQualityScoreLevel;
  /** 供 aria / 纯文本消费的确定性描述（非仅颜色）。 */
  readonly accessibleLabel: string;
}

/** 判级（确定性；阈值与 W3A fixture 缺陷阈值对齐）。 */
export function resolveQualityScoreLevel(score: number): TwinQualityScoreLevel {
  if (score >= TWIN_QUALITY_LEVEL_STRONG_THRESHOLD) return "strong";
  if (score >= 0.75) return "adequate";
  return "low";
}

/** 质量地图行（按 domain 稳定排序；分数即 TwinVersion 的确定性投影）。 */
export function projectQualityMapRows(version: TwinVersion | null): readonly TwinQualityMapRow[] {
  if (!version) return [];
  return Object.entries(version.quality.domainScores)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([domain, score]) => {
      const level = resolveQualityScoreLevel(score);
      return {
        domain,
        score,
        percent: Math.round(score * 100),
        level,
        accessibleLabel: `${domain}: ${score.toFixed(2)} — ${level} (${Math.round(score * 100)} of 100)`,
      };
    });
}

// ---------------------------------------------------------------------------
// 缺陷清单投影（class / severity / remediation hint；severity 排序稳定）
// ---------------------------------------------------------------------------

export interface TwinDeficiencyRow {
  readonly id: string;
  readonly deficiencyClass: string;
  readonly domain: string;
  readonly severity: number;
  readonly severityPercent: number;
  readonly remediationHint: string | null;
  readonly remediationEvidenceRequestId: string | null;
  /** 供 aria / 纯文本消费的确定性描述（非仅颜色）。 */
  readonly accessibleLabel: string;
}

/** 缺陷行（severity 降序，同 severity 按 class/domain 稳定排序；FIXTURES 法则 4）。 */
export function projectDeficiencyRows(
  version: TwinVersion | null,
): readonly TwinDeficiencyRow[] {
  if (!version) return [];
  return [...version.quality.deficiencies]
    .sort((a, b) =>
      b.severity !== a.severity
        ? b.severity - a.severity
        : deficiencySortKey(a) < deficiencySortKey(b)
          ? -1
          : 1,
    )
    .map((deficiency) => ({
      id: deficiency.id,
      deficiencyClass: deficiency.deficiencyClass,
      domain: deficiency.domain,
      severity: deficiency.severity,
      severityPercent: Math.round(deficiency.severity * 100),
      remediationHint: deficiency.remediationHint,
      remediationEvidenceRequestId: deficiency.remediationEvidenceRequestId,
      accessibleLabel: `${deficiency.deficiencyClass} on ${deficiency.domain}, severity ${deficiency.severity.toFixed(2)} of 1.00`,
    }));
}

function deficiencySortKey(deficiency: TwinDeficiency): string {
  return `${deficiency.deficiencyClass}:${deficiency.domain}:${deficiency.id}`;
}

// ---------------------------------------------------------------------------
// 版本对比（side-by-side + delta：分数 / 缺陷 / 溯源 / 绑定）
// ---------------------------------------------------------------------------

export type TwinCompareScoreChange =
  | "improved"
  | "regressed"
  | "unchanged"
  | "added"
  | "removed";

export interface TwinCompareScoreRow {
  readonly domain: string;
  readonly baseScore: number | null;
  readonly targetScore: number | null;
  readonly delta: number | null;
  readonly change: TwinCompareScoreChange;
}

export interface TwinCompareProjection {
  readonly baseVersionId: string;
  readonly targetVersionId: string;
  readonly baseVersionNumber: number;
  readonly targetVersionNumber: number;
  readonly baseStatus: TwinVersion["status"];
  readonly targetStatus: TwinVersion["status"];
  /** 分数 delta 行（两版并集域，按 domain 稳定排序）。 */
  readonly scoreRows: readonly TwinCompareScoreRow[];
  /** 基线版仍有、目标版已消除的缺陷 key。 */
  readonly resolvedDeficiencyKeys: readonly string[];
  /** 目标版新增的缺陷 key（质量回归必须可见）。 */
  readonly addedDeficiencyKeys: readonly string[];
  readonly unchangedDeficiencyKeys: readonly string[];
  readonly baseDomainBlockCount: number;
  readonly targetDomainBlockCount: number;
  readonly baseEvidenceBindingCount: number;
  readonly targetEvidenceBindingCount: number;
  readonly baseProvenance: ProvenanceRecord;
  readonly targetProvenance: ProvenanceRecord;
  /** 溯源可读性：来源是否改变（重建作业产物 vs 直接发布）。 */
  readonly provenanceSourceChanged: boolean;
}

function roundCompareDelta(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 两个 TwinVersion 的确定性对比投影（side-by-side 分数 + delta + 缺陷增减 +
 * 溯源对比）。base 与 target 不可为同一版本（调用方约束；此处防御性回退 null
 * 由调用方呈现「未选择对比目标」态）。
 */
export function projectTwinVersionCompare(
  base: TwinVersion,
  target: TwinVersion,
): TwinCompareProjection {
  const domains = [
    ...new Set([
      ...Object.keys(base.quality.domainScores),
      ...Object.keys(target.quality.domainScores),
    ]),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const scoreRows: TwinCompareScoreRow[] = domains.map((domain) => {
    const baseScore = base.quality.domainScores[domain] ?? null;
    const targetScore = target.quality.domainScores[domain] ?? null;
    if (baseScore === null) {
      return { domain, baseScore, targetScore, delta: null, change: "added" as const };
    }
    if (targetScore === null) {
      return { domain, baseScore, targetScore, delta: null, change: "removed" as const };
    }
    const delta = roundCompareDelta(targetScore - baseScore);
    return {
      domain,
      baseScore,
      targetScore,
      delta,
      change:
        delta > 0 ? ("improved" as const) : delta < 0 ? ("regressed" as const) : ("unchanged" as const),
    };
  });

  const baseKeys = new Set(base.quality.deficiencies.map(deficiencyKeyOf));
  const targetKeys = new Set(target.quality.deficiencies.map(deficiencyKeyOf));
  return {
    baseVersionId: base.id,
    targetVersionId: target.id,
    baseVersionNumber: base.version,
    targetVersionNumber: target.version,
    baseStatus: base.status,
    targetStatus: target.status,
    scoreRows,
    resolvedDeficiencyKeys: [...baseKeys].filter((key) => !targetKeys.has(key)).sort(),
    addedDeficiencyKeys: [...targetKeys].filter((key) => !baseKeys.has(key)).sort(),
    unchangedDeficiencyKeys: [...baseKeys].filter((key) => targetKeys.has(key)).sort(),
    baseDomainBlockCount: base.domainBlocks.length,
    targetDomainBlockCount: target.domainBlocks.length,
    baseEvidenceBindingCount: base.evidenceBindings.length,
    targetEvidenceBindingCount: target.evidenceBindings.length,
    baseProvenance: base.provenance,
    targetProvenance: target.provenance,
    provenanceSourceChanged: base.provenance.source !== target.provenance.source,
  };
}

function deficiencyKeyOf(deficiency: TwinDeficiency): string {
  return `${deficiency.deficiencyClass}:${deficiency.domain}`;
}

// ---------------------------------------------------------------------------
// 重建作业 effort 观察（truth law：not-measured 标记原样呈现，绝不编造数字）
// ---------------------------------------------------------------------------

export interface TwinEffortObservationRow {
  readonly key: string;
  readonly value: string;
  /** 显式 not-measured 标记（`*.measured: false` 或 "not-measured" 字面）。 */
  readonly notMeasured: boolean;
  /** 供 aria / 纯文本消费的确定性描述。 */
  readonly accessibleLabel: string;
}

/**
 * effortObservations 的确定性渲染行（按 key 稳定排序）。
 * - `*.measured` 布尔与字符串值里的 "not-measured" 都是显式标记；
 * - 数值渲染为字符串（Number.isFinite 三位有效位以内原样；分数不加精度戏）。
 */
export function projectEffortObservationRows(
  result: ReconstructionJobResult | null,
): readonly TwinEffortObservationRow[] {
  if (!result) return [];
  return Object.entries(result.effortObservations)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, raw]) => {
      const value = String(raw);
      const notMeasured =
        key.endsWith(".measured") ? raw === false : value.includes("not-measured");
      return {
        key,
        value,
        notMeasured,
        accessibleLabel: notMeasured
          ? `${key}: ${value} (unmeasured — no number invented)`
          : `${key}: ${value}`,
      };
    });
}

// ---------------------------------------------------------------------------
// 键盘转移（与 Solution/Capture 表面一致的键盘导航可用性；纯函数可测）
// ---------------------------------------------------------------------------

export type TwinVersionListKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "select" }
  | { readonly kind: "none" };

/**
 * 版本列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末项；Enter：选中当前版本（检视详情）；
 * - 其余键 no-op。与 Solution 视口 / Capture 引导列表同款「键盘完全可用」语义。
 */
export function resolveTwinVersionKeyboardTransition(
  key: string,
  state: {
    readonly totalVersions: number;
  },
): TwinVersionListKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalVersions };
    case "End":
      return { kind: "move", delta: state.totalVersions };
    case "Enter":
      return { kind: "select" };
    default:
      return { kind: "none" };
  }
}

/** 版本光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampVersionIndex(index: number, totalVersions: number): number {
  if (totalVersions <= 0) return 0;
  return Math.min(totalVersions - 1, Math.max(0, index));
}
