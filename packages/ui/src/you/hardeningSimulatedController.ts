/* oxlint-disable eslint(max-lines) -- 模拟控制器按 HardeningStudioController 端口逐方法实现（Phase-0 剧本状态机：rate-limit 窗口配额（enforce BEFORE effect + append-only enforcement 记录 + deny/defer/shed 全落账）+ import 扫描 intake（fail-closed）与显式 release + retention-vs-consent（active consent 拒绝）+ DR restore 哈希前置校验 + eligibility 决定门（matrix-gated + rollback-evidence-required）与 reversal 新记录）；T10 换绑 Worker A/C 的 hardening 服务后本文件整体退役，拆分只会增加退役成本。 */
// YOU Hardening Studio — 确定性模拟控制器（W10B，Phase 0）。
//
// 这是 `HardeningStudioController` 端口的确定性剧本实现（W10A 的 platform
// hardening 服务与 W10C 的 ecosystem hardening 服务在并行 wave 合入；本实现只到
// T10 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自
//   StoryboardClock（统一经 tick() 包装——消费计数使快照 projectedAt 锚定确定性，
//   绝不 Date.now）；
// - RATE LIMIT LAW：limits enforce BEFORE the effect（耗尽判定先行，效果不发生）；
//   每次 enforcement append 不可变记录；throttling 绝不静默（deny/defer/shed 皆
//   以 YOU_RATE_LIMIT_EXCEEDED typed 拒绝并携带 window 与 retry 指引）；
// - IMPORT SECURITY LAW：unscanned imports never enter evidence（未注册
//   artifact / scan class ⇒ typed 拒绝）；quarantine fail-closed 且仅经显式
//   release record 可逆（clean / rejected / 已放行 / 未知 id 皆 typed 拒绝）；
// - RETENTION LAW：enforcement 记录不可变可审计；retention class 绝不覆盖
//   active consent（granted subject ⇒ typed 拒绝——wave-2 consent 法律保持）；
// - DR LAW：restore 在 activation 前校验 content hash（corrupted ⇒ typed 拒绝，
//   绝不 activation）；verified flag 绝不在无 check evidence 时断言（记录携带
//   verified: true 时事件必带 checkHash）；
// - ECOSYSTEM GATE LAW（声明侧镜像）：release-readiness 决定的 subject 经
//   provider matrix 注册面引用；unknown matrix ref ⇒ typed
//   YOU_PROVIDER_MATRIX_INVALID；
// - PRODUCTION ELIGIBILITY LAW：eligibility requires rollback evidence（eligible
//   决定必须携带 present 证据）；决定不可变；reversal 是新账本记录
//   （kind/supersedes 链接——frozen 形状不动）；
// - 未知 policy ⇒ YOU_INVALID_STATE（frozen v10 词汇无 policy-not-found 专属
//   code——generic invalid-state 携带 reason，与 W9B 同款披露）；
// - 事件词汇（frozen additive wave-10）：rate-limit-enforced /
//   import-quarantined / retention-enforced / dr-restore-recorded /
//   production-eligibility-decided（reversal 带 reversal 标记）+
//   solution-created。frozen 词汇无 import-released / rate-limit-allowed /
//   import-clean 类型——release 与放行是 durable 记录（不伪造事件，与 W9B
//   lab-experiment-declared 无事件类型同款披露）。
import type {
  DrRestoreRecord,
  ImportSecurityVerdict,
  OpaqueId,
  ProductionEligibilityRecord,
  RateLimitPolicy,
  RetentionEnforcementRecord,
  SolutionEvent,
  SolutionEventType,
  YouError,
} from "@zcode/shared";
import {
  HardeningStudioError,
  type DecideEligibilityInput,
  type DrRestoreView,
  type EligibilityEntry,
  type EnforceRateLimitInput,
  type EnforceRetentionInput,
  type HardeningStudioController,
  type HardeningStudioLoadRequest,
  type HardeningStudioSnapshot,
  type ImportReleaseRecordView,
  type ImportVerdictView,
  type RateLimitAttemptResult,
  type ReleaseQuarantinedImportInput,
  type ReverseEligibilityInput,
  type RunDrRestoreInput,
  type ScanImportInput,
} from "./hardeningController.js";
import { eligibilityIsReversed } from "./hardeningController.js";
import { StoryboardClock } from "./solutionStoryboard.js";
import {
  storyboardDrCorruptedHash,
  storyboardDrHashMatches,
  storyboardRateLimitExceeded,
  storyboardRateWindowExpired,
  storyboardRetryAfterS,
  storyboardSubjectConsentProtected,
} from "./hardeningStoryboardLaws.js";
import {
  HARDENING_STORYBOARD_CONSENT_STATES,
  HARDENING_STORYBOARD_DISPLAY_NAME,
  HARDENING_STORYBOARD_DR_INTEGRITIES,
  HARDENING_STORYBOARD_DR_SNAPSHOTS,
  HARDENING_STORYBOARD_IMPORT_ARTIFACTS,
  HARDENING_STORYBOARD_IMPORT_SCAN_CLASSES,
  HARDENING_STORYBOARD_IMPORT_VERDICTS,
  HARDENING_STORYBOARD_MATRIX_ENTRIES,
  HARDENING_STORYBOARD_RATE_LIMIT_ACTIONS,
  HARDENING_STORYBOARD_RATE_LIMIT_POLICIES,
  HARDENING_STORYBOARD_RETENTION_CLASSES,
  HARDENING_STORYBOARD_RETENTION_SUBJECTS,
  HARDENING_STORYBOARD_ROLLBACK_EVIDENCE,
  HARDENING_STORYBOARD_SOLUTION_ID,
  compareHardeningStoryboardId,
  hardeningContentBinding,
  storyboardDrSnapshotById,
  storyboardDrSnapshotHash,
  storyboardImportArtifactById,
  storyboardImportScanClassById,
  storyboardImportVerdictOfFinding,
  storyboardMatrixEntryById,
  storyboardRetentionClassById,
  storyboardRetentionSubjectById,
  storyboardRollbackEvidenceById,
} from "./hardeningStoryboard.js";

/** 一个 policy 的窗口运行时状态（确定性：以 tick 计数，绝不 Date.now）。 */
interface PolicyWindowState {
  windowOpenedAtTick: number | null;
  consumedInWindow: number;
}

interface SimulatedHardeningState {
  readonly studioId: OpaqueId;
  readonly displayName: string;
  /** policy 运行时窗口（按 policyId；append-only 记录在 enforcements）。 */
  policyWindows: Map<string, PolicyWindowState>;
  enforcements: import("./hardeningController.js").HardeningEnforcementRecordView[];
  importVerdicts: ImportSecurityVerdict[];
  importReleases: ImportReleaseRecordView[];
  retentionRecords: RetentionEnforcementRecord[];
  drRestores: DrRestoreRecord[];
  /** restoreId → 校验证据哈希（check evidence——verified flag 的依据）。 */
  drCheckHashes: Map<string, string>;
  eligibilityLedger: EligibilityEntry[];
  events: SolutionEvent[];
}

/** 与 solutionStoryboard.ts 私有纪元一致的镜像字面量（时钟锚）。 */
const STORYBOARD_EPOCH_MS = Date.UTC(2025, 5, 2, 9, 0, 0, 0);

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): HardeningStudioError {
  return new HardeningStudioError({ code, message, details, simulated: true });
}

function invalidState(
  reason: string,
  message: string,
  details: Record<string, string | number | boolean> = {},
): HardeningStudioError {
  return youError("YOU_INVALID_STATE", message, { reason, ...details });
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 hardeningStudioRegistry）；
 * `load` 幂等：状态存在即复用（hardening 平面是持久 workspace 表面）。
 */
export function createSimulatedHardeningStudioController(): HardeningStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let consumedTicks = 0;
  let state: SimulatedHardeningState | null = null;

  const nextId = (prefix: string): string => {
    idSeq += 1;
    return `${prefix}-${String(idSeq).padStart(3, "0")}`;
  };

  /** 全部时间戳统一入口（消费计数 → projectedAt 锚定确定性）。 */
  const tick = (): string => {
    consumedTicks += 1;
    return clock.next();
  };

  /** 确定性「当前时刻」＝下一次 tick 的值（纪元 + 已消费 tick 秒；非 Date.now）。 */
  const clockNow = (): string =>
    new Date(STORYBOARD_EPOCH_MS + consumedTicks * 1000).toISOString();

  const appendEvent = (
    type: SolutionEventType,
    subjectRef: OpaqueId | null,
    payload: Record<string, string | number | boolean>,
    generator: "agent" | "user" | "fixture" = "agent",
  ): void => {
    if (!state) return;
    state.events = [
      ...state.events,
      {
        id: nextId("fx-h-event"),
        solutionId: HARDENING_STORYBOARD_SOLUTION_ID,
        type,
        occurredAt: tick(),
        subjectRef,
        payload,
        provenance: {
          source: "you-phase0-hardening-storyboard",
          generator,
          createdAt: tick(),
          lineage: [],
        },
      },
    ];
  };

  // -------------------------------------------------------------------------
  // 注册面解析（未知 id ⇒ 诚实 typed 拒绝，绝不猜测补全）
  // -------------------------------------------------------------------------

  const requirePolicy = (policyId: string) => {
    const policy = HARDENING_STORYBOARD_RATE_LIMIT_POLICIES.find(
      (candidate) => candidate.id === policyId,
    );
    if (!policy) {
      throw invalidState(
        "unknown-rate-limit-policy",
        `rate limit policy ${policyId} not found`,
        { policyId },
      );
    }
    return policy;
  };

  const requireImportVerdict = (verdictId: OpaqueId): ImportSecurityVerdict => {
    if (!state) throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
    const verdict = state.importVerdicts.find(
      (candidate) => candidate.id === verdictId,
    );
    if (!verdict) {
      throw youError(
        "YOU_IMPORT_QUARANTINED",
        `import verdict ${verdictId} not found`,
        { reason: "unknown-verdict", verdictId },
      );
    }
    return verdict;
  };

  const releaseOfVerdict = (
    verdictId: OpaqueId,
  ): ImportReleaseRecordView | null => {
    if (!state) return null;
    return (
      state.importReleases.find((entry) => entry.verdictId === verdictId) ?? null
    );
  };

  const verdictViewOf = (verdict: ImportSecurityVerdict): ImportVerdictView => {
    const release = releaseOfVerdict(verdict.id);
    return {
      verdict: { ...verdict },
      releaseRecordId: release?.id ?? null,
      releasedAt: release?.releasedAt ?? null,
    };
  };

  const drViewOf = (record: DrRestoreRecord): DrRestoreView => {
    if (!state) throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
    const checkHash = state.drCheckHashes.get(record.id) ?? null;
    // DR LAW 显示面：verified 仅在 check evidence 存在时呈现（flag 无证据 →
    // unverified——防御显示，绝不把无证据的 flag 当 verified 展示）。
    const verification: DrRestoreView["verification"] =
      record.verified && checkHash !== null ? "verified" : "unverified";
    return { record: { ...record }, verification, checkHash };
  };

  // -------------------------------------------------------------------------
  // 快照
  // -------------------------------------------------------------------------

  const snapshot = (): HardeningStudioSnapshot => {
    if (!state) throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
    const policies: readonly RateLimitPolicy[] = HARDENING_STORYBOARD_RATE_LIMIT_POLICIES.map(
      (policy) => ({
        id: policy.id,
        scope: policy.scope,
        windowS: policy.windowS,
        burst: policy.burst,
        action: policy.action,
        simulated: true,
      }),
    );
    const scanClasses =
      HARDENING_STORYBOARD_IMPORT_SCAN_CLASSES.map((entry) => ({
        id: entry.id,
        scanClass: entry.scanClass,
        valid: entry.valid,
      }));
    const importArtifacts = HARDENING_STORYBOARD_IMPORT_ARTIFACTS.map((entry) => ({
      id: entry.id,
      artifactRef: hardeningContentBinding(`import:${entry.artifactKey}`).contentRef,
      artifactKey: entry.artifactKey,
    }));
    const retentionClasses = HARDENING_STORYBOARD_RETENTION_CLASSES.map((entry) => ({
      id: entry.id,
      retentionClass: entry.retentionClass,
      windowLabel: entry.windowLabel,
    }));
    const retentionSubjects = HARDENING_STORYBOARD_RETENTION_SUBJECTS.map((entry) => ({
      id: entry.id,
      subjectRef: hardeningContentBinding(`subject:${entry.subjectKey}`).contentRef,
      consentState: entry.consentState,
      consentProtected: storyboardSubjectConsentProtected(entry.consentState),
    }));
    const drSnapshots = HARDENING_STORYBOARD_DR_SNAPSHOTS.map((entry) => ({
      id: entry.id,
      snapshotRef: hardeningContentBinding(`dr:${entry.snapshotKey}`).contentRef,
      expectedHash: storyboardDrSnapshotHash(entry.snapshotKey),
    }));
    const matrixEntries = HARDENING_STORYBOARD_MATRIX_ENTRIES.map((entry) => ({
      id: entry.id,
      matrixRef: entry.matrixRef,
      providerKind: entry.providerKind,
      region: entry.region,
      capabilityClasses: [...entry.capabilityClasses],
      eligible: entry.eligible,
      valid: entry.valid,
    }));
    const rollbackEvidence = HARDENING_STORYBOARD_ROLLBACK_EVIDENCE.map((entry) => ({
      id: entry.id,
      evidenceRef: hardeningContentBinding(`rollback:${entry.evidenceKey}`).contentRef,
      present: entry.present,
    }));
    const importVerdictRecords = [...state.importVerdicts]
      .sort((a, b) => compareHardeningStoryboardId(a.id, b.id))
      .map((verdict) => verdictViewOf(verdict));
    return {
      displayName: state.displayName,
      studioId: state.studioId,
      rateLimitActions: [...HARDENING_STORYBOARD_RATE_LIMIT_ACTIONS],
      importVerdicts: [
        ...HARDENING_STORYBOARD_IMPORT_VERDICTS,
      ] as readonly ("clean" | "quarantined" | "rejected")[],
      consentStates: [...HARDENING_STORYBOARD_CONSENT_STATES],
      policies,
      scanClasses,
      importArtifacts,
      retentionClasses,
      retentionSubjects,
      drSnapshots,
      drIntegrities: [...HARDENING_STORYBOARD_DR_INTEGRITIES],
      matrixEntries,
      rollbackEvidence,
      enforcements: state.enforcements.map((entry) => ({ ...entry })),
      importVerdictRecords,
      importReleases: state.importReleases.map((entry) => ({ ...entry })),
      retentionRecords: [...state.retentionRecords]
        .sort((a, b) => compareHardeningStoryboardId(a.id, b.id))
        .map((entry) => ({ ...entry })),
      drRestores: [...state.drRestores]
        .sort((a, b) => compareHardeningStoryboardId(a.id, b.id))
        .map((entry) => drViewOf(entry)),
      eligibilityLedger: state.eligibilityLedger.map((entry) => ({
        record: { ...entry.record },
        kind: entry.kind,
        supersedesRecordId: entry.supersedesRecordId,
      })),
      events: state.events,
      projectedAt: clockNow(),
      simulated: true,
    };
  };

  const bootstrap = (request: HardeningStudioLoadRequest): void => {
    state = {
      studioId: "fx-hardening-studio-001",
      displayName: HARDENING_STORYBOARD_DISPLAY_NAME,
      policyWindows: new Map(),
      enforcements: [],
      importVerdicts: [],
      importReleases: [],
      retentionRecords: [],
      drRestores: [],
      drCheckHashes: new Map(),
      eligibilityLedger: [],
      events: [],
    };
    for (const policy of HARDENING_STORYBOARD_RATE_LIMIT_POLICIES) {
      state.policyWindows.set(policy.id, {
        windowOpenedAtTick: null,
        consumedInWindow: 0,
      });
    }
    appendEvent("solution-created", state.studioId, {
      surface: "hardening-studio",
      workspaceKey: request.workspaceKey,
      studioId: state.studioId,
      rateLimitActionCount: HARDENING_STORYBOARD_RATE_LIMIT_ACTIONS.length,
      importVerdictCount: HARDENING_STORYBOARD_IMPORT_VERDICTS.length,
      policyCount: HARDENING_STORYBOARD_RATE_LIMIT_POLICIES.length,
      matrixEntryCount: HARDENING_STORYBOARD_MATRIX_ENTRIES.length,
      simulated: true,
    });
  };

  // -------------------------------------------------------------------------
  // Rate-limit 窗口推进（RATE LIMIT LAW：enforce BEFORE effect——窗口数学内联在
  // enforceRateLimit：滚动/耗尽判定先行，效果不发生）
  // -------------------------------------------------------------------------

  const controller: HardeningStudioController = {
    backing: "fixture-simulated",

    async load(request: HardeningStudioLoadRequest): Promise<HardeningStudioSnapshot> {
      if (!state) {
        bootstrap(request);
      }
      return snapshot();
    },

    async refresh(): Promise<HardeningStudioSnapshot> {
      if (!state) {
        throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
      }
      return snapshot();
    },

    async enforceRateLimit(
      input: EnforceRateLimitInput,
    ): Promise<RateLimitAttemptResult> {
      if (!state) throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
      const policy = requirePolicy(input.policyId);
      const window = state.policyWindows.get(policy.id);
      if (!window) {
        throw invalidState("unknown-rate-limit-policy", `policy ${policy.id} has no window state`);
      }
      // 窗口滚动：窗口未开或已过期 ⇒ 以当前 tick 开新窗（确定性——tick 计数）。
      if (
        window.windowOpenedAtTick === null ||
        storyboardRateWindowExpired(
          window.windowOpenedAtTick,
          policy.windowS,
          consumedTicks,
        )
      ) {
        window.windowOpenedAtTick = consumedTicks;
        window.consumedInWindow = 0;
      }
      // enforce BEFORE effect：配额耗尽 ⇒ 记录 + typed 拒绝（效果不发生）。
      if (storyboardRateLimitExceeded(window.consumedInWindow, policy.burst)) {
        const retryAfterS = storyboardRetryAfterS(
          window.windowOpenedAtTick,
          policy.windowS,
          consumedTicks,
        );
        const enforcement = {
          id: nextId("fx-h-enf"),
          policyId: policy.id,
          scope: policy.scope,
          action: policy.action,
          windowS: policy.windowS,
          burst: policy.burst,
          retryAfterS,
          enforcedAt: clockNow(),
          simulated: true,
        };
        state.enforcements = [...state.enforcements, enforcement];
        appendEvent("rate-limit-enforced", enforcement.id, {
          enforcementId: enforcement.id,
          policyId: policy.id,
          scope: policy.scope,
          action: policy.action,
          windowS: policy.windowS,
          burst: policy.burst,
          retryAfterS,
          simulated: true,
        });
        throw youError(
          "YOU_RATE_LIMIT_EXCEEDED",
          `rate limit exceeded on ${policy.scope}: ${policy.action} window ${policy.windowS}s (burst ${policy.burst}) — retry after ${retryAfterS}s`,
          {
            reason: `window-exhausted-${policy.action}`,
            policyId: policy.id,
            scope: policy.scope,
            action: policy.action,
            windowS: policy.windowS,
            burst: policy.burst,
            retryAfterS,
            enforcementId: enforcement.id,
          },
        );
      }
      window.consumedInWindow += 1;
      return {
        allowed: true,
        policyId: policy.id,
        scope: policy.scope,
        action: policy.action,
        windowS: policy.windowS,
        remaining: policy.burst - window.consumedInWindow,
        enforcementId: null,
      };
    },

    async scanImport(input: ScanImportInput): Promise<ImportVerdictView> {
      if (!state) throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
      const artifact = storyboardImportArtifactById(input.artifactId);
      if (!artifact) {
        throw youError(
          "YOU_IMPORT_QUARANTINED",
          `import artifact ${input.artifactId} not found — unscanned imports never enter evidence`,
          { reason: "unknown-artifact", artifactId: input.artifactId },
        );
      }
      const scanClass = storyboardImportScanClassById(input.scanClassId);
      if (!scanClass || !scanClass.valid) {
        throw youError(
          "YOU_IMPORT_QUARANTINED",
          `import scan class ${input.scanClassId} is not registered — fail closed (unscanned imports never enter evidence)`,
          {
            reason: "unregistered-scan-class",
            scanClassId: input.scanClassId,
            artifactId: input.artifactId,
          },
        );
      }
      const verdict = storyboardImportVerdictOfFinding(artifact.finding);
      const at = clockNow();
      const record: ImportSecurityVerdict = {
        id: nextId("fx-h-verdict"),
        artifactRef: hardeningContentBinding(`import:${artifact.artifactKey}`).contentRef,
        scanClass: scanClass.scanClass,
        verdict,
        quarantinedAt: verdict === "quarantined" ? at : null,
        simulated: true,
      };
      state.importVerdicts = [...state.importVerdicts, record];
      if (verdict === "quarantined") {
        // frozen v10 词汇仅携带 import-quarantined——clean/rejected 是 durable
        // 记录（无事件，披露）。
        appendEvent("import-quarantined", record.id, {
          verdictId: record.id,
          artifactRef: record.artifactRef,
          scanClass: record.scanClass,
          finding: artifact.finding,
          quarantinedAt: at,
          simulated: true,
        });
      }
      return verdictViewOf(record);
    },

    async releaseQuarantinedImport(
      input: ReleaseQuarantinedImportInput,
    ): Promise<ImportVerdictView> {
      if (!state) throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
      const verdict = requireImportVerdict(input.verdictId);
      if (verdict.verdict !== "quarantined") {
        throw youError(
          "YOU_IMPORT_QUARANTINED",
          `import verdict ${verdict.id} is ${verdict.verdict}, not quarantined — only a quarantined verdict can be released`,
          { reason: "verdict-not-quarantined", verdictId: verdict.id, verdict: verdict.verdict },
        );
      }
      if (releaseOfVerdict(verdict.id)) {
        throw youError(
          "YOU_IMPORT_QUARANTINED",
          `import verdict ${verdict.id} is already released — quarantine reverses only once through an explicit release record`,
          { reason: "already-released", verdictId: verdict.id },
        );
      }
      const release: ImportReleaseRecordView = {
        id: nextId("fx-h-release"),
        verdictId: verdict.id,
        artifactRef: verdict.artifactRef,
        releasedAt: clockNow(),
        simulated: true,
      };
      state.importReleases = [...state.importReleases, release];
      return verdictViewOf(verdict);
    },

    async enforceRetention(
      input: EnforceRetentionInput,
    ): Promise<RetentionEnforcementRecord> {
      if (!state) throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
      const subject = storyboardRetentionSubjectById(input.subjectId);
      if (!subject) {
        throw youError(
          "YOU_RETENTION_ENFORCEMENT_INVALID",
          `retention subject ${input.subjectId} not found`,
          { reason: "unknown-subject", subjectId: input.subjectId },
        );
      }
      const retentionClass = storyboardRetentionClassById(input.retentionClassId);
      if (!retentionClass) {
        throw youError(
          "YOU_RETENTION_ENFORCEMENT_INVALID",
          `retention class ${input.retentionClassId} not found`,
          { reason: "unknown-retention-class", retentionClassId: input.retentionClassId },
        );
      }
      const subjectRef = hardeningContentBinding(`subject:${subject.subjectKey}`).contentRef;
      // RETENTION LAW：retention class 绝不覆盖 active consent（granted = 受保护）。
      if (storyboardSubjectConsentProtected(subject.consentState)) {
        throw youError(
          "YOU_RETENTION_ENFORCEMENT_INVALID",
          `retention enforcement on ${subjectRef} refused: the subject is protected by an active consent (${subject.consentState}) — a retention class never overrides an active consent`,
          {
            reason: "consent-protected-subject",
            subjectRef,
            consentState: subject.consentState,
            retentionClass: retentionClass.retentionClass,
          },
        );
      }
      const record: RetentionEnforcementRecord = {
        id: nextId("fx-h-retention"),
        retentionClass: retentionClass.retentionClass,
        subjectRef,
        enforcedAt: clockNow(),
        simulated: true,
      };
      state.retentionRecords = [...state.retentionRecords, record];
      appendEvent("retention-enforced", record.id, {
        recordId: record.id,
        retentionClass: record.retentionClass,
        subjectRef: record.subjectRef,
        consentState: subject.consentState,
        enforcedAt: record.enforcedAt,
        simulated: true,
      });
      return { ...record };
    },

    async runDrRestore(input: RunDrRestoreInput): Promise<DrRestoreView> {
      if (!state) throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
      const snapshotPreset = storyboardDrSnapshotById(input.snapshotId);
      if (!snapshotPreset) {
        throw youError(
          "YOU_DR_RESTORE_INVALID",
          `DR snapshot ${input.snapshotId} not found`,
          { reason: "unknown-snapshot", snapshotId: input.snapshotId },
        );
      }
      const expectedHash = storyboardDrSnapshotHash(snapshotPreset.snapshotKey);
      const observedHash =
        input.integrity === "honest"
          ? expectedHash
          : storyboardDrCorruptedHash(snapshotPreset.snapshotKey);
      // DR LAW：activation 前校验 content hash——mismatch ⇒ typed 拒绝（无记录、
      // 无 activation——fail closed）。
      if (!storyboardDrHashMatches(snapshotPreset.snapshotKey, observedHash)) {
        throw youError(
          "YOU_DR_RESTORE_INVALID",
          `DR restore of ${snapshotPreset.snapshotKey} refused: content hash mismatch before activation (expected ${expectedHash}, observed ${observedHash})`,
          {
            reason: "hash-mismatch-before-activation",
            snapshotKey: snapshotPreset.snapshotKey,
            expected: expectedHash,
            observed: observedHash,
          },
        );
      }
      const record: DrRestoreRecord = {
        id: nextId("fx-h-restore"),
        snapshotRef: hardeningContentBinding(`dr:${snapshotPreset.snapshotKey}`).contentRef,
        restoredAt: clockNow(),
        verified: true,
        simulated: true,
      };
      state.drRestores = [...state.drRestores, record];
      state.drCheckHashes.set(record.id, observedHash);
      // verified flag 的 check evidence（事件携带 checkHash——无证据绝不显示
      // verified）。
      appendEvent("dr-restore-recorded", record.id, {
        restoreId: record.id,
        snapshotRef: record.snapshotRef,
        checkHash: observedHash,
        verified: true,
        restoredAt: record.restoredAt,
        simulated: true,
      });
      return drViewOf(record);
    },

    async decideEligibility(input: DecideEligibilityInput): Promise<EligibilityEntry> {
      if (!state) throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
      // ECOSYSTEM GATE LAW（声明侧镜像）：subject 经 provider matrix 注册面引用。
      const matrixEntry = storyboardMatrixEntryById(input.matrixEntryId);
      if (!matrixEntry || !matrixEntry.valid) {
        throw youError(
          "YOU_PROVIDER_MATRIX_INVALID",
          `provider matrix entry ${input.matrixEntryId} is unknown — every ecosystem addition enters through the ProviderMatrix (fail closed)`,
          {
            reason: "unknown-provider-matrix-ref",
            matrixEntryId: input.matrixEntryId,
          },
        );
      }
      const evidence = storyboardRollbackEvidenceById(input.rollbackEvidenceId);
      if (input.eligible && !evidence) {
        throw youError(
          "YOU_PRODUCTION_ELIGIBILITY_INVALID",
          `rollback evidence ${input.rollbackEvidenceId} not found`,
          {
            reason: "unknown-rollback-evidence",
            rollbackEvidenceId: input.rollbackEvidenceId,
          },
        );
      }
      // PRODUCTION ELIGIBILITY LAW：eligibility requires rollback evidence。
      if (input.eligible && evidence && !evidence.present) {
        throw youError(
          "YOU_PRODUCTION_ELIGIBILITY_INVALID",
          `production eligibility for ${matrixEntry.matrixRef} refused: eligibility requires rollback evidence (preset ${input.rollbackEvidenceId} carries no drill)`,
          {
            reason: "missing-rollback-evidence",
            matrixEntryId: input.matrixEntryId,
            rollbackEvidenceId: input.rollbackEvidenceId,
          },
        );
      }
      const record: ProductionEligibilityRecord = {
        id: nextId("fx-h-eligibility"),
        subjectRef: matrixEntry.matrixRef,
        eligible: input.eligible,
        rollbackEvidenceRef: evidence
          ? hardeningContentBinding(`rollback:${evidence.evidenceKey}`).contentRef
          : "fx-rollback-none",
        decidedAt: clockNow(),
        simulated: true,
      };
      const entry: EligibilityEntry = {
        record,
        kind: "decision",
        supersedesRecordId: null,
      };
      state.eligibilityLedger = [...state.eligibilityLedger, entry];
      appendEvent("production-eligibility-decided", record.id, {
        recordId: record.id,
        subjectRef: record.subjectRef,
        eligible: record.eligible,
        rollbackEvidenceRef: record.rollbackEvidenceRef,
        kind: "decision",
        supersedes: "",
        decidedAt: record.decidedAt,
        simulated: true,
      });
      return { record: { ...record }, kind: entry.kind, supersedesRecordId: null };
    },

    async reverseEligibility(input: ReverseEligibilityInput): Promise<EligibilityEntry> {
      if (!state) throw invalidState("hardening-not-loaded", "hardening studio is not loaded");
      const entry = state.eligibilityLedger.find(
        (candidate) => candidate.record.id === input.recordId,
      );
      if (!entry) {
        throw youError(
          "YOU_PRODUCTION_ELIGIBILITY_INVALID",
          `production eligibility record ${input.recordId} not found`,
          { reason: "unknown-eligibility-record", recordId: input.recordId },
        );
      }
      if (eligibilityIsReversed(snapshot(), input.recordId)) {
        throw youError(
          "YOU_PRODUCTION_ELIGIBILITY_INVALID",
          `production eligibility record ${input.recordId} is already reversed — a reversal is a new record, never a mutation of a reversal`,
          { reason: "already-reversed", recordId: input.recordId },
        );
      }
      // reversal 是新记录（eligible 反转；回滚证据引用沿用被反转记录的引用——
      // frozen 形状要求 rollbackEvidenceRef 非 null 的披露语义）。
      const record: ProductionEligibilityRecord = {
        id: nextId("fx-h-eligibility"),
        subjectRef: entry.record.subjectRef,
        eligible: !entry.record.eligible,
        rollbackEvidenceRef: entry.record.rollbackEvidenceRef,
        decidedAt: clockNow(),
        simulated: true,
      };
      const reversal: EligibilityEntry = {
        record,
        kind: "reversal",
        supersedesRecordId: entry.record.id,
      };
      state.eligibilityLedger = [...state.eligibilityLedger, reversal];
      appendEvent("production-eligibility-decided", record.id, {
        recordId: record.id,
        subjectRef: record.subjectRef,
        eligible: record.eligible,
        rollbackEvidenceRef: record.rollbackEvidenceRef,
        kind: "reversal",
        supersedes: entry.record.id,
        decidedAt: record.decidedAt,
        simulated: true,
      });
      return {
        record: { ...record },
        kind: reversal.kind,
        supersedesRecordId: entry.record.id,
      };
    },
  };

  return controller;
}
