import { expect, test, type Page } from '@playwright/test';

const INITIAL_PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'one-router-e2e-password';
const E2E_ORIGIN = 'http://localhost:3100';

test.setTimeout(120_000);

// A 1x1 transparent PNG is enough to exercise the image attachment path.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function buildPdf(text: string): Buffer {
  const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

async function login(page: Page): Promise<void> {
  await page.goto('/login/');
  await page.locator('#login-password').fill(NEW_PASSWORD);
  await page.locator('#login-submit').click();
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 }).catch(() => {}),
    page.locator('#login-error').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {}),
  ]);

  if (page.url().includes('login')) {
    await page.locator('#login-password').fill(INITIAL_PASSWORD);
    await page.locator('#login-submit').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  }
  if (page.url().includes('change-password')) {
    await page.locator('#change-current-password').fill(INITIAL_PASSWORD);
    await page.locator('#change-new-password').fill(NEW_PASSWORD);
    await page.locator('#change-confirm-password').fill(NEW_PASSWORD);
    await page.locator('#change-password-submit').click();
  }
  await expect(page.locator('#onerouter-sidebar-shell')).toBeVisible({ timeout: 20_000 });
}

async function stats(page: Page) {
  const response = await page.request.get('/health/__e2e/stats');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { chats: number; messages: number; attachments: number };
}

test('temporary chat stays in memory until it is saved', async ({ page }) => {
  await login(page);
  const before = await stats(page);

  await page.locator('#new-temporary-chat').click();
  await expect(page.locator('#save-temporary-chat')).toBeVisible();

  await page.getByLabel('Upload files').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('temporary attachment body'),
  });
  await expect(page.getByText('notes.txt')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();

  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  await composer.fill('temporary hello');
  await composer.press('Enter');
  await expect(page.getByText('Fixture reply.').first()).toBeVisible({ timeout: 20_000 });

  const inMemory = await stats(page);
  expect(inMemory.chats).toBe(before.chats);
  expect(inMemory.messages).toBe(before.messages);

  await page.locator('#save-temporary-chat').click();
  await expect
    .poll(async () => (await stats(page)).chats, { timeout: 20_000 })
    .toBe(before.chats + 1);
  const saved = await stats(page);
  expect(saved.messages).toBe(before.messages + 2);
});

test('uploads, enhancement, and archive roundtrip', async ({ page }) => {
  await login(page);
  await page.locator('#btn-new-chat').click();

  await page.getByLabel('Upload images').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64'),
  });
  await page.getByLabel('Upload files').setInputFiles({
    name: 'document.pdf',
    mimeType: 'application/pdf',
    buffer: buildPdf('PDF body unique'),
  });
  await expect(page.getByText('pixel.png')).toBeVisible();
  await expect(page.getByText('document.pdf')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();

  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  await composer.fill('files and prompt');
  await composer.press('Enter');
  await expect(page.getByText('Fixture reply.').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Stop response' })).toHaveCount(0, { timeout: 20_000 });

  await composer.fill('make this better');
  await expect(composer).toHaveValue('make this better');
  await page.locator('#textarea-enhance-icon').click();
  await expect(page.getByText('After', { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(composer).toHaveValue('Fixture reply.');

  await page.locator('#textarea-enhance-icon').click();
  await expect(page.getByText('After', { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(composer).toHaveValue('Fixture reply.');

  const exported = await page.request.post('/api/data/export', {
    headers: { origin: E2E_ORIGIN },
    data: { passphrase: 'one-router-export-pass' },
  });
  expect(exported.ok()).toBeTruthy();
  const archive = await exported.body();

  const preview = await page.request.post('/api/data/preview', {
    headers: { origin: E2E_ORIGIN },
    multipart: {
      file: { name: 'roundtrip.onerouter', mimeType: 'application/octet-stream', buffer: archive },
      passphrase: 'one-router-export-pass',
    },
  });
  expect(preview.ok()).toBeTruthy();
  expect(((await preview.json()) as { manifest: { counts: { chats: number } } }).manifest.counts.chats).toBeGreaterThan(0);

  const imported = await page.request.post('/api/data/import', {
    headers: { origin: E2E_ORIGIN },
    multipart: {
      file: { name: 'roundtrip.onerouter', mimeType: 'application/octet-stream', buffer: archive },
      passphrase: 'one-router-export-pass',
      mode: 'merge',
    },
  });
  expect(imported.ok()).toBeTruthy();
});

test('search, pin, and trash recovery', async ({ page }) => {
  await login(page);

  await page.locator('#search-chats-input').fill('files and prompt');
  await expect(
    page.locator('#onerouter-sidebar-shell').getByText('Fixture reply.', { exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 });

  const row = page
    .locator('#onerouter-sidebar-shell [role="button"]')
    .filter({ hasText: 'Fixture reply.' })
    .first();
  await row.hover();
  await row.getByTitle('Pin Thread').click();
  await expect(page.getByText('Pinned', { exact: true })).toBeVisible();

  await page.locator('#search-chats-input').fill('');
  await page.locator('#open-trash').click();
  await expect(page.getByRole('heading', { name: 'Trash' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Trash', exact: true }).click();
});

test('upload recovery, editing, regeneration, export and stopping remain usable', async ({ page }) => {
  await login(page);
  await page.locator('#btn-new-chat').click();
  await page.route('**/api/files', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture upload failed.' }) }), { times: 1 });
  await page.getByLabel('Upload files').setInputFiles({ name: 'retry.txt', mimeType: 'text/plain', buffer: Buffer.from('Retry body') });
  await expect(page.getByText('Fixture upload failed.')).toBeVisible();
  await page.getByRole('button', { name: 'Retry retry.txt' }).click();
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Remove retry.txt' }).click();
  await expect(page.getByText('retry.txt', { exact: true })).toHaveCount(0);

  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  await composer.fill('Edit this message');
  await composer.press('Enter');
  await expect(page.locator('.message-row.assistant .message-content')).toContainText('Fixture reply.');
  await page.locator('.message-row.user').hover();
  await page.locator('.message-row.user').getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Edit message', exact: true });
  await editor.fill('Edited message');
  await Promise.all([page.waitForResponse((response) => new URL(response.url()).pathname === '/api/chat'), editor.press('Control+Enter')]);
  await expect(page.locator('.message-row.user .message-content')).toContainText('Edited message');
  await expect(page.getByRole('button', { name: 'Stop response' })).toHaveCount(0);
  await page.locator('.message-row.assistant').hover();
  await Promise.all([page.waitForResponse((response) => new URL(response.url()).pathname === '/api/chat'), page.getByRole('button', { name: 'Regenerate', exact: true }).click()]);
  await expect(page.getByRole('button', { name: 'Stop response' })).toHaveCount(0);
  await page.locator('.message-row.assistant').hover();
  await page.getByRole('button', { name: 'Quote', exact: true }).click();
  await expect(composer).toHaveValue(/> Fixture reply\./);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.md$/);

  await page.locator('#btn-new-chat').click();
  await composer.fill('render-slow-fixture');
  await composer.press('Enter');
  await expect(page.locator('.message-row.assistant')).toContainText('Partial fixture response');
  await page.getByRole('button', { name: 'Stop response' }).click();
  await expect(page.getByRole('button', { name: 'Stop response' })).toHaveCount(0);
  await expect(page.locator('.message-row.assistant')).not.toContainText('finished');
});
