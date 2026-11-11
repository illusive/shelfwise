import { fileURLToPath, URL } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// `npm run dev:lan` (mode "lan") serves self-signed HTTPS on the LAN so phones get a
// secure context for getUserMedia. Docker Compose is the preferred LAN setup.
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/*', 'hero-shelf.svg'],
      manifest: {
        name: 'Shelfwise',
        short_name: 'Shelfwise',
        description: 'Shelf and cooler share, prices and promotions from store photos.',
        lang: 'en-DK',
        theme_color: '#173d32',
        background_color: '#f5f4ee',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ];
  if (mode === 'lan') plugins.push(basicSsl());

  return {
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
  };
});
