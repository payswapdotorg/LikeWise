// YOU Escalation Studio — Escalation 面板文案 hook（W8B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在 escalationMessages.ts
//（无别名导入，可被根目录 tsx 测试直接加载）。与 W1B–W7B 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { formatEscalationMessage, resolveEscalationMessages } from "@/you/escalationMessages.js";

export function useEscalationMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolveEscalationMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatEscalationMessage(messages, descriptor.id, values),
  };
}
