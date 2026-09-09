import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  APP_SANITY_PASS,
  APP_SANITY_STEP_IDS,
  APP_SANITY_STOP,
  dispatchTrustedTestIdClick,
  dispatchTrustedVisibleSelectorClick,
  exactAppSanityReplyMatches,
  executeAppSanitySequence,
  QWORK_APP_SANITY_ASSISTANT_BODY_SELECTOR,
  QWORK_APP_SANITY_SCHEMA,
  resolveAppSanityAssistantBody,
} from '../lib/qwork-app-sanity.mjs';
import { parseArgs } from '../lib/config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEAMS_ROOT = path.resolve(HERE, '..');

function passed(detail = {}) {
  return { assertions: { reached: true }, detail };
}

function fakeDriver(overrides = {}) {
  const calls = [];
  const driver = {
    calls,
    async workbenchReady() { calls.push('workbench_ready'); return passed(); },
    async openCleanNewTask() { calls.push('clean_new_task'); return passed(); },
    async strictSend() {
      calls.push('strict_send_exact_reply');
      return passed({ task_id: 'task-123', strict_send_receipt: { click_count: 1, retry_count: 0 } });
    },
    async reopenByTaskId({ taskId }) {
      calls.push(`reopen_by_task_id:${taskId}`);
      return passed({ active_task_id: taskId });
    },
    async openExpertsPage() { calls.push('experts_page'); return passed(); },
    async openSkillsPage() { calls.push('skills_page'); return passed(); },
    async openConnectorsPage() { calls.push('connectors_page'); return passed(); },
    async openAutomationsPage() { calls.push('automations_page'); return passed(); },
    ...overrides,
  };
  return driver;
}

test('App sanity uses an exact reply and a fixed non-release step order', async () => {
  const driver = fakeDriver();
  const recorded = [];
  const result = await executeAppSanitySequence({
    driver,
    prompt: 'reply exactly',
    expected: 'EXACT_OK',
    onStep: async (step) => recorded.push(step.step_id),
  });

  assert.equal(QWORK_APP_SANITY_SCHEMA, 'qbot-qwork-app-sanity/v1');
  assert.equal(result.status, 'passed');
  assert.equal(result.decision, APP_SANITY_PASS);
  assert.equal(result.diagnostic_only, true);
  assert.equal(result.release_gate_eligible, false);
  assert.equal(result.task_id, 'task-123');
  assert.deepEqual(recorded, APP_SANITY_STEP_IDS);
  assert.deepEqual(result.steps.map((step) => step.step_id), APP_SANITY_STEP_IDS);
  assert.equal(driver.calls.filter((entry) => entry === 'strict_send_exact_reply').length, 1);
  assert.equal(driver.calls.includes('reopen_by_task_id:task-123'), true);
});

test('App sanity stops before G0 and safely returns to a clean task after a failed assertion', async () => {
  let cleanCalls = 0;
  const driver = fakeDriver({
    async openCleanNewTask() { cleanCalls += 1; return passed(); },
    async strictSend() {
      return {
        assertions: { one_real_click: true, exact_reply: false },
        detail: { task_id: 'task-failed' },
      };
    },
  });
  const result = await executeAppSanitySequence({ driver, prompt: 'x', expected: 'EXPECTED' });

  assert.equal(result.status, 'failed');
  assert.equal(result.decision, APP_SANITY_STOP);
  assert.equal(result.release_gate_eligible, false);
  assert.equal(result.stopped_at, 'strict_send_exact_reply');
  assert.deepEqual(result.steps.find((step) => step.step_id === 'strict_send_exact_reply')?.assertions, {
    one_real_click: true,
    exact_reply: false,
  });
  assert.equal(cleanCalls, 2);
  assert.equal(result.steps.at(-1).step_id, 'return_clean_new_task');
  assert.equal(result.steps.at(-1).status, 'passed');
});

test('App sanity exact reply matcher rejects prefixes, suffixes and blank expectations', () => {
  assert.equal(exactAppSanityReplyMatches('EXACT_OK', 'EXACT_OK'), true);
  assert.equal(exactAppSanityReplyMatches('prefix EXACT_OK', 'EXACT_OK'), false);
  assert.equal(exactAppSanityReplyMatches('EXACT_OK suffix', 'EXACT_OK'), false);
  assert.equal(exactAppSanityReplyMatches('', ''), false);
});

test('App sanity reads the explicit assistant body instead of the QWork identity header', () => {
  assert.equal(QWORK_APP_SANITY_ASSISTANT_BODY_SELECTOR, '.aui-assistant-message-content');
  const reply = resolveAppSanityAssistantBody({
    assistantRootTexts: ['QWork', 'QWork'],
    assistantBodyTexts: ['QWORK_APP_CORE_20260909123835_OK'],
  });
  assert.equal(reply, 'QWORK_APP_CORE_20260909123835_OK');
  assert.equal(exactAppSanityReplyMatches(reply, 'QWORK_APP_CORE_20260909123835_OK'), true);
  assert.notEqual(reply, 'QWork');
});

test('App sanity CLI requires explicit mutation consent and generates a unique exact marker', () => {
  const safe = parseArgs(['app-sanity']);
  const enabled = parseArgs(['app-sanity', '--allow-write']);
  assert.equal(safe.allowWrite, false);
  assert.equal(enabled.allowWrite, true);
  assert.match(enabled.expected, /^QWORK_APP_SANITY_\d{14}_OK$/);
  assert.match(enabled.prompt, new RegExp(enabled.expected));
  assert.match(enabled.outputDir, /teams360-automation\/output\/\d{14}-app-sanity$/);
});

test('App sanity strict send dispatches exactly one trusted CDP click', async () => {
  const commands = [];
  const client = {
    async evaluate() {
      return {
        visible: true,
        test_id: 'composer-send',
        x: 12,
        y: 24,
        width: 20,
        height: 20,
      };
    },
    async send(method, params) {
      commands.push({ method, params });
    },
  };
  const receipt = await dispatchTrustedTestIdClick(client, 'composer-send');
  assert.equal(receipt.input_source, 'cdp-Input.dispatchMouseEvent');
  assert.equal(receipt.physical_input, true);
  assert.equal(receipt.click_count, 1);
  assert.equal(receipt.press_count, 1);
  assert.equal(receipt.release_count, 1);
  assert.deepEqual(commands.map((entry) => entry.params.type), [
    'mouseMoved',
    'mousePressed',
    'mouseReleased',
  ]);
  assert.equal(commands.filter((entry) => entry.params.type === 'mousePressed').length, 1);
  assert.equal(commands.filter((entry) => entry.params.type === 'mouseReleased').length, 1);
});

test('App sanity trusted clicks fail closed unless one visible enabled element resolves', async () => {
  let sends = 0;
  const client = {
    async evaluate() { return { visible: false, match_count: 2 }; },
    async send() { sends += 1; },
  };
  await assert.rejects(
    dispatchTrustedVisibleSelectorClick(client, '[data-testid="nav-new-task"]', 'new task'),
    /exactly one visible, enabled, unobscured in-viewport control/u,
  );
  assert.equal(sends, 0);
});

test('App sanity trusted clicks dispatch nothing for an obscured or out-of-viewport target', async () => {
  for (const control of [
    { visible: false, match_count: 1, within_viewport: true, hit_target: false, x: 12, y: 24 },
    { visible: false, match_count: 1, within_viewport: false, hit_target: false, x: -1, y: 24 },
  ]) {
    let sends = 0;
    const client = {
      async evaluate() { return control; },
      async send() { sends += 1; },
    };
    await assert.rejects(
      dispatchTrustedVisibleSelectorClick(client, '[data-testid="nav-experts"]', 'experts'),
      /unobscured in-viewport control/u,
    );
    assert.equal(sends, 0);
  }
});

test('App sanity implementation contains no catalog mutation, install or destructive session action', () => {
  const source = fs.readFileSync(path.join(TEAMS_ROOT, 'lib', 'qwork-app-sanity.mjs'), 'utf8');
  assert.doesNotMatch(source, /\.(?:installSkill|uninstallSkill|updateSkill|revertSkill|refreshSkillsCatalog|refreshConnector|deleteSession|deleteWorkspace|runtimeUpdateCheck)\s*\(/u);
  assert.match(source, /Input\.dispatchMouseEvent/u);
  assert.doesNotMatch(source, /\.click\(\)/u);
  assert.match(source, /controls\.length !== 1/u);
  assert.match(source, /visibleExactText\('\[role="tab"\]\[aria-selected="true"\]', '\\u4e13\\u5bb6'\)/u);
  assert.match(source, /intermediate_clean_new_task:\s*allAssertionsPass/u);
  assert.match(source, /intermediate_new_task:\s*intermediateNewTask\?\.detail/u);
  assert.match(source, /assertionError\.assertions\s*=\s*assertions/u);
  assert.match(source, /nonReportEvidenceValid/u);
  assert.doesNotMatch(source, /if \(!manifest\.evidence_valid\)[\s\S]*writeFileSync\(reportFile/u);
  assert.match(source, /document\.elementFromPoint\(x, y\)/u);
  assert.match(source, /x < innerWidth && y < innerHeight/u);
  assert.match(source, /click_count:\s*1/u);
  assert.match(source, /retry_count:\s*0/u);
  assert.match(source, /release_gate_eligible:\s*false/u);
  assert.match(source, /capabilities_record_only:\s*true/u);
  assert.match(source, /capabilities_blocks_app_sanity:\s*false/u);
  assert.doesNotMatch(source, /if \(!capabilities\.ok \|\| !runtime\.ok\)/u);
});
