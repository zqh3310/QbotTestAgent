import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

export function availableTestBrowser({ exists = fs.existsSync, chromiumPath = chromium.executablePath() } = {}) {
  if (exists(chromiumPath)) return { headless: true };
  if (exists('/Applications/Google Chrome.app')) return { headless: true, channel: 'chrome' };
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!availableTestBrowser()) {
    const require = createRequire(import.meta.url);
    const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
    execFileSync(process.execPath, [cli, 'install', 'chromium'], { stdio: 'inherit' });
  }
}
