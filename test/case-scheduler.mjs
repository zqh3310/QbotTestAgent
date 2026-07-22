import assert from 'node:assert/strict';
import {
  buildCaseExecutionPlan,
  caseExecutionLane,
  executeCaseExecutionPlan,
  parseWorkerCdpUrls,
  requiresAppRestart,
  validateParallelWorkerPool,
} from '../src/lib/ui-agent-case-scheduler.mjs';

const workers = parseWorkerCdpUrls('9401, http://127.0.0.1:9402,localhost:9403,9404,9405,9405');
assert.deepEqual(workers, [
  'http://127.0.0.1:9401',
  'http://127.0.0.1:9402',
  'http://localhost:9403',
  'http://127.0.0.1:9404',
  'http://127.0.0.1:9405',
]);
assert.throws(() => parseWorkerCdpUrls('http://10.0.0.8:9401'), /loopback/);
assert.throws(
  () => validateParallelWorkerPool({ workerCdps: workers.slice(0, 1), parallelism: 5 }),
  /只提供了 1 个独立 CDP\/App/,
);

const cases = [
  { id: 'SIT-HOME-016' },
  { id: 'SIT-ART-017' },
  { id: 'SIT-SKILL-002' },
  { id: 'SIT-CONN-008' },
  { id: 'SIT-HOME-031' },
  { id: 'SIT-HOME-032' },
  { id: 'SIT-HOME-033' },
];
const plan = buildCaseExecutionPlan(cases, { 'renderer-control-adapter': 'teams360' });
assert.deepEqual(plan.parallel.map((entry) => entry.testCase.id), [
  'SIT-HOME-016',
  'SIT-ART-017',
  'SIT-HOME-031',
  'SIT-HOME-032',
  'SIT-HOME-033',
]);
assert.deepEqual(plan.shared_state_serial.map((entry) => entry.testCase.id), ['SIT-SKILL-002']);
assert.deepEqual(plan.restart_serial.map((entry) => entry.testCase.id), ['SIT-CONN-008']);
assert.equal(requiresAppRestart({ id: 'SIT-SKILL-027' }, { 'renderer-control-adapter': 'teams360' }), false);
assert.equal(requiresAppRestart({ id: 'SIT-SKILL-027' }, {}), true);
assert.equal(caseExecutionLane({ id: 'SIT-SKILL-027' }, { 'renderer-control-adapter': 'teams360' }), 'shared_state_serial');

let active = 0;
let maxActive = 0;
const completedPhases = [];
const executed = await executeCaseExecutionPlan({
  plan,
  workers,
  parallelism: 5,
  execute: async ({ testCase, phase }) => {
    if (phase !== 'parallel') assert.equal(active, 0, `${phase} started before the parallel phase drained`);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, phase === 'parallel' ? 15 : 1));
    active -= 1;
    completedPhases.push(phase);
    return { id: testCase.id, phase };
  },
});
assert.equal(maxActive, 5);
assert.deepEqual(executed.map((entry) => entry.result.id), cases.map((item) => item.id));
assert.ok(completedPhases.indexOf('shared_state_serial') > completedPhases.lastIndexOf('parallel'));
assert.ok(completedPhases.indexOf('restart_serial') > completedPhases.indexOf('shared_state_serial'));

console.log('case scheduler ok');
