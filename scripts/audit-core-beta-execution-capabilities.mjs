import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  CORE_BETA_SCENARIO_REGISTRY,
  coreBetaCaseContractSha256,
  validateCoreBetaCasePlan,
} from '../src/lib/core-beta-case-protocol.mjs';
import {
  coreBetaRuntimeExecutorBinding,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';

function option(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback;
}

function usage() {
  return `Audit Core Beta Casebook execution capabilities

Usage:
  node scripts/audit-core-beta-execution-capabilities.mjs \\
    --casebook <xlsx> \\
    --sheet <exact-name> \\
    --out <directory> \\
    [--profile mandatory] [--root <repo>] [--python <python3>]

The audit is static and does not operate QWork UI. Use core-beta:pretest for
dynamic runner, host, CDP, release-identity and fixture-controller readiness.
`;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(usage());
  process.exit(0);
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function markdownEscape(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

const root = path.resolve(option('root', process.cwd()));
const casebookOption = option('casebook');
const sheet = option('sheet');
const profile = option('profile', 'mandatory');
if (!casebookOption) throw new Error('缺少 --casebook；使用 --help 查看命令。');
if (!sheet) throw new Error('缺少 --sheet；能力审计必须绑定精确可见 Sheet。');
const casebook = path.resolve(casebookOption);
const outDir = path.resolve(option('out', path.join(root, 'outputs', 'core-beta-capability-audit')));
const python = option('python', process.env.PYTHON || 'python3');
if (!casebook || !fs.existsSync(casebook)) {
  throw new Error(`Casebook 不存在：${casebook || '(missing --casebook)'}`);
}
fs.mkdirSync(outDir, { recursive: true });
const exportedFile = path.join(outDir, 'casebook-cases.json');
const exporter = spawnSync(python, [
  path.join(root, 'skills', 'qbot-execute-automation-tests', 'scripts', 'casebook_io.py'),
  'export-cases',
  '--casebook',
  casebook,
  '--sheet',
  sheet,
  '--output',
  exportedFile,
  '--profile',
  profile,
], {
  cwd: root,
  encoding: 'utf8',
  timeout: 120_000,
});
if (exporter.status !== 0) {
  throw new Error(`Casebook 导出失败：${exporter.stderr || exporter.stdout || `exit=${exporter.status}`}`);
}

const cases = JSON.parse(fs.readFileSync(exportedFile, 'utf8')).cases || [];
const protocol = validateCoreBetaCasePlan(cases, {
  fixtureRoot: path.join(root, 'testflies'),
});
const localOptionAdapters = new Set([
  'secondary_account',
  'managed_teams_restart',
  'managed_runtime_restart',
  'native_ime_input',
  'expert_publish_fault_matrix',
]);
const rows = cases.map((testCase) => {
  const scenario = CORE_BETA_SCENARIO_REGISTRY.get(testCase.id);
  const runtimeBinding = coreBetaRuntimeExecutorBinding(testCase, scenario);
  const nativePublic = scenario?.fixture_control === 'public_product_state';
  const localOption = runtimeBinding.mode === 'native'
    && !nativePublic
    && localOptionAdapters.has(scenario?.fixture_control)
  const capabilityClass = !runtimeBinding.dispatchable
    ? 'unsupported_runtime'
    : runtimeBinding.mode === 'verified_legacy'
      ? 'runner_legacy_verified'
      : runtimeBinding.mode === 'strict_controller'
        ? 'strict_controller_required'
        : nativePublic
          ? 'runner_native'
          : localOption ? 'runner_native_with_fixture_option'
            : 'strict_controller_required';
  return {
    case_id: testCase.id,
    case_type: testCase.case_type,
    pipeline_policy: testCase.pipeline_policy,
    batch_size: Number(testCase.batch_size || 1),
    executor_route: scenario?.executor_route || '',
    driver: scenario?.driver || '',
    fixture_control: scenario?.fixture_control || '',
    legacy_case_id: scenario?.legacy_case_id || '',
    runtime_fixture: scenario?.runtime_fixture || '',
    runtime_executor_mode: runtimeBinding.mode,
    runtime_dispatchable: runtimeBinding.dispatchable,
    runtime_executor_reason: runtimeBinding.reason,
    capability_class: capabilityClass,
    directly_runnable_without_controller: nativePublic || localOption,
    local_option_required: localOption ? scenario.fixture_control : '',
    controller_contract: nativePublic || localOption
      ? 'not_required'
      : 'preflight+prepare+execute+restore; exact contract/action/evidence/oracle hashes',
    contract_sha256: coreBetaCaseContractSha256(testCase),
    action_count: Array.isArray(testCase.action_plan) ? testCase.action_plan.length : 0,
    evidence_role_count: Array.isArray(testCase.evidence_roles) ? testCase.evidence_roles.length : 0,
    hard_oracle_count: Array.isArray(testCase.precise_assertions?.hard_oracles)
      ? testCase.precise_assertions.hard_oracles.length
      : 0,
    protocol_ok: protocol.cases.find((item) => item.id === testCase.id)?.ok === true,
  };
});

const counts = rows.reduce((acc, row) => {
  acc[row.capability_class] = (acc[row.capability_class] || 0) + 1;
  acc[row.case_type] = (acc[row.case_type] || 0) + 1;
  return acc;
}, {});
const report = {
  schema_version: 'qbot-core-beta-capability-audit/v2',
  generated_at: new Date().toISOString(),
  casebook: {
    path: casebook,
    filename: path.basename(casebook),
    sha256: sha256File(casebook),
    sheet,
    profile,
  },
  protocol: {
    ok: protocol.ok,
    case_count: protocol.case_count,
    executable_count: protocol.executable_count,
    errors: protocol.errors,
    warnings: protocol.warnings,
  },
  runtime_dispatch: {
    ok: rows.every((row) => row.runtime_dispatchable),
    dispatchable_count: rows.filter((row) => row.runtime_dispatchable).length,
    unsupported_count: rows.filter((row) => !row.runtime_dispatchable).length,
    unsupported_case_ids: rows.filter((row) => !row.runtime_dispatchable).map((row) => row.case_id),
  },
  capability_summary: {
    total: rows.length,
    runner_native: counts.runner_native || 0,
    runner_native_with_fixture_option: counts.runner_native_with_fixture_option || 0,
    runner_legacy_verified: counts.runner_legacy_verified || 0,
    strict_controller_required: counts.strict_controller_required || 0,
    unsupported_runtime: counts.unsupported_runtime || 0,
    directly_runnable_without_controller: rows.filter((row) => row.directly_runnable_without_controller).length,
    fail_closed_without_required_controller: true,
  },
  cases: rows,
};
fs.writeFileSync(
  path.join(outDir, 'capability-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

const lines = [
  `# ${path.basename(casebook)} 执行能力审计`,
  '',
  `- Casebook SHA-256：\`${report.casebook.sha256}\``,
  `- 协议校验：${protocol.ok ? '通过' : '失败'}（${protocol.executable_count}/${protocol.case_count}）`,
  `- Runtime 分发闭环：${report.runtime_dispatch.ok ? '通过' : '失败'}（${report.runtime_dispatch.dispatchable_count}/${rows.length}）`,
  `- Runner 原生专项执行器：${report.capability_summary.runner_native}`,
  `- Runner 原生执行器（需明确 fixture 选项/凭证）：${report.capability_summary.runner_native_with_fixture_option}`,
  `- 经语义复核的旧执行器：${report.capability_summary.runner_legacy_verified}`,
  `- 需要严格逐 Case 控制器：${report.capability_summary.strict_controller_required}`,
  `- 未配置所需控制器时：Case 0 前 fail-closed`,
  '',
  '“需要严格逐 Case 控制器”不等于可跳过。控制器必须在 preflight 回显完整 Case contract/action/evidence/oracle 哈希，并在执行时返回逐动作时间戳、证据引用、全部硬 Oracle 结果与真实证据文件；否则该 Case 不得进入 completed。',
  '',
  '| Case | 类型 | 能力类别 | Runtime | Driver / Legacy | Fixture adapter | Pipeline | Contract SHA |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map((row) => (
    `| ${markdownEscape(row.case_id)} | ${markdownEscape(row.case_type)} | ${row.capability_class}`
    + ` | ${markdownEscape(row.runtime_executor_mode)}`
    + ` | ${markdownEscape(row.driver)}${row.legacy_case_id ? `<br>${markdownEscape(row.legacy_case_id)}` : ''}`
    + ` | ${markdownEscape(row.fixture_control)} | ${markdownEscape(row.pipeline_policy)}/${row.batch_size}`
    + ` | \`${row.contract_sha256.slice(0, 16)}…\` |`
  )),
  '',
];
fs.writeFileSync(path.join(outDir, 'capability-audit.md'), `${lines.join('\n')}\n`);
process.stdout.write(`${JSON.stringify(report.capability_summary)}\n`);
if (!protocol.ok || !report.runtime_dispatch.ok) process.exitCode = 2;
