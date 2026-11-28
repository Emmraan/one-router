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

test('static docs support search, section navigation and copying commands', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const external: string[] = [];
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://localhost:3300') return route.continue();
    external.push(url.origin);
    return route.abort();
  });
  await page.goto('http://localhost:3300/docs/');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Vercel');
  await page.getByRole('button', { name: /search/i }).filter({ visible: true }).first().click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Search' }).fill('Passwords and recovery');
  await page.getByRole('dialog').getByRole('option')
    .filter({ has: page.getByText('Passwords and recovery', { exact: true }) }).click();
  await expect(page.getByRole('heading', { name: 'Passwords and recovery', exact: true })).toBeVisible();
  const toc = page.getByRole('button', { name: /on this page/i });
  if (await toc.isVisible()) await toc.click();
  await page.getByRole('link', { name: 'Reset locally', exact: true }).filter({ visible: true }).last().click();
  await expect(page).toHaveURL(/#reset-locally$/);
  await page.getByRole('figure').filter({ hasText: 'one-router user reset-password' })
    .getByRole('button', { name: 'Copy Text', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('one-router user reset-password');
  expect(external).toEqual([]);
});
