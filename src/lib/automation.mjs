export const FLOW_COLUMNS = [
  'flow_id',
  'linked_case_ids',
  'os',
  'automation_level',
  'execution_scope',
  'mode',
  'required_tools',
  'required_env',
  'setup_steps',
  'codex_prompt_or_command',
  'ui_steps',
  'assertions',
  'blackbox_assertions',
  'evidence_paths',
  'timeout_minutes',
  'long_running_controls',
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
  const automationLevel = testCase.automation_level_target || automationLevelFor(testCase);
  const executionScope = testCase.execution_scope || executionScopeFor(testCase);
  const baseCommands = isWindows
    ? [
        'Set-Location $env:DEEPBANK_REPO',
        'if (!(Test-Path package.json)) { throw "DEEPBANK_REPO must point to the Deepbank repository root" }',
      ]
    : [
        'cd "$DEEPBANK_REPO"',
        'test -f package.json || { echo "DEEPBANK_REPO must point to the Deepbank repository root"; exit 2; }',
      ];
  const validation = chooseValidation(testCase, automationLevel, isWindows);
  return {
    flow_id: `QBOT-CODEX-${isWindows ? 'WIN' : 'MAC'}-${moduleSlug}-${String(index).padStart(3, '0')}`,
    linked_case_ids: testCase.case_id,
    os,
    automation_level: automationLevel,
    execution_scope: executionScope,
    mode: modeFor(testCase, automationLevel),
    required_tools: requiredToolsFor(testCase, commandPrefix, automationLevel),
    required_env: requiredEnvFor(testCase, automationLevel),
    setup_steps: [
      `Set ${repoVar} to the Deepbank repository path.`,
      'Use an isolated DEEPBANK_TEST_HOME or temporary app data directory when the repository supports it.',
      'Confirm dependencies are installed with npm install when node_modules is missing; record install failure as blocked, not pass.',
      'Do not print secret values; only print env variable names and redacted diagnostics.',
    ].join('\n'),
    codex_prompt_or_command: [...baseCommands, ...validation].join('\n'),
    ui_steps: uiStepsFor(testCase, automationLevel),
    assertions: [
      testCase.expected_result,
      'No skipped or blocked prerequisite is counted as pass.',
      'No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.',
      'Every required evidence path exists, or the flow records a concrete blocked/not-run reason.',
    ].join('\n'),
    blackbox_assertions: blackboxAssertionsFor(testCase),
    evidence_paths: evidencePathsFor(testCase),
    timeout_minutes: timeoutFor(testCase, automationLevel),
    long_running_controls: longRunningControlsFor(testCase, automationLevel),
    cleanup: isWindows
      ? 'Stop only processes started by this flow; do not delete user data outside test-results or the configured temporary DEEPBANK_TEST_HOME.'
      : 'Stop only processes started by this flow; unmount temporary DMG/app artifacts only when this flow mounted them; do not delete user data outside test-results or temporary DEEPBANK_TEST_HOME.',
    skip_or_block_rules: skipOrBlockRulesFor(testCase, automationLevel),
  };
}

function chooseValidation(testCase, automationLevel, isWindows) {
  const commands = new Set(['npm run check']);
  for (const command of splitCommands(testCase.validation_commands)) {
    if (commandAllowedForLevel(command, automationLevel, isWindows)) commands.add(command);
  }
  const text = [
    testCase.module,
    testCase.test_type,
    testCase.source_refs,
    testCase.submodule,
    testCase.evidence_required,
    testCase.expected_result,
    testCase.validation_commands,
  ].join(' ').toLowerCase();
  const isUiAudit = /uiux|ui\/ux|visual|screenshot|ordinary user|assistant|chat-area|quick feedback/.test(text);
  const isRuntime = /runtime|codex|claude|skills?|mcp|provider|llm|protocol|sdk|ws/.test(text);
  const isCodexProductPath = /codex|openai|responses/.test(text);
  const isClaudeProductPath = /claude|anthropic/.test(text);
  if (automationLevel === 'A0') {
    commands.add('npm run build:ui');
    commands.add('npm run e2e:doctor -- --scope=local');
    commands.add('npm run e2e:local');
    if (isUiAudit) commands.add('npm run uiux:audit -- --scope=local');
  }
  if (automationLevel === 'A1') {
    if (isRuntime) {
      commands.add('npm run runtime-features:doctor');
      commands.add('npm run runtime-features:test -- --tier=fixture');
    }
    if (isUiAudit) {
      commands.add('npm run e2e:doctor -- --scope=local');
      commands.add('npm run uiux:audit -- --scope=local');
    }
  }
  if (automationLevel === 'A2') {
    if (isRuntime) commands.add('npm run runtime-features:test:real');
    if (isCodexProductPath) commands.add(isUiAudit ? 'npm run e2e:qbot:codex:real -- --uiux-audit' : 'npm run e2e:qbot:codex:real');
    if (isClaudeProductPath) commands.add('npm run e2e:qbot:claude-code:real');
    if (/assistant|projects?|ui|workspace|gitlab|lingxi|oauth/.test(text)) commands.add('npm run e2e:local:real');
  }
  if (automationLevel === 'A3') {
    commands.add(isWindows
      ? 'npm run release:prepare -- --channel=stable --env dev --platform=win'
      : 'npm run release:prepare -- --channel=stable --env dev');
    commands.add(isWindows
      ? 'npm run release:build -- --channel=stable --env dev --platform=win'
      : 'npm run release:build -- --channel=stable --env dev');
    commands.add(isWindows
      ? 'npm run release:verify -- --channel=stable --env dev --platform=win'
      : 'npm run release:verify -- --channel=stable --env dev');
    if (!isWindows) {
      commands.add('npm run build:desktop');
      commands.add(isUiAudit ? 'npm run e2e:release:mac -- --uiux-audit' : 'npm run e2e:release:mac');
    }
    if (text.includes('remote') || text.includes('uat')) commands.add('npm run e2e:remote-dev');
  }
  if (commands.size === 1) commands.add('npm run build:ui');
  return [...commands];
}

function commandAllowedForLevel(command, automationLevel, isWindows) {
  const normalized = String(command || '').trim();
  if (!normalized) return false;
  if (isWindows && /npm\s+run\s+e2e:release:mac\b/.test(normalized)) return false;
  if (!isWindows && /--platform=win\b|--platform\s+win\b/.test(normalized)) return false;
  const releaseOnly = /npm\s+run\s+(?:build:desktop|dist:desktop|e2e:release:[A-Za-z0-9:_-]+|e2e:remote-dev|release:[A-Za-z0-9:_-]+)/.test(normalized);
  if (releaseOnly) return automationLevel === 'A3';
  const realOnly = /npm\s+run\s+(?:e2e:local:real|e2e:codex-openai-real|e2e:qbot:[A-Za-z0-9:_-]+:real|runtime-features:test:real|codex:doctor|codex:smoke|claude:doctor|claude:smoke)/.test(normalized);
  if (realOnly) return ['A2', 'A3'].includes(automationLevel);
  return true;
}

function splitCommands(value) {
  return String(value || '')
    .split(/\s+&&\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function modeFor(testCase, automationLevel) {
  const text = `${testCase.test_type} ${testCase.module}`.toLowerCase();
  if (automationLevel === 'A3') return 'hybrid shell + desktop release/e2e';
  if (automationLevel === 'A0') return 'Electron UI smoke + shell';
  if (text.includes('ui') || text.includes('e2e')) return 'hybrid shell + Electron UI';
  if (text.includes('runtime')) return 'shell + Codex CLI/runtime artifacts';
  return 'shell';
}

function uiStepsFor(testCase, automationLevel) {
  const text = `${testCase.test_type} ${testCase.module} ${testCase.user_persona}`.toLowerCase();
  if (!text.includes('ui') && !text.includes('ordinary user') && automationLevel !== 'A0') {
    return 'No direct UI operation unless the selected validation command launches Electron/Playwright.';
  }
  return [
    'Launch the app through the repository e2e harness or local Electron path.',
    `Exercise the visible product scenario for ${testCase.submodule}.`,
    'Use only product-facing controls and labels available to the target persona.',
    'Capture screenshot or Playwright artifact for the relevant visible state, not only terminal output.',
  ].join('\n');
}

function evidencePathsFor(testCase) {
  const paths = ['test-results/**'];
  const text = `${testCase.evidence_required}`.toLowerCase();
  if (text.includes('runtime') || text.includes('sdk') || text.includes('ws')) paths.push('test-results/runtime-features/**');
  if (text.includes('redaction')) paths.push('**/redaction-report.json');
  if (text.includes('screenshot')) paths.push('**/*.png');
  if (text.includes('api')) paths.push('test-results/**/*.json');
  return [...new Set(paths)].join('; ');
}

function automationLevelFor(testCase) {
  const text = `${testCase.regression_layer} ${testCase.execution_scope} ${testCase.test_type} ${testCase.module}`.toLowerCase();
  if (text.includes('release') || text.includes('windows') || text.includes('macos') || text.includes('e2e / release')) return 'A3';
  if (text.includes('real_dependency') || text.includes('security') || text.includes('compliance')) return 'A2';
  if (text.includes('s0') && (text.includes('ui') || text.includes('assistant') || text.includes('projects'))) return 'A0';
  return 'A1';
}

function executionScopeFor(testCase) {
  return testCase.blocked_by ? 'blocked_dependency' : 'local_mock_or_fixture';
}

function requiredToolsFor(testCase, commandPrefix, automationLevel) {
  const tools = new Set(['Codex', commandPrefix, 'Node.js 22+', 'npm']);
  const text = `${testCase.test_type} ${testCase.module} ${testCase.validation_commands}`.toLowerCase();
  if (text.includes('e2e') || automationLevel === 'A0' || automationLevel === 'A3') tools.add('Playwright/Electron harness');
  if (text.includes('docker') || automationLevel === 'A3') tools.add('Docker when repository doctor requires it');
  if (automationLevel === 'A3') tools.add('desktop build toolchain for the target OS');
  return [...tools].join('; ');
}

function requiredEnvFor(testCase, automationLevel) {
  const env = new Set(['DEEPBANK_REPO', 'DEEPBANK_TEST_HOME']);
  const text = [
    testCase.module,
    testCase.submodule,
    testCase.execution_scope,
    testCase.validation_commands,
  ].join(' ').toLowerCase();
  if (automationLevel === 'A2') env.add('DEEPBANK_E2E_ENV_FILE');
  const requiresExternalEnv = ['A2', 'A3'].includes(automationLevel);
  if (requiresExternalEnv && (text.includes('gitlab') || text.includes('projects'))) env.add('GITLAB_TOKEN');
  if (requiresExternalEnv && (text.includes('lingxi') || text.includes('oauth'))) {
    env.add('DEEPBANK_E2E_LINGXI_USERNAME');
    env.add('DEEPBANK_E2E_LINGXI_PASSWORD');
  }
  if (requiresExternalEnv && (text.includes('claude') || text.includes('anthropic') || text.includes('llm') || text.includes('provider') || text.includes('runtime'))) {
    env.add('ANTHROPIC_BASE_URL');
    env.add('ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN');
    env.add('ANTHROPIC_MODEL');
  }
  if (requiresExternalEnv && text.includes('codex')) {
    env.add('CODEX_HOME');
    env.add('CODEX_PROFILE');
  }
  if (requiresExternalEnv && (text.includes('remote-dev') || text.includes('remote dev'))) {
    env.add('DEEPBANK_REMOTE_DEV_URL');
    env.add('DEEPBANK_REMOTE_DEV_RUNTIME_URL');
    env.add('DEEPBANK_REMOTE_DEV_RUNTIME_TOKEN');
  }
  if (automationLevel === 'A3' && text.includes('win') && /distribution|signing|签名|external/.test(text)) {
    env.add('WIN_CSC_LINK or CSC_LINK');
    env.add('WIN_CSC_KEY_PASSWORD or CSC_KEY_PASSWORD');
  }
  return [...env].join('; ');
}

function blackboxAssertionsFor(testCase) {
  if (String(testCase.user_persona || '').startsWith('QBot ordinary')) {
    return [
      testCase.blackbox_gate,
      'Fail the flow if ordinary-user screens require selecting model/provider/runtime, editing baseURL/env keys, running MCP commands, or choosing Codex vs Claude Code.',
      'Fail the flow if raw protocol, secret path, provider token, or implementation stack is shown as normal task guidance.',
    ].join('\n');
  }
  return [
    testCase.blackbox_gate,
    'Admin/operator diagnostics may name technical concepts, but secret values must be redacted and ordinary-user task screens must remain product-facing.',
  ].join('\n');
}

function timeoutFor(testCase, automationLevel) {
  if (automationLevel === 'A3') return '90';
  if (automationLevel === 'A2') return '60';
  if (`${testCase.test_type} ${testCase.submodule}`.toLowerCase().includes('e2e')) return '45';
  return '30';
}

function longRunningControlsFor(testCase, automationLevel) {
  const controls = [
    'Poll process/test status at least every 30 seconds.',
    'Persist stdout/stderr and UI artifacts before timeout.',
    'On timeout, mark blocked/failed with last visible state; never report pass from partial evidence.',
  ];
  if (automationLevel === 'A3') controls.push('For release artifacts, verify package existence and launch result before cleanup.');
  if (`${testCase.module} ${testCase.submodule}`.toLowerCase().includes('assistant')) controls.push('Verify the assistant turn reaches a terminal done/failed/blocked state and does not hang.');
  return controls.join('\n');
}

function skipOrBlockRulesFor(testCase, automationLevel) {
  const rules = [];
  if (testCase.blocked_by) rules.push(`Blocked until resolved: ${testCase.blocked_by}`);
  if (automationLevel === 'A2') rules.push('If real Lingxi/GitLab/SkillHub/LLM/MCP credentials or endpoints are unavailable, mark blocked/not-run with missing env names only.');
  if (automationLevel === 'A3') rules.push('If target OS, signing/build toolchain, release artifact, Docker, or remote-dev environment is unavailable, mark blocked/not-run.');
  rules.push('Missing prerequisites, skipped commands, or partial artifact capture must not be counted as pass.');
  return rules.join('\n');
}
