<script setup lang="ts">
import { ref, computed } from 'vue'
import { MentionInput, version } from 'mentionly'
import type { DataPart, ContentPart, PopupMode, MentionItem } from 'mentionly'

const inputRef = ref()
const output = ref<DataPart[]>([])
const popupMode = ref<PopupMode>('cursor')

// ── i18n ──
type Locale = 'en' | 'zh'
const urlLang = new URLSearchParams(window.location.search).get('lang')
const defaultLocale: Locale = urlLang === 'zh' || urlLang === 'en' ? urlLang : navigator.language.startsWith('zh') ? 'zh' : 'en'
const locale = ref<Locale>(defaultLocale)

const i18n = {
  en: {
    hint: ['Type ', ' to mention projects, ', ' to mention tags, ', ' to run commands'],
    popupMode: 'Popup mode:',
    popupFixed: 'fixed (above editor)',
    popupCursor: 'cursor (follow caret)',
    customAt: 'Custom @ data source (comma separated):',
    customAtPreview: (items: string) => `Current items: ${items || '(empty)'}`,
    placeholder: 'Type a message... try @ # /',
    send: 'Send',
    waiting: 'Waiting for input...',
    editing: 'Editing',
    focusEditor: 'Focus editor',
    loadSaved: 'Load saved',
    focus: 'Focus',
    clear: 'Clear',
    tagBug: 'Bug',
    tagFeature: 'Feature',
    tagRefactor: 'Refactor',
    cmdClear: 'Clear input',
    cmdHelp: 'Show help',
    helpMsg: 'Mentionly Playground — Type @ or # to trigger mention',
    savedParts: [
      { type: 'text', content: 'Check ' },
      { type: 'mention', triggeredBy: '@', id: '1', label: 'Project Alpha' },
      { type: 'text', content: ' deployment status' },
    ] as ContentPart[],
  },
  zh: {
    hint: ['输入 ', ' mention 项目，', ' mention 标签，', ' 执行命令'],
    popupMode: '弹出模式：',
    popupFixed: 'fixed（固定在编辑器上方）',
    popupCursor: 'cursor（跟随光标）',
    customAt: '自定义 @ 数据源（逗号分隔）：',
    customAtPreview: (items: string) => `当前项：${items || '（空）'}`,
    placeholder: '输入消息... 试试 @ # /',
    send: '发送',
    waiting: '等待输入...',
    editing: '编辑中',
    focusEditor: '聚焦编辑器',
    loadSaved: '加载已保存内容',
    focus: '聚焦',
    clear: '清空',
    tagBug: '缺陷',
    tagFeature: '新功能',
    tagRefactor: '重构',
    cmdClear: '清空输入',
    cmdHelp: '查看帮助',
    helpMsg: 'Mentionly Playground - 输入 @ 或 # 触发 mention',
    savedParts: [
      { type: 'text', content: '请检查 ' },
      { type: 'mention', triggeredBy: '@', id: '1', label: 'Project Alpha' },
      { type: 'text', content: ' 的部署状态' },
    ] as ContentPart[],
  },
} as const

const t = computed(() => i18n[locale.value])

// 自定义 @ 数据源
const customAtInput = ref('Project Alpha, Project Beta, Project Gamma')
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
      dataType: 'project_ref',
      projectId: item.id,
      projectName: item.label,
    }),
  },
  {
    char: '#',
    items: [
      { id: 't1', label: 'bug', desc: t.value.tagBug },
      { id: 't2', label: 'feature', desc: t.value.tagFeature },
      { id: 't3', label: 'refactor', desc: t.value.tagRefactor },
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
    <p class="hint">
      {{ t.hint[0] }}<code>@</code>{{ t.hint[1] }}<code>#</code>{{ t.hint[2] }}<code>/</code>{{ t.hint[3] }}
    </p>

    <div class="mode-switch">
      <label>
        <span>{{ t.popupMode }}</span>
        <select v-model="popupMode">
          <option value="fixed">{{ t.popupFixed }}</option>
          <option value="cursor">{{ t.popupCursor }}</option>
        </select>
      </label>
    </div>

    <div class="custom-at">
      <label>
        <span>{{ t.customAt }}</span>
        <input v-model="customAtInput" class="custom-at-input" placeholder="Project Alpha, Project Beta, ..." />
      </label>
      <p class="custom-at-preview">{{ t.customAtPreview(customAtItems.map(i => i.label).join(locale === 'zh' ? '、' : ', ')) }}</p>
    </div>

    <div class="input-area">
      <MentionInput
        ref="inputRef"
        :triggers="triggers"
        :popup-mode="popupMode"
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

    <div v-if="output.length" class="output">
      <h3>Submit Output (DataParts):</h3>
      <pre>{{ JSON.stringify(output, null, 2) }}</pre>
    </div>
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
  margin-bottom: 8px;
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

.hint code {
  background: #e5e7eb;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.input-area {
  margin-bottom: 16px;
}

.mode-switch {
  margin-bottom: 16px;
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

.output {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.output h3 {
  font-size: 14px;
  margin-bottom: 8px;
  color: #374151;
}

.output pre {
  font-size: 12px;
  background: #f9fafb;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  line-height: 1.5;
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
