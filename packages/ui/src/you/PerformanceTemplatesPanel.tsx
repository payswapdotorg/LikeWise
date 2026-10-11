// YOU Performance Studio — 模板面板（W4B）。
//
// 验收要求：模板挑选 + 实例化流（参数编辑为 plain typed record；实例化时间线的
// 确定性预览）。参数行按值类型渲染（bool 开关 / number 步进 / string 文本）；
// 预览摘要 digest 内容派生（同模板同参数 ⇒ 同 digest）；「实例化并发布」走
// controller 端口（基于模板的 timeline 逐字拷贝语义——W4A authority）。
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { CheckIcon, SparklesIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { cn } from "@/components/lib/utils.js";
import { usePerformanceMessages } from "@/you/usePerformanceMessages.js";
import type { UsePerformanceStudioBinding } from "@/you/usePerformanceStudio.js";
import type { TemplateInstantiationPreview } from "@/you/performanceController.js";
import {
  projectTemplateParameterRows,
  projectTimeline,
} from "@/you/performanceStudioProjection.js";
import { PERFORMANCE_STORYBOARD_PARAMETER_STEPS } from "@/you/performanceStoryboard.js";
import type { PerformanceTemplate } from "@zcode/shared";

export function PerformanceTemplatesPanel({ binding }: { binding: UsePerformanceStudioBinding }) {
  const { formatMessage } = usePerformanceMessages();
  const snapshot = useStore(binding.store, (state) => state.snapshot);
  const selectedTemplateId = useStore(binding.store, (state) => state.selectedTemplateId);
  const templateParameterDraft = useStore(binding.store, (state) => state.templateParameterDraft);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<TemplateInstantiationPreview | null>(null);

  const templates = snapshot?.templates ?? [];
  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === selectedTemplateId) ??
      templates[0] ??
      null,
    [templates, selectedTemplateId],
  );
  const parameterRows = useMemo(
    () => projectTemplateParameterRows(templateParameterDraft),
    [templateParameterDraft],
  );
  // 确定性预览从 controller 端口拉取（纯投影：不分配 id、不推进时钟、不落账）。
  useEffect(() => {
    let cancelled = false;
    if (!selectedTemplate) {
      setPreview(null);
      return;
    }
    void binding.controller
      .previewTemplateInstantiation({
        templateId: selectedTemplate.id,
        parameters: templateParameterDraft,
      })
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [binding.controller, selectedTemplate, templateParameterDraft]);
  const previewTimelineProjection = useMemo(
    () => projectTimeline(preview?.timeline ?? null),
    [preview],
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

  const parameterSteps = selectedTemplate
    ? (PERFORMANCE_STORYBOARD_PARAMETER_STEPS[selectedTemplate.id] ?? {})
    : {};

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="you-performance-templates"
    >
      <section aria-label={formatMessage({ id: "you.performance.templates.title" })}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ui-base font-medium text-foreground">
            {formatMessage({ id: "you.performance.templates.title" })}
          </h3>
          <Badge
            variant="outline"
            className="gap-1 text-ui-xs text-foreground-subtle"
            data-testid="you-performance-template-count"
          >
            <SparklesIcon className="size-3" />
            {templates.length} {formatMessage({ id: "you.performance.templates.templateCount" })}
          </Badge>
        </div>
        {templates.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3" data-testid="you-performance-templates-empty">
            <p className="text-ui-sm text-foreground-subtle">
              {formatMessage({ id: "you.performance.templates.empty" })}
            </p>
          </div>
        ) : (
          <ol className="mt-2 flex flex-col gap-1.5" data-testid="you-performance-template-list">
            {templates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                selected={selectedTemplate?.id === template.id}
                onPick={() => binding.store.getState().selectTemplate(template.id)}
              />
            ))}
          </ol>
        )}
      </section>

      {selectedTemplate ? (
        <>
          <section aria-label={formatMessage({ id: "you.performance.templates.parameters" })}>
            <h4 className="text-ui-sm font-medium text-foreground">
              {formatMessage({ id: "you.performance.templates.parameters" })}
            </h4>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.performance.templates.parametersHint" })}
            </p>
            <div className="mt-2 flex flex-col gap-1.5" data-testid="you-performance-parameter-editor">
              {parameterRows.length === 0 ? (
                <p className="text-ui-xs text-foreground-subtle">—</p>
              ) : (
                parameterRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border bg-card px-2 py-1.5"
                    data-testid="you-performance-parameter-row"
                    data-you-performance-parameter-key={row.key}
                    data-you-performance-parameter-kind={row.kind}
                  >
                    <span className="min-w-0 break-all font-mono text-ui-xs text-foreground">
                      {row.key}
                    </span>
                    <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
                      {formatMessage({ id: `you.performance.templates.param.${row.kind}` })}
                    </Badge>
                    {row.kind === "boolean" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 px-2 text-ui-xs"
                        data-testid="you-performance-parameter-toggle"
                        onClick={() =>
                          binding.store
                            .getState()
                            .setTemplateParameter(row.key, !(row.value === true))
                        }
                      >
                        {row.value === true ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
                        {row.value === true
                          ? formatMessage({ id: "you.performance.templates.param.on" })
                          : formatMessage({ id: "you.performance.templates.param.off" })}
                      </Button>
                    ) : null}
                    {row.kind === "number" ? (
                      <span className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-ui-xs"
                          aria-label={formatMessage({ id: "you.performance.templates.param.decrement" })}
                          data-testid="you-performance-parameter-decrement"
                          onClick={() =>
                            binding.store
                              .getState()
                              .setTemplateParameter(
                                row.key,
                                Math.round(((typeof row.value === "number" ? row.value : 0) -
                                  (parameterSteps[row.key] ?? 1)) * 100) / 100,
                              )
                          }
                        >
                          −
                        </Button>
                        <span
                          className="min-w-12 text-center font-mono text-ui-xs text-foreground"
                          data-testid="you-performance-parameter-value"
                        >
                          {String(row.value)}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-ui-xs"
                          aria-label={formatMessage({ id: "you.performance.templates.param.increment" })}
                          data-testid="you-performance-parameter-increment"
                          onClick={() =>
                            binding.store
                              .getState()
                              .setTemplateParameter(
                                row.key,
                                Math.round(((typeof row.value === "number" ? row.value : 0) +
                                  (parameterSteps[row.key] ?? 1)) * 100) / 100,
                              )
                          }
                        >
                          +
                        </Button>
                      </span>
                    ) : null}
                    {row.kind === "string" ? (
                      <Input
                        value={String(row.value)}
                        className="h-6 w-44 font-mono text-ui-xs"
                        data-testid="you-performance-parameter-input"
                        onChange={(event) =>
                          binding.store
                            .getState()
                            .setTemplateParameter(row.key, event.target.value)
                        }
                      />
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section aria-label={formatMessage({ id: "you.performance.templates.preview.title" })}>
            <div className="flex flex-wrap items-baseline gap-2">
              <h4 className="text-ui-sm font-medium text-foreground">
                {formatMessage({ id: "you.performance.templates.preview.title" })}
              </h4>
              <Badge
                variant="outline"
                className="font-mono text-ui-xs text-foreground-subtle"
                data-testid="you-performance-preview-digest"
              >
                {formatMessage({ id: "you.performance.templates.preview.digest" })}:{" "}
                {preview?.previewDigest ?? "—"}
              </Badge>
              <Badge variant="secondary" className="font-mono text-ui-xs">
                {formatMessage({ id: "you.performance.timeline.duration" })}:{" "}
                {previewTimelineProjection.durationLabel}
              </Badge>
              {(preview?.evidenceBoundCueCount ?? 0) > 0 ? (
                <Badge
                  variant="outline"
                  className="border-warning/40 font-mono text-ui-xs text-warning"
                  data-testid="you-performance-preview-evidence"
                >
                  {preview?.evidenceBoundCueCount}{" "}
                  {formatMessage({ id: "you.performance.templates.preview.evidenceCues" })}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-ui-xs text-foreground-subtlest">
              {formatMessage({ id: "you.performance.templates.preview.caption" })}
            </p>
            <div className="mt-2 flex flex-col gap-1" data-testid="you-performance-preview-tracks">
              {previewTimelineProjection.tracks.map((trackRow) => (
                <div
                  key={trackRow.track}
                  className="flex min-w-0 flex-wrap items-baseline gap-x-2 rounded-md border border-border bg-surface px-2 py-1"
                  data-testid="you-performance-preview-track"
                  data-you-performance-track={trackRow.track}
                >
                  <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
                    {trackRow.track}
                  </Badge>
                  <span className="font-mono text-ui-xs text-foreground-subtle">
                    {trackRow.cueRows
                      .map((cueRow) => `${cueRow.id} ${cueRow.startMs}–${cueRow.endMs}ms`)
                      .join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section aria-label={formatMessage({ id: "you.performance.templates.instantiate" })}>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              data-testid="you-performance-template-instantiate"
              onClick={() =>
                void withBusy(() =>
                  binding.controller.publishPerformanceFromTemplate({
                    templateId: selectedTemplate.id,
                    parameters: templateParameterDraft,
                  }),
                )
              }
            >
              <SparklesIcon className="size-3.5" />
              {formatMessage({ id: "you.performance.templates.instantiate" })}
            </Button>
          </section>
        </>
      ) : null}
    </div>
  );
}

function TemplateRow({
  template,
  selected,
  onPick,
}: {
  template: PerformanceTemplate;
  selected: boolean;
  onPick: () => void;
}) {
  const { formatMessage } = usePerformanceMessages();
  const projection = projectTimeline(template.timeline);
  return (
    <li
      className={cn(
        "flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border px-2 py-1.5",
        selected ? "border-brand/40 bg-brand/5" : "border-border bg-card",
      )}
      data-testid="you-performance-template-row"
      data-you-performance-template-id={template.id}
      data-you-performance-template-selected={selected ? "true" : "false"}
      onClick={onPick}
    >
      <span className="text-ui-xs font-medium text-foreground">{template.name}</span>
      <span className="font-mono text-ui-xs text-foreground-subtle">{template.id}</span>
      <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
        {projection.totalCues} {formatMessage({ id: "you.performance.timeline.cues" })}
      </Badge>
      <Badge variant="outline" className="font-mono text-ui-xs text-foreground-subtle">
        {projection.durationLabel}
      </Badge>
      <span className="text-ui-xs text-foreground-subtlest">
        {formatMessage({ id: "you.performance.templates.parameters" })}:{" "}
        {Object.keys(template.parameters).length}
      </span>
    </li>
  );
}
