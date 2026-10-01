import pkg from '../package.json'

/**
 * 发布版本号，构建时从本包 `package.json` 读取（`svelte-package` 没有 Vite 的
 * `define` 能力，因此这里用 JSON import 代替 `__MENTIONLY_VERSION__`）。
 */
export const version: string = pkg.version
