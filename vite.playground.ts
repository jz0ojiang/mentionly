import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// 本地开发 / 构建 playground：直接把包名 alias 到各包的源码入口，改源码即时热更新。
export default defineConfig({
  root: 'playground',
  base: '/mentionly/',
  plugins: [vue()],
  resolve: {
    alias: {
      mentionly: resolve(__dirname, 'packages/mentionly/src/index.ts'),
      '@mentionly/vue': resolve(__dirname, 'packages/vue/src/index.ts'),
      '@mentionly/core': resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'playground-dist'),
    emptyOutDir: true,
  },
})
