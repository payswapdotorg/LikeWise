// YOU Avatar Studio — 注册表单区（W7B）。
//
// 从 `AvatarConfigurationPanel.tsx` 按模块内聚拆分（保持仓库 400 行纪律——与
// W4B/W5B 的 InterchangeSection 拆分同款先例）：Body 注册与 Soul 注册两个
// 投射意图表单（经 controller 端口校验——UI 侧无校验权威，拒绝以 typed 面板
// 呈现）。本地草稿只在提交时经端口；splitList 是显示层解析，不是校验。
import { useState } from "react";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { useAvatarMessages } from "@/you/useAvatarMessages.js";
import type { UseAvatarStudioBinding } from "@/you/useAvatarStudio.js";
import type {
  RegisterAgentBodyInput,
  RegisterSoulBindingInput,
} from "@/you/avatarController.js";

const EMPTY_BODY_DRAFT = {
  role: "",
  capabilities: "",
  tools: "",
  memoryContract: "",
  evaluatorContract: "",
  appearanceSpec: "",
};

const EMPTY_SOUL_DRAFT = {
  providerKind: "",
  modelRef: "",
  routingProfile: "",
  capabilities: "",
};

function splitList(text: string): string[] {
  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function AvatarRegisterForms({ binding }: { binding: UseAvatarStudioBinding }) {
  const { formatMessage } = useAvatarMessages();
  const [busy, setBusy] = useState(false);
  const [bodyDraft, setBodyDraft] = useState(EMPTY_BODY_DRAFT);
  const [soulDraft, setSoulDraft] = useState(EMPTY_SOUL_DRAFT);

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  const registerBodyDisabledReason =
    bodyDraft.role.trim() === ""
      ? "disabledRole"
      : bodyDraft.memoryContract.trim() === ""
        ? "disabledMemory"
        : bodyDraft.evaluatorContract.trim() === ""
          ? "disabledEvaluator"
          : null;
  const registerSoulDisabledReason =
    soulDraft.providerKind.trim() === ""
      ? "disabledProvider"
      : soulDraft.modelRef.trim() === ""
        ? "disabledModel"
        : null;

  const submitBodyDraft = async () => {
    const input: RegisterAgentBodyInput = {
      role: bodyDraft.role.trim(),
      capabilities: splitList(bodyDraft.capabilities),
      tools: splitList(bodyDraft.tools),
      policyRefs: [],
      memoryContractRef: bodyDraft.memoryContract.trim(),
      evaluatorContractRef: bodyDraft.evaluatorContract.trim(),
      appearanceSpecText:
        bodyDraft.appearanceSpec.trim() === "" ? null : bodyDraft.appearanceSpec.trim(),
    };
    await binding.run(() => binding.controller.registerBody(input));
    setBodyDraft(EMPTY_BODY_DRAFT);
  };

  const submitSoulDraft = async () => {
    const input: RegisterSoulBindingInput = {
      providerKind: soulDraft.providerKind.trim(),
      modelRef: soulDraft.modelRef.trim(),
      routingProfile:
        soulDraft.routingProfile.trim() === ""
          ? "system-one"
          : soulDraft.routingProfile.trim(),
      capabilities: splitList(soulDraft.capabilities),
    };
    await binding.run(() => binding.controller.registerSoulBinding(input));
    setSoulDraft(EMPTY_SOUL_DRAFT);
  };

  return (
    <>
      {/* -- register body (projected intent) -- */}
      <section aria-label={formatMessage({ id: "you.avatar.configuration.bodyRegister.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.avatar.configuration.bodyRegister.title" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.configuration.bodyRegister.hint" })}
        </p>
        <div className="mt-2 flex flex-col gap-1.5" data-testid="you-avatar-body-register-form">
          <Input
            value={bodyDraft.role}
            placeholder={formatMessage({ id: "you.avatar.configuration.bodyRegister.role" })}
            className="h-7 text-ui-xs"
            onChange={(event) => setBodyDraft({ ...bodyDraft, role: event.target.value })}
          />
          <Input
            value={bodyDraft.capabilities}
            placeholder={formatMessage({ id: "you.avatar.configuration.bodyRegister.capabilities" })}
            className="h-7 text-ui-xs"
            onChange={(event) => setBodyDraft({ ...bodyDraft, capabilities: event.target.value })}
          />
          <Input
            value={bodyDraft.tools}
            placeholder={formatMessage({ id: "you.avatar.configuration.bodyRegister.tools" })}
            className="h-7 text-ui-xs"
            onChange={(event) => setBodyDraft({ ...bodyDraft, tools: event.target.value })}
          />
          <Input
            value={bodyDraft.memoryContract}
            placeholder={formatMessage({ id: "you.avatar.configuration.bodyRegister.memoryContract" })}
            className="h-7 text-ui-xs"
            onChange={(event) => setBodyDraft({ ...bodyDraft, memoryContract: event.target.value })}
          />
          <Input
            value={bodyDraft.evaluatorContract}
            placeholder={formatMessage({ id: "you.avatar.configuration.bodyRegister.evaluatorContract" })}
            className="h-7 text-ui-xs"
            onChange={(event) => setBodyDraft({ ...bodyDraft, evaluatorContract: event.target.value })}
          />
          <Input
            value={bodyDraft.appearanceSpec}
            placeholder={formatMessage({ id: "you.avatar.configuration.bodyRegister.appearance" })}
            className="h-7 text-ui-xs"
            onChange={(event) => setBodyDraft({ ...bodyDraft, appearanceSpec: event.target.value })}
          />
          <Button
            type="button"
            size="sm"
            className="h-7 px-2.5 text-ui-xs"
            disabled={busy || registerBodyDisabledReason !== null}
            data-testid="you-avatar-register-body"
            onClick={() => void withBusy(submitBodyDraft)}
          >
            {formatMessage({ id: "you.avatar.configuration.bodyRegister.apply" })}
          </Button>
          {registerBodyDisabledReason !== null ? (
            <p className="text-ui-xs text-foreground-subtlest">
              {formatMessage({
                id: `you.avatar.configuration.bodyRegister.${registerBodyDisabledReason}`,
              })}
            </p>
          ) : null}
        </div>
      </section>

      {/* -- register soul (projected intent) -- */}
      <section aria-label={formatMessage({ id: "you.avatar.configuration.soulRegister.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.avatar.configuration.soulRegister.title" })}
        </h4>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.avatar.configuration.soulRegister.hint" })}
        </p>
        <div className="mt-2 flex flex-col gap-1.5" data-testid="you-avatar-soul-register-form">
          <Input
            value={soulDraft.providerKind}
            placeholder={formatMessage({ id: "you.avatar.configuration.soulRegister.providerKind" })}
            className="h-7 text-ui-xs"
            onChange={(event) => setSoulDraft({ ...soulDraft, providerKind: event.target.value })}
          />
          <Input
            value={soulDraft.modelRef}
            placeholder={formatMessage({ id: "you.avatar.configuration.soulRegister.modelRef" })}
            className="h-7 text-ui-xs"
            onChange={(event) => setSoulDraft({ ...soulDraft, modelRef: event.target.value })}
          />
          <Input
            value={soulDraft.routingProfile}
            placeholder={formatMessage({ id: "you.avatar.configuration.soulRegister.routingProfile" })}
            className="h-7 text-ui-xs"
            onChange={(event) => setSoulDraft({ ...soulDraft, routingProfile: event.target.value })}
          />
          <Input
            value={soulDraft.capabilities}
            placeholder={formatMessage({ id: "you.avatar.configuration.soulRegister.capabilities" })}
            className="h-7 text-ui-xs"
            onChange={(event) => setSoulDraft({ ...soulDraft, capabilities: event.target.value })}
          />
          <Button
            type="button"
            size="sm"
            className="h-7 px-2.5 text-ui-xs"
            disabled={busy || registerSoulDisabledReason !== null}
            data-testid="you-avatar-register-soul"
            onClick={() => void withBusy(submitSoulDraft)}
          >
            {formatMessage({ id: "you.avatar.configuration.soulRegister.apply" })}
          </Button>
          {registerSoulDisabledReason !== null ? (
            <p className="text-ui-xs text-foreground-subtlest">
              {formatMessage({
                id: `you.avatar.configuration.soulRegister.${registerSoulDisabledReason}`,
              })}
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
