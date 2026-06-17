// 兼容 shim：类型已拆分为 framework-agnostic core 类型（src/core/types）
// 与 Vue adapter 返回类型（src/vue/types）。保留此入口让历史 import 路径继续可用。
export type * from './core/types'
export type * from './vue/types'
