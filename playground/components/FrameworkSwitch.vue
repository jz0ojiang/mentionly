<script setup lang="ts">
// 框架切换栏：链接由共享层生成（生产指向 /mentionly/react/ 等子路径，本地开发指向各自端口），
// 样式在 @playground/shared/styles.css 的 .fw-switch-* 里。
import { FRAMEWORKS, frameworkHref, type FrameworkId } from '@playground/shared/frameworks'
import type { Locale } from '@playground/shared/i18n'

defineProps<{
  locale: Locale
  current: FrameworkId
}>()
</script>

<template>
  <nav class="fw-switch" aria-label="Framework">
    <a
      v-for="fw in FRAMEWORKS"
      :key="fw.id"
      class="fw-switch-item"
      :class="{ 'fw-switch-item--active': fw.id === current }"
      :href="frameworkHref(fw.id, locale)"
      :aria-current="fw.id === current ? 'page' : undefined"
    >{{ fw.label }}</a>
  </nav>
</template>
