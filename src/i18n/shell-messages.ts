import type { AbstractIntlMessages } from 'next-intl'

/**
 * 从全量 messages 中提取 shell UI（Header / Footer）所需的最小翻译集，
 * 传给根 layout 的 NextIntlClientProvider。
 *
 * 原则：只包含所有页面共用的壳层翻译，路由专属内容不在此处。
 * 路由专属翻译由各页面的 LocalePageIntl 按需注入（见第十步）。
 *
 * 随项目增长，在此处添加新的 shell namespace（如 nav、footer）。
 */
export function pickShellMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const m = messages as Record<string, unknown>
  return {
    common: m.common,       // 语言切换器等全局 UI
    // nav: m.nav,          // 导航栏翻译（未来添加时取消注释）
    // footer: m.footer,    // 页脚翻译（未来添加时取消注释）
  } as AbstractIntlMessages
}