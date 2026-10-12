// YOU Learning Studio — Learning 面板文案 hook（W6B）。
//
// 读取当前 locale（只读依赖中央 IntlProvider）；纯文案表在 learningMessages.ts
//（无别名导入，可被根目录 tsx 测试直接加载）。与 W1B–W5B 同款语义。
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { formatLearningMessage, resolveLearningMessages } from "@/you/learningMessages.js";

export function useLearningMessages(): {
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
} {
  const { locale } = useZCodeIntl();
  const messages = resolveLearningMessages(locale);
  return {
    formatMessage: (descriptor, values) =>
      formatLearningMessage(messages, descriptor.id, values),
  };
}
