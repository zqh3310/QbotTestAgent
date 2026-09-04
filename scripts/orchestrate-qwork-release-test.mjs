#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyQworkStageAudit,
  auditQworkSoakCompletion,
  auditQworkStageCompletion,
  auditQworkStageReadiness,
  createQworkReleaseTestIntegrity,
  createQworkReleaseTestPlan,
  createQworkReleaseTestState,
  qworkReleaseIdentityFingerprint,
  qworkReleaseStage,
  validateQworkReleaseIntakeBinding,
  validateQworkReleaseControlState,
} from '../src/lib/qwork-release-test-plan.mjs';

function usage() {
  return `QWork 发布测试阶段编排器

Usage:
  npm run qwork-release:orchestrate -- init \\
    --state-dir <new-control-directory> \\
    --casebook <xlsx> \\
    --release-identity <release-identity.json> \\
    --release-intake <release-intake.json> \\
    --expected-release-ref origin/release/0.1 \\
    --expected-release-head <40-hex-release-head>

  npm run qwork-release:orchestrate -- readiness \\
    --state-dir <control-directory> \\
    --stage G1|G2|G3|G4 \\
    --capability-audit <capability-audit.json|directory> \\
    --pretest <core-beta-pretest-report.json|directory>

  npm run qwork-release:orchestrate -- complete \\
    --state-dir <control-directory> \\
    --stage G1|G2|G3|G4 \\
    --run-dir <immutable-run-directory>

  npm run qwork-release:orchestrate -- soak \\
    --state-dir <control-directory> \\
    --soak-report <soak-report.json>

  npm run qwork-release:orchestrate -- status --state-dir <control-directory>

编排器永远不使用 raw passed/failed 作为阶段准入。Casebook 阶段必须同时具备
精确能力审计、精确 READY、完整真实执行、完整 evidence manifest、匹配的发布身份
以及 trusted_pass=N。正式计划必须绑定 release intake，并将其 release ref/HEAD 与调用者
独立提供的当前观测值全等校验，同时证明报告文件 SHA、Casebook SHA 和 framework commit
全等。任何其他可信分类都会停止流水线，后续阶段保持 NOT_STARTED。
`;
}

function parseArgs(argv) {
  const [command = '', ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const [name, inline] = token.slice(2).split(/=(.*)/s, 2);
    const value = inline == null ? tokens[index + 1] : inline;
    if (value == null || String(value).startsWith('--')) {
      options[name] = true;
      continue;
    }
    options[name] = value;
    if (inline == null) index += 1;
  }
  return { command, options };
}

function required(options, names) {
  const missing = names.filter((name) => !String(options[name] || '').trim());
  if (missing.length) throw new Error(`Missing required options: ${missing.map((name) => `--${name}`).join(', ')}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value, options = {}) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', ...options });
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function stateFiles(stateDir) {
  const root = path.resolve(stateDir);
  return {
    root,
    plan: path.join(root, 'release-test-plan.json'),
    state: path.join(root, 'release-test-state.json'),
    integrity: path.join(root, 'release-test-integrity.json'),
    events: path.join(root, 'events'),
  };
}

function loadControlState(stateDir) {
  const files = stateFiles(stateDir);
  if (!fs.existsSync(files.plan) || !fs.existsSync(files.state) || !fs.existsSync(files.integrity)) {
    throw new Error(`发布测试控制目录不完整：${files.root}`);
  }
  const plan = readJson(files.plan);
  const state = readJson(files.state);
  const integrity = readJson(files.integrity);
  const audit = validateQworkReleaseControlState({ plan, state, integrity });
  if (!audit.ok) {
    throw new Error(`发布测试计划或状态已被改写：${files.root}；${audit.failures.join(',')}`);
  }
  const eventFiles = fs.existsSync(files.events)
    ? fs.readdirSync(files.events).filter((name) => name.endsWith('.json')).sort()
    : [];
  const eventFailures = [];
  let previousSha256 = '';
  let previousStateSha256 = '';
  let previousRevision = 0;
  eventFiles.forEach((name, index) => {
    const eventFile = path.join(files.events, name);
    const event = readJson(eventFile);
    const expectedIndex = index + 1;
    if (event.schema_version !== 'qbot-qwork-release-test-event/v1') {
      eventFailures.push(`event_schema_mismatch:${name}`);
    }
    if (event.index !== expectedIndex) eventFailures.push(`event_index_mismatch:${name}`);
    if (event.plan_sha256 !== state.plan_sha256) eventFailures.push(`event_plan_sha256_mismatch:${name}`);
    if (event.state_revision_before !== previousRevision
      || event.state_revision_after !== previousRevision + 1) {
      eventFailures.push(`event_revision_mismatch:${name}`);
    }
    if (index > 0 && event.state_sha256_before !== previousStateSha256) {
      eventFailures.push(`event_state_chain_mismatch:${name}`);
    }
    if (!/^[a-f0-9]{64}$/i.test(nonEmpty(event.state_sha256_before))
      || !/^[a-f0-9]{64}$/i.test(nonEmpty(event.state_sha256_after))) {
      eventFailures.push(`event_state_sha256_invalid:${name}`);
    }
    if (event.audit?.stage_id !== event.stage_id) eventFailures.push(`event_stage_mismatch:${name}`);
    if (!['readiness', 'completion'].includes(event.phase)) eventFailures.push(`event_phase_mismatch:${name}`);
    if (nonEmpty(event.previous_event_sha256) !== previousSha256) {
      eventFailures.push(`event_chain_mismatch:${name}`);
    }
    previousSha256 = sha256File(eventFile);
    previousStateSha256 = nonEmpty(event.state_sha256_after);
    previousRevision = Number(event.state_revision_after);
  });
  if (eventFiles.length !== integrity.event_count) eventFailures.push('event_count_mismatch');
  if (eventFiles.length !== state.revision) eventFailures.push('event_state_revision_count_mismatch');
  if (previousSha256 !== nonEmpty(integrity.last_event_sha256)) eventFailures.push('last_event_sha256_mismatch');
  if (eventFiles.length && previousStateSha256 !== integrity.state_sha256) {
    eventFailures.push('event_last_state_sha256_mismatch');
  }
  if (eventFailures.length) {
    throw new Error(`发布测试事件链已被改写：${files.root}；${eventFailures.join(',')}`);
  }
  return { files, plan, state, integrity };
}

function nonEmpty(value) {
  return String(value ?? '').trim();
}

function resolveReport(input, filename) {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) throw new Error(`报告不存在：${resolved}`);
  if (fs.statSync(resolved).isDirectory()) {
    const nested = path.join(resolved, filename);
    if (!fs.existsSync(nested)) throw new Error(`目录缺少 ${filename}：${resolved}`);
    return nested;
  }
  return resolved;
}

function resolveTrustedReview(runDir, summary) {
  const candidates = [
    summary?.credibility_review_json,
    path.join(runDir, '二次复核结构化结果.json'),
    path.join(runDir, '可信二次复核结果.json'),
  ].filter(Boolean).map((candidate) => path.resolve(candidate));
  const review = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!review) throw new Error(`执行目录缺少可信二次复核结构化结果：${runDir}`);
  return review;
}

function appendAuditEvent(files, audit, phase, {
  stateBefore,
  stateAfter,
  previousEventSha256 = '',
  eventCount = 0,
} = {}) {
  fs.mkdirSync(files.events, { recursive: true });
  const nextIndex = eventCount + 1;
  const event = {
    schema_version: 'qbot-qwork-release-test-event/v1',
    index: nextIndex,
    recorded_at: new Date().toISOString(),
    stage_id: audit.stage_id,
    phase,
    plan_sha256: stateAfter.plan_sha256,
    state_revision_before: stateBefore.revision,
    state_revision_after: stateAfter.revision,
    state_sha256_before: qworkReleaseIdentityFingerprint(stateBefore),
    state_sha256_after: qworkReleaseIdentityFingerprint(stateAfter),
    previous_event_sha256: previousEventSha256,
    audit,
  };
  const eventFile = path.join(
    files.events,
    `${String(nextIndex).padStart(4, '0')}-${audit.stage_id}-${phase}.json`,
  );
  writeJson(eventFile, event, { flag: 'wx' });
  return { eventFile, eventSha256: sha256File(eventFile), eventCount: nextIndex };
}

function saveAudit({ files, plan, state, integrity, audit, phase }) {
  const nextState = applyQworkStageAudit(state, audit, { phase });
  const event = appendAuditEvent(files, audit, phase, {
    stateBefore: state,
    stateAfter: nextState,
    previousEventSha256: integrity.last_event_sha256,
    eventCount: integrity.event_count,
  });
  writeJson(files.state, nextState);
  writeJson(files.integrity, createQworkReleaseTestIntegrity(plan, nextState, {
    eventCount: event.eventCount,
    lastEventSha256: event.eventSha256,
  }));
  return { nextState, eventFile: event.eventFile };
}

function init(options) {
  required(options, [
    'state-dir',
    'casebook',
    'release-identity',
    'release-intake',
    'expected-release-ref',
    'expected-release-head',
  ]);
  const files = stateFiles(options['state-dir']);
  if (fs.existsSync(files.root) && fs.readdirSync(files.root).length) {
    throw new Error(`控制目录必须是新的空目录：${files.root}`);
  }
  if (Object.hasOwn(options, 'require-release-intake')
    && !['1', 'true', 'yes'].includes(String(options['require-release-intake']).toLowerCase())) {
    throw new Error('正式发布计划不能关闭 release intake 门禁');
  }
  const releaseIntakePath = path.resolve(options['release-intake']);
  if (!fs.existsSync(releaseIntakePath) || !fs.statSync(releaseIntakePath).isFile()) {
    throw new Error(`release intake 报告不存在：${releaseIntakePath}`);
  }
  const casebook = path.resolve(options.casebook);
  if (!fs.existsSync(casebook) || !fs.statSync(casebook).isFile()) throw new Error(`Casebook 不存在：${casebook}`);
  const head = git('rev-parse', 'HEAD');
  const originMain = git('rev-parse', 'origin/main');
  const branch = git('branch', '--show-current');
  const dirty = git('status', '--porcelain', '--untracked-files=no');
  if (branch !== 'main' || head !== originMain || dirty) {
    throw new Error(`正式计划要求 main==origin/main 且 tracked clean：branch=${branch} HEAD=${head} origin/main=${originMain} dirty=${Boolean(dirty)}`);
  }
  const identity = readJson(path.resolve(options['release-identity']));
  const releaseIntake = readJson(releaseIntakePath);
  const plan = createQworkReleaseTestPlan({
    casebookPath: casebook,
    casebookSha256: sha256File(casebook),
    frameworkCommit: head,
    releaseIdentity: identity,
    releaseIntake,
    releaseIntakePath,
    releaseIntakeSha256: sha256File(releaseIntakePath),
    expectedReleaseRef: options['expected-release-ref'],
    expectedReleaseHead: options['expected-release-head'],
  });
  const state = createQworkReleaseTestState(plan);
  const integrity = createQworkReleaseTestIntegrity(plan, state);
  fs.mkdirSync(files.events, { recursive: true });
  writeJson(files.plan, plan, { flag: 'wx' });
  writeJson(files.state, state, { flag: 'wx' });
  writeJson(files.integrity, integrity, { flag: 'wx' });
  return { command: 'init', files, plan, state, integrity };
}

function readiness(options) {
  required(options, ['state-dir', 'stage', 'capability-audit', 'pretest']);
  const { files, plan, state, integrity } = loadControlState(options['state-dir']);
  const stage = qworkReleaseStage(options.stage);
  if (!stage || stage.kind !== 'casebook') throw new Error(`readiness 只接受 G1-G4：${options.stage}`);
  const capabilityFile = resolveReport(options['capability-audit'], 'capability-audit.json');
  const pretestFile = resolveReport(options.pretest, 'core-beta-pretest-report.json');
  let releaseIntake;
  let releaseIntakeSha256 = '';
  if (plan.policy?.release_intake_required === true) {
    const intakePath = String(plan.release_intake?.path || '').trim();
    const intakeFile = intakePath ? path.resolve(intakePath) : '';
    if (!intakeFile || !fs.existsSync(intakeFile)) throw new Error(`计划绑定的 release intake 不存在：${intakeFile || '(missing)'}`);
    releaseIntake = readJson(intakeFile);
    releaseIntakeSha256 = sha256File(intakeFile);
    const binding = validateQworkReleaseIntakeBinding({ plan, report: releaseIntake, reportSha256: releaseIntakeSha256 });
    if (!binding.ok) throw new Error(`release intake 绑定校验失败：${binding.failures.join('；')}`);
  }
  const audit = auditQworkStageReadiness({
    plan,
    stageId: stage.id,
    capabilityAudit: readJson(capabilityFile),
    pretest: readJson(pretestFile),
    expectedPrefixCaseIds: stage.id === 'G4'
      ? state?.stages?.G3?.admission?.expected?.case_ids
      : undefined,
    releaseIntake,
    releaseIntakeSha256,
  });
  const saved = saveAudit({ files, plan, state, integrity, audit, phase: 'readiness' });
  return { command: 'readiness', audit, event: saved.eventFile, state: saved.nextState };
}

function complete(options) {
  required(options, ['state-dir', 'stage', 'run-dir']);
  const { files, plan, state, integrity } = loadControlState(options['state-dir']);
  const stage = qworkReleaseStage(options.stage);
  if (!stage || stage.kind !== 'casebook') throw new Error(`complete 只接受 G1-G4：${options.stage}`);
  const runDir = path.resolve(options['run-dir']);
  const summary = readJson(resolveReport(runDir, 'automation-run-summary.json'));
  const expectedCaseIds = state?.stages?.[stage.id]?.admission?.expected?.case_ids || [];
  const audit = auditQworkStageCompletion({
    plan,
    stageId: stage.id,
    progress: readJson(resolveReport(runDir, 'automation-progress.json')),
    summary,
    trustedReview: readJson(resolveTrustedReview(runDir, summary)),
    runMetadata: readJson(resolveReport(runDir, 'run-metadata.json')),
    expectedCaseIds,
    runDir,
  });
  const saved = saveAudit({ files, plan, state, integrity, audit, phase: 'completion' });
  return { command: 'complete', audit, event: saved.eventFile, state: saved.nextState };
}

function soak(options) {
  required(options, ['state-dir', 'soak-report']);
  const { files, plan, state, integrity } = loadControlState(options['state-dir']);
  const audit = auditQworkSoakCompletion({
    plan,
    soak: readJson(path.resolve(options['soak-report'])),
  });
  const saved = saveAudit({ files, plan, state, integrity, audit, phase: 'completion' });
  return { command: 'soak', audit, event: saved.eventFile, state: saved.nextState };
}

function status(options) {
  required(options, ['state-dir']);
  const { files, plan, state, integrity } = loadControlState(options['state-dir']);
  return { command: 'status', files, plan, state, integrity };
}

const { command, options } = parseArgs(process.argv.slice(2));
if (!command || ['help', '--help', '-h'].includes(command) || options.help) {
  process.stdout.write(usage());
  process.exit(0);
}

const handlers = { init, readiness, complete, soak, status };
if (!handlers[command]) throw new Error(`Unknown command: ${command}`);
const result = handlers[command](options);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
