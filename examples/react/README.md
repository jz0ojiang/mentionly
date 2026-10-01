# mentionly React 示例

一个可运行的 Vite + React 示例，演示 `@mentionly/react` 的 headless hook 怎么接出一个
完整的 mention 输入框：

- `@` 提及用户：静态数组，即时过滤。
- `#` 提及话题：异步函数数据源 + 分页（每页 6 条），滚动到底或点「加载更多」加载下一页。
- 提交（列表关闭时按 Enter）后把 `getParts()` 返回的 `Part[]` 以 JSON 展示出来。

## 运行

在仓库根目录先装依赖（bun workspaces）：

```bash
bun install
```

然后启动示例：

```bash
bun run --cwd examples/react dev      # 开发服务器
bun run --cwd examples/react build    # 类型检查 + 生产构建到 examples/react/dist
```

示例的 Vite 配置把 `@mentionly/react` / `@mentionly/core` alias 到了 `packages/*/src`，
改包源码会即时热更新，不需要先 build。

## 把 MentionInput 复制到你的项目

`src/MentionInput.tsx` + `src/MentionInput.css` 就是「可复制」的完整组件，依赖只有
`@mentionly/react` 和 `react`：

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

复制后按需改的部分：

- **样式**：类名都带 `mi-` 前缀，直接改成你自己的设计即可。注意 mention 节点/候选列表的
  语义类名来自 core，`.mentionly-mention` 是 core 插入的 span 固定使用的类名。
- **列表渲染**：`ids.listbox` / `ids.option(i)` 必须保留（core 用它们设置
  `aria-controls` / `aria-activedescendant`），`role="listbox"` / `role="option"` /
  `aria-selected` 也一样。
- **提交逻辑**：`onSubmit` 拿到的是 `Part[]`（`{type:'text'}` / `{type:'mention'}`），
  直接发给你的后端或转成别的格式。

三个容易踩的点：

1. **`triggers` 必须是稳定引用**（模块级常量或 `useMemo`）。在 JSX 里内联 `triggers={[...]}`
   会让每次渲染都是新数组，hook 会重新 `setOptions` 从而关闭列表；开发模式下看到
   `[mentionly/react] \`triggers\` changed on every render` 的 warning 就是这个原因。
2. **不要往编辑器 div 里渲染 React 子节点**。那个 contenteditable 的内部 DOM 完全由 core
   管理，React 的重渲染会和它打架。需要 placeholder 就用 `data-placeholder` + `:empty::before`
   （示例里就是这么做的）。
3. **键盘导航不要自己写**。↑ ↓ Enter Tab Esc 都已经在 core 里实现（含 IME 处理）；你只需要
   在列表关闭时处理 Enter 提交（示例里的 `handleKeyDown` 就是干这个的）。

## 目录

```
src/
  main.tsx           # 入口
  App.tsx            # 两个 trigger 的演示 + 提交结果展示
  MentionInput.tsx   # 可复制的示例组件
  MentionInput.css
```
