import { mount } from 'svelte'
// 页面样式来自共享层（playground(Vue) / examples/react / examples/svelte 共用同一份）
import '@playground/shared/styles.css'
import App from './App.svelte'

const target = document.getElementById('app')
if (!target) throw new Error('#app not found')

const app = mount(App, { target })

export default app
