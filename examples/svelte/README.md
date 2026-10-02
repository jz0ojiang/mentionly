# Mentionly Playground — Svelte 页面

这是 [Mentionly 演示站](../../playground) 的 Svelte 版本：与 Vue 版页面**同样的样式、布局、文案和
演示内容**，只是组件实现与代码块换成了 Svelte 5。线上地址 <https://im0o.top/mentionly/svelte/>
（本地开发 <http://localhost:5181>）。

页面结构与文案来自共享层 `playground/shared`（样式 `styles.css`、文案 `i18n.ts`、演示数据
`demo-data.ts`、分区 `sections.ts`、框架链接 `frameworks.ts`），示例代码在 `src/code.ts`；本应用只
负责用 Svelte 把它们渲染出来。**Svelte 页没有「Deprecated 1.x API」分区**（只有 Vue 页有）。

## 运行

在仓库根目录执行：

```bash
bun install
bun run dev:svelte          # 开发服务器，端口 5181
```

类型检查 / 构建 / 构建到演示站子路径：

```bash
bun run --cwd examples/svelte build          # vite build + svelte-check
bun run --cwd examples/svelte build:pages    # 输出到 playground-dist/svelte（base /mentionly/svelte/）
```

> 示例通过别名直接引用 `packages/svelte/src`（见 `vite.config.ts`），所以不需要先构建
> `@mentionly/svelte` 的 `dist`，改包源码即可热更新。

## 在自己项目里使用

把 `src/MentionInput.svelte` + `src/MentionInput.css` 复制到你的项目，安装依赖：

```bash
npm install @mentionly/svelte
```

组件只依赖 `@mentionly/svelte`、Svelte 本身和这份 CSS（样式类名与 `@mentionly/vue` 一致，
`.mentionly-*`）。三条核心约定来自 `@mentionly/core`：

1. 编辑器是一个空的 `contenteditable` 元素，用 `use:mention.mention` 交给 core；**不要**往里渲染
   Svelte 子节点（内部 DOM 由 core 直接管理）。
2. 候选列表根元素用 `mention.ids.listbox`，每个选项用 `mention.ids.option(index)` —— core 会自动在
   编辑器上写好 `aria-controls` / `aria-activedescendant`。
3. `↑` `↓` `Enter` `Tab` `Esc` 的键盘导航由 core 处理，不要在业务代码里再实现一遍。

```svelte
<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger, Part } from '@mentionly/svelte'

  const triggers: MentionTrigger[] = [
    { char: '@', items: [{ id: 'u1', label: 'Alice' }], toData: (item) => ({ uri: item.id }) },
  ]

  function handleSubmit(parts: Part[]) {
    console.log(JSON.stringify(parts))
  }
</script>

<MentionInput {triggers} onsubmit={handleSubmit} />
```

### Props

| prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `triggers` | `MentionTrigger[]` | 必填 | 触发器配置（`@`、`#`…），数据源可以是数组、同步函数、异步函数或分页函数 |
| `placeholder` | `string` | `''` | 占位文案（`data-placeholder`） |
| `disabled` | `boolean` | `false` | 禁用编辑器 |
| `maxHeight` | `string` | `'200px'` | 编辑器最大高度，超出滚动 |
| `submitOnEnter` | `boolean` | `true` | 列表关闭时 Enter 提交（Shift+Enter 换行）；列表打开时 Enter 始终用于选中候选项 |
| `onenter` | `(event: KeyboardEvent) => void` | – | Enter 提交前的钩子；`event.preventDefault()` 可阻止提交与换行。Svelte 5 事件类 prop 用小写命名，与 `onsubmit` 一致 |
| `popupMode` | `'fixed' \| 'cursor'` | `'fixed'` | 弹窗定位：贴编辑器宽度 / 跟随光标 |
| `popupScrollBehavior` | `'reposition' \| 'close' \| 'ignore'` | `'reposition'` | 页面滚动时弹窗的处理方式 |
| `onsubmit` | `(parts: Part[]) => void` | – | 提交回调（Enter 或 snippet 里的 `submit`），回调后自动 `clear()` |
| `onchange` | `(parts: Part[]) => void` | – | 内容变化回调 |

### Snippets（作用域与 Vue 版的同名 slot 一致）

| snippet | 作用域参数 | 说明 |
| --- | --- | --- |
| `innerActions` | `{ submit, clear, isEmpty }` | 编辑器内部右下角的操作区（如发送按钮） |
| `actions` | `{ submit, clear, isEmpty }` | 编辑器下方的操作栏 |
| `children` | `{ submit, clear, isEmpty, focus, getParts }` | 兜底内容，渲染在最下方（相当于 Vue 的默认 slot） |
| `item` | `{ item, active, select }` | 单个候选项的内容；外层 `role="option"` 与 mousedown 选中仍由组件负责 |
| `list` | `{ items, activeIndex, select, loading, hasMore, loadingMore, loadMore, ids }` | 整个候选列表自己渲染（需要自己使用 `ids` 并处理分页 / 无障碍） |
| `empty` | `{ query }` | 无匹配结果时替换默认的 “No results” |
| `error` | `{ error }` | 数据源出错时替换默认提示 |
| `loading` / `loadingMore` | – | 首屏加载中 / 加载下一页的指示器 |

```svelte
<MentionInput {triggers} onsubmit={handleSubmit}>
  {#snippet innerActions({ submit, isEmpty })}
    <button disabled={isEmpty} onclick={submit}>Send</button>
  {/snippet}

  {#snippet item({ item, active, select })}
    <div class="mention-item" class:active onclick={select}>
      <span class="avatar">{item.label[0]}</span>
      <span>{item.label}</span>
    </div>
  {/snippet}
</MentionInput>
```

### 命令式方法（`bind:this`）

```svelte
<script lang="ts">
  let inputRef: MentionInput | undefined = $state()
</script>

<MentionInput bind:this={inputRef} {triggers} />
<button onclick={() => inputRef?.insertMention({ id: 'ctx-1', label: 'Context #1', data: { source: 'selection' } })}>
  Insert
</button>
```

| 方法 | 说明 |
| --- | --- |
| `insertMention(payload, options?)` | 在光标处插入一个自定义原子节点（`InsertMentionPayload`） |
| `setContent(parts)` | 用 `Part[]` 还原编辑器内容（如加载已保存的草稿） |
| `getParts()` | 序列化为 `Part[]` |
| `clear()` | 清空内容并关闭列表 |
| `focus()` | 聚焦编辑器并把光标放到末尾 |

## 目录

```
examples/svelte/
├── index.html
├── package.json
├── vite.config.ts
└── src/
    ├── App.svelte                     # 整页：页头 / 配置区 / Editor / Output / 各用法演示 / 浮动目录
    ├── MentionInput.svelte            # 可复制到你自己项目的组件
    ├── MentionInput.css               # 组件样式（与 @mentionly/vue 的类名一致）
    ├── CodeBlock.svelte               # prismjs 高亮 + 复制按钮
    ├── FloatingSectionIndicator.svelte# 右侧浮动目录
    ├── FrameworkSwitch.svelte         # Vue / React / Svelte 切换栏
    ├── code.ts                        # 各用法演示的 Svelte 代码片段（en / zh）
    └── main.ts
```
