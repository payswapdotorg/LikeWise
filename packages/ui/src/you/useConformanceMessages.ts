// YOU Conformance Studio — Conformance 面板文案 hook（W11B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在
// conformanceMessages.ts（无别名导入，可被根目录 tsx 测试直接加载）。与
// W1B–W10B 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import {
  formatConformanceMessage,
  resolveConformanceMessages,
} from "@/you/conformanceMessages.js";

export function useConformanceMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolveConformanceMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatConformanceMessage(messages, descriptor.id, values),
  };
}
