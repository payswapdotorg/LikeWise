// YOU Avatar Studio — Avatar 面板文案 hook（W7B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在 avatarMessages.ts
//（无别名导入，可被根目录 tsx 测试直接加载）。与 W1B–W6B 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { formatAvatarMessage, resolveAvatarMessages } from "@/you/avatarMessages.js";

export function useAvatarMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolveAvatarMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatAvatarMessage(messages, descriptor.id, values),
  };
}
