/**
 * 一个「可直接复制到自己项目」的完整 mention 输入框组件（React 版）。
 *
 * 复制方式：把 MentionInput.tsx + MentionInput.css 拷到你的项目，改样式即可
 * （依赖只有 @mentionly/react、react 和这个 CSS 文件）。
 *
 * 三条要点（与 Vue 版一致）：
 * 1. 编辑器是空的 contenteditable <div>，通过 hook 的 `ref` 交给 core。
 *    ⚠ 不要往这个 div 里渲染 React 子节点 —— 内部 DOM（mention span、光标等）由 core 直接管理。
 * 2. 候选列表的 id 必须用 `ids.listbox` / `ids.option(i)`：core 会自动在编辑器上设置
 *    aria-controls / aria-activedescendant 指向它们（并补上 role="combobox"，编辑器自己不要写 role）。
 * 3. ↑ ↓ Enter Tab Esc 的键盘导航全部由 core 处理，示例里不要再实现一遍；这里只补「列表关闭时
 *    Enter 提交」和 onEnter 回调。
 *
 * Vue 插槽在这里对应成 render props：
 *   #inner-actions → renderInnerActions   #actions → renderActions
 *   #item → renderItem                    #list → renderList
 *   #empty → renderEmpty                  #loading → renderLoading
 *   #loading-more → renderLoadingMore     #error → renderError
 *   #default → children（函数形式）
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { useMention } from '@mentionly/react'
import type {
  ContentPart,
  DataPart,
  InsertMentionOptions,
  InsertMentionPayload,
  MentionCoreIds,
  MentionItem,
  MentionTrigger,
  Part,
  PopupMode,
  PopupScrollBehavior,
} from '@mentionly/react'
import './MentionInput.css'

/** 命令式方法（用 ref 拿到，对应 Vue 的 defineExpose） */
export interface MentionInputHandle {
  insertMention: (payload: InsertMentionPayload, options?: InsertMentionOptions) => boolean
  setContent: (parts: Part[] | ContentPart[]) => void
  getParts: () => Part[]
  /** @deprecated 将在 3.0 移除，请改用 getParts()。 */
  getDataParts: () => DataPart[]
  getPlainText: () => string
  clear: () => void
  focus: () => void
  /** core 生成的无障碍 id（自定义列表渲染时需要） */
  ids: MentionCoreIds
}

/** `#inner-actions` / `#actions` 插槽参数 */
export interface MentionActionsSlotProps {
  submit: () => void
  clear: () => void
  isEmpty: boolean
}

/** 默认插槽（Vue `#default`）参数 */
export interface MentionDefaultSlotProps extends MentionActionsSlotProps {
  focus: () => void
  getParts: () => Part[]
}

/** `#item` 插槽参数 */
export interface MentionItemSlotProps {
  item: MentionItem
  active: boolean
  select: () => void
}

/** `#list` 插槽参数 */
export interface MentionListSlotProps {
  items: MentionItem[]
  activeIndex: number
  select: (item: MentionItem) => void
  loading: boolean
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => void
  query: string
  ids: MentionCoreIds
}

export interface MentionInputProps {
  /** 触发器配置。数据变化时请用 useMemo / state 保持稳定引用，否则列表会被重置 */
  triggers: MentionTrigger[]
  placeholder?: string
  disabled?: boolean
  /** 编辑器最大高度（CSS 长度，默认 '200px'） */
  maxHeight?: string
  /** Enter 提交（Shift+Enter 换行）。列表打开时 Enter 始终用于选中候选项 */
  submitOnEnter?: boolean
  /**
   * Enter 按下且列表关闭时先调用（Shift+Enter 不触发）。
   * 调用 `e.preventDefault()` 可阻止提交（例如流式输出时）。
   */
  onEnter?: (e: KeyboardEvent) => void
  /** 弹出列表定位模式 */
  popupMode?: PopupMode
  /** 滚动时弹窗行为 */
  popupScrollBehavior?: PopupScrollBehavior
  /** 提交回调：收到 getParts() 的 Part[] */
  onSubmit?: (parts: Part[]) => void
  /** 内容变化回调 */
  onChange?: (parts: Part[]) => void

  // ── 插槽对应（Vue slot → render prop） ──
  /** Vue `#default`：编辑器下方的兜底插槽 */
  children?: (props: MentionDefaultSlotProps) => ReactNode
  /** Vue `#inner-actions`：编辑器内部操作区 */
  renderInnerActions?: (props: MentionActionsSlotProps) => ReactNode
  /** Vue `#actions`：编辑器下方操作栏 */
  renderActions?: (props: MentionActionsSlotProps) => ReactNode
  /** Vue `#item`：自定义候选项渲染（内容在 .mentionly-list-item 内） */
  renderItem?: (props: MentionItemSlotProps) => ReactNode
  /** Vue `#list`：整块自定义候选列表 */
  renderList?: (props: MentionListSlotProps) => ReactNode
  /** Vue `#empty` */
  renderEmpty?: (props: { query: string }) => ReactNode
  /** Vue `#loading` */
  renderLoading?: () => ReactNode
  /** Vue `#loading-more` */
  renderLoadingMore?: () => ReactNode
  /** Vue `#error` */
  renderError?: (props: { error: unknown }) => ReactNode
}

const NEAR_BOTTOM_PX = 24

/**
 * 默认候选列表（对应 Vue 的 MentionList.vue）。
 * 结构与类名与 Vue 版保持一致，样式在 MentionInput.css 里。
 */
interface DefaultMentionListProps {
  items: MentionItem[]
  activeIndex: number
  query: string
  loading: boolean
  hasMore: boolean
  loadingMore: boolean
  ids: MentionCoreIds
  select: (item: MentionItem) => void
  loadMore: () => void
  renderItem?: (props: MentionItemSlotProps) => ReactNode
  renderEmpty?: (props: { query: string }) => ReactNode
  renderLoading?: () => ReactNode
  renderLoadingMore?: () => ReactNode
}

function DefaultMentionList({
  items,
  activeIndex,
  query,
  loading,
  hasMore,
  loadingMore,
  ids,
  select,
  loadMore,
  renderItem,
  renderEmpty,
  renderLoading,
  renderLoadingMore,
}: DefaultMentionListProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const itemCount = items.length

  const requestLoadMore = useCallback(() => {
    if (hasMore && !loadingMore) loadMore()
  }, [hasMore, loadingMore, loadMore])

  // 选中项始终滚进可视区（对应 Vue MentionList 里的 activeIndex watch）
  useEffect(() => {
    const container = listRef.current
    if (!container) return
    const active = container.querySelector<HTMLElement>('.mentionly-list-item--active')
    active?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex])

  // 首屏 / 追加后若内容撑不满容器（无法滚动），主动补下一页直到填满或没有更多
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight + 1) requestLoadMore()
  }, [itemCount, requestLoadMore])

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      const el = listRef.current
      if (!el) return
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX) requestLoadMore()
    })
  }, [requestLoadMore])

  useEffect(
    () => () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  return (
    <div
      ref={listRef}
      id={ids.listbox}
      className="mentionly-list"
      role="listbox"
      aria-busy={loading || loadingMore}
      onScroll={handleScroll}
    >
      {loading ? (
        renderLoading ? (
          renderLoading()
        ) : (
          <div className="mentionly-list-loading">Loading...</div>
        )
      ) : items.length > 0 ? (
        <>
          {items.map((item, index) => {
            const active = index === activeIndex
            return (
              <div
                key={item.id}
                id={ids.option(index)}
                className={`mentionly-list-item${active ? ' mentionly-list-item--active' : ''}`}
                role="option"
                aria-selected={active}
                // mousedown + preventDefault：选中候选项的同时不让编辑器失焦
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(item)
                }}
              >
                {renderItem ? (
                  renderItem({ item, active, select: () => select(item) })
                ) : (
                  <>
                    <span className="mentionly-list-item-label">{item.label}</span>
                    {item.desc ? <span className="mentionly-list-item-desc">{item.desc}</span> : null}
                  </>
                )}
              </div>
            )
          })}
          {loadingMore &&
            (renderLoadingMore ? (
              renderLoadingMore()
            ) : (
              <div className="mentionly-list-more" role="status" aria-live="polite">
                Loading more...
              </div>
            ))}
        </>
      ) : renderEmpty ? (
        renderEmpty({ query })
      ) : (
        <div className="mentionly-list-empty">No results</div>
      )}
    </div>
  )
}

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(function MentionInput(
  {
    triggers,
    placeholder = '',
    disabled = false,
    maxHeight = '200px',
    submitOnEnter = true,
    onEnter,
    popupMode = 'fixed',
    popupScrollBehavior = 'reposition',
    onSubmit,
    onChange,
    children,
    renderInnerActions,
    renderActions,
    renderItem,
    renderList,
    renderEmpty,
    renderLoading,
    renderLoadingMore,
    renderError,
  },
  ref,
) {
  const {
    ref: editorRef,
    state,
    ids,
    core,
    select,
    loadMore,
    getParts,
    getDataParts,
    getPlainText,
    clear,
    setContent,
    insertMention,
    focus,
  } = useMention({ triggers, popupMode, popupScrollBehavior })

  useImperativeHandle(
    ref,
    () => ({ insertMention, setContent, getParts, getDataParts, getPlainText, clear, focus, ids }),
    [insertMention, setContent, getParts, getDataParts, getPlainText, clear, focus, ids],
  )

  const submit = useCallback(() => {
    // 用 getState() 拿实时状态：React 闭包里的 state 可能停留在上一次渲染
    if (core.getState().isEmpty) return
    onSubmit?.(getParts())
    clear()
  }, [core, getParts, clear, onSubmit])

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const native = e.nativeEvent
      // 输入法组词中：交给 IME，不提交
      if (native.isComposing || native.keyCode === 229) return
      // 列表打开时 core 已处理导航 / Enter / Tab / Esc；它 preventDefault 过就不再重复处理
      // （列表为空时 core 不会 preventDefault，Enter 应继续走提交，与 Vue 版一致）
      // ⚠ 读 nativeEvent.defaultPrevented：core 与 onEnter 都是在原生事件上调 preventDefault，
      //   React 合成事件的 defaultPrevented 不会跟着变。
      if (core.getState().isOpen && native.defaultPrevented) return
      if (e.key !== 'Enter' || e.shiftKey) return

      onEnter?.(native)
      if (native.defaultPrevented) return
      if (!submitOnEnter) return

      e.preventDefault()
      submit()
    },
    [core, onEnter, submitOnEnter, submit],
  )

  const handleInput = useCallback(() => {
    if (onChange) onChange(getParts())
  }, [onChange, getParts])

  const { isOpen, filteredItems, activeIndex, query, loading, loadingMore, hasMore, popupPosition, isEmpty, error } =
    state

  const dropdownStyle = useMemo<CSSProperties>(() => {
    const pos = popupPosition
    if (popupMode === 'cursor') {
      return {
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translateY(-100%)',
        marginTop: -4,
        width: 'max-content',
        minWidth: 200,
        maxWidth: 320,
        zIndex: 9999,
      }
    }
    // fixed 模式：下拉框在编辑器正上方，宽度与编辑器一致
    return {
      position: 'fixed',
      top: pos.top,
      left: pos.left,
      transform: 'translateY(-100%)',
      marginTop: -4,
      width: pos.width ?? 0,
      zIndex: 9999,
    }
  }, [popupPosition, popupMode])

  return (
    <div className={`mentionly-wrapper${disabled ? ' mentionly-wrapper--disabled' : ''}`}>
      <div className="mentionly-editor-area">
        <div
          ref={editorRef}
          className="mentionly-editor"
          contentEditable={!disabled}
          // role="combobox" 与 aria-* 由 core 设置，这里不要写 role
          aria-placeholder={placeholder}
          data-placeholder={placeholder}
          style={{ maxHeight }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
        />

        {/* 输入框内部操作区 */}
        {renderInnerActions?.({ submit, clear, isEmpty })}
      </div>

      {/* 数据源错误（error 非 null 时显示） */}
      {error !== null && (
        <div className="mentionly-error" role="alert">
          {renderError ? renderError({ error }) : 'Failed to load suggestions.'}
        </div>
      )}

      {/* 候选项下拉列表 */}
      {isOpen && (
        <div className="mentionly-dropdown" style={dropdownStyle}>
          {renderList ? (
            renderList({ items: filteredItems, activeIndex, select, loading, hasMore, loadingMore, loadMore, query, ids })
          ) : (
            <DefaultMentionList
              items={filteredItems}
              activeIndex={activeIndex}
              query={query}
              loading={loading}
              hasMore={hasMore}
              loadingMore={loadingMore}
              ids={ids}
              select={select}
              loadMore={loadMore}
              renderItem={renderItem}
              renderEmpty={renderEmpty}
              renderLoading={renderLoading}
              renderLoadingMore={renderLoadingMore}
            />
          )}
        </div>
      )}

      {/* 操作栏 */}
      {renderActions?.({ submit, clear, isEmpty })}

      {/* 兜底插槽 */}
      {typeof children === 'function' ? children({ submit, clear, isEmpty, focus, getParts }) : null}
    </div>
  )
})
