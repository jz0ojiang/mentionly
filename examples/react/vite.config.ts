import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import reactPkg from '../../packages/react/package.json'
import { DEV_FRAMEWORK_BASES, PROD_FRAMEWORK_BASES } from '../../playground/shared/frameworks'

// 本地开发 / 构建示例：把包名 alias 到源码入口，改 packages/* 即时热更新（无需先 build）
//
// `--mode pages`（根目录 `bun run build:playground`）时改构建 playground 的 React 子页面：
// base /mentionly/react/，输出到 playground-dist/react（父目录由 Vue 版先清空）。
// 共享层（playground/shared）与 Vue playground 共用，见该目录下各文件的注释。
export default defineConfig(({ command, mode }) => {
  const pages = mode === 'pages'
  return {
    base: pages ? '/mentionly/react/' : '/',
    plugins: [react()],
    define: {
      // 直接引用源码时，@mentionly/react 的 version.ts 需要这个常量（包自己构建时由它的 vite 配置注入）
      __MENTIONLY_VERSION__: JSON.stringify(reactPkg.version),
      // 页面上的框架切换栏链接（playground/shared/frameworks.ts）：构建走 Pages 路径，开发走本地端口
      __PLAYGROUND_FRAMEWORK_BASES__: JSON.stringify(command === 'build' ? PROD_FRAMEWORK_BASES : DEV_FRAMEWORK_BASES),
    },
    resolve: {
      alias: {
        '@playground/shared': resolve(__dirname, '../../playground/shared'),
        '@mentionly/react': resolve(__dirname, '../../packages/react/src/index.ts'),
        '@mentionly/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    },
    server: {
      port: 5180,
    },
    build: {
      outDir: pages ? resolve(__dirname, '../../playground-dist/react') : 'dist',
      emptyOutDir: true,
    },
  }
})
