import assert from 'node:assert/strict';
import test from 'node:test';
import {
  webPreviewOpenResult,
  webRuntimeAuthorityVerdict,
  webSearchBusinessVerdict,
} from '../src/lib/qbot-web-runtime-evidence.mjs';
import { workspaceMissingErrorVerdict } from '../src/lib/qbot-workspace-error-evidence.mjs';
import { createTeamsSkillFixtureController } from '../src/lib/ui-agent-casebook-runner.mjs';

test('workspace missing evidence requires structured non-retryable user error without internal leakage', () => {
  const cwd = '/tmp/qbot-workspace-missing';
  const session = {
    id: 'task-workspace-missing',
    messages: [{
      id: 'assistant-error',
      role: 'assistant',
      errorCode: 'desktop_local_workspace_unavailable',
      userErrorNotice: {
        code: 'chat.workspace.cwd_missing',
        causeCode: 'desktop_local_workspace_unavailable',
        params: { cwd },
        retryable: false,
      },
    }],
  };
  assert.equal(workspaceMissingErrorVerdict({ cwd, session, visibleText: `工作空间 ${cwd} 不存在，请重新选择。` }).oracle_valid, true);
  assert.equal(workspaceMissingErrorVerdict({ cwd, session, visibleText: `${cwd} 不存在；causeCode=desktop_local_workspace_unavailable` }).oracle_valid, false);
  assert.equal(workspaceMissingErrorVerdict({ cwd: `${cwd}-other`, session, visibleText: `${cwd} 不存在。` }).oracle_valid, false);
});

test('web search business oracle is independent from task-bound runtime authority', () => {
  const prompt = '查找两条更新';
  const taskId = 'task-web-runtime';
  const business = webSearchBusinessVerdict(
    '2026-08-25 https://openai.com/news/a\n2026-08-24 https://www.iana.org/domains/reserved',
    'qbot_web web_search completed',
  );
  assert.equal(business.ok, true);
  const sendReceipts = [{
    prompt,
    confirmed_at: '2026-08-26T00:00:00.000Z',
    attempts: [{ receipt: { ok: true, snapshot: { activeId: taskId, userTexts: [prompt] } } }],
  }];
  const runtimeEvidence = {
    diagnostics: {
      sessionId: taskId,
      e2eCurrentTurnAuthorityReadiness: { ready: true },
      e2eCurrentTurnAuthority: {
        executionTarget: 'desktop-local',
        routeTarget: 'desktop-local',
        connectorRouting: { mode: 'auto', effectiveConnectorIds: ['builtin:qbot_web'] },
        connectorRuntimeMaterialization: {
          materializedConnectorIds: ['builtin:qbot_web'],
          unsupportedConnectorIds: [],
        },
        providerReceiptHash: 'a'.repeat(64),
      },
    },
  };
  assert.equal(webRuntimeAuthorityVerdict({ runtimeEvidence, prompt, sendReceipts }).ok, true);
  assert.equal(webRuntimeAuthorityVerdict({
    runtimeEvidence: {
      diagnostics: {
        ...runtimeEvidence.diagnostics,
        e2eCurrentTurnAuthority: {
          ...runtimeEvidence.diagnostics.e2eCurrentTurnAuthority,
          connectorRuntimeMaterialization: {
            materializedConnectorIds: [],
            unsupportedConnectorIds: ['builtin:qbot_web'],
          },
        },
      },
    },
    prompt,
    sendReceipts,
  }).ok, false);
  assert.deepEqual(
    [
      webPreviewOpenResult({ ok: true, url: 'https://example.org/' }),
      webPreviewOpenResult({ ok: false, code: 'external_opened' }),
      webPreviewOpenResult({ ok: false, code: 'external_open_failed' }),
    ],
    ['preview', 'external', 'blocked'],
  );
});

test('Teams Skill fixture records installAttempt and rolls back only that attempt', async () => {
  const controller = createTeamsSkillFixtureController([
    { slug: 'root', namespace: 'global', title: 'Root', archive: 'valid', dependencies: ['dep'] },
    { slug: 'dep', namespace: 'global', title: 'Dep', archive: 'valid', dependencies: [] },
  ]);
  const install = (await controller.handle({ name: 'installSkill', args: [{ slug: 'root' }] })).result;
  assert.equal(install.ok, true);
  assert.equal(install.installAttempt.schemaVersion, 1);
  assert.equal(install.installAttempt.scope, 'personal');
  assert.deepEqual(install.installAttempt.entries.map((entry) => entry.skill), ['root', 'dep']);
  assert.equal(install.installAttempt.entries.every((entry) => (
    entry.operationId === `${install.installAttempt.attemptId}:${entry.namespace}/${entry.skill}`
  )), true);
  const installed = controller.snapshot();
  assert.deepEqual(installed.installed.map((item) => item.slug).sort(), ['dep', 'root']);
  assert.equal(installed.history.every((entry) => entry.scope === 'personal'), true);
  assert.equal(installed.attempts[0].installCall.result.ok, true);
  assert.ok(installed.attempts[0].installCall.startedAt);
  assert.ok(installed.attempts[0].installCall.finishedAt);

  const discarded = (await controller.handle({
    name: 'uninstallSkill',
    args: [{ slug: 'root', discardFailedAttempt: true, installAttempt: install.installAttempt }],
  })).result;
  assert.equal(discarded.discarded, true);
  assert.equal(controller.snapshot().installed.length, 0);
  assert.equal(controller.snapshot().history.length, 0);
  assert.equal(controller.snapshot().attempts[0].status, 'discarded');
});

test('Teams Skill fixture leaves no installed/history residue when a required dependency fails', async () => {
  const controller = createTeamsSkillFixtureController([
    { slug: 'root', namespace: 'global', title: 'Root', archive: 'valid', dependencies: ['dep'] },
    { slug: 'dep', namespace: 'global', title: 'Dep', archive: 'download_failure', dependencies: [] },
  ]);
  const result = (await controller.handle({ name: 'installSkill', args: [{ slug: 'root' }] })).result;
  const snapshot = controller.snapshot();
  assert.equal(result.ok, false);
  assert.match(result.msg, /依赖技能.*安装失败.*主技能未安装/);
  assert.equal(snapshot.installed.length, 0);
  assert.equal(snapshot.history.length, 0);
  assert.equal(snapshot.attempts[0].status, 'failed_rolled_back');
  assert.deepEqual(snapshot.attempts[0].entries.map((entry) => entry.skill), ['root', 'dep']);
});
