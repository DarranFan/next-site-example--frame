'use client' // 语言切换需要用户交互，必须是客户端组件

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

// 每种语言在下拉菜单中显示的名称（用该语言本身书写）
const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  'zh-CN': '中文',
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
    // 例如：当前在 /zh-CN/test1，切换到英文后跳到 /test1
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