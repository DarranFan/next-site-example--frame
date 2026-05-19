// 这是 Server Component（无 'use client'），可以调用服务端 API
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import type { AbstractIntlMessages } from 'next-intl'
import type { ReactNode } from 'react'

type Props = {
  /**
   * 该路由需要暴露给客户端组件的命名空间列表。
   * 从 segment-client-namespaces.ts 引入对应常量。
   *
   * 示例：namespaces={HOME_PAGE_NAMESPACES}
   */
  namespaces: readonly string[]
  children: ReactNode
}

/**
 * 路由段级别的 i18n Provider。
 *
 * 为什么需要它：
 * - 根 layout 的 Provider 只包含 shell 翻译（common 等）
 * - 页面内的客户端组件（如表单、实时预览）需要访问该页面的翻译
 * - 直接把所有翻译放根 Provider 会让每个页面都下载所有语言包
 *
 * 工作原理：
 * 1. 从服务端获取全量 messages
 * 2. 按 namespaces 列表 pick 出该路由需要的部分
 * 3. 套一层 NextIntlClientProvider 传给子树
 * 4. 子树中的客户端组件可访问：shell 翻译 + 该路由的翻译
 *
 * 用法（在页面的 return 最外层包裹）：
 *   <LocalePageIntl namespaces={HOME_PAGE_NAMESPACES}>
 *     <div>页面内容...</div>
 *   </LocalePageIntl>
 */
export default async function LocalePageIntl({ namespaces, children }: Props) {
  // 获取当前请求的全量 messages（由 request.ts 加载）
  const allMessages = await getMessages()
  const m = allMessages as Record<string, unknown>

  // 按 namespaces 列表提取对应翻译，过滤不存在的命名空间
  const messages = Object.fromEntries(
    namespaces
      .filter((ns) => ns in m)
      .map((ns) => [ns, m[ns]])
  ) as AbstractIntlMessages

  // locale 从外层根 Provider 自动继承，无需重复传递
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}