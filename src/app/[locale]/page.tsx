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