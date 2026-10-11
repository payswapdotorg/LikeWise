// YOU Performance Studio — Performance 面板文案 hook（W4B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在 performanceMessages.ts
//（无别名导入，可被根目录 tsx 测试直接加载）。与 W1B/W2B/W3B 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { formatPerformanceMessage, resolvePerformanceMessages } from "@/you/performanceMessages.js";

export function usePerformanceMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolvePerformanceMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatPerformanceMessage(messages, descriptor.id, values),
  };
}
