// 兼容 shim：核心逻辑已迁至 framework-agnostic core（src/core）+ Vue adapter（src/vue）。
// 保留此入口让历史 import 路径（'./useMention'）继续可用。
export { useMention } from './vue/useMention'
