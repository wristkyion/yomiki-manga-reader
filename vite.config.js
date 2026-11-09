import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        viewer: resolve(__dirname, 'src/viewer.html'),
        settings: resolve(__dirname, 'src/settings.html'),
        studio: resolve(__dirname, 'src/studio.html')
      }
    }
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] }
  }
})