import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createQworkReleaseRefObservation,
  normalizeQworkGitLabProject,
  readStableQworkReleaseHead,
  writeQworkReleaseRefObservation,
} from '../src/lib/qwork-release-ref-observation.mjs';

const HEAD = 'a'.repeat(40);

test('independent GitLab observation binds two stable branch reads and immutable bytes', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-release-observation-')));
  const repository = path.join(root, 'deepbankV2');
  const outDir = path.join(root, 'observation');
  fs.mkdirSync(repository);
  const endpoints = [];
  const readGitLab = (endpoint) => {
    endpoints.push(endpoint);
    return { name: 'release/0.1', commit: { id: HEAD } };
  };
  const observation = createQworkReleaseRefObservation({
    repository,
    readGitLab,
    observedAt: '2026-09-05T00:00:00.000Z',
  });
  assert.deepEqual(endpoints, [
    'repository/branches/release%2F0.1',
    'repository/branches/release%2F0.1',
  ]);
  assert.equal(observation.source, 'gitlab-api');
  assert.equal(observation.release_ref, 'origin/release/0.1');
  assert.equal(observation.release_head, HEAD);
  assert.equal(observation.repository, repository);
  const files = writeQworkReleaseRefObservation({ observation, outDir });
  assert.equal(files.observation, path.join(outDir, 'release-ref-observation.json'));
  assert.match(files.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(JSON.parse(fs.readFileSync(files.observation, 'utf8')), observation);
  assert.equal(fs.statSync(outDir).mode & 0o777, 0o700);
  assert.equal(fs.statSync(files.observation).mode & 0o777, 0o600);
  assert.throws(
    () => writeQworkReleaseRefObservation({ observation, outDir }),
    /must be new/,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('independent observation rejects a pre-created empty output directory', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-release-observation-existing-')));
  const outDir = path.join(root, 'observation');
  fs.mkdirSync(outDir, { mode: 0o700 });
  assert.throws(
    () => writeQworkReleaseRefObservation({ observation: { release_head: HEAD }, outDir }),
    /must be new/,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('independent observation rejects symlinked or writable output parents', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-release-observation-parent-')));
  const privateParent = path.join(root, 'private');
  const symlinkParent = path.join(root, 'linked');
  fs.mkdirSync(privateParent, { mode: 0o700 });
  fs.symlinkSync(privateParent, symlinkParent);
  assert.throws(
    () => writeQworkReleaseRefObservation({
      observation: { release_head: HEAD },
      outDir: path.join(symlinkParent, 'observation'),
    }),
    /symbolic links/,
  );
  fs.chmodSync(privateParent, 0o770);
  assert.throws(
    () => writeQworkReleaseRefObservation({
      observation: { release_head: HEAD },
      outDir: path.join(privateParent, 'observation'),
    }),
    /group\/other writable/,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('independent observation fails closed when release moves or branch metadata drifts', () => {
  let reads = 0;
  assert.throws(
    () => readStableQworkReleaseHead(() => ({
      name: 'release/0.1',
      commit: { id: reads++ === 0 ? HEAD : 'b'.repeat(40) },
    })),
    /moved during/,
  );
  assert.throws(
    () => readStableQworkReleaseHead(() => ({ name: 'main', commit: { id: HEAD } })),
    /response is incomplete/,
  );
});

test('canonical deepbankV2 GitLab remote normalization rejects ports and other protocols', () => {
  assert.equal(
    normalizeQworkGitLabProject('https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2.git'),
    'gitlab.daikuan.qihoo.net/songrongxin/deepbankv2',
  );
  assert.equal(
    normalizeQworkGitLabProject('git@gitlab.daikuan.qihoo.net:songrongxin/deepbankv2.git'),
    'gitlab.daikuan.qihoo.net/songrongxin/deepbankv2',
  );
  assert.equal(
    normalizeQworkGitLabProject('https://gitlab.daikuan.qihoo.net:8443/songrongxin/deepbankv2.git'),
    '',
  );
  assert.equal(normalizeQworkGitLabProject('file:///tmp/deepbankv2'), '');
});
