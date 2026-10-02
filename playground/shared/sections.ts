/*
 * 共享层：右侧浮动目录（FloatingSectionIndicator）用的分区列表。
 * 被 playground(Vue)、examples/react、examples/svelte 三个应用共用；
 * 只有 Vue 页有「Deprecated 1.x API」小节，所以它单独标记、按需拼进去。
 */
import type { TextKey, UiStrings } from './i18n'

export interface SectionDef {
  /** 页面上的 section id（也是 TOC 滚动定位用的锚点） */
  id: string
  /** 固定文案（与语言无关，如 "Playground"），优先于 labelKey */
  label?: string
  /** 取自 UiStrings 的文案 key */
  labelKey?: TextKey
}

/** 三个应用共有、且顺序一致的分区 */
export const SECTIONS: SectionDef[] = [
  { id: 'sec-config', label: 'Playground' },
  { id: 'sec-editor', label: 'Editor' },
  { id: 'sec-output', label: 'Submit Output' },
  { id: 'sec-basic', labelKey: 'basicTitle' },
  { id: 'sec-custom-trigger', labelKey: 'customTriggerTitle' },
  { id: 'sec-advanced', labelKey: 'advancedTitle' },
  { id: 'sec-avatar', labelKey: 'avatarTitle' },
  { id: 'sec-insert', labelKey: 'insertTitle' },
  { id: 'sec-pagination', labelKey: 'paginationTitle' },
]

/** 仅 Vue 页存在的分区（「Deprecated 1.x API」） */
export const DEPRECATED_SECTION: SectionDef = { id: 'sec-deprecated', labelKey: 'deprecatedTitle' }

/** 解析出 TOC 需要的 { id, label } 列表；includeDeprecated 打开时追加 Vue 独有的分区 */
export function resolveSections(t: UiStrings, options: { includeDeprecated?: boolean } = {}): { id: string; label: string }[] {
  const defs = options.includeDeprecated ? [...SECTIONS, DEPRECATED_SECTION] : SECTIONS
  return defs.map((def) => ({
    id: def.id,
    label: def.label ?? (def.labelKey ? t[def.labelKey] : def.id),
  }))
}
