import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// 导出国际化版本的导航工具，自动处理语言前缀
// 用这些替代 next/navigation 中的同名工具：
//   Link        → 自动加语言前缀的 <a> 标签
//   useRouter   → 保留语言前缀的路由跳转
//   usePathname → 返回不含语言前缀的路径（/test1 而非 /zh-CN/test1）
//   redirect    → 服务端重定向，自动处理语言前缀
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)