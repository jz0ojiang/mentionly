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
            tsconfigPath: 'tsconfig.build.json',
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
      cssFileName: 'mentionly',
    },
    rollupOptions: {
      // core 与 vue 都保持 external：不打包进 adapter 的 dist
      external: ['vue', '@mentionly/core'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
  },
}))
