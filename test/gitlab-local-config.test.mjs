import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readLocalGitLabConfig, runWithLocalGitLabConfig } from '../src/lib/gitlab-local-config.mjs';

function fixture(t, overrides = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-credential-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'gitlab.local.json');
  fs.writeFileSync(file, JSON.stringify({ host: 'gitlab.daikuan.qihoo.net',
    project: 'songrongxin/deepbankv2', token: 'UNIT_TEST_SECRET', ...overrides }), { mode: 0o600 });
  return file;
}

test('authorized local credential is passed only through stdin and output is redacted', (t) => {
  const configFile = fixture(t);
  let called = false;
  const result = runWithLocalGitLabConfig('observe', ['--repo', '/repo', '--out', 'outputs/token-fix-regression'], { configFile,
    spawn(executable, args, options) {
      called = true;
      assert.equal(args.at(-1), '--gitlab-token-stdin');
      assert.ok(!JSON.stringify(args).includes('UNIT_TEST_SECRET'));
      assert.equal(options.input, 'UNIT_TEST_SECRET\n');
      assert.equal(options.stdio[0], 'pipe');
      assert.equal(options.env.GITLAB_TOKEN, undefined);
      return { status: 1, stdout: 'UNIT_TEST_SECRET', stderr: 'error UNIT_TEST_SECRET' };
    } });
  assert.ok(called);
  assert.equal(result.stdout, '[REDACTED]');
  assert.equal(result.stderr, 'error [REDACTED]');
  assert.equal(result.status, 1);
});

test('wrong host/project, empty/multiline tokens and parse failures never disclose content', (t) => {
  for (const overrides of [{ host: 'example.com' }, { project: 'other/repo' },
    { token: '' }, { token: 'SECRET\ninjected' }]) {
    assert.throws(() => readLocalGitLabConfig(fixture(t, overrides)), /local config is missing or invalid/);
  }
  const file = fixture(t);
  fs.writeFileSync(file, '{ "token": "UNIT_TEST_SECRET"');
  assert.throws(() => readLocalGitLabConfig(file), (error) => !error.message.includes('UNIT_TEST_SECRET'));
});

test('public-readable credentials are refused on POSIX', { skip: process.platform === 'win32' }, (t) => {
  const file = fixture(t);
  fs.chmodSync(file, 0o644);
  assert.throws(() => readLocalGitLabConfig(file), /private regular JSON/);
});

test('credential flags and arbitrary command execution are refused before loading config', () => {
  assert.throws(() => runWithLocalGitLabConfig('observe', ['--gitlab-token-stdin=SECRET']), /credential arguments/);
  assert.throws(() => runWithLocalGitLabConfig('exec', []), /Supported commands/);
  const result = runWithLocalGitLabConfig('scan', ['--help'], { configFile: '/does-not-exist',
    spawn: (_exe, args, options) => {
      assert.equal(options.input, '');
      assert.ok(!args.includes('--gitlab-token-stdin'));
      return { status: 0, stdout: 'help' };
    } });
  assert.equal(result.stdout, 'help');
});
