import { defineConfig } from '@playwright/test';
const port=Number(process.env.XP_CANVAS_PORT??5175);
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: `npm run dev:web -- --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI, timeout: 60000 },
});
