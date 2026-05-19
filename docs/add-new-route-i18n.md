# 新增路由国际化指南

## 整体架构

```
请求进来
  └─ request.ts          → 并行加载所有命名空间的翻译文件，合并为 messages 对象
       └─ layout.tsx     → pickShellMessages 只取 common 等壳层翻译传给根 Provider
            └─ page.tsx  → LocalePageIntl 按命名空间取该页面的翻译传给客户端组件
```

**核心原则**：每个页面只把自己的翻译下发给客户端，不互相污染。

---

## 新增路由需要改动的文件

| 文件 | 操作 |
|---|---|
| `src/dictionaries/<namespace>/en.json` | 新建，英文翻译（必须完整） |
| `src/dictionaries/<namespace>/<locale>.json` | 新建，目标语言翻译 |
| `src/i18n/request.ts` | 注册命名空间 |
| `src/i18n/segment-client-namespaces.ts` | 添加命名空间常量 |
| `src/app/[locale]/.../page.tsx` | 新建页面，接入 i18n |

**不需要改动**：`shell-messages.ts`、`routing.ts`、`load-namespace.ts`、`LocalePageIntl.tsx`

---

## 完整示例：新增 product 路由

以新增 `/product/ai-dashboard-generator` 和 `/product/ai-chart-generator` 两个路由为例。

### 第一步：新建翻译文件

每个路由对应 `src/dictionaries/` 下一个文件夹，文件夹名即命名空间名。

**英文（必须完整，作为所有语言的兜底）**

`src/dictionaries/product/ai-dashboard-generator/en.json`
```json
{
  "title": "AI Dashboard Generator",
  "description": "Create stunning dashboards powered by AI in seconds.",
  "button": "Get Started"
}
```

`src/dictionaries/product/ai-chart-generator/en.json`
```json
{
  "title": "AI Chart Generator",
  "description": "Generate beautiful charts from your data with the power of AI.",
  "button": "Get Started"
}
```

**目标语言（缺少的 key 自动用英文填充，无需翻译每一条）**

`src/dictionaries/product/ai-dashboard-generator/zh-CN.json`
```json
{
  "title": "AI 仪表盘生成器",
  "description": "秒级生成由 AI 驱动的精美仪表盘。",
  "button": "立即开始"
}
```

`src/dictionaries/product/ai-chart-generator/zh-CN.json`
```json
{
  "title": "AI 图表生成器",
  "description": "借助 AI 的力量，从数据中生成精美图表。",
  "button": "立即开始"
}
```

---

### 第二步：注册命名空间（`request.ts`）

在 `Promise.all` 加载列表和 `messages` 对象中各添加一项。

**命名规则**：文件夹路径转为小驼峰作为 key。
- `product/ai-dashboard-generator` → `aiDashboardGenerator`
- `product/ai-chart-generator` → `aiChartGenerator`

```ts
// src/i18n/request.ts

const [common, home, aiDashboardGenerator, aiChartGenerator] = await Promise.all([
  loadNamespace('common', locale),
  loadNamespace('home', locale),
  loadNamespace('product/ai-dashboard-generator', locale),  // ← 新增
  loadNamespace('product/ai-chart-generator', locale),      // ← 新增
])

return {
  locale,
  messages: { common, home, aiDashboardGenerator, aiChartGenerator },  // ← 新增两个 key
}
```

> **注意**：messages 使用扁平结构，每个命名空间是顶层 key。
> 嵌套结构（如 `product: { aiDashboardGenerator }`）会导致 `LocalePageIntl`
> 无法按单个路由过滤翻译，所有 product 翻译会下发到每个 product 页面。

---

### 第三步：添加命名空间常量（`segment-client-namespaces.ts`）

```ts
// src/i18n/segment-client-namespaces.ts

/** `/[locale]/product/ai-dashboard-generator` */
export const AI_DASHBOARD_GENERATOR_PAGE_NAMESPACES = ['aiDashboardGenerator'] as const

/** `/[locale]/product/ai-chart-generator` */
export const AI_CHART_GENERATOR_PAGE_NAMESPACES = ['aiChartGenerator'] as const
```

这里的字符串必须与 `request.ts` 中 `messages` 的 key 完全一致。

---

### 第四步：实现页面文件

照此模板逐字段替换，不要遗漏任何一项。

```tsx
// src/app/[locale]/product/ai-dashboard-generator/page.tsx

import { setRequestLocale, getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import LocalePageIntl from '@/components/LocalePageIntl'
import { AI_DASHBOARD_GENERATOR_PAGE_NAMESPACES } from '@/i18n/segment-client-namespaces'

// SEO：生成多语言 title / description / hreflang
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

  // 启用静态渲染（SSG），必须在任何异步操作之前调用
  setRequestLocale(locale)

  // 服务端获取翻译，namespace 对应 request.ts messages 中的 key
  const t = await getTranslations('aiDashboardGenerator')

  return (
    // 包裹 LocalePageIntl，使该页面内的客户端组件可访问 aiDashboardGenerator 翻译
    <LocalePageIntl namespaces={AI_DASHBOARD_GENERATOR_PAGE_NAMESPACES}>
      <div className="flex flex-col flex-1 items-center justify-center">
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
        <button>{t('button')}</button>
      </div>
    </LocalePageIntl>
  )
}
```

`ai-chart-generator/page.tsx` 同理，将所有 `aiDashboardGenerator` 替换为 `aiChartGenerator`，路径替换为 `/product/ai-chart-generator`。

---

## 翻译缺失时的兜底行为

`load-namespace.ts` 中的 `loadNamespace` 实现了自动降级：

1. **目标语言文件不存在** → 静默降级为英文，不报错
2. **目标语言文件存在但缺少某些 key** → 缺失的 key 自动用英文填充

因此翻译文件可以**增量翻译**，不必一次性翻译所有字段。

---

## 快速检查清单

新增路由后，逐项确认：

- [ ] `en.json` 已创建且字段完整
- [ ] 目标语言 `.json` 已创建（即使内容为空 `{}` 也没关系）
- [ ] `request.ts` 的 `Promise.all` 已添加 `loadNamespace`
- [ ] `request.ts` 的 `messages` 对象已添加对应 key（顶层，非嵌套）
- [ ] `segment-client-namespaces.ts` 已添加常量
- [ ] `page.tsx` 包含 `setRequestLocale`、`getTranslations`、`generateMetadata`、`LocalePageIntl`
