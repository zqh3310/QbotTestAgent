import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  webPreviewOpenResult,
  webRuntimeAuthorityVerdict,
  webSearchBusinessVerdict,
  webSearchFixedQuotaRejection,
  webSearchQuotaTraceVerdict,
} from '../src/lib/qbot-web-runtime-evidence.mjs';
import { workspaceMissingErrorVerdict } from '../src/lib/qbot-workspace-error-evidence.mjs';
import {
  createTeamsSkillFixtureController,
  skillCatalogRefreshSettledVerdict,
  skillInstallControlVerdict,
} from '../src/lib/ui-agent-casebook-runner.mjs';
import {
  interactiveChartReadbackVerdict,
  skillCatalogRefreshSettledVerdict as skillCatalogRefreshSettledVerdictV2,
  skillInstallControlVerdict as skillInstallControlVerdictV2,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';
import {
  QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT,
  QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT,
} from '../src/lib/qwork-release-source-contracts.mjs';

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

function structuredWebReply(seed, { secondUrl = '', secondTitle = '', suffix = '' } = {}) {
  const urlA = `https://openai.com/news/${seed}-a`;
  const urlB = secondUrl || `https://openai.com/research/${seed}-b`;
  const titleB = secondTitle || `OpenAI 研究更新 ${seed}B`;
  return [
    `1. 标题：OpenAI 产品更新 ${seed}A`,
    `日期：2026-09-${String(seed).padStart(2, '0')}`,
    `官方链接：${urlA}`,
    `摘要：这是第 ${seed} 轮第一条官方产品更新的具体内容说明。`,
    '',
    `2. 标题：${titleB}`,
    `日期：2026-08-${String(seed).padStart(2, '0')}`,
    `官方链接：${urlB}`,
    `摘要：这是第 ${seed} 轮第二条官方研究更新的具体内容说明。`,
    suffix,
  ].join('\n');
}

test('MR !1561 declares one shared 32 MiB execution-worker envelope boundary', () => {
  const contract = QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT;
  const bindings = new Map(contract.integration_bindings.map((binding) => [binding.id, binding.addition.source]));
  assert.equal(contract.claim_scope, 'source_and_test_declarations');
  assert.equal(contract.test_execution_attested, false);
  assert.equal(
    bindings.get('shared_worker_envelope_limit_32_mib'),
    'const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;',
  );
  assert.equal(
    bindings.get('test_declares_shared_32_mib_envelope_limit'),
    "test('execution messages share the 32 MiB envelope limit', () => {",
  );
  assert.equal(
    bindings.get('test_asserts_execution_start_matches_shared_limit'),
    '  assert.equal(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);',
  );
  assert.equal(
    contract.forbidden_fragments.some((item) => item.value.source === 'const MAX_ENVELOPE_BYTES = 256 * 1024;'),
    true,
  );
  assert.equal(
    contract.forbidden_fragments.some((item) => (
      item.value.source === '  assert.ok(MAX_EXECUTION_START_ENVELOPE_BYTES > MAX_ENVELOPE_BYTES);'
    )),
    true,
  );
});

test('MR !1560 declares cache-first local turn-authority readiness without re-accepting', () => {
  const contract = QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT;
  const bindings = new Map(contract.integration_bindings.map((binding) => [binding.id, binding.addition.source]));
  assert.equal(contract.claim_scope, 'source_and_test_declarations');
  assert.equal(contract.test_execution_attested, false);
  assert.equal(bindings.get('readiness_default_timeout_10_seconds'), '  timeoutMs = 10_000,');
  assert.equal(bindings.get('readiness_default_interval_100_ms'), '  intervalMs = 100,');
  assert.equal(
    bindings.get('readiness_returns_ok_or_non_transient_error_immediately'),
    "    if (result?.ok || result?.code !== 'desktop_model_authority_not_ready') return result;",
  );
  assert.equal(
    bindings.get('readiness_wait_is_interval_and_deadline_bounded'),
    '    await wait(Math.min(intervalMs, remaining));',
  );
  assert.match(bindings.get('desktop_host_wraps_single_accept_authority_read'), /readReadyTurnAuthority.*currentTurnAuthorityForScope/u);
  assert.match(bindings.get('test_declares_last_good_immediate'), /last-good authority is returned without waiting/u);
  assert.match(bindings.get('test_cold_start_ready_on_third_read'), /\+\+reads === 3/u);
  assert.equal(bindings.get('test_bounded_failure_timeout_250_ms'), '    timeoutMs: 250, now: () => elapsed,');
  assert.match(bindings.get('test_covers_scope_and_permanent_error_codes'), /desktop_local_authority_not_ready/u);
  assert.equal(
    contract.forbidden_fragments.some((item) => item.id === 'desktop_host_direct_authority_read_without_readiness'),
    true,
  );
});

test('Skill catalog refresh accepts a stable target card while sync control remains disabled', () => {
  const blocked = skillCatalogRefreshSettledVerdict({ busy: 'true', disabled: true, loadingVisible: true });
  assert.deepEqual(blocked, { settled: false, mode: '', fallback: false });
  const fallback = skillCatalogRefreshSettledVerdict({
    busy: 'true',
    disabled: true,
    loadingVisible: true,
    targetCardVisible: true,
    stableSnapshotCount: 2,
  });
  assert.deepEqual(fallback, { settled: true, mode: 'target_card_stable', fallback: true });
  assert.deepEqual(
    skillCatalogRefreshSettledVerdictV2({
      busy: 'true',
      disabled: true,
      loadingVisible: true,
      targetCardVisible: true,
      stableSnapshotCount: 2,
    }),
    fallback,
  );
});

test('Skill install waits for the target card control to become enabled', () => {
  const pending = skillInstallControlVerdict({
    visible: true,
    disabled: true,
    ariaDisabled: 'true',
    className: 'skill-install disabled',
    text: 'qa-dep-root-failure\n正在同步',
  });
  assert.equal(pending.enabled, false);
  assert.equal(pending.pending, true);
  const ready = skillInstallControlVerdict({
    visible: true,
    disabled: false,
    ariaDisabled: 'false',
    className: 'skill-install',
    text: 'qa-dep-root-failure\n安装',
  });
  assert.equal(ready.enabled, true);
  assert.deepEqual(skillInstallControlVerdictV2({
    visible: true,
    disabled: false,
    ariaDisabled: 'false',
    className: 'skill-install',
    text: 'qa-dep-root-failure\n安装',
  }), ready);
});

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

test('interactive chart accepts renderer unit formatting and omitted tool status', () => {
  const verdict = chartVerdict({
    session: {
      id: chartTaskId,
      messages: [
        { role: 'user', parts: [{ t: 'text', text: chartPrompt }] },
        {
          role: 'assistant',
          parts: [{
            t: 'tool',
            name: 'mcp__qbot_chart__render_chart',
            result: chartEnvelope,
          }],
        },
        { role: 'assistant', parts: [{ t: 'text', text: '交互柱状图已生成。' }] },
      ],
    },
    dom: {
      ...chartDom,
      svg_text_nodes: ['曝光', '1.2万', '点击', '860', '报名', '240', '成交', '28'],
    },
  });
  assert.equal(verdict.evidence_valid, true);
  assert.equal(verdict.oracle_valid, true);
  assert.equal(verdict.oracle_checks.tool_completed, true);
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
    structuredWebReply(1, { suffix: '公共外链：https://www.iana.org/domains/reserved' }),
    'qbot_web web_search completed',
  );
  assert.equal(business.ok, true);
  assert.equal(business.officialResultCount, 2);
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

test('web search business oracle rejects unbound, incomplete, third-party, duplicate, and shortage results', () => {
  const tool = 'qbot_web web_search completed';
  const oneOfficialAndThirdParty = structuredWebReply(2, {
    secondUrl: 'https://example.org/third-party-update',
  });
  assert.equal(webSearchBusinessVerdict(oneOfficialAndThirdParty, tool).ok, false);

  const strayDates = [
    '2026-09-02 2026-08-02',
    '标题：第一条更新',
    '官方链接：https://openai.com/news/stray-a',
    '摘要：第一条包含足够长且具体的官方更新摘要。',
    '',
    '标题：第二条更新',
    '官方链接：https://openai.com/news/stray-b',
    '摘要：第二条包含足够长且具体的官方更新摘要。',
  ].join('\n');
  assert.equal(webSearchBusinessVerdict(strayDates, tool).ok, false);

  const missingTitle = structuredWebReply(3).replace('2. 标题：OpenAI 研究更新 3B\n', '2. OpenAI 研究更新 3B\n');
  assert.equal(webSearchBusinessVerdict(missingTitle, tool).ok, false);

  const missingSummary = structuredWebReply(4).replace('摘要：这是第 4 轮第二条官方研究更新的具体内容说明。', '说明缺失。');
  assert.equal(webSearchBusinessVerdict(missingSummary, tool).ok, false);

  const duplicateUrl = structuredWebReply(5, { secondUrl: 'https://openai.com/news/5-a' });
  const duplicateUrlVerdict = webSearchBusinessVerdict(duplicateUrl, tool);
  assert.equal(duplicateUrlVerdict.ok, false);
  assert.deepEqual(duplicateUrlVerdict.duplicateOfficialUrls, ['https://openai.com/news/5-a']);

  const duplicateEntry = structuredWebReply(6, {
    secondUrl: 'https://openai.com/news/6-a',
    secondTitle: 'OpenAI 产品更新 6A',
  });
  const duplicateEntryVerdict = webSearchBusinessVerdict(duplicateEntry, tool);
  assert.equal(duplicateEntryVerdict.ok, false);
  assert.deepEqual(duplicateEntryVerdict.duplicateTitles, ['OpenAI 产品更新 6A']);

  const shortageBypass = `${structuredWebReply(7).split('\n\n')[0]}\n不足两条，只有一条。`;
  const shortageVerdict = webSearchBusinessVerdict(shortageBypass, tool);
  assert.equal(shortageVerdict.explicitShortage, true);
  assert.equal(shortageVerdict.ok, false);

  const contradictoryShortage = webSearchBusinessVerdict(`${structuredWebReply(8)}\n仍然不足两条。`, tool);
  assert.equal(contradictoryShortage.officialResultCount, 2);
  assert.equal(contradictoryShortage.checks.no_explicit_shortage_claim, false);
  assert.equal(contradictoryShortage.ok, false);
});

test('four-round web quota trace requires one task and unique provider receipts', () => {
  const taskId = 'task-web-four-rounds';
  const rounds = Array.from({ length: 4 }, (_, index) => {
    const round = index + 1;
    const prompt = `第${round}轮真实 Web 搜索`;
    const providerReceiptHash = `${String.fromCharCode(97 + round)}`.repeat(64);
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
          providerReceiptHash,
        },
      },
    };
    const sendReceipts = [{
      prompt,
      confirmed_at: '2026-08-26T00:00:00.000Z',
      attempts: [{ clicked: true, receipt: { ok: true, snapshot: { activeId: taskId, userTexts: [prompt] } } }],
    }];
    const reply = structuredWebReply(round);
    return {
      round,
      prompt,
      prompt_sha256: createHash('sha256').update(prompt).digest('hex'),
      task_id: taskId,
      reply,
      tool_texts: ['qbot_web web_search completed'],
      runtime_evidence: runtimeEvidence,
      send_receipts: sendReceipts,
      business_oracle: webSearchBusinessVerdict(reply, `qbot_web web_search completed\n${JSON.stringify(runtimeEvidence)}`),
      runtime_authority: webRuntimeAuthorityVerdict({ runtimeEvidence, prompt, sendReceipts }),
      post_round_state: { available: true, activeId: taskId, running: false },
      timeout_cleanup_ok: true,
      screenshot: { path: `/case/round-${round}.png`, bytes: 1024, sha256: 'f'.repeat(64) },
    };
  });
  const verdict = webSearchQuotaTraceVerdict({
    caseId: 'MRSMOKE-WEB-001',
    legacyCaseId: 'SIT-CONN-019',
    rounds,
  });
  assert.equal(verdict.evidence_valid, true);
  assert.equal(verdict.oracle_valid, true);
  assert.equal(verdict.task_id, taskId);
  assert.equal(verdict.oracle_checks.provider_receipts_valid_and_unique, true);

  const reusedReceipt = structuredClone(rounds);
  reusedReceipt[3].runtime_evidence.diagnostics.e2eCurrentTurnAuthority.providerReceiptHash =
    reusedReceipt[2].runtime_evidence.diagnostics.e2eCurrentTurnAuthority.providerReceiptHash;
  reusedReceipt[3].runtime_authority = webRuntimeAuthorityVerdict({
    runtimeEvidence: reusedReceipt[3].runtime_evidence,
    prompt: reusedReceipt[3].prompt,
    sendReceipts: reusedReceipt[3].send_receipts,
    expectedTaskId: taskId,
  });
  const reusedVerdict = webSearchQuotaTraceVerdict({
    caseId: 'MRSMOKE-WEB-001',
    legacyCaseId: 'SIT-CONN-019',
    rounds: reusedReceipt,
  });
  assert.equal(reusedVerdict.evidence_valid, true);
  assert.equal(reusedVerdict.oracle_valid, false);
  assert.equal(reusedVerdict.oracle_checks.provider_receipts_valid_and_unique, false);
});

test('fourth web round fixed quota wording is a product oracle failure', () => {
  for (const wording of [
    '最多三次搜索，当前额度已用尽。',
    'You can only search three times.',
    'The server rejected the fourth search.',
    'The server refused another search.',
    'The search quota has been hit.',
  ]) {
    assert.equal(webSearchFixedQuotaRejection(wording), true, wording);
  }
  for (const wording of [
    '第 4 轮已再次调用搜索并返回结果。',
    'The fourth search was not rejected and returned results.',
    'The server accepted another search and returned results.',
    'There is no fixed search limit; the fourth search succeeded.',
    'The search quota has not been exhausted.',
    '搜索配额没有耗尽，第四轮已成功。',
    '不存在固定搜索次数上限，第四轮已成功。',
  ]) {
    assert.equal(webSearchFixedQuotaRejection(wording), false, wording);
  }
  const rounds = Array.from({ length: 4 }, (_, index) => {
    const prompt = `quota-prompt-${index + 1}`;
    const taskId = 'task-quota-rejection';
    const providerReceiptHash = `${String.fromCharCode(97 + index)}`.repeat(64);
    const runtimeEvidence = {
      diagnostics: {
        sessionId: taskId,
        e2eCurrentTurnAuthorityReadiness: { ready: true },
        e2eCurrentTurnAuthority: {
          connectorRouting: { mode: 'auto', effectiveConnectorIds: ['builtin:qbot_web'] },
          connectorRuntimeMaterialization: {
            materializedConnectorIds: ['builtin:qbot_web'],
            unsupportedConnectorIds: [],
          },
          providerReceiptHash,
        },
      },
    };
    const sendReceipts = [{
      prompt,
      confirmed_at: '2026-08-26T00:00:00.000Z',
      attempts: [{ clicked: true, receipt: { ok: true, snapshot: { activeId: taskId, userTexts: [prompt] } } }],
    }];
    const reply = structuredWebReply(index + 1, {
      suffix: index === 3 ? '已达到固定上限，服务端拒绝继续搜索。' : '',
    });
    return {
      round: index + 1,
      prompt,
      prompt_sha256: createHash('sha256').update(prompt).digest('hex'),
      task_id: taskId,
      reply,
      tool_texts: ['qbot_web web_search completed'],
      runtime_evidence: runtimeEvidence,
      send_receipts: sendReceipts,
      business_oracle: webSearchBusinessVerdict(reply, `qbot_web web_search completed\n${JSON.stringify(runtimeEvidence)}`),
      runtime_authority: webRuntimeAuthorityVerdict({ runtimeEvidence, prompt, sendReceipts }),
      post_round_state: { available: true, activeId: taskId, running: false },
      timeout_cleanup_ok: true,
      screenshot: { path: `/case/quota-${index + 1}.png`, bytes: 100, sha256: 'e'.repeat(64) },
    };
  });
  const verdict = webSearchQuotaTraceVerdict({
    caseId: 'MRSMOKE-WEB-001',
    legacyCaseId: 'SIT-CONN-019',
    rounds,
  });
  assert.equal(verdict.evidence_valid, true);
  assert.equal(verdict.oracle_valid, false);
  assert.equal(verdict.oracle_checks.fourth_round_has_no_fixed_quota_rejection, false);
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

  const reconciled = (await controller.handle({
    name: 'reconcileSkills',
    args: [{ selection: ['root'], userRetrySlugs: ['root'] }],
  })).result;
  assert.equal(reconciled.ok, true);
  assert.deepEqual(reconciled.ready.map((item) => item.slug), ['root']);
  assert.equal(reconciled.ready[0].runtimeName, 'skillhub__global__root');
  assert.deepEqual(reconciled.materialized, []);
  assert.equal(controller.snapshot().attempts[0].status, 'succeeded');

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
