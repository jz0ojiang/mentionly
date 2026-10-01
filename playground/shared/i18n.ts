/*
 * 共享层：与框架无关的界面文案（en / zh）。
 * 被 playground(Vue)、examples/react、examples/svelte 三个应用共用。
 *
 * 注意：代码片段（basicCode / advancedCode ...）不在这里 —— 各框架的示例代码只能由各自
 * 应用维护（Vue 见 playground/code.ts），否则共享层会被迫变成框架相关。
 */

export type Locale = 'en' | 'zh'

/** 切换语言 / 生成链接时依赖的顺序 */
export const LOCALES: Locale[] = ['en', 'zh']

/** 界面上所有可本地化的文案；函数型字段按参数生成文案 */
export interface UiStrings {
  hint: [string, string, string, string]
  popupMode: string
  popupFixed: string
  popupCursor: string
  popupScroll: string
  popupScrollReposition: string
  popupScrollClose: string
  popupScrollIgnore: string
  customAt: string
  customAtPreview: (items: string) => string
  placeholder: string
  send: string
  streaming: string
  streamingNote: string
  usageTitle: string
  basicTitle: string
  advancedTitle: string
  avatarTitle: string
  insertTitle: string
  customTriggerTitle: string
  paginationTitle: string
  basicDesc: string
  advancedDesc: string
  avatarDesc: string
  insertDesc: string
  customTriggerDesc: string
  paginationDesc: string
  paginationPlaceholder: string
  copy: string
  copied: string
  waiting: string
  editing: string
  focusEditor: string
  loadSaved: string
  focus: string
  clear: string
  tagBug: string
  tagFeature: string
  tagRefactor: string
  cmdClear: string
  cmdHelp: string
  helpMsg: string
  insertPlaceholder: string
  insertAction: string
  customTriggerPlaceholder: string
  customTriggerVarPath: string
  customTriggerVarBranch: string
  customTriggerVarUser: string
  deprecatedTitle: string
  deprecatedDesc: string
  contextLabel: (index: number) => string
  contextContent: (index: number) => string
}

const en: UiStrings = {
  hint: ['Type ', ' to mention projects, ', ' to mention tags, ', ' to run commands'],
  popupMode: 'Popup mode:',
  popupFixed: 'fixed (above editor)',
  popupCursor: 'cursor (follow caret)',
  popupScroll: 'Scroll behavior:',
  popupScrollReposition: 'reposition (default)',
  popupScrollClose: 'close popup',
  popupScrollIgnore: 'ignore',
  customAt: 'Custom @ data source (comma separated):',
  customAtPreview: (items: string) => `Current items: ${items || '(empty)'}`,
  placeholder: 'Type a message... try @ # /',
  send: 'Send',
  streaming: 'Block Enter submit',
  streamingNote: 'When enabled, Enter is prevented and no newline is inserted.',
  usageTitle: 'Usage',
  basicTitle: 'Basic',
  advancedTitle: 'Disable Enter on demand',
  avatarTitle: 'Custom item with avatar',
  insertTitle: 'Insert mention node by button',
  customTriggerTitle: 'Custom trigger ($)',
  paginationTitle: 'Backend pagination (load more)',
  basicDesc: 'Minimal mention input with submit handling.',
  advancedDesc: 'Block Enter submit when a condition is true and add custom actions.',
  avatarDesc: 'Render an avatar in the dropdown item slot.',
  insertDesc: 'Click a button to insert a custom atomic node via ref.insertMention().',
  customTriggerDesc: 'Define your own trigger and map output with toData.',
  paginationDesc: 'Type @ — 120 users load 15 at a time. Scroll to the bottom or arrow-key near the end to load more.',
  paginationPlaceholder: 'Type @ to search 120 users (paginated)',
  copy: 'Copy',
  copied: 'Copied',
  waiting: 'Waiting for input...',
  editing: 'Editing',
  focusEditor: 'Focus editor',
  loadSaved: 'Load saved',
  focus: 'Focus',
  clear: 'Clear',
  tagBug: 'Design',
  tagFeature: 'Urgent',
  tagRefactor: 'Docs',
  cmdClear: 'Clear input',
  cmdHelp: 'Show help',
  helpMsg: 'Mentionly Playground — Type @ or # to trigger mention',
  insertPlaceholder: 'Click button below to insert context node',
  insertAction: 'Insert context node',
  customTriggerPlaceholder: 'Type $ to mention variables',
  customTriggerVarPath: 'Current workspace path',
  customTriggerVarBranch: 'Current git branch',
  customTriggerVarUser: 'Current user',
  deprecatedTitle: 'Deprecated 1.x API',
  deprecatedDesc:
    'dataPart, schema and getDataParts() still work but are deprecated (removed in 3.0). New code should use toData and getParts().',
  contextLabel: (index: number) => `Context #${index}`,
  contextContent: (index: number) => `Selected snippet content #${index}`,
}

const zh: UiStrings = {
  hint: ['输入 ', ' mention 项目，', ' mention 标签，', ' 执行命令'],
  popupMode: '弹出模式：',
  popupFixed: 'fixed（固定在编辑器上方）',
  popupCursor: 'cursor（跟随光标）',
  popupScroll: '滚动处理：',
  popupScrollReposition: '重新定位（默认）',
  popupScrollClose: '关闭弹窗',
  popupScrollIgnore: '不处理',
  customAt: '自定义 @ 数据源（逗号分隔）：',
  customAtPreview: (items: string) => `当前项：${items || '（空）'}`,
  placeholder: '输入消息... 试试 @ # /',
  send: '发送',
  streaming: '阻止 Enter 提交',
  streamingNote: '开启后 Enter 会被拦截，且不会换行。',
  usageTitle: '用法',
  basicTitle: '基础用法',
  advancedTitle: '按需禁用 Enter',
  avatarTitle: '自定义头像项',
  insertTitle: '按钮插入 mention 节点',
  customTriggerTitle: '自定义触发符（$）',
  paginationTitle: '后端分页（加载更多）',
  basicDesc: '最小化的 mention 输入与提交处理。',
  advancedDesc: '条件满足时阻止 Enter 提交，并自定义操作按钮。',
  avatarDesc: '在下拉项插槽里渲染字母头像。',
  insertDesc: '通过 ref.insertMention()，点击按钮插入自定义原子节点。',
  customTriggerDesc: '定义自己的 trigger，并通过 toData 映射输出结构。',
  paginationDesc: '输入 @ —— 120 个用户每次加载 15 个。滚动到底部或方向键导航接近末尾即可加载更多。',
  paginationPlaceholder: '输入 @ 搜索 120 个用户（分页）',
  copy: '复制',
  copied: '已复制',
  waiting: '等待输入...',
  editing: '编辑中',
  focusEditor: '聚焦编辑器',
  loadSaved: '加载已保存内容',
  focus: '聚焦',
  clear: '清空',
  tagBug: '设计',
  tagFeature: '紧急',
  tagRefactor: '文档',
  cmdClear: '清空输入',
  cmdHelp: '查看帮助',
  helpMsg: 'Mentionly Playground - 输入 @ 或 # 触发 mention',
  insertPlaceholder: '点击下方按钮插入上下文节点',
  insertAction: '插入上下文节点',
  customTriggerPlaceholder: '输入 $ 选择变量',
  customTriggerVarPath: '当前工作区路径',
  customTriggerVarBranch: '当前 git 分支',
  customTriggerVarUser: '当前用户',
  deprecatedTitle: '已废弃的 1.x 接口',
  deprecatedDesc: 'dataPart、schema 与 getDataParts() 仍可用，但已废弃（3.0 移除）。新代码请用 toData 与 getParts()。',
  contextLabel: (index: number) => `上下文 #${index}`,
  contextContent: (index: number) => `选区内容片段 #${index}`,
}

/** 全部文案，按语言索引 */
export const i18n: Record<Locale, UiStrings> = { en, zh }

/** 取某种语言的文案 */
export function uiStrings(locale: Locale): UiStrings {
  return i18n[locale]
}

/** UiStrings 中所有纯文本字段的 key（分区导航用它引用文案） */
export type TextKey = { [K in keyof UiStrings]: UiStrings[K] extends string ? K : never }[keyof UiStrings]
