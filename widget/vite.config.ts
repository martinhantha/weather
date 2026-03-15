import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
    // Vue runtime checks process.env.NODE_ENV; browser has no process
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/embed.ts'),
      name: 'WeatherWidget',
      fileName: () => 'weather-widget.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith('.css') ? 'weather-widget.css' : 'weather-widget.[ext]',
      },
    },
    cssCodeSplit: true,
    outDir: 'dist',
  },
})
