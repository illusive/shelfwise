import { expect, test, type Page } from '@playwright/test';
import { stubDetector, preferEnglish, type DetectorStub } from './helpers';
import { snap } from './snap';

async function openCamera(page: Page, mode: DetectorStub) {
  await preferEnglish(page);
  await stubDetector(page, mode);
  await page.goto('stores');
  await page.getByRole('link', { name: /Netto Aarhus C/ }).click();
  await page.getByRole('button', { name: 'Start visit' }).click();
}

async function captureWorks(page: Page) {
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await expect(page.getByTestId('capture-count')).toHaveText('2');
}

test('live detection shows drinks in view and never blocks capture', async ({ page }) => {
  await openCamera(page, 'ok');
  await expect(page.getByTestId('live-chip')).toHaveText('3 drinks in view');
  await expect(page.getByTestId('detection-box')).toHaveCount(3);
  await snap(page, '20-live-detection');
  await captureWorks(page);
});

test('live detection can be turned off and stays off', async ({ page }) => {
  await openCamera(page, 'ok');
  const toggle = page.getByRole('button', { name: 'Live detection' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('detection-overlay')).toHaveCount(0);
  await expect(page.getByTestId('live-chip')).toHaveCount(0);
  await captureWorks(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Live detection' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('a detector that fails to load leaves capture working', async ({ page }) => {
  await openCamera(page, 'fail');
  await expect(page.getByTestId('live-chip')).toHaveAttribute('data-status', 'unavailable');
  await captureWorks(page);
});

test('a too-slow device switches live detection off', async ({ page }) => {
  await openCamera(page, 'slow');
  await expect(page.getByTestId('live-chip')).toHaveAttribute('data-status', 'slow', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('detection-box')).toHaveCount(0);
  await captureWorks(page);
});
