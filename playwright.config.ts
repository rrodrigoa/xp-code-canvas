import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:5175', headless: true, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: 'npm run dev:web', url: 'http://127.0.0.1:5175', reuseExistingServer: !process.env.CI, timeout: 60000 },
});
