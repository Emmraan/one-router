import { expect, test } from '@playwright/test';

const INITIAL_PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'one-router-e2e-password';
const PROVIDER_TYPE = process.env.E2E_PROVIDER_TYPE ?? 'openai';
const PROVIDER_BASE_URL = process.env.E2E_PROVIDER_BASE_URL ?? 'https://api.openai.com/v1';

// One serial scenario keeps the real server state linear: bootstrap, forced
// password change, a real streamed send, reload, logout, and the 401 gate.
test('owner bootstrap through logout on the static export', async ({ page }, testInfo) => {
  await test.step('anonymous status and login gate', async () => {
    const status = await page.request.get('/api/auth/status');
    expect(status.status()).toBe(200);
    expect(await status.json()).toMatchObject({ authenticated: false, mustChangePassword: false });

    await page.goto('/');
    await expect(page).toHaveURL(/\/login\/?$/);
    await expect(page.locator('#login-password')).toBeVisible();
  });

  await test.step('wrong password is rejected', async () => {
    await page.locator('#login-password').fill('not-the-password');
    await page.locator('#login-submit').click();
    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toContainText('Invalid');
    await expect(page).toHaveURL(/\/login\/?$/);
  });

  await test.step('bootstrap login forces a password change', async () => {
    await page.locator('#login-password').fill(INITIAL_PASSWORD);
    await page.locator('#login-submit').click();
    await expect(page).toHaveURL(/\/change-password\/?$/);
    await expect(page.locator('#change-current-password')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('forced-password-change.png') });

    await page.locator('#change-current-password').fill(INITIAL_PASSWORD);
    await page.locator('#change-new-password').fill(NEW_PASSWORD);
    await page.locator('#change-confirm-password').fill(NEW_PASSWORD);
    await page.locator('#change-password-submit').click();

    await expect(page).toHaveURL('http://localhost:3100/');
    await expect(page.locator('#onerouter-sidebar-shell')).toBeVisible();
  });

  await test.step('a streamed message is persisted', async () => {
    const created = await page.request.post('/api/providers', {
      headers: { origin: 'http://localhost:3100' },
      data: {
        name: 'Fixture',
        type: PROVIDER_TYPE,
        baseUrl: PROVIDER_BASE_URL,
        apiKey: 'fixture-key',
        models: ['fixture-model'],
        isActive: true,
      },
    });
    expect(created.status()).toBe(201);

    await page.reload();
    const composer = page.getByLabel('Message', { exact: true });
    await expect(composer).toHaveAttribute('placeholder', /fixture-model/);

    await composer.fill('ping');
    await composer.press('Enter');
    await expect(page.getByText('Fixture reply.').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();

    await page.reload();
    await page.locator('#onerouter-sidebar-shell').getByText('Fixture reply.', { exact: true }).click();
    await expect(page.getByText('Fixture reply.').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('ping').first()).toBeVisible();
  });

  await test.step('logout revokes the session', async () => {
    await page.locator('#logout-button').click();
    await expect(page).toHaveURL(/\/login\/?$/);

    const unauthorized = await page.request.get('/api/chats');
    expect(unauthorized.status()).toBe(401);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login\/?$/);
  });
});
