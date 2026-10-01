import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

// 指向 monorepo 里的包源码，编辑 packages/*/src 时热更新
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@mentionly/svelte': resolve(__dirname, '../../packages/svelte/src/index.ts'),
      '@mentionly/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
    conditions: ['browser'],
  },
  server: {
    port: 5181,
  },
})
