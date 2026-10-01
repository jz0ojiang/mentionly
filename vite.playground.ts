import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import mentionlyPkg from './packages/mentionly/package.json'
import { DEV_FRAMEWORK_BASES, PROD_FRAMEWORK_BASES } from './playground/shared/frameworks'

// 本地开发 / 构建 playground：直接把包名 alias 到各包的源码入口，改源码即时热更新。
// 共享层（playground/shared）同时被 examples/react、examples/svelte 复用。
export default defineConfig(({ command }) => ({
  root: 'playground',
  base: '/mentionly/',
  plugins: [vue()],
  define: {
    // playground 直接引用 packages/* 源码，@mentionly/vue 的 version.ts 需要这个常量
    __MENTIONLY_VERSION__: JSON.stringify(mentionlyPkg.version),
    // 框架切换栏的链接前缀：本地开发指向三个应用的端口，生产指向 Pages 子路径
    __PLAYGROUND_FRAMEWORK_BASES__: JSON.stringify(command === 'build' ? PROD_FRAMEWORK_BASES : DEV_FRAMEWORK_BASES),
  },
  resolve: {
    alias: {
      '@playground/shared': resolve(__dirname, 'playground/shared'),
      mentionly: resolve(__dirname, 'packages/mentionly/src/index.ts'),
      '@mentionly/vue': resolve(__dirname, 'packages/vue/src/index.ts'),
      '@mentionly/core': resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: resolve(__dirname, 'playground-dist'),
    // Vue 版先构建并清空 playground-dist，React / Svelte 之后写入子目录
    emptyOutDir: true,
  },
}))
