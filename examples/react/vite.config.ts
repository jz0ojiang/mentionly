import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// 本地开发 / 构建示例：把包名 alias 到源码入口，改 packages/* 即时热更新（无需先 build）
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mentionly/react': resolve(__dirname, '../../packages/react/src/index.ts'),
      '@mentionly/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  server: {
    port: 5180,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
