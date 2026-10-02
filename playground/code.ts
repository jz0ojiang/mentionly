/*
 * Vue playground 自己的代码片段（Vue 语法 + 各自的本地化文案）。
 * 不属于共享层：共享层只放与框架无关的界面文案与数据，各框架的示例代码由各自应用维护。
 * React / Svelte 页面各自有一份同样字段的代码文件。
 */
import type { Locale } from '@playground/shared/i18n'

/** 各分区展示的示例代码（与 UiStrings 合并后即为 Vue 页的文案对象） */
export interface CodeStrings {
  basicCode: string
  advancedCode: string
  avatarCode: string
  insertCode: string
  customTriggerCode: string
  paginationCode: string
  deprecatedCode: string
}

export const code: Record<Locale, CodeStrings> = {
  en: {
    basicCode: `<script setup>\nconst triggers = [...]\nconst onSubmit = (parts) => {\n  console.log(parts)\n}\n<\/script>\n\n<template>\n  <MentionInput\n    :triggers="triggers"\n    @submit="onSubmit"\n  />\n<\/template>`,
    advancedCode: `<script setup>\nconst isStreaming = ref(false)\nconst onEnter = (e) => {\n  if (isStreaming.value) e.preventDefault()\n}\n<\/script>\n\n<template>\n  <MentionInput\n    :triggers="triggers"\n    :on-enter="onEnter"\n  >\n    <template #inner-actions="{ submit, isEmpty }">\n      <button :disabled="isEmpty" @click="submit">Send</button>\n    </template>\n  </MentionInput>\n<\/template>`,
    avatarCode: `<template>\n  <MentionInput :triggers="triggers">\n    <template #item="{ item, active, select }">\n      <div class="mention-item" :class="{ active }" @click="select">\n        <span class="avatar">{{ item.label[0] }}</span>\n        <span>{{ item.label }}</span>\n      </div>\n    </template>\n  </MentionInput>\n<\/template>`,
    insertCode: `<script setup>\nconst inputRef = ref()\nlet i = 0\n\nfunction insertContext() {\n  i += 1\n  inputRef.value?.insertMention({\n    id: \`ctx-\${i}\`,\n    label: \`Context #\${i}\`,\n    data: {\n      dataType: 'context_ref',\n      contextId: \`ctx-\${i}\`,\n      source: 'selection',\n      content: 'Long selection text from editor...'\n    }\n  })\n}\n<\/script>\n\n<template>\n  <MentionInput ref="inputRef" :triggers="triggers" />\n  <button @click="insertContext">Insert context node</button>\n<\/template>`,
    customTriggerCode: `<script setup>\nconst variableTriggers = [\n  {\n    char: '$',\n    items: [\n      { id: 'var-1', label: 'workspace.path' },\n      { id: 'var-2', label: 'workspace.branch' }\n    ],\n    toData: (item) => ({\n      dataType: 'variable_ref',\n      variableId: item.id,\n      key: item.label\n    })\n  }\n]\n<\/script>\n\n<template>\n  <MentionInput :triggers="variableTriggers" placeholder="Type $ to insert variables" />\n<\/template>`,
    paginationCode: `<script setup>\n// A remote source with many results\nconst triggers = [\n  {\n    char: '@',\n    pagination: { pageSize: 15 },\n    items: async (query, page) => {\n      const res = await fetch(\n        \`/api/users?q=\${query}&offset=\${page.offset}&limit=\${page.limit}\`\n      )\n      // Return a bare array (hasMore inferred from length >= limit)...\n      return res.json()\n      // ...or be explicit: { items, hasMore }\n    }\n  }\n]\n<\/script>\n\n<template>\n  <MentionInput :triggers="triggers" placeholder="Type @ to search users" />\n<\/template>`,
    deprecatedCode: `<script setup>\n// 1.x (deprecated)\nconst triggers = [\n  {\n    char: '@',\n    items: [...],\n    dataPart: (item) => ({ dataType: 'mentioned_ref', projectId: item.id }),\n    schema: { type: 'tag_ref', mapping: { tagId: 'id' } }\n  }\n]\ninputRef.value?.getDataParts()\n<\/script>\n\n<script setup>\n// 2.0\nconst triggers = [\n  { char: '@', items: [...], toData: (item) => ({ uri: item.uri }) }\n]\ninputRef.value?.getParts()\n<\/script>`,
  },
  zh: {
    basicCode: `<script setup>\nconst triggers = [...]\nconst onSubmit = (parts) => {\n  console.log(parts)\n}\n<\/script>\n\n<template>\n  <MentionInput\n    :triggers="triggers"\n    @submit="onSubmit"\n  />\n<\/template>`,
    advancedCode: `<script setup>\nconst isStreaming = ref(false)\nconst onEnter = (e) => {\n  if (isStreaming.value) e.preventDefault()\n}\n<\/script>\n\n<template>\n  <MentionInput\n    :triggers="triggers"\n    :on-enter="onEnter"\n  >\n    <template #inner-actions="{ submit, isEmpty }">\n      <button :disabled="isEmpty" @click="submit">发送</button>\n    </template>\n  </MentionInput>\n<\/template>`,
    avatarCode: `<template>\n  <MentionInput :triggers="triggers">\n    <template #item="{ item, active, select }">\n      <div class="mention-item" :class="{ active }" @click="select">\n        <span class="avatar">{{ item.label[0] }}</span>\n        <span>{{ item.label }}</span>\n      </div>\n    </template>\n  </MentionInput>\n<\/template>`,
    insertCode: `<script setup>\nconst inputRef = ref()\nlet i = 0\n\nfunction insertContext() {\n  i += 1\n  inputRef.value?.insertMention({\n    id: \`ctx-\${i}\`,\n    label: \`上下文 #\${i}\`,\n    data: {\n      dataType: 'context_ref',\n      contextId: \`ctx-\${i}\`,\n      source: 'selection',\n      content: '来自编辑器的长文本选区...'\n    }\n  })\n}\n<\/script>\n\n<template>\n  <MentionInput ref="inputRef" :triggers="triggers" />\n  <button @click="insertContext">插入上下文节点</button>\n<\/template>`,
    customTriggerCode: `<script setup>\nconst variableTriggers = [\n  {\n    char: '$',\n    items: [\n      { id: 'var-1', label: 'workspace.path' },\n      { id: 'var-2', label: 'workspace.branch' }\n    ],\n    toData: (item) => ({\n      dataType: 'variable_ref',\n      variableId: item.id,\n      key: item.label\n    })\n  }\n]\n<\/script>\n\n<template>\n  <MentionInput :triggers="variableTriggers" placeholder="输入 $ 引用变量" />\n<\/template>`,
    paginationCode: `<script setup>\n// 一个有大量结果的远程数据源\nconst triggers = [\n  {\n    char: '@',\n    pagination: { pageSize: 15 },\n    items: async (query, page) => {\n      const res = await fetch(\n        \`/api/users?q=\${query}&offset=\${page.offset}&limit=\${page.limit}\`\n      )\n      // 返回裸数组（hasMore 按 length >= limit 推断）...\n      return res.json()\n      // ...或显式返回：{ items, hasMore }\n    }\n  }\n]\n<\/script>\n\n<template>\n  <MentionInput :triggers="triggers" placeholder="输入 @ 搜索用户" />\n<\/template>`,
    deprecatedCode: `<script setup>\n// 1.x (已废弃)\nconst triggers = [\n  {\n    char: '@',\n    items: [...],\n    dataPart: (item) => ({ dataType: 'mentioned_ref', projectId: item.id }),\n    schema: { type: 'tag_ref', mapping: { tagId: 'id' } }\n  }\n]\ninputRef.value?.getDataParts()\n<\/script>\n\n<script setup>\n// 2.0\nconst triggers = [\n  { char: '@', items: [...], toData: (item) => ({ uri: item.uri }) }\n]\ninputRef.value?.getParts()\n<\/script>`,
  },
}
