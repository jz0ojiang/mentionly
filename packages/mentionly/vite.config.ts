import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import pkg from './package.json'

export default defineConfig(({ command }) => ({
  define: {
    __MENTIONLY_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    ...(command === 'build'
      ? [
          dts({
            tsconfigPath: 'tsconfig.build.json',
            include: ['src/**/*.ts'],
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
      external: ['@mentionly/vue'],
    },
  },
}))
