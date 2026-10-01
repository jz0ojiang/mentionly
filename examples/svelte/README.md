# mentionly Svelte 5 示例

`@mentionly/svelte` 的可运行示例：一个 `contenteditable` 编辑器 + 候选列表，支持

- `@` 提及用户（静态数据）
- `#` 引用话题（异步 + 分页，滚动到底部加载更多）
- 键盘导航（`↑` `↓` 选择、`Enter` / `Tab` 选中、`Esc` 关闭）由 `@mentionly/core` 处理
- 列表关闭时按 `Enter` 或点击「发送」，把 `getParts()` 得到的 `Part[]` 交给回调

## 运行

在仓库根目录执行：

```bash
bun install
bun run --cwd examples/svelte dev
```

然后打开 <http://localhost:5181>。

类型检查 / 构建：

```bash
bun run --cwd examples/svelte build   # vite build + svelte-check
```

> 示例通过别名直接引用 `packages/svelte/src`（见 `vite.config.ts`），所以不需要先构建
> `@mentionly/svelte` 的 `dist`，改包源码即可热更新。

## 在自己项目里使用

把 `src/MentionInput.svelte` 复制到你的项目，安装依赖：

```bash
npm install @mentionly/svelte
```

组件对外只有三个 props：

| prop | 类型 | 说明 |
| --- | --- | --- |
| `triggers` | `MentionTrigger[]` | 触发器配置（`@`、`#`…），数据源可以是数组、同步函数或异步函数 |
| `placeholder` | `string` | 占位文案 |
| `onsubmit` | `(parts: Part[]) => void` | 列表关闭时按 Enter / 点击发送后的回调 |

```svelte
<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger, Part } from '@mentionly/svelte'

  const triggers: MentionTrigger[] = [
    { char: '@', items: [{ id: 'u1', label: 'Alice' }] },
    {
      char: '#',
      pagination: { pageSize: 10 },
      items: async (query, page) => {
        const res = await fetch(`/api/topics?q=${query}&offset=${page?.offset ?? 0}`)
        return res.json() as Promise<{ items: { id: string; label: string }[]; hasMore: boolean }>
      },
      toData: (item) => ({ slug: item.id }),
    },
  ]

  function handleSubmit(parts: Part[]) {
    console.log(JSON.stringify(parts))
  }
</script>

<MentionInput {triggers} onsubmit={handleSubmit} />
```

### 只有 3 个约定

组件本身很薄，关键约定只有三条（都来自 `@mentionly/core`）：

1. 编辑器元素上 `use:mention.mention` —— 挂载时绑定 `setElement()` + `start()`，销毁时清理。
2. 候选列表根元素 `id={mention.ids.listbox}`，每个选项 `id={mention.ids.option(index)}` ——
   `aria-controls` / `aria-activedescendant` 由 core 自动写在编辑器上。
3. 点击选项调用 `mention.select(item)`；键盘导航不要自己实现，core 已经处理。

`mention.state` 是 `$state` 镜像，直接读 `state.isOpen` / `filteredItems` / `activeIndex` /
`loading` / `hasMore` 等即可。

## 目录

```
examples/svelte/
├── index.html
├── package.json
├── vite.config.ts
└── src/
    ├── App.svelte          # 演示两个 trigger + 显示提交后的 Part[]
    ├── MentionInput.svelte # 可复制到你自己项目的完整示例组件
    ├── app.css
    └── main.ts
```
