# mentionly React playground 页面

`examples/react` 是 [Mentionly 演示站](https://im0o.top/mentionly/react/) 的 **React 页面**，
与 Vue 版（`playground/`）、Svelte 版（`examples/svelte`）展示同样的分区、布局、文案和演示数据：

- 界面文案来自共享层 `playground/shared/i18n.ts`，演示数据 / triggers 来自 `demo-data.ts`，
  样式来自 `shared/styles.css`，语言与框架链接来自 `shared/locale.ts` / `shared/frameworks.ts`。
- 页面分区：Playground 配置、Editor、Submit Output，以及 Usage 下的基础用法、自定义触发符（$）、
  按需禁用 Enter、自定义头像项、按钮插入 mention 节点、后端分页（加载更多）。
- 示例代码是 React 语法，见 `src/code.ts`。

## 运行

在仓库根目录先装依赖（bun workspaces）：

```bash
bun install
```

然后启动页面（开发端口 5180）：

```bash
bun run dev:react
```

其他命令：

```bash
bun run --cwd examples/react build         # 类型检查 + 构建到 examples/react/dist
bun run build:playground                   # 构建整站（Vue 根 + React / Svelte 子路径）
```

Vite 配置把 `@mentionly/react` / `@mentionly/core` alias 到 `packages/*/src`，改包源码即时热更新，
不需要先 build。

## 把 MentionInput 复制到你的项目

`src/MentionInput.tsx` + `src/MentionInput.css` 就是「可复制」的完整组件，依赖只有
`@mentionly/react`、`react` 和这个 CSS 文件：

```bash
cp examples/react/src/MentionInput.{tsx,css} your-app/src/components/
```

```tsx
import { MentionInput } from './components/MentionInput'
import type { MentionTrigger, Part } from '@mentionly/react'

const TRIGGERS: MentionTrigger[] = [
  { char: '@', items: [{ id: 'u1', label: 'Alice' }] },
]

<MentionInput triggers={TRIGGERS} onSubmit={(parts: Part[]) => send(parts)} />
```

样式类名沿用 Vue 版 `@mentionly/vue` 的 `.mentionly-*`，直接改成你自己的设计即可；其中
`.mentionly-mention` 是 core 插入 mention 节点时固定使用的类名，不要改。

## 组件 API

### Props

| prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `triggers` | `MentionTrigger[]` | — | 触发器配置。数据变化时用 state / `useMemo` 保持稳定引用（见下方「踩点」） |
| `placeholder` | `string` | `''` | 占位文案（`data-placeholder` + `:empty::before`） |
| `disabled` | `boolean` | `false` | 禁用编辑 |
| `maxHeight` | `string` | `'200px'` | 编辑器最大高度（CSS 长度） |
| `submitOnEnter` | `boolean` | `true` | 列表关闭时 Enter 提交（Shift+Enter 换行；列表打开时 Enter 始终选中候选项） |
| `onEnter` | `(e: KeyboardEvent) => void` | — | Enter 且列表关闭时触发；调用 `e.preventDefault()` 可阻止提交（例如流式输出中） |
| `popupMode` | `'fixed' \| 'cursor'` | `'fixed'` | 弹窗定位：固定在编辑器上方 / 跟随光标 |
| `popupScrollBehavior` | `'reposition' \| 'close' \| 'ignore'` | `'reposition'` | 滚动时的弹窗行为 |
| `onSubmit` | `(parts: Part[]) => void` | — | 提交回调，收到 `getParts()` 的 `Part[]`（提交后自动清空） |
| `onChange` | `(parts: Part[]) => void` | — | 内容变化回调 |

### 插槽 → render props

Vue 版的 `<slot>` 在这里对应成 render props（`children` 是函数形式）：

| Vue slot | React | 参数 |
| --- | --- | --- |
| `#inner-actions` | `renderInnerActions` | `{ submit, clear, isEmpty }` |
| `#actions` | `renderActions` | `{ submit, clear, isEmpty }` |
| `#item` | `renderItem` | `{ item, active, select }` |
| `#list` | `renderList` | `{ items, activeIndex, select, loading, hasMore, loadingMore, loadMore, query, ids }` |
| `#empty` | `renderEmpty` | `{ query }` |
| `#loading` | `renderLoading` | — |
| `#loading-more` | `renderLoadingMore` | — |
| `#error` | `renderError` | `{ error }` |
| `#default` | `children` | `{ submit, clear, isEmpty, focus, getParts }` |

```tsx
<MentionInput
  triggers={TRIGGERS}
  onSubmit={send}
  renderInnerActions={({ submit, isEmpty }) => (
    <button disabled={isEmpty} onClick={submit}>发送</button>
  )}
  renderItem={({ item, active, select }) => (
    <div className={`mention-item${active ? ' active' : ''}`} onClick={select}>
      <span className="avatar">{item.label[0]}</span>
      <span>{item.label}</span>
    </div>
  )}
>
  {({ isEmpty, focus }) => (
    <div className="extra-info">
      <span>{isEmpty ? '等待输入...' : '编辑中'}</span>
      <button onClick={focus}>聚焦编辑器</button>
    </div>
  )}
</MentionInput>
```

### ref 方法（`MentionInputHandle`）

对应 Vue 的 `ref` / `defineExpose`：

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `insertMention` | `(payload: InsertMentionPayload, options?: InsertMentionOptions) => boolean` | 在当前光标处插入一个原子 mention 节点 |
| `setContent` | `(parts: Part[]) => void` | 用 `Part[]` 反序列化填充编辑器 |
| `getParts` | `() => Part[]` | 序列化为 `Part[]` |
| `getPlainText` | `() => string` | 取纯文本 |
| `clear` | `() => void` | 清空 |
| `focus` | `() => void` | 聚焦编辑器 |
| `ids` | `MentionCoreIds` | core 生成的无障碍 id（自定义列表渲染时用） |

```tsx
const inputRef = useRef<MentionInputHandle>(null)

inputRef.current?.insertMention({ id: 'ctx-1', label: '上下文 #1', data: { kind: 'context' } })
```

## 三个容易踩的点

1. **`triggers` 引用要稳定**。模块级常量或 `useMemo` / state。每次渲染都新建数组会让 hook 重新
   `setOptions`，从而关闭列表并作废在途请求（开发模式下会看到
   `[mentionly/react] \`triggers\` changed on every render` 的 warning）。
2. **不要往编辑器 div 里渲染 React 子节点**。那个 contenteditable 的内部 DOM 完全由 core
   管理，React 的重渲染会和它打架。placeholder 用 `data-placeholder` + `:empty::before` 实现。
3. **键盘导航不要自己写**。↑ ↓ Enter Tab Esc 都已经在 core 里实现（含 IME 处理）；组件只在列表
   关闭时处理 Enter 提交，以及 `onEnter` 回调。

自定义列表时还要记住：列表根用 `ids.listbox`、选项用 `ids.option(i)` 并带
`role="listbox"` / `role="option"` / `aria-selected`，core 会自动在编辑器上设置
`aria-controls` / `aria-activedescendant`；编辑器自己不要写 `role`。

## 目录

```
src/
  main.tsx                        # 入口 + 共享层样式
  App.tsx                         # playground 页面（各分区与 Vue 版逐项对应）
  code.ts                         # 各演示区的 React 示例代码（en / zh）
  MentionInput.tsx                # 可复制的组件（props / render props / ref 方法）
  MentionInput.css
  components/
    CodeBlock.tsx                 # prismjs 高亮的代码块
    FloatingSectionIndicator.tsx  # 右侧浮动目录
    FrameworkSwitch.tsx           # Vue / React / Svelte 切换栏
```
