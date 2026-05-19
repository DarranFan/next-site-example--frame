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