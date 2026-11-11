import { test as base, devices } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * WebKit's default (ephemeral) test contexts cannot store Blobs in IndexedDB, unlike Safari
 * itself, so photos would fail to save. A persistent context behaves like the real browser.
 */
export const test = base.extend({
  context: async ({ playwright, baseURL }, provide) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfwise-webkit-'));
    const { defaultBrowserType: _browser, ...iphone } = devices['iPhone 15'];
    const context = await playwright.webkit.launchPersistentContext(dir, {
      ...iphone,
      baseURL,
      ignoreHTTPSErrors: true,
      permissions: ['camera'],
    });
    await provide(context);
    await context.close();
    fs.rmSync(dir, { recursive: true, force: true });
  },
  page: async ({ context }, provide) => {
    await provide(context.pages()[0] ?? (await context.newPage()));
  },
});

export { expect } from '@playwright/test';
