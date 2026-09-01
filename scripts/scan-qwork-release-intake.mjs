#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_HOST,
  QWORK_RELEASE_INTAKE_DEFAULT_REF,
  QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_PROJECT,
  scanQworkReleaseIntake,
  sha256File,
  validateQworkReleaseIntake,
  writeQworkReleaseIntake,
} from '../src/lib/qwork-release-intake.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return `QWork release/0.1 只读 MR 与源码准入扫描器

Usage:
  npm run qwork-release:scan -- \\
    --repo <deepbankV2> \\
    --release-ref origin/release/0.1 \\
    --casebook <xlsx> --sheet <exact-name> \\
    --baseline-commit <commit> \\
    --framework-commit <QbotTestAgent-commit> \\
    --out <new-immutable-directory>

Options:
  --fetch / --no-fetch              是否先只读刷新 release 引用（默认开启）
  --previous-intake <json>          上一份 intake；其 release HEAD 优先作为增量边界
  --casebook-baseline-commit <sha>  Casebook 设计基线提交
  --case-ids <id,id,...>            不读取 xlsx 时直接提供可用 Case ID
  --gitlab-host <host>              GitLab 主机
  --gitlab-project <path>           GitLab 项目路径
  --gitlab-token-stdin              从标准输入读取一次 token；token 仅注入 curl 配置 stdin，不落盘不输出
  --allow-unverified-mr             仅诊断时允许 Git 提交信息代替 GitLab MR 元数据
  --window-hours <n>                日常兜底时间窗口（默认 24 小时）
  --fallback-days <n>               祖先不可证明时扩展窗口（默认 30 天）
  --max-commits <n>                 最大扫描 first-parent 提交数（默认 500）

正式流程必须在 G0/pretest 前生成本报告；BLOCKED 或未映射产品路径不得启动 runner。
`;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') { options.help = true; continue; }
    if (token === '--no-fetch') { options.fetch = false; continue; }
    if (token === '--fetch') { options.fetch = true; continue; }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const [name, inline] = token.slice(2).split(/=(.*)/s, 2);
    const value = inline == null ? argv[index + 1] : inline;
    if (value == null || String(value).startsWith('--')) { options[name] = true; continue; }
    options[name] = value;
    if (inline == null) index += 1;
  }
  return options;
}

function required(options, names) {
  const missing = names.filter((name) => !String(options[name] || '').trim());
  if (missing.length) throw new Error(`缺少参数：${missing.map((name) => `--${name}`).join('、')}`);
}

function readPreviousIntake(file) {
  if (!file) return '';
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) throw new Error(`上一份 release intake 不存在：${resolved}`);
  return resolved;
}

function readToken(options) {
  if (!options['gitlab-token-stdin']) return '';
  const token = fs.readFileSync(0, 'utf8').trim();
  if (!token) throw new Error('已要求 --gitlab-token-stdin，但标准输入为空');
  return token;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { process.stdout.write(usage()); return 0; }
  required(options, ['repo', 'out', 'framework-commit']);
  if (!options.casebook && !options['case-ids']) throw new Error('必须提供 --casebook 或 --case-ids');
  const repo = path.resolve(options.repo);
  const casebook = options.casebook ? path.resolve(options.casebook) : '';
  const token = readToken(options);
  const report = scanQworkReleaseIntake({
    repoRoot: repo,
    releaseRef: options['release-ref'] || QWORK_RELEASE_INTAKE_DEFAULT_REF,
    baselineCommit: options['baseline-commit'] || '',
    casebookBaselineCommit: options['casebook-baseline-commit'] || '',
    previousIntakeFile: readPreviousIntake(options['previous-intake']),
    casebookPath: casebook,
    casebookSha256: casebook && fs.existsSync(casebook) ? sha256File(casebook) : '',
    sheet: options.sheet || '',
    caseIds: String(options['case-ids'] || '').split(/[,，\s]+/).filter(Boolean),
    frameworkCommit: options['framework-commit'],
    gitlabHost: options['gitlab-host'] || QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_HOST,
    gitlabProject: options['gitlab-project'] || QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_PROJECT,
    gitlabToken: token,
    requireGitLabMetadata: !options['allow-unverified-mr'],
    fetchLatest: options.fetch !== false,
    windowHours: Number(options['window-hours'] || 24),
    fallbackDays: Number(options['fallback-days'] || 30),
    maxCommits: Number(options['max-commits'] || 500),
  });
  const files = writeQworkReleaseIntake({ report, outDir: options.out });
  const validation = validateQworkReleaseIntake(report, {
    releaseRef: options['release-ref'] || QWORK_RELEASE_INTAKE_DEFAULT_REF,
    casebookSha256: report.casebook.sha256,
    frameworkCommit: options['framework-commit'],
    requireReady: false,
  });
  process.stdout.write(`${JSON.stringify({
    status: report.decision,
    release: report.release,
    scan_boundary: report.scan_boundary,
    summary: report.summary,
    unresolved: report.unresolved,
    blockers: report.blockers,
    validation,
    files,
  }, null, 2)}\n`);
  return report.decision === 'READY' && validation.ok ? 0 : 2;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`release intake 扫描失败：${error?.message || error}\n`);
  process.exitCode = 2;
}
