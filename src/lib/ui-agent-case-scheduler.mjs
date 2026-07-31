export const DEFAULT_CASE_PARALLELISM = 5;

const ALWAYS_RESTART_CASES = new Set([
  'SIT-AUTH-003',
  'SIT-EXPERT-020',
  'SIT-CONN-008',
  'SIT-CONN-009',
  'SIT-CONN-013',
  'SIT-CONN-018',
]);

const LOCAL_RESTART_CASES = new Set([
  'SIT-HOME-004',
  'SIT-HOME-005',
  'SIT-HOME-006',
  'SIT-HOME-007',
  'SIT-HOME-008',
  'SIT-HOME-009',
  'SIT-HOME-025',
  'SIT-HOME-030',
  'SIT-EXPERT-015',
  'SIT-SKILL-004',
  'SIT-SKILL-005',
  'SIT-SKILL-009',
  'SIT-SKILL-010',
  'SIT-SKILL-015',
  'SIT-SKILL-018',
  'SIT-SKILL-021',
  'SIT-SKILL-022',
  'SIT-SKILL-027',
  'SIT-SKILL-028',
  'SIT-SKILL-029',
  'SIT-SKILL-030',
  'SIT-SKILL-031',
  'SIT-SKILL-032',
  'SIT-SKILL-033',
  'SIT-CONN-012',
  'SIT-CONN-014',
]);

const SHARED_STATE_PREFIXES = [
  'SIT-INIT-',
  'SIT-AUTH-',
  'SIT-EXPERT-',
  'SIT-SKILL-',
  'SIT-CONN-',
  'SIT-TEAMS-',
  'SIT-MEM-',
  'SIT-RUNTIME-',
];

const SHARED_STATE_CASES = new Set([
  'SIT-TASK-RECOVER-001',
]);

export function parseWorkerCdpUrls(value) {
  const urls = String(value || '')
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizeWorkerCdpUrl(item));
  return [...new Set(urls)];
}

function normalizeWorkerCdpUrl(value) {
  const candidate = /^\d+$/.test(value)
    ? `http://127.0.0.1:${value}`
    : value.includes('://') ? value : `http://${value}`;
  const url = new URL(candidate);
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) {
    throw new Error(`并行 worker CDP 必须为 loopback 地址：${value}`);
  }
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function requiresAppRestart(testCase, options = {}) {
  if (String(testCase?.pipeline_policy || '') === 'serial'
    && /restart|recovery|auth_recovery/i.test(`${testCase?.case_type || ''} ${testCase?.initialization_policy || ''}`)) {
    return true;
  }
  const id = String(testCase?.id || '').trim().toUpperCase();
  if (!id) return false;
  if (ALWAYS_RESTART_CASES.has(id)) return true;
  if (options['renderer-control-adapter'] === 'teams360') return false;
  return LOCAL_RESTART_CASES.has(id);
}

export function usesSharedAccountState(testCase) {
  if (String(testCase?.pipeline_policy || '') === 'serial') return true;
  const id = String(testCase?.id || '').trim().toUpperCase();
  if (!id) return true;
  return SHARED_STATE_CASES.has(id) || SHARED_STATE_PREFIXES.some((prefix) => id.startsWith(prefix));
}

export function caseExecutionLane(testCase, options = {}) {
  if (requiresAppRestart(testCase, options)) return 'restart_serial';
  const explicitPolicy = String(testCase?.pipeline_policy || '').trim();
  if (explicitPolicy === 'dispatch_collect' || explicitPolicy === 'dispatch_collect_round_robin') return 'parallel';
  if (explicitPolicy === 'serial') return 'shared_state_serial';
  if (usesSharedAccountState(testCase)) return 'shared_state_serial';
  return 'parallel';
}

export function buildCaseExecutionPlan(cases, options = {}) {
  const plan = {
    parallel: [],
    shared_state_serial: [],
    restart_serial: [],
  };
  for (let index = 0; index < (cases || []).length; index += 1) {
    const testCase = cases[index];
    const lane = caseExecutionLane(testCase, options);
    plan[lane].push({ index, testCase, lane });
  }
  return plan;
}

export function validateParallelWorkerPool({ workerCdps, parallelism = DEFAULT_CASE_PARALLELISM }) {
  const requested = Number(parallelism);
  if (!Number.isInteger(requested) || requested < 1 || requested > 20) {
    throw new Error(`--parallel 必须是 1-20 的整数，当前值：${parallelism}`);
  }
  const workers = Array.isArray(workerCdps) ? workerCdps : parseWorkerCdpUrls(workerCdps);
  if (requested > 1 && workers.length < requested) {
    throw new Error(
      `请求并行 ${requested} 条 Case，但只提供了 ${workers.length} 个独立 CDP/App。`
      + '每个并发槽必须绑定独立 QWork 页面；单个 360Teams App 不允许复用为多个 worker。',
    );
  }
  return { parallelism: requested, workers: workers.slice(0, requested) };
}

export async function executeCaseExecutionPlan({
  plan,
  workers,
  parallelism = DEFAULT_CASE_PARALLELISM,
  execute,
  onResult = async () => {},
}) {
  if (typeof execute !== 'function') throw new Error('execute callback is required.');
  const pool = validateParallelWorkerPool({ workerCdps: workers, parallelism });
  const results = [];
  let cursor = 0;
  const parallelEntries = plan?.parallel || [];

  await Promise.all(pool.workers.map(async (worker, workerIndex) => {
    while (true) {
      const position = cursor;
      cursor += 1;
      if (position >= parallelEntries.length) return;
      const entry = parallelEntries[position];
      const result = await execute({ ...entry, worker, workerIndex, phase: 'parallel' });
      results.push({ ...entry, worker, workerIndex, phase: 'parallel', result });
      await onResult({ ...entry, worker, workerIndex, phase: 'parallel', result });
    }
  }));

  const serialWorker = pool.workers[0];
  for (const entry of plan?.shared_state_serial || []) {
    const result = await execute({ ...entry, worker: serialWorker, workerIndex: 0, phase: 'shared_state_serial' });
    results.push({ ...entry, worker: serialWorker, workerIndex: 0, phase: 'shared_state_serial', result });
    await onResult({ ...entry, worker: serialWorker, workerIndex: 0, phase: 'shared_state_serial', result });
  }
  for (const entry of plan?.restart_serial || []) {
    const result = await execute({ ...entry, worker: serialWorker, workerIndex: 0, phase: 'restart_serial' });
    results.push({ ...entry, worker: serialWorker, workerIndex: 0, phase: 'restart_serial', result });
    await onResult({ ...entry, worker: serialWorker, workerIndex: 0, phase: 'restart_serial', result });
  }
  return results.sort((left, right) => left.index - right.index);
}
