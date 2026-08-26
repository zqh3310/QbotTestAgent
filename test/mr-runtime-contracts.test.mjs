import assert from 'node:assert/strict';
import test from 'node:test';
import {
  webPreviewOpenResult,
  webRuntimeAuthorityVerdict,
  webSearchBusinessVerdict,
} from '../src/lib/qbot-web-runtime-evidence.mjs';
import { workspaceMissingErrorVerdict } from '../src/lib/qbot-workspace-error-evidence.mjs';
import { createTeamsSkillFixtureController } from '../src/lib/ui-agent-casebook-runner.mjs';
import { interactiveChartReadbackVerdict } from '../src/lib/ui-agent-casebook-runner-v2.mjs';

const chartPrompt = '请生成曝光 12000、点击 860、报名 240、成交 28 的柱状图并显示数值标签。';
const chartTaskId = 'task-interactive-chart';
const chartSendReceipts = [{
  prompt: chartPrompt,
  attempts: [{
    clicked: true,
    receipt: { ok: true, snapshot: { activeId: chartTaskId } },
  }],
}];
const chartEnvelope = {
  ok: true,
  kind: 'qbot-chart-result',
  mimeType: 'image/svg+xml',
  type: 'column',
  dataLabels: true,
  data: [
    { label: '曝光', value: 12000 },
    { label: '点击', value: 860 },
    { label: '报名', value: 240 },
    { label: '成交', value: 28 },
  ],
  svg: '<svg><text>曝光</text><text>12000</text></svg>',
};
const chartRuntimeEvidence = {
  diagnostics: {
    sessionId: chartTaskId,
    e2eCurrentTurnAuthorityReadiness: { ready: true },
    e2eCurrentTurnAuthority: {
      connectorRouting: { mode: 'auto', effectiveConnectorIds: ['builtin:qbot_chart'] },
      connectorRuntimeMaterialization: {
        materializedConnectorIds: ['builtin:qbot_chart'],
        unsupportedConnectorIds: [],
      },
      providerReceiptHash: 'a'.repeat(64),
    },
  },
};
const chartDom = {
  captured: true,
  assistant_present: true,
  interactive_container_count: 1,
  interactive_svg_count: 1,
  static_result_count: 0,
  fallback_result_count: 0,
  chart_image_count: 0,
  svg_visible: true,
  rendered_width: 560,
  rendered_height: 320,
  inside_assistant_bounds: true,
  inside_chart_container_bounds: true,
  chart_container_overflow_x: 0,
  assistant_overflow_x: 0,
  message_list_overflow_x: 0,
  document_overflow_x: 0,
  svg_text_nodes: ['曝光', '12000', '点击', '860', '报名', '240', '成交', '28'],
};
const chartScreenshot = { path: '/tmp/qbot-chart.png', bytes: 2048, sha256: 'b'.repeat(64) };

function chartVerdict(overrides = {}) {
  return interactiveChartReadbackVerdict({
    caseId: 'MRSMOKE-CHART-001',
    legacyCaseId: 'SIT-CONN-016',
    prompt: chartPrompt,
    sendReceipts: chartSendReceipts,
    session: {
      id: chartTaskId,
      messages: [
        { role: 'user', parts: [{ t: 'text', text: chartPrompt }] },
        {
          role: 'assistant',
          parts: [{
            t: 'tool',
            name: 'mcp__qbot_chart__render_chart',
            status: 'complete',
            result: chartEnvelope,
          }],
        },
        { role: 'assistant', parts: [{ t: 'text', text: '交互柱状图已生成。' }] },
      ],
    },
    runtimeEvidence: chartRuntimeEvidence,
    dom: chartDom,
    screenshot: chartScreenshot,
    replyComplete: true,
    ...overrides,
  });
}

test('interactive chart accepts split tool/final assistant messages with task-bound hard Oracle', () => {
  const verdict = chartVerdict();
  assert.equal(verdict.evidence_valid, true);
  assert.equal(verdict.oracle_valid, true);
  assert.equal(verdict.oracle_checks.chart_tool_bound_to_prompt_turn, true);
  assert.equal(verdict.oracle_checks.envelope_exact_four_points, true);
  assert.equal(verdict.oracle_checks.all_values_visible, true);
});

test('interactive chart fallback is complete product-failure evidence, not a framework failure', () => {
  const verdict = chartVerdict({
    dom: {
      ...chartDom,
      interactive_container_count: 0,
      interactive_svg_count: 0,
      fallback_result_count: 1,
      chart_image_count: 1,
      svg_visible: false,
      rendered_width: 0,
      rendered_height: 0,
      inside_assistant_bounds: false,
      inside_chart_container_bounds: false,
      svg_text_nodes: [],
    },
  });
  assert.equal(verdict.evidence_valid, true);
  assert.equal(verdict.oracle_valid, false);
  assert.equal(verdict.oracle_checks.fallback_result_absent, false);
});

test('interactive chart task/runtime drift invalidates evidence', () => {
  const verdict = chartVerdict({
    runtimeEvidence: {
      diagnostics: {
        ...chartRuntimeEvidence.diagnostics,
        sessionId: 'task-drifted',
      },
    },
  });
  assert.equal(verdict.evidence_valid, false);
  assert.equal(verdict.evidence_checks.runtime_session_matches_task, false);
});

test('interactive chart missing normalized type/data fails product Oracle with valid evidence', () => {
  const verdict = chartVerdict({
    session: {
      id: chartTaskId,
      messages: [
        { role: 'user', parts: [{ t: 'text', text: chartPrompt }] },
        {
          role: 'assistant',
          parts: [
            { t: 'tool', name: 'qbot_chart:render_chart', status: { type: 'complete' }, result: {
              ok: true,
              kind: 'qbot-chart-result',
              mimeType: 'image/svg+xml',
              svg: chartEnvelope.svg,
            } },
            { t: 'text', text: '图表已生成。' },
          ],
        },
      ],
    },
  });
  assert.equal(verdict.evidence_valid, true);
  assert.equal(verdict.oracle_valid, false);
  assert.equal(verdict.oracle_checks.envelope_type_nonempty, false);
  assert.equal(verdict.oracle_checks.envelope_exact_four_points, false);
});

test('interactive chart tool from a later user turn cannot satisfy the requested turn', () => {
  const verdict = chartVerdict({
    session: {
      id: chartTaskId,
      messages: [
        { role: 'user', parts: [{ t: 'text', text: chartPrompt }] },
        { role: 'assistant', parts: [{ t: 'text', text: '暂时不能生成。' }] },
        { role: 'user', parts: [{ t: 'text', text: '另一轮请求' }] },
        {
          role: 'assistant',
          parts: [{ t: 'tool', name: 'mcp__qbot_chart__render_chart', status: 'complete', result: chartEnvelope }],
        },
      ],
    },
  });
  assert.equal(verdict.evidence_valid, true);
  assert.equal(verdict.oracle_valid, false);
  assert.equal(verdict.oracle_checks.chart_tool_bound_to_prompt_turn, false);
});

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
