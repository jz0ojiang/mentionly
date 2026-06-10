<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

interface Section {
  id: string
  label?: string
}

const props = defineProps<{
  sections: Section[]
  activeId?: string
  onNavigate?: (id: string) => void
}>()

// 当 activeId 受控时使用外部值，否则内部根据滚动位置推断
const internalActiveId = ref<string | null>(null)
const activeId = computed(() => props.activeId ?? internalActiveId.value)

// hover 展开带「关闭延迟」：鼠标短暂划出不立即收起
const open = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null
function onPointerEnter() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
  open.value = true
}
function onPointerLeave() {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => { open.value = false; closeTimer = null }, 260)
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
  }, 150)
}

// ── 自实现平滑滚动：可被用户滚轮 / 触摸打断（原生 scrollIntoView 做不到） ──
const SCROLL_OFFSET = 8 // 目标顶部留一点呼吸空间
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
    if (lockReleaseTimer) { clearTimeout(lockReleaseTimer); lockReleaseTimer = null }
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
  if (props.activeId !== undefined) return
  if (clickLockId) return
  const list = props.sections
  if (!list.length) return

  // 滚到页面底部时，末尾区块无法到达顶部检测线，强制高亮最后一项
  const scrollBottom = window.scrollY + window.innerHeight
  const docHeight = document.documentElement.scrollHeight
  if (scrollBottom >= docHeight - 2) {
    internalActiveId.value = list[list.length - 1]!.id
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
  internalActiveId.value = current
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
  if (props.activeId === undefined) {
    internalActiveId.value = id
    clickLockId = id
    releaseLockSoon() // 兜底：即使没触发滚动（已在目标位置）也能释放
  }
  props.onNavigate?.(id)
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  computeActive()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (rafId !== null) window.cancelAnimationFrame(rafId)
  if (lockReleaseTimer) clearTimeout(lockReleaseTimer)
  if (closeTimer) clearTimeout(closeTimer)
  endProgrammaticScroll()
})

watch(() => props.sections.map((s) => s.id).join(','), computeActive)
watch(() => props.activeId, () => { if (props.activeId === undefined) computeActive() })
</script>

<template>
  <nav
    class="fsi"
    :class="{ 'fsi--open': open }"
    aria-label="Section navigation"
    @mouseenter="onPointerEnter"
    @mouseleave="onPointerLeave"
  >
    <ul class="fsi-list no-scrollbar">
      <li v-for="(section, index) in sections" :key="section.id">
        <button
          type="button"
          class="fsi-item"
          :class="{ 'fsi-item--active': section.id === activeId }"
          :aria-label="section.label ?? `Section ${index + 1}`"
          :aria-current="section.id === activeId ? 'true' : undefined"
          @click="handleClick(section.id)"
        >
          <span class="fsi-label">{{ section.label ?? `Section ${index + 1}` }}</span>
          <span class="fsi-bar" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* container: fixed right-4 top-1/2 -translate-y-1/2 z-20 */
.fsi {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
}

/* list hugs the right edge so titles expand leftward; collapsed = tight */
.fsi-list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  max-height: 50lvh;
  overflow-y: auto;
  padding: 4px;
  margin: 0;
  list-style: none;
  transition: gap 0.2s ease;
}

/* expanded: a touch more breathing room between rows (no card / shadow) */
.fsi--open .fsi-list,
.fsi:focus-within .fsi-list {
  gap: 6px;
}

/* hide scrollbar across browsers */
.no-scrollbar {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE / old Edge */
}
.no-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome / Safari */
}

/* item: collapsed = a thin bar; expands into a labelled pill */
.fsi-item {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 3px 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, padding 0.2s ease;
}

/* keyboard focus: no big native outline; reuse the hover look instead */
.fsi-item:focus {
  outline: none;
}
.fsi-item:focus-visible {
  background: #f3f4f6;
  color: #111827;
}

/* the small bar shown when collapsed: h-[2px] w-[18px] rounded-full */
.fsi-bar {
  flex: none;
  height: 2px;
  width: 18px;
  border-radius: 999px;
  background: #d1d5db;
  transition: background-color 0.15s, opacity 0.15s ease, width 0.2s ease;
}
.fsi-item--active .fsi-bar {
  background: #3b82f6;
}

/* the title shown when expanded, with a small slide-in */
.fsi-label {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  font-size: 12px;
  line-height: 0; /* collapsed: contribute no height so rows hug the bar */
  transform: translateX(6px);
  transition: max-width 0.25s ease, opacity 0.2s ease, transform 0.25s ease, line-height 0.2s ease;
}

/* expand to titles on hover or keyboard focus within the TOC area */
.fsi--open .fsi-item,
.fsi:focus-within .fsi-item {
  padding: 6px 10px;
}
.fsi--open .fsi-bar,
.fsi:focus-within .fsi-bar {
  opacity: 0;
  width: 0;
}
.fsi--open .fsi-label,
.fsi:focus-within .fsi-label {
  max-width: 240px;
  opacity: 1;
  line-height: 1.2;
  transform: translateX(0);
}

/* active title color, emphasized when expanded */
.fsi-item--active {
  color: #3b82f6;
}
.fsi--open .fsi-item--active .fsi-label,
.fsi:focus-within .fsi-item--active .fsi-label {
  font-weight: 600;
}

/* hovered title is visually distinct from its non-hovered siblings */
.fsi--open .fsi-item:hover {
  background: #f3f4f6;
  color: #111827;
}
</style>
