// YOU Learning Studio — 偏好面板（W6B）。
//
// 验收要求：偏好列表（derived-from lineage：derivedFromRecordId → 派生记录；
// null = 操作员种子）+ clear/adjust 作为投射意图（经 controller 端口
// setOperatorPreference / clearOperatorPreference——非本地 UI 改写）。偏好是投影、
// 绝非权威——记录保持真相源；派生偏好手工清除被 typed 拒绝（诚实错误面板）。
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { EraserIcon, SlidersHorizontalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/components/lib/utils.js";
import { useLearningMessages } from "@/you/useLearningMessages.js";
import type { UseLearningStudioBinding } from "@/you/useLearningStudio.js";
import { orderedLearningPreferences } from "@/you/learningController.js";
import { projectPreferenceRows } from "@/you/learningStudioProjection.js";
import type { LearningScope } from "@zcode/shared";

const DEMO_SEED_KEY = "organization-baseline";

export function LearningPreferencesPanel({ binding }: { binding: UseLearningStudioBinding }) {
  const { formatMessage } = useLearningMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedPreferenceKey = useStore(
    binding.store,
    (state) => state.selectedPreferenceKey,
  );
  const [busy, setBusy] = useState(false);
  const [seedKey, setSeedKey] = useState<string>(DEMO_SEED_KEY);
  const [seedValue, setSeedValue] = useState<string>("fixture-baseline");

  const preferences = useMemo(
    () => orderedLearningPreferences(snapshot),
    [snapshot],
  );
  const rows = useMemo(() => projectPreferenceRows(preferences), [preferences]);
  const inspected = useMemo(
    () =>
      rows.find(
        (row) => `${row.scope}::${row.key}` === selectedPreferenceKey,
      ) ??
      rows.at(-1) ??
      null,
    [rows, selectedPreferenceKey],
  );

  const withBusy = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await binding.run(operation);
    } finally {
      setBusy(false);
    }
  };

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-ui-base text-foreground-subtle">—</p>
      </div>
    );
  }

  const seedDisabledReason =
    seedKey.trim() === ""
      ? formatMessage({ id: "you.learning.preferences.adjust.disabledKey" })
      : seedValue === ""
        ? formatMessage({ id: "you.learning.preferences.adjust.disabledValue" })
        : null;

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-learning-preferences"
    >
      <section aria-label={formatMessage({ id: "you.learning.preferences.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontalIcon className="size-4 text-foreground-subtle" />
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.learning.preferences.title" })}
          </h3>
          <Badge variant="outline" className="text-ui-xs text-foreground-subtle" data-testid="you-learning-preferences-count">
            {rows.length}
          </Badge>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.preferences.caption" })}
        </p>
        {rows.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-learning-preferences-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.learning.preferences.empty" })}
            </p>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.learning.preferences.emptyHint" })}
            </p>
          </div>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <section aria-label={formatMessage({ id: "you.learning.preferences.count" })}>
          <ol className="flex flex-col gap-1.5" data-testid="you-learning-preference-list">
            {rows.map((row) => {
              const projectionKey = `${row.scope}::${row.key}`;
              return (
                <li key={row.preferenceId}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                      projectionKey === (inspected ? `${inspected.scope}::${inspected.key}` : null)
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-surface hover:bg-surface-hover",
                    )}
                    data-testid="you-learning-preference-row"
                    data-you-learning-preference-key={projectionKey}
                    data-you-learning-preference-derived={row.derivedFromRecordId !== null ? "true" : "false"}
                    onClick={() =>
                      binding.store.getState().selectPreference(projectionKey)
                    }
                  >
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="font-mono text-ui-xs text-foreground">{row.scope}::{row.key}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-ui-xs",
                          row.derivedFromRecordId !== null
                            ? "border-success/40 text-success"
                            : "border-muted-foreground/40 text-foreground-subtle",
                        )}
                      >
                        {row.derivedFromRecordId !== null
                          ? formatMessage({ id: "you.learning.preferences.derivedFrom" })
                          : formatMessage({ id: "you.learning.preferences.operatorSeed" })}
                      </Badge>
                    </span>
                    <span className="font-mono text-ui-xs text-foreground-subtle">
                      = {row.value}
                    </span>
                    <span className="flex flex-wrap gap-x-2 font-mono text-ui-xs text-foreground-subtlest">
                      {row.derivedFromRecordId !== null ? (
                        <span>
                          {formatMessage({ id: "you.learning.preferences.derivedFrom" })}:{" "}
                          {row.derivedFromRecordId}
                        </span>
                      ) : null}
                      <span>
                        {formatMessage({ id: "you.learning.preferences.updatedAt" })}: {row.updatedAt}
                      </span>
                    </span>
                    <span className="sr-only">{row.accessibleLabel}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.learning.preferences.lineageHint" })}
          </p>
        </section>
      ) : null}

      {inspected ? (
        <section aria-label={formatMessage({ id: "you.learning.preferences.clear" })} data-testid="you-learning-preference-detail">
          <div className="flex flex-wrap items-baseline gap-2">
            <h4 className="font-mono text-ui-sm font-medium text-foreground">
              {inspected.scope}::{inspected.key}
            </h4>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-ui-xs"
              disabled={busy || inspected.derivedFromRecordId !== null}
              title={
                inspected.derivedFromRecordId !== null
                  ? formatMessage({ id: "you.learning.preferences.clearCaption" })
                  : undefined
              }
              data-testid="you-learning-preference-clear"
              onClick={() => {
                void withBusy(() =>
                  binding.controller.clearOperatorPreference({
                    scope: inspected.scope as LearningScope,
                    key: inspected.key,
                  }),
                );
              }}
            >
              <EraserIcon className="size-3" />
              {formatMessage({ id: "you.learning.preferences.clear" })}
            </Button>
          </div>
          <p className="mt-1 text-ui-xs text-foreground-subtlest">
            {formatMessage({ id: "you.learning.preferences.clearCaption" })}
          </p>
        </section>
      ) : null}

      <section aria-label={formatMessage({ id: "you.learning.preferences.adjust.title" })}>
        <h4 className="text-ui-sm font-medium text-foreground">
          {formatMessage({ id: "you.learning.preferences.adjust.title" })}
        </h4>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <label
            className="text-ui-xs text-foreground-subtlest"
            htmlFor="you-learning-preference-seed-key"
          >
            {formatMessage({ id: "you.learning.preferences.adjust.key" })}
          </label>
          <input
            id="you-learning-preference-seed-key"
            className="h-6 w-40 rounded-md border border-border bg-surface px-1.5 font-mono text-ui-xs text-foreground"
            value={seedKey}
            onChange={(event) => setSeedKey(event.target.value)}
            data-testid="you-learning-preference-seed-key"
          />
          <label
            className="text-ui-xs text-foreground-subtlest"
            htmlFor="you-learning-preference-seed-value"
          >
            {formatMessage({ id: "you.learning.preferences.adjust.value" })}
          </label>
          <input
            id="you-learning-preference-seed-value"
            className="h-6 w-40 rounded-md border border-border bg-surface px-1.5 font-mono text-ui-xs text-foreground"
            value={seedValue}
            onChange={(event) => setSeedValue(event.target.value)}
            data-testid="you-learning-preference-seed-value"
          />
          <Button
            type="button"
            size="sm"
            className="h-6 px-2 text-ui-xs"
            disabled={busy || seedDisabledReason !== null}
            title={seedDisabledReason ?? undefined}
            data-testid="you-learning-preference-seed"
            onClick={() => {
              void withBusy(() =>
                binding.controller.setOperatorPreference({
                  scope: "GLOBAL",
                  key: seedKey.trim(),
                  value: seedValue,
                }),
              );
            }}
          >
            {formatMessage({ id: "you.learning.preferences.adjust.apply" })}
          </Button>
        </div>
        <p className="mt-1 text-ui-xs text-foreground-subtlest">
          {formatMessage({ id: "you.learning.preferences.adjust.hint" })}
        </p>
      </section>
    </div>
  );
}
