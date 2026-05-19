// 从 routing.ts 统一导出，保持向后兼容
export { routing } from './routing'
export type { Locale } from './routing'
// 这里的 locales 和 defaultLocale 需要与 routing.ts 中的 locales 和 defaultLocale 保持一致
// 同时也要和 dictionaries 中的文件夹名保持一致
// 例如：dictionaries/common/en.json 对应 en
// 例如：dictionaries/common/zh-CN.json 对应 zh-CN
// 例如：dictionaries/common/fr.json 对应 fr
// 例如：dictionaries/common/ar.json 对应 ar
export const locales = ['en', 'zh-CN', 'ar'] as const
export const defaultLocale = 'en' as const
