import type { ReactNode } from 'react'

/**
 * Next.js 要求存在根 layout，但实际的 html/body/lang 由
 * [locale]/layout.tsx 提供（因为那里才知道当前语言）。
 * 根 layout 只做透传，不添加任何 DOM 结构。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}