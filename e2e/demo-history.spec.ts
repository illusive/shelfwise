import { expect, test } from '@playwright/test';
import { preferEnglish } from './helpers';
import { snap } from './snap';

test.beforeEach(async ({ page }) => preferEnglish(page));

test('demo history enables visit-to-visit comparison', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible();

  await page.getByRole('button', { name: 'User: Alex Holm' }).click();
  await page.getByRole('button', { name: 'Add demo history' }).click();
  await expect(page.getByText('Demo history added')).toBeVisible({ timeout: 30_000 });

  // History lives in the archive; open the newest analysed visit.
  await page.goto('archive');
  await page.getByLabel('Period').selectOption('all');
  const firstVisit = page.getByRole('link', { name: /shelf share/ }).first();
  await expect(firstVisit).toBeVisible();
  await snap(page, '12-archive-history');
  await firstVisit.click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByTestId('sos-value').first()).toBeVisible();
  // The newer visit is compared with the older one (same store, same method).
  await expect(page.getByText(/vs\. last visit|Not comparable with last visit/)).toBeVisible();
  await expect(page.getByText(/[↑↓→] [\d,]+ pp/).first()).toBeVisible();
  await snap(page, '13-results-compared');
  await page.goto('archive');
  await expect(page.getByRole('heading', { name: 'Your archive' })).toBeVisible();
  await snap(page, '14-archive');
  await page.goto('stores');
  await snap(page, '15-stores');
});
