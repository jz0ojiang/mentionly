<script setup lang="ts">
import { ref, computed } from 'vue'
import { MentionInput, version } from 'mentionly'
import type { DataPart, ContentPart, PopupMode, PopupScrollBehavior, MentionItem } from 'mentionly'
import CodeBlock from './components/CodeBlock.vue'
import { i18n, type Locale } from './i18n'

const inputRef = ref()
const output = ref<DataPart[]>([])
const popupMode = ref<PopupMode>('cursor')
const popupScrollBehavior = ref<PopupScrollBehavior>('reposition')
const usageBlockEnter = ref(false)

// ── i18n ──
const urlLang = new URLSearchParams(window.location.search).get('lang')
const defaultLocale: Locale = urlLang === 'zh' || urlLang === 'en' ? urlLang : navigator.language.startsWith('zh') ? 'zh' : 'en'
const locale = ref<Locale>(defaultLocale)

const t = computed(() => i18n[locale.value])

// 自定义 @ 数据源
const customAtInput = ref('John Smith, Alice Johnson, Michael Brown, Emily Davis, David Wilson')
const customAtItems = computed<MentionItem[]>(() => {
  return customAtInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label, i) => ({ id: String(i + 1), label }))
})

const triggers = computed(() => [
  {
    char: '@',
    items: customAtItems.value,
    dataPart: (item: MentionItem) => ({
      dataType: 'mentioned_ref',
      projectId: item.id,
      projectName: item.label,
    }),
  },
  {
    char: '#',
    items: [
      { id: 't1', label: 'design', desc: t.value.tagBug },
      { id: 't2', label: 'urgent', desc: t.value.tagFeature },
      { id: 't3', label: 'docs', desc: t.value.tagRefactor },
    ],
    schema: {
      type: 'tag_ref',
      mapping: { tagId: 'id', tagName: 'label' },
    },
  },
  {
    char: '/',
    mode: 'command' as const,
    items: [
      { id: 'clear', label: 'clear', desc: t.value.cmdClear },
      { id: 'help', label: 'help', desc: t.value.cmdHelp },
    ],
    onSelect: (item: MentionItem) => {
      if (item.id === 'clear') {
        inputRef.value?.clear()
      }
      if (item.id === 'help') {
        alert(t.value.helpMsg)
      }
    },
  },
])

function onSubmit(parts: DataPart[]) {
  output.value = parts
  console.log('Submit:', parts)
}

function onChange(parts: ContentPart[]) {
  console.log('Change:', parts)
}

function onUsageEnter(e: KeyboardEvent) {
  if (usageBlockEnter.value) e.preventDefault()
}

function onUsageSubmit(parts: DataPart[]) {
  console.log('Usage submit:', parts)
}


// 反序列化测试
function loadSaved() {
  inputRef.value?.setContent(t.value.savedParts)
}
</script>

<template>
  <div class="playground">
    <div class="header">
      <h1>Mentionly Playground <span class="version">v{{ version }}</span></h1>
      <button class="lang-btn" @click="locale = locale === 'en' ? 'zh' : 'en'">
        {{ locale === 'en' ? '中文' : 'EN' }}
      </button>
    </div>
    <div class="header-actions">
      <a class="badge" href="https://github.com/jz0ojiang/mentionly/actions/workflows/test.yml" target="_blank" rel="noreferrer">
        <img src="https://github.com/jz0ojiang/mentionly/actions/workflows/test.yml/badge.svg" alt="tests" />
      </a>
      <a class="badge" href="https://www.npmjs.com/package/mentionly" target="_blank" rel="noreferrer">
        <img src="https://img.shields.io/npm/v/mentionly?color=3b82f6&label=npm&logo=npm" alt="npm version" />
      </a>
      <a class="badge" href="https://www.npmjs.com/package/mentionly" target="_blank" rel="noreferrer">
        <img src="https://img.shields.io/npm/dm/mentionly?color=10b981&label=downloads&logo=npm" alt="npm downloads" />
      </a>
      <a class="badge" href="https://github.com/jz0ojiang/mentionly" target="_blank" rel="noreferrer">
        <img src="https://img.shields.io/badge/GitHub-Repo-111827?logo=github" alt="github repo" />
      </a>
    </div>
    <p class="hint">
      {{ t.hint[0] }}<code>@</code>{{ t.hint[1] }}<code>#</code>{{ t.hint[2] }}<code>/</code>{{ t.hint[3] }}
    </p>

    <section class="section">
      <h2 class="section-title">Playground</h2>
      <div class="controls">
        <div class="mode-switch">
          <label>
            <span>{{ t.popupMode }}</span>
            <select v-model="popupMode">
              <option value="fixed">{{ t.popupFixed }}</option>
              <option value="cursor">{{ t.popupCursor }}</option>
            </select>
          </label>
        </div>

        <div class="mode-switch">
          <label>
            <span>{{ t.popupScroll }}</span>
            <select v-model="popupScrollBehavior">
              <option value="reposition">{{ t.popupScrollReposition }}</option>
              <option value="close">{{ t.popupScrollClose }}</option>
              <option value="ignore">{{ t.popupScrollIgnore }}</option>
            </select>
          </label>
        </div>

        <div class="custom-at">
          <label>
            <span>{{ t.customAt }}</span>
            <input v-model="customAtInput" class="custom-at-input" />
          </label>
          <p class="custom-at-preview">{{ t.customAtPreview(customAtItems.map(i => i.label).join(locale === 'zh' ? '、' : ', ')) }}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Editor</h2>
      <div class="input-area">
        <MentionInput
          ref="inputRef"
          :triggers="triggers"
          :popup-mode="popupMode"
          :popup-scroll-behavior="popupScrollBehavior"
          :placeholder="t.placeholder"
          @submit="onSubmit"
          @change="onChange"
        >
          <template #inner-actions="{ submit, isEmpty }">
            <div class="inner-actions">
              <button class="send-btn" :disabled="isEmpty" @click="submit">
                {{ t.send }}
              </button>
            </div>
          </template>

          <template #default="{ isEmpty: empty, focus: focusFn }">
            <div class="extra-info">
              <span>{{ empty ? t.waiting : t.editing }}</span>
              <button class="focus-btn" @click="focusFn">{{ t.focusEditor }}</button>
            </div>
          </template>
        </MentionInput>
      </div>

      <div class="actions">
        <button @click="loadSaved">{{ t.loadSaved }}</button>
        <button @click="inputRef?.focus()">{{ t.focus }}</button>
        <button @click="inputRef?.clear()">{{ t.clear }}</button>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Submit Output</h2>
      <div v-if="output.length" class="output">
        <pre>{{ JSON.stringify(output, null, 2) }}</pre>
      </div>
      <div v-else class="output-empty">{{ t.waiting }}</div>
    </section>

    <section class="section">
      <h2 class="section-title">{{ t.usageTitle }}</h2>
      <div class="usage">
        <div class="usage-section">
          <div class="usage-header">
            <h4>{{ t.basicTitle }}</h4>
            <p>{{ t.basicDesc }}</p>
          </div>
          <div class="usage-demo">
            <MentionInput
              :triggers="triggers"
              :placeholder="t.placeholder"
              :popup-scroll-behavior="popupScrollBehavior"
              @submit="onUsageSubmit"
            />
          </div>
          <CodeBlock :code="t.basicCode" :copy-label="t.copy" :copied-label="t.copied" />
        </div>

        <div class="usage-section">
          <div class="usage-header">
            <h4>{{ t.advancedTitle }}</h4>
            <p>{{ t.advancedDesc }}</p>
          </div>
          <div class="usage-demo">
            <div class="usage-controls">
              <label>
                <input v-model="usageBlockEnter" type="checkbox" />
                <span>{{ t.streaming }}</span>
              </label>
              <p class="streaming-note">{{ t.streamingNote }}</p>
            </div>
            <MentionInput
              :triggers="triggers"
              :placeholder="t.placeholder"
              :popup-scroll-behavior="popupScrollBehavior"
              :on-enter="onUsageEnter"
              @submit="onUsageSubmit"
            >
              <template #inner-actions="{ submit, isEmpty }">
                <div class="inner-actions">
                  <button class="send-btn" :disabled="isEmpty" @click="submit">
                    {{ t.send }}
                  </button>
                </div>
              </template>
            </MentionInput>
          </div>
          <CodeBlock :code="t.advancedCode" :copy-label="t.copy" :copied-label="t.copied" />
        </div>

        <div class="usage-section">
          <div class="usage-header">
            <h4>{{ t.avatarTitle }}</h4>
            <p>{{ t.avatarDesc }}</p>
          </div>
          <div class="usage-demo">
            <MentionInput
              :triggers="triggers"
              :placeholder="t.placeholder"
              :popup-scroll-behavior="popupScrollBehavior"
            >
              <template #item="{ item, active, select }">
                <div class="mention-item" :class="{ active }" @click="select">
                  <span class="avatar">{{ item.label[0] }}</span>
                  <span>{{ item.label }}</span>
                </div>
              </template>
            </MentionInput>
          </div>
          <CodeBlock :code="t.avatarCode" :copy-label="t.copy" :copied-label="t.copied" />
        </div>
      </div>
    </section>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f9fafb;
  color: #111827;
}

.playground {
  max-width: 640px;
  margin: 60px auto;
  padding: 0 20px;
}

h1 {
  font-size: 24px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  font-size: 12px;
  text-decoration: none;
  transition: all 0.15s;
}

.badge:hover {
  opacity: 0.85;
}

.badge img {
  height: 18px;
  display: block;
}

.lang-btn {
  padding: 2px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.15s;
}

.lang-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.version {
  font-size: 13px;
  font-weight: 400;
  color: #9ca3af;
}

.hint {
  color: #6b7280;
  margin-bottom: 24px;
  font-size: 14px;
}

.section {
  padding: 18px 0 22px;
  border-top: 1px solid #e5e7eb;
}

.section:first-of-type {
  border-top: none;
  padding-top: 0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #374151;
  margin-bottom: 14px;
}

.hint code {
  background: #e5e7eb;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.input-area {
  margin-bottom: 12px;
}

.controls {
  display: grid;
  gap: 12px;
}

.usage-demo {
  margin: 10px 0 12px;
}

.usage-controls {
  margin-bottom: 8px;
  font-size: 12px;
  color: #374151;
}

.usage-controls label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mode-switch {
  margin-bottom: 16px;
}

.streaming-note {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}

.mode-switch label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
}

.mode-switch select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}

.actions {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.actions button {
  padding: 6px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.actions button:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.output pre {
  font-size: 12px;
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  line-height: 1.5;
}

.output-empty {
  font-size: 12px;
  color: #9ca3af;
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
}


.usage {
  margin-top: 4px;
}

.usage-section {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fff;
}

.usage-header {
  margin-bottom: 10px;
}

.usage-header h4 {
  font-size: 15px;
  color: #111827;
  margin-bottom: 6px;
}

.usage-header p {
  font-size: 13px;
  color: #6b7280;
}


.mention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.mention-item.active,
.mention-item:hover {
  background: #f3f4f6;
}

.avatar {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #e5e7eb;
  color: #374151;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
}

.inner-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px 8px 8px;
}

.send-btn {
  padding: 4px 16px;
  border: none;
  border-radius: 6px;
  background: #3b82f6;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.send-btn:hover:not(:disabled) {
  background: #2563eb;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.extra-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}

.focus-btn {
  padding: 2px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}

.custom-at {
  margin-bottom: 16px;
}

.custom-at label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  color: #374151;
}

.custom-at-input {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  width: 100%;
}

.custom-at-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.custom-at-preview {
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
}
</style>
