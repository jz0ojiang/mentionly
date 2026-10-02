/*
 * 右侧浮动目录（对应 playground/components/FloatingSectionIndicator.vue）。
 * 类名 pg-fsi-* 与交互逻辑与 Vue 版逐行对应：hover 展开带关闭延迟、点击锁定高亮、
 * 可被用户滚轮 / 触摸打断的自实现平滑滚动；样式在 @playground/shared/styles.css。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface Section {
  id: string
  label?: string
}

export interface FloatingSectionIndicatorProps {
  sections: Section[]
  /** 受控高亮：传入后组件不再自己根据滚动位置推断 */
  activeId?: string
  onNavigate?: (id: string) => void
}

const CLOSE_DELAY_MS = 260 // 鼠标短暂划出 TOC 时给的回旋余地
const LOCK_RELEASE_MS = 150 // 末次 scroll 事件后多久判定滚动停止、释放点击锁
const SCROLL_OFFSET = 8 // 目标顶部留一点呼吸空间

export function FloatingSectionIndicator({ sections, activeId: controlledActiveId, onNavigate }: FloatingSectionIndicatorProps) {
  const [open, setOpen] = useState(false)
  const [internalActiveId, setInternalActiveId] = useState<string | null>(null)

  const isControlled = controlledActiveId !== undefined
  const activeId = controlledActiveId ?? internalActiveId

  // 事件回调里需要读到最新的 props / 值，用 ref 保存，避免重绑监听
  const sectionsRef = useRef(sections)
  const isControlledRef = useRef(isControlled)
  const onNavigateRef = useRef(onNavigate)
  sectionsRef.current = sections
  isControlledRef.current = isControlled
  onNavigateRef.current = onNavigate

  const closeTimer = useRef<number | null>(null)
  const rafId = useRef<number | null>(null)
  const clickLockId = useRef<string | null>(null)
  const lockReleaseTimer = useRef<number | null>(null)
  const scrollAnim = useRef<number | null>(null)
  const onUserScrollInputRef = useRef<() => void>(() => {})

  // 在滚动停止（一段时间无 scroll 事件）后释放点击锁
  const computeActive = useCallback(() => {
    if (isControlledRef.current) return
    if (clickLockId.current) return
    const list = sectionsRef.current
    if (!list.length) return

    // 滚到页面底部时，末尾区块无法到达顶部检测线，强制高亮最后一项
    const scrollBottom = window.scrollY + window.innerHeight
    const docHeight = document.documentElement.scrollHeight
    if (scrollBottom >= docHeight - 2) {
      setInternalActiveId(list[list.length - 1]!.id)
      return
    }

    // 以视口顶部 ~30% 处为检测线，取最后一个顶边越过该线的区块
    const line = window.innerHeight * 0.3
    let current = list[0]!.id
    for (const section of list) {
      const el = document.getElementById(section.id)
      if (!el) continue
      if (el.getBoundingClientRect().top <= line) current = section.id
    }
    setInternalActiveId(current)
  }, [])

  const releaseLockSoon = useCallback(() => {
    if (lockReleaseTimer.current !== null) window.clearTimeout(lockReleaseTimer.current)
    lockReleaseTimer.current = window.setTimeout(() => {
      lockReleaseTimer.current = null
      clickLockId.current = null
      computeActive()
    }, LOCK_RELEASE_MS)
  }, [computeActive])

  // ── 自实现平滑滚动：可被用户滚轮 / 触摸打断（原生 scrollIntoView 做不到） ──
  const endProgrammaticScroll = useCallback(() => {
    if (scrollAnim.current !== null) {
      window.cancelAnimationFrame(scrollAnim.current)
      scrollAnim.current = null
    }
    window.removeEventListener('wheel', onUserScrollInputRef.current)
    window.removeEventListener('touchmove', onUserScrollInputRef.current)
  }, [])

  const onUserScrollInput = useCallback(() => {
    // 用户主动滚动 → 立刻停止程序化滚动并解除点击锁，让高亮跟随
    endProgrammaticScroll()
    if (clickLockId.current) {
      clickLockId.current = null
      if (lockReleaseTimer.current !== null) {
        window.clearTimeout(lockReleaseTimer.current)
        lockReleaseTimer.current = null
      }
      computeActive()
    }
  }, [endProgrammaticScroll, computeActive])
  onUserScrollInputRef.current = onUserScrollInput

  const smoothScrollTo = useCallback(
    (targetY: number) => {
      endProgrammaticScroll()
      const startY = window.scrollY
      const maxY = document.documentElement.scrollHeight - window.innerHeight
      const dest = Math.max(0, Math.min(targetY, maxY))
      const distance = dest - startY
      if (Math.abs(distance) < 1) return

      const duration = Math.min(700, Math.max(250, Math.abs(distance) * 0.4))
      const ease = (t: number) => 1 - Math.pow(1 - t, 3) // easeOutCubic
      let startTime: number | null = null

      window.addEventListener('wheel', onUserScrollInput, { passive: true })
      window.addEventListener('touchmove', onUserScrollInput, { passive: true })

      const step = (now: number) => {
        if (startTime === null) startTime = now
        const t = Math.min(1, (now - startTime) / duration)
        window.scrollTo(0, startY + distance * ease(t))
        if (t < 1) scrollAnim.current = window.requestAnimationFrame(step)
        else endProgrammaticScroll()
      }
      scrollAnim.current = window.requestAnimationFrame(step)
    },
    [endProgrammaticScroll, onUserScrollInput],
  )

  const onScroll = useCallback(() => {
    // 点击锁定期间不更新高亮，仅借滚动事件刷新「停止检测」计时器
    if (clickLockId.current) {
      releaseLockSoon()
      return
    }
    if (rafId.current !== null) return
    rafId.current = window.requestAnimationFrame(() => {
      rafId.current = null
      computeActive()
    })
  }, [computeActive, releaseLockSoon])

  const handleClick = useCallback(
    (id: string) => {
      const el = document.getElementById(id)
      if (el) {
        const targetY = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET
        smoothScrollTo(targetY)
      }
      // 立即反映点击；锁定高亮直到平滑滚动停止（由 onScroll 的停止检测释放）
      if (!isControlledRef.current) {
        setInternalActiveId(id)
        clickLockId.current = id
        releaseLockSoon() // 兜底：即使没触发滚动（已在目标位置）也能释放
      }
      onNavigateRef.current?.(id)
    },
    [smoothScrollTo, releaseLockSoon],
  )

  // hover 展开带「关闭延迟」：鼠标短暂划出不立即收起
  const onPointerEnter = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }, [])

  const onPointerLeave = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
      closeTimer.current = null
    }, CLOSE_DELAY_MS)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    computeActive()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafId.current !== null) window.cancelAnimationFrame(rafId.current)
      if (lockReleaseTimer.current !== null) window.clearTimeout(lockReleaseTimer.current)
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
      endProgrammaticScroll()
    }
  }, [onScroll, computeActive, endProgrammaticScroll])

  // sections 变化（如切换语言）时重算高亮
  useEffect(() => {
    computeActive()
  }, [sections, computeActive])

  return (
    <nav
      className={`pg-fsi${open ? ' pg-fsi--open' : ''}`}
      aria-label="Section navigation"
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <ul className="pg-fsi-list">
        {sections.map((section, index) => {
          const isActive = section.id === activeId
          const label = section.label ?? `Section ${index + 1}`
          return (
            <li key={section.id}>
              <button
                type="button"
                className={`pg-fsi-item${isActive ? ' pg-fsi-item--active' : ''}`}
                aria-label={label}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => handleClick(section.id)}
              >
                <span className="pg-fsi-label">{label}</span>
                <span className="pg-fsi-bar" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
