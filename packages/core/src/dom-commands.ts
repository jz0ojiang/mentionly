/** 浏览器原生编辑命令包装。保留 execCommand 以进入浏览器撤销栈。 */
export function deleteSelection(): boolean {
  return document.execCommand('delete')
}

export function insertHTML(html: string): boolean {
  return document.execCommand('insertHTML', false, html)
}

export function insertText(text: string): boolean {
  return document.execCommand('insertText', false, text)
}

export function canUseExecCommand(): boolean {
  return typeof document.execCommand === 'function'
}
