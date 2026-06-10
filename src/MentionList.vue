<script setup lang="ts">
import { watch, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { MentionItem } from './types'

const props = withDefaults(defineProps<{
  items: MentionItem[]
  activeIndex: number
  loading: boolean
  query: string
  hasMore?: boolean
  loadingMore?: boolean
}>(), {
  hasMore: false,
  loadingMore: false,
})

const emit = defineEmits<{
  select: [item: MentionItem]
  'load-more': []
}>()

defineSlots<{
  item?: (props: { item: MentionItem; active: boolean; select: () => void }) => any
  empty?: (props: { query: string }) => any
  loading?: (props: {}) => any
  'loading-more'?: (props: {}) => any
}>()

const listRef = ref<HTMLElement | null>(null)

watch(() => props.activeIndex, () => {
  const container = listRef.value
  if (!container) return
  const active = container.querySelector('.mentionly-list-item--active') as HTMLElement | null
  if (active) {
    active.scrollIntoView({ block: 'nearest' })
  }
}, { flush: 'post' })

// ── 分页：滚动接近底部 / 内容未填满容器时加载下一页 ──
const NEAR_BOTTOM_PX = 24
let rafPending = false

function requestLoadMore() {
  if (props.hasMore && !props.loadingMore) emit('load-more')
}

function onScroll() {
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    rafPending = false
    const el = listRef.value
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX) requestLoadMore()
  })
}

// 首屏/追加后若内容撑不满容器（无法滚动），自动补下一页直到填满或没有更多
function checkFill() {
  const el = listRef.value
  if (!el) return
  if (el.scrollHeight <= el.clientHeight + 1) requestLoadMore()
}

watch(() => props.items.length, () => nextTick(checkFill), { flush: 'post' })

onMounted(() => {
  listRef.value?.addEventListener('scroll', onScroll, { passive: true })
  nextTick(checkFill)
})

onBeforeUnmount(() => {
  listRef.value?.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div ref="listRef" class="mentionly-list" role="listbox" :aria-busy="loading || loadingMore">
    <slot v-if="loading" name="loading">
      <div class="mentionly-list-loading">Loading...</div>
    </slot>
    <template v-else-if="items.length > 0">
      <div
        v-for="(item, index) in items"
        :key="item.id"
        :class="['mentionly-list-item', { 'mentionly-list-item--active': index === activeIndex }]"
        role="option"
        :aria-selected="index === activeIndex"
        @mousedown.prevent="emit('select', item)"
      >
        <slot name="item" :item="item" :active="index === activeIndex" :select="() => emit('select', item)">
          <span class="mentionly-list-item-label">{{ item.label }}</span>
          <span v-if="item.desc" class="mentionly-list-item-desc">{{ item.desc }}</span>
        </slot>
      </div>
      <slot v-if="loadingMore" name="loading-more">
        <div class="mentionly-list-more" role="status" aria-live="polite">Loading more...</div>
      </slot>
    </template>
    <slot v-else name="empty" :query="query">
      <div class="mentionly-list-empty">No results</div>
    </slot>
  </div>
</template>
