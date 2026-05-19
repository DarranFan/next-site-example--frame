import { defineRouting } from 'next-intl/routing'
import { defaultLocale, locales } from './config'

export const routing = defineRouting({
  // 支持的语言列表，第一个为默认语言
  locales,

  // 默认语言
  defaultLocale,

  // 'as-needed'：默认语言不加前缀（URL 为 /），其他语言加前缀（/zh-CN、/fr、/ar）
  // 'always'：所有语言都加前缀（包括 /en）
  // 'never'：所有语言都不加前缀（需要其他方式区分语言）
  localePrefix: 'as-needed',
})

// 导出语言类型，供其他文件使用
export type Locale = (typeof routing.locales)[number]