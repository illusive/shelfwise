import { expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const samplePhoto = fileURLToPath(new URL('./fixtures/shelf.jpg', import.meta.url));

/** Most journeys assert English copy; Danish (the default) has its own tests. */
export async function preferEnglish(page: Page) {
  await page.addInitScript(() => localStorage.setItem('shelfwise.language', 'en'));
}

/** Drags the swipe-to-confirm thumb to the end of its track. */
export async function swipeToConfirm(page: Page) {
  const track = page.getByTestId('swipe-to-confirm');
  const thumb = track.getByRole('button');
  await expect(thumb).toBeEnabled();
  const t = (await thumb.boundingBox())!;
  const k = (await track.boundingBox())!;
  const y = t.y + t.height / 2;
  await page.mouse.move(t.x + t.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(k.x + k.width - 8, y, { steps: 15 });
  await page.mouse.up();
}

export type DetectorStub = 'ok' | 'fail' | 'slow';

/**
 * Replaces the on-device detector with a deterministic stub (see window.__SHELFWISE_DETECTOR__):
 * `ok` reports three drinks, `fail` cannot load, `slow` reports 1 s inference.
 */
export async function stubDetector(page: Page, mode: DetectorStub = 'ok') {
  await page.addInitScript((m) => {
    window.__SHELFWISE_DETECTOR__ = () => ({
      load: () =>
        m === 'fail' ? Promise.reject(new Error('stub')) : Promise.resolve({ backend: 'stub' }),
      detect: async (frame: ImageBitmap) => {
        frame.close();
        // Inside the visible centre of a 16:9 frame shown with object-fit: cover on a phone.
        const boxes = [0.38, 0.47, 0.56].map((x) => ({
          x,
          y: 0.3,
          width: 0.07,
          height: 0.3,
          score: 0.9,
        }));
        return { boxes, ms: m === 'slow' ? 1000 : 5 };
      },
      dispose: () => {},
    });
  }, mode);
}
