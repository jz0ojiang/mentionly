<script lang="ts">
  /*
   * 框架切换栏：链接由共享层生成（生产指向 /mentionly/react/ 等子路径，本地开发指向各自端口），
   * 样式在 @playground/shared/styles.css 的 .fw-switch-* 里。
   */
  import { FRAMEWORKS, frameworkHref, type FrameworkId } from '@playground/shared/frameworks'
  import type { Locale } from '@playground/shared/i18n'

  let { locale, current }: { locale: Locale; current: FrameworkId } = $props()
</script>

<nav class="fw-switch" aria-label="Framework">
  {#each FRAMEWORKS as fw (fw.id)}
    <a
      class="fw-switch-item {fw.id === current ? 'fw-switch-item--active' : ''}"
      href={frameworkHref(fw.id, locale)}
      aria-current={fw.id === current ? 'page' : undefined}
    >{fw.label}</a>
  {/each}
</nav>
