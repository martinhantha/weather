import { mount } from './embed'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
mount('#app', { apiUrl })
console.log('Widget dev: mounted with apiUrl =', apiUrl)
