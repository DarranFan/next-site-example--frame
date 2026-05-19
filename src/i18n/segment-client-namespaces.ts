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

/** `/[locale]/product/ai-dashboard-generator` */
export const AI_DASHBOARD_GENERATOR_PAGE_NAMESPACES = ['aiDashboardGenerator'] as const

/** `/[locale]/product/ai-chart-generator` */
export const AI_CHART_GENERATOR_PAGE_NAMESPACES = ['aiChartGenerator'] as const