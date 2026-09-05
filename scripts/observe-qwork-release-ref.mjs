#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  createGitLabReadOnlyReader,
  QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_HOST,
  QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_PROJECT,
  QWORK_RELEASE_INTAKE_DEFAULT_REF,
} from '../src/lib/qwork-release-intake.mjs';
import {
  createQworkReleaseRefObservation,
  normalizeQworkGitLabProject,
  QWORK_RELEASE_GITLAB_PROJECT,
  writeQworkReleaseRefObservation,
} from '../src/lib/qwork-release-ref-observation.mjs';

function usage() {
  return `QWork release/0.1 独立只读 HEAD 观测器

Usage:
  npm run qwork-release:observe -- \\
    --repo /Users/qifu/Documents/deepbankV2 \\
    --release-ref origin/release/0.1 \\
    --gitlab-token-stdin \\
    --out <new-immutable-directory>

Token 只从标准输入读取，并仅通过 curl config stdin 发送到固定 GitLab 项目。
`;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') { options.help = true; continue; }
    if (!token.startsWith('--')) throw new Error('Unexpected positional argument');
    if (token === '--gitlab-token-stdin') {
      if (Object.hasOwn(options, 'gitlab-token-stdin')) {
        throw new Error('--gitlab-token-stdin 只能传入一次');
      }
      options['gitlab-token-stdin'] = true;
      continue;
    }
    if (token.startsWith('--gitlab-token-stdin=')) {
      throw new Error('--gitlab-token-stdin 必须作为无值布尔开关单独传入');
    }
    const [name, inline] = token.slice(2).split(/=(.*)/s, 2);
    const value = inline == null ? argv[index + 1] : inline;
    if (value == null || String(value).startsWith('--')) { options[name] = true; continue; }
    options[name] = value;
    if (inline == null) index += 1;
  }
  return options;
}

function requireOptions(options, names) {
  const missing = names.filter((name) => !String(options[name] || '').trim());
  if (missing.length) throw new Error(`缺少参数：${missing.map((name) => `--${name}`).join('、')}`);
}

function canonicalDirectory(directory) {
  const resolved = path.resolve(String(directory));
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`仓库必须是普通目录：${resolved}`);
  const real = fs.realpathSync(resolved);
  if (real !== resolved) throw new Error(`仓库路径不得包含符号链接：${resolved}`);
  const root = fs.realpathSync(execFileSync(
    'git',
    ['-C', real, 'rev-parse', '--show-toplevel'],
    { encoding: 'utf8' },
  ).trim());
  if (root !== real) throw new Error(`仓库不是 Git 顶层目录：${real}`);
  const origin = execFileSync(
    'git',
    ['-C', real, 'config', '--get', 'remote.origin.url'],
    { encoding: 'utf8' },
  ).trim();
  if (normalizeQworkGitLabProject(origin) !== QWORK_RELEASE_GITLAB_PROJECT) {
    throw new Error(`仓库 origin 不是固定 deepbankV2 GitLab 项目：${origin || '(missing)'}`);
  }
  return real;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { process.stdout.write(usage()); return; }
  requireOptions(options, ['repo', 'release-ref', 'gitlab-token-stdin', 'out']);
  if (String(options['release-ref']) !== QWORK_RELEASE_INTAKE_DEFAULT_REF) {
    throw new Error(`--release-ref 必须为 ${QWORK_RELEASE_INTAKE_DEFAULT_REF}`);
  }
  const token = fs.readFileSync(0, 'utf8').trim();
  if (!token) throw new Error('已要求 --gitlab-token-stdin，但标准输入为空');
  const repository = canonicalDirectory(options.repo);
  const readGitLab = createGitLabReadOnlyReader({
    host: QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_HOST,
    projectPath: QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_PROJECT,
    token,
  });
  const observation = createQworkReleaseRefObservation({
    repository,
    releaseRef: options['release-ref'],
    readGitLab,
  });
  const files = writeQworkReleaseRefObservation({ observation, outDir: options.out });
  process.stdout.write(`${JSON.stringify({ status: 'OBSERVED', observation, files }, null, 2)}\n`);
}

main();
