/*
 * 页头徽章：playground(Vue)、examples/react、examples/svelte 三个应用共用。
 * 增删徽章只改这里；样式类名 `.badge` 在 styles.css。
 */
export interface Badge {
  href: string
  src: string
  alt: string
}

export const BADGES: readonly Badge[] = [
  {
    href: 'https://github.com/jz0ojiang/mentionly/actions/workflows/test.yml',
    src: 'https://github.com/jz0ojiang/mentionly/actions/workflows/test.yml/badge.svg',
    alt: 'tests',
  },
  {
    href: 'https://www.npmjs.com/package/mentionly',
    src: 'https://img.shields.io/npm/v/mentionly?color=3b82f6&label=npm&logo=npm',
    alt: 'npm version',
  },
  {
    href: 'https://www.npmjs.com/package/mentionly',
    src: 'https://img.shields.io/npm/dm/mentionly?color=10b981&label=downloads&logo=npm',
    alt: 'npm downloads',
  },
  {
    href: 'https://github.com/jz0ojiang/mentionly',
    src: 'https://img.shields.io/badge/GitHub-Repo-111827?logo=github',
    alt: 'github repo',
  },
  {
    href: 'https://im0o.top/mentionly/llms.txt',
    src: 'https://img.shields.io/badge/llms.txt-for_AI_agents-7c3aed',
    alt: 'llms.txt for AI agents',
  },
]
