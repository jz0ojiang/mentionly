# @mentionly/core {{version}}

> Framework-agnostic engine behind mentionly: turns a contenteditable element into a mention editor. Use it directly for plain DOM, or through `mentionly` (Vue), `@mentionly/react` or `@mentionly/svelte`. No runtime dependencies.

Exports: {{exports}}

`MentionCore` methods: `attach(el)` (= `setElement(el)` + `start()`), `setElement(el | null)`, `start()`, `stop()`, `setOptions(partial)`, `getState()`, `subscribe(listener)`, `select`, `insertMention`, `loadMore`, `close`, `getParts`, `getPlainText`, `clear`, `setContent`, `focus`, `getDataParts` (1.x); property `ids`.

Subpaths: `@mentionly/core/ai-sdk` (`toUIMessageParts`, `fromUIMessageParts`, types `MentionDataPayload`, `AISDKUIPart`), `@mentionly/core/mcp` (`toMCPContent`, types `MCPContent`, `MCPTextContent`, `MCPResourceLink`).
