// YOU Avatar Studio — demo 步骤文案（W7B）。
//
// 纯数据模块（无 `@/` 别名、无 React 依赖），被 avatarMessages.ts 合并进
// en-US / zh-CN 文案表（与 W6B learningDemoStepMessages.ts 同款结构）。

export const AVATAR_DEMO_STEP_MESSAGES_EN_US: Record<string, string> = {
  "you.avatar.demo.step.load.title": "Load the avatar plane",
  "you.avatar.demo.step.load.description":
    "The avatar studio loads its registries from the controller projection: bodies and soul bindings are read-only fixtures of the embodiment plane; the UI owns none of them.",
  "you.avatar.demo.step.body-pick.title": "Pick a Body",
  "you.avatar.demo.step.body-pick.description":
    "The Body picker renders role, capabilities and tools straight from the registry projection; the appearance stays content-addressed (appearanceRef + appearanceHash labels only).",
  "you.avatar.demo.step.soul-pick.title": "Pick a Soul",
  "you.avatar.demo.step.soul-pick.description":
    "The Soul picker renders providerKind, modelRef and the routing profile (system-one / system-two are ROUTING PROFILES, not fixed model identities).",
  "you.avatar.demo.step.soul-intake-invalid.title": "Refused soul intake",
  "you.avatar.demo.step.soul-intake-invalid.description":
    "Registering a soul binding with an off-ladder routing profile is a typed YOU_SOUL_BINDING_INVALID refusal — the stateless validator fires first and nothing is journaled.",
  "you.avatar.demo.step.body-intake-invalid.title": "Refused body intake",
  "you.avatar.demo.step.body-intake-invalid.description":
    "Registering a body with an empty role is a typed YOU_INVALID_STATE refusal (role-empty) — the body registry never silently repairs an intake.",
  "you.avatar.demo.step.body-not-found.title": "Unknown Body refused",
  "you.avatar.demo.step.body-not-found.description":
    "Opening a session with an unknown body id is a typed YOU_BODY_NOT_FOUND refusal; bodies are addressed by their immutable registry ids, never guessed.",
  "you.avatar.demo.step.session-open.title": "Open an avatar session",
  "you.avatar.demo.step.session-open.description":
    "A Body possessed by a Soul: the session opens active at the idle rung, two realtime channels are derived deterministically, and avatar-session-opened is appended.",
  "you.avatar.demo.step.ladder-walk.title": "Walk the ladder",
  "you.avatar.demo.step.ladder-walk.description":
    "Activity transitions (listening, typing, tool_use) each append an embodiment-state-changed event; the rungs you visited render from those events — the state never lives in the UI.",
  "you.avatar.demo.step.self-loop-refused.title": "Self-loop refused",
  "you.avatar.demo.step.self-loop-refused.description":
    "A state change must change the state: the typing-to-typing transition is refused typed (no-op-transition).",
  "you.avatar.demo.step.unavailable-refused.title": "Lifecycle-owned rung refused",
  "you.avatar.demo.step.unavailable-refused.description":
    "The unavailable rung belongs to the lifecycle (suspend/close enter it, resume leaves it); the generic activity transition can never enter it — a typed refusal.",
  "you.avatar.demo.step.unknown-state-refused.title": "Off-ladder state refused",
  "you.avatar.demo.step.unknown-state-refused.description":
    "An off-ladder state (levitating) is refused typed — the nine-state taxonomy is frozen v7 and the ladder never guesses.",
  "you.avatar.demo.step.session-suspend.title": "Suspend the session",
  "you.avatar.demo.step.session-suspend.description":
    "Suspending is a projected intent: status becomes suspended and the state projects onto the lifecycle-owned unavailable rung, journaled as an embodiment-state-changed event with the status riding along.",
  "you.avatar.demo.step.suspended-refused.title": "Suspended activity refused",
  "you.avatar.demo.step.suspended-refused.description":
    "A suspended session refuses activity transitions typed — you must resume before the body can act again.",
  "you.avatar.demo.step.session-resume.title": "Resume the session",
  "you.avatar.demo.step.session-resume.description":
    "Resuming returns the session to active at the idle rung; the event carries the status so the projection is replayable.",
  "you.avatar.demo.step.soul-reassign.title": "Re-possess the Body",
  "you.avatar.demo.step.soul-reassign.description":
    "The soul-reassigned event swaps only the session's soulBindingId; the Body record and its contract display stay byte-identical (the body/soul separation law).",
  "you.avatar.demo.step.realtime-channels.title": "Realtime channels",
  "you.avatar.demo.step.realtime-channels.description":
    "The session's channel panels render content-addressed stream labels (streamRef + streamHash) and the latency class — the stream content is never inlined.",
  "you.avatar.demo.step.session-close.title": "Close the session",
  "you.avatar.demo.step.session-close.description":
    "Closing is terminal: status closed, state unavailable, closedAt stamped, and the avatar-session-closed event is appended.",
  "you.avatar.demo.step.closed-terminal.title": "Terminal lock",
  "you.avatar.demo.step.closed-terminal.description":
    "Every mutation on a closed session is a typed refusal (session-closed) — the terminal is locked, there is no zombie path.",
  "you.avatar.demo.step.session-not-found.title": "Unknown session refused",
  "you.avatar.demo.step.session-not-found.description":
    "Addressing an unknown session id is a typed YOU_AVATAR_SESSION_NOT_FOUND refusal — the UI surfaces the typed error panel instead of guessing.",
  "you.avatar.demo.step.second-session.title": "Second possession",
  "you.avatar.demo.step.second-session.description":
    "A second session opens on another Body/Soul pair at the listening rung — each session owns its own ladder head and channel pair.",
  "you.avatar.demo.step.body-register.title": "Register a Body",
  "you.avatar.demo.step.body-register.description":
    "A projected intent through the controller port: the validated intake becomes an immutable body record in the registry (appearance content-addressed, never inlined).",
  "you.avatar.demo.step.soul-register.title": "Register a Soul",
  "you.avatar.demo.step.soul-register.description":
    "A validated soul intake joins the binding registry; from now on the pickers render it like any fixture binding — the plane is honest about what it knows.",
};

export const AVATAR_DEMO_STEP_MESSAGES_ZH_CN: Record<string, string> = {
  "you.avatar.demo.step.load.title": "加载 avatar 平面",
  "you.avatar.demo.step.load.description":
    "avatar 工作室从 controller 投影加载注册面：Body 与 SoulBinding 是 embodiment 平面的只读 fixture；UI 不拥有其中任何一项。",
  "you.avatar.demo.step.body-pick.title": "挑选 Body",
  "you.avatar.demo.step.body-pick.description":
    "Body picker 直接渲染注册面投影的 role/capabilities/tools；外观保持内容寻址（仅 appearanceRef + appearanceHash 标签）。",
  "you.avatar.demo.step.soul-pick.title": "挑选 Soul",
  "you.avatar.demo.step.soul-pick.description":
    "Soul picker 渲染 providerKind、modelRef 与 routing profile（system-one / system-two 是 ROUTING PROFILES，而非固定模型身份）。",
  "you.avatar.demo.step.soul-intake-invalid.title": "Soul intake 被拒绝",
  "you.avatar.demo.step.soul-intake-invalid.description":
    "以越界 routing profile 注册 SoulBinding 是 typed YOU_SOUL_BINDING_INVALID 拒绝——无状态校验器最先执行，不落任何账。",
  "you.avatar.demo.step.body-intake-invalid.title": "Body intake 被拒绝",
  "you.avatar.demo.step.body-intake-invalid.description":
    "空 role 注册 Body 是 typed YOU_INVALID_STATE 拒绝（role-empty）——Body 注册面绝不静默修复 intake。",
  "you.avatar.demo.step.body-not-found.title": "未知 Body 被拒绝",
  "you.avatar.demo.step.body-not-found.description":
    "以未知 body id 打开会话是 typed YOU_BODY_NOT_FOUND 拒绝；Body 以其不可变注册 id 寻址，绝不猜测。",
  "you.avatar.demo.step.session-open.title": "打开 avatar 会话",
  "you.avatar.demo.step.session-open.description":
    "Body 被 Soul 附身：会话以 active/idle 打开，确定性派生两条 realtime 信道，并追加 avatar-session-opened 事件。",
  "you.avatar.demo.step.ladder-walk.title": "行走阶梯",
  "you.avatar.demo.step.ladder-walk.description":
    "活动转移（listening、typing、tool_use）各自追加 embodiment-state-changed 事件；到访过的档位由这些事件渲染——状态绝不活在 UI 里。",
  "you.avatar.demo.step.self-loop-refused.title": "自环被拒绝",
  "you.avatar.demo.step.self-loop-refused.description":
    "状态转移必须改变状态：typing → typing 被 typed 拒绝（no-op-transition）。",
  "you.avatar.demo.step.unavailable-refused.title": "lifecycle 档位被拒绝",
  "you.avatar.demo.step.unavailable-refused.description":
    "unavailable 档位归 lifecycle 所有（suspend/close 进入、resume 离开）；通用活动转移绝不进入它——typed 拒绝。",
  "you.avatar.demo.step.unknown-state-refused.title": "越界状态被拒绝",
  "you.avatar.demo.step.unknown-state-refused.description":
    "越界状态（levitating）被 typed 拒绝——九级分类学是 frozen v7，阶梯绝不猜测。",
  "you.avatar.demo.step.session-suspend.title": "挂起会话",
  "you.avatar.demo.step.session-suspend.description":
    "挂起是投射意图：status 变为 suspended、状态投影到 lifecycle 所有的 unavailable 档位，以 status 随账的 embodiment-state-changed 事件落账。",
  "you.avatar.demo.step.suspended-refused.title": "挂起期间活动被拒绝",
  "you.avatar.demo.step.suspended-refused.description":
    "挂起的会话 typed 拒绝活动转移——必须先恢复，Body 才能再次行动。",
  "you.avatar.demo.step.session-resume.title": "恢复会话",
  "you.avatar.demo.step.session-resume.description":
    "恢复使会话回到 active/idle；事件携带 status，投影可重放。",
  "you.avatar.demo.step.soul-reassign.title": "再附身 Body",
  "you.avatar.demo.step.soul-reassign.description":
    "soul-reassigned 事件只换会话的 soulBindingId；Body 记录与其契约显示保持字节一致（body/soul 分离法则）。",
  "you.avatar.demo.step.realtime-channels.title": "Realtime 信道",
  "you.avatar.demo.step.realtime-channels.description":
    "会话的信道面板渲染内容寻址流标签（streamRef + streamHash）与 latency class——流内容绝不内联。",
  "you.avatar.demo.step.session-close.title": "关闭会话",
  "you.avatar.demo.step.session-close.description":
    "关闭是终态：status closed、state unavailable、closedAt 落章，并追加 avatar-session-closed 事件。",
  "you.avatar.demo.step.closed-terminal.title": "终态锁定",
  "you.avatar.demo.step.closed-terminal.description":
    "closed 会话上的一切改写都是 typed 拒绝（session-closed）——终态锁定，不存在僵尸路径。",
  "you.avatar.demo.step.session-not-found.title": "未知会话被拒绝",
  "you.avatar.demo.step.session-not-found.description":
    "寻址未知会话 id 是 typed YOU_AVATAR_SESSION_NOT_FOUND 拒绝——UI 呈现 typed 错误面板而非猜测。",
  "you.avatar.demo.step.second-session.title": "第二次附身",
  "you.avatar.demo.step.second-session.description":
    "第二个会话在另一对 Body/Soul 上以 listening 档打开——每个会话拥有自己的阶梯头与信道对。",
  "you.avatar.demo.step.body-register.title": "注册 Body",
  "you.avatar.demo.step.body-register.description":
    "经 controller 端口的投射意图：通过校验的 intake 成为注册面里的不可变 Body 记录（外观内容寻址、绝不内联）。",
  "you.avatar.demo.step.soul-register.title": "注册 Soul",
  "you.avatar.demo.step.soul-register.description":
    "通过校验的 soul intake 进入绑定注册面；此后 picker 与 fixture 绑定同等渲染——平面对自己知道什么保持诚实。",
};
