import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { DEV_FRAMEWORK_BASES, PROD_FRAMEWORK_BASES } from '../../playground/shared/frameworks'

// 指向 monorepo 里的包源码，编辑 packages/*/src 时热更新
//
// `--mode pages`（根目录 `bun run build:playground`）时改构建 playground 的 Svelte 子页面：
// base /mentionly/svelte/，输出到 playground-dist/svelte（父目录由 Vue 版先清空）。
// 共享层（playground/shared）与 Vue playground 共用，见该目录下各文件的注释。
export default defineConfig(({ command, mode }) => {
  const pages = mode === 'pages'
  return {
    base: pages ? '/mentionly/svelte/' : '/',
    plugins: [svelte()],
    define: {
      // 页面上的框架切换栏链接（playground/shared/frameworks.ts）：构建走 Pages 路径，开发走本地端口
      __PLAYGROUND_FRAMEWORK_BASES__: JSON.stringify(command === 'build' ? PROD_FRAMEWORK_BASES : DEV_FRAMEWORK_BASES),
    },
    resolve: {
      alias: {
        '@playground/shared': resolve(__dirname, '../../playground/shared'),
        '@mentionly/svelte': resolve(__dirname, '../../packages/svelte/src/index.ts'),
        '@mentionly/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      },
      conditions: ['browser'],
    },
    server: {
      port: 5181,
    },
    build: {
      outDir: pages ? resolve(__dirname, '../../playground-dist/svelte') : 'dist',
      emptyOutDir: true,
    },
  }
})
