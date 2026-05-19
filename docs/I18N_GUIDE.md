# Next.js 国际化（i18n）完整搭建指南

基于 **Next.js 16 + next-intl 4.x**，实现以下特性：

- ✅ 默认语言（英文）URL 不带前缀，`/` 而非 `/en/`
- ✅ 翻译文件按路由拆分，懒加载，不打包在一起
- ✅ 缺失翻译自动降级为英文（key 级别 fallback）
- ✅ 服务端/客户端组件均可使用翻译
- ✅ 语言切换器，切换后路径不变，偏好写入 cookie 持久化
- ✅ SEO：每个页面生成 `hreflang` 多语言链接
- ✅ RTL 语言支持（阿拉伯语等）
- ✅ 静态预渲染（SSG），所有语言页面构建时生成

---

## 目录结构总览

```
src/
├── proxy.ts                          # 路由处理（Next.js 16 中 middleware 的新名称）
├── i18n/
│   ├── routing.ts                    # 语言列表、默认语言、前缀策略
│   ├── request.ts                    # next-intl 的消息加载入口
│   ├── load-namespace.ts             # 翻译加载工具（支持 fallback 和深度合并）
│   ├── navigation.ts                 # 国际化导航工具（Link、useRouter 等）
│   ├── shell-messages.ts             # 提取 shell（Header/Footer）所需的最小翻译集
│   ├── segment-client-namespaces.ts  # 每个路由段需要暴露给客户端的命名空间
│   └── config.ts                     # 从 routing.ts 重新导出（向后兼容）
├── components/
│   ├── LanguageSwitcher.tsx          # 语言切换组件
│   └── LocalePageIntl.tsx            # 路由段级别的客户端翻译 Provider
├── lib/
│   └── seo.ts                        # SEO 工具：生成 canonical 和 hreflang
├── dictionaries/                     # 翻译文件，按路由名 / 语言组织
│   ├── common/                       # 全局 shell 翻译（Header/Footer 用）
│   │   ├── en.json
│   │   ├── zh.json
│   │   ├── fr.json
│   │   └── ar.json
│   ├── home/                         # 首页翻译
│   │   ├── en.json
│   │   └── ...
│   └── [route-name]/                 # 每新增一个路由，建对应文件夹
│       ├── en.json
│       └── ...
└── app/
    ├── layout.tsx                    # 最小根 layout（html/body 由 [locale]/layout 提供）
    └── [locale]/
        ├── layout.tsx                # 国际化主 layout（html lang/dir、字体、Provider）
        ├── page.tsx                  # 首页
        └── [route]/
            └── page.tsx              # 各路由页面
```

---

## 第一步：安装依赖

```bash
# next-intl：国际化核心库
# server-only：标记文件为服务端专用，防止翻译文件泄漏到客户端 bundle
pnpm add next-intl server-only

# 如果需要阿拉伯语等 RTL 语言，需要对应的字体（可选）
# 字体通过 next/font/google 按需加载，无需单独安装
```

---

## 第二步：配置语言列表

### `src/i18n/routing.ts`

```typescript
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  // 支持的语言列表，第一个为默认语言
  locales: ['en', 'zh', 'fr', 'ar'],

  // 默认语言
  defaultLocale: 'en',

  // 'as-needed'：默认语言不加前缀（URL 为 /），其他语言加前缀（/zh、/fr、/ar）
  // 'always'：所有语言都加前缀（包括 /en）
  // 'never'：所有语言都不加前缀（需要其他方式区分语言）
  localePrefix: 'as-needed',
})

// 导出语言类型，供其他文件使用
export type Locale = (typeof routing.locales)[number]
```

---

## 第三步：翻译加载工具

### `src/i18n/load-namespace.ts`

```typescript
// 翻译对象的类型
type Dict = Record<string, unknown>

// 判断是否为普通对象（不是数组、不是 null）
function isPlainObject(val: unknown): val is Dict {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/**
 * 深度合并两个翻译对象。
 *
 * 规则：
 * - 两者都是对象的字段 → 递归合并（保留英文中 override 未覆盖的 key）
 * - 其他类型（字符串、数组等）→ override 直接替换 base
 * - override 的值为 null/undefined → 保留 base 的值（不覆盖）
 *
 * 示例：
 *   base:     { title: "Welcome", section: { a: "A", b: "B" } }
 *   override: { title: "欢迎",    section: { a: "甲" } }
 *   结果:     { title: "欢迎",    section: { a: "甲", b: "B" } }  ← b 自动用英文填充
 */
export function deepMerge(base: Dict, override: Dict): Dict {
  const result: Dict = { ...base }
  for (const key of Object.keys(override)) {
    const b = base[key]
    const o = override[key]
    result[key] = isPlainObject(b) && isPlainObject(o)
      ? deepMerge(b, o)   // 两者都是对象 → 递归合并
      : o ?? b            // 否则 override 优先，为空则用 base 兜底
  }
  return result
}

/**
 * 加载指定路由的翻译，自动处理：
 * 1. 目标语言文件不存在 → 静默降级为英文，不报错不崩溃
 * 2. 目标语言文件存在但缺少某些 key → 缺失的 key 自动用英文填充
 *
 * @param namespace - 路由名（对应 dictionaries/ 下的文件夹名）
 * @param locale    - 目标语言代码
 *
 * 示例：
 *   loadNamespace('home', 'zh')
 *   → 加载 en/home.json 作为基础，再用 zh/home.json 深度覆盖
 */
export async function loadNamespace(namespace: string, locale: string): Promise<Dict> {
  // 始终先加载英文作为基础（英文是完整的，保证所有 key 都存在）
  const enBase: Dict = await import(`@/dictionaries/${namespace}/en.json`)
    .then((m) => m.default as Dict)
    .catch(() => ({})) // 英文文件也不存在时返回空对象

  // 如果目标语言就是英文，直接返回，无需合并
  if (locale === 'en') return enBase

  // 加载目标语言文件，文件不存在时返回空对象（不报错）
  const localeOverride: Dict = await import(`@/dictionaries/${namespace}/${locale}.json`)
    .then((m) => m.default as Dict)
    .catch(() => ({})) // 文件不存在 → 空对象 → 最终结果为纯英文

  // 深度合并：英文为底，目标语言覆盖已翻译的部分
  return deepMerge(enBase, localeOverride)
}
```

---

## 第四步：next-intl 消息加载入口

### `src/i18n/request.ts`

```typescript
import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'
import { loadNamespace } from './load-namespace'

// next-intl 在每次请求时调用此函数，加载该请求语言的所有翻译
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale

  // 如果请求的语言不在支持列表中，降级为默认语言（英文）
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  // 并行加载所有命名空间，每个 import() 是独立的 webpack chunk
  // 注意：新增路由时，在这里添加对应的 loadNamespace 调用
  const [common, home, test1, test2] = await Promise.all([
    loadNamespace('common', locale), // shell（Header/Footer）翻译
    loadNamespace('home', locale),   // 首页翻译
    loadNamespace('test1', locale),  // test1 页翻译
    loadNamespace('test2', locale),  // test2 页翻译
  ])

  return {
    locale,
    // 所有翻译合并为一个对象，key 为命名空间名
    messages: { common, home, test1, test2 },
  }
})
```

---

## 第五步：配置 Next.js 插件

### `next.config.ts`

```typescript
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// 告诉 next-intl 在哪里找消息加载入口
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // 其他 Next.js 配置...
}

// 用 next-intl 插件包装配置
export default withNextIntl(nextConfig)
```

---

## 第六步：路由中间件（proxy）

> ⚠️ Next.js 16 将 `middleware.ts` 重命名为 `proxy.ts`，导出函数名也从 `middleware` 改为 `proxy`。

### `src/proxy.ts`

```typescript
import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'

// next-intl 内置功能（无需手写）：
// 1. 检测 URL 中的语言前缀，自动 rewrite/redirect
// 2. 读取 Accept-Language header，新用户首次访问自动匹配语言
// 3. 读取 NEXT_LOCALE cookie，记住用户上次的语言选择
const intlMiddleware = createMiddleware(routing)

// Next.js 16 要求导出名为 proxy 的函数（旧版为 middleware）
export function proxy(request: NextRequest) {
  return intlMiddleware(request)
}

// 指定哪些路径需要经过此 proxy
// 排除：_next（Next.js 内部）、api（接口）、静态文件（含 . 的路径）
export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
}
```

---

## 第七步：导航工具

### `src/i18n/navigation.ts`

```typescript
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// 导出国际化版本的导航工具，自动处理语言前缀
// 用这些替代 next/navigation 中的同名工具：
//   Link        → 自动加语言前缀的 <a> 标签
//   useRouter   → 保留语言前缀的路由跳转
//   usePathname → 返回不含语言前缀的路径（/test1 而非 /zh/test1）
//   redirect    → 服务端重定向，自动处理语言前缀
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
```

---

## 第八步：翻译分层工具

### `src/i18n/shell-messages.ts`

```typescript
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
```

### `src/i18n/segment-client-namespaces.ts`

```typescript
/**
 * 每个路由段需要传给客户端的命名空间列表。
 * 配合 LocalePageIntl 使用（见第十步）。
 *
 * 规则：
 * - shell（Header/Footer）已由根 layout 提供，不需要重复列
 * - 这里只列该路由的页面内容命名空间
 * - 新增路由时，在这里添加对应的常量
 */

/** `/[locale]` — 首页 */
export const HOME_PAGE_NAMESPACES = ['home'] as const

/** `/[locale]/test1` */
export const TEST1_PAGE_NAMESPACES = ['test1'] as const

/** `/[locale]/test2` */
export const TEST2_PAGE_NAMESPACES = ['test2'] as const

// 新增路由示例：
// /** `/[locale]/dashboard` */
// export const DASHBOARD_PAGE_NAMESPACES = ['dashboard'] as const
```

---

## 第九步：SEO 工具

### `src/lib/seo.ts`

```typescript
import { routing } from '@/i18n/routing'

// 从环境变量读取域名，本地开发默认为 localhost:3000
// 部署时在 .env 中设置：NEXT_PUBLIC_BASE_URL=https://your-domain.com
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

// 构建指定语言和路径的完整 URL
// 英文（默认语言）不加前缀：/  或  /test1
// 其他语言加前缀：/zh  或  /zh/test1
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
 *   <link rel="canonical" href="https://example.com/zh/test1" />
 *   <link rel="alternate" hreflang="en" href="https://example.com/test1" />
 *   <link rel="alternate" hreflang="zh" href="https://example.com/zh/test1" />
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
```

---

## 第十步：组件

### `src/components/LanguageSwitcher.tsx`

```typescript
'use client' // 语言切换需要用户交互，必须是客户端组件

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

// 每种语言在下拉菜单中显示的名称（用该语言本身书写）
const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  zh: '中文',
  fr: 'Français',
  ar: 'العربية',
  // 新增语言时，在这里添加显示名称
}

export default function LanguageSwitcher() {
  const locale = useLocale()           // 获取当前语言
  const router = useRouter()           // 国际化路由（来自 navigation.ts）
  const pathname = usePathname()       // 当前路径（不含语言前缀）
  const t = useTranslations('common') // 读取 common 命名空间的翻译

  function switchLocale(next: string) {
    // 将用户选择的语言写入 cookie，next-intl middleware 下次请求时读取
    // max-age=31536000 = 1 年，用户关闭浏览器后依然记住语言偏好
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`

    // 跳转到同一路径的目标语言版本
    // 例如：当前在 /zh/test1，切换到英文后跳到 /test1
    router.replace(pathname, { locale: next })
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {/* 显示 "Language:" / "语言:" / "Langue:" 等，来自 common 翻译 */}
      <span className="text-zinc-500">{t('lang')}:</span>
      <select
        value={locale}
        onChange={(e) => switchLocale(e.target.value)}
        className="border border-zinc-200 rounded px-2 py-1 text-sm bg-white
                   cursor-pointer hover:border-zinc-400 transition-colors"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  )
}
```

### `src/components/LocalePageIntl.tsx`

```typescript
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
```

---

## 第十一步：应用 Layout

### `src/app/layout.tsx`（根 layout，最小化）

```typescript
import type { ReactNode } from 'react'

/**
 * Next.js 要求存在根 layout，但实际的 html/body/lang 由
 * [locale]/layout.tsx 提供（因为那里才知道当前语言）。
 * 根 layout 只做透传，不添加任何 DOM 结构。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
```

### `src/app/[locale]/layout.tsx`（国际化主 layout）

```typescript
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale, getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Geist, Geist_Mono, Noto_Sans_Arabic } from 'next/font/google'
import { routing } from '@/i18n/routing'
import { pickShellMessages } from '@/i18n/shell-messages'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import '../globals.css'

// 加载字体（模块级别，所有页面共用）
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

// 阿拉伯语字体：仅在 locale=ar 时将 CSS 变量注入 <html>
// globals.css 中的 :lang(ar) 规则引用此变量，非阿拉伯页面不下载字体
const notoArabic = Noto_Sans_Arabic({
  variable: '--font-noto-arabic',
  subsets: ['arabic'],
  display: 'swap', // 字体加载期间先用系统字体，避免页面闪烁
})

// RTL 语言列表（从右往左书写的语言）
// 需要新增 RTL 语言时，在此数组添加语言代码即可
const RTL_LOCALES: string[] = ['ar', 'he', 'fa']

// 告诉 Next.js 构建时预渲染哪些语言的页面（生成静态文件）
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const { locale } = await params

  // 如果 URL 中的语言不在支持列表中，返回 404 页面
  if (!hasLocale(routing.locales, locale)) notFound()

  // 关键：告知 next-intl 当前语言是静态已知的
  // 有了这行，Next.js 才能将页面标记为 SSG（● 静态）而非动态（ƒ）
  setRequestLocale(locale)

  // 获取全量 messages，然后只取 shell 部分传给客户端
  // 这样页面内容翻译（home/test1/test2）不会进入客户端 bundle
  const allMessages = await getMessages()
  const shellMessages = pickShellMessages(allMessages)

  // 判断是否为 RTL 语言
  const isRtl = RTL_LOCALES.includes(locale)

  return (
    <html
      lang={locale}                          // 告诉浏览器和搜索引擎当前页面语言
      dir={isRtl ? 'rtl' : 'ltr'}           // RTL 语言自动镜像页面布局
      className={[
        geistSans.variable,
        geistMono.variable,
        isRtl ? notoArabic.variable : '',    // 只在 RTL 语言时注入阿拉伯字体变量
        'h-full antialiased',
      ].join(' ')}
    >
      <body className="min-h-full flex flex-col">
        {/*
          根 Provider：只提供 shell 翻译（common 等）
          所有页面的客户端组件都能访问这里的翻译
        */}
        <NextIntlClientProvider locale={locale} messages={shellMessages}>
          <header className="flex items-center px-6 py-3 border-b border-zinc-100">
            {/* ms-auto = margin-inline-start: auto，LTR 推到右侧，RTL 推到左侧 */}
            <div className="ms-auto">
              <LanguageSwitcher />
            </div>
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

---

## 第十二步：翻译文件（字典）

每个路由对应一个文件夹，文件夹内按语言命名：

### `src/dictionaries/common/en.json`（shell 全局翻译）

```json
{
  "lang": "Language"
}
```

### `src/dictionaries/home/en.json`（首页翻译，每页 3 个字段）

```json
{
  "title": "Welcome",
  "description": "This is the home page",
  "button": "Get Started"
}
```

### `src/dictionaries/home/zh.json`

```json
{
  "title": "欢迎",
  "description": "这是首页",
  "button": "开始使用"
}
```

> 其他语言和路由的文件结构相同，字段名保持一致，只翻译字段值。  
> **如果某个语言的文件缺少某些 key，会自动用英文填充，不会报错。**

---

## 第十三步：页面写法

每个页面遵循固定模式：

### `src/app/[locale]/page.tsx`（首页示例）

```typescript
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import LocalePageIntl from '@/components/LocalePageIntl'
import { HOME_PAGE_NAMESPACES } from '@/i18n/segment-client-namespaces'

// SEO：为每个语言版本生成标题、描述和 hreflang 链接
export async function generateMetadata({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  // 注意：generateMetadata 中需要手动传入 locale
  const t = await getTranslations({ locale, namespace: 'home' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: buildAlternates(locale, '/'), // 生成所有语言的 hreflang
  }
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params

  // 与 layout.tsx 中一样，启用静态渲染
  setRequestLocale(locale)

  // 服务端获取翻译（不需要传 locale，会从上下文自动获取）
  const t = await getTranslations('home')

  return (
    // 包裹 LocalePageIntl，使页面内的客户端组件可以访问 home 命名空间的翻译
    // 目前没有客户端组件也建议加上，方便后续添加
    <LocalePageIntl namespaces={HOME_PAGE_NAMESPACES}>
      <div className="flex flex-col flex-1 items-center justify-center">
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
        <button>{t('button')}</button>
      </div>
    </LocalePageIntl>
  )
}
```

---

## 第十四步：globals.css 添加 RTL 字体规则

### `src/app/globals.css`

```css
@import "tailwindcss";

/* RTL 语言字体：只在 lang=ar 时生效，其他语言不加载此字体 */
:lang(ar) {
  font-family: var(--font-noto-arabic), sans-serif;
}
```

---

## 日常开发：新增路由

以新增 `/dashboard` 页面为例，需要改 4 个地方：

### 1. 新建翻译文件

```bash
mkdir src/dictionaries/dashboard
touch src/dictionaries/dashboard/en.json
touch src/dictionaries/dashboard/zh.json
touch src/dictionaries/dashboard/fr.json
touch src/dictionaries/dashboard/ar.json
```

```json
// src/dictionaries/dashboard/en.json
{
  "title": "Dashboard",
  "description": "Your personal dashboard",
  "button": "View Reports"
}
```

### 2. 在 `request.ts` 中加载新命名空间

```typescript
// src/i18n/request.ts
const [common, home, test1, test2, dashboard] = await Promise.all([
  loadNamespace('common', locale),
  loadNamespace('home', locale),
  loadNamespace('test1', locale),
  loadNamespace('test2', locale),
  loadNamespace('dashboard', locale), // ← 新增这行
])

return {
  locale,
  messages: { common, home, test1, test2, dashboard }, // ← 加入 messages
}
```

### 3. 在 `segment-client-namespaces.ts` 中注册

```typescript
// src/i18n/segment-client-namespaces.ts
export const DASHBOARD_PAGE_NAMESPACES = ['dashboard'] as const // ← 新增这行
```

### 4. 创建页面文件

```typescript
// src/app/[locale]/dashboard/page.tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import LocalePageIntl from '@/components/LocalePageIntl'
import { DASHBOARD_PAGE_NAMESPACES } from '@/i18n/segment-client-namespaces'

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard'>) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: buildAlternates(locale, '/dashboard'),
  }
}

export default async function DashboardPage({ params }: PageProps<'/[locale]/dashboard'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard')

  return (
    <LocalePageIntl namespaces={DASHBOARD_PAGE_NAMESPACES}>
      <div>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </div>
    </LocalePageIntl>
  )
}
```

---

## 日常开发：新增语言

以新增日语（`ja`）为例：

### 1. 在 `routing.ts` 中加入语言代码

```typescript
locales: ['en', 'zh', 'fr', 'ar', 'ja'], // ← 加入 'ja'
```

### 2. 在 `config.ts` 中同步

```typescript
export const locales = ['en', 'zh', 'fr', 'ar', 'ja'] as const // ← 加入 'ja'
```

### 3. 新建所有路由的日语翻译文件

```bash
touch src/dictionaries/common/ja.json
touch src/dictionaries/home/ja.json
touch src/dictionaries/test1/ja.json
touch src/dictionaries/test2/ja.json
# ... 每个已有路由的字典文件夹都要加
```

### 4. 在 `LanguageSwitcher.tsx` 中加入显示名称

```typescript
const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  zh: '中文',
  fr: 'Français',
  ar: 'العربية',
  ja: '日本語', // ← 新增
}
```

> 如果某些 ja 翻译文件暂时没写，或者写了部分——
> `loadNamespace` 会自动用英文填充缺失的 key，**整站不会崩溃**。

---

## 客户端组件使用翻译

当页面内有客户端组件需要翻译时（`'use client'` 组件）：

```typescript
// src/components/SomeClientComponent.tsx
'use client'

import { useTranslations } from 'next-intl'

export default function SomeClientComponent() {
  // 该组件在 /[locale]/test1 页面中使用
  // 根 Provider 提供 common，LocalePageIntl 提供 test1
  // 所以这里可以同时使用两个命名空间
  const common = useTranslations('common')
  const t = useTranslations('test1')

  return (
    <div>
      <p>{common('lang')}</p>  {/* "Language" */}
      <h1>{t('title')}</h1>    {/* "Test Page 1" */}
    </div>
  )
}
```

> **前提**：该组件必须在对应的 `LocalePageIntl` 包裹范围内，
> 否则只能访问 shell 翻译（`common` 等）。

---

## 翻译层级示意图

```
根 layout NextIntlClientProvider
  └── { common }                   ← 所有页面的客户端组件都能用

      / （首页）
        LocalePageIntl
          └── { home }             ← 首页客户端组件能用

      /test1
        LocalePageIntl
          └── { test1 }            ← test1 客户端组件能用

      /test2
        LocalePageIntl
          └── { test2 }            ← test2 客户端组件能用
```

服务端组件直接 `getTranslations('任意命名空间')`，不受 Provider 限制。

---

## 构建验证

```bash
pnpm build
```

正确配置后，构建输出应显示 `●`（SSG 静态预渲染），而非 `ƒ`（动态渲染）：

```
Route (app)
├ ● /[locale]
│ ├ /en
│ ├ /zh
│ ├ /fr
│ └ /ar
├ ● /[locale]/test1
│ ├ /en/test1
│ └ ...
```

如果显示 `ƒ`，检查：

1. 是否在每个 layout/page 中调用了 `setRequestLocale(locale)`
2. 是否在页面中使用了 `headers()`、`cookies()` 等动态 API

---

## 依赖版本参考

```json
{
  "next": "16.2.6",
  "next-intl": "^4.11.2",
  "server-only": "^0.0.1"
}
```

