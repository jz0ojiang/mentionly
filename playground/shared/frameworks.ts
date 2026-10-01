/*
 * 共享层：三个应用的框架清单与「框架切换栏」链接生成。
 * 被 playground(Vue)、examples/react、examples/svelte 三个应用共用，也被三个 vite 配置
 * 复用来取开发 / 生产两套地址前缀。
 *
 * 生产部署（GitHub Pages，站点根为 /mentionly/）：Vue 在 /mentionly/，React、Svelte 在子路径。
 * 本地开发：三个应用跑在不同端口，链接直接指向对应端口。
 */
import type { Locale } from './i18n'
import { withLangParam } from './locale'

export type FrameworkId = 'vue' | 'react' | 'svelte'

export interface Framework {
  id: FrameworkId
  label: string
  /** 相对 /mentionly/ 的部署子路径（vue 为站点根） */
  path: string
}

export const FRAMEWORKS: Framework[] = [
  { id: 'vue', label: 'Vue', path: '' },
  { id: 'react', label: 'React', path: 'react/' },
  { id: 'svelte', label: 'Svelte', path: 'svelte/' },
]

/** 每个应用的地址前缀 */
export type FrameworkBases = Record<FrameworkId, string>

/** 本地开发：playground 5173，examples/react 5180，examples/svelte 5181 */
export const DEV_FRAMEWORK_BASES: FrameworkBases = {
  vue: 'http://localhost:5173/',
  react: 'http://localhost:5180/',
  svelte: 'http://localhost:5181/',
}

/** 生产：GitHub Pages 站点根 /mentionly/ 下的三条路径 */
export const PROD_FRAMEWORK_BASES: FrameworkBases = {
  vue: '/mentionly/',
  react: '/mentionly/react/',
  svelte: '/mentionly/svelte/',
}

// 由各应用的 vite 配置通过 define 注入（见 vite.playground.ts / examples/*/vite.config.ts）；
// 未注入时按生产路径处理。
declare const __PLAYGROUND_FRAMEWORK_BASES__: FrameworkBases | undefined

export const FRAMEWORK_BASES: FrameworkBases =
  typeof __PLAYGROUND_FRAMEWORK_BASES__ === 'undefined' ? PROD_FRAMEWORK_BASES : __PLAYGROUND_FRAMEWORK_BASES__

/** 某个框架在本站点（或本地开发端口）的地址，保留当前语言 */
export function frameworkHref(id: FrameworkId, locale: Locale): string {
  return withLangParam(FRAMEWORK_BASES[id], locale)
}
