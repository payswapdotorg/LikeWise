// YOU Editing Studio — Editing 面板文案 hook（W5B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在 editingMessages.ts
//（无别名导入，可被根目录 tsx 测试直接加载）。与 W1B/W2B/W3B/W4B 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { formatEditingMessage, resolveEditingMessages } from "@/you/editingMessages.js";

export function useEditingMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolveEditingMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatEditingMessage(messages, descriptor.id, values),
  };
}
