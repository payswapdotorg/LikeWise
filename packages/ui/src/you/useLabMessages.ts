// YOU Lab Studio — Lab 面板文案 hook（W9B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在 labMessages.ts
//（无别名导入，可被根目录 tsx 测试直接加载）。与 W1B–W8B 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { formatLabMessage, resolveLabMessages } from "@/you/labMessages.js";

export function useLabMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolveLabMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatLabMessage(messages, descriptor.id, values),
  };
}
