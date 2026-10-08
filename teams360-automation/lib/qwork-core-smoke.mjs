import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { discoverWebviewProbes, withWebviewTargetClient } from './cdp-webview.mjs';
import { redactText } from './config.mjs';
import {
  captureClientScreenshot, createCdpAppSanityDriver, dispatchTrustedTestIdClick,
  dispatchTrustedVisibleSelectorClick, evidenceEntry, readAppSanityState, readLightweightIdentity,
} from './qwork-app-sanity.mjs';

export const CORE_SMOKE_SCHEMA = 'qbot-qwork-core-use/v1';
export const CORE_MODULES = Object.freeze(['conversation', 'skill', 'mcp', 'expert']);
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean = (value) => String(value ?? '').trim();
const passed = (result) => Object.keys(result?.assertions || {}).length > 0
  && Object.values(result.assertions).every((value) => value === true);
const array = (value) => Array.isArray(value) ? value : [];
const parseValue = (value) => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function capabilityId(item) {
  if (typeof item === 'string') return item;
  return clean(item?.id || item?.expertId || item?.key || item?.slug || item?.name);
}

export function validateCoreFixture(kind, fixture) {
  if (!fixture) return ['missing_fixture'];
  const missing = ['id', 'prompt', 'expected'].filter((key) => !clean(fixture[key]));
  if (fixture.safety !== 'read-only') missing.push('read_only_qa_fixture_required');
  if (kind === 'mcp') {
    if (!clean(fixture.tool_name)) missing.push('tool_name');
    if (!clean(fixture.result_expected)) missing.push('result_expected');
  }
  if (kind === 'skill' && !clean(fixture.invocation_name)) missing.push('invocation_name');
  return missing;
}

export function coreFixturePlan(fixtures) {
  const keys = ['id', 'label', 'prompt', 'expected', 'safety', 'invocation_name', 'tool_name', 'result_expected'];
  return Object.fromEntries(CORE_MODULES.filter((kind) => kind !== 'conversation').map((kind) => [kind,
    fixtures[kind] ? Object.fromEntries(keys.filter((key) => typeof fixtures[kind][key] === 'string')
      .map((key) => [key, redactText(fixtures[kind][key])])) : null]));
}

// Catalog presence is different from being a selectable, enabled MCP resource.
// Builtin tools are resident runtime tools and are not composer connector cards.
export function coreMcpFixtureAvailability(fixture, capabilities) {
  if (!Array.isArray(capabilities?.connectors)) throw new Error('Connector catalog is unavailable.');
  const connector = capabilities.connectors.find((item) => capabilityId(item) === fixture.id);
  if (!connector) return { available: false, reason: 'connector_not_in_catalog' };
  if (connector.source === 'builtin' || fixture.id.startsWith('builtin:')) {
    return { available: false, reason: 'resident_builtin_is_not_selectable_mcp' };
  }
  if (['usable', 'installed', 'enabled'].some((key) => connector[key] === false)
    || ['disabled', 'needs_install'].includes(connector.statusKind)) {
    return { available: false, reason: 'connector_not_usable' };
  }
  const tools = array(connector.tools).filter((tool) => tool.effectiveEnabled === true
    && fixture.tool_name.endsWith(`__${tool.toolName || tool.name}`));
  return tools.length === 1 ? { available: true, reason: '' }
    : { available: false, reason: 'exact_enabled_tool_not_in_catalog' };
}

export function coreFixtureAvailability(kind, fixture, capabilities) {
  if (kind === 'mcp') return coreMcpFixtureAvailability(fixture, capabilities);
  const catalog = kind === 'skill' ? capabilities?.skills : capabilities?.experts;
  if (!Array.isArray(catalog)) throw new Error(`${kind} catalog is unavailable.`);
  const capability = catalog.find((item) => capabilityId(item) === fixture.id);
  if (!capability) return { available: false, reason: `${kind}_not_in_catalog` };
  if (capability.enabled === false) return { available: false, reason: `${kind}_disabled` };
  return { available: true, reason: '' };
}

export function publishedExpertResourceMatches(fixture, view) {
  return view?.id === fixture.id && view.status === 'active' && view.releaseStatus === 'active'
    && ['versionId', 'releaseId', 'snapshotDigest', 'dependencyGraphDigest'].every((key) => clean(view[key]));
}

export function selectedCapabilityMatches(kind, fixture, capabilities, publishedExpert = null) {
  if (!capabilities || typeof capabilities !== 'object') return false;
  if (kind === 'expert') {
    const identity = capabilities.currentExpertIdentity;
    if (identity?.mode === 'published') return capabilityId(identity) === fixture.id;
    // Before a task exists, the public draft-context readback can contain only
    // the selected resource name. Full execution authority is checked after send.
    return !identity?.mode && !identity?.draftId && !identity?.expertId
      && capabilities.currentExpert === fixture.id && identity?.name === fixture.id
      && publishedExpertResourceMatches(fixture, publishedExpert);
  }
  const list = kind === 'skill' ? capabilities.selectedSkills : capabilities.selectedConnectors;
  return Array.isArray(list) && list.length === 1 && capabilityId(list[0]) === fixture.id;
}

// Public catalog binding supports mcphub keys whose runtime server name differs
// from the connector key. Ambiguous tool ownership is deliberately not accepted.
export function coreMcpCallBound(call, fixture, capabilities) {
  if (call.connector === fixture.id || call.name.startsWith(`mcp__${fixture.id}__`)) return true;
  const catalog = array(capabilities?.connectorRouting?.effectiveConnectors);
  const owners = (catalog.length ? catalog : array(capabilities?.connectors))
    .filter((connector) => array(connector.tools).some((tool) => tool.effectiveEnabled === true
      && (call.name === tool.name || call.name.endsWith(`__${tool.toolName || tool.name}`))));
  return owners.length === 1 && capabilityId(owners[0]) === fixture.id;
}

// Only structured tool records count. Assistant prose mentioning a Skill/MCP never does.
export function coreCapabilityExecutionVerdict({ kind, fixture, taskId, session, capabilities, publishedExpert = null }) {
  const bound = Boolean(taskId) && clean(session?.id) === taskId;
  const calls = (Array.isArray(session?.messages) ? session.messages : [])
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => [
      ...array(message.parts).filter((part) => part?.t === 'tool'),
      ...array(message.toolCalls), ...array(message.tool_calls),
    ]).map((call) => ({
      id: clean(call.id), name: clean(call.name || call.function?.name),
      input: parseValue(call.input || call.args || call.arguments || call.function?.arguments || {}),
      connector: clean(call.connectorKey || call.serviceId || call.server),
      result_present: (call.result ?? call.output) != null && clean(call.result ?? call.output) !== '',
      result_sha256: hash(call.result ?? call.output ?? null),
      result_expected_matched: Boolean(clean(fixture.result_expected))
        && (typeof (call.result ?? call.output) === 'string'
          ? (call.result ?? call.output) : JSON.stringify(call.result ?? call.output ?? null)).includes(fixture.result_expected),
      failed: call.delta === true || call.isError === true || call.is_error === true
        || parseValue(call.result ?? call.output)?.isError === true
        || parseValue(call.result ?? call.output)?.ok === false
        || /error|fail|pending|running/i.test(clean(call.status)),
    }));
  const matched = calls.filter((call) => {
    if (!call.id || !call.result_present || call.failed) return false;
    if (kind === 'skill') return call.name === 'Skill'
      && clean(call.input?.skill) === fixture.invocation_name;
    if (kind === 'mcp') return call.result_expected_matched && call.name === fixture.tool_name
      && coreMcpCallBound(call, fixture, capabilities);
    return false;
  });
  const expert = session?.expertIdentity || session?.currentExpertIdentity || session?.expert;
  return {
    task_bound: bound,
    selection_bound: selectedCapabilityMatches(kind, fixture, capabilities, publishedExpert),
    execution_observed: kind === 'expert'
      ? expert?.mode === 'published' && capabilityId(expert) === fixture.id && array(session?.messages).some((message) =>
        message.role === 'assistant' && !message.error
        && capabilityId(message.metadata?.expertIdentity || message.expertIdentity) === fixture.id)
      : matched.length > 0,
    calls: calls.map(({ input, ...call }) => ({ ...call, input_sha256: hash(input) })),
    matching_call_ids: matched.map((call) => call.id),
    session_expert_id: capabilityId(expert),
  };
}

export async function executeCoreUseSequence({ driver, fixtures = {}, marker,
  onEvidence = async () => {}, onResult = async () => {} }) {
  if (!clean(marker)) throw new Error('A unique conversation marker is required.');
  const results = [];
  let foundationLost = false;
  const taskIds = new Set();
  for (const kind of CORE_MODULES) {
    const result = { module: kind, status: 'blocked', executed: false, synthetic: false,
      started_at: new Date().toISOString(), assertions: {}, evidence: {}, reason: '' };
    try {
      if (foundationLost) {
        result.reason = 'previous_case_isolation_or_runtime_not_restored';
        continue;
      }
      const missing = kind === 'conversation' ? [] : validateCoreFixture(kind, fixtures[kind]);
      if (missing.length) { result.reason = `fixture_unavailable:${missing.join(',')}`; continue; }
      if (kind !== 'conversation' && driver.inspectFixture) {
        const availability = await driver.inspectFixture(kind, fixtures[kind]);
        result.evidence.fixture_availability = availability;
        await onEvidence(kind, 'fixture_availability', availability);
        if (availability?.available !== true) {
          result.reason = `fixture_unavailable:${availability?.reason || 'not_verified'}`;
          continue;
        }
      }
      const ready = await driver.prepare();
      result.evidence.preparation = ready;
      await onEvidence(kind, 'preparation', ready);
      if (!passed(ready)) {
        result.reason = 'clean_workbench_not_ready'; foundationLost = true; continue;
      }
      result.executed = true;
      result.status = 'failed';
      const fixture = kind === 'conversation'
        ? { prompt: `请只回复 ${marker}。`, expected: marker } : fixtures[kind];
      if (kind !== 'conversation') {
        const selected = await driver.select(kind, fixture);
        result.evidence.selection = selected;
        await onEvidence(kind, 'selection', selected);
        result.assertions.selection = passed(selected);
        if (!passed(selected)) { result.reason = 'capability_selection_not_verified'; continue; }
      }
      const send = await driver.send({ prompt: fixture.prompt, expected: fixture.expected,
        match: kind === 'conversation' ? 'exact' : 'contains',
        skillId: kind === 'skill' ? fixture.id : '' });
      result.evidence.send = send;
      await onEvidence(kind, 'send', send);
      result.assertions.send_and_reply = passed(send);
      const taskId = clean(send?.detail?.task_id);
      result.task_id = taskId;
      result.assertions.unique_task = Boolean(taskId) && !taskIds.has(taskId);
      if (taskId) taskIds.add(taskId);
      if (kind === 'conversation' && passed(send)) {
        const cleanTask = await driver.clean();
        result.evidence.before_reopen = cleanTask;
        const reopened = passed(cleanTask) ? await driver.reopen({ taskId, ...fixture }) : null;
        result.evidence.reopen = reopened;
        await onEvidence(kind, 'reopen', reopened);
        result.assertions.history_persisted = passed(cleanTask) && passed(reopened);
      } else if (kind !== 'conversation' && passed(send)) {
        const execution = await driver.execution(kind, fixture, taskId);
        result.evidence.execution = execution;
        await onEvidence(kind, 'execution', execution);
        for (const key of ['task_bound', 'selection_bound', 'execution_observed']) {
          result.assertions[key] = execution[key] === true;
        }
      }
      result.status = passed(result) ? 'passed' : 'failed';
      result.reason = result.status === 'passed' ? '' : 'business_or_execution_assertion_failed';
    } catch (error) {
      result.status = result.executed ? 'framework_issue' : 'blocked';
      result.reason = redactText(error?.message || String(error)).slice(0, 1200);
      foundationLost = true;
      try { await onEvidence(kind, 'failure', { reason: result.reason }); }
      catch (evidenceError) { result.evidence.capture_error = redactText(evidenceError.message); }
    } finally {
      if (result.executed) {
        result.primary_outcome = { status: result.status, reason: result.reason };
        try {
          const cleanup = await driver.clean();
          result.evidence.cleanup = cleanup;
          await onEvidence(kind, 'cleanup', cleanup);
          result.assertions.cleanup = passed(cleanup);
          if (!passed(cleanup)) {
            result.status = 'framework_issue'; result.reason = 'cleanup_failed'; foundationLost = true;
          }
        } catch (error) {
          result.status = 'framework_issue'; foundationLost = true;
          result.reason = `cleanup_failed:${redactText(error.message)}`;
          try { await onEvidence(kind, 'cleanup_failure', { reason: result.reason }); }
          catch (evidenceError) { result.evidence.cleanup_capture_error = redactText(evidenceError.message); }
        }
      }
      result.ended_at = new Date().toISOString();
      results.push(result);
      await onResult(result);
    }
  }
  return {
    schema_version: CORE_SMOKE_SCHEMA, diagnostic_only: true, release_gate_eligible: false,
    status: results.every((item) => item.status === 'passed') ? 'passed'
      : results.some((item) => ['failed', 'framework_issue'].includes(item.status)) ? 'failed' : 'blocked',
    counts: { planned: 4, executed: results.filter((item) => item.executed).length,
      passed: results.filter((item) => item.status === 'passed').length,
      failed: results.filter((item) => item.status === 'failed').length,
      framework_issue: results.filter((item) => item.status === 'framework_issue').length,
      blocked: results.filter((item) => item.status === 'blocked').length, inherited: 0, synthetic: 0 },
    results,
  };
}

async function readCapabilities(client) {
  return client.evaluate(`Promise.race([
    window.agent.capabilities(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('capabilities timeout')), 5000))
  ])`);
}

export async function dismissCoreMenus(client) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const open = await client.evaluate(`([...document.querySelectorAll('[role="menu"]')]
      .filter((node) => { const r = node.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(node).visibility !== 'hidden'; }).length)`);
    if (!open) return;
    if (attempt === 3) throw new Error('Capability menu did not dismiss with Escape.');
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await pause(100);
  }
}

export async function searchCoreCapability(client, kind, id) {
  const placeholder = kind === 'expert' ? '搜索专家' : kind === 'skill' ? '搜索技能' : '搜索连接器或技能';
  const selector = `input[placeholder=${JSON.stringify(placeholder)}]`;
  const click = await dispatchTrustedVisibleSelectorClick(client, selector, `search ${kind}`);
  const initial = await client.evaluate(`document.querySelector(${JSON.stringify(selector)})?.value`);
  if (typeof initial !== 'string') throw new Error('Capability search input is unavailable.');
  if (initial) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: process.platform === 'darwin' ? 4 : 2, commands: ['selectAll'] });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  }
  await client.send('Input.insertText', { text: id });
  await pause(250);
  const actual = await client.evaluate(`document.querySelector(${JSON.stringify(selector)})?.value`);
  if (actual !== id) throw new Error('Capability search query was not applied.');
  return { ...click, search_query: id, search_input_confirmed: true };
}

export async function hoverCoreExpertCard(client, selector) {
  const point = await client.evaluate(`(() => {
    const nodes = document.querySelectorAll(${JSON.stringify(selector)});
    if (nodes.length !== 1) return null;
    const node = nodes[0], r = node.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!r.width || !r.height || x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return null;
    const hit = document.elementFromPoint(x, y);
    return hit && node.contains(hit) ? { x, y } : null;
  })()`);
  if (!point) throw new Error('Expert card is not uniquely visible and unobscured.');
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, button: 'none', clickCount: 0 });
  await pause(200);
  return { physical_input: true, input_source: 'cdp-Input.dispatchMouseEvent', action: 'hover', ...point };
}

export async function resolveCoreExpertCard(client, id) {
  const card = `[data-testid=${JSON.stringify(`expert-card-${id}`)}]`;
  // Recommended cards deliberately suppress their action strip. Presence of a
  // duplicate card does not mean it exposes the same interaction as the market.
  for (const section of ['experts-market', 'experts-recommended']) {
    const selector = `[data-testid="${section}"] ${card}`;
    const actionable = await client.evaluate(`(() => {
      const cards = document.querySelectorAll(${JSON.stringify(selector)});
      if (cards.length !== 1) return false;
      const button = cards[0].querySelector('.exp-card-summon');
      const r = button?.getBoundingClientRect();
      return !!r && r.width > 0 && r.height > 0;
    })()`);
    if (actionable) return selector;
  }
  throw new Error('Requested published expert has no unique card with an available summon action.');
}

export function createCoreUseDriver(client, timeoutMs) {
  const app = createCdpAppSanityDriver(client, timeoutMs);
  let publishedExpert = null;
  const readPublishedExpert = async (fixture) => {
    const view = await client.evaluate(`window.agent.expertLifecycle.get(${JSON.stringify(fixture.id)}).then(v => ({
      id: v.id, status: v.status, versionId: v.version?.id, releaseId: v.release?.id,
      releaseStatus: v.release?.status, snapshotDigest: v.version?.snapshotDigest,
      dependencyGraphDigest: v.version?.dependencyGraphDigest }))`);
    publishedExpert = view;
    return view;
  };
  const cleanTask = async () => {
    const state = await readAppSanityState(client);
    if (state.running !== false) throw new Error('Active task is still running; refusing to hide it with a new task.');
    await dismissCoreMenus(client);
    return app.openCleanNewTask();
  };
  return {
    async inspectFixture(kind, fixture) {
      const availability = coreFixtureAvailability(kind, fixture, await readCapabilities(client));
      if (kind !== 'expert' || !availability.available) return availability;
      const view = await readPublishedExpert(fixture);
      return { available: publishedExpertResourceMatches(fixture, view),
        reason: publishedExpertResourceMatches(fixture, view) ? '' : 'published_expert_resource_not_verified',
        published_resource: view };
    },
    async prepare() {
      const workbench = await app.workbenchReady();
      return passed(workbench) ? cleanTask() : workbench;
    },
    clean: cleanTask,
    send: (input) => app.strictSend(input),
    reopen: (input) => app.reopenByTaskId(input),
    async select(kind, fixture) {
      const receipts = [];
      const click = async (testId) => {
        receipts.push(await dispatchTrustedTestIdClick(client, testId));
        await pause(250);
      };
      if (kind === 'expert') {
        if (!publishedExpertResourceMatches(fixture, publishedExpert)) await readPublishedExpert(fixture);
        if (!publishedExpertResourceMatches(fixture, publishedExpert)) throw new Error('Published expert resource is not verified.');
        const catalog = await readCapabilities(client);
        const label = fixture.label || array(catalog?.experts).find((item) => capabilityId(item) === fixture.id)?.label;
        if (!clean(label)) throw new Error('Requested expert has no readable catalog label.');
        await click('nav-experts');
        receipts.push(await searchCoreCapability(client, 'expert', label));
        const cardSelector = await resolveCoreExpertCard(client, fixture.id);
        const hover = await hoverCoreExpertCard(client, cardSelector);
        receipts.push(hover);
        const selector = `${cardSelector} .exp-card-summon`;
        const action = await client.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent?.trim()`);
        if (action !== '召唤') throw new Error('Requested expert has no published summon action.');
        receipts.push(await dispatchTrustedVisibleSelectorClick(client, selector, 'summon QA expert'));
      } else {
        const section = kind === 'mcp' ? 'connector' : 'skill';
        await click('composer-plus-menu');
        await click(`composer-plus-section-${section}`);
        const manualId = `composer-${section}-mode-manual`;
        const manual = await client.evaluate(`(() => {
          const node = document.querySelector(${JSON.stringify(`[data-testid="${manualId}"]`)});
          return node && node.getBoundingClientRect().width > 0 && node.getAttribute('aria-checked') !== 'true';
        })()`);
        if (manual) await click(manualId);
        receipts.push(await searchCoreCapability(client, kind, fixture.id));
        await click(`composer-${section}-option-${fixture.id}`);
        await dismissCoreMenus(client);
      }
      let capabilities;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        capabilities = await readCapabilities(client);
        if (selectedCapabilityMatches(kind, fixture, capabilities, publishedExpert)) break;
        await pause(250);
      }
      return { assertions: { real_selection_click: receipts.every((r) => r.physical_input === true),
        exact_capability_selected: selectedCapabilityMatches(kind, fixture, capabilities, publishedExpert) },
      detail: { id: fixture.id, receipts, selected: selectedCapabilityMatches(kind, fixture, capabilities, publishedExpert),
        ...(kind === 'expert' ? { published_resource: publishedExpert, selection_identity: capabilities.currentExpertIdentity } : {}) } };
    },
    async execution(kind, fixture, taskId) {
      const session = await client.evaluate(`Promise.race([
        window.agent.readSession(${JSON.stringify(taskId)}, 'desktop-local'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('session read timeout')), 5000))
      ])`);
      const capabilities = await readCapabilities(client);
      return coreCapabilityExecutionVerdict({ kind, fixture, taskId, session, capabilities, publishedExpert });
    },
  };
}

export async function runManagedQworkCoreSmoke({ cdpUrl, outputDir, fixtures = {}, timeoutMs,
  candidateIdentity = {}, marker = `QWORK_CORE_${Date.now()}_OK` }) {
  const targets = (await discoverWebviewProbes(cdpUrl, { timeoutMs: 10_000 }))
    .filter((probe) => probe.surface === 'teams360-qwork-qbot');
  if (targets.length !== 1) throw new Error('Core smoke requires one managed QWork WebView.');
  return withWebviewTargetClient(targets[0].targetRef, async (client) => {
    const identity = await readLightweightIdentity(client, targets[0], candidateIdentity);
    if (!identity.qwork_version) throw new Error('Core smoke requires a readable candidate version.');
    const evidence = [];
    const planFile = path.join(outputDir, 'core-use-plan.json');
    fs.writeFileSync(planFile, JSON.stringify({ modules: CORE_MODULES, marker,
      fixtures: coreFixturePlan(fixtures), fixture_sha256: hash(fixtures) }, null, 2), { flag: 'wx', mode: 0o600 });
    evidence.push(evidenceEntry(outputDir, planFile, 'execution_plan'));
    const traceFile = path.join(outputDir, 'core-use-trace.jsonl');
    fs.writeFileSync(traceFile, '', { flag: 'wx', mode: 0o600 });
    const result = await executeCoreUseSequence({ driver: createCoreUseDriver(client, timeoutMs), fixtures, marker,
      onEvidence: async (kind, phase, detail) => {
        const screenshot = path.join(outputDir, `${kind}-${phase}.png`);
        await captureClientScreenshot(client, screenshot);
        const item = evidenceEntry(outputDir, screenshot, `${kind}_${phase}_screenshot`);
        if (!item.valid) throw new Error('Invalid core-use screenshot evidence.');
        evidence.push(item);
        fs.appendFileSync(traceFile, JSON.stringify({ module: kind, phase, at: new Date().toISOString(),
          detail, screenshot: item }) + '\n');
      },
      onResult: async (entry) => {
        const file = path.join(outputDir, `${entry.module}.json`);
        fs.writeFileSync(file, JSON.stringify(entry, null, 2), { flag: 'wx', mode: 0o600 });
        evidence.push(evidenceEntry(outputDir, file, `${entry.module}_result`));
      } });
    if (fs.statSync(traceFile).size) evidence.push(evidenceEntry(outputDir, traceFile, 'action_trace'));
    if (fs.existsSync(path.join(outputDir, 'host-surface.json'))) {
      evidence.push(evidenceEntry(outputDir, path.join(outputDir, 'host-surface.json'), 'host_surface'));
    }
    let finalIdentity = null;
    let identityError = '';
    try { finalIdentity = await readLightweightIdentity(client, targets[0], candidateIdentity); }
    catch (error) { identityError = redactText(error.message); }
    const identityStable = coreIdentityStable(identity, finalIdentity);
    const report = { ...result, generated_at: new Date().toISOString(), candidate_identity: identity,
      final_identity: finalIdentity, identity_error: identityError, identity_stable: identityStable, fixture_sha256: hash(fixtures) };
    if (!identityStable) { report.status = 'failed'; report.reason = 'candidate_identity_changed'; }
    const reportFile = path.join(outputDir, 'qwork-core-smoke-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
    evidence.push(evidenceEntry(outputDir, reportFile, 'report'));
    fs.writeFileSync(path.join(outputDir, 'evidence-manifest.json'), JSON.stringify({
      schema_version: 'qbot-qwork-core-use-evidence/v1', diagnostic_only: true,
      release_gate_eligible: false, evidence_valid: evidence.every((item) => item.valid), evidence,
    }, null, 2), { flag: 'wx', mode: 0o600 });
    return report;
  });
}

// Dynamic update progress is recorded separately; the loaded candidate must remain identical.
export function coreIdentityStable(before, after) {
  if (!before || !after) return false;
  const project = (identity) => ({
    url: identity.qwork_url, target: identity.webview_target_id,
    version: identity.qwork_version, host: identity.host,
    release: identity.runtime_release?.release_id, commit: identity.runtime_release?.commit_id,
    loaded_runtime: identity.runtime_release?.loaded_runtime,
  });
  return Boolean(before.qwork_url && before.qwork_version) && hash(project(before)) === hash(project(after));
}
