<script lang="ts">
  /*
   * 右侧浮动目录：与 Vue 版 FloatingSectionIndicator.vue 行为一致
   * （hover 展开带关闭延迟、点击平滑滚动可被用户滚轮打断、滚动跟随高亮）。
   * 视觉样式在共享层 @playground/shared/styles.css 的 .pg-fsi-* 里。
   */
  interface Section {
    id: string
    label?: string
  }

  let {
    sections,
    activeId,
    onNavigate,
  }: {
    sections: Section[]
    activeId?: string
    onNavigate?: (id: string) => void
  } = $props()

  const CLOSE_DELAY_MS = 260 // 鼠标短暂划出 TOC 时给的回旋余地
  const LOCK_RELEASE_MS = 150 // 末次 scroll 事件后多久判定滚动停止、释放点击锁
  const SCROLL_OFFSET = 8 // 目标顶部留一点呼吸空间

  // 当 activeId 受控时使用外部值，否则内部根据滚动位置推断
  let internalActiveId = $state<string | null>(null)
  const isControlled = $derived(activeId !== undefined)
  const currentActiveId = $derived(activeId ?? internalActiveId)

  // hover 展开带「关闭延迟」：鼠标短暂划出不立即收起
  let open = $state(false)
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  function onPointerEnter() {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    open = true
  }

  function onPointerLeave() {
    if (closeTimer) clearTimeout(closeTimer)
    closeTimer = setTimeout(() => {
      open = false
      closeTimer = null
    }, CLOSE_DELAY_MS)
  }

  let rafId: number | null = null
  // 点击优先：锁定高亮直到平滑滚动停止，避免途经 / 末尾区块造成回跳闪烁
  let clickLockId: string | null = null
  let lockReleaseTimer: ReturnType<typeof setTimeout> | null = null

  // 在滚动停止（一段时间无 scroll 事件）后释放点击锁
  function releaseLockSoon() {
    if (lockReleaseTimer) clearTimeout(lockReleaseTimer)
    lockReleaseTimer = setTimeout(() => {
      lockReleaseTimer = null
      clickLockId = null
      computeActive()
    }, LOCK_RELEASE_MS)
  }

  // ── 自实现平滑滚动：可被用户滚轮 / 触摸打断（原生 scrollIntoView 做不到） ──
  let scrollAnim: number | null = null

  function endProgrammaticScroll() {
    if (scrollAnim !== null) {
      window.cancelAnimationFrame(scrollAnim)
      scrollAnim = null
    }
    window.removeEventListener('wheel', onUserScrollInput)
    window.removeEventListener('touchmove', onUserScrollInput)
  }

  function onUserScrollInput() {
    // 用户主动滚动 → 立刻停止程序化滚动并解除点击锁，让高亮跟随
    endProgrammaticScroll()
    if (clickLockId) {
      clickLockId = null
      if (lockReleaseTimer) {
        clearTimeout(lockReleaseTimer)
        lockReleaseTimer = null
      }
      computeActive()
    }
  }

  function smoothScrollTo(targetY: number) {
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
      if (t < 1) scrollAnim = window.requestAnimationFrame(step)
      else endProgrammaticScroll()
    }
    scrollAnim = window.requestAnimationFrame(step)
  }

  function computeActive() {
    if (isControlled) return
    if (clickLockId) return
    const list = sections
    if (!list.length) return

    // 滚到页面底部时，末尾区块无法到达顶部检测线，强制高亮最后一项
    const scrollBottom = window.scrollY + window.innerHeight
    const docHeight = document.documentElement.scrollHeight
    if (scrollBottom >= docHeight - 2) {
      internalActiveId = list[list.length - 1]!.id
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
    internalActiveId = current
  }

  function onScroll() {
    // 点击锁定期间不更新高亮，仅借滚动事件刷新「停止检测」计时器
    if (clickLockId) {
      releaseLockSoon()
      return
    }
    if (rafId !== null) return
    rafId = window.requestAnimationFrame(() => {
      rafId = null
      computeActive()
    })
  }

  function handleClick(id: string) {
    const el = document.getElementById(id)
    if (el) {
      const targetY = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET
      smoothScrollTo(targetY)
    }
    // 立即反映点击；锁定高亮直到平滑滚动停止（由 onScroll 的停止检测释放）
    if (!isControlled) {
      internalActiveId = id
      clickLockId = id
      releaseLockSoon() // 兜底：即使没触发滚动（已在目标位置）也能释放
    }
    onNavigate?.(id)
  }

  $effect(() => {
    // sections（语言切换后标签变化）变化时重算一次高亮
    void sections
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    computeActive()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      if (lockReleaseTimer) clearTimeout(lockReleaseTimer)
      if (closeTimer) clearTimeout(closeTimer)
      endProgrammaticScroll()
    }
  })
</script>

<nav
  class="pg-fsi {open ? 'pg-fsi--open' : ''}"
  aria-label="Section navigation"
  onmouseenter={onPointerEnter}
  onmouseleave={onPointerLeave}
>
  <ul class="pg-fsi-list">
    {#each sections as section, index (section.id)}
      <li>
        <button
          type="button"
          class="pg-fsi-item {section.id === currentActiveId ? 'pg-fsi-item--active' : ''}"
          aria-label={section.label ?? `Section ${index + 1}`}
          aria-current={section.id === currentActiveId ? 'true' : undefined}
          onclick={() => handleClick(section.id)}
        >
          <span class="pg-fsi-label">{section.label ?? `Section ${index + 1}`}</span>
          <span class="pg-fsi-bar" aria-hidden="true"></span>
        </button>
      </li>
    {/each}
  </ul>
</nav>
