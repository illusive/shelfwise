import { fileURLToPath, URL } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';

/** Copies the MediaPipe wasm runtime into public/ so it is served locally (no CDN). */
function mediapipeAssets(): PluginOption {
  return {
    name: 'shelfwise-mediapipe-assets',
    configResolved() {
      const from = 'node_modules/@mediapipe/tasks-vision/wasm';
      const to = 'public/mediapipe/wasm';
      mkdirSync(to, { recursive: true });
      for (const file of ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm']) {
        const src = `${from}/${file}`;
        const dest = `${to}/${file}`;
        if (!existsSync(dest) || statSync(dest).size !== statSync(src).size)
          copyFileSync(src, dest);
      }
    },
  };
}

// `npm run dev:lan` (mode "lan") serves self-signed HTTPS on the LAN so phones get a
// secure context for getUserMedia. Docker Compose is the preferred LAN setup.
export default defineConfig(({ mode }) => {
  // GitHub Pages serves the app under /shelfwise/; Docker and dev serve it at /.
  const base = process.env.BASE_PATH ?? '/';
  const plugins: PluginOption[] = [
    mediapipeAssets(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/*', 'hero-shelf.svg'],
      manifest: {
        name: 'Shelfwise',
        short_name: 'Shelfwise',
        description: 'Hyldeandel, priser og kampagner fra butiksbilleder.',
        lang: 'da',
        theme_color: '#173d32',
        background_color: '#f5f4ee',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Live detection assets (~19 MB) load lazily and are cached on first use, not precached.
        globIgnores: ['mediapipe/**', 'models/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/(mediapipe|models)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'shelfwise-detection', expiration: { maxEntries: 8 } },
          },
        ],
        navigateFallback: 'index.html',
      },
    }),
  ];
  if (mode === 'lan') plugins.push(basicSsl());

  return {
    base,
    plugins,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-dom/client'],
            tanstack: ['@tanstack/react-router', '@tanstack/react-query'],
            ui: ['motion', '@radix-ui/react-dialog', '@radix-ui/react-toggle-group'],
            data: ['dexie', 'zod'],
          },
        },
      },
    },
    server: { port: 5173 },
    preview: { port: 4173 },
    worker: { format: 'es' },
  };
});
