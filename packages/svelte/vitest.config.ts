import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@mentionly/core': resolve(__dirname, '../core/src/index.ts'),
    },
    // Svelte 5 组件/runes 在测试里需要浏览器条件导出
    conditions: ['browser'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
