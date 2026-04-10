import { test, expect } from '@playwright/test';
import { launchApp } from './helpers';

test('text input flow: type story → processing → review → viewer', async () => {
  const { app, page } = await launchApp();

  await page.getByTestId('story-textarea').fill('Nils vasker hendene og går ut.');
  await page.getByTestId('submit-text-button').click();

  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('progress-stage')).toContainText(
    /Bryter ned|Genererer|Starter/,
    { timeout: 10_000 }
  );

  // Proceeds to review screen
  await expect(page.getByTestId('review-screen')).toBeVisible({ timeout: 10_000 });

  // Click generate to proceed to viewer
  await page.getByTestId('generate-button').click();
  await expect(page.getByTestId('viewer-screen')).toBeVisible({ timeout: 15_000 });

  await app.close();
});

test('cancel from processing or review returns to home screen', async () => {
  const { app, page } = await launchApp();

  // Submit text — may land on processing then quickly on review
  await page.getByTestId('story-textarea').fill('Barnet vasker hendene.');
  await page.getByTestId('submit-text-button').click();

  // Wait for either processing or review screen, then click the Avbryt button
  const cancelBtn = page.getByRole('button', { name: 'Avbryt' });
  await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
  await cancelBtn.click();

  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 5_000 });

  await app.close();
});

test('submit button is disabled when textarea is empty', async () => {
  const { app, page } = await launchApp();

  await expect(page.getByTestId('submit-text-button')).toBeDisabled();

  await page.getByTestId('story-textarea').fill('test');
  await expect(page.getByTestId('submit-text-button')).toBeEnabled();

  await app.close();
});
