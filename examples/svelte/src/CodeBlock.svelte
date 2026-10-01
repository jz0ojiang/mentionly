<script lang="ts">
  /*
   * 代码块：Prism 高亮 + 复制按钮，DOM 结构与类名与 Vue 版 CodeBlock.vue 一致
   * （视觉样式在共享层 @playground/shared/styles.css 的 .code-block* 里）。
   */
  import Prism from 'prismjs'

  let {
    code,
    language = 'markup',
    copyLabel,
    copiedLabel,
  }: {
    code: string
    language?: string
    copyLabel: string
    copiedLabel: string
  } = $props()

  let codeEl = $state<HTMLElement>()
  let copied = $state(false)
  let copyTimer: number | null = null

  const displayCode = $derived(code.replace(/<\\\//g, '</'))

  // 由 Svelte 更新 <code> 的内容会被 Prism 改写 innerHTML 破坏，所以这里直接写 textContent
  // 再交给 Prism 高亮（code 文案变化时重跑）。
  $effect(() => {
    const el = codeEl
    const value = displayCode
    if (!el) return
    el.textContent = value
    Prism.highlightElement(el)
  })

  $effect(() => () => {
    if (copyTimer) window.clearTimeout(copyTimer)
  })

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(displayCode)
      copied = true
      if (copyTimer) window.clearTimeout(copyTimer)
      copyTimer = window.setTimeout(() => {
        copied = false
      }, 1200)
    } catch {
      copied = false
    }
  }
</script>

<div class="code-block-wrap">
  <button class="copy-btn" type="button" onclick={onCopy}>
    {copied ? copiedLabel : copyLabel}
  </button>
  <pre class="code-block"><code bind:this={codeEl} class="language-{language}"></code></pre>
</div>
