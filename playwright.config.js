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
    // Production build, not `next dev`: dev mode's Strict Mode double-effects
    // and Fast Refresh overlay are not what ships.
    command: `npx next build && npx next start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    // Never reuse: a server started before a rebuild keeps serving the old
    // chunk manifest, so every script 404s and the app silently never hydrates.
    reuseExistingServer: false,
    timeout: 180_000
  }
});
