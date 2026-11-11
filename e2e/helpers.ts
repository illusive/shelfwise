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
export type AlignmentStub = 'aligned' | 'too-much' | 'too-little' | 'none' | 'slow';

/**
 * Replaces the vision worker with a deterministic stub (see window.__SHELFWISE_VISION__).
 * Detector: `ok` reports three drinks, `fail` cannot load, `slow` reports 1 s inference.
 * Alignment (once a previous-photo strip exists): `aligned` hits the 25% target, `too-much`
 * and `too-little` miss it, `none` finds no confident match, `slow` takes 500 ms.
 */
export async function stubVision(
  page: Page,
  {
    detector = 'ok',
    alignment = 'aligned',
  }: { detector?: DetectorStub; alignment?: AlignmentStub } = {},
) {
  await page.addInitScript(
    ({ detector, alignment }) => {
      const overlaps = {
        aligned: 0.25,
        'too-much': 0.6,
        'too-little': 0.05,
        none: 0.25,
        slow: 0.25,
      };
      window.__SHELFWISE_VISION__ = () => ({
        loadDetector: () =>
          detector === 'fail'
            ? Promise.reject(new Error('stub'))
            : Promise.resolve({ backend: 'stub' }),
        setReference: () => {},
        process: async ({ detectFrame, alignFrame }) => {
          detectFrame?.close();
          // Inside the visible centre of a 16:9 frame shown with object-fit: cover on a phone.
          const boxes = detectFrame
            ? [0.38, 0.47, 0.56].map((x) => ({ x, y: 0.3, width: 0.07, height: 0.3, score: 0.9 }))
            : null;
          return {
            boxes,
            detectMs: detectFrame ? (detector === 'slow' ? 1000 : 5) : null,
            alignment: alignFrame
              ? {
                  overlap: overlaps[alignment],
                  confidence: alignment === 'none' ? 0.05 : 0.9,
                  peak: alignment === 'none' ? 0.4 : 0.95,
                }
              : null,
            alignMs: alignFrame ? (alignment === 'slow' ? 500 : 2) : null,
          };
        },
        dispose: () => {},
      });
    },
    { detector, alignment },
  );
}

/** Detection-only shorthand used by most journeys. */
export async function stubDetector(page: Page, mode: DetectorStub = 'ok') {
  await stubVision(page, { detector: mode });
}

/** Asserts the previous-photo strip is shown and holds a picture (not blank/black pixels). */
export async function expectStripPicture(page: Page) {
  const canvas = page.getByTestId('overlap-guide').locator('canvas');
  await expect(canvas).toBeVisible();
  const stats = await canvas.evaluate((c: HTMLCanvasElement) => {
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    let max = 0;
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (v > max) max = v;
      if (data[i + 3] > 0) opaque += 1;
    }
    const box = c.getBoundingClientRect();
    return {
      width: c.width,
      height: c.height,
      max,
      opaque,
      shownWidth: box.width,
      viewWidth: window.innerWidth,
    };
  });
  expect(stats.width).toBeGreaterThan(10);
  expect(stats.opaque).toBe(stats.width * stats.height);
  expect(stats.max).toBeGreaterThan(30);
  // Pinned left at the 25% target width.
  expect(stats.shownWidth / stats.viewWidth).toBeCloseTo(0.25, 1);
}
