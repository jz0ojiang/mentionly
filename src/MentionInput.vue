<script setup lang="ts">
import { reactive } from 'vue'
import type { MentionTrigger, ContentPart, DataPart, MentionItem, PopupMode } from './types'
import { useMention } from './useMention'
import MentionList from './MentionList.vue'

const props = withDefaults(
  defineProps<{
    triggers: MentionTrigger[]
    placeholder?: string
    disabled?: boolean
    maxHeight?: string
    submitOnEnter?: boolean
    popupMode?: PopupMode
  }>(),
  {
    placeholder: '',
    disabled: false,
    maxHeight: '200px',
    submitOnEnter: true,
    popupMode: 'fixed',
  },
)

const emit = defineEmits<{
  submit: [parts: DataPart[]]
  change: [parts: ContentPart[]]
}>()

defineSlots<{
  list?: (props: {
    items: MentionItem[]
    activeIndex: number
    select: (item: MentionItem) => void
    loading: boolean
  }) => any
  item?: (props: { item: MentionItem; active: boolean; select: () => void }) => any
  empty?: (props: { query: string }) => any
  loading?: (props: {}) => any
  actions?: (props: {
    submit: () => void
    clear: () => void
    isEmpty: boolean
  }) => any
}>()

const {
  editorRef,
  isOpen,
  filteredItems,
  activeIndex,
  query,
  activeTrigger,
  loading,
  popupPosition,
  select,
  close,
  getParts,
  getDataParts,
  getPlainText,
  clear,
  setContent,
  focus,
  isEmpty,
  handlers,
} = useMention(reactive({
  get triggers() { return props.triggers },
  get popupMode() { return props.popupMode },
}))

// 包装 handlers，添加 submit 和 change 逻辑
const wrappedHandlers = {
  ...handlers,
  input: () => {
    handlers.input()
    emit('change', getParts())
  },
  keydown: (e: KeyboardEvent) => {
    if (isOpen.value) {
      handlers.keydown(e)
      // 如果事件未被 preventDefault（列表空时 Enter/Tab 不会 prevent），继续处理
      if (e.defaultPrevented) return
    }

    // Enter 提交
    if (e.key === 'Enter' && !e.shiftKey && props.submitOnEnter) {
      e.preventDefault()
      handleSubmit()
      return
    }

    if (!isOpen.value) {
      handlers.keydown(e)
    }
  },
}

function handleSubmit() {
  if (isEmpty.value) return
  const parts = getDataParts()
  emit('submit', parts)
  clear()
}

defineExpose({
  getParts,
  getDataParts,
  getPlainText,
  clear,
  setContent,
  focus,
})
</script>

<template>
  <div class="mentionly-wrapper" :class="{ 'mentionly-wrapper--disabled': disabled }">
    <div class="mentionly-editor-area">
      <div
        ref="editorRef"
        class="mentionly-editor"
        :contenteditable="!disabled"
        role="textbox"
        aria-multiline="true"
        :aria-expanded="isOpen"
        :aria-placeholder="placeholder"
        :data-placeholder="placeholder"
        :style="{ maxHeight }"
        v-on="wrappedHandlers"
      />

      <!-- 下拉列表 -->
      <div
        v-if="isOpen"
        :class="['mentionly-dropdown', popupMode === 'cursor' ? 'mentionly-dropdown--cursor' : 'mentionly-dropdown--fixed']"
        :style="popupMode === 'cursor' ? { top: popupPosition.top + 'px', left: popupPosition.left + 'px' } : undefined"
      >
        <slot
          name="list"
          :items="filteredItems"
          :active-index="activeIndex"
          :select="select"
          :loading="loading"
        >
          <MentionList
            :items="filteredItems"
            :active-index="activeIndex"
            :loading="loading"
            :query="query"
            @select="select"
          >
            <template v-if="$slots.item" #item="slotProps">
              <slot name="item" v-bind="slotProps" />
            </template>
            <template v-if="$slots.empty" #empty="slotProps">
              <slot name="empty" v-bind="slotProps" />
            </template>
            <template v-if="$slots.loading" #loading>
              <slot name="loading" />
            </template>
          </MentionList>
        </slot>
      </div>
    </div>

    <!-- 操作栏 -->
    <slot name="actions" :submit="handleSubmit" :clear="clear" :is-empty="isEmpty">
    </slot>
  </div>
</template>

<style>
/* ── Editor ── */
.mentionly-wrapper {
  position: relative;
  width: 100%;
}

.mentionly-wrapper--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.mentionly-editor-area {
  position: relative;
}

.mentionly-editor {
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  outline: none;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
  font-size: 14px;
  transition: border-color 0.15s;
}

.mentionly-editor:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.mentionly-editor:empty::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  pointer-events: none;
}

/* ── Mention Span ── */
.mentionly-mention {
  display: inline;
  background-color: #dbeafe;
  color: #1d4ed8;
  border-radius: 4px;
  padding: 1px 4px;
  font-weight: 500;
  user-select: all;
  white-space: nowrap;
}

/* ── Dropdown ── */
.mentionly-dropdown--fixed {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 4px;
  z-index: 50;
}

.mentionly-dropdown--cursor {
  position: absolute;
  z-index: 50;
  transform: translateY(-100%);
  margin-top: -4px;
  width: max-content;
  min-width: 200px;
  max-width: 320px;
}

.mentionly-list {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
}

.mentionly-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.1s;
}

.mentionly-list-item:hover,
.mentionly-list-item--active {
  background-color: #f3f4f6;
}

.mentionly-list-item-label {
  font-weight: 500;
  color: #111827;
}

.mentionly-list-item-desc {
  color: #6b7280;
  font-size: 12px;
}

.mentionly-list-empty,
.mentionly-list-loading {
  padding: 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
</style>
