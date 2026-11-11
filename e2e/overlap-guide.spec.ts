import { expect, test, type Page } from '@playwright/test';
import { expectStripPicture, preferEnglish, stubVision, type AlignmentStub } from './helpers';
import { snap } from './snap';

/** Answers the motion-permission prompt (iOS-style `DeviceMotionEvent.requestPermission`). */
async function motionPermission(page: Page, answer: 'granted' | 'denied') {
  await page.addInitScript((answer) => {
    (
      DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }
    ).requestPermission = () => Promise.resolve(answer);
  }, answer);
}

async function openCamera(page: Page, alignment: AlignmentStub) {
  await preferEnglish(page);
  await stubVision(page, { alignment });
  await page.goto('stores');
  await page.getByRole('link', { name: /Netto Aarhus C/ }).click();
  await page.getByRole('button', { name: 'Start visit' }).click();
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled();
}

const shoot = (page: Page) => page.getByRole('button', { name: 'Take photo' }).click();

/** Placement metadata stored with each capture, in capture order. */
async function placements(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open('shelfwise');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('captures').objectStore('captures').getAll();
          all.onsuccess = () => {
            const rows = all.result as { sequence: number; placement?: unknown }[];
            resolve(rows.sort((a, b) => a.sequence - b.sequence).map((r) => r.placement ?? null));
            open.result.close();
          };
        };
      }),
  );
}

test('aligned: the previous-photo strip and guide confirm the overlap', async ({ page }) => {
  await openCamera(page, 'aligned');
  await expect(page.getByTestId('overlap-guide')).toHaveCount(0);
  await expect(page.getByTestId('guide-first-hint')).toBeVisible();
  await shoot(page);
  await expectStripPicture(page);
  await expect(page.getByTestId('guide-first-hint')).toHaveCount(0);
  const guide = page.getByTestId('overlap-guide');
  await expect(guide).toHaveAttribute('data-status', 'aligned');
  await expect(page.getByTestId('guide-hint')).toHaveText('Good overlap — take the photo');
  await snap(page, '21-overlap-guide');
  await shoot(page);
  await expect(page.getByTestId('capture-count')).toHaveText('2');
  await expect
    .poll(() => placements(page))
    .toMatchObject([
      { run: 1, position: 1, overlap: null, confidence: null, rollDeg: null },
      { run: 1, position: 2, overlap: 0.25, rollDeg: null },
    ]);
  // Confidence is smoothed, so it is only required to clear the threshold.
  const [, second] = (await placements(page)) as { confidence: number }[];
  expect(second.confidence).toBeGreaterThanOrEqual(0.35);
});

test('too far: the guide asks to move back', async ({ page }) => {
  await openCamera(page, 'too-little');
  await shoot(page);
  await expect(page.getByTestId('overlap-guide')).toHaveAttribute('data-status', 'move-left');
  await expect(page.getByTestId('guide-hint')).toHaveText(
    'Too little overlap — move back a little',
  );
  await shoot(page);
  await expect(page.getByTestId('capture-count')).toHaveText('2');
});

test('too much overlap: the guide asks to move further right', async ({ page }) => {
  await openCamera(page, 'too-much');
  await shoot(page);
  await expect(page.getByTestId('overlap-guide')).toHaveAttribute('data-status', 'move-right');
  await expect(page.getByTestId('guide-hint')).toHaveText('Too much overlap — move further right');
  await shoot(page);
  await expect(page.getByTestId('capture-count')).toHaveText('2');
});

test('no match: low confidence falls back to the strip only', async ({ page }) => {
  await openCamera(page, 'none');
  await shoot(page);
  await expect(page.getByTestId('overlap-guide')).toHaveAttribute('data-status', 'searching');
  await expect(page.getByTestId('guide-hint')).toHaveText('Line the strip up with the shelf');
  await expect(page.getByRole('img', { name: 'Previous photo' })).toBeVisible();
  await shoot(page);
  await expect(page.getByTestId('capture-count')).toHaveText('2');
  // An unconfident estimate is not recorded as an overlap.
  await expect
    .poll(async () => (await placements(page))[1])
    .toEqual({ run: 1, position: 2, overlap: null, confidence: null, rollDeg: null });
});

test('a slow device pauses the guide but keeps the strip and capture', async ({ page }) => {
  await openCamera(page, 'slow');
  await shoot(page);
  await expect(page.getByTestId('guide-hint')).toHaveAttribute('data-status', 'slow', {
    timeout: 15_000,
  });
  await expect(page.getByRole('img', { name: 'Previous photo' })).toBeVisible();
  await shoot(page);
  await expect(page.getByTestId('capture-count')).toHaveText('2');
});

test('new section starts a new run; the guide can be turned off and stays off', async ({
  page,
}) => {
  await openCamera(page, 'aligned');
  await shoot(page);
  await page.getByRole('button', { name: 'New section' }).click();
  await expect(page.getByTestId('overlap-guide')).toHaveCount(0);
  await shoot(page);
  await expect(page.getByTestId('capture-count')).toHaveText('2');
  await expect
    .poll(async () => (await placements(page)).map((p) => (p as { run: number }).run))
    .toEqual([1, 2]);

  const toggle = page.getByRole('button', { name: 'Overlap guide' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('overlap-guide')).toHaveCount(0);
  await shoot(page);
  await expect(page.getByTestId('capture-count')).toHaveText('3');
  await expect(page.getByTestId('overlap-guide')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Overlap guide' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('the level indicator follows the phone tilt', async ({ page }) => {
  await motionPermission(page, 'granted');
  await openCamera(page, 'aligned');
  const tilt = (x: number) =>
    page.evaluate((x) => {
      for (let i = 0; i < 30; i++)
        window.dispatchEvent(
          new DeviceMotionEvent('devicemotion', {
            accelerationIncludingGravity: { x, y: -9.81, z: 0 },
          }),
        );
    }, x);
  await tilt(0);
  const level = page.getByTestId('level-indicator');
  await expect(level).toHaveAttribute('data-level', 'true');
  await tilt(2);
  await expect(level).toHaveAttribute('data-level', 'false');
  await expect(level).toHaveAccessibleName(/Tilted \d+°/);
  await shoot(page);
  await expect
    .poll(async () => ((await placements(page))[0] as { rollDeg?: number } | undefined)?.rollDeg)
    .toEqual(expect.any(Number));
});

test('denied motion sensors hide the level and never block capture', async ({ page }) => {
  await motionPermission(page, 'denied');
  await openCamera(page, 'aligned');
  await shoot(page);
  await expect(page.getByTestId('overlap-guide')).toHaveAttribute('data-status', 'aligned');
  await expect(page.getByTestId('level-indicator')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show level' })).toHaveCount(0);
  await shoot(page);
  await expect(page.getByTestId('capture-count')).toHaveText('2');
});
