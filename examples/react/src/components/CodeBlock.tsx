/*
 * 代码块（对应 playground/components/CodeBlock.vue）。
 * 视觉样式与 prism 主题都在共享层 @playground/shared/styles.css（类名 code-block-* / copy-btn）。
 * 高亮用 prismjs + tsx 语法（jsx / typescript 组件按依赖顺序注册）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-tsx'

export interface CodeBlockProps {
  code: string
  language?: string
  copyLabel: string
  copiedLabel: string
}

export function CodeBlock({ code, language = 'markup', copyLabel, copiedLabel }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  // 代码片段里的 `<\/` 还原成 `</`（与 Vue 版一致）
  const displayCode = useMemo(() => code.replace(/<\\\//g, '</'), [code])

  // 用 Prism.highlight 生成高亮后的 HTML（交给 React 渲染，避免与 vdom 抢 DOM）
  const html = useMemo(() => {
    const grammar = Prism.languages[language] ?? Prism.languages.markup
    return Prism.highlight(displayCode, grammar, language)
  }, [displayCode, language])

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(displayCode)
      setCopied(true)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        setCopied(false)
      }, 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="code-block-wrap">
      <button className="copy-btn" type="button" onClick={onCopy}>
        {copied ? copiedLabel : copyLabel}
      </button>
      <pre className="code-block">
        <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}
