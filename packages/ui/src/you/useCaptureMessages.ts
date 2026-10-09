// YOU Capture Studio — Capture 面板文案 hook（W2B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在 captureMessages.ts
//（无别名导入，可被根目录 tsx 测试直接加载）。与 W1B useYouMessages 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { formatCaptureMessage, resolveCaptureMessages } from "@/you/captureMessages.js";

export function useCaptureMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolveCaptureMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatCaptureMessage(messages, descriptor.id, values),
  };
}
