import { createApp } from 'vue'
// 页面样式来自共享层（三个应用共用同一份）
import '@playground/shared/styles.css'
import App from './App.vue'

createApp(App).mount('#app')
