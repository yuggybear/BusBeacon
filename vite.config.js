
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import base44 from '@base44/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true,
    }),
    react(),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
