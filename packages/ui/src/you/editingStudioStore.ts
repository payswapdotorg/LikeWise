// YOU Editing Studio — Editing 表面视图状态 store（W5B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：editing/interchange 的 canonical
// truth 属于 editing 应用服务（W5A）；本 store 只持有**投影/视图状态**（面板、选中
// session/subject/editor kind、op 草稿、导出草稿、demo 进度）。快照是服务端事实的
// 只读副本，由 useEditingStudio 写入。跟随 W1B/W2B/W3B/W4B 的本地模式
// （zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { EditingStudioSnapshot } from "./editingController.js";
import { clampSessionIndex } from "./editingStudioProjection.js";
import type { OpDraft } from "./editingOpDraftModel.js";
import { OP_DRAFT_EMPTY } from "./editingOpDraftModel.js";
import type { EditingDemoStepOutcome } from "./editingStudioDemo.js";

export type EditingPanelId =
  | "sessions"
  | "changesets"
  | "compare"
  | "editors"
  | "takeover"
  | "demo";

export type EditingSurfaceStatus = "idle" | "loading" | "ready" | "error";

/** 操作级 typed 错误（inline 呈现；YOU_EDIT_SESSION_NOT_FOUND / YOU_CHANGESET_INVALID /
 *  YOU_EDITOR_UNSUPPORTED / YOU_IMPORT_EXPORT_FAILED 等 code 驱动专属错误面板文案）。 */
export interface EditingActionError {
  /** YouErrorCode 字面（typed error panel 的分类键）；非 typed 错误为 "UNEXPECTED"。 */
  readonly code: string;
  readonly message: string;
}

export interface EditingDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly EditingDemoStepOutcome[];
}

/** 导出包的视图剪贴板（操作性值：字节仅存于视图层，记录/事件保持内容寻址）。 */
export interface EditingInterchangeClipboard {
  readonly resultId: string;
  readonly format: string;
  readonly packageBytes: Uint8Array;
  readonly packageDigest: string;
}

export interface EditingPaneState {
  readonly status: EditingSurfaceStatus;
  readonly errorMessage: string | null;
  readonly actionError: EditingActionError | null;
  readonly snapshot: EditingStudioSnapshot | null;
  readonly panel: EditingPanelId;
  /** 当前检视的 session id；null = 未选中（列表自动回退末位）。 */
  readonly selectedSessionId: string | null;
  /** session 列表键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly sessionIndex: number;
  /** subject 挑选（sessions 面板的编辑对象选择）。 */
  readonly selectedSubjectId: string | null;
  /** editor kind 挑选（orchestration 面板：native/embedded/external）。 */
  readonly selectedEditorKind: string | null;
  /** 变更集草稿（有序 op 列表 + 待追加 kind）。 */
  readonly opDraft: OpDraft;
  /** 提案目标 parent 版本 id（null = subject 根）。 */
  readonly parentVersionId: string | null;
  /** 导出草稿（format 选择）。 */
  readonly exportDraft: { readonly format: string | null };
  /** 最近一次导出的操作性值（包字节——导入 round-trip 的输入；UI 唯一持有处）。 */
  readonly lastExport: EditingInterchangeClipboard | null;
  /** 当前检视的变更集 id；null = 未选中（回退末位）。 */
  readonly selectedChangeSetId: string | null;
  /** 当前检视的候选 id；null = 未选中。 */
  readonly selectedCandidateId: string | null;
  readonly demo: EditingDemoState;
}

export interface EditingPaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: EditingStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级 typed 错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (error: EditingActionError) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: EditingStudioSnapshot) => void;
  setPanel: (panel: EditingPanelId) => void;
  selectSession: (sessionId: string | null) => void;
  setSessionIndex: (index: number) => void;
  moveSessionIndex: (delta: number) => void;
  selectSubject: (subjectId: string | null) => void;
  selectEditorKind: (editorKind: string | null) => void;
  replaceOpDraft: (draft: OpDraft) => void;
  setParentVersionId: (parentVersionId: string | null) => void;
  setExportDraftFormat: (format: string | null) => void;
  setLastExport: (clipboard: EditingInterchangeClipboard | null) => void;
  selectChangeSet: (changeSetId: string | null) => void;
  selectCandidate: (candidateId: string | null) => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: EditingDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type EditingPaneStore = EditingPaneState & EditingPaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type EditingPaneStoreApi = UseBoundStore<StoreApi<EditingPaneStore>>;

const INITIAL_DEMO_STATE: EditingDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

export const EDITING_PANE_INITIAL_STATE: EditingPaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "sessions",
  selectedSessionId: null,
  sessionIndex: 0,
  selectedSubjectId: null,
  selectedEditorKind: null,
  opDraft: OP_DRAFT_EMPTY,
  parentVersionId: null,
  exportDraft: { format: null },
  lastExport: null,
  selectedChangeSetId: null,
  selectedCandidateId: null,
  demo: INITIAL_DEMO_STATE,
};

export function createEditingPaneStore() {
  return create<EditingPaneStore>()((set) => ({
    ...EDITING_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 加载后默认检视最新 session（确定性：追加序末位）；subject 默认第一条。
        selectedSessionId: snapshot.sessions.at(-1)?.id ?? null,
        sessionIndex: Math.max(0, snapshot.sessions.length - 1),
        selectedSubjectId: snapshot.subjects[0]?.id ?? null,
        selectedEditorKind: snapshot.editorProfiles[0]?.editorKind ?? null,
        parentVersionId: snapshot.subjects[0]?.id ?? null,
        exportDraft: { format: snapshot.supportedFormats[0] ?? null },
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (error) =>
      set((state) => ({ ...state, actionError: error })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新保持「已选中对象仍存在」的语义；被清除的对象回退末位。
        const selectedSessionId = snapshot.sessions.some(
          (session) => session.id === state.selectedSessionId,
        )
          ? state.selectedSessionId
          : (snapshot.sessions.at(-1)?.id ?? null);
        const sessionIndex = snapshot.sessions.some(
          (session) => session.id === selectedSessionId,
        )
          ? Math.max(
              0,
              snapshot.sessions.findIndex(
                (session) => session.id === selectedSessionId,
              ),
            )
          : Math.max(0, snapshot.sessions.length - 1);
        const selectedSubjectId = snapshot.subjects.some(
          (subject) => subject.id === state.selectedSubjectId,
        )
          ? state.selectedSubjectId
          : (snapshot.subjects[0]?.id ?? null);
        const selectedEditorKind = snapshot.editorProfiles.some(
          (profile) => profile.editorKind === state.selectedEditorKind,
        )
          ? state.selectedEditorKind
          : (snapshot.editorProfiles[0]?.editorKind ?? null);
        const selectedChangeSetId = snapshot.changeSets.some(
          (changeSet) => changeSet.id === state.selectedChangeSetId,
        )
          ? state.selectedChangeSetId
          : (snapshot.changeSets.at(-1)?.id ?? null);
        const selectedCandidateId = snapshot.candidates.some(
          (candidate) => candidate.id === state.selectedCandidateId,
        )
          ? state.selectedCandidateId
          : (snapshot.candidates.at(-1)?.id ?? null);
        return {
          ...state,
          snapshot,
          selectedSessionId,
          sessionIndex,
          selectedSubjectId,
          selectedEditorKind,
          selectedChangeSetId,
          selectedCandidateId,
        };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    selectSession: (sessionId) =>
      set((state) => ({
        ...state,
        selectedSessionId: sessionId,
        sessionIndex:
          sessionId === null
            ? 0
            : Math.max(
                0,
                state.snapshot?.sessions.findIndex(
                  (session) => session.id === sessionId,
                ) ?? 0,
              ),
      })),
    setSessionIndex: (index) =>
      set((state) => ({
        ...state,
        sessionIndex: Math.max(0, index),
        // 光标移动即检视（键盘导航 = 一等交互路径）。
        selectedSessionId:
          state.snapshot?.sessions[Math.max(0, index)]?.id ?? null,
      })),
    moveSessionIndex: (delta) =>
      set((state) => {
        const total = state.snapshot?.sessions.length ?? 0;
        const nextIndex = clampSessionIndex(state.sessionIndex + delta, total);
        return {
          ...state,
          sessionIndex: nextIndex,
          selectedSessionId:
            state.snapshot?.sessions[nextIndex]?.id ?? null,
        };
      }),

    selectSubject: (subjectId) =>
      set((state) => ({
        ...state,
        selectedSubjectId: subjectId,
        // 换 subject 同步换提案目标 parent（subject 根）。
        parentVersionId: subjectId,
      })),
    selectEditorKind: (editorKind) =>
      set((state) => ({ ...state, selectedEditorKind: editorKind })),
    replaceOpDraft: (draft) => set((state) => ({ ...state, opDraft: draft })),
    setParentVersionId: (parentVersionId) =>
      set((state) => ({ ...state, parentVersionId })),
    setExportDraftFormat: (format) =>
      set((state) => ({ ...state, exportDraft: { format } })),
    setLastExport: (clipboard) =>
      set((state) => ({ ...state, lastExport: clipboard })),
    selectChangeSet: (changeSetId) =>
      set((state) => ({ ...state, selectedChangeSetId: changeSetId })),
    selectCandidate: (candidateId) =>
      set((state) => ({ ...state, selectedCandidateId: candidateId })),

    demoStarted: () =>
      set((state) => ({
        ...state,
        demo: { active: true, stepIndex: 0, finished: false, outcomes: [] },
      })),
    demoStepRecorded: (outcome) =>
      set((state) => ({
        ...state,
        demo: {
          ...state.demo,
          stepIndex: state.demo.stepIndex + 1,
          outcomes: [...state.demo.outcomes, outcome],
        },
      })),
    demoFinished: () =>
      set((state) => ({
        ...state,
        demo: { ...state.demo, active: false, finished: true },
      })),
    demoReset: () => set((state) => ({ ...state, demo: INITIAL_DEMO_STATE })),
  }));
}

/**
 * 默认全局 store：单 workspace 壳的便捷入口（与 solutionStore 单例模式一致）。
 * 多 workspace 分屏由 editingStudioRegistry 提供 per-workspace 实例。
 */
export const useEditingPaneStore = createEditingPaneStore();
