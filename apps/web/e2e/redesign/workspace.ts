import { expect, type Page } from '@playwright/test';

export class Workspace {
  constructor(readonly page: Page) {}

  async open(theme = 'dark') {
    const headers = { origin: 'http://localhost:3200' };
    let login = await this.page.request.post('/api/auth/login', {
      headers, data: { password: 'visual-fixture-password' },
    });
    if (!login.ok()) {
      login = await this.page.request.post('/api/auth/login', {
        headers, data: { password: 'correct horse battery staple' },
      });
      expect(login.ok()).toBeTruthy();
      const changed = await this.page.request.post('/api/auth/password', {
        headers, data: { currentPassword: 'correct horse battery staple', newPassword: 'visual-fixture-password', confirmation: 'visual-fixture-password' },
      });
      expect(changed.ok()).toBeTruthy();
    }
    const providers = await this.page.request.get('/api/providers');
    if ((await providers.json()).providers.length === 0) {
      const created = await this.page.request.post('/api/providers', {
        headers, data: { name: 'Fixture', type: 'openai', baseUrl: 'https://api.openai.com/v1',
          apiKey: 'fixture-key', models: ['fixture-model', 'second-model'], isActive: true },
      });
      expect(created.ok()).toBeTruthy();
    }
    const setting = await this.page.request.put('/api/settings/theme', { headers, data: { value: theme } });
    expect(setting.ok()).toBeTruthy();
    for (const key of ['favouriteModels', 'recentModels']) {
      expect((await this.page.request.put(`/api/settings/${key}`, { headers, data: { value: [] } })).ok()).toBeTruthy();
    }
    for (const trash of [false, true]) {
      const response = await this.page.request.get(`/api/chats?limit=100&trash=${trash}`);
      expect(response.ok()).toBeTruthy();
      for (const chat of (await response.json()).items) {
        expect((await this.page.request.delete(`/api/chats/${chat.id}?permanent=true`, { headers })).ok()).toBeTruthy();
      }
    }
    await this.page.context().addCookies([{ name: 'one_router_theme', value: theme, url: 'http://localhost:3200' }]);
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: 'What are you working on?' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Choose model, fixture-model', exact: true })).toBeVisible();
  }

  async openSettings() {
    await this.page.getByRole('button', { name: 'Settings', exact: true }).click();
    return this.page.getByRole('dialog', { name: 'Settings', exact: true });
  }

  async send(text: string) {
    const composer = this.page.getByLabel('Message', { exact: true });
    await composer.fill(text);
    const response = this.page.waitForResponse((item) => item.request().method() === 'POST' && new URL(item.url()).pathname === '/api/chat');
    await composer.press('Enter');
    expect((await response).ok()).toBeTruthy();
    await expect(this.page.getByRole('button', { name: 'Stop response' })).toHaveCount(0);
  }
}
