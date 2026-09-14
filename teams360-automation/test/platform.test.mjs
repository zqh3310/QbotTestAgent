import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import {
  PLATFORM,
  defaultLiveProfilePath,
  defaultTeamsAppPath,
  nativeInputContract,
  normalizePathForComparison,
  pathInside,
  parseProcessListing,
  platformDiagnostics,
} from '../lib/platform.mjs';

test('platform adapter exposes deterministic diagnostics and OS-specific defaults', () => {
  const diagnostics = platformDiagnostics();
  assert.equal(diagnostics.platform, PLATFORM);
  assert.equal(diagnostics.temp_dir, os.tmpdir());
  assert.equal(path.isAbsolute(defaultLiveProfilePath()), true);
  assert.equal(typeof defaultTeamsAppPath(), 'string');
  assert.equal(nativeInputContract().platform, PLATFORM);
});

test('path containment is separator and case aware', () => {
  const root = path.join(os.tmpdir(), 'QBotPlatformRoot');
  const child = path.join(root, 'case', 'file.json');
  assert.equal(pathInside(root, child), true);
  assert.equal(pathInside(root, path.join(root, '..', 'escape')), false);
  if (process.platform === 'win32') {
    assert.equal(normalizePathForComparison(root.toUpperCase()), normalizePathForComparison(root.toLowerCase()));
  }
});

test('Windows process JSON and POSIX process text normalize to the same shape', () => {
  if (process.platform === 'win32') {
    const rows = parseProcessListing(JSON.stringify({ ProcessId: 7, ParentProcessId: 1, CommandLine: '360Teams.exe --remote-debugging-port=1' }));
    assert.deepEqual(rows, [{ pid: 7, ppid: 1, command: '360Teams.exe --remote-debugging-port=1' }]);
  } else {
    const rows = parseProcessListing('  7  1 /Applications/360Teams.app/Contents/MacOS/360Teams --remote-debugging-port=1\n');
    assert.deepEqual(rows, [{ pid: 7, ppid: 1, command: '/Applications/360Teams.app/Contents/MacOS/360Teams --remote-debugging-port=1' }]);
  }
});
