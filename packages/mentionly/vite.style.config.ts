import { defineConfig } from 'vite'
import { resolve } from 'path'

// 单独的样式构建：把 src/style.css（@import @mentionly/vue 的样式）内联成 dist/mentionly.css。
// 使用独立的 CSS 入口，避免 JS 侧出现多余的空 chunk。
export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    cssCodeSplit: true,
    lib: {
      entry: { mentionly: resolve(__dirname, 'src/style.css') },
      formats: ['es'],
    },
  },
})
