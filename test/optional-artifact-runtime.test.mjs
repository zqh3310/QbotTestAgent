import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import fs from 'node:fs';
import { availableTestBrowser } from '../scripts/prepare-test-browser.mjs';

test('Casebook contract assertions execute even when the optional spreadsheet runtime is unavailable', () => {
  const url = new URL('../scripts/build-release01-production-gray-casebook.mjs', import.meta.url).href;
  const source = `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === '@oai/artifact-tool') throw new Error('optional runtime deliberately unavailable');
      return next(specifier, context);
    } });
    const { assertExpectedProductCommit } = await import(${JSON.stringify(url)});
    assert.doesNotThrow(() => assertExpectedProductCommit('a'.repeat(40), 'a'.repeat(40)));
    assert.throws(() => assertExpectedProductCommit('a'.repeat(40), 'b'.repeat(40)));
    process.stdout.write('contract-assertions-executed');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-'], {
    input: source, encoding: 'utf8', timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'contract-assertions-executed');
});

test('the existing CI npm test entrypoint prepares its browser and has a committed lockfile', () => {
  const rootPackage = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(rootPackage.scripts.pretest, 'node scripts/prepare-test-browser.mjs');
  assert.equal(lock.packages[''].devDependencies.playwright, rootPackage.devDependencies.playwright);
});

test('local Chrome avoids a needless browser download while CI without a browser requests preparation', () => {
  assert.deepEqual(availableTestBrowser({ chromiumPath: '/test/chromium', exists: (file) => file === '/test/chromium' }), { headless: true });
  assert.deepEqual(availableTestBrowser({ chromiumPath: '/test/chromium', exists: (file) => file === '/Applications/Google Chrome.app' }), { headless: true, channel: 'chrome' });
  assert.equal(availableTestBrowser({ exists: () => false }), null);
});
