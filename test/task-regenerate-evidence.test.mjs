import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildTaskRegenerateActionReceipt,
  taskRegenerateProjection,
  taskRegenerateTransitionEvidence,
} from '../src/lib/task-regenerate-evidence.mjs';
import {
  buildCoreEvidenceManifest,
  validateEvidenceFile,
} from '../src/lib/core-beta-case-protocol.mjs';

const times = {
  before: '2026-09-04T10:00:00.000Z',
  clicked: '2026-09-04T10:00:00.100Z',
  immediate: '2026-09-04T10:00:00.120Z',
  final: '2026-09-04T10:00:02.000Z',
  reopened: '2026-09-04T10:00:03.000Z',
  wait: '2026-09-04T10:00:01.900Z',
  readback: '2026-09-04T10:00:03.100Z',
};

function screenshotReceipt(file, byte = 1) {
  if (file) {
    const bytes = fs.readFileSync(file);
    return {
      path: path.resolve(file),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  return {
    path: `/tmp/qbot-task-regenerate-${byte}.png`,
    bytes: 256,
    sha256: String(byte).repeat(64).slice(0, 64),
  };
}

function messages(body, {
  assistantId = 'assistant-v1',
  priorAssistant = true,
  users = ['历史问题', 'REGEN_BASE 当前问题'],
} = {}) {
  const result = [
    { dom_index: 0, role: 'user', message_id: 'user-history', visible: true, text: users[0] },
  ];
  if (priorAssistant) {
    result.push({ dom_index: 1, role: 'assistant', message_id: 'assistant-history', visible: true, body_text: '历史回答' });
  }
  result.push(
    { dom_index: result.length, role: 'user', message_id: 'user-current', visible: true, text: users[1] },
    { dom_index: result.length + 1, role: 'assistant', message_id: assistantId, visible: true, body_text: body },
  );
  return result;
}

function projection(stage, captureSequence, capturedAt, body, running, sendCount, options = {}) {
  return taskRegenerateProjection({
    stage,
    capture_sequence: captureSequence,
    captured_at: capturedAt,
    task_id: options.taskId || 'task-regen-001',
    running,
    send_count: sendCount,
    branch_text: options.branchText || '',
    messages: messages(body, options),
  });
}

function validInput({ beforeScreenshot = screenshotReceipt('', 1), afterScreenshot = screenshotReceipt('', 2) } = {}) {
  const before = projection('before', 1, times.before, '第一版回答 REGEN_BASE', false, 1, {
    assistantId: 'assistant-v1',
  });
  const immediateProjection = projection('immediate_projection', 2, times.immediate, '', true, 2, {
    assistantId: 'assistant-v2',
    branchText: '2 / 2',
  });
  const final = projection('final', 3, times.final, '第二版回答 REGEN_BASE', false, 2, {
    assistantId: 'assistant-v2',
    branchText: '2 / 2',
  });
  const reopened = projection('reopened', 4, times.reopened, '第二版回答 REGEN_BASE', false, 2, {
    assistantId: 'assistant-v2',
    branchText: '2 / 2',
  });
  const actionReceipt = buildTaskRegenerateActionReceipt({
    caseId: 'BETA-TASK-002',
    taskId: before.task_id,
    attempt: {
      attempt: 1,
      terminal_state: 'dispatched',
      clicked: true,
      dispatched: true,
      clicked_at: times.clicked,
      task_id: before.task_id,
      before_assistant_message_id: 'assistant-v1',
      control: {
        tag_name: 'BUTTON',
        role: 'button',
        aria_label: '重新生成',
        title: '',
        dom_id: '',
        test_id: 'assistant-regenerate',
        class_name: 'aui-regenerate',
        owner_assistant_message_id: 'assistant-v1',
        owner_dom_index: 3,
      },
      before_state: {
        task_id: before.task_id,
        running: before.running,
        send_count: before.send_count,
        assistant_message_id: before.target_assistant.message_id,
        generation_version: before.generation_version,
      },
      after_state: {
        task_id: immediateProjection.task_id,
        running: immediateProjection.running,
        send_count: immediateProjection.send_count,
        assistant_message_id: immediateProjection.target_assistant.message_id,
        generation_version: immediateProjection.generation_version,
      },
      before_screenshot: beforeScreenshot,
      after_screenshot: afterScreenshot,
    },
  });
  return {
    caseId: 'BETA-TASK-002',
    legacyCaseId: 'SIT-TASK-REGEN-001',
    actionReceipt,
    before,
    immediateProjection,
    final,
    reopened,
    captureAttempts: [{ attempt: 1, projection: immediateProjection }],
    transitionWait: {
      schema_version: 'qbot-task-regenerate-transition-wait/v1',
      captured_at: times.wait,
      started: true,
      idle: true,
      elapsed_ms: 1980,
      state: { active_id: before.task_id, running: false, send_count: 2 },
      reason: 'started_then_idle',
    },
    reopenedReadback: {
      schema_version: 'qbot-task-regenerate-reopened-readback/v1',
      captured_at: times.readback,
      requested_task_id: before.task_id,
      ok: true,
      active_id: before.task_id,
      running: false,
      text: 'REGEN_BASE 当前问题\n第二版回答 REGEN_BASE',
      target_assistant_message_id: 'assistant-v2',
      target_assistant_body: '第二版回答 REGEN_BASE',
      branch_index: 2,
      branch_count: 2,
      generation_version: '2/2',
    },
  };
}

function verdict(mutator = null, options = {}) {
  const input = validInput(options);
  if (mutator) mutator(input);
  return taskRegenerateTransitionEvidence(input);
}

function syncActionAfter(input) {
  Object.assign(input.actionReceipt.attempts[0].after_state, {
    task_id: input.immediateProjection.task_id,
    running: input.immediateProjection.running,
    send_count: input.immediateProjection.send_count,
    assistant_message_id: input.immediateProjection.target_assistant?.message_id || '',
    generation_version: input.immediateProjection.generation_version,
  });
}

const positive = verdict();
assert.equal(positive.evidence_valid, true);
assert.equal(positive.oracle_valid, true);
assert.equal(positive.outcome, 'pass');
assert.equal(positive.click_count, 1, '点击次数只能从独立 action receipt 派生');
assert.equal(positive.before.generation_version, '1/1');
assert.equal(positive.immediate_projection.generation_version, '2/2');

const callerClaimOnly = validInput();
callerClaimOnly.actionReceipt = null;
callerClaimOnly.clickCount = 1;
callerClaimOnly.clickedAt = times.clicked;
const callerClaimVerdict = taskRegenerateTransitionEvidence(callerClaimOnly);
assert.equal(callerClaimVerdict.evidence_valid, false, '调用方自报 clickCount=1 不得替代独立点击回执');
assert.equal(callerClaimVerdict.click_count, 0);

for (const [name, mutate, failure] of [
  ['零点击', (input) => { input.actionReceipt.attempts = []; input.actionReceipt.attempt_count = 0; }, 'action_receipt_integrity'],
  ['重复点击', (input) => { input.actionReceipt.attempts.push(structuredClone(input.actionReceipt.attempts[0])); input.actionReceipt.attempts[1].attempt = 2; input.actionReceipt.attempt_count = 2; }, 'action_receipt_integrity'],
  ['伪造 clicked', (input) => { input.actionReceipt.attempts[0].clicked = false; }, 'action_receipt_integrity'],
  ['按钮 owner 漂移', (input) => { input.actionReceipt.attempts[0].control.owner_assistant_message_id = 'assistant-other'; }, 'action_receipt_integrity'],
  ['按钮 DOM identity 缺失', (input) => { input.actionReceipt.attempts[0].control.aria_label = ''; input.actionReceipt.attempts[0].control.title = ''; }, 'action_receipt_integrity'],
  ['点击后状态被伪造', (input) => { input.actionReceipt.attempts[0].after_state.running = false; }, 'action_receipt_integrity'],
  ['第一版 messageId 为空', (input) => { input.before = projection('before', 1, times.before, '第一版回答 REGEN_BASE', false, 1, { assistantId: '' }); }, 'assistant_identities_captured'],
  ['截图摘要缺失', (input) => { input.actionReceipt.attempts[0].before_screenshot.sha256 = ''; }, 'action_receipt_integrity'],
  ['capture attempts 删除', (input) => { input.captureAttempts = []; }, 'capture_attempts_integrity'],
  ['capture attempts 序号断裂', (input) => { input.captureAttempts[0].attempt = 2; }, 'capture_attempts_integrity'],
  ['capture attempts 重排', (input) => {
    const earlier = projection('immediate_projection', 2, '2026-09-04T10:00:00.110Z', '尚未清空', false, 1, { assistantId: 'assistant-v1' });
    input.captureAttempts = [{ attempt: 1, projection: input.immediateProjection }, { attempt: 2, projection: earlier }];
  }, 'capture_attempts_integrity'],
  ['capture attempts 投影篡改', (input) => { input.captureAttempts[0].projection.running = false; }, 'capture_attempts_integrity'],
  ['transition wait 结构缺失', (input) => { delete input.transitionWait.reason; }, 'transition_wait_integrity'],
  ['reopened readback 结构缺失', (input) => { delete input.reopenedReadback.ok; }, 'reopened_readback_integrity'],
  ['用户消息结构 SHA 被篡改', (input) => { input.final.user_sequence_sha256 = '0'.repeat(64); }, 'final_projection_integrity'],
  ['错误 Case ID', (input) => { input.caseId = 'BETA-TASK-003'; }, 'case_identity'],
]) {
  const result = verdict(mutate);
  assert.equal(result.evidence_valid, false, name);
  assert.equal(result.oracle_valid, false, name);
  assert.equal(result.outcome, 'automation_error', name);
  assert.equal(result.evidence_failures.includes(failure), true, `${name}: ${failure}`);
}

for (const [name, mutate, failure] of [
  ['新版复用第一版 messageId', (input) => {
    for (const key of ['immediateProjection', 'final', 'reopened']) {
      const current = input[key];
      input[key] = projection(current.stage, current.capture_sequence, current.captured_at, current.target_assistant.body_text, current.running, current.send_count, { assistantId: 'assistant-v1', branchText: '2 / 2' });
    }
    input.captureAttempts = [{ attempt: 1, projection: input.immediateProjection }];
    input.reopenedReadback.target_assistant_message_id = 'assistant-v1';
    syncActionAfter(input);
  }, 'replacement_assistant_identity_stable'],
  ['三阶段 messageId 漂移', (input) => {
    input.final = projection('final', 3, times.final, '第二版回答 REGEN_BASE', false, 2, { assistantId: 'assistant-v3', branchText: '2 / 2' });
  }, 'replacement_assistant_identity_stable'],
  ['generation 未增长', (input) => {
    for (const key of ['immediateProjection', 'final', 'reopened']) {
      const current = input[key];
      input[key] = projection(current.stage, current.capture_sequence, current.captured_at, current.target_assistant.body_text, current.running, current.send_count, { assistantId: 'assistant-v2' });
    }
    input.captureAttempts = [{ attempt: 1, projection: input.immediateProjection }];
    Object.assign(input.reopenedReadback, { branch_index: 1, branch_count: 1, generation_version: '1/1' });
    syncActionAfter(input);
  }, 'generation_version_advanced_and_stable'],
  ['generation 三阶段漂移', (input) => {
    input.final = projection('final', 3, times.final, '第二版回答 REGEN_BASE', false, 2, { assistantId: 'assistant-v2', branchText: '2 / 3' });
  }, 'generation_version_advanced_and_stable'],
  ['产品未进入 running', (input) => { input.transitionWait.started = false; input.transitionWait.reason = 'immediate_projection_not_observed_before_idle'; }, 'transition_started_and_idle'],
  ['产品未回 idle', (input) => { input.transitionWait.idle = false; input.transitionWait.state.running = true; input.transitionWait.reason = 'wait_timeout'; }, 'transition_started_and_idle'],
  ['重开读回 task 漂移', (input) => { input.reopenedReadback.active_id = 'task-other'; }, 'reopened_readback_bound'],
  ['最终第二版为空', (input) => { input.final = projection('final', 3, times.final, '', false, 2, { assistantId: 'assistant-v2', branchText: '2 / 2' }); }, 'final_second_version_complete'],
  ['最终与第一版相同', (input) => { input.final = projection('final', 3, times.final, '第一版回答 REGEN_BASE', false, 2, { assistantId: 'assistant-v2', branchText: '2 / 2' }); }, 'second_version_differs_from_first'],
]) {
  const result = verdict(mutate);
  assert.equal(result.evidence_valid, true, name);
  assert.equal(result.oracle_valid, false, name);
  assert.equal(result.outcome, 'bug', name);
  assert.equal(result.oracle_failures.includes(failure), true, `${name}: ${failure}`);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-task-regen-evidence-'));
try {
  const caseDir = path.join(root, 'case');
  fs.mkdirSync(caseDir);
  const beforeScreenshot = path.join(caseDir, 'before.png');
  const afterScreenshot = path.join(caseDir, 'after.png');
  fs.writeFileSync(beforeScreenshot, Buffer.alloc(256, 1));
  fs.writeFileSync(afterScreenshot, Buffer.alloc(256, 2));
  const diskInput = validInput({
    beforeScreenshot: screenshotReceipt(beforeScreenshot),
    afterScreenshot: screenshotReceipt(afterScreenshot),
  });
  const diskTrace = taskRegenerateTransitionEvidence(diskInput);
  const traceFile = path.join(caseDir, 'task-regenerate-transition.json');
  fs.writeFileSync(traceFile, `${JSON.stringify(diskTrace, null, 2)}\n`);

  for (const role of ['task_regenerate_transition', 'regenerate_placeholder_readback']) {
    assert.deepEqual(validateEvidenceFile(role, traceFile, {
      expectedCaseId: 'BETA-TASK-002', expectedCaseDir: caseDir,
    }), { valid: true }, role);
  }
  const manifest = buildCoreEvidenceManifest({
    testCase: {
      id: 'BETA-TASK-002',
      evidence_roles: ['task_regenerate_transition', 'regenerate_placeholder_readback'],
    },
    caseDir,
    artifacts: {
      task_regenerate_transition: traceFile,
      regenerate_placeholder_readback: traceFile,
    },
  });
  assert.equal(manifest.complete, true);
  assert.equal(manifest.evidence.length, 2);

  const assertDiskRejected = (payload, description) => {
    fs.writeFileSync(traceFile, `${JSON.stringify(payload, null, 2)}\n`);
    for (const role of ['task_regenerate_transition', 'regenerate_placeholder_readback']) {
      assert.equal(validateEvidenceFile(role, traceFile, {
        expectedCaseId: 'BETA-TASK-002', expectedCaseDir: caseDir,
      }).valid, false, `${description}: ${role}`);
    }
  };

  const bytesTampered = structuredClone(diskTrace);
  bytesTampered.action_receipt.attempts[0].before_screenshot.bytes += 1;
  assertDiskRejected(bytesTampered, '截图 bytes 篡改');

  const shaTampered = structuredClone(diskTrace);
  shaTampered.action_receipt.attempts[0].after_screenshot.sha256 = 'f'.repeat(64);
  assertDiskRejected(shaTampered, '截图 SHA 篡改');

  const outsideScreenshot = path.join(root, 'outside.png');
  fs.writeFileSync(outsideScreenshot, Buffer.alloc(256, 3));
  const outside = structuredClone(diskTrace);
  outside.action_receipt.attempts[0].after_screenshot = screenshotReceipt(outsideScreenshot);
  assertDiskRejected(outside, '截图越界');

  const smallScreenshot = path.join(caseDir, 'small.png');
  fs.writeFileSync(smallScreenshot, Buffer.alloc(64, 4));
  const tooSmall = structuredClone(diskTrace);
  tooSmall.action_receipt.attempts[0].after_screenshot = screenshotReceipt(smallScreenshot);
  assertDiskRejected(tooSmall, '截图过小');

  const directoryScreenshot = path.join(caseDir, 'directory.png');
  fs.mkdirSync(directoryScreenshot);
  const directoryBacked = structuredClone(diskTrace);
  directoryBacked.action_receipt.attempts[0].after_screenshot = {
    path: directoryScreenshot,
    bytes: fs.lstatSync(directoryScreenshot).size,
    sha256: 'a'.repeat(64),
  };
  assertDiskRejected(directoryBacked, '目录冒充截图');

  const symlinkScreenshot = path.join(caseDir, 'symlink.png');
  fs.symlinkSync(afterScreenshot, symlinkScreenshot);
  const symlinked = structuredClone(diskTrace);
  symlinked.action_receipt.attempts[0].after_screenshot = screenshotReceipt(afterScreenshot);
  symlinked.action_receipt.attempts[0].after_screenshot.path = symlinkScreenshot;
  assertDiskRejected(symlinked, 'symlink 冒充截图');

  const reused = structuredClone(diskTrace);
  reused.action_receipt.attempts[0].after_screenshot = structuredClone(reused.action_receipt.attempts[0].before_screenshot);
  assertDiskRejected(reused, '前后截图复用');

  const attemptTampered = structuredClone(diskTrace);
  attemptTampered.capture_attempts[0].projection.projection_sha256 = '0'.repeat(64);
  assertDiskRejected(attemptTampered, 'capture attempts 篡改');

  const waitTampered = structuredClone(diskTrace);
  waitTampered.transition_wait.reason = 'forged';
  assertDiskRejected(waitTampered, 'transition wait 篡改');

  const readbackTampered = structuredClone(diskTrace);
  readbackTampered.reopened_readback.text = '伪造读回';
  assertDiskRejected(readbackTampered, 'reopened readback 篡改');

  const productFailureInput = validInput({
    beforeScreenshot: screenshotReceipt(beforeScreenshot),
    afterScreenshot: screenshotReceipt(afterScreenshot),
  });
  productFailureInput.transitionWait.started = false;
  productFailureInput.transitionWait.reason = 'immediate_projection_not_observed_before_idle';
  const productFailure = taskRegenerateTransitionEvidence(productFailureInput);
  assert.equal(productFailure.evidence_valid, true);
  assert.equal(productFailure.oracle_valid, false);
  assert.equal(productFailure.outcome, 'bug');
  fs.writeFileSync(traceFile, `${JSON.stringify(productFailure, null, 2)}\n`);
  assert.equal(validateEvidenceFile('task_regenerate_transition', traceFile, {
    expectedCaseId: 'BETA-TASK-002', expectedCaseDir: caseDir,
  }).valid, true, '证据完整的产品失败必须保持 manifest-valid');

  const traceSymlink = path.join(caseDir, 'trace-symlink.json');
  fs.symlinkSync(traceFile, traceSymlink);
  assert.equal(validateEvidenceFile('regenerate_placeholder_readback', traceSymlink, {
    expectedCaseId: 'BETA-TASK-002', expectedCaseDir: caseDir,
  }).valid, false, '强 trace 文件自身不得为 symlink');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

for (const runnerName of ['ui-agent-casebook-runner-v2.mjs', 'ui-agent-casebook-runner.mjs']) {
  const source = fs.readFileSync(new URL(`../src/lib/${runnerName}`, import.meta.url), 'utf8');
  const start = source.indexOf('async function executeSitTaskRegenerate');
  const end = source.indexOf('export function countEnumeratedItems', start);
  assert.ok(start >= 0 && end > start, `${runnerName} 必须保留 task regenerate 实现`);
  const implementation = source.slice(start, end);
  assert.equal(
    (implementation.match(/await reload\.click\(\{ force: true \}\);/g) || []).length,
    1,
    `${runnerName} 必须且只能派发一次真实重新生成点击`,
  );
  assert.match(implementation, /buildTaskRegenerateActionReceipt\(/);
  assert.match(implementation, /captureTaskRegenerateControlIdentity\(reload\)/);
  assert.match(implementation, /before_state:/);
  assert.match(implementation, /after_state:/);
  assert.match(implementation, /captureAttempts: immediateCapture\.attempts/);
  assert.match(implementation, /transitionWait: transition/);
  assert.match(implementation, /reopenedReadback/);
  assert.match(implementation, /state\.artifacts\.regenerate_placeholder_readback = evidenceFile/);
  assert.match(implementation, /writeJsonFile\(evidenceFile, evidence\)/);
  assert.match(implementation, /'重生成完整产品 Oracle'[\s\S]*?evidence\.oracle_valid/);
  assert.doesNotMatch(implementation, /clickCount\s*:/, `${runnerName} 不得恢复自报 clickCount`);
  assert.match(implementation, /attempts\.push\(\{\s*attempt: attempts\.length \+ 1,\s*projection,/s);
}

console.log('task-regenerate-evidence tests passed');
