import { routing } from '@/i18n/routing'

// 从环境变量读取域名，本地开发默认为 localhost:3000
// 部署时在 .env 中设置：NEXT_PUBLIC_BASE_URL=https://your-domain.com
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

// 构建指定语言和路径的完整 URL
// 英文（默认语言）不加前缀：/  或  /test1
// 其他语言加前缀：/zh-CN  或  /zh-CN/test1
function localePath(locale: string, path: string) {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`
  const suffix = path === '/' ? '' : path
  return `${BASE_URL}${prefix}${suffix}`
}

/**
 * 生成页面的 SEO 多语言链接。
 * 在 generateMetadata 中使用，告诉搜索引擎同一内容的不同语言版本。
 *
 * @param locale - 当前页面语言
 * @param path   - 页面路径（不含语言前缀），如 '/' 或 '/test1'
 *
 * 生成的 HTML：
 *   <link rel="canonical" href="https://example.com/zh-CN/test1" />
 *   <link rel="alternate" hreflang="en" href="https://example.com/test1" />
 *   <link rel="alternate" hreflang="zh-CN" href="https://example.com/zh-CN/test1" />
 *   <link rel="alternate" hreflang="fr" href="https://example.com/fr/test1" />
 */
export function buildAlternates(locale: string, path: string = '/') {
  return {
    canonical: localePath(locale, path),
    languages: Object.fromEntries(
      routing.locales.map((l) => [l, localePath(l, path)])
    ),
  }
}