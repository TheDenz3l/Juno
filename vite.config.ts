import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from 'vite-plugin-web-extension'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: () => ({
        manifest_version: 3,
        name: 'Juno - Resume Optimizer',
        version: '0.1.0',
        description: 'AI-powered resume optimizer for job seekers. Get instant ATS scores and tailored suggestions.',
        permissions: [
          'storage',
          'tabs',
          'scripting',
          'sidePanel'
        ],
        host_permissions: [
          'https://*.indeed.com/*',
          'https://*.linkedin.com/*',
          'https://*.glassdoor.com/*'
        ],
        action: {
          default_title: 'Open Juno'
        },
        icons: {
          16: 'icons/icon-16.png',
          48: 'icons/icon-48.png',
          128: 'icons/icon-128.png'
        },
        background: {
          service_worker: 'src/background/index.ts',
          type: 'module'
        },
        content_scripts: [
          {
            matches: ['https://*.indeed.com/*/viewjob*', 'https://*.indeed.com/viewjob*'],
            js: ['src/content/indeed.ts'],
            run_at: 'document_idle'
          }
        ],
        side_panel: {
          default_path: 'sidepanel.html'
        },
        web_accessible_resources: [
          {
            resources: ['icons/*', 'models/*'],
            matches: ['<all_urls>']
          }
        ]
      })
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html')
      }
    }
  }
})
