import { setRequestLocale, getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import LocalePageIntl from '@/components/LocalePageIntl'
import { AI_CHART_GENERATOR_PAGE_NAMESPACES } from '@/i18n/segment-client-namespaces'

export async function generateMetadata({ params }: PageProps<'/[locale]/product/ai-chart-generator'>) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'aiChartGenerator' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: buildAlternates(locale, '/product/ai-chart-generator'),
  }
}

export default async function AiChartGeneratorPage({ params }: PageProps<'/[locale]/product/ai-chart-generator'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('aiChartGenerator')

  return (
    <LocalePageIntl namespaces={AI_CHART_GENERATOR_PAGE_NAMESPACES}>
      <div className="flex flex-col flex-1 items-center justify-center">
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
        <button>{t('button')}</button>
      </div>
    </LocalePageIntl>
  )
}
