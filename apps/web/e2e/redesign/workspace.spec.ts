import { expect, test } from '@playwright/test';
import { Workspace } from './workspace';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error(`External request: ${url.origin}`);
    return route.continue();
  });
});

test('desktop shell, providers, settings and theme match visual baselines', async ({ page }) => {
  const workspace = new Workspace(page);
  await workspace.open();
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Segoe UI');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await expect(page).toHaveScreenshot('workspace-dark.png', { fullPage: true });
  const settings = await workspace.openSettings();
  await expect(settings).toBeVisible();
  await expect(page).toHaveScreenshot('settings-dark.png');
  await settings.getByLabel('Appearance').selectOption('light');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await expect(page).toHaveScreenshot('workspace-light.png', { fullPage: true });
  await page.getByRole('button', { name: 'Providers', exact: true }).click();
  const providers = page.getByRole('dialog', { name: 'Providers', exact: true });
  await expect(providers).toBeVisible();
  await expect(page).toHaveScreenshot('providers-light.png');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Providers', exact: true })).toBeFocused();
});

test('system theme follows OS and cookie on the first frame', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await new Workspace(page).open('system');
  expect(await page.locator('.icon-button').first().evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const durations = await page.locator('.icon-button').first().evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(durations.split(',').every((value) => parseFloat(value) >= 0.15 && parseFloat(value) <= 0.25)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('model picker works by keyboard and persists favourites on the server', async ({ page }) => {
  const workspace = new Workspace(page);
  await workspace.open();
  const trigger = page.getByRole('button', { name: /Choose model/ });
  await trigger.click();
  const picker = page.getByRole('dialog', { name: 'Choose model' });
  await expect(picker.getByLabel('Search models')).toBeFocused();
  await picker.getByLabel('Search models').fill('second-model');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('second-model');
  await trigger.click();
  await picker.getByRole('button', { name: 'Favourite second-model', exact: true }).click();
  await expect(picker.getByRole('button', { name: 'Unfavourite second-model', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  const settings = await page.request.get('/api/settings');
  expect((await settings.json()).settings.favouriteModels).toEqual(expect.arrayContaining([expect.objectContaining({ model: 'second-model' })]));
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('rich output loads local chunks only on first use and keeps virtual rows measurable', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const workspace = new Workspace(page);
  await workspace.open();
  expect(requests.filter((url) => /katex|mermaid|highlight/i.test(url))).toEqual([]);
  const initialScripts = requests.filter((url) => /\.js(?:\?|$)/.test(url)).length;
  await workspace.send('render-rich-fixture');
  await expect(page.locator('[data-renderer="math"] .katex')).toBeVisible();
  await expect(page.locator('[data-renderer="diagram"] svg')).toBeVisible();
  await expect(page.locator('code .hljs-keyword')).toBeVisible();
  expect(requests.filter((url) => /\.js(?:\?|$)/.test(url)).length).toBeGreaterThan(initialScripts);
  await expect(page.locator('[data-index="1"]')).toBeVisible();
  expect(await page.locator('[data-index="1"]').evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(180);
  await expect(page).toHaveScreenshot('transcript.png', {
    mask: [page.locator('time'), page.getByLabel('Chat history')],
  });
});

test('offline status, failed loading, and dialog keyboard focus remain usable', async ({ page, context }) => {
  await new Workspace(page).open();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  for (let index = 0; index < 14; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  const close = dialog.getByRole('button', { name: 'Close Settings', exact: true });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Import / export', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await context.setOffline(true);
  await expect(page.getByRole('status')).toContainText('You are offline');
  await context.setOffline(false);
  await expect(page.getByText('You are offline.', { exact: false })).toHaveCount(0);
  await page.route('**/api/providers', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture failure' }) }));
  await page.reload();
  await expect(page.getByText('Could not load your workspace.', { exact: false })).toBeVisible({ timeout: 15_000 });
  await page.unroute('**/api/providers');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Could not load your workspace.', { exact: false })).toHaveCount(0);
});

test('login has a readable error and branded form', async ({ page }) => {
  await page.goto('/login/');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#login-error')).toContainText('Invalid');
  await expect(page).toHaveScreenshot('login.png');
});

test('untrusted output stays inert and large input leaves controls usable', async ({ page }) => {
  const workspace = new Workspace(page);
  await workspace.open();
  const composer = page.getByLabel('Message', { exact: true });
  await composer.fill(('a\u0301\u202e').repeat(33_333));
  expect((await composer.boundingBox())!.height).toBeLessThanOrEqual(201);
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeVisible();
  await workspace.send('render-hostile-fixture');
  await expect(page.getByRole('heading', { name: 'Heading', exact: true })).toBeVisible();
  await expect(page.getByText('Diagram could not be drawn. Source:')).toBeVisible();
  await expect(page.locator('.message-content img, .message-content iframe, .message-content a[href^="javascript:"], .message-content script')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset.executed)).toBeUndefined();
  expect(await page.locator('body').innerText()).not.toContain('fixture-key');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('provider forms, picker, data, trash and confirmations fit the workspace', async ({ page }) => {
  await new Workspace(page).open();
  await page.getByRole('button', { name: 'Providers', exact: true }).click();
  await page.getByRole('button', { name: 'Add provider', exact: true }).click();
  await expect(page.locator('#provider-input-name')).toBeVisible();
  await expect(page.locator('#btn-save-provider')).toBeInViewport({ ratio: 1 });
  await expect(page).toHaveScreenshot('provider-form.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Choose model,/ }).click();
  await expect(page.getByLabel('Search models')).toBeFocused();
  await expect(page).toHaveScreenshot('model-picker.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Data', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('data.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await expect(page.getByText('Trash is empty.')).toBeVisible();
  await expect(page).toHaveScreenshot('trash.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Providers', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Fixture', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Delete Provider', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('confirmation.png');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Providers', exact: true })).toBeVisible();
});
