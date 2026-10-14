// YOU Hardening Studio — Hardening 面板文案 hook（W10B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在 hardeningMessages.ts
//（无别名导入，可被根目录 tsx 测试直接加载）。与 W1B–W9B 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import {
  formatHardeningMessage,
  resolveHardeningMessages,
} from "@/you/hardeningMessages.js";

export function useHardeningMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolveHardeningMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatHardeningMessage(messages, descriptor.id, values),
  };
}
