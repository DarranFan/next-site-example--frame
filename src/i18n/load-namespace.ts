// 翻译对象的类型
type Dict = Record<string, unknown>

// 判断是否为普通对象（不是数组、不是 null）
function isPlainObject(val: unknown): val is Dict {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/**
 * 深度合并两个翻译对象。
 *
 * 规则：
 * - 两者都是对象的字段 → 递归合并（保留英文中 override 未覆盖的 key）
 * - 其他类型（字符串、数组等）→ override 直接替换 base
 * - override 的值为 null/undefined → 保留 base 的值（不覆盖）
 *
 * 示例：
 *   base:     { title: "Welcome", section: { a: "A", b: "B" } }
 *   override: { title: "欢迎",    section: { a: "甲" } }
 *   结果:     { title: "欢迎",    section: { a: "甲", b: "B" } }  ← b 自动用英文填充
 */
export function deepMerge(base: Dict, override: Dict): Dict {
  const result: Dict = { ...base }
  for (const key of Object.keys(override)) {
    const b = base[key]
    const o = override[key]
    result[key] = isPlainObject(b) && isPlainObject(o)
      ? deepMerge(b, o)   // 两者都是对象 → 递归合并
      : o ?? b            // 否则 override 优先，为空则用 base 兜底
  }
  return result
}

/**
 * 加载指定路由的翻译，自动处理：
 * 1. 目标语言文件不存在 → 静默降级为英文，不报错不崩溃
 * 2. 目标语言文件存在但缺少某些 key → 缺失的 key 自动用英文填充
 *
 * @param namespace - 路由名（对应 dictionaries/ 下的文件夹名）
 * @param locale    - 目标语言代码
 *
 * 示例：
 *   loadNamespace('home', 'zh-CN')
 *   → 加载 en/home.json 作为基础，再用 zh-CN/home.json 深度覆盖
 */
export async function loadNamespace(namespace: string, locale: string): Promise<Dict> {
  // 始终先加载英文作为基础（英文是完整的，保证所有 key 都存在）
  const enBase: Dict = await import(`@/dictionaries/${namespace}/en.json`)
    .then((m) => m.default as Dict)
    .catch(() => ({})) // 英文文件也不存在时返回空对象

  // 如果目标语言就是英文，直接返回，无需合并
  if (locale === 'en') return enBase

  // 加载目标语言文件，文件不存在时返回空对象（不报错）
  const localeOverride: Dict = await import(`@/dictionaries/${namespace}/${locale}.json`)
    .then((m) => m.default as Dict)
    .catch(() => ({})) // 文件不存在 → 空对象 → 最终结果为纯英文

  // 深度合并：英文为底，目标语言覆盖已翻译的部分
  return deepMerge(enBase, localeOverride)
}