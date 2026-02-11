<script setup lang="ts">
import type { MentionItem } from './types'

defineProps<{
  items: MentionItem[]
  activeIndex: number
  loading: boolean
  query: string
}>()

const emit = defineEmits<{
  select: [item: MentionItem]
}>()

defineSlots<{
  item?: (props: { item: MentionItem; active: boolean; select: () => void }) => any
  empty?: (props: { query: string }) => any
  loading?: (props: {}) => any
}>()
</script>

<template>
  <div class="mentionly-list" role="listbox">
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
    </template>
    <slot v-else name="empty" :query="query">
      <div class="mentionly-list-empty">No results</div>
    </slot>
  </div>
</template>
