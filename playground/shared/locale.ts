/*
 * 共享层：语言检测与带 lang 参数的链接生成（纯函数，无框架依赖）。
 * 被 playground(Vue)、examples/react、examples/svelte 三个应用共用。
 */
import type { Locale } from './i18n'

/**
 * 检测当前语言：`?lang=en|zh` 优先，否则看浏览器语言（zh 开头即中文，其余英文）。
 * 参数可省略，默认读 `window.location.search` / `navigator.language`（SSR 下安全降级为 en）。
 */
export function detectLocale(search?: string, language?: string): Locale {
  const query = search ?? (typeof window === 'undefined' ? '' : window.location.search)
  const fromUrl = new URLSearchParams(query).get('lang')
  if (fromUrl === 'zh' || fromUrl === 'en') return fromUrl
  const nav = language ?? (typeof navigator === 'undefined' ? '' : navigator.language)
  return nav.startsWith('zh') ? 'zh' : 'en'
}

/** 另一种语言（语言切换按钮用） */
export function alternateLocale(locale: Locale): Locale {
  return locale === 'en' ? 'zh' : 'en'
}

/**
 * 给 URL 补上 `lang` 参数（覆盖已有值），便于切换框架时保持语言不变。
 * 相对路径、绝对路径与完整 URL 都按原样保留，只改查询串。
 */
export function withLangParam(href: string, locale: Locale): string {
  const hashAt = href.indexOf('#')
  const hash = hashAt === -1 ? '' : href.slice(hashAt)
  const withoutHash = hashAt === -1 ? href : href.slice(0, hashAt)
  const queryAt = withoutHash.indexOf('?')
  const path = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt)
  const params = new URLSearchParams(queryAt === -1 ? '' : withoutHash.slice(queryAt + 1))
  params.set('lang', locale)
  return `${path}?${params.toString()}${hash}`
}
