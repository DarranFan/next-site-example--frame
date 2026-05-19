import { setRequestLocale, getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import LocalePageIntl from '@/components/LocalePageIntl'
import { AI_DASHBOARD_GENERATOR_PAGE_NAMESPACES } from '@/i18n/segment-client-namespaces'

export async function generateMetadata({ params }: PageProps<'/[locale]/product/ai-dashboard-generator'>) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'aiDashboardGenerator' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: buildAlternates(locale, '/product/ai-dashboard-generator'),
  }
}

export default async function AiDashboardGeneratorPage({ params }: PageProps<'/[locale]/product/ai-dashboard-generator'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('aiDashboardGenerator')

  return (
    <LocalePageIntl namespaces={AI_DASHBOARD_GENERATOR_PAGE_NAMESPACES}>
      <div className="flex flex-col flex-1 items-center justify-center">
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
        <button>{t('button')}</button>
      </div>
    </LocalePageIntl>
  )
}
