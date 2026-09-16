/**
 * Resolve a Chromium binary.
 *
 * This environment pre-installs a Chromium build that may not match the
 * revision the installed Playwright expects, so tests point at the binary
 * explicitly rather than re-downloading one. Elsewhere this returns undefined
 * and Playwright resolves its own browser as usual.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function resolveChromium() {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !existsSync(base)) return undefined;

  const candidates = readdirSync(base)
    .filter((name) => name.startsWith('chromium-'))
    .sort()
    .reverse()
    .map((name) => join(base, name, 'chrome-linux', 'chrome'))
    .filter((path) => existsSync(path));

  return candidates[0];
}
