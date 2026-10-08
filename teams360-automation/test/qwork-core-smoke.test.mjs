import assert from 'node:assert/strict';
import test from 'node:test';
import { coreCapabilityExecutionVerdict, coreMcpCallBound, coreIdentityStable, executeCoreUseSequence,
  selectedCapabilityMatches, validateCoreFixture } from '../lib/qwork-core-smoke.mjs';
import { managedSessionRecoveryError, resolveSessionCdp } from '../lib/launcher.mjs';
import { parseArgs } from '../lib/config.mjs';

const fixtures = Object.fromEntries(['skill', 'mcp', 'expert'].map((kind) => [kind, {
  id: `qa-${kind}`, prompt: `read ${kind}`, expected: `${kind}_OK`, safety: 'read-only',
  invocation_name: 'qa-skill', tool_name: 'mcp__qa-mcp__echo', result_expected: 'QA_OK',
}]));
const ok = (detail = {}) => ({ assertions: { verified: true }, detail });
function driver(overrides = {}) {
  let count = 0;
  return { prepare: async () => ok(), clean: async () => ok(), select: async () => ok(),
    send: async () => ok({ task_id: `task-${++count}` }), reopen: async () => ok(),
    execution: async () => ({ task_bound: true, selection_bound: true, execution_observed: true }), ...overrides };
}
const sequence = (options = {}) => executeCoreUseSequence({ driver: driver(), fixtures, marker: 'QA_OK', ...options });

test('four genuine-use scenarios need selection, sending, execution, isolation and immutable evidence phases', async () => {
  const events = [];
  const result = await sequence({ onEvidence: async (kind, phase) => events.push(`${kind}:${phase}`) });
  assert.equal(result.status, 'passed');
  assert.equal(result.diagnostic_only, true);
  assert.equal(result.release_gate_eligible, false);
  assert.deepEqual(result.counts, { planned: 4, executed: 4, passed: 4, failed: 0, framework_issue: 0, blocked: 0, inherited: 0, synthetic: 0 });
  for (const kind of ['skill', 'mcp', 'expert']) {
    assert.ok(events.indexOf(`${kind}:send`) < events.indexOf(`${kind}:cleanup`));
    assert.ok(events.includes(`${kind}:selection`) && events.includes(`${kind}:execution`));
  }
  assert.ok(events.includes('conversation:reopen'));
});

test('missing fixtures block only their own modules, never claim full core coverage', async () => {
  const result = await sequence({ fixtures: {} });
  assert.equal(result.status, 'blocked');
  assert.equal(result.counts.passed, 1);
  assert.equal(result.counts.blocked, 3);
  assert.ok(validateCoreFixture('mcp', { ...fixtures.mcp, safety: 'write' }).length);
});

test('product assertion failure continues independent modules only after clean restoration', async () => {
  let sent = 0;
  const result = await sequence({ driver: driver({ send: async () => ++sent === 1
    ? { assertions: { exact_reply: false }, detail: { task_id: 'failed-chat' } }
    : ok({ task_id: `other-${sent}` }) }) });
  assert.equal(result.status, 'failed');
  assert.equal(result.counts.failed, 1);
  assert.equal(result.counts.passed, 3);
});

test('cleanup failure or evidence loss freezes remaining cases without synthetic executions', async () => {
  for (const options of [
    { driver: driver({ clean: async () => ({ assertions: { clean: false } }) }) },
    { onEvidence: async () => { throw new Error('screenshot failed'); } },
  ]) {
    const result = await sequence(options);
    assert.equal(result.counts.passed, 0);
    assert.ok(result.results.slice(1).every((item) => !item.executed && item.status === 'blocked'));
    assert.equal(result.counts.synthetic, 0);
    if (result.results[0].executed) assert.ok(result.results[0].primary_outcome);
  }
});

test('reusing a task ID cannot pass capability use', async () => {
  const result = await sequence({ driver: driver({ send: async () => ok({ task_id: 'same-task' }) }) });
  assert.equal(result.counts.passed, 1);
  assert.equal(result.counts.failed, 3);
});

function verdict(kind, changes = {}) {
  return coreCapabilityExecutionVerdict({ kind, fixture: fixtures[kind], taskId: 't1',
    session: { id: 't1', messages: [{ role: 'assistant', parts: [{ t: 'tool', id: 'call-1',
      name: kind === 'skill' ? 'Skill' : fixtures.mcp.tool_name,
      input: { skill: 'qa-skill' }, result: 'tool returned QA_OK' }] }] },
    capabilities: { selectedSkills: ['qa-skill'], selectedConnectors: ['qa-mcp'] }, ...changes });
}

test('Skill/MCP require completed structured tool records bound to exact capability and task', () => {
  for (const kind of ['skill', 'mcp']) {
    const positive = verdict(kind);
    assert.equal(positive.task_bound && positive.selection_bound && positive.execution_observed, true);
    for (const part of [{ t: 'text', text: 'I invoked Skill and MCP successfully' },
      { t: 'tool', id: 'x', name: 'Skill', input: { skill: 'qa-skill' } },
      { t: 'tool', id: 'x', name: 'Skill', input: { skill: 'qa-skill' }, result: '' },
      { t: 'tool', id: 'x', name: 'Skill', input: { skill: 'qa-skill' }, result: 'error', isError: true },
      { t: 'tool', id: 'x', name: 'Skill', input: { skill: 'qa-skill' }, result: '{"isError":true}' },
      { t: 'tool', id: 'x', name: 'Skill', input: { skill: 'unrelated' }, result: 'ok' }]) {
      assert.equal(verdict(kind, { session: { id: 't1', messages: [{ role: 'assistant', parts: [part] }] } }).execution_observed, false);
    }
    assert.equal(verdict(kind, { taskId: 'other-task' }).task_bound, false);
    if (kind === 'mcp') assert.equal(verdict(kind, { fixture: { ...fixtures.mcp, result_expected: 'MISSING_VALUE' } }).execution_observed, false);
    assert.equal(verdict(kind, { capabilities: {} }).selection_bound, false);
  }
});

test('expert needs exact published identity in both session and assistant turn, not label or chip alone', () => {
  const expertIdentity = { expertId: 'qa-expert', mode: 'published', name: 'Friendly name' };
  const capabilities = { currentExpert: 'Friendly name', currentExpertIdentity: expertIdentity };
  assert.equal(selectedCapabilityMatches('expert', fixtures.expert, capabilities), true);
  const session = { id: 't1', expertIdentity, messages: [{ role: 'assistant', metadata: { expertIdentity } }] };
  assert.equal(verdict('expert', { session, capabilities }).execution_observed, true);
  assert.equal(verdict('expert', { session: { ...session, messages: [] }, capabilities }).execution_observed, false);
  assert.equal(selectedCapabilityMatches('expert', fixtures.expert, { currentExpert: 'qa-expert' }), false);
});

test('identity changes and missing version cannot be hidden by undefined equality', () => {
  const before = { qwork_url: 'file:///ui/v1/index.html', qwork_version: 'v1', webview_target_id: 't1',
    runtime_release: { release_id: 'r1', commit_id: 'abc', loaded_runtime: { version: 'v1' } } };
  assert.equal(coreIdentityStable(before, structuredClone(before)), true);
  assert.equal(coreIdentityStable(before, { ...before, qwork_version: 'v2' }), false);
  assert.equal(coreIdentityStable({}, {}), false);
  assert.equal(coreIdentityStable(before, null), false);
});

test('core smoke is explicit write-authorized diagnostic and stale sessions have actionable recovery', async () => {
  const options = parseArgs(['core-smoke', '--allow-write', '--core-fixtures', 'config/qa.json']);
  assert.equal(options.command, 'core-smoke');
  assert.ok(options.coreFixtures.endsWith('config/qa.json'));
  assert.throws(() => parseArgs(['core-smoke', '--production-gate']), /Unknown option/);
  const error = managedSessionRecoveryError('TEAMS_SESSION_STALE');
  assert.ok(error.recovery.preserve_login_profile && error.recovery.reuse_existing_authorization);
  await assert.rejects(resolveSessionCdp({ sessionFile: '/no/session', cdpUrl: 'http://127.0.0.1:9222', requireManaged: true }),
    (error) => error.code === 'TEAMS_SESSION_MISSING');
});

test('MCP runtime aliases bind through a unique enabled public catalog tool owner', () => {
  const call = { name: 'mcp__runtime_alias__read_fixture', connector: '' };
  const fixture = { id: 'mcphub:qa' };
  const connector = { key: 'mcphub:qa', tools: [{ name: 'read_fixture', effectiveEnabled: true }] };
  assert.equal(coreMcpCallBound(call, fixture, { connectors: [connector] }), true);
  assert.equal(coreMcpCallBound(call, fixture, { connectors: [connector, { ...connector, key: 'mcphub:other' }] }), false);
  assert.equal(coreMcpCallBound(call, fixture, { connectors: [{ ...connector, tools: [] }] }), false);
});
