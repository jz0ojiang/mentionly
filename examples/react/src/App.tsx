/*
 * Playground 的 React 页面：与 Vue playground/App.vue 的分区、布局、文案、演示数据逐项对应。
 * - 界面文案来自共享层 @playground/shared（i18n.ts），演示数据 / triggers 来自 demo-data.ts
 * - 右侧浮动目录的分区来自 sections.ts（不含 Vue 独有的「Deprecated 1.x API」）
 * - 示例代码来自本应用的 src/code.ts（React 语法）
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { version } from '@mentionly/react'
import type { MentionTrigger, Part, PopupMode, PopupScrollBehavior } from '@mentionly/react'
import { MentionInput, type MentionInputHandle } from './MentionInput'
import { CodeBlock } from './components/CodeBlock'
import { FloatingSectionIndicator } from './components/FloatingSectionIndicator'
import { FrameworkSwitch } from './components/FrameworkSwitch'
import { detectLocale, alternateLocale } from '@playground/shared/locale'
import { uiStrings, type Locale } from '@playground/shared/i18n'
import { resolveSections } from '@playground/shared/sections'
import { BADGES } from '@playground/shared/badges'
import {
  parseCustomAtItems,
  createDemoTriggers,
  createCustomTriggerDemo,
  createPaginationTrigger,
  createInsertPayload,
  getSavedParts,
} from '@playground/shared/demo-data'
import { code } from './code'

// 分页（加载更多）演示：模拟一个有大量结果的远程数据源（模块级常量 = 引用稳定）
const paginationDemo: MentionTrigger[] = [createPaginationTrigger()]

const DEFAULT_CUSTOM_AT = 'John Smith, Alice Johnson, Michael Brown, Emily Davis, David Wilson'

export function App() {
  const inputRef = useRef<MentionInputHandle>(null)
  const insertDemoRef = useRef<MentionInputHandle>(null)
  const insertCount = useRef(0)

  const [output, setOutput] = useState<Part[]>([])
  const [popupMode, setPopupMode] = useState<PopupMode>('cursor')
  const [popupScrollBehavior, setPopupScrollBehavior] = useState<PopupScrollBehavior>('reposition')
  const [usageBlockEnter, setUsageBlockEnter] = useState(false)
  const [customAtInput, setCustomAtInput] = useState(DEFAULT_CUSTOM_AT)

  // ── i18n ──
  // 初始语言看 ?lang= / 浏览器语言；切换只改内存状态（与 Vue 版一致），
  // 框架切换链接会带上当前 lang（frameworkHref → withLangParam）
  const [locale, setLocale] = useState<Locale>(() => detectLocale())

  const t = useMemo(() => ({ ...uiStrings(locale), ...code[locale] }), [locale])

  // 右侧浮动 TOC 跟踪的区块（顺序与文档顺序一致；不含 Vue 独有的 Deprecated 分区）
  const tocSections = useMemo(() => resolveSections(uiStrings(locale), { includeDeprecated: false }), [locale])

  // 自定义 @ 数据源
  const customAtItems = useMemo(() => parseCustomAtItems(customAtInput), [customAtInput])

  const triggers = useMemo(
    () =>
      createDemoTriggers(uiStrings(locale), customAtItems, {
        clear: () => inputRef.current?.clear(),
        help: () => alert(uiStrings(locale).helpMsg),
      }),
    [locale, customAtItems],
  )

  const customTriggerDemo = useMemo(() => createCustomTriggerDemo(uiStrings(locale)), [locale])

  const onSubmit = useCallback((parts: Part[]) => {
    setOutput(parts)
    console.log('Submit:', parts)
  }, [])

  const onChange = useCallback((parts: Part[]) => {
    console.log('Change:', parts)
  }, [])

  const onUsageEnter = useCallback(
    (e: KeyboardEvent) => {
      if (usageBlockEnter) e.preventDefault()
    },
    [usageBlockEnter],
  )

  const onUsageSubmit = useCallback((parts: Part[]) => {
    console.log('Usage submit:', parts)
  }, [])

  const insertContextNode = useCallback(() => {
    insertCount.current += 1
    insertDemoRef.current?.insertMention(createInsertPayload(uiStrings(locale), insertCount.current))
  }, [locale])

  // 反序列化测试
  const loadSaved = useCallback(() => {
    inputRef.current?.setContent(getSavedParts(locale))
  }, [locale])

  return (
    <div className="playground">
      <div className="header">
        <h1>
          Mentionly Playground <span className="version">v{version}</span>
        </h1>
        <div className="header-tools">
          <FrameworkSwitch locale={locale} current="react" />
          <button className="lang-btn" onClick={() => setLocale(alternateLocale(locale))}>
            {locale === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </div>
      <div className="header-actions">
        {BADGES.map((b) => (
          <a key={b.alt} className="badge" href={b.href} target="_blank" rel="noreferrer">
            <img src={b.src} alt={b.alt} />
          </a>
        ))}
      </div>
      <p className="hint">
        {t.hint[0]}
        <code>@</code>
        {t.hint[1]}
        <code>#</code>
        {t.hint[2]}
        <code>/</code>
        {t.hint[3]}
      </p>

      <section id="sec-config" className="section">
        <h2 className="section-title">Playground</h2>
        <div className="controls">
          <div className="mode-switch">
            <label>
              <span>{t.popupMode}</span>
              <select value={popupMode} onChange={(e) => setPopupMode(e.target.value as PopupMode)}>
                <option value="fixed">{t.popupFixed}</option>
                <option value="cursor">{t.popupCursor}</option>
              </select>
            </label>
          </div>

          <div className="mode-switch">
            <label>
              <span>{t.popupScroll}</span>
              <select
                value={popupScrollBehavior}
                onChange={(e) => setPopupScrollBehavior(e.target.value as PopupScrollBehavior)}
              >
                <option value="reposition">{t.popupScrollReposition}</option>
                <option value="close">{t.popupScrollClose}</option>
                <option value="ignore">{t.popupScrollIgnore}</option>
              </select>
            </label>
          </div>

          <div className="custom-at">
            <label>
              <span>{t.customAt}</span>
              <input
                className="custom-at-input"
                value={customAtInput}
                onChange={(e) => setCustomAtInput(e.target.value)}
              />
            </label>
            <p className="custom-at-preview">
              {t.customAtPreview(customAtItems.map((i) => i.label).join(locale === 'zh' ? '、' : ', '))}
            </p>
          </div>
        </div>
      </section>

      <section id="sec-editor" className="section">
        <h2 className="section-title">Editor</h2>
        <div className="input-area">
          <MentionInput
            ref={inputRef}
            triggers={triggers}
            popupMode={popupMode}
            popupScrollBehavior={popupScrollBehavior}
            placeholder={t.placeholder}
            onSubmit={onSubmit}
            onChange={onChange}
            renderInnerActions={({ submit, isEmpty }) => (
              <div className="inner-actions">
                <button className="send-btn" disabled={isEmpty} onClick={submit}>
                  {t.send}
                </button>
              </div>
            )}
          >
            {({ isEmpty, focus }) => (
              <div className="extra-info">
                <span>{isEmpty ? t.waiting : t.editing}</span>
                <button className="focus-btn" onClick={focus}>
                  {t.focusEditor}
                </button>
              </div>
            )}
          </MentionInput>
        </div>

        <div className="actions">
          <button onClick={loadSaved}>{t.loadSaved}</button>
          <button onClick={() => inputRef.current?.focus()}>{t.focus}</button>
          <button onClick={() => inputRef.current?.clear()}>{t.clear}</button>
        </div>
      </section>

      <section id="sec-output" className="section">
        <h2 className="section-title">Submit Output</h2>
        {output.length ? (
          <div className="output">
            <pre>{JSON.stringify(output, null, 2)}</pre>
          </div>
        ) : (
          <div className="output-empty">{t.waiting}</div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">{t.usageTitle}</h2>
        <div className="usage">
          <div id="sec-basic" className="usage-section">
            <div className="usage-header">
              <h4>{t.basicTitle}</h4>
              <p>{t.basicDesc}</p>
            </div>
            <div className="usage-demo">
              <MentionInput
                triggers={triggers}
                placeholder={t.placeholder}
                popupScrollBehavior={popupScrollBehavior}
                onSubmit={onUsageSubmit}
              />
            </div>
            <CodeBlock code={t.basicCode} language="tsx" copyLabel={t.copy} copiedLabel={t.copied} />
          </div>

          <div id="sec-custom-trigger" className="usage-section">
            <div className="usage-header">
              <h4>{t.customTriggerTitle}</h4>
              <p>{t.customTriggerDesc}</p>
            </div>
            <div className="usage-demo">
              <MentionInput
                triggers={customTriggerDemo}
                placeholder={t.customTriggerPlaceholder}
                popupScrollBehavior={popupScrollBehavior}
              />
            </div>
            <CodeBlock code={t.customTriggerCode} language="tsx" copyLabel={t.copy} copiedLabel={t.copied} />
          </div>

          <div id="sec-advanced" className="usage-section">
            <div className="usage-header">
              <h4>{t.advancedTitle}</h4>
              <p>{t.advancedDesc}</p>
            </div>
            <div className="usage-demo">
              <div className="usage-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={usageBlockEnter}
                    onChange={(e) => setUsageBlockEnter(e.target.checked)}
                  />
                  <span>{t.streaming}</span>
                </label>
                <p className="streaming-note">{t.streamingNote}</p>
              </div>
              <MentionInput
                triggers={triggers}
                placeholder={t.placeholder}
                popupScrollBehavior={popupScrollBehavior}
                onEnter={onUsageEnter}
                onSubmit={onUsageSubmit}
                renderInnerActions={({ submit, isEmpty }) => (
                  <div className="inner-actions">
                    <button className="send-btn" disabled={isEmpty} onClick={submit}>
                      {t.send}
                    </button>
                  </div>
                )}
              />
            </div>
            <CodeBlock code={t.advancedCode} language="tsx" copyLabel={t.copy} copiedLabel={t.copied} />
          </div>

          <div id="sec-avatar" className="usage-section">
            <div className="usage-header">
              <h4>{t.avatarTitle}</h4>
              <p>{t.avatarDesc}</p>
            </div>
            <div className="usage-demo">
              <MentionInput
                triggers={triggers}
                placeholder={t.placeholder}
                popupScrollBehavior={popupScrollBehavior}
                renderItem={({ item, active, select }) => (
                  <div className={`mention-item${active ? ' active' : ''}`} onClick={select}>
                    <span className="avatar">{item.label[0]}</span>
                    <span>{item.label}</span>
                  </div>
                )}
              />
            </div>
            <CodeBlock code={t.avatarCode} language="tsx" copyLabel={t.copy} copiedLabel={t.copied} />
          </div>

          <div id="sec-insert" className="usage-section">
            <div className="usage-header">
              <h4>{t.insertTitle}</h4>
              <p>{t.insertDesc}</p>
            </div>
            <div className="usage-demo">
              <MentionInput
                ref={insertDemoRef}
                triggers={triggers}
                placeholder={t.insertPlaceholder}
                popupScrollBehavior={popupScrollBehavior}
              />
              <div className="card-actions">
                <button className="card-btn" onClick={insertContextNode}>
                  {t.insertAction}
                </button>
              </div>
            </div>
            <CodeBlock code={t.insertCode} language="tsx" copyLabel={t.copy} copiedLabel={t.copied} />
          </div>

          <div id="sec-pagination" className="usage-section">
            <div className="usage-header">
              <h4>{t.paginationTitle}</h4>
              <p>{t.paginationDesc}</p>
            </div>
            <div className="usage-demo">
              <MentionInput
                triggers={paginationDemo}
                placeholder={t.paginationPlaceholder}
                popupScrollBehavior={popupScrollBehavior}
              />
            </div>
            <CodeBlock code={t.paginationCode} language="tsx" copyLabel={t.copy} copiedLabel={t.copied} />
          </div>
        </div>
      </section>

      <FloatingSectionIndicator sections={tocSections} />
    </div>
  )
}
