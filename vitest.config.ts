import { defineConfig } from 'vitest/config'

// 每个包有自己的 vitest.config.ts（jsdom）；根配置只负责把它们聚合起来跑。
export default defineConfig({
  test: {
    projects: ['packages/core', 'packages/vue'],
  },
})
