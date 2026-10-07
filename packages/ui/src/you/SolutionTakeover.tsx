// YOU Solution Studio — 手动接管面板（W1B）。
//
// Edit 模式入口 → EditSession（observed 证据）→ 小幅手动纠正（transform 微调）→
// 候选 ChangeSet → accept/revert；显式学习许可控制（默认关闭；「未许可不学习」
// 是可见 UX）。学习候选展示「将学习什么」，作用域固定 USER。
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { cn } from "@/components/lib/utils.js";
import { MinusIcon, PencilIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Switch } from "@/components/ui/switch.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.js";
import { currentSolutionVersion, findSolutionEntity } from "./solutionController.js";
import { STORYBOARD_TAKEOVER_CORRECTION, TAKEOVER_TARGET_ENTITY_ID } from "./solutionStoryboard.js";
import type { UseSolutionSurfaceBinding } from "./useSolutionSurface.js";
import { useYouMessages } from "./youMessages.js";

export function SolutionTakeoverPanel({ binding }: { binding: UseSolutionSurfaceBinding }) {
  const { formatMessage } = useYouMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const mode = useStore(binding.store, (state) => state.mode);
  const selection = useStore(binding.store, (state) => state.selection);
  const [rotationZ, setRotationZ] = useState(0);
  const [busy, setBusy] = useState(false);
  const version = snapshot ? currentSolutionVersion(snapshot) : null;
  const entities = useMemo(() => version?.state.entities ?? [], [version]);

  const targetEntityId =
    selection?.kind === "entity" && entities.some((entity) => entity.id === selection.entityId)
      ? selection.entityId
      : TAKEOVER_TARGET_ENTITY_ID;
  const targetEntity = findSolutionEntity(snapshot, targetEntityId);
  const openEditSession =
    snapshot?.editSessions.find((session) => session.endedAt === null) ?? null;
  const pendingUserChangeSet =
    snapshot?.pendingChangeSets.find((changeSet) => changeSet.authorType === "user") ?? null;
  const consent = snapshot?.learningPermission;
  const learningCandidate = snapshot?.learningCandidate ?? null;

  const targetEntityRotationZ = targetEntity?.transform.rotation[2] ?? null;
  useEffect(() => {
    // 只在目标实体或其当前旋转真正变化时同步滑杆；
    // 避免无关快照刷新（如切换学习许可）打断进行中的微调。
    if (targetEntityRotationZ !== null) {
      setRotationZ(targetEntityRotationZ);
    }
  }, [targetEntity?.id, targetEntityRotationZ]);

  if (!snapshot || !version) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-solution-takeover"
    >
      <section aria-label={formatMessage({ id: "you.solution.takeover.title" })}>
        <div className="flex items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.solution.takeover.title" })}
          </h3>
          {mode === "edit" ? (
            <Badge variant="secondary" className="gap-1 text-ui-xs">
              <PencilIcon className="size-3" />
              {formatMessage({ id: "you.solution.takeover.editModeBadge" })}
            </Badge>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select
            value={targetEntityId}
            onValueChange={(value) =>
              binding.store.getState().setSelection({ kind: "entity", entityId: value })
            }
          >
            <SelectTrigger
              size="sm"
              className="h-7 max-w-52 text-ui-xs"
              aria-label={formatMessage({ id: "you.solution.takeover.target" })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {entities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id} className="text-ui-xs">
                  {entity.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {mode !== "edit" ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              data-testid="you-solution-takeover-enter"
              onClick={() =>
                withBusy(async () => {
                  await binding.controller.openEditSession({ mode: "correct" });
                  binding.store.getState().setMode("edit");
                })
              }
            >
              {formatMessage({ id: "you.solution.takeover.enter" })}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                withBusy(async () => {
                  if (openEditSession) {
                    await binding.controller.closeEditSession(openEditSession.id);
                  }
                  binding.store.getState().setMode("view");
                })
              }
            >
              {formatMessage({ id: "you.solution.takeover.exit" })}
            </Button>
          )}
        </div>
      </section>

      {openEditSession ? (
        <section aria-label={formatMessage({ id: "you.solution.takeover.session" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.solution.takeover.session" })}
            <span className="ml-1.5 font-mono text-ui-xs text-success">
              {formatMessage({ id: "you.solution.takeover.sessionOpen" })}
            </span>
          </h4>
          <div className="mt-1 rounded-lg border border-border bg-card p-2 text-ui-xs">
            <p className="font-mono text-foreground-subtlest">{openEditSession.id}</p>
            <p className="mt-0.5 text-foreground-subtle">
              mode: {openEditSession.mode} · evidence: {openEditSession.evidenceMode} · editor:{" "}
              {openEditSession.editorRef}
            </p>
            <p className="mt-0.5 font-mono text-foreground-subtlest">
              input v {openEditSession.inputVersionId} · {openEditSession.startedAt}
            </p>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="you-takeover-rotation"
                className="shrink-0 text-ui-sm text-foreground-subtle"
              >
                {formatMessage({ id: "you.solution.takeover.rotationZ" })}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="-"
                onClick={() =>
                  setRotationZ((value) => Math.round((value - 0.05) * 100) / 100)
                }
              >
                <MinusIcon className="size-3.5" />
              </Button>
              <Input
                id="you-takeover-rotation"
                type="number"
                step={0.05}
                value={rotationZ.toFixed(2)}
                onChange={(event) => {
                  const parsed = Number.parseFloat(event.target.value);
                  if (Number.isFinite(parsed)) {
                    setRotationZ(Math.round(parsed * 100) / 100);
                  }
                }}
                className="h-6 w-20 rounded-md px-1.5 text-right font-mono text-ui-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="+"
                onClick={() =>
                  setRotationZ((value) => Math.round((value + 0.05) * 100) / 100)
                }
              >
                <PlusIcon className="size-3.5" />
              </Button>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy || !targetEntity}
                data-testid="you-solution-takeover-apply"
                onClick={() =>
                  withBusy(() =>
                    binding.controller.submitManualCorrection({
                      editSessionId: openEditSession.id,
                      entityId: targetEntityId,
                      transform: {
                        position: targetEntity?.transform.position ?? [0, 0, 0],
                        rotation: [
                          targetEntity?.transform.rotation[0] ?? 0,
                          targetEntity?.transform.rotation[1] ?? 0,
                          rotationZ,
                        ],
                        scale: targetEntity?.transform.scale ?? [1, 1, 1],
                      },
                      note: `Rotate ${targetEntity?.label ?? targetEntityId} to z=${rotationZ.toFixed(2)}.`,
                    }),
                  )
                }
              >
                {formatMessage({ id: "you.solution.takeover.apply" })}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                onClick={() => setRotationZ(STORYBOARD_TAKEOVER_CORRECTION.rotation[2])}
              >
                {formatMessage({ id: "you.solution.takeover.wavePreset" })}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {pendingUserChangeSet ? (
        <section aria-label={formatMessage({ id: "you.solution.takeover.pending" })}>
          <h4 className="text-ui-sm font-medium text-foreground">
            {formatMessage({ id: "you.solution.takeover.pending" })}
          </h4>
          <div
            className="mt-1 rounded-lg border border-border bg-card p-2"
            data-testid="you-solution-takeover-changeset"
          >
            <p className="font-mono text-ui-xs text-foreground-subtlest">
              {pendingUserChangeSet.id} · {pendingUserChangeSet.authorType}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {pendingUserChangeSet.proposedOperations.map((operation, index) => (
                <li
                  key={index}
                  className="break-all font-mono text-ui-xs text-foreground-subtle"
                >
                  {operation.op === "upsert_entity"
                    ? `upsert ${operation.entity.label} rot z=${operation.entity.transform.rotation[2]?.toFixed(2) ?? "0"}`
                    : operation.op}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-1">
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy}
                data-testid="you-solution-takeover-accept"
                onClick={() =>
                  withBusy(async () => {
                    await binding.controller.acceptChangeSet(pendingUserChangeSet.id);
                    const openSession = (
                      await binding.controller.refresh()
                    ).editSessions.find((session) => session.endedAt === null);
                    if (openSession) {
                      await binding.controller.closeEditSession(openSession.id);
                    }
                    binding.store.getState().setMode("view");
                  })
                }
              >
                {formatMessage({ id: "you.solution.takeover.accept" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-ui-xs"
                disabled={busy}
                data-testid="you-solution-takeover-revert"
                onClick={() =>
                  withBusy(() => binding.controller.revertChangeSet(pendingUserChangeSet.id))
                }
              >
                {formatMessage({ id: "you.solution.takeover.revert" })}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section aria-label={formatMessage({ id: "you.solution.takeover.learningTitle" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.solution.takeover.learningTitle" })}
        </h4>
        <div
          className={cn(
            "mt-1 rounded-lg border p-2",
            consent?.learningPermission
              ? "border-success/40 bg-success/5"
              : "border-border bg-surface",
          )}
          data-testid="you-solution-learning-gate"
        >
          <div className="flex items-center gap-2">
            <Switch
              id="you-learning-permission"
              checked={consent?.learningPermission ?? false}
              disabled={busy}
              onCheckedChange={(checked) =>
                withBusy(() => binding.controller.setLearningPermission(checked))
              }
            />
            <Label
              htmlFor="you-learning-permission"
              className="text-ui-sm text-foreground"
            >
              {formatMessage({ id: "you.solution.takeover.grant" })}
            </Label>
          </div>
          <p
            className={cn(
              "mt-1.5 text-ui-xs",
              consent?.learningPermission ? "text-foreground" : "text-foreground-subtle",
            )}
          >
            {consent?.learningPermission
              ? formatMessage({ id: "you.solution.takeover.learningOn" })
              : formatMessage({ id: "you.solution.takeover.learningOff" })}
          </p>
          <p className="mt-1 font-mono text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.solution.takeover.learningScope" })}
          </p>
          <div className="mt-2">
            <p className="text-ui-xs font-medium text-foreground">
              {formatMessage({ id: "you.solution.takeover.learningCandidate" })}
            </p>
            {learningCandidate ? (
              <p className="mt-0.5 break-all text-ui-xs text-foreground-subtle">
                {learningCandidate.summary}
              </p>
            ) : (
              <p className="mt-0.5 text-ui-xs text-foreground-subtlest">
                {formatMessage({ id: "you.solution.takeover.noCandidate" })}
              </p>
            )}
          </div>
        </div>
      </section>

      <p className="shrink-0 text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.solution.demo.scriptedNote" })}
      </p>
    </div>
  );
}
