import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// 告诉 next-intl 在哪里找消息加载入口
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // 其他 Next.js 配置...
}

// 用 next-intl 插件包装配置
export default withNextIntl(nextConfig)