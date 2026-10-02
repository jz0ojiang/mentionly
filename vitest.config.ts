import { defineConfig } from 'vitest/config'

// 每个包有自己的 vitest.config.ts（jsdom）；根配置只负责把它们聚合起来跑。
export default defineConfig({
  test: {
    projects: [
      'packages/core',
      'packages/vue',
      'packages/react',
      'packages/svelte',
      // 根目录的构建脚本测试（llms 生成器）；node 环境，不依赖 DOM。
      { test: { name: 'scripts', environment: 'node', include: ['tests/**/*.test.ts'] } },
    ],
  },
})
