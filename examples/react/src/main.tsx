import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 页面样式来自共享层（与 Vue / Svelte 页面共用同一份）
import '@playground/shared/styles.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
