import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { preferEnglish, stubDetector, swipeToConfirm } from './helpers';

const example: unknown = JSON.parse(
  fs.readFileSync(
    new URL('../docs/copilot-studio/photo-result.example.json', import.meta.url),
    'utf8',
  ),
);

type AgentScript = 'ok' | 'throttled-once' | 'unreadable' | 'signed-out';

/** Replaces the Copilot Studio agent with a scripted one (window.__SHELFWISE_AGENT__). */
async function stubAgent(page: Page, script: AgentScript) {
  await page.addInitScript(
    ({ script, reply }) => {
      const calls = new Map<string, number>();
      let total = 0;
      window.__SHELFWISE_AGENT__ = () => ({
        model: 'stub',
        retryDelayMs: 10,
        analysePhoto: async ({ imageId, image, instruction }) => {
          const call = (calls.get(imageId) ?? 0) + 1;
          calls.set(imageId, call);
          if (!(image instanceof Blob) || image.size === 0) throw new Error('no photo sent');
          if (!instruction.includes('shelfwise-photo-v1')) throw new Error('no instruction');
          // Staggered replies, like a real agent answering photo by photo.
          await new Promise((r) => setTimeout(r, script === 'ok' ? 300 + total++ * 1500 : 150));
          if (script === 'signed-out')
            throw { code: 'sign-in-required', message: 'Not signed in', retryable: true };
          if (script === 'throttled-once' && call === 1)
            throw { code: 'provider-throttled', message: '429', retryable: true };
          if (script === 'unreadable') return { text: 'Sorry, I can only chat.', value: null };
          return { text: '```json\n' + JSON.stringify(reply) + '\n```', value: null };
        },
      });
    },
    { script, reply: example },
  );
}

async function submitTwoPhotos(page: Page) {
  await page.goto('stores');
  await page.getByRole('link', { name: /Netto Aarhus C/ }).click();
  await page.getByRole('button', { name: 'Start visit' }).click();
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await shutter.click();
  await shutter.click();
  await expect(page.getByTestId('capture-count')).toHaveText('2');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('captures-count')).toHaveText('2 photos');
  await swipeToConfirm(page);
  await expect(page).toHaveURL(/\/processing$/);
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page);
  await stubDetector(page);
});

test('live analysis via the agent produces results from its replies', async ({ page }) => {
  await stubAgent(page, 'ok');
  await submitTwoPhotos(page);
  await expect(page.getByText('1 of 2 photos analysed')).toBeVisible();
  await expect(page).toHaveURL(/\/results$/, { timeout: 20_000 });
  await expect(page.getByTestId('sos-value').first()).toBeVisible();
  // Stored with live provenance from the agent's reply (Faxe Kondi + Pepsi are client brands).
  const stored = await page.evaluate(
    () =>
      new Promise<{ source: string; provider: string; facings: number }>((resolve) => {
        const open = indexedDB.open('shelfwise');
        open.onsuccess = () => {
          const all = open.result.transaction('results').objectStore('results').getAll();
          all.onsuccess = () => {
            const r = all.result[0].response;
            resolve({ source: r.source, provider: r.provider.name, facings: r.facings.length });
          };
        };
      }),
  );
  expect(stored).toEqual({ source: 'live', provider: 'copilot-studio', facings: 20 });
});

test('a throttled agent is retried and the analysis completes', async ({ page }) => {
  await stubAgent(page, 'throttled-once');
  await submitTwoPhotos(page);
  await expect(page).toHaveURL(/\/results$/, { timeout: 20_000 });
});

test('unreadable agent replies fail the job with a retry', async ({ page }) => {
  await stubAgent(page, 'unreadable');
  await submitTwoPhotos(page);
  await expect(page.getByText('The analysis result was incomplete or invalid.')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: 'Retry analysis' })).toBeVisible();
});

test('a signed-out tester is told to sign in, and photos stay safe', async ({ page }) => {
  await stubAgent(page, 'signed-out');
  await submitTwoPhotos(page);
  await expect(page.getByText(/Sign in with your Microsoft account/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('Your photos are safe on this device.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry analysis' })).toBeVisible();
});
