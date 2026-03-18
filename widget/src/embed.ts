import { createApp } from 'vue'
import Widget from './Widget.vue'

export interface WeatherWidgetOptions {
  /** Base URL of your weather API (e.g. https://your-app.pages.dev) */
  apiUrl: string
  /** Show debug panel (state, apiUrl, API status) */
  debug?: boolean
}

/**
 * Mount the weather widget into a DOM element.
 * Usage:
 *   <div id="weather-widget"></div>
 *   <script src="https://.../weather-widget.js"></script>
 *   <script>
 *     WeatherWidget.mount('#weather-widget', { apiUrl: 'https://your-app.pages.dev' });
 *   </script>
 */
function mount(selectorOrElement: string | HTMLElement, options: WeatherWidgetOptions): { unmount: () => void } {
  const el = typeof selectorOrElement === 'string'
    ? document.querySelector(selectorOrElement)
    : selectorOrElement
  if (!el || !(el instanceof HTMLElement)) {
    throw new Error('WeatherWidget.mount: element not found or invalid')
  }
  if (!options?.apiUrl) {
    throw new Error('WeatherWidget.mount: options.apiUrl is required')
  }
  const app = createApp(Widget, { apiUrl: options.apiUrl, debug: options.debug === true })
  app.mount(el)
  return {
    unmount() {
      app.unmount()
    },
  }
}

if (typeof window !== 'undefined') {
  ;(window as any).WeatherWidget = { mount }
}

export { mount }
