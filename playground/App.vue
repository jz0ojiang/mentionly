<script setup lang="ts">
import { ref } from 'vue'
import { MentionInput } from 'mentionly'
import type { MentionTrigger, DataPart, ContentPart, PopupMode } from 'mentionly'

const inputRef = ref()
const output = ref<DataPart[]>([])
const popupMode = ref<PopupMode>('cursor')
const triggers: MentionTrigger[] = [
  {
    char: '@',
    items: [
      { id: '1', label: 'Project Alpha', desc: '前端项目' },
      { id: '2', label: 'Project Beta', desc: '后端服务' },
      { id: '3', label: 'Project Gamma', desc: '数据平台' },
    ],
    dataPart: (item) => ({
      type: 'data',
      dataType: 'project_ref',
      projectId: item.id,
      projectName: item.label,
    }),
  },
  {
    char: '#',
    items: [
      { id: 't1', label: 'bug', desc: '缺陷' },
      { id: 't2', label: 'feature', desc: '新功能' },
      { id: 't3', label: 'refactor', desc: '重构' },
    ],
    schema: {
      type: 'tag_ref',
      mapping: { tagId: 'id', tagName: 'label' },
    },
  },
  {
    char: '/',
    mode: 'command',
    items: [
      { id: 'clear', label: 'clear', desc: '清空输入' },
      { id: 'help', label: 'help', desc: '查看帮助' },
    ],
    onSelect: (item) => {
      if (item.id === 'clear') {
        inputRef.value?.clear()
      }
      if (item.id === 'help') {
        alert('Mentionly Playground - 输入 @ 或 # 触发 mention')
      }
    },
  },
]

function onSubmit(parts: DataPart[]) {
  output.value = parts
  console.log('Submit:', parts)
}

function onChange(parts: ContentPart[]) {
  console.log('Change:', parts)
}

// 反序列化测试
const savedParts: ContentPart[] = [
  { type: 'text', content: '请检查 ' },
  { type: 'mention', triggeredBy: '@', id: '1', label: 'Project Alpha' },
  { type: 'text', content: ' 的部署状态' },
]

function loadSaved() {
  inputRef.value?.setContent(savedParts)
}
</script>

<template>
  <div class="playground">
    <h1>Mentionly Playground</h1>
    <p class="hint">
      输入 <code>@</code> mention 项目，<code>#</code> mention 标签，<code>/</code> 执行命令
    </p>

    <div class="mode-switch">
      <label>
        <span>弹出模式：</span>
        <select v-model="popupMode">
          <option value="fixed">fixed（固定在编辑器上方）</option>
          <option value="cursor">cursor（跟随光标）</option>
        </select>
      </label>
    </div>

    <div class="input-area">
      <MentionInput
        ref="inputRef"
        :triggers="triggers"
        :popup-mode="popupMode"
        placeholder="输入消息... 试试 @ # /"
        @submit="onSubmit"
        @change="onChange"
      />
    </div>

    <div class="actions">
      <button @click="loadSaved">加载已保存内容</button>
      <button @click="inputRef?.focus()">聚焦</button>
      <button @click="inputRef?.clear()">清空</button>
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
  margin-bottom: 8px;
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
</style>
