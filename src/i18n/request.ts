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
  const [common, home, aiDashboardGenerator, aiChartGenerator] = await Promise.all([
    // loadNamespace 第一个参数是 要加载的文件夹名，第二个参数是 目标语言
    // 每添加一个文件 就要在这里添加对应的 loadNamespace 调用
    loadNamespace('common', locale),                           // shell（Header/Footer）翻译
    loadNamespace('home', locale),                             // 首页翻译
    loadNamespace('product/ai-dashboard-generator', locale),   // 仪表盘生成器翻译
    loadNamespace('product/ai-chart-generator', locale),       // 图表生成器翻译
  ])

  return {
    locale,
    // key 即命名空间名，LocalePageIntl 按 key 过滤，保持与路由名一一对应
    // 原来是 messages: { product: { aiDashboardGenerator, aiChartGenerator } }，
    // 改为：messages: { common, home, aiDashboardGenerator, aiChartGenerator }
    // 原因：LocalePageIntl 按顶层 key 过滤翻译再传给客户端组件。嵌套结构下无法单独给某个 product 页面只传自己的翻译，会导致所有 product 翻译都下发到每个页面。拍平后每个页面只拿自己的命名空间。
    messages: { common, home, aiDashboardGenerator, aiChartGenerator },
  }
})