import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { snap } from './snap';

const samplePhoto = fileURLToPath(
  new URL('./fixtures/shelf.jpg', import.meta.url),
);

test('rep finds a store, captures, reviews, submits and sees results', async ({ page }) => {
  await page.goto('/');

  // No sign-in: the POC starts as the default test rep.
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible();
  await snap(page, '01-home');

  // Store selection: search the wider catalogue; similar names are disambiguated by address.
  await page.getByRole('button', { name: 'Start a store visit' }).click();
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

  // Review: remove one, import one, survive a reload.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('captures-count')).toHaveText('3 photos');
  await page.getByRole('button', { name: 'Remove capture 02' }).click();
  await expect(page.getByTestId('captures-count')).toHaveText('2 photos');
  await page.getByTestId('import-input').setInputFiles(samplePhoto);
  await expect(page.getByTestId('captures-count')).toHaveText('3 photos');
  await expect(page.getByText('Capture 04')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('captures-count')).toHaveText('3 photos');
  await snap(page, '05-captures');

  // Submit → genuine job states → results.
  await page.getByRole('button', { name: 'Analyze 3 captures' }).click();
  await expect(page).toHaveURL(/\/processing$/);
  await snap(page, '06-processing');
  await expect(page).toHaveURL(/\/results$/, { timeout: 20_000 });
  await expect(page.getByTestId('sos-value').first()).toBeVisible();
  await expect(page.getByText('Mock', { exact: true }).first()).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Product report' })).toBeVisible();
  await snap(page, '09-report');
  await page
    .getByRole('link', { name: /Capture 01/ })
    .first()
    .click();
  await expect(page.getByRole('group', { name: 'Evidence' })).toBeVisible();
  await snap(page, '10-photo');

  // History persists in the archive.
  await page.goto('/archive');
  await page.getByLabel('Period').selectOption('all');
  await expect(page.getByRole('link', { name: /Netto Nørrebrogade/ }).first()).toBeVisible();
  await snap(page, '11-archive');
});

test('camera permission denial offers the import fallback', async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Denied', 'NotAllowedError'));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible();
  await page.goto('/stores');
  await page.getByRole('link', { name: /Meny Østerbro/ }).click();
  await page.getByRole('button', { name: 'Start visit' }).click();
  await expect(page.getByText('Camera access was blocked')).toBeVisible();
  await page.getByTestId('import-input').setInputFiles(samplePhoto);
  await expect(page.getByTestId('capture-count')).toHaveText('1');
  await context.close();
});

test('rep can be switched from the user drawer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible();

  await page.getByRole('button', { name: 'User: Alex Holm' }).click();
  await expect(page.getByRole('dialog', { name: 'User' })).toBeVisible();
  await snap(page, '16-user-drawer');
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
