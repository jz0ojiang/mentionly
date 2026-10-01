/*
 * 共享层入口：playground(Vue)、examples/react、examples/svelte 三个应用共用。
 *
 * 用法（三个应用一致）：
 *   import { i18n, detectLocale, createDemoTriggers, resolveSections } from '@playground/shared'
 *   import '@playground/shared/styles.css'
 *
 * 各文件职责：
 *   styles.css   全部页面视觉样式（含 prism 主题、pg-fsi-* 浮动目录、框架切换栏）
 *   i18n.ts      与框架无关的界面文案（en / zh）
 *   locale.ts    语言检测与带 lang 参数的链接生成
 *   demo-data.ts 演示数据与 triggers 定义
 *   sections.ts  浮动目录的分区列表
 *   frameworks.ts 框架清单与切换链接（也被三个 vite 配置复用）
 */
export * from './i18n'
export * from './locale'
export * from './demo-data'
export * from './sections'
export * from './frameworks'
