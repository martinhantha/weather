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
  const host = typeof selectorOrElement === 'string'
    ? document.querySelector(selectorOrElement)
    : selectorOrElement
  if (!host || !(host instanceof HTMLElement)) {
    throw new Error('WeatherWidget.mount: element not found or invalid')
  }
  if (!options?.apiUrl) {
    throw new Error('WeatherWidget.mount: options.apiUrl is required')
  }

  // Shadow DOM isolates the widget from page CSS (page-to-widget), without iframes.
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  shadow.innerHTML = ''

  const mountEl = document.createElement('div')
  shadow.appendChild(mountEl)

  const movedStyleEls: HTMLStyleElement[] = []

  function isWidgetStyleEl(node: Node): node is HTMLStyleElement {
    if (!(node instanceof HTMLStyleElement)) return false
    // Vue scoped styles always contain the generated `data-v-...` attribute selector.
    const text = node.textContent ?? ''
    return text.includes('.w-root') && text.includes('data-v-')
  }

  function moveWidgetStyleElsFromHead() {
    for (const node of Array.from(document.head.querySelectorAll('style'))) {
      if (!isWidgetStyleEl(node)) continue
      movedStyleEls.push(node)
      shadow.appendChild(node) // moves the node out of <head> into shadow root
    }
  }

  // Vue injects the widget's <style> tags when the bundle is evaluated,
  // which happens *before* mount() is called. So move existing styles immediately.
  moveWidgetStyleElsFromHead()

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!isWidgetStyleEl(node)) continue
        movedStyleEls.push(node)
        shadow.appendChild(node) // keeps widget styling isolated in the shadow root
      }
    }
  })
  observer.observe(document.head, { childList: true })

  const app = createApp(Widget, { apiUrl: options.apiUrl, debug: options.debug === true })
  app.mount(mountEl)

  return {
    unmount() {
      observer.disconnect()
      app.unmount()
      // Move styles back to document.head so a later mount still has them,
      // and so we don't leave styling behind in the shadow root.
      for (const styleEl of movedStyleEls) {
        if (styleEl && styleEl.parentNode && styleEl.parentNode !== document.head) {
          document.head.appendChild(styleEl)
        }
      }
      shadow.innerHTML = ''
      movedStyleEls.length = 0
    },
  }
}

if (typeof window !== 'undefined') {
  ;(window as any).WeatherWidget = { mount }
}

export { mount }
