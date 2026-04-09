import { test, expect } from '@playwright/test';
import { launchApp } from './helpers';

test('stub pipeline flow: home → processing → done', async () => {
  const { app, page } = await launchApp();

  await expect(page.getByTestId('record-button')).toBeVisible();
  await page.getByTestId('record-button').click();

  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('progress-stage')).toContainText(
    /Transkriberer|Bryter ned|Genererer|Ferdig/,
    { timeout: 10_000 }
  );

  // After done, returns to home screen
  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 15_000 });

  await app.close();
});

test('text input flow: type story → processing → done', async () => {
  const { app, page } = await launchApp();

  await page.getByTestId('story-textarea').fill('Nils vasker hendene og går ut.');
  await page.getByTestId('submit-text-button').click();

  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('progress-stage')).toContainText(
    /Bryter ned|Genererer|Ferdig/,
    { timeout: 10_000 }
  );

  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 15_000 });

  await app.close();
});

test('cancel button returns to home screen', async () => {
  const { app, page } = await launchApp();

  await page.getByTestId('record-button').click();
  await expect(page.getByTestId('processing-screen')).toBeVisible({ timeout: 3_000 });

  await page.getByTestId('cancel-button').click();
  await expect(page.getByTestId('record-button')).toBeVisible({ timeout: 3_000 });

  await app.close();
});
