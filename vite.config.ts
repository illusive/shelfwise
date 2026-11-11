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
      includeAssets: ['favicon.svg', 'icons/*.svg', 'hero-shelf.svg'],
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
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          {
            src: '/icons/icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
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
    server: { port: 5173 },
    preview: { port: 4173 },
  };
});
