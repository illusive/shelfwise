import { expect, test } from '@playwright/test';
import { snap } from './snap';

test('opens in Danish by default and switches language from the user drawer', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Hej, Alex.' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'da');
  await expect(page.getByRole('navigation', { name: 'Hovedmenu' })).toBeVisible();
  await snap(page, '17-home-da');

  await page.getByRole('button', { name: 'Bruger: Alex Holm' }).click();
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello, Alex.' })).toBeVisible();
  await page.getByRole('button', { name: 'User: Alex Holm' }).click();
  await page.getByRole('radio', { name: 'Dansk' }).click();
  await expect(page.getByRole('heading', { name: 'Hej, Alex.' })).toBeVisible();
});

test('Danish store addresses follow street, floor, postcode and city', async ({ page }) => {
  await page.goto('stores');
  await page.getByRole('link', { name: /Meny Østerbro/ }).click();
  await expect(page.getByText('Østerbrogade 128, 1. sal', { exact: true })).toBeVisible();
  await expect(page.getByText('2100 København Ø', { exact: true })).toBeVisible();
  await snap(page, '18-store-da');
});
