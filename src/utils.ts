import type { ContentPart, DataPart, MentionItem, MentionTrigger } from './types'

/** 创建 mention span 元素 */
export function createMentionSpan(
  trigger: string,
  item: MentionItem,
): HTMLSpanElement {
  const span = document.createElement('span')
  span.contentEditable = 'false'
  span.dataset.mentionId = item.id
  span.dataset.mentionTrigger = trigger
  span.className = 'mentionly-mention'
  span.textContent = `${trigger}${item.label}`
  return span
}

/** 递归遍历编辑器 DOM，生成 ContentPart[] */
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
        parts.push({
          type: 'mention',
          triggeredBy: trigger,
          id: el.dataset.mentionId,
          label,
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

/** 将 ContentPart[] 转换为 DataPart[]，合并相邻 text，trim 首尾 */
export function contentPartsToDataParts(
  parts: ContentPart[],
  triggers: MentionTrigger[],
): DataPart[] {
  const raw: DataPart[] = []

  for (const part of parts) {
    if (part.type === 'text') {
      raw.push({ type: 'text', text: part.content })
    } else {
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

/** 从 ContentPart[] 还原编辑器 DOM */
export function restoreContent(
  editor: HTMLElement,
  parts: ContentPart[],
): void {
  editor.innerHTML = ''

  for (const part of parts) {
    if (part.type === 'text') {
      const lines = part.content.split('\n')
      lines.forEach((line, i) => {
        if (line) {
          editor.appendChild(document.createTextNode(line))
        }
        if (i < lines.length - 1) {
          editor.appendChild(document.createElement('br'))
        }
      })
    } else {
      editor.appendChild(createMentionSpan(part.triggeredBy, { id: part.id, label: part.label }))
    }
  }

  setCursorToEnd(editor)
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
export function getPlainTextFromParts(parts: ContentPart[]): string {
  return parts
    .map((p) => (p.type === 'text' ? p.content : `${p.triggeredBy}${p.label}`))
    .join('')
}
