import { expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const samplePhoto = fileURLToPath(new URL('./fixtures/shelf.jpg', import.meta.url));

/** Most journeys assert English copy; Danish (the default) has its own tests. */
export async function useEnglish(page: Page) {
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
