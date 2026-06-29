export const FLOW_COLUMNS = [
  'flow_id',
  'linked_case_ids',
  'os',
  'mode',
  'required_tools',
  'required_env',
  'setup_steps',
  'codex_prompt_or_command',
  'ui_steps',
  'assertions',
  'evidence_paths',
  'cleanup',
  'skip_or_block_rules',
];

export function generateAutomationFlows(testCases) {
  const flows = [];
  let index = 1;
  for (const testCase of testCases) {
    const candidate = String(testCase.automation_candidate || '').toLowerCase();
    if (!candidate.includes('yes') && !candidate.includes('partial')) continue;
    for (const os of ['Windows', 'macOS']) {
      flows.push(buildFlow(testCase, os, index));
      index += 1;
    }
  }
  return flows;
}

function buildFlow(testCase, os, index) {
  const isWindows = os === 'Windows';
  const moduleSlug = testCase.module.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'GENERAL';
  const commandPrefix = isWindows ? 'PowerShell' : 'zsh/bash';
  const repoVar = isWindows ? '$env:DEEPBANK_REPO' : '$DEEPBANK_REPO';
  const baseCommands = isWindows
    ? [
        'Set-Location $env:DEEPBANK_REPO',
        'npm run check',
      ]
    : [
        'cd "$DEEPBANK_REPO"',
        'npm run check',
      ];
  const validation = chooseValidation(testCase, isWindows);
  return {
    flow_id: `QBOT-CODEX-${isWindows ? 'WIN' : 'MAC'}-${moduleSlug}-${String(index).padStart(3, '0')}`,
    linked_case_ids: testCase.case_id,
    os,
    mode: modeFor(testCase),
    required_tools: `Codex; ${commandPrefix}; Node.js 22+; npm; Docker when e2e/release path requires it`,
    required_env: 'DEEPBANK_REPO; DEEPBANK_E2E_ENV_FILE only for real-provider or release-real flows; provider secret values must not be printed',
    setup_steps: [
      `Set ${repoVar} to the Deepbank repository path.`,
      'Confirm dependencies are installed with npm install when node_modules is missing.',
      'Run repository doctor command when the selected validation path requires it.',
    ].join('\n'),
    codex_prompt_or_command: [...baseCommands, ...validation].join('\n'),
    ui_steps: uiStepsFor(testCase),
    assertions: [
      testCase.expected_result,
      'No skipped or blocked prerequisite is counted as pass.',
      'No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.',
    ].join('\n'),
    evidence_paths: evidencePathsFor(testCase),
    cleanup: isWindows
      ? 'Stop only processes started by this flow; do not delete user data outside test-results or the configured temporary DEEPBANK_HOME.'
      : 'Stop only processes started by this flow; unmount temporary DMG/app artifacts only when this flow mounted them.',
    skip_or_block_rules: testCase.blocked_by || 'If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.',
  };
}

function chooseValidation(testCase, isWindows) {
  const text = `${testCase.module} ${testCase.test_type} ${testCase.source_refs}`.toLowerCase();
  const commands = [];
  if (text.includes('ui') || text.includes('assistant') || text.includes('projects')) commands.push('npm run build:ui');
  if (text.includes('runtime') || text.includes('codex') || text.includes('skills')) {
    commands.push('npm run codex:doctor');
    commands.push('npm run codex:smoke');
  }
  if (text.includes('e2e') || text.includes('projects') || text.includes('assistant')) {
    commands.push('npm run e2e:doctor -- --scope=local');
    commands.push('npm run e2e:local');
  }
  if (text.includes('release')) commands.push(isWindows ? 'npm run build:desktop' : 'npm run e2e:release:mac');
  if (commands.length === 0) commands.push('npm run build:ui');
  return [...new Set(commands)];
}

function modeFor(testCase) {
  const text = `${testCase.test_type} ${testCase.module}`.toLowerCase();
  if (text.includes('ui') || text.includes('e2e')) return 'hybrid shell + Electron UI';
  if (text.includes('runtime')) return 'shell + Codex CLI/runtime artifacts';
  return 'shell';
}

function uiStepsFor(testCase) {
  if (!`${testCase.test_type} ${testCase.module}`.toLowerCase().includes('ui')) {
    return 'No direct UI operation unless the selected validation command launches Electron/Playwright.';
  }
  return [
    'Launch the app through the repository e2e harness or local Electron path.',
    `Exercise the UI scenario for ${testCase.submodule}.`,
    'Capture screenshot or Playwright artifact when assertion fails or when visible-state evidence is required.',
  ].join('\n');
}

function evidencePathsFor(testCase) {
  const paths = ['test-results/**'];
  const text = `${testCase.evidence_required}`.toLowerCase();
  if (text.includes('runtime') || text.includes('sdk') || text.includes('ws')) paths.push('test-results/runtime-features/**');
  if (text.includes('redaction')) paths.push('**/redaction-report.json');
  if (text.includes('screenshot')) paths.push('**/*.png');
  return [...new Set(paths)].join('; ');
}

