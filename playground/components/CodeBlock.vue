<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import Prism from 'prismjs'
import 'prismjs/themes/prism-okaidia.css'

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

<style>
.code-block {
  font-size: 12px;
  background: #0f172a;
  color: #e2e8f0;
  padding: 14px;
  border-radius: 6px;
  overflow-x: auto;
  line-height: 1.5;
}

.code-block code,
.code-block[class*="language-"] {
  font-size: 12px;
}

.code-block-wrap {
  position: relative;
}

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  border: 1px solid rgba(226, 232, 240, 0.3);
  background: rgba(15, 23, 42, 0.75);
  color: #e2e8f0;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
}

.copy-btn:hover {
  background: rgba(15, 23, 42, 0.9);
}
</style>
