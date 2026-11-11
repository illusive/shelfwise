import { expect, test } from '@playwright/test';
import { samplePhoto, stubDetector, swipeToConfirm, preferEnglish } from './helpers';
import { snap } from './snap';

test.beforeEach(async ({ page }) => {
  await preferEnglish(page);
  await stubDetector(page);
});

test('rep finds a store, captures, reviews, submits and sees results', async ({ page }) => {
  await page.goto('./');

  // No sign-in: the POC starts as the default test rep.
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible();
  await snap(page, '01-home');

  // Store selection: search the wider catalogue; similar names are disambiguated by address.
  await page.getByRole('button', { name: 'Visit another store' }).click();
  await page.getByRole('searchbox').fill('nørrebrogade 34');
  await expect(page.getByText('2 matching stores')).toHaveCount(0);
  await expect(page.getByText('1 matching stores')).toBeVisible();
  await snap(page, '02-stores');
  await page.getByRole('link', { name: /Netto Nørrebrogade.*Nørrebrogade 34/ }).click();
  await expect(page.getByTestId('store-name')).toHaveText('Netto Nørrebrogade');
  await expect(page.getByText('No visits yet')).toBeVisible();
  await snap(page, '03-store-empty');

  // Camera stays open for rapid repeated capture.
  await page.getByRole('button', { name: 'Start visit' }).click();
  await expect(page.getByTestId('camera-store')).toContainText('Nørrebrogade 34');
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(shutter).toBeEnabled();
  await shutter.click();
  await shutter.click();
  await shutter.click();
  await expect(page.getByTestId('capture-count')).toHaveText('3');
  await snap(page, '04-camera');

  // Review on the photo wall: remove with undo, remove again, import one, survive a reload.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('captures-count')).toHaveText('3 photos');
  await page.getByRole('button', { name: 'Remove capture 02' }).click();
  await expect(page.getByTestId('captures-count')).toHaveText('2 photos');
  await expect(page.getByText('Capture 02 removed')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('captures-count')).toHaveText('3 photos');
  await expect(page.getByRole('button', { name: 'Open capture 02' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove capture 02' }).click();
  await expect(page.getByTestId('captures-count')).toHaveText('2 photos');
  await page.getByTestId('import-input').setInputFiles(samplePhoto);
  await expect(page.getByTestId('captures-count')).toHaveText('3 photos');
  await expect(page.getByRole('button', { name: 'Open capture 04' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('captures-count')).toHaveText('3 photos');
  await snap(page, '05-captures');

  // Lightbox: full-screen photo with retake/remove, back closes it.
  await page.getByRole('button', { name: 'Open capture 01' }).click();
  const lightbox = page.getByTestId('lightbox');
  await expect(lightbox.getByRole('button', { name: 'Retake' })).toBeVisible();
  await expect(lightbox.getByRole('button', { name: 'Remove' })).toBeVisible();
  await snap(page, '05b-lightbox');
  await lightbox.getByRole('button', { name: 'Back' }).click();
  await expect(lightbox).toBeHidden();

  // Submit by swiping → genuine job states → results.
  await swipeToConfirm(page);
  await expect(page).toHaveURL(/\/processing$/);
  await snap(page, '06-processing');
  await expect(page).toHaveURL(/\/results$/, { timeout: 20_000 });
  await expect(page.getByTestId('sos-value').first()).toBeVisible();
  await expect(page.getByTestId('sos-value')).toHaveAttribute('data-scope', 'overall');
  await page.getByRole('radio', { name: /Coolers/ }).click();
  await expect(page.getByTestId('sos-value')).toHaveAttribute('data-scope', 'cooler');
  await snap(page, '07-results');

  // Quick review of unresolved items (if any) keeps AI values and records the correction.
  const review = page.getByTestId('review-link');
  if (await review.isVisible()) {
    await review.click();
    await expect(page.getByRole('heading', { name: 'Quick review' })).toBeVisible();
    await snap(page, '08-review');
    const facing = page.getByTestId('review-facing');
    if (await facing.isVisible()) await page.getByRole('button', { name: "Can't tell" }).click();
    else await page.getByRole('button', { name: 'Unreadable' }).click();
    await page.getByRole('button', { name: 'Back to results' }).click();
    await expect(page.getByText(/Includes 1 rep correction/)).toBeVisible();
  }

  // Full report and photo evidence.
  await page.getByRole('button', { name: 'View full product report' }).click();
  // Unresolved items left: the app suggests reviewing them before the report.
  const gate = page.getByRole('dialog', { name: /need(s)? attention/ });
  if (await gate.isVisible().catch(() => false)) {
    await snap(page, '08b-report-gate');
    await gate.getByRole('button', { name: 'Go to report anyway' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Product report' })).toBeVisible();
  await snap(page, '09-report');
  await page
    .getByRole('link', { name: /Capture 01/ })
    .first()
    .click();
  await expect(page.getByRole('group', { name: 'Evidence' })).toBeVisible();
  await snap(page, '10-photo');

  // History persists in the archive.
  await page.goto('archive');
  await page.getByLabel('Period').selectOption('all');
  await expect(page.getByRole('link', { name: /Netto Nørrebrogade/ }).first()).toBeVisible();
  await snap(page, '11-archive');
});

test('camera permission denial offers the import fallback', async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await preferEnglish(page);
  await stubDetector(page);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Denied', 'NotAllowedError'));
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible();
  await page.goto('stores');
  await page.getByRole('link', { name: /Meny Østerbro/ }).click();
  await page.getByRole('button', { name: 'Start visit' }).click();
  await expect(page.getByText('Camera access was blocked')).toBeVisible();
  await page.getByTestId('import-input').setInputFiles(samplePhoto);
  await expect(page.getByTestId('capture-count')).toHaveText('1');
  await context.close();
});

test('rep can be switched from the user drawer', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible();

  await page.getByRole('button', { name: 'User: Alex Holm' }).click();
  await expect(page.getByRole('dialog', { name: 'User' })).toBeVisible();
  await snap(page, '16-user-drawer');
  // Testers can tell which build they run (installed PWAs update on next open).
  await expect(page.getByTestId('app-version')).toHaveText(/^Version \d+\.\d+\.\d+ · build \w+ · /);
  await page.getByRole('button', { name: /Mette Larsen/ }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Mette.' })).toBeVisible();

  // The choice persists, and the drawer is available on the other tabs too.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello, Mette.' })).toBeVisible();
  await page.getByRole('link', { name: 'Stores' }).click();
  await page.getByRole('button', { name: 'User: Mette Larsen' }).click();
  await page.getByRole('button', { name: /Alex Holm/ }).click();
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible();
});

test('a draft can be discarded after confirming', async ({ page }) => {
  await page.goto('stores');
  await page.getByRole('link', { name: /Rema 1000 Amagerbrogade/ }).click();
  await page.getByRole('button', { name: 'Start visit' }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await expect(page.getByTestId('capture-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(page.getByRole('dialog', { name: 'Discard this visit?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('captures-count')).toHaveText('1 photo');

  await page.getByRole('button', { name: 'Discard draft' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard draft' }).click();
  await expect(page.getByText('Draft discarded')).toBeVisible();
  await expect(page.getByText('No visit in progress')).toBeVisible();
});

test("today's planned visits lead straight into the visit", async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: "Today's visits" })).toBeVisible();
  const first = page.getByTestId('planned-visit').first();
  await expect(first).toBeVisible();
  const storeName = await first.getByTestId('planned-store-name').textContent();
  await snap(page, '19-home-plan');
  await first.click();
  await expect(page.getByTestId('store-name')).toHaveText(storeName!);
  await expect(page.getByText('Visit in progress')).toBeVisible();
  await page.goto('./');
  await expect(page.getByTestId('planned-visit').first()).toContainText('In progress');
});

test('an empty draft is discarded without confirmation', async ({ page }) => {
  await page.goto('stores');
  await page.getByRole('link', { name: /Lidl Valby/ }).click();
  await page.getByRole('button', { name: 'Start visit' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Visit in progress')).toBeVisible();
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('No visit in progress')).toBeVisible();
});
