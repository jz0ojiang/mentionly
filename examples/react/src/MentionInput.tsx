/**
 * 一个「可直接复制到自己项目」的完整 mention 输入框示例。
 *
 * 复制方式：把 MentionInput.tsx + MentionInput.css 拷到你的项目，改样式即可
 * （依赖只有 @mentionly/react 和 react）。
 *
 * 三条要点：
 * 1. 编辑器是空的 contenteditable <div>，通过 hook 的 `ref` 交给 core。
 *    ⚠ 不要往这个 div 里渲染 React 子节点 —— 内部 DOM（mention span、光标等）由 core 直接管理。
 * 2. 候选列表的 id 必须用 `ids.listbox` / `ids.option(i)`：core 会自动在编辑器上设置
 *    aria-controls / aria-activedescendant 指向它们，这样读屏软件才能正确朗读。
 * 3. ↑ ↓ Enter Tab Esc 的键盘导航全部由 core 处理，示例里不要再实现一遍。
 */
import { useCallback, useEffect, useRef, type KeyboardEvent, type UIEvent } from 'react'
import { useMention } from '@mentionly/react'
import type { MentionTrigger, Part } from '@mentionly/react'
import './MentionInput.css'

export interface MentionInputProps {
  /** 触发器配置。必须是稳定引用（模块级常量或 useMemo），否则每次渲染都会关闭列表 */
  triggers: MentionTrigger[]
  placeholder?: string
  /** 编辑器最大高度（px），超出滚动 */
  maxHeight?: number
  /** Enter 提交（Shift+Enter 换行）。列表打开时 Enter 始终用于选中候选项 */
  submitOnEnter?: boolean
  onSubmit?: (parts: Part[]) => void
}

export function MentionInput({
  triggers,
  placeholder = '输入 @ 提及用户，# 提及话题',
  maxHeight = 140,
  submitOnEnter = true,
  onSubmit,
}: MentionInputProps) {
  const { ref, state, ids, core, select, loadMore, getParts, clear } = useMention({ triggers })
  const listRef = useRef<HTMLDivElement | null>(null)

  const submit = useCallback(() => {
    // core 的 isEmpty 会把「只有 mention、没有文字」也算作非空
    if (core.getState().isEmpty) return
    onSubmit?.(getParts())
    clear()
  }, [core, getParts, clear, onSubmit])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    // 输入法组词中：交给 IME
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key !== 'Enter' || e.shiftKey) return
    // 列表打开时（哪怕没有候选项）Enter 都归 core 管；用 getState() 拿实时状态，
    // 因为 React 闭包里的 state 可能还停留在上一次渲染
    if (core.getState().isOpen) return
    if (!submitOnEnter) return
    e.preventDefault()
    submit()
  }, [core, submit, submitOnEnter])

  // 键盘上下移动时把当前项滚进可视区
  useEffect(() => {
    if (!state.isOpen) return
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView?.({ block: 'nearest' })
  }, [state.activeIndex, state.isOpen])

  // 列表滚动到接近底部时加载下一页（分页数据源）
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 24) return
    loadMore()
  }

  const { isOpen, filteredItems, activeIndex, query, loading, loadingMore, hasMore, error, popupPosition } = state

  return (
    <div className="mi-root">
      <div
        ref={ref}
        className="mi-editor"
        contentEditable
        // role="combobox" and the aria-* wiring are set by the core; do not add role here,
        // the core leaves an existing role untouched
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        style={{ maxHeight }}
        onKeyDown={handleKeyDown}
      />

      {isOpen && (
        <div
          className="mi-popup"
          style={{
            top: popupPosition.top,
            left: popupPosition.left,
            width: popupPosition.width,
          }}
        >
          <div
            ref={listRef}
            id={ids.listbox}
            className="mi-list"
            role="listbox"
            aria-busy={loading || loadingMore}
            onScroll={handleScroll}
          >
            {loading ? (
              <div className="mi-hint">加载中…</div>
            ) : error ? (
              <div className="mi-hint mi-hint--error">加载失败，请重试</div>
            ) : filteredItems.length === 0 ? (
              <div className="mi-hint">{query ? `没有匹配「${query}」的结果` : '没有候选结果'}</div>
            ) : (
              <>
                {filteredItems.map((item, index) => (
                  <div
                    key={item.id}
                    id={ids.option(index)}
                    data-active={index === activeIndex}
                    className={`mi-option${index === activeIndex ? ' mi-option--active' : ''}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    // preventDefault 让编辑器保持焦点，否则 core 的 blur 会关掉列表
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(item)}
                  >
                    <span className="mi-option-label">{item.label}</span>
                    {item.desc ? <span className="mi-option-desc">{item.desc}</span> : null}
                  </div>
                ))}

                {hasMore && (
                  <button
                    type="button"
                    className="mi-more"
                    disabled={loadingMore}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={loadMore}
                  >
                    {loadingMore ? '加载中…' : '加载更多'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
