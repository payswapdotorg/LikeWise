// YOU Twin Studio — W3B 确定性剧本数据。
//
// 边界（docs/you/FIXTURES.md wave-3 ownership）：
// - Worker A（W3A）拥有 twin/reconstruction 的 fixture 生成器（htirDomain /
//   twinVersioning / reconstruction / twinQuality 的确定性 runtime）；B **不新增
//   fixture 生成器**。本文件是「剧本」（storyboard）：契约形状的固定字面量记录 +
//   声明式表，供 `twinSimulatedController.ts` 驱动确定性演示；所有记录
//   simulated: true、provenance.generator: "fixture"。
// - TODO(T3): Worker A 的 twin/reconstruction 服务合入后，由 TL 把 UI 端口换绑到
//   真实服务；本剧本届时随模拟控制器整体退役。
//
// 确定性法则（FIXTURES.md）：不调用 Date.now/Math.random/网络；时间戳来自
// StoryboardClock（复用 W1B 注入式剧本时钟）；一切输出排序稳定（按 id / 追加序）。
import type {
  ConsentPolicy,
  EvidenceRequest,
  HtirDomainBlock,
  HtirDomainKind,
  ProvenanceRecord,
  ReconstructionJobResult,
  TwinDeficiency,
  TwinDeficiencyClass,
  TwinEvidenceBinding,
  TwinQualityState,
  TwinVersion,
} from "@zcode/shared";
import { StoryboardClock } from "./solutionStoryboard.js";
import { computeCaptureFixtureHash } from "./captureStoryboard.js";

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const TWIN_STORYBOARD_SEED = "you-w3b-twin-studio-001";

export const TWIN_STORYBOARD_DISPLAY_NAME = "Twin Studio — Aria";

export const TWIN_STORYBOARD_SOLUTION_ID = "fx-twin-studio";

/** 剧本 twin 身份（服务级记录；版本链从第一版发布开始）。 */
export const TWIN_STORYBOARD_TWIN_ID = "fx-twin-001";

// ---------------------------------------------------------------------------
// 同意政策（frozen ConsentPolicy 形状的固定记录；与 W2B capture 政策同构，
// 使「无许可 ⇒ 不处理」的 binding-time 强制在 twin 车道同样真实可见）
// ---------------------------------------------------------------------------

export const TWIN_STORYBOARD_CONSENT_POLICY: ConsentPolicy = {
  id: "fx-twin-consent-001",
  purposes: ["solution-generation", "quality-improvement"],
  scope: "USER",
  operationalUse: false,
  learningReuse: false,
  retention: {
    policy: "delete-after-review",
    deleteAfter: null,
    reason:
      "Fixture evidence content is deleted once a review outcome is accepted; immutable twin versions keep provenance only.",
  },
  revocable: true,
};

// ---------------------------------------------------------------------------
// 确定性 fixture 质量模型（语义与 W3A shared twinQuality 的冻结 fixture 定义一致；
// 因 @zcode/shared 公共入口仅导出契约类型，剧本在此按同一语义重建投影）
// ---------------------------------------------------------------------------

/** fixture 必需域（W3A 冻结 fixture 定义：identity-binding / morphology / geometry-skeleton）。 */
export const TWIN_STORYBOARD_REQUIRED_DOMAINS: readonly HtirDomainKind[] = [
  "identity-binding",
  "morphology",
  "geometry-skeleton",
];

/** 分数低于该阈值判为缺陷（W3A 冻结 fixture 定义 0.75）。 */
export const TWIN_STORYBOARD_DEFICIENCY_THRESHOLD = 0.75;

/** 冻结 domain -> 低分缺陷类别表（W3A FIXTURE_TWIN_DOMAIN_DEFICIENCY_CLASSES 同表）。 */
export const TWIN_STORYBOARD_DOMAIN_DEFICIENCY_CLASSES: Readonly<
  Record<string, TwinDeficiencyClass>
> = {
  "appearance-materials": "appearance-error",
  "articulation-blendshapes": "articulation-error",
  "face-hands": "geometric-error",
  "geometry-skeleton": "geometric-error",
  hair: "appearance-error",
  morphology: "geometric-error",
  "motion-profile": "articulation-error",
  "neural-appearance": "appearance-error",
  style: "appearance-error",
};

/** 缺陷注册表 key（class:domain；与 W3A twinDeficiencyKey 同式）。 */
export function twinStoryboardDeficiencyKey(
  deficiencyClass: TwinDeficiencyClass,
  domain: HtirDomainKind,
): string {
  return `${deficiencyClass}:${domain}`;
}

function roundStoryboardScore(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface StoryboardQualityDeps {
  /** 剧本时钟：assessedAt 来源。 */
  readonly clock: StoryboardClock;
  /** 缺陷 id 计数器来源（模拟控制器的 nextId）。 */
  readonly nextDeficiencyId: () => string;
  /** 缺陷注册表：deficiencyKey -> 服务中的 EvidenceRequest id（可空）。 */
  readonly remediation: {
    resolve(deficiencyClass: TwinDeficiencyClass, domain: HtirDomainKind): string | null;
  };
}

/**
 * 确定性质量投影（语义与 W3A assessTwinQuality 的 fixture 模型 v1 相同）：
 * - domainScores：每域取最弱 block confidence（round 2 位）；
 * - 覆盖缺口（coverage-gap，severity 1）：必需域无 block；
 * - 低分缺陷：映射域分数 < 0.75 时按冻结表归类，severity = 1 - score；
 * - 溯源缺失（provenance-missing，severity 1）：无证据绑定；
 * - remediationEvidenceRequestId 由缺陷注册表解析（下一版发布时回填）。
 */
export function assessStoryboardTwinQuality(
  input: {
    readonly domainBlocks: readonly HtirDomainBlock[];
    readonly evidenceBindings: readonly TwinEvidenceBinding[];
  },
  deps: StoryboardQualityDeps,
): TwinQualityState {
  const byDomain = new Map<HtirDomainKind, number>();
  for (const block of input.domainBlocks) {
    const current = byDomain.get(block.domain);
    byDomain.set(
      block.domain,
      current === undefined ? block.confidence : Math.min(current, block.confidence),
    );
  }
  const domainScores: Record<string, number> = {};
  for (const domain of [...byDomain.keys()].sort(compareId)) {
    const score = byDomain.get(domain);
    if (score !== undefined) {
      domainScores[domain] = roundStoryboardScore(score);
    }
  }

  const deficiencies: TwinDeficiency[] = [];
  const push = (
    deficiencyClass: TwinDeficiencyClass,
    domain: HtirDomainKind,
    severity: number,
    remediationHint: string | null,
  ): void => {
    deficiencies.push({
      id: deps.nextDeficiencyId(),
      deficiencyClass,
      domain,
      severity: roundStoryboardScore(severity),
      remediationHint,
      remediationEvidenceRequestId: deps.remediation.resolve(deficiencyClass, domain),
    });
  };

  const present = new Set(input.domainBlocks.map((block) => block.domain));
  for (const domain of TWIN_STORYBOARD_REQUIRED_DOMAINS) {
    if (!present.has(domain)) {
      push(
        "coverage-gap",
        domain,
        1,
        `capture evidence targeting the "${domain}" domain and publish a new twin version`,
      );
    }
  }

  for (const domain of Object.keys(domainScores).sort(compareId)) {
    const score = domainScores[domain];
    if (score === undefined || score >= TWIN_STORYBOARD_DEFICIENCY_THRESHOLD) {
      continue;
    }
    const deficiencyClass = TWIN_STORYBOARD_DOMAIN_DEFICIENCY_CLASSES[domain];
    if (deficiencyClass === undefined) {
      continue;
    }
    push(
      deficiencyClass,
      domain,
      1 - score,
      `capture targeted evidence for the "${domain}" domain to lift the ${deficiencyClass} score above ${TWIN_STORYBOARD_DEFICIENCY_THRESHOLD}`,
    );
  }

  if (input.evidenceBindings.length === 0) {
    push("provenance-missing", "identity-binding", 1, "bind evidence records when publishing the next twin version");
  }

  deficiencies.sort((a, b) => compareId(a.id, b.id));
  return {
    domainScores,
    deficiencies,
    assessedAt: deps.clock.next(),
  };
}

// ---------------------------------------------------------------------------
// 剧本溯源（与 W1B/W2B 同源，source 区分 twin studio）
// ---------------------------------------------------------------------------

export function twinStoryboardProvenance(
  clock: StoryboardClock,
  lineage: readonly string[] = [],
): ProvenanceRecord {
  return {
    source: "you-phase0-twin-storyboard",
    generator: "fixture",
    createdAt: clock.next(),
    lineage,
  };
}

// ---------------------------------------------------------------------------
// 剧本 HTIR 域块（字面量记录；内容寻址、simulated、confidence 为 fixture 值）
// ---------------------------------------------------------------------------

/**
 * 由 seed 派生一个确定性的 fixture 域块（与 W3A createHtirDomainBlock 的
 * 语义对齐：confidence 由内容哈希确定性派生；这里用字面量表 + 固定哈希函数）。
 * tag 用于区分不同发布的同域块（id / contentRef 唯一）。
 */
function storyboardDomainBlock(
  input: {
    readonly tag: string;
    readonly domain: HtirDomainKind;
    readonly confidence: number;
    readonly lineage?: readonly string[];
    readonly source: string;
  },
  clock: StoryboardClock,
): HtirDomainBlock {
  const contentScope = `${TWIN_STORYBOARD_SEED}:${input.tag}:${input.domain}`;
  return {
    id: `fx-htir-${input.tag}-${input.domain}`,
    domain: input.domain,
    contentRef: `fx-content-${computeCaptureFixtureHash(contentScope)}`,
    contentHash: `sha256-fixture-${computeCaptureFixtureHash(`${contentScope}:${input.confidence}`)}`,
    confidence: input.confidence,
    simulated: true,
    provenance: {
      source: input.source,
      generator: "fixture",
      createdAt: clock.next(),
      lineage: [...(input.lineage ?? [])],
    },
  };
}

/** v1 剧本域块（证据自由发布：出现 geometry/appearance 低分与 provenance-missing）。 */
export function buildTwinStoryboardV1Blocks(clock: StoryboardClock): HtirDomainBlock[] {
  const source = "fixture:twin-storyboard:v1";
  return [
    storyboardDomainBlock({ tag: "v1", domain: "identity-binding", confidence: 0.92, source }, clock),
    storyboardDomainBlock({ tag: "v1", domain: "morphology", confidence: 0.88, source }, clock),
    storyboardDomainBlock({ tag: "v1", domain: "geometry-skeleton", confidence: 0.71, source }, clock),
    storyboardDomainBlock({ tag: "v1", domain: "appearance-materials", confidence: 0.68, source }, clock),
  ];
}

/**
 * v2 剧本域块（重建作业产出：几何域被定向提升；appearance 仍低于阈值——
 * 改进是部分的、诚实的，绝不静默改分）。hair 新增且达标。
 * 作业锚点（jobId / 源版本）写入块级 lineage 与 provenance source。
 */
export function buildTwinStoryboardV2Blocks(
  clock: StoryboardClock,
  job: {
    readonly jobId: string;
    readonly twinVersionId: string;
  },
): HtirDomainBlock[] {
  const source = `fixture:reconstruction:${job.jobId}`;
  const lineage = [job.jobId, job.twinVersionId];
  return [
    storyboardDomainBlock({ tag: "v2", domain: "identity-binding", confidence: 0.93, lineage, source }, clock),
    storyboardDomainBlock({ tag: "v2", domain: "morphology", confidence: 0.9, lineage, source }, clock),
    storyboardDomainBlock({ tag: "v2", domain: "geometry-skeleton", confidence: 0.86, lineage, source }, clock),
    storyboardDomainBlock({ tag: "v2", domain: "appearance-materials", confidence: 0.73, lineage, source }, clock),
    storyboardDomainBlock({ tag: "v2", domain: "hair", confidence: 0.79, lineage, source }, clock),
  ];
}

// ---------------------------------------------------------------------------
// 重建作业剧本（provider-neutral、method-plural；不支持的组合 → typed error）
// ---------------------------------------------------------------------------

/** W3A 冻结 fixture 支持矩阵（method -> 支持的目标域）。 */
export const TWIN_STORYBOARD_RECONSTRUCTION_SUPPORT: Readonly<
  Record<string, readonly HtirDomainKind[]>
> = {
  "explicit-geometry": [
    "articulation-blendshapes",
    "face-hands",
    "geometry-skeleton",
    "identity-binding",
    "morphology",
    "motion-profile",
  ],
  "neural-appearance": [
    "appearance-materials",
    "hair",
    "identity-binding",
    "morphology",
    "neural-appearance",
    "style",
  ],
  hybrid: [
    "appearance-materials",
    "articulation-blendshapes",
    "face-hands",
    "geometry-skeleton",
    "hair",
    "identity-binding",
    "morphology",
    "motion-profile",
    "neural-appearance",
    "style",
  ],
};

/** 返回不支持的 method/域组合（[] = 支持；未知 method ⇒ 全部不支持）。 */
export function unsupportedStoryboardReconstructionDomains(
  method: string,
  targetDomains: readonly HtirDomainKind[],
): HtirDomainKind[] {
  const supported = TWIN_STORYBOARD_RECONSTRUCTION_SUPPORT[method];
  if (supported === undefined) {
    return [...targetDomains].sort(compareId);
  }
  return targetDomains
    .filter((domain) => !supported.includes(domain))
    .sort(compareId);
}

/**
 * 诚实的 effort 观察（truth law）：每个 effort/latency/cost 字段都带显式
 * not-measured 标记；只有块/绑定计数是真实观察。与 W3A
 * notMeasuredEffortObservations 同形状。
 */
export function notMeasuredStoryboardEffortObservations(
  producedBlockCount: number,
  evidenceBindingCount: number,
): Readonly<Record<string, string | number | boolean>> {
  return {
    "computeEffort.measured": false,
    computeEffort: "not-measured (simulated)",
    "latencyMs.measured": false,
    latencyMs: "not-measured (simulated)",
    "costUnits.measured": false,
    costUnits: "not-measured (simulated)",
    domainBlocksProduced: producedBlockCount,
    evidenceBindingsProcessed: evidenceBindingCount,
    simulated: true,
  };
}

/** 组装终态 ReconstructionJobResult（completed/failed；诚实观察字段）。 */
export function buildStoryboardReconstructionResult(
  input: {
    readonly jobId: string;
    readonly status: "completed" | "failed";
    readonly producedDomainBlocks: readonly HtirDomainBlock[];
    readonly evidenceBindingCount: number;
    readonly failureReason?: string;
    readonly completedAt: string;
  },
): ReconstructionJobResult {
  const observations: Record<string, string | number | boolean> = {
    ...notMeasuredStoryboardEffortObservations(
      input.producedDomainBlocks.length,
      input.evidenceBindingCount,
    ),
  };
  if (input.status === "failed") {
    observations["failureReason"] = input.failureReason ?? "unspecified";
  }
  return {
    jobId: input.jobId,
    status: input.status,
    producedDomainBlocks: [...input.producedDomainBlocks],
    effortObservations: observations,
    completedAt: input.completedAt,
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// 缺陷补救请求剧本（W2 seam：reason / privacy / retention 平实显著）
// ---------------------------------------------------------------------------

export const TWIN_STORYBOARD_GEOMETRY_REMEDIATION_REASON =
  "Geometry-skeleton quality is 0.71 (below the 0.75 threshold). A targeted reference capture lets the deterministic reconstruction pipeline compute an improved geometry block — synthetic content only, no real biometric data.";

/** 默认补救原因（记录缺陷事实；与 W3A createRemediationEvidenceRequest 同语义）。 */
export function storyboardRemediationReason(
  deficiency: TwinDeficiency,
  twinVersionId: string,
): string {
  return `remediate twin deficiency ${deficiency.id} (class ${deficiency.deficiencyClass}, domain ${deficiency.domain}, severity ${deficiency.severity}) on twin version ${twinVersionId}`;
}

/** 组装「要什么、为什么、隐私与保留」平实可见的定向 EvidenceRequest（剧本形状）。 */
export function storyboardRemediationEvidenceRequest(
  deficiency: TwinDeficiency,
  twinVersionId: string,
): Omit<EvidenceRequest, "id"> {
  const isGeometry =
    deficiency.deficiencyClass === "geometric-error" && deficiency.domain === "geometry-skeleton";
  return {
    targetDeficiency: twinStoryboardDeficiencyKey(deficiency.deficiencyClass, deficiency.domain),
    evidenceType: "reference-image",
    preferredFraming: `synthetic framing targeting the "${deficiency.domain}" domain`,
    reason: isGeometry
      ? TWIN_STORYBOARD_GEOMETRY_REMEDIATION_REASON
      : storyboardRemediationReason(deficiency, twinVersionId),
    privacyRequirements:
      "Class: sensitive-media (fixture). Synthetic fixture content only — no real photos, no biometric data. Binding-time consent is enforced: no permission means no processing.",
    retention:
      "delete-after-review — content is deleted once a review outcome is accepted; immutable twin versions keep provenance only.",
    status: "requested",
  };
}

// ---------------------------------------------------------------------------
// 版本链语义（与 W3A TwinVersionChain 相同的不可变替换模型，剧本版）
// ---------------------------------------------------------------------------

export const TWIN_STORYBOARD_VERSION_TRANSITIONS: Readonly<
  Record<TwinVersion["status"], readonly TwinVersion["status"][]>
> = {
  candidate: ["canonical", "superseded"],
  canonical: ["superseded"],
  superseded: [],
};

export function isLegalStoryboardTwinVersionTransition(
  from: TwinVersion["status"],
  to: TwinVersion["status"],
): boolean {
  return TWIN_STORYBOARD_VERSION_TRANSITIONS[from].includes(to);
}
