<script setup lang="ts">
import { ref, computed } from 'vue'
import { MentionInput, version } from 'mentionly'
import type { Part, PopupMode, PopupScrollBehavior, MentionItem, MentionTrigger } from 'mentionly'
import CodeBlock from './components/CodeBlock.vue'
import FloatingSectionIndicator from './components/FloatingSectionIndicator.vue'
import FrameworkSwitch from './components/FrameworkSwitch.vue'
import { detectLocale, alternateLocale } from '@playground/shared/locale'
import { uiStrings, type Locale } from '@playground/shared/i18n'
import { resolveSections } from '@playground/shared/sections'
import {
  parseCustomAtItems,
  createDemoTriggers,
  createCustomTriggerDemo,
  createPaginationTrigger,
  createInsertPayload,
  getSavedParts,
} from '@playground/shared/demo-data'
import { code } from './code'

const inputRef = ref()
const output = ref<Part[]>([])
const popupMode = ref<PopupMode>('cursor')
const popupScrollBehavior = ref<PopupScrollBehavior>('reposition')
const usageBlockEnter = ref(false)
const insertDemoRef = ref()
const insertCount = ref(0)

// ── i18n ──
// 界面文案来自共享层，示例代码来自本应用（Vue 代码片段不进共享层）
const locale = ref<Locale>(detectLocale())

const t = computed(() => ({ ...uiStrings(locale.value), ...code[locale.value] }))

// 右侧浮动 TOC 跟踪的区块（顺序与文档顺序一致；「Deprecated 1.x API」只有 Vue 页有）
const tocSections = computed(() => resolveSections(uiStrings(locale.value), { includeDeprecated: true }))

// 自定义 @ 数据源
const customAtInput = ref('John Smith, Alice Johnson, Michael Brown, Emily Davis, David Wilson')
const customAtItems = computed<MentionItem[]>(() => parseCustomAtItems(customAtInput.value))

const triggers = computed(() =>
  createDemoTriggers(uiStrings(locale.value), customAtItems.value, {
    clear: () => inputRef.value?.clear(),
    help: () => alert(uiStrings(locale.value).helpMsg),
  }),
)

function onSubmit(parts: Part[]) {
  output.value = parts
  console.log('Submit:', parts)
}

function onChange(parts: Part[]) {
  console.log('Change:', parts)
}

function onUsageEnter(e: KeyboardEvent) {
  if (usageBlockEnter.value) e.preventDefault()
}

function onUsageSubmit(parts: Part[]) {
  console.log('Usage submit:', parts)
}

const customTriggerDemo = computed(() => createCustomTriggerDemo(uiStrings(locale.value)))

// 分页（加载更多）演示：模拟一个有大量结果的远程数据源
const paginationDemo: MentionTrigger[] = [createPaginationTrigger()]

function insertContextNode() {
  insertCount.value += 1
  insertDemoRef.value?.insertMention(createInsertPayload(uiStrings(locale.value), insertCount.value))
}

// 反序列化测试
function loadSaved() {
  inputRef.value?.setContent(getSavedParts(locale.value))
}
</script>

<template>
  <div class="playground">
    <div class="header">
      <h1>Mentionly Playground <span class="version">v{{ version }}</span></h1>
      <div class="header-tools">
        <FrameworkSwitch :locale="locale" current="vue" />
        <button class="lang-btn" @click="locale = alternateLocale(locale)">
          {{ locale === 'en' ? '中文' : 'EN' }}
        </button>
      </div>
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

    <section id="sec-config" class="section">
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

    <section id="sec-editor" class="section">
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

    <section id="sec-output" class="section">
      <h2 class="section-title">Submit Output</h2>
      <div v-if="output.length" class="output">
        <pre>{{ JSON.stringify(output, null, 2) }}</pre>
      </div>
      <div v-else class="output-empty">{{ t.waiting }}</div>
    </section>

    <section class="section">
      <h2 class="section-title">{{ t.usageTitle }}</h2>
      <div class="usage">
        <div id="sec-basic" class="usage-section">
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

        <div id="sec-custom-trigger" class="usage-section">
          <div class="usage-header">
            <h4>{{ t.customTriggerTitle }}</h4>
            <p>{{ t.customTriggerDesc }}</p>
          </div>
          <div class="usage-demo">
            <MentionInput
              :triggers="customTriggerDemo"
              :placeholder="t.customTriggerPlaceholder"
              :popup-scroll-behavior="popupScrollBehavior"
            />
          </div>
          <CodeBlock :code="t.customTriggerCode" :copy-label="t.copy" :copied-label="t.copied" />
        </div>

        <div id="sec-advanced" class="usage-section">
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

        <div id="sec-avatar" class="usage-section">
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

        <div id="sec-insert" class="usage-section">
          <div class="usage-header">
            <h4>{{ t.insertTitle }}</h4>
            <p>{{ t.insertDesc }}</p>
          </div>
          <div class="usage-demo">
            <MentionInput
              ref="insertDemoRef"
              :triggers="triggers"
              :placeholder="t.insertPlaceholder"
              :popup-scroll-behavior="popupScrollBehavior"
            />
            <div class="card-actions">
              <button class="card-btn" @click="insertContextNode">{{ t.insertAction }}</button>
            </div>
          </div>
          <CodeBlock :code="t.insertCode" :copy-label="t.copy" :copied-label="t.copied" />
        </div>

        <div id="sec-pagination" class="usage-section">
          <div class="usage-header">
            <h4>{{ t.paginationTitle }}</h4>
            <p>{{ t.paginationDesc }}</p>
          </div>
          <div class="usage-demo">
            <MentionInput
              :triggers="paginationDemo"
              :placeholder="t.paginationPlaceholder"
              :popup-scroll-behavior="popupScrollBehavior"
            />
          </div>
          <CodeBlock :code="t.paginationCode" :copy-label="t.copy" :copied-label="t.copied" />
        </div>

        <div id="sec-deprecated" class="usage-section">
          <div class="usage-header">
            <h4>{{ t.deprecatedTitle }}</h4>
            <p>{{ t.deprecatedDesc }}</p>
          </div>
          <CodeBlock :code="t.deprecatedCode" :copy-label="t.copy" :copied-label="t.copied" />
        </div>
      </div>
    </section>

    <FloatingSectionIndicator :sections="tocSections" />
  </div>
</template>
