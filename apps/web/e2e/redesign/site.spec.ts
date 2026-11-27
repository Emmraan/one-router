import { expect, test } from '@playwright/test';

test('landing preview follows the workspace and supports sample interactions', async ({ page, context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).hostname !== 'localhost') throw new Error('The landing preview requested an external asset.');
    return route.continue();
  });
  await page.goto('http://localhost:3300/');
  await expect(page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page).toHaveScreenshot('landing.png', { fullPage: true });
  await page.getByRole('button', { name: /Choose preview model/ }).click();
  await page.getByRole('button', { name: 'llama3.2', exact: true }).click();
  await expect(page.getByRole('button', { name: /Choose preview model/ })).toContainText('llama3.2');
  await page.getByLabel('Preview message').fill('Explain the routing flow');
  await page.getByLabel('Preview message').press('Enter');
  await expect(page.getByText(/This preview uses sample replies/)).toBeVisible();
  await page.getByRole('button', { name: 'Preview Settings' }).click();
  await page.getByLabel('Appearance').selectOption('light');
  await page.keyboard.press('Escape');
  await expect(page.locator('.live-preview')).not.toHaveClass(/dark/);
});
