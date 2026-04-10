import { test, expect } from '@playwright/test';
import { launchApp } from './helpers';

test('full flow: text input → processing → review → generating → viewer', async () => {
  const { app, page } = await launchApp();

  // Fill text and submit
  await page.getByTestId('story-textarea').fill('Nils vasker hendene og tar på seg jakken.');
  await page.getByTestId('submit-text-button').click();

  // Processing screen (segmenting)
  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });

  // Review screen appears after segmentation
  await expect(page.getByTestId('review-screen')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('generate-button')).toBeVisible();

  // Optionally edit a caption
  await expect(page.getByTestId('caption-input-0')).toBeVisible();

  // Proceed to image generation
  await page.getByTestId('generate-button').click();
  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });

  // Viewer screen appears after generation
  await expect(page.getByTestId('viewer-screen')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('image-counter')).toContainText('Bilde 1 av');

  // Navigate to next image
  await page.getByTestId('next-button').click();
  await expect(page.getByTestId('image-counter')).toContainText('Bilde 2 av');

  // Previous button returns to first
  await page.getByTestId('prev-button').click();
  await expect(page.getByTestId('image-counter')).toContainText('Bilde 1 av');

  // Return to home
  await page.getByTestId('home-button').click();
  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 3_000 });

  await app.close();
});

test('cancel on review screen returns to home', async () => {
  const { app, page } = await launchApp();

  await page.getByTestId('story-textarea').fill('Barnet vasker hendene.');
  await page.getByTestId('submit-text-button').click();

  await expect(page.getByTestId('review-screen')).toBeVisible({ timeout: 10_000 });

  // Click cancel on review screen
  await page.getByRole('button', { name: 'Avbryt' }).click();
  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 3_000 });

  await app.close();
});

test('prev-button is disabled on first image', async () => {
  const { app, page } = await launchApp();

  await page.getByTestId('story-textarea').fill('Barnet vasker hendene.');
  await page.getByTestId('submit-text-button').click();
  await expect(page.getByTestId('review-screen')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('generate-button').click();
  await expect(page.getByTestId('viewer-screen')).toBeVisible({ timeout: 15_000 });

  await expect(page.getByTestId('prev-button')).toBeDisabled();

  await app.close();
});
