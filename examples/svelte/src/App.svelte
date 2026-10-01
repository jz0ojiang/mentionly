<script module lang="ts">
  import { createPaginationTrigger } from '@playground/shared/demo-data'
  import type { MentionTrigger } from '@mentionly/svelte'

  // 分页（加载更多）演示：模拟一个有大量结果的远程数据源。
  // 放在 module 作用域，保证引用稳定（否则每次渲染都会关闭列表）。
  const paginationDemo: MentionTrigger[] = [createPaginationTrigger()]
</script>

<script lang="ts">
  import { version } from '@mentionly/svelte'
  import type { MentionItem, Part, PopupMode, PopupScrollBehavior } from '@mentionly/svelte'
  import CodeBlock from './CodeBlock.svelte'
  import FloatingSectionIndicator from './FloatingSectionIndicator.svelte'
  import FrameworkSwitch from './FrameworkSwitch.svelte'
  import MentionInput from './MentionInput.svelte'
  import { detectLocale, alternateLocale } from '@playground/shared/locale'
  import { uiStrings, type Locale } from '@playground/shared/i18n'
  import { resolveSections } from '@playground/shared/sections'
  import {
    parseCustomAtItems,
    createDemoTriggers,
    createCustomTriggerDemo,
    createInsertPayload,
    getSavedParts,
  } from '@playground/shared/demo-data'
  import { code } from './code'

  // ── i18n ──
  // 界面文案来自共享层，示例代码来自本应用（Svelte 代码片段不进共享层）
  let locale = $state<Locale>(detectLocale())

  const t = $derived({ ...uiStrings(locale), ...code[locale] })

  // 右侧浮动 TOC 跟踪的区块（顺序与文档顺序一致；Svelte 页没有「Deprecated 1.x API」）
  const tocSections = $derived(resolveSections(uiStrings(locale), { includeDeprecated: false }))

  // ── 组件实例（bind:this），用于命令式 API（insertMention / setContent / focus / clear）──
  let inputRef: MentionInput | undefined = $state()
  let insertDemoRef: MentionInput | undefined = $state()

  // ── Playground 配置 ──
  let popupMode = $state<PopupMode>('cursor')
  let popupScrollBehavior = $state<PopupScrollBehavior>('reposition')

  // 自定义 @ 数据源
  let customAtInput = $state(
    'John Smith, Alice Johnson, Michael Brown, Emily Davis, David Wilson',
  )
  const customAtItems = $derived<MentionItem[]>(parseCustomAtItems(customAtInput))

  const triggers = $derived(
    createDemoTriggers(uiStrings(locale), customAtItems, {
      clear: () => inputRef?.clear(),
      help: () => alert(uiStrings(locale).helpMsg),
    }),
  )

  // ── Editor 区 ──
  let output = $state<Part[]>([])

  function onSubmit(parts: Part[]) {
    output = parts
    console.log('Submit:', parts)
  }

  function onChange(parts: Part[]) {
    console.log('Change:', parts)
  }

  // 反序列化测试
  function loadSaved() {
    inputRef?.setContent(getSavedParts(locale))
  }

  // ── 用法演示 ──
  let usageBlockEnter = $state(false)

  function onUsageEnter(event: KeyboardEvent) {
    if (usageBlockEnter) event.preventDefault()
  }

  function onUsageSubmit(parts: Part[]) {
    console.log('Usage submit:', parts)
  }

  const customTriggerDemo = $derived(createCustomTriggerDemo(uiStrings(locale)))

  let insertCount = $state(0)

  function insertContextNode() {
    insertCount += 1
    insertDemoRef?.insertMention(createInsertPayload(uiStrings(locale), insertCount))
  }
</script>

<div class="playground">
  <div class="header">
    <h1>Mentionly Playground <span class="version">v{version}</span></h1>
    <div class="header-tools">
      <FrameworkSwitch {locale} current="svelte" />
      <button class="lang-btn" onclick={() => (locale = alternateLocale(locale))}>
        {locale === 'en' ? '中文' : 'EN'}
      </button>
    </div>
  </div>
  <div class="header-actions">
    <a
      class="badge"
      href="https://github.com/jz0ojiang/mentionly/actions/workflows/test.yml"
      target="_blank"
      rel="noreferrer"
    >
      <img
        src="https://github.com/jz0ojiang/mentionly/actions/workflows/test.yml/badge.svg"
        alt="tests"
      />
    </a>
    <a
      class="badge"
      href="https://www.npmjs.com/package/mentionly"
      target="_blank"
      rel="noreferrer"
    >
      <img
        src="https://img.shields.io/npm/v/mentionly?color=3b82f6&label=npm&logo=npm"
        alt="npm version"
      />
    </a>
    <a
      class="badge"
      href="https://www.npmjs.com/package/mentionly"
      target="_blank"
      rel="noreferrer"
    >
      <img
        src="https://img.shields.io/npm/dm/mentionly?color=10b981&label=downloads&logo=npm"
        alt="npm downloads"
      />
    </a>
    <a class="badge" href="https://github.com/jz0ojiang/mentionly" target="_blank" rel="noreferrer">
      <img src="https://img.shields.io/badge/GitHub-Repo-111827?logo=github" alt="github repo" />
    </a>
  </div>
  <p class="hint">
    {t.hint[0]}<code>@</code>{t.hint[1]}<code>#</code>{t.hint[2]}<code>/</code>{t.hint[3]}
  </p>

  <section id="sec-config" class="section">
    <h2 class="section-title">Playground</h2>
    <div class="controls">
      <div class="mode-switch">
        <label>
          <span>{t.popupMode}</span>
          <select bind:value={popupMode}>
            <option value="fixed">{t.popupFixed}</option>
            <option value="cursor">{t.popupCursor}</option>
          </select>
        </label>
      </div>

      <div class="mode-switch">
        <label>
          <span>{t.popupScroll}</span>
          <select bind:value={popupScrollBehavior}>
            <option value="reposition">{t.popupScrollReposition}</option>
            <option value="close">{t.popupScrollClose}</option>
            <option value="ignore">{t.popupScrollIgnore}</option>
          </select>
        </label>
      </div>

      <div class="custom-at">
        <label>
          <span>{t.customAt}</span>
          <input class="custom-at-input" bind:value={customAtInput} />
        </label>
        <p class="custom-at-preview">
          {t.customAtPreview(
            customAtItems.map((item) => item.label).join(locale === 'zh' ? '、' : ', '),
          )}
        </p>
      </div>
    </div>
  </section>

  <section id="sec-editor" class="section">
    <h2 class="section-title">Editor</h2>
    <div class="input-area">
      <MentionInput
        bind:this={inputRef}
        {triggers}
        {popupMode}
        {popupScrollBehavior}
        placeholder={t.placeholder}
        onsubmit={onSubmit}
        onchange={onChange}
      >
        {#snippet innerActions({ submit, isEmpty })}
          <div class="inner-actions">
            <button class="send-btn" disabled={isEmpty} onclick={submit}>{t.send}</button>
          </div>
        {/snippet}

        {#snippet children({ isEmpty, focus })}
          <div class="extra-info">
            <span>{isEmpty ? t.waiting : t.editing}</span>
            <button class="focus-btn" onclick={focus}>{t.focusEditor}</button>
          </div>
        {/snippet}
      </MentionInput>
    </div>

    <div class="actions">
      <button onclick={loadSaved}>{t.loadSaved}</button>
      <button onclick={() => inputRef?.focus()}>{t.focus}</button>
      <button onclick={() => inputRef?.clear()}>{t.clear}</button>
    </div>
  </section>

  <section id="sec-output" class="section">
    <h2 class="section-title">Submit Output</h2>
    {#if output.length}
      <div class="output">
        <pre>{JSON.stringify(output, null, 2)}</pre>
      </div>
    {:else}
      <div class="output-empty">{t.waiting}</div>
    {/if}
  </section>

  <section class="section">
    <h2 class="section-title">{t.usageTitle}</h2>
    <div class="usage">
      <div id="sec-basic" class="usage-section">
        <div class="usage-header">
          <h4>{t.basicTitle}</h4>
          <p>{t.basicDesc}</p>
        </div>
        <div class="usage-demo">
          <MentionInput
            {triggers}
            placeholder={t.placeholder}
            {popupScrollBehavior}
            onsubmit={onUsageSubmit}
          />
        </div>
        <CodeBlock code={t.basicCode} copyLabel={t.copy} copiedLabel={t.copied} />
      </div>

      <div id="sec-custom-trigger" class="usage-section">
        <div class="usage-header">
          <h4>{t.customTriggerTitle}</h4>
          <p>{t.customTriggerDesc}</p>
        </div>
        <div class="usage-demo">
          <MentionInput
            triggers={customTriggerDemo}
            placeholder={t.customTriggerPlaceholder}
            {popupScrollBehavior}
          />
        </div>
        <CodeBlock code={t.customTriggerCode} copyLabel={t.copy} copiedLabel={t.copied} />
      </div>

      <div id="sec-advanced" class="usage-section">
        <div class="usage-header">
          <h4>{t.advancedTitle}</h4>
          <p>{t.advancedDesc}</p>
        </div>
        <div class="usage-demo">
          <div class="usage-controls">
            <label>
              <input type="checkbox" bind:checked={usageBlockEnter} />
              <span>{t.streaming}</span>
            </label>
            <p class="streaming-note">{t.streamingNote}</p>
          </div>
          <MentionInput
            {triggers}
            placeholder={t.placeholder}
            {popupScrollBehavior}
            onenter={onUsageEnter}
            onsubmit={onUsageSubmit}
          >
            {#snippet innerActions({ submit, isEmpty })}
              <div class="inner-actions">
                <button class="send-btn" disabled={isEmpty} onclick={submit}>{t.send}</button>
              </div>
            {/snippet}
          </MentionInput>
        </div>
        <CodeBlock code={t.advancedCode} copyLabel={t.copy} copiedLabel={t.copied} />
      </div>

      <div id="sec-avatar" class="usage-section">
        <div class="usage-header">
          <h4>{t.avatarTitle}</h4>
          <p>{t.avatarDesc}</p>
        </div>
        <div class="usage-demo">
          <MentionInput {triggers} placeholder={t.placeholder} {popupScrollBehavior}>
            {#snippet item({ item, active, select })}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="mention-item" class:active onclick={select}>
                <span class="avatar">{item.label[0]}</span>
                <span>{item.label}</span>
              </div>
            {/snippet}
          </MentionInput>
        </div>
        <CodeBlock code={t.avatarCode} copyLabel={t.copy} copiedLabel={t.copied} />
      </div>

      <div id="sec-insert" class="usage-section">
        <div class="usage-header">
          <h4>{t.insertTitle}</h4>
          <p>{t.insertDesc}</p>
        </div>
        <div class="usage-demo">
          <MentionInput
            bind:this={insertDemoRef}
            {triggers}
            placeholder={t.insertPlaceholder}
            {popupScrollBehavior}
          />
          <div class="card-actions">
            <button class="card-btn" onclick={insertContextNode}>{t.insertAction}</button>
          </div>
        </div>
        <CodeBlock code={t.insertCode} copyLabel={t.copy} copiedLabel={t.copied} />
      </div>

      <div id="sec-pagination" class="usage-section">
        <div class="usage-header">
          <h4>{t.paginationTitle}</h4>
          <p>{t.paginationDesc}</p>
        </div>
        <div class="usage-demo">
          <MentionInput
            triggers={paginationDemo}
            placeholder={t.paginationPlaceholder}
            {popupScrollBehavior}
          />
        </div>
        <CodeBlock code={t.paginationCode} copyLabel={t.copy} copiedLabel={t.copied} />
      </div>
    </div>
  </section>

  <FloatingSectionIndicator sections={tocSections} />
</div>
