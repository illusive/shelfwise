import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import fs from 'node:fs';
import { preferEnglish, samplePhoto, stubDetector, swipeToConfirm } from './helpers';

/** The sample photo with an EXIF segment holding a GPS marker, as phone photos often have. */
function photoWithGps(): Buffer {
  const jpeg = fs.readFileSync(samplePhoto);
  const payload = Buffer.from('Exif\0\0GPS 55.6761N 12.5683E', 'latin1');
  const length = payload.length + 2;
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, length >> 8, length & 0xff]), payload]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

async function openDrawer(page: Page) {
  await page.getByRole('button', { name: 'User: Alex Holm' }).click();
  await expect(page.getByRole('dialog', { name: 'User' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await preferEnglish(page);
  await stubDetector(page);
});

test('training export is hidden from reps unless dev tools are enabled', async ({ page }) => {
  await page.goto('');
  await openDrawer(page);
  await expect(page.getByRole('switch', { name: /Use my photos/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(page.getByTestId('training-export')).toHaveCount(0);
});

test('consented visit exports as a training package', async ({ page }) => {
  await page.goto('?dev=1');
  await openDrawer(page);
  const consent = page.getByRole('switch', { name: /Use my photos/ });
  await expect(consent).toHaveAttribute('aria-checked', 'false');
  await consent.click();
  await expect(consent).toHaveAttribute('aria-checked', 'true');
  const exportPanel = page.getByTestId('training-export');
  await expect(exportPanel).toContainText('No analysed visits with training consent yet.');
  await page.keyboard.press('Escape');

  await page.goto('stores');
  await page.getByRole('link', { name: /Netto Aarhus C/ }).click();
  await page.getByRole('button', { name: 'Start visit' }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await expect(page.getByTestId('capture-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByTestId('import-input').setInputFiles({
    name: 'phone-photo.jpg',
    mimeType: 'image/jpeg',
    buffer: photoWithGps(),
  });
  await expect(page.getByTestId('captures-count')).toHaveText('2 photos');
  await swipeToConfirm(page);
  await expect(page).toHaveURL(/\/results$/, { timeout: 20_000 });

  await page.goto('');
  await openDrawer(page);
  await expect(exportPanel.getByRole('combobox')).toContainText('Netto Aarhus C');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportPanel.getByRole('button', { name: 'Export visit' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^shelfwise-training-\d{8}-\d{4}-visit-.+\.zip$/);
  await expect(page.getByText('2 photos exported')).toBeVisible();

  const zip = unzipSync(fs.readFileSync((await download.path())!));
  const names = Object.keys(zip).sort();
  const photos = names.filter((n) => n.startsWith('images/'));
  expect(photos).toHaveLength(2);
  expect(photos.every((n) => /^images\/visit-[^/]+\/\d{3}-cap-[^/]+\.jpg$/.test(n))).toBe(true);
  expect(names.filter((n) => !n.startsWith('images/'))).toEqual([
    'README.md',
    'labels/corrections.json',
    'labels/draft.coco.json',
    'manifest.json',
    'metadata/images.json',
    'metadata/visits.json',
  ]);

  const json = (name: string) => JSON.parse(strFromU8(zip[name]));
  const manifest = json('manifest.json');
  expect(manifest).toMatchObject({
    format: 'shelfwise-training',
    packageVersion: '1.0.0',
    scope: { kind: 'visit' },
    labelSources: ['mock'],
    counts: { visits: 1, images: 2, imagesReencoded: 1, imagesSkipped: 0 },
    privacy: { locationData: false, repIdentity: false, imageMetadataStripped: true },
  });
  expect(manifest.files).toHaveLength(names.length - 1);

  const coco = json('labels/draft.coco.json');
  expect(coco.categories.map((c: { name: string }) => c.name)).toEqual([
    'facing',
    'price_label',
    'promotion',
    'display',
  ]);
  expect(coco.images.map((i: { file_name: string }) => i.file_name).sort()).toEqual(photos);
  expect(coco.annotations.length).toBeGreaterThan(0);
  expect(coco.annotations[0]).toMatchObject({
    bbox: expect.any(Array),
    attributes: { source: 'mock' },
  });
  expect(json('labels/corrections.json')).toMatchObject({ format: 'shelfwise-corrections' });

  const images = json('metadata/images.json');
  expect(images.map((i: { source: string }) => i.source).sort()).toEqual(['camera', 'import']);
  expect(images.find((i: { source: string }) => i.source === 'camera')).toMatchObject({
    device: { platform: 'android', browser: 'chrome', mobile: true },
    camera: { trackWidth: expect.any(Number) },
    containsPeople: 'unknown',
  });
  // The imported photo's GPS metadata never leaves the device.
  for (const photo of photos) expect(strFromU8(zip[photo], true)).not.toContain('GPS');
  expect(json('metadata/visits.json')[0]).toMatchObject({ dataUse: { trainingConsent: true } });
  expect(strFromU8(zip['metadata/visits.json'])).not.toContain('rep-alex');
});
