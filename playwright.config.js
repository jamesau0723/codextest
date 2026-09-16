import { defineConfig, devices } from '@playwright/test';
import { resolveChromium } from './tools/chromium-path.mjs';

const PORT = Number(process.env.PORT || 4173);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: resolveChromium(),
          args: ['--autoplay-policy=no-user-gesture-required']
        }
      }
    }
  ],
  webServer: {
    command: `node tools/serve.js`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) }
  }
});
