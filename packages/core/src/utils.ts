import type { ContentPart, DataPart, MentionItem, MentionTrigger, Part } from './types'

/** 创建 mention span 元素 */
export function createMentionSpan(
  trigger: string,
  item: MentionItem,
  dataPart?: Record<string, any>,
  data?: unknown,
): HTMLSpanElement {
  const span = document.createElement('span')
  span.contentEditable = 'false'
  span.dataset.mentionId = item.id
  span.dataset.mentionTrigger = trigger
  if (dataPart !== undefined) {
    span.dataset.mentionDataPart = JSON.stringify(dataPart)
  }
  if (data !== undefined) {
    span.dataset.mentionData = JSON.stringify(data)
  }
  span.className = 'mentionly-mention'
  span.textContent = `${trigger}${item.label}`
  return span
}

/** 递归遍历编辑器 DOM，生成 ContentPart[]（1.x 兼容路径，行为不可改变） */
export function parseDOMToParts(editor: HTMLElement): ContentPart[] {
  const parts: ContentPart[] = []

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (text) {
        parts.push({ type: 'text', content: text })
      }
      return
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement

      // mention span
      if (el.dataset.mentionId) {
        const trigger = el.dataset.mentionTrigger ?? ''
        const raw = el.textContent ?? ''
        const label = raw.startsWith(trigger) ? raw.slice(trigger.length) : raw
        let customDataPart: Record<string, any> | undefined
        const encodedDataPart = el.dataset.mentionDataPart
        if (encodedDataPart) {
          try {
            const parsed = JSON.parse(encodedDataPart)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              customDataPart = parsed as Record<string, any>
            }
          } catch {
            customDataPart = undefined
          }
        }
        parts.push({
          type: 'mention',
          triggeredBy: trigger,
          id: el.dataset.mentionId,
          label,
          dataPart: customDataPart,
        })
        return
      }

      // <br> → newline
      if (el.tagName === 'BR') {
        parts.push({ type: 'text', content: '\n' })
        return
      }

      // block elements (div, p) add newline before content (Firefox wraps lines in <div>)
      const isBlock = /^(DIV|P)$/i.test(el.tagName)
      if (isBlock && parts.length > 0) {
        const last = parts[parts.length - 1]
        if (last && !(last.type === 'text' && last.content.endsWith('\n'))) {
          parts.push({ type: 'text', content: '\n' })
        }
      }

      // recurse children
      for (const child of el.childNodes) {
        walk(child)
      }
    }
  }

  for (const child of editor.childNodes) {
    walk(child)
  }

  return parts
}

/** 将 ContentPart[] 转换为 DataPart[]，合并相邻 text，trim 首尾（1.x 兼容路径） */
export function contentPartsToDataParts(
  parts: ContentPart[],
  triggers: MentionTrigger[],
): DataPart[] {
  const raw: DataPart[] = []

  for (const part of parts) {
    if (part.type === 'text') {
      raw.push({ type: 'text', text: part.content })
    } else {
      if (part.dataPart) {
        raw.push({ type: 'data', ...part.dataPart })
        continue
      }

      const trigger = triggers.find((t) => t.char === part.triggeredBy)
      const item: MentionItem = { id: part.id, label: part.label }

      if (trigger?.dataPart) {
        raw.push({ type: 'data', ...trigger.dataPart(item) })
      } else if (trigger?.schema) {
        const mapped: Record<string, any> = { type: trigger.schema.type }
        for (const [outKey, itemKey] of Object.entries(trigger.schema.mapping)) {
          mapped[outKey] = (item as any)[itemKey]
        }
        raw.push({ type: 'data', ...mapped })
      } else {
        raw.push({
          type: 'data',
          mentionType: part.triggeredBy,
          id: part.id,
          label: part.label,
        })
      }
    }
  }

  // merge adjacent text parts
  const merged: DataPart[] = []
  for (const part of raw) {
    if (part.type === 'text') {
      const last = merged[merged.length - 1]
      if (last && last.type === 'text') {
        last.text += part.text
      } else {
        merged.push({ ...part })
      }
    } else {
      merged.push(part)
    }
  }

  // trim leading/trailing text, filter empty
  if (merged.length > 0) {
    const first = merged[0]
    if (first && first.type === 'text') {
      first.text = first.text.replace(/^[\s\u00A0]+/, '')
    }
    const last = merged[merged.length - 1]
    if (last && last.type === 'text') {
      last.text = last.text.replace(/[\s\u00A0]+$/, '')
    }
  }

  return merged.filter((p) => !(p.type === 'text' && !p.text))
}

function parseMentionData(el: HTMLElement): unknown {
  const encoded = el.dataset.mentionData
  if (encoded === undefined) return undefined
  try {
    return JSON.parse(encoded)
  } catch {
    return undefined
  }
}

/** 从 DOM 解析 2.0 Part[]，并规范化文本。 */
export function parseDOMToOutputParts(editor: HTMLElement): Part[] {
  const raw: Part[] = []

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\u00A0/g, ' ')
      if (text) raw.push({ type: 'text', text })
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement

    if (el.dataset.mentionId) {
      const trigger = el.dataset.mentionTrigger ?? ''
      const text = el.textContent ?? ''
      const label = text.startsWith(trigger) ? text.slice(trigger.length) : text
      const data = parseMentionData(el)
      raw.push({
        type: 'mention',
        trigger,
        id: el.dataset.mentionId,
        label,
        ...(data !== undefined ? { data } : {}),
      })
      return
    }

    if (el.tagName === 'BR') {
      raw.push({ type: 'text', text: '\n' })
      return
    }

    const isBlock = /^(DIV|P)$/i.test(el.tagName)
    if (isBlock && raw.length > 0) {
      const last = raw[raw.length - 1]
      if (last && !(last.type === 'text' && last.text.endsWith('\n'))) {
        raw.push({ type: 'text', text: '\n' })
      }
    }

    for (const child of el.childNodes) walk(child)
  }

  for (const child of editor.childNodes) walk(child)

  const merged: Part[] = []
  for (const part of raw) {
    const last = merged[merged.length - 1]
    if (part.type === 'text' && last?.type === 'text') {
      last.text += part.text
    } else if (part.type === 'text') {
      merged.push({ ...part })
    } else {
      merged.push(part)
    }
  }

  const first = merged[0]
  if (first?.type === 'text') first.text = first.text.replace(/^[\s\u00A0]+/, '')
  const last = merged[merged.length - 1]
  if (last?.type === 'text') last.text = last.text.replace(/[\s\u00A0]+$/, '')

  return merged.filter((part) => !(part.type === 'text' && !part.text))
}

/** 从 ContentPart[] 还原编辑器 DOM（1.x 兼容输入）。 */
export function restoreContent(editor: HTMLElement, parts: ContentPart[]): void {
  restoreContentInput(editor, parts)
}

/** 从 Part[] 还原编辑器 DOM。 */
export function restoreParts(editor: HTMLElement, parts: Part[]): void {
  restoreContentInput(editor, parts)
}

/** 从 1.x / 2.0 内容片段还原 DOM，并支持逐元素识别两种形状。 */
export function restoreContentInput(editor: HTMLElement, parts: Array<ContentPart | Part>): void {
  editor.innerHTML = ''

  for (const part of parts) {
    if (part.type === 'text') {
      appendText(editor, 'content' in part ? part.content : part.text)
    } else if ('triggeredBy' in part) {
      editor.appendChild(createMentionSpan(part.triggeredBy, { id: part.id, label: part.label }, part.dataPart))
    } else {
      editor.appendChild(createMentionSpan(part.trigger, { id: part.id, label: part.label }, undefined, part.data))
    }
  }

  setCursorToEnd(editor)
}

function appendText(editor: HTMLElement, text: string): void {
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (line) editor.appendChild(document.createTextNode(line))
    if (i < lines.length - 1) editor.appendChild(document.createElement('br'))
  })
}

/** 将光标移到编辑器末尾 */
export function setCursorToEnd(editor: HTMLElement): void {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

/** 获取光标前的文本（在当前文本节点中） */
export function getTextBeforeCursor(): { text: string; node: Text; offset: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null

  const range = sel.getRangeAt(0)
  if (!range.collapsed) return null

  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return null

  const offset = range.startOffset
  const text = (node.textContent ?? '').slice(0, offset)
  return { text, node: node as Text, offset }
}

/** 获取编辑器纯文本 */
export function getPlainTextFromParts(parts: Array<ContentPart | Part>): string {
  return parts
    .map((part) => {
      if (part.type === 'text') return 'content' in part ? part.content : part.text
      return 'triggeredBy' in part ? `${part.triggeredBy}${part.label}` : `${part.trigger}${part.label}`
    })
    .join('')
}
