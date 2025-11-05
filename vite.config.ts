import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from 'vite-plugin-web-extension'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'process.env': JSON.stringify({}),
    global: JSON.stringify('globalThis'),
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          dest: 'pdfjs-dist/build'
        }
      ]
    }),
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
          service_worker: 'src/background/index.js',
          type: 'module'
        },
        content_scripts: [
          {
            matches: ['https://*.indeed.com/*/viewjob*', 'https://*.indeed.com/viewjob*'],
            js: ['src/content/indeed.js'],
            run_at: 'document_idle'
          }
        ],
        side_panel: {
          default_path: 'sidepanel.html'
        },
        web_accessible_resources: [
          {
            resources: ['icons/*', 'models/*', 'pdfjs-dist/*'],
            matches: ['<all_urls>']
          }
        ]
      }),
      disableAutoLaunch: false,
      skipManifestValidation: false,
      browser: 'chrome',
      // Critical: Configure script builds separately without React
      scriptViteConfig: {
        plugins: [], // No React plugin for scripts
        build: {
          minify: 'terser',
          rollupOptions: {
            output: {
              inlineDynamicImports: true
            }
          }
        }
      }
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
      },
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'sidepanel.css'
          }
          return '[name][extname]'
        }
      }
    }
  }
})
