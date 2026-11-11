import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Set E2E_BASE_URL (e.g. https://localhost:8443) to test a running Docker build instead.
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    ignoreHTTPSErrors: Boolean(external),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        permissions: ['camera'],
        launchOptions: {
          // Chromium's synthetic camera exercises the real getUserMedia capture path.
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: `npx vite build --mode e2e && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
