import { ref, computed, onMounted, onBeforeUnmount, watch, type Ref } from 'vue'
import { MentionCore } from '@mentionly/core'
import type { UseMentionOptions, MentionItem, PopupPosition, MentionState } from '@mentionly/core'
import type { UseMentionReturn } from './types'

/**
 * Vue adapter（薄壳）：把 framework-agnostic 的 {@link MentionCore} 状态镜像进 Vue ref，
 * 对外 API 与历史完全一致。核心逻辑全部在 core 里，这里只负责响应式桥接与生命周期。
 */
export function useMention(options: UseMentionOptions): UseMentionReturn {
  const core = new MentionCore(options)
  const editorRef: Ref<HTMLElement | null> = ref(null)

  // ── 把 core 快照镜像进 ref（保持现有返回形状） ──
  const isOpen = ref(false)
  const filteredItems: Ref<MentionItem[]> = ref([])
  const activeIndex = ref(0)
  const query = ref('')
  const activeTrigger: Ref<string | null> = ref(null)
  const loading = ref(false)
  const error = ref<unknown | null>(null)
  const loadingMore = ref(false)
  const hasMore = ref(false)
  const popupPosition: Ref<PopupPosition> = ref({ top: 0, left: 0 })
  const isEmptyInner = ref(true)
  // 保持对外类型为 ComputedRef（历史 API）
  const isEmpty = computed(() => isEmptyInner.value)

  function sync(s: MentionState) {
    isOpen.value = s.isOpen
    filteredItems.value = s.filteredItems
    activeIndex.value = s.activeIndex
    query.value = s.query
    activeTrigger.value = s.activeTrigger
    loading.value = s.loading
    error.value = s.error
    loadingMore.value = s.loadingMore
    hasMore.value = s.hasMore
    popupPosition.value = s.popupPosition
    isEmptyInner.value = s.isEmpty
  }

  const unsubscribe = core.subscribe(sync)
  sync(core.getState())

  // ⚠ editorRef 在 mount 后才被赋值（现有测试 + headless 用法都是 api.editorRef.value = el）。
  //   必须 flush:'sync'，否则 `editorRef.value = el; core.select()` 这种同步链里 core 还没拿到元素。
  watch(editorRef, (el) => core.setElement(el), { immediate: true, flush: 'sync' })

  // viewport 监听生命周期挂一次；Vue 组件自己包装 handlers（submit/change）→ bindHandlers: false
  onMounted(() => core.start({ bindHandlers: false }))
  onBeforeUnmount(() => {
    unsubscribe()
    core.stop()
    core.setElement(null)
  })

  // setOptions 覆盖全部字段（含 insertSpaceAfter，select() 会用到）。
  // flush:'sync'：在同一 tick 里改完 triggers 后立即序列化 / 选中，必须已经用上新配置。
  watch(
    () => ({
      triggers: options.triggers,
      insertSpaceAfter: options.insertSpaceAfter,
      popupMode: options.popupMode,
      popupScrollBehavior: options.popupScrollBehavior,
    }),
    (next) => core.setOptions(next),
    { deep: true, flush: 'sync' },
  )

  return {
    editorRef,
    isOpen,
    filteredItems,
    activeIndex,
    query,
    activeTrigger,
    loading,
    error,
    ids: core.ids,
    popupPosition,
    hasMore,
    loadingMore,
    select: core.select,
    insertMention: core.insertMention,
    loadMore: core.loadMore,
    close: core.close,
    getParts: core.getParts,
    getDataParts: core.getDataParts,
    getPlainText: core.getPlainText,
    clear: core.clear,
    setContent: core.setContent,
    focus: core.focus,
    isEmpty,
    handlers: core.handlers,
  }
}
