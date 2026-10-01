<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import Prism from 'prismjs'
// 代码块的视觉样式与 prism 主题都在共享层：@playground/shared/styles.css

const props = withDefaults(
  defineProps<{
    code: string
    language?: string
    copyLabel: string
    copiedLabel: string
  }>(),
  {
    language: 'markup',
  },
)

const codeEl = ref<HTMLElement | null>(null)
const copied = ref(false)
let copyTimer: number | null = null

const displayCode = computed(() => props.code.replace(/<\\\//g, '</'))

function highlight() {
  if (!codeEl.value) return
  Prism.highlightElement(codeEl.value)
}

async function onCopy() {
  try {
    await navigator.clipboard.writeText(displayCode.value)
    copied.value = true
    if (copyTimer) window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => {
      copied.value = false
    }, 1200)
  } catch {
    copied.value = false
  }
}

onMounted(() => highlight())
watch(displayCode, async () => {
  await nextTick()
  highlight()
})
</script>

<template>
  <div class="code-block-wrap">
    <button class="copy-btn" type="button" @click="onCopy">
      {{ copied ? copiedLabel : copyLabel }}
    </button>
    <pre class="code-block"><code ref="codeEl" :class="`language-${language}`">{{ displayCode }}</code></pre>
  </div>
</template>
