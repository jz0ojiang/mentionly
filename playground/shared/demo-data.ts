/*
 * 共享层：playground 的全部演示数据与 triggers 定义（无框架依赖）。
 * 被 playground(Vue)、examples/react、examples/svelte 三个应用共用：三个页面演示同一批数据。
 * 需要语言的文案通过 UiStrings 传入；需要由应用接管的行为（清空输入、弹帮助）通过参数注入。
 */
import type { InsertMentionPayload, MentionItem, MentionTrigger, Part } from '@mentionly/core'
import type { Locale, UiStrings } from './i18n'

/** 把逗号分隔的字符串解析成 @ 数据源条目（当前 Vue 版「自定义 @ 数据源」输入框） */
export function parseCustomAtItems(input: string): MentionItem[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label, i) => ({ id: String(i + 1), label }))
}

/** `@` 触发器：项目 mention */
export function createAtTrigger(items: MentionItem[]): MentionTrigger {
  return {
    char: '@',
    items,
    toData: (item: MentionItem) => ({
      dataType: 'mentioned_ref',
      projectId: item.id,
      projectName: item.label,
    }),
  }
}

/** `#` 触发器：标签 mention */
export function createTagTrigger(t: UiStrings): MentionTrigger {
  return {
    char: '#',
    items: [
      { id: 't1', label: 'design', desc: t.tagBug },
      { id: 't2', label: 'urgent', desc: t.tagFeature },
      { id: 't3', label: 'docs', desc: t.tagRefactor },
    ],
    toData: (item: MentionItem) => ({
      dataType: 'tag_ref',
      tagId: item.id,
      tagName: item.label,
    }),
  }
}

/** command 模式下应用要接管的动作 */
export interface CommandHandlers {
  clear: () => void
  help: () => void
}

/** `/` 触发器：命令模式 */
export function createCommandTrigger(t: UiStrings, handlers: CommandHandlers): MentionTrigger {
  return {
    char: '/',
    mode: 'command',
    items: [
      { id: 'clear', label: 'clear', desc: t.cmdClear },
      { id: 'help', label: 'help', desc: t.cmdHelp },
    ],
    onSelect: (item: MentionItem) => {
      if (item.id === 'clear') handlers.clear()
      if (item.id === 'help') handlers.help()
    },
  }
}

/** 编辑器主区的触发器集合：@ 项目、# 标签、/ 命令 */
export function createDemoTriggers(t: UiStrings, customAtItems: MentionItem[], handlers: CommandHandlers): MentionTrigger[] {
  return [createAtTrigger(customAtItems), createTagTrigger(t), createCommandTrigger(t, handlers)]
}

/** 「自定义触发符（$）」演示 */
export function createCustomTriggerDemo(t: UiStrings): MentionTrigger[] {
  return [
    {
      char: '$',
      items: [
        { id: 'var-1', label: 'workspace.path', desc: t.customTriggerVarPath },
        { id: 'var-2', label: 'workspace.branch', desc: t.customTriggerVarBranch },
        { id: 'var-3', label: 'request.user', desc: t.customTriggerVarUser },
      ],
      toData: (item: MentionItem) => ({
        dataType: 'variable_ref',
        variableId: item.id,
        key: item.label,
      }),
    },
  ]
}

/** 分页演示用的大数据源：120 个用户 */
export const ALL_USERS: MentionItem[] = Array.from({ length: 120 }, (_, i) => ({
  id: `u-${i + 1}`,
  label: `User ${String(i + 1).padStart(3, '0')}`,
  desc: `#${i + 1}`,
}))

/** 「后端分页（加载更多）」演示：每页 15 条 + 模拟网络延迟 */
export function createPaginationTrigger(): MentionTrigger {
  return {
    char: '@',
    pagination: { pageSize: 15 },
    items: (query: string, page?: { offset: number; limit: number }) => {
      const matched = ALL_USERS.filter((u) => u.label.toLowerCase().includes(query.toLowerCase()))
      const offset = page?.offset ?? 0
      const limit = page?.limit ?? matched.length
      const slice = matched.slice(offset, offset + limit)
      // 模拟网络延迟，便于看到 "Loading more..." 指示器
      return new Promise<MentionItem[]>((resolve) => setTimeout(() => resolve(slice), 400))
    },
    toData: (item: MentionItem) => ({ dataType: 'user_ref', userId: item.id, name: item.label }),
  }
}

/** 「按钮插入 mention 节点」演示用的 payload */
export function createInsertPayload(t: UiStrings, index: number): InsertMentionPayload {
  return {
    id: `ctx-${index}`,
    label: t.contextLabel(index),
    data: {
      dataType: 'context_ref',
      contextId: `ctx-${index}`,
      source: 'selection',
      content: t.contextContent(index),
    },
  }
}

/** 「加载已保存内容」演示：按语言给出不同的已保存片段 */
export function getSavedParts(locale: Locale): Part[] {
  if (locale === 'zh') {
    return [
      { type: 'text', text: '请检查 ' },
      { type: 'mention', trigger: '@', id: '1', label: 'Project Alpha' },
      { type: 'text', text: ' 的部署状态' },
    ]
  }
  return [
    { type: 'text', text: 'Check ' },
    { type: 'mention', trigger: '@', id: '1', label: 'Project Alpha' },
    { type: 'text', text: ' deployment status' },
  ]
}
