import { expectStripPicture, preferEnglish, stubVision } from '../helpers';
import { expect, test } from './fixtures';

// Regression for the iPhone report "not seeing the ghosting overlap": runs the real strip
// capture (video → canvas) in WebKit with the iPhone 15 profile.
test('iPhone/WebKit: the previous-photo strip appears after the first photo', async ({ page }) => {
  await preferEnglish(page);
  await stubVision(page, { alignment: 'aligned' });
  await page.goto('stores');
  await page.getByRole('link', { name: /Netto Aarhus C/ }).click();
  await page.getByRole('button', { name: 'Start visit' }).click();
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(shutter).toBeEnabled();
  await expect(page.getByTestId('guide-first-hint')).toHaveText(
    'Take the first photo — then we will help you overlap the next',
  );
  await expect(page.getByTestId('overlap-guide')).toHaveCount(0);

  await shutter.click();
  await expect(page.getByTestId('capture-count')).toHaveText('1');
  await expectStripPicture(page);
  await expect(page.getByTestId('guide-first-hint')).toHaveCount(0);
  await expect(page.getByTestId('guide-hint')).toHaveText('Good overlap — take the photo');

  await shutter.click();
  await expect(page.getByTestId('capture-count')).toHaveText('2');
  await expectStripPicture(page);
});
