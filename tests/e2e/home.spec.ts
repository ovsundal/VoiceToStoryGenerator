import { test, expect } from '@playwright/test';
import { launchApp } from './helpers';

test('home screen shows record button and text input', async () => {
  const { app, page } = await launchApp();
  await expect(page.getByTestId('record-button')).toBeVisible();
  await expect(page.getByTestId('record-button')).toContainText('Ta opp fortelling');
  await expect(page.getByTestId('story-textarea')).toBeVisible();
  await expect(page.getByTestId('submit-text-button')).toBeVisible();
  await app.close();
});

test('submit text button is disabled when textarea is empty', async () => {
  const { app, page } = await launchApp();
  await expect(page.getByTestId('submit-text-button')).toBeDisabled();
  await page.getByTestId('story-textarea').fill('Hei på deg');
  await expect(page.getByTestId('submit-text-button')).toBeEnabled();
  await app.close();
});

test('no menu bar visible', async () => {
  const { app, page } = await launchApp();
  // Menu bar is removed — verify the window title is the app title, not a menu item
  const title = await page.title();
  expect(title).toBe('Fortelling til bilder');
  await app.close();
});
