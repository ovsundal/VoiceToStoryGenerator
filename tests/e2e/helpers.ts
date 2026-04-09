import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js'), '--test-mode'],
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}
