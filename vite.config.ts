import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import pkg from './package.json'

export default defineConfig(({ command }) => ({
  define: {
    __MENTIONLY_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    vue(),
    ...(command === 'build'
      ? [
          dts({
            include: ['src/**/*.ts', 'src/**/*.vue'],
            outDir: 'dist',
            rollupTypes: true,
          }),
        ]
      : []),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
  },
  resolve: {
    alias: {
      mentionly: resolve(__dirname, 'src/index.ts'),
    },
  },
}))
