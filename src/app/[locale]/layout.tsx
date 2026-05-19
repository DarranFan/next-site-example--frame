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