import type { Page } from '@playwright/test';

/** Saves full-page screenshots when E2E_SCREENSHOTS is set (for design review). */
export async function snap(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (!dir) return;
  await page.waitForTimeout(350); // let entry transitions settle
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}
