// YOU Twin Studio — Twin 面板文案 hook（W3B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在 twinMessages.ts
//（无别名导入，可被根目录 tsx 测试直接加载）。与 W1B/W2B 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { formatTwinMessage, resolveTwinMessages } from "@/you/twinMessages.js";

export function useTwinMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolveTwinMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatTwinMessage(messages, descriptor.id, values),
  };
}
