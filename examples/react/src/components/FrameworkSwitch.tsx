/*
 * 框架切换栏（对应 playground/components/FrameworkSwitch.vue）。
 * 链接由共享层生成（生产指向 /mentionly/react/ 等子路径，本地开发指向各自端口），
 * 样式在 @playground/shared/styles.css 的 .fw-switch-* 里。
 */
import { FRAMEWORKS, frameworkHref, type FrameworkId } from '@playground/shared/frameworks'
import type { Locale } from '@playground/shared/i18n'

export interface FrameworkSwitchProps {
  locale: Locale
  current: FrameworkId
}

export function FrameworkSwitch({ locale, current }: FrameworkSwitchProps) {
  return (
    <nav className="fw-switch" aria-label="Framework">
      {FRAMEWORKS.map((fw) => {
        const active = fw.id === current
        return (
          <a
            key={fw.id}
            className={`fw-switch-item${active ? ' fw-switch-item--active' : ''}`}
            href={frameworkHref(fw.id, locale)}
            aria-current={active ? 'page' : undefined}
          >
            {fw.label}
          </a>
        )
      })}
    </nav>
  )
}
