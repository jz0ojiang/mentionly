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
            include: ['src/**/*.ts'],
            outDir: 'dist',
            rollupTypes: true,
          }),
        ]
      : []),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'ai-sdk': resolve(__dirname, 'src/ai-sdk.ts'),
        mcp: resolve(__dirname, 'src/mcp.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
  },
}))
