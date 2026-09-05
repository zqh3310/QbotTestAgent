import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createNewManagedOutputDirectory,
  executeUnderManagedRunnerLock,
  inspectNewManagedOutputPath,
} from '../lib/managed-runner-lock.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEAMS_ROOT = path.resolve(HERE, '..');
const PROJECT_ROOT = path.resolve(TEAMS_ROOT, '..');
const LOCK_MODULE_URL = pathToFileURL(path.join(TEAMS_ROOT, 'lib', 'managed-runner-lock.mjs')).href;

function temporaryRoot(t, prefix) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function waitForOutput(child, expected, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${expected}: ${output}`)), timeoutMs);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString('utf8');
      if (output.includes(expected)) {
        clearTimeout(timer);
        resolve(output);
      }
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      if (!output.includes(expected)) {
        clearTimeout(timer);
        reject(new Error(`Lock holder exited ${code} before ${expected}: ${output}`));
      }
    });
  });
}

function collectChild(child, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Child timed out: ${stdout}\n${stderr}`));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

test('managed output creation rejects cross-root, existing and symlink-ancestor paths', (t) => {
  const root = temporaryRoot(t, 'qwork-managed-output-');
  const outputRoot = path.join(root, 'output');
  fs.mkdirSync(outputRoot, { mode: 0o700 });
  assert.throws(() => inspectNewManagedOutputPath({
    outDir: path.join(root, 'outside', 'run'),
    outputRoot,
  }), /below/);

  const existing = path.join(outputRoot, 'existing');
  fs.mkdirSync(existing, { mode: 0o700 });
  assert.throws(() => inspectNewManagedOutputPath({ outDir: existing, outputRoot }), /already exists/);

  const outside = path.join(root, 'outside');
  fs.mkdirSync(outside, { mode: 0o700 });
  const alias = path.join(outputRoot, 'alias');
  fs.symlinkSync(outside, alias, 'dir');
  assert.throws(() => inspectNewManagedOutputPath({
    outDir: path.join(alias, 'run'),
    outputRoot,
  }), /real directory/);

  const created = createNewManagedOutputDirectory({
    outDir: path.join(outputRoot, 'new', 'run'),
    outputRoot,
  });
  assert.equal(created.mode, 0o700);
  assert.equal(fs.lstatSync(created.path).isDirectory(), true);
});

test('managed lock rejects a pre-created symlink without changing its target', (t) => {
  const root = temporaryRoot(t, 'qwork-managed-lock-symlink-');
  const victim = path.join(root, 'victim');
  const lockFile = path.join(root, 'runner.lock');
  fs.writeFileSync(victim, 'do-not-touch', { mode: 0o640 });
  const before = fs.lstatSync(victim).mode & 0o777;
  fs.symlinkSync(victim, lockFile);
  assert.throws(() => executeUnderManagedRunnerLock({
    entrypoint: process.argv[1],
    argv: [],
    binding: { runner: 'test' },
    lockFile,
  }), /private current-user regular file|symbolic link/);
  assert.equal(fs.readFileSync(victim, 'utf8'), 'do-not-touch');
  assert.equal(fs.lstatSync(victim).mode & 0o777, before);
});

test('two runner processes competing for the same advisory lock admit exactly one', async (t) => {
  if (!fs.existsSync('/usr/bin/lockf')) {
    t.skip('macOS lockf is unavailable');
    return;
  }
  const root = temporaryRoot(t, 'qwork-managed-lock-race-');
  const lockFile = path.join(root, 'runner.lock');
  const holder = path.join(root, 'holder.mjs');
  fs.writeFileSync(holder, `
    import { executeUnderManagedRunnerLock } from ${JSON.stringify(LOCK_MODULE_URL)};
    import { fileURLToPath } from 'node:url';
    const argv = process.argv.slice(2);
    const result = executeUnderManagedRunnerLock({
      entrypoint: fileURLToPath(import.meta.url),
      argv,
      binding: { runner: 'lock-race', argv },
      lockFile: ${JSON.stringify(lockFile)},
    });
    if (result.reexecuted) process.exit(result.status);
    process.stdout.write('LOCK_ACQUIRED\\n');
    await new Promise((resolve) => setTimeout(resolve, 750));
  `, { mode: 0o600 });

  const first = spawn(process.execPath, [holder], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (first.exitCode == null) first.kill('SIGKILL'); });
  await waitForOutput(first, 'LOCK_ACQUIRED');
  const second = spawn(process.execPath, [holder], { stdio: ['ignore', 'pipe', 'pipe'] });
  const secondResult = await collectChild(second);
  const firstResult = await collectChild(first);
  assert.equal(firstResult.code, 0, firstResult.stderr);
  assert.notEqual(secondResult.code, 0);
  assert.match(secondResult.stderr, /holds the process-lifetime lock|Another managed/);
});

test('root Casebook, Teams Casebook and G5 CLIs all contend on the same default lock', async (t) => {
  if (!fs.existsSync('/usr/bin/lockf')) {
    t.skip('macOS lockf is unavailable');
    return;
  }
  const root = temporaryRoot(t, 'qwork-default-lock-entrypoints-');
  const holder = path.join(root, 'default-holder.mjs');
  fs.writeFileSync(holder, `
    import { executeUnderManagedRunnerLock } from ${JSON.stringify(LOCK_MODULE_URL)};
    import { fileURLToPath } from 'node:url';
    const argv = process.argv.slice(2);
    const result = executeUnderManagedRunnerLock({
      entrypoint: fileURLToPath(import.meta.url),
      argv,
      binding: { runner: 'default-lock-holder', argv },
    });
    if (result.reexecuted) process.exit(result.status);
    process.stdout.write('DEFAULT_LOCK_ACQUIRED\\n');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  `, { mode: 0o600 });
  const holderProcess = spawn(process.execPath, [holder], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (holderProcess.exitCode == null) holderProcess.kill('SIGKILL'); });
  await waitForOutput(holderProcess, 'DEFAULT_LOCK_ACQUIRED');

  const commands = [
    [path.join(PROJECT_ROOT, 'src', 'cli.mjs'), 'ui-agent-casebook-run'],
    [path.join(TEAMS_ROOT, 'lib', 'casebook-runner.mjs')],
    [path.join(TEAMS_ROOT, 'lib', 'qwork-soak-cli.mjs')],
  ];
  for (const args of commands) {
    const result = await collectChild(
      spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] }),
    );
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /holds the process-lifetime lock/);
  }
  const holderResult = await collectChild(holderProcess);
  assert.equal(holderResult.code, 0, holderResult.stderr);
});

test('root and Teams Casebook plus G5 direct runners share one lifecycle lock', () => {
  const rootCli = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'cli.mjs'), 'utf8');
  const rootPackage = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const casebook = fs.readFileSync(path.join(TEAMS_ROOT, 'lib', 'casebook-runner.mjs'), 'utf8');
  const soak = fs.readFileSync(path.join(TEAMS_ROOT, 'lib', 'qwork-soak-cli.mjs'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(TEAMS_ROOT, 'package.json'), 'utf8'));
  const ignore = fs.readFileSync(path.join(PROJECT_ROOT, '.gitignore'), 'utf8').split(/\r?\n/);
  assert.match(rootCli, /if \(command === 'ui-agent-casebook-run'\) \{[\s\S]*executeUnderManagedRunnerLock\(\{[\s\S]*runner: 'root-casebook'/);
  assert.match(casebook, /executeUnderManagedRunnerLock\(\{[\s\S]*runner: 'teams-casebook'/);
  assert.match(soak, /executeUnderManagedRunnerLock\(\{[\s\S]*runner: 'qwork-soak'/);
  assert.doesNotMatch(rootCli, /lockFile\s*:/);
  assert.doesNotMatch(casebook, /lockFile\s*:/);
  assert.doesNotMatch(soak, /lockFile\s*:/);
  assert.equal(rootPackage.scripts['ui-agent:casebook-run'], 'node src/cli.mjs ui-agent-casebook-run');
  assert.equal(
    rootPackage.scripts['ui-agent:casebook-run-parallel'],
    'node src/cli.mjs ui-agent-casebook-run --parallel 5',
  );
  assert.equal(packageJson.scripts.casebook, 'node lib/casebook-runner.mjs');
  assert.equal(packageJson.scripts.soak, 'node lib/qwork-soak-cli.mjs');
  assert.match(packageJson.scripts.check, /lib\/managed-runner-lock\.mjs/);
  assert.match(packageJson.scripts.check, /npm test/);
  assert.ok(ignore.includes('/teams360-automation/runtime/.qwork-managed-runner.lock'));
});
