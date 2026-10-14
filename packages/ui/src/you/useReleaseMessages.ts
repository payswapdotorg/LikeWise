// YOU Release Studio — Release 面板文案 hook（W12B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在
// releaseMessages.ts（无别名导入，可被根目录 tsx 测试直接加载）。与
// W1B–W11B 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import {
  formatReleaseMessage,
  resolveReleaseMessages,
} from "@/you/releaseMessages.js";

export function useReleaseMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolveReleaseMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatReleaseMessage(messages, descriptor.id, values),
  };
}
