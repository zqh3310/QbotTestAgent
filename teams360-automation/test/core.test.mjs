import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  LIVE_PROFILE_ALIAS,
  PROJECT_ROOT,
  assertIsolatedProfile,
  normalizeCdpUrl,
  parseArgs,
  redactText,
  safeUrl,
  validatePinnedQworkUiUrl,
} from '../lib/config.mjs';
import {
  clearStaleChromiumSingletonLinks,
  ensureProfileAlias,
  managedQbotLaunchArgs,
  managedTeamsEnvironment,
  managedTeamsProcessLog,
  matchesRelaunchedLiveSession,
  parseRunningTeamsMainProcesses,
} from '../lib/launcher.mjs';
import { isFullQbotProbe, scoreTargetProbe, selectBestTarget } from '../lib/targets.mjs';
import { sanitize } from '../lib/report.mjs';
import { qworkRuntimeBridgeSource, rewriteCdpPayload } from '../lib/cdp-webview-proxy.mjs';
import { pathInside, validateStrictReviewOverride } from '../lib/review-evidence.mjs';
import {
  assertRunMetadataHost,
  buildReleaseArtifactFingerprints,
  readMacAppBundleIdentity,
  writePinnedRunMetadata,
} from '../lib/run-metadata.mjs';
import { loadTrustedValidationSources } from '../lib/trusted-history.mjs';
import {
  applyManagedQbotProfileConfig,
  stagedQbotServer,
} from '../lib/teams-profile-qbot-config.mjs';
import {
  configureTeamsFixtureRuntime,
  installTeamsPageGuards,
  parseCasebookRunnerOptions,
  repairInterruptedTeamsProgress,
  validateLiveCasebookSession,
  validateTeamsCasebookOptions,
} from '../lib/casebook-runner.mjs';
import {
  automationFixtureMarkerPattern,
  cleanSkillChipLabel,
  createTeamsSkillFixtureController,
} from '../../src/lib/ui-agent-casebook-runner.mjs';

test('defaults stay inside the independent teams360 automation directory', () => {
  const options = parseArgs(['doctor']);
  assert.match(options.profileDir, /teams360-automation\/state\/profile$/);
  assert.match(options.outputDir, /teams360-automation\/output\//);
  assert.equal(options.openQbot, false);
  assert.equal(options.allowWrite, false);
});

test('launch-live uses the existing profile without accepting an override', () => {
  const options = parseArgs(['launch-live']);
  assert.equal(options.profileMode, 'live');
  assert.match(options.profileDir, /Library\/Application Support\/360Teams$/);
  assert.equal(options.profileAlias, LIVE_PROFILE_ALIAS);
  assert.throws(() => parseArgs(['launch-live', '--profile', '/tmp/other']), /not allowed/);
});

test('launch-live carries an explicit credential-free QBot control plane', () => {
  const url = 'https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net';
  const options = parseArgs(['launch-live', '--control-plane-url', url]);
  assert.equal(options.controlPlaneUrl, url);
  assert.deepEqual(options.environment, { DEEPBANK_SERVER: url });
  assert.throws(
    () => parseArgs(['launch-live', '--control-plane-url', 'https://user:secret@example.test']),
    /credential-free/,
  );
});

test('relative output paths resolve from the QbotTestAgent root', () => {
  const options = parseArgs(['doctor', '--out', 'teams360-automation/output/example']);
  assert.equal(options.outputDir, path.join(PROJECT_ROOT, 'teams360-automation', 'output', 'example'));
});

test('managed QWork relaunch accepts only a ready versioned UI inside the runtime home', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-qwork-ui-'));
  const versionDir = path.join(root, 'ui', '0.0.6');
  fs.mkdirSync(versionDir, { recursive: true });
  fs.writeFileSync(path.join(versionDir, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(versionDir, '.installed.json'), JSON.stringify({ status: 'ready', version: '0.0.6' }));
  try {
    const pinned = validatePinnedQworkUiUrl(`file://${path.join(versionDir, 'index.html')}`, { runtimeHome: root });
    assert.equal(pinned.version, '0.0.6');
    assert.throws(
      () => validatePinnedQworkUiUrl('https://example.test/index.html', { runtimeHome: root }),
      /local file URL/,
    );
    assert.throws(
      () => validatePinnedQworkUiUrl('file:///tmp/index.html', { runtimeHome: root }),
      /must stay under/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('managed QWork recognizes release-isolated dev runtime homes across target discovery and relaunch', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-qwork-release-home-'));
  const versionDir = path.join(home, '.deepbank-dev', 'ui', '0.0.11');
  fs.mkdirSync(versionDir, { recursive: true });
  fs.writeFileSync(path.join(versionDir, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(versionDir, '.installed.json'), JSON.stringify({ status: 'ready', version: '0.0.11' }));
  try {
    const pinned = validatePinnedQworkUiUrl(`file://${path.join(versionDir, 'index.html')}`, { homeDir: home });
    assert.equal(pinned.version, '0.0.11');
    for (const file of [
      '../lib/cdp-webview.mjs',
      '../lib/cdp-webview-proxy.mjs',
      '../lib/casebook-runner.mjs',
      '../lib/relaunch-managed-host.mjs',
    ]) {
      const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.match(source, /deepbank.*dev.*local.*uat/s);
    }
    const restart = fs.readFileSync(new URL('../runtime/scripts/restart-qbot-electron-control-plane.sh', import.meta.url), 'utf8');
    assert.match(restart, /deepbank\(-dev\|-local\|-uat\)\?/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the live 360Teams profile is rejected', () => {
  const live = path.join(os.homedir(), 'Library', 'Application Support', '360Teams');
  assert.throws(() => assertIsolatedProfile(live), /live 360Teams profile/);
  assert.throws(() => assertIsolatedProfile(path.join(live, 'automation')), /live 360Teams profile/);
});

test('an isolated profile symlink cannot escape into the live profile', {
  skip: !fs.existsSync(path.join(os.homedir(), 'Library', 'Application Support', '360Teams')),
}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-profile-guard-'));
  const alias = path.join(root, 'profile');
  fs.symlinkSync(path.join(os.homedir(), 'Library', 'Application Support', '360Teams'), alias, 'dir');
  try {
    assert.throws(() => assertIsolatedProfile(alias), /live 360Teams profile/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the live launcher owns and verifies its profile alias', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-live-alias-'));
  const profile = path.join(root, 'live');
  const alias = path.join(root, 'state', 'live-profile-alias');
  fs.mkdirSync(profile, { recursive: true });
  try {
    assert.equal(ensureProfileAlias({ profileDir: profile, aliasPath: alias }), alias);
    assert.equal(fs.realpathSync.native(alias), fs.realpathSync.native(profile));
    assert.equal(ensureProfileAlias({ profileDir: profile, aliasPath: alias }), alias);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stale Chromium singleton recovery removes symlinks only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-singleton-'));
  try {
    for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
      fs.symlinkSync(`stale-${name}`, path.join(root, name));
    }
    const removed = clearStaleChromiumSingletonLinks(root);
    assert.equal(removed.length, 3);
    assert.equal(fs.existsSync(path.join(root, 'SingletonLock')), false);
    fs.writeFileSync(path.join(root, 'SingletonLock'), 'unexpected');
    assert.throws(
      () => clearStaleChromiumSingletonLinks(root),
      /Refusing to remove non-symlink Chromium singleton entry/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('managed Teams child enables packaged QBot E2E bridges without mutating the parent', () => {
  const parent = { PATH: '/qa/bin', DEEPBANK_E2E: '0' };
  const child = managedTeamsEnvironment(parent);
  assert.equal(child.DEEPBANK_E2E, '1');
  assert.equal(child.PATH, '/qa/bin');
  assert.equal(parent.DEEPBANK_E2E, '0');
});

test('managed Teams child log stays beside the private session file', () => {
  const sessionFile = path.join('/tmp', 'qbot-teams-test', 'session.json');
  assert.equal(managedTeamsProcessLog(sessionFile), path.join('/tmp', 'qbot-teams-test', 'managed-360teams.log'));
});

test('CDP is restricted to loopback', () => {
  assert.equal(normalizeCdpUrl('9333'), 'http://127.0.0.1:9333');
  assert.equal(normalizeCdpUrl('http://localhost:9333/json/version'), 'http://localhost:9333');
  assert.throws(() => normalizeCdpUrl('http://10.0.0.8:9333'), /loopback/);
});

test('QBot runtime markers outrank generic Teams pages', () => {
  const generic = { url: 'https://im.360teams.com', title: '360Teams', markers: { teamsText: true } };
  const qbot = { url: 'file:///tmp/ui/index.html', title: 'QBot', surface: 'teams360', markers: { composer: true } };
  assert.ok(scoreTargetProbe(qbot) > scoreTargetProbe(generic));
  assert.equal(selectBestTarget([generic, qbot]).surface, 'teams360');
});

test('360Teams QR login is a host precondition, not a QBot target', () => {
  const login = { url: 'file:///teams/login.html', title: '360Teams', markers: { teamsHostLogin: true, teamsText: true } };
  assert.equal(scoreTargetProbe(login), 0);
});

test('360Teams copilot sender is only an entry, not a full QBot target', () => {
  const sender = {
    url: 'https://im.360teams.com/miniapps/deepbank/home/copilotSender',
    title: '360Teams',
    markers: { teamsQbotSender: true, composer: true },
  };
  assert.equal(isFullQbotProbe(sender), false);
});

test('the DeepBank quick chat WebView is not the full QWork QBot target', () => {
  const chat = {
    target_type: 'webview',
    url: 'https://im.360teams.com/miniapps/deepbank/home/chat/session-id',
    title: 'DeepBank',
    markers: { teamsQbotChat: true, composer: true },
  };
  assert.equal(isFullQbotProbe(chat), false);
});

test('only a bridged QWork QBot workbench is a full target', () => {
  const workbench = {
    target_type: 'webview',
    url: 'file:///Users/test/.deepbank/ui/0.0.4/index.html',
    title: 'qbot',
    surface: 'teams360-qwork-qbot',
    markers: { qbotLocalUi: true, qbotBridgeReady: true, qbotWorkbench: true, composer: true },
  };
  assert.equal(isFullQbotProbe(workbench), true);
  assert.ok(scoreTargetProbe(workbench) >= 300);
});

test('reports and URLs redact credentials', () => {
  const secret = 'https://example.test/qbot?app_secret=abc123&access_token=def456';
  assert.equal(safeUrl(secret), 'https://example.test/qbot');
  const redacted = redactText('Bearer abc.def access_token=xyz app_secret=123');
  assert.doesNotMatch(redacted, /abc\.def|xyz|123/);
  const clean = sanitize({ nested: { value: secret }, bearer: 'Bearer token-value' });
  assert.doesNotMatch(JSON.stringify(clean), /abc123|def456|token-value/);
});

test('smoke write permission must be explicit', () => {
  const safe = parseArgs(['smoke']);
  const enabled = parseArgs(['smoke', '--allow-write', '--prompt', 'hello']);
  assert.equal(safe.allowWrite, false);
  assert.equal(enabled.allowWrite, true);
  assert.equal(enabled.prompt, 'hello');
});

test('only the 360Teams main process triggers the launch guard', () => {
  const executable = '/Applications/360Teams.app/Contents/MacOS/360Teams';
  const processes = parseRunningTeamsMainProcesses(`
  101 ${executable}
  102 ${executable} --user-data-dir=/tmp/teams-profile
  103 /Applications/360Teams.app/Contents/Frameworks/360Teams Helper.app/Contents/MacOS/360Teams Helper --type=renderer
  104 /bin/zsh -c rg 360Teams
`, executable);
  assert.deepEqual(processes.map((item) => item.pid), [101, 102]);
});

test('the CDP proxy exposes only the QWork QBot WebView as a page target', () => {
  const payload = {
    method: 'Target.targetCreated',
    params: {
      targetInfo: { type: 'webview', title: 'qbot', url: 'file:///Users/test/.deepbank/ui/0.0.4/index.html' },
    },
  };
  const rewritten = rewriteCdpPayload(payload);
  assert.equal(rewritten.params.targetInfo.type, 'page');
  assert.equal(payload.params.targetInfo.type, 'webview');
  assert.equal(rewriteCdpPayload({ type: 'webview', title: 'other', url: 'https://example.test' }).type, 'webview');
  assert.equal(rewriteCdpPayload({ targetId: 'host', type: 'page', title: '360Teams', url: 'https://host.test' }).type, 'other');
});

test('the CDP proxy leaves bridge injection to the post-connect wrapper', () => {
  const source = fs.readFileSync(new URL('../lib/cdp-webview-proxy.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /nextInjectionRequestId|injectQworkRuntimeBridge/);
  assert.match(source, /stabilizationDeadline = Date\.now\(\) \+ 3_000/);
  assert.match(source, /debugCdpMessage\('downstream', text, Date\.now\(\) < stabilizationDeadline\)/);
  const relayStart = source.indexOf('async function relayBrowserSocket');
  const downstreamListener = source.indexOf("downstream.on('message'", relayStart);
  const upstreamVersionLookup = source.indexOf("await fetchJson(new URL('/json/version'", relayStart);
  assert.ok(downstreamListener > relayStart && downstreamListener < upstreamVersionLookup,
    'the downstream listener must buffer Browser.getVersion before the async upstream lookup');
  assert.match(source.slice(relayStart), /else queued\.push\(text\)[\s\S]*for \(const data of queued\.splice\(0\)\) upstream\.send\(data\)/);
  const runner = fs.readFileSync(new URL('../lib/casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(runner, /await page\.evaluate\(qworkRuntimeBridgeSource\(\)\)/);
});

test('the Teams-only runtime bridge derives the selected model tier from visible QWork UI', () => {
  const source = qworkRuntimeBridgeSource();
  assert.match(source, /composer-safety-level-menu/);
  assert.match(source, /getConnectionView/);
  assert.match(source, /runtimeOptions/);
  assert.match(source, /teams360-qwork-ui/);
  assert.match(source, /matchingPlatformOption/);
  assert.match(source, /platformOptions\.length > 0/);
  assert.match(source, /\^M\[1-4\]\$\/\.test\(platformTier\)/);
  assert.match(source, /__teams360ConnectionViewBridge/);
  assert.match(source, /setInterval\(install, 250\)/);
  assert.match(source, /wrappedGetState/);
  assert.match(source, /session-item-/);
  assert.match(source, /bridge\.state/);
  assert.match(source, /bridge\.currentSession/);
  assert.match(source, /__teams360BridgeVersion/);
  assert.match(source, /clearInterval\(root\.__teams360ConnectionViewBridgeTimer\)/);
});

test('the Teams-only runtime bridge bounds a stalled QWork capabilities IPC call', () => {
  const source = qworkRuntimeBridgeSource();
  assert.match(source, /installAgentTimeoutGuards/);
  assert.match(source, /Teams QWork capabilities timed out after 5000ms/);
  assert.match(source, /agent\.capabilities = wrapped/);
  assert.match(source, /rendererControlWrapper = Boolean\(agent\.capabilities\.__qbotAutomationRendererControlWrapper\)/);
});

test('the Teams-only runtime bridge falls back to the visible context menu for session rename setup', () => {
  const source = qworkRuntimeBridgeSource();
  assert.match(source, /__teams360VisibleSessionRenameFallback/);
  assert.match(source, /addEventListener\('dblclick', handler, true\)/);
  assert.match(source, /new MouseEvent\('contextmenu'/);
  assert.match(source, /session-rename-action/);
  assert.doesNotMatch(source, /dispatchEvent\(new CustomEvent\('qbot-session-rename'/);
});

test('Teams screenshot guard falls back to CDP when web fonts never settle', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-shot-'));
  const screenshotPath = path.join(root, 'fallback.png');
  let detached = false;
  const page = {
    async screenshot(options) {
      assert.equal(options.timeout, 15_000);
      throw new Error('page.screenshot: Timeout 12000ms exceeded while waiting for fonts to load');
    },
    context() {
      return {
        async newCDPSession() {
          return {
            async send(method) {
              assert.equal(method, 'Page.captureScreenshot');
              return { data: Buffer.from('png-evidence').toString('base64') };
            },
            async detach() { detached = true; },
          };
        },
      };
    },
  };
  try {
    installTeamsPageGuards(page);
    const result = await page.screenshot({ path: screenshotPath, fullPage: true });
    assert.equal(result.toString(), 'png-evidence');
    assert.equal(fs.readFileSync(screenshotPath, 'utf8'), 'png-evidence');
    assert.equal(detached, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Teams screenshot guard hard-times-out a screenshot promise that never settles', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-shot-hard-timeout-'));
  const screenshotPath = path.join(root, 'fallback.png');
  const page = {
    async screenshot() { return new Promise(() => {}); },
    context() {
      return {
        async newCDPSession() {
          return {
            async send() { return { data: Buffer.from('hard-timeout-evidence').toString('base64') }; },
            async detach() {},
          };
        },
      };
    },
  };
  try {
    const startedAt = Date.now();
    installTeamsPageGuards(page, { screenshotTimeoutMs: 20 });
    const result = await page.screenshot({ path: screenshotPath, fullPage: true });
    assert.equal(result.toString(), 'hard-timeout-evidence');
    assert.ok(Date.now() - startedAt < 500, 'the guard must not inherit an unbounded Playwright screenshot wait');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the Teams Casebook wrapper keeps output isolated and rejects local-QBot restarts', () => {
  const options = parseCasebookRunnerOptions([
    '--casebook', 'PRD/cases.xlsx',
    '--case', 'SIT-HOME-001',
    '--cdp', 'http://127.0.0.1:58401',
    '--out', 'teams360-automation/output/test-run',
  ]);
  assert.equal(validateTeamsCasebookOptions(options), options);
  assert.throws(() => validateTeamsCasebookOptions({
    ...options,
    'restart-command': './restart-qbot-slim.sh',
  }), /must not configure/);
  assert.throws(() => validateTeamsCasebookOptions({
    ...options,
    out: 'autoTest/not-teams',
  }), /must stay under/);
});

test('Teams fixture runtime restores the packaged host and keeps the local-QBot lane untouched', async () => {
  const page = {
    url: () => 'file:///Users/test/.deepbank/ui/0.0.4/index.html',
    evaluate: async () => 'https://qbot-api.360shuke.com',
  };
  const browser = { contexts: () => [{ pages: () => [page] }] };
  const options = {};
  await configureTeamsFixtureRuntime(options, browser);
  assert.equal(options['control-plane-url'], 'https://qbot-api.360shuke.com');
  assert.equal(options['renderer-control-adapter'], 'teams360');
  assert.match(options['qbot-root'], /(?:\/deepbankV2|\.runtime\/deepbankV2-main-)/);
  assert.match(options['qbot-home'], /teams360-automation\/state\/control-plane-home$/);
  assert.match(options['restart-cwd'], /teams360-automation\/runtime$/);
  assert.match(options['restart-command'], /teams360-automation\/runtime\/scripts\/restart-qbot-electron-control-plane\.sh/);
  assert.match(options['restart-command'], /file:\/\/\/Users\/test\/\.deepbank\/ui\/0\.0\.4\/index\.html/);
  assert.doesNotMatch(options['restart-command'], /restart-qbot-slim\.sh/);
  assert.match(options['qbot-stderr-log'], /teams360-automation\/state\/managed-360teams\.log$/);
});

test('Teams fixture runtime can opt into the host-relaunch lane for real fixture servers', async () => {
  const page = {
    url: () => 'file:///Users/test/.deepbank/ui/0.0.6/index.html',
    evaluate: async () => 'https://qbot-api.360shuke.com',
  };
  const browser = { contexts: () => [{ pages: () => [page] }] };
  const options = { 'teams-fixture-host-relaunch': 'true' };
  await configureTeamsFixtureRuntime(options, browser);
  assert.equal(options['renderer-control-adapter'], 'teams360');
  assert.match(options['restart-command'], /restart-qbot-electron-control-plane\.sh/);
});

test('Teams fixture runtime keeps host relaunch support while fixture data uses the authenticated renderer bridge', async () => {
  const page = {
    url: () => 'file:///Users/test/.deepbank/ui/0.0.8/index.html',
    evaluate: async () => 'https://qbot-api.360shuke.com',
  };
  const browser = { contexts: () => [{ pages: () => [page] }] };
  const options = { case: 'SIT-SKILL-011,SIT-SKILL-020,SIT-SKILL-026,SIT-SKILL-027,SIT-CONN-013,SIT-SKILL-SCOPE-001,SIT-TEAMS-DOC-001,SIT-HITL-002' };
  await configureTeamsFixtureRuntime(options, browser);
  assert.equal(options['teams-fixture-host-relaunch'], 'true');
  assert.equal(options['renderer-control-adapter'], 'teams360');
});

test('Teams runtime ships the complete SkillHub regression fixture set', () => {
  const runtimeManifest = JSON.parse(fs.readFileSync(new URL('../runtime/testfixtures/skillhub-regression/manifest.json', import.meta.url), 'utf8'));
  const slugs = runtimeManifest.skills.map((item) => item.slug);
  assert.equal(slugs.length, 21);
  assert.equal(new Set(slugs).size, 21);
  for (const required of [
    'qa-scope-isolation',
    'qa-install-rejected-visible',
    'qa-auto-declared',
    'qa-materialization-pending',
    'qa-install-dedupe',
    'qa-python-runtime',
    'qa-node-runtime',
  ]) {
    assert.ok(slugs.includes(required), `Teams runtime missing fixture: ${required}`);
  }
});

test('Teams full profile keeps restart coverage and the authenticated renderer fixture bridge', async () => {
  const page = {
    url: () => 'file:///Users/test/.deepbank/ui/0.0.8/index.html',
    evaluate: async () => 'https://qbot-api.360shuke.com',
  };
  const browser = { contexts: () => [{ pages: () => [page] }] };
  const options = { profile: 'full' };
  await configureTeamsFixtureRuntime(options, browser);
  assert.equal(options['teams-fixture-host-relaunch'], 'true');
  assert.equal(options['renderer-control-adapter'], 'teams360');
});

test('Teams stateful SkillHub fixture handles dependencies and materialization without host auth drift', async () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../runtime/testfixtures/skillhub-regression/manifest.json', import.meta.url), 'utf8'));
  const controller = createTeamsSkillFixtureController(fixture.skills);
  const catalog = await controller.handle({ name: 'getSkillsCatalog', args: ['qa-dep-root'] });
  assert.equal(catalog.handled, true);
  assert.ok(catalog.result.market.length >= 3);
  assert.ok(catalog.result.market.some((item) => item.slug === 'qa-dep-root-success'));
  assert.ok(catalog.result.market.some((item) => item.slug === 'qa-dep-root-failure'));

  const cascade = await controller.handle({ name: 'installSkill', args: [{ slug: 'qa-dep-root-success' }] });
  assert.equal(cascade.result.ok, true);
  assert.match(cascade.result.msg, /并级联安装依赖/);
  assert.deepEqual(
    new Set(controller.snapshot().installed.map((item) => item.slug)),
    new Set(['qa-dep-root-success', 'qa-dep-leaf-a', 'qa-dep-leaf-b']),
  );

  const dependencyFailure = await controller.handle({ name: 'installSkill', args: ['qa-dep-root-failure'] });
  assert.equal(dependencyFailure.result.ok, false);
  assert.match(dependencyFailure.result.msg, /依赖技能 qa-dep-leaf-failure 安装失败，主技能未安装/);
  assert.equal(controller.snapshot().installed.some((item) => item.slug === 'qa-dep-root-failure'), false);

  const pending = await controller.handle({ name: 'installSkill', args: ['qa-materialization-pending'] });
  assert.equal(pending.result.ok, true);
  assert.equal(
    controller.snapshot().installed.find((item) => item.slug === 'qa-materialization-pending')?.localReadiness?.status,
    'pending_materialization',
  );
  const reconciled = await controller.handle({ name: 'reconcileSkills', args: [] });
  assert.deepEqual(reconciled.result.materialized, ['qa-materialization-pending']);
  assert.equal(
    controller.snapshot().installed.find((item) => item.slug === 'qa-materialization-pending')?.localReadiness?.status,
    'ready_on_this_process',
  );
});

test('Teams fixture lookup matches immutable slugs and human-readable packaged QWork titles', () => {
  const pattern = automationFixtureMarkerPattern('qa-python-runtime');
  assert.match('QA Python Runtime', pattern);
  assert.match('qa-python-runtime', pattern);
  assert.doesNotMatch('QA Node Runtime', pattern);
});

test('Teams multi-skill selection reopens the packaged unified menu after each picked skill', () => {
  const source = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(source, /重新打开【技能】菜单以选择：\$\{expectedLabel\}/);
  assert.match(source, /menu = await activeMenuLocator\(page, 'skill'\)/);
  assert.equal(cleanSkillChipLabel('×QA Python Runtime'), 'QA Python Runtime');
  assert.equal(cleanSkillChipLabel('QA Python Runtime×'), 'QA Python Runtime');
  assert.equal(cleanSkillChipLabel('  × QA Python Runtime  '), 'QA Python Runtime');
});

test('Teams renderer fault controls stay opt-in and do not replace the local-QBot proxy lane', () => {
  const source = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(source, /options\['renderer-control-adapter'\] === 'teams360'/);
  assert.match(source, /installRendererControlAdapter\(\{ page, rules, initiallyArmed \}\)/);
  assert.match(source, /const proxy = await createControlPlaneFaultProxy\(\{ upstreamUrl, rules, initiallyArmed \}\)/);
  assert.match(source, /teams360-control-\$\{process\.pid\}-\$\{Date\.now\(\)\}/);
  assert.match(source, /__qbotAutomationRendererControlWrapper/);
  assert.match(source, /root\.agent\[name\] = original/);
  assert.match(source, /delete root\.__qbotAutomationAgentOriginalsOwner/);
});

test('managed Teams fixture relaunch keeps the packaged production home', () => {
  const source = fs.readFileSync(new URL('../lib/relaunch-managed-host.mjs', import.meta.url), 'utf8');
  assert.match(source, /origin === packagedControlPlaneOrigin \? \{\} : \{ DEEPBANK_SERVER: serverUrl \}/);
  assert.match(source, /DEEPBANK_UI_URL: pinnedQworkUi\.url/);
  assert.match(source, /QBOT_UI_URL: pinnedQworkUi\.url/);
  assert.match(source, /QBOT_SERVER_URL: serverUrl/);
  assert.doesNotMatch(source, /DEEPBANK_ENV:\s*['"]dev['"]/);
  assert.match(source, /resolvePinnedQworkUi\(previous, expectedQworkUi\)/);
  assert.match(source, /\/json\/list/);
  assert.match(source, /Automatically rolled back to/);
});

test('managed live Teams can expose the real OAuth browser during login recovery', () => {
  assert.equal(managedTeamsEnvironment({}, { e2e: false }).DEEPBANK_E2E, '0');
  assert.equal(managedTeamsEnvironment({}, { e2e: true }).DEEPBANK_E2E, '1');
  assert.equal(managedTeamsEnvironment({ DEEPBANK_E2E: '0' }).DEEPBANK_E2E, '1');
});

test('managed live Teams keeps the packaged WebView resource home while targeting dev', () => {
  assert.deepEqual(
    managedQbotLaunchArgs({
      DEEPBANK_SERVER: 'https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net/',
      QBOT_RELEASE_ENV: 'DEV',
    }),
    [
      '--qbot-server=https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net',
    ],
  );
  assert.throws(
    () => managedQbotLaunchArgs({ DEEPBANK_SERVER: 'https://user:secret@example.test' }),
    /credential-free HTTP\(S\) URL/,
  );
});

test('Teams Electron restart shim ignores fixture URLs and auto-discovers the pinned QWork UI', () => {
  const source = fs.readFileSync(new URL('../runtime/scripts/restart-qbot-electron-control-plane.sh', import.meta.url), 'utf8');
  assert.match(source, /EXPECTED_QWORK_UI_URL="\$\{5-\}"/);
  assert.match(source, /AGENT_MOCK="\$\{6:-0\}"/);
  assert.match(source, /\.deepbank\(-dev\|-local\|-uat\)\?\/ui/);
  assert.match(source, /relaunch-managed-host\.mjs" "\$CONTROL_PLANE_URL" "" "\$AGENT_MOCK"$/m);
});

test('managed Teams HITL fixture opts into mock Agent only for its controlled relaunch', () => {
  const relaunch = fs.readFileSync(new URL('../lib/relaunch-managed-host.mjs', import.meta.url), 'utf8');
  const runner = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(relaunch, /DEEPBANK_AGENT_MOCK: mockFlag/);
  assert.match(relaunch, /\['0', '1'\]\.includes\(agentMock\)/);
  assert.match(runner, /restartWithHitlMockAgent[\s\S]*parsedControlPlane\.origin[\s\S]*qbotHome[\s\S]*''[\s\S]*'1'[\s\S]*\.map\(shellQuote\)/);
  assert.match(runner, /executeHitlFixtureCase[\s\S]*restartWithHitlMockAgent/);
  assert.doesNotMatch(
    runner.slice(runner.indexOf('async function executeHitlFixtureCase'), runner.indexOf('async function executeSitHitlSkipDefault')),
    /createConnectorRegressionServer|restartWithConnectorRegressionFixture|127\.0\.0\.1:18900/,
  );
});

test('managed Teams fixture data stays on the authenticated renderer bridge; legacy loopback auth remains fail-closed', () => {
  const fixtureServer = fs.readFileSync(new URL('../runtime/scripts/teams-control-plane.mjs', import.meta.url), 'utf8');
  const runner = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(fixtureServer, /DEEPBANK_AUTH_PROVIDER:\s*['"]mock['"]/);
  assert.match(fixtureServer, /portIsOpen/);
  assert.match(fixtureServer, /if\s*\(!portClosed\)/);
  assert.match(fixtureServer, /payload\.auth\?\.provider\?\.id\s*===\s*['"]mock['"]/);
  assert.match(runner, /ensureManagedFixtureMockAuth/);
  assert.match(runner, /\/api\/auth\/mock\/authorize/);
  assert.match(runner, /\['127\.0\.0\.1', 'localhost', '\[::1\]', '::1'\]/);
  assert.match(runner, /fixture_mock_auth/);
  assert.match(runner, /createTeamsSkillFixtureController/);
  assert.match(runner, /mode:\s*'stateful-renderer-bridge'/);
  assert.match(runner, /mode:\s*'node-handler'/);
});

test('managed Teams fixture relaunch transactionally overrides and restores the persisted QBot profile', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-teams-profile-'));
  const profile = path.join(root, 'profile');
  const backup = path.join(root, 'state', 'profile-backup.json');
  const bridgeDir = path.join(profile, 'qbot');
  fs.mkdirSync(bridgeDir, { recursive: true });
  const configFile = path.join(profile, 'sk-teams-cfg.json');
  fs.writeFileSync(configFile, JSON.stringify({
    deepbank: { qbot_custom: { env: 'DEV', serverUrl: '', uiUrl: '' } },
    configInfo: {
      QBOT_ENV: 'DEV',
      QBOT_SERVER_URL: 'https://dev.example.test',
      QBOT_UI_URL: 'file:///Users/test/.deepbank-dev/ui/0.0.11/index.html',
      QBOT_SURFACE: 'workbench',
    },
  }));
  const uiUrl = 'file:///Users/test/.deepbank-dev/ui/0.0.11/index.html';
  const overridden = applyManagedQbotProfileConfig({
    profileDir: profile,
    serverUrl: 'http://127.0.0.1:18900',
    uiUrl,
    backupFile: backup,
  });
  assert.equal(overridden.mode, 'overridden');
  const fixtureConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(fixtureConfig.deepbank.qbot_custom.serverUrl, 'http://127.0.0.1:18900');
  assert.equal(fixtureConfig.deepbank.qbot_custom.uiUrl, '');
  assert.equal(fixtureConfig.configInfo.QBOT_SERVER_URL, 'http://127.0.0.1:18900');
  assert.equal(fixtureConfig.configInfo.QBOT_UI_URL, uiUrl);
  assert.equal(fs.existsSync(backup), true);
  fs.writeFileSync(
    path.join(bridgeDir, 'qbot-agent-bridge.cjs'),
    'process.env.DEEPBANK_SERVER = "http://127.0.0.1:18900";\n',
  );
  assert.equal(stagedQbotServer(profile), 'http://127.0.0.1:18900');

  const restored = applyManagedQbotProfileConfig({
    profileDir: profile,
    serverUrl: 'https://dev.example.test',
    uiUrl,
    backupFile: backup,
  });
  assert.equal(restored.mode, 'restored');
  const restoredConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(restoredConfig.deepbank.qbot_custom.serverUrl, '');
  assert.equal(restoredConfig.configInfo.QBOT_SERVER_URL, 'https://dev.example.test');
  assert.equal(fs.existsSync(backup), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('managed Teams Casebook recovery rebuilds its CDP proxy after a host relaunch', () => {
  const source = fs.readFileSync(new URL('../lib/casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(source, /let connection = await resolveTeamsCasebookConnection/);
  assert.match(source, /connection = await resolveTeamsCasebookConnection\(\{ \.\.\.options, cdp: undefined \}\)/);
  assert.match(source, /process\.exit\(\(counts\.failed \|\| 0\) > 0 \|\| \(counts\.blocked \|\| 0\) > 0 \? 1 : 0\)/);
});

test('managed Teams Casebook refreshes only QWork after a stale renderer CDP attach', () => {
  const source = fs.readFileSync(new URL('../lib/casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(source, /recoverTeamsQworkWorkbench/);
  assert.match(source, /Teams QWork connection view timed out after 1500ms/);
  assert.match(source, /Teams QWork capabilities precheck timed out after 5000ms/);
  assert.match(source, /new URL\('\/json\/list', normalizedCdpUrl\)/);
  assert.match(source, /target\?\.type === 'webview'/);
  assert.match(source, /validatePinnedQworkUiUrl\(qworkTarget\.url\)/);
  assert.match(source, /launchLiveTeams/);
  assert.match(source, /DEEPBANK_UI_URL: pinnedQworkUi\.url/);
  assert.match(source, /QBOT_UI_URL: pinnedQworkUi\.url/);
  assert.match(source, /QBOT_SERVER_URL: snapshot\.controlPlane/);
  assert.doesNotMatch(source, /host\.reload\(\{ waitUntil: 'domcontentloaded'/);
  assert.match(source, /360Teams login expired before recovering QWork/);
  assert.match(source, /recoveryCdpUrl: connection\.upstreamCdpUrl/);
  assert.match(source, /resetConnection: connection\.reset/);
  assert.match(source, /QWork capabilities IPC is unavailable/);
  assert.match(source, /capabilities_ipc: 'ready'/);
  assert.match(source, /process\.chdir\(ROOT\);[\s\S]*connectTeamsCasebookBrowser[\s\S]*process\.chdir\(TEAMS_RUNTIME_ROOT\);/);
});

test('the Teams Casebook wrapper can resolve the managed live session without a manual CDP proxy', () => {
  const options = parseCasebookRunnerOptions([
    '--casebook', 'PRD/cases.xlsx',
    '--case', 'SIT-HOME-001',
    '--out', 'teams360-automation/output/live-session-run',
  ]);
  assert.equal(validateTeamsCasebookOptions(options), options);
  assert.match(options.session, /teams360-automation\/state\/session\.json$/);
  assert.equal(
    validateLiveCasebookSession({ profile_mode: 'live', cdp_url: 'http://127.0.0.1:58401' }),
    'http://127.0.0.1:58401',
  );
});

test('a controlled live-host relaunch can be adopted only with the same executable, profile, CDP and control plane', () => {
  const session = {
    profile_mode: 'live',
    app_path: '/Applications/360Teams.app',
    executable: '/Applications/360Teams.app/Contents/MacOS/360Teams',
    profile_dir: '/tmp/teams-live-profile',
    profile_alias: '/tmp/teams-live-alias',
    cdp_url: 'http://127.0.0.1:52364',
    port: 52364,
    control_plane_origin: 'https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net',
  };
  fs.mkdirSync(session.profile_dir, { recursive: true });
  fs.rmSync(session.profile_alias, { recursive: true, force: true });
  fs.symlinkSync(session.profile_dir, session.profile_alias, 'dir');
  const command = `${session.executable} --remote-debugging-address=127.0.0.1 --remote-debugging-port=52364 --user-data-dir=${session.profile_alias} --qbot-server=${session.control_plane_origin} --relaunch`;
  try {
    assert.equal(matchesRelaunchedLiveSession(session, { pid: 991, command }), true);
    assert.equal(matchesRelaunchedLiveSession(session, { pid: 991, command: command.replace('52364', '52365') }), false);
    assert.equal(matchesRelaunchedLiveSession(session, { pid: 991, command: command.replace(session.profile_alias, '/tmp/other') }), false);
    assert.equal(matchesRelaunchedLiveSession(session, { pid: 991, command: command.replace(session.control_plane_origin, 'https://qbot-api.360shuke.com') }), false);
  } finally {
    fs.rmSync(session.profile_alias, { force: true });
    fs.rmSync(session.profile_dir, { recursive: true, force: true });
  }
});

test('functional Casebook runs reject isolated profiles and token-seeded authentication', () => {
  assert.throws(
    () => validateLiveCasebookSession({ profile_mode: 'isolated', cdp_url: 'http://127.0.0.1:58401' }),
    /OAuth\/token seeding are not accepted/,
  );
  assert.throws(() => validateLiveCasebookSession(null), /No managed 360Teams session exists/);
});

test('the Teams wrapper removes synthetic tails and resumes from recoverable adapter failures', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-recovery-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  const summaryFile = path.join(outDir, 'automation-run-summary.json');
  const results = [
    { id: 'SIT-HOME-001', status: 'passed', result_category: 'pass' },
    {
      id: 'SIT-HOME-004',
      status: 'failed',
      result_category: 'bug',
      actual_result: "ENOENT: open '/workspace/teams360-automation/testfixtures/skillhub-regression/manifest.json'",
    },
    {
      id: 'SIT-HOME-005',
      status: 'blocked',
      result_category: 'automation_error',
      actual_result: 'Target page, context or browser has been closed',
    },
  ];
  fs.writeFileSync(progressFile, JSON.stringify({ completed: 3, total: 178, stopped: true, results }));
  fs.writeFileSync(summaryFile, JSON.stringify({ status: 'failed', counts: { total: 178 } }));
  try {
    const repaired = repairInterruptedTeamsProgress({ outDir, pass: 1 });
    assert.equal(repaired.repaired, true);
    assert.equal(repaired.startIndex, 1);
    assert.equal(repaired.firstCaseId, 'SIT-HOME-004');
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    assert.equal(progress.completed, 1);
    assert.deepEqual(progress.results.map((result) => result.id), ['SIT-HOME-001']);
    const recovering = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    assert.equal(recovering.status, 'recovering');
    assert.equal(fs.existsSync(path.join(outDir, 'logs', 'teams-recovery-pass-01-progress.json')), true);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('the Teams wrapper retries a QWork reply-poll hard timeout from the affected Case', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-reply-poll-recovery-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  try {
    fs.writeFileSync(progressFile, JSON.stringify({
      completed: 2,
      total: 53,
      results: [
        { id: 'SIT-ART-004', status: 'passed', actual_result: 'ok' },
        {
          id: 'SIT-ART-005',
          status: 'failed',
          actual_result: 'QWork reply-poll operation timed out: conversation snapshot after 15000ms',
        },
      ],
    }));
    const repaired = repairInterruptedTeamsProgress({ outDir, pass: 2 });
    assert.equal(repaired.repaired, true);
    assert.equal(repaired.startIndex, 1);
    assert.equal(repaired.firstCaseId, 'SIT-ART-005');
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    assert.deepEqual(progress.results.map((result) => result.id), ['SIT-ART-004']);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('the Teams wrapper resumes a completed-looking synthetic CDP tail', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-synthetic-tail-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  const summaryFile = path.join(outDir, 'automation-run-summary.json');
  const reason = '用例 SIT-ART-015 执行后 QBot CDP/page 已断开，Target page, context or browser has been closed';
  const results = [
    { id: 'SIT-ART-015', status: 'failed', result_category: 'automation_error', actual_result: reason, synthetic: true },
    { id: 'SIT-TEAMS-NEW-001', status: 'blocked', result_category: 'automation_error', actual_result: reason, synthetic: true },
  ];
  fs.writeFileSync(progressFile, JSON.stringify({ completed: 2, total: 2, stopped: true, synthetic: true, results }));
  fs.writeFileSync(summaryFile, JSON.stringify({ status: 'blocked', ended_at: new Date().toISOString(), counts: { total: 2 } }));
  try {
    const repaired = repairInterruptedTeamsProgress({ outDir, pass: 1 });
    assert.equal(repaired.repaired, true);
    assert.equal(repaired.startIndex, 0);
    assert.equal(repaired.firstCaseId, 'SIT-ART-015');
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    assert.equal(progress.completed, 0);
    assert.deepEqual(progress.results, []);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('the Teams wrapper never rewinds a normally completed run because of an older framework result', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-complete-no-rewind-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  const summaryFile = path.join(outDir, 'automation-run-summary.json');
  const results = [
    { id: 'SIT-HOME-050', status: 'failed', result_category: 'automation_error', actual_result: 'Target page, context or browser has been closed' },
    { id: 'SIT-RUNTIME-RECOVER-001', status: 'passed', result_category: 'pass', actual_result: 'ok' },
  ];
  fs.writeFileSync(progressFile, JSON.stringify({ completed: 2, total: 2, results }));
  fs.writeFileSync(summaryFile, JSON.stringify({ status: 'failed', ended_at: new Date().toISOString(), counts: { total: 2, passed: 1, failed: 1 } }));
  try {
    const before = fs.readFileSync(progressFile, 'utf8');
    const repaired = repairInterruptedTeamsProgress({ outDir, pass: 1 });
    assert.deepEqual(repaired, { repaired: false, reason: 'run-complete' });
    assert.equal(fs.readFileSync(progressFile, 'utf8'), before);
    assert.equal(fs.existsSync(path.join(outDir, 'logs')), false);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('the Teams wrapper preserves a completed run whose progress carries a final stopped marker', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-complete-stopped-no-rewind-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  const summaryFile = path.join(outDir, 'automation-run-summary.json');
  const results = [
    { id: 'SIT-HOME-016', status: 'failed', result_category: 'automation_error', actual_result: 'Target page, context or browser has been closed' },
    { id: 'SIT-RUNTIME-RECOVER-001', status: 'failed', result_category: 'automation_error', actual_result: 'runtime fixture stopped after validation' },
  ];
  fs.writeFileSync(progressFile, JSON.stringify({ completed: 2, total: 2, stopped: true, results }));
  fs.writeFileSync(summaryFile, JSON.stringify({ status: 'failed', ended_at: new Date().toISOString(), counts: { total: 2, passed: 0, failed: 2 } }));
  try {
    const beforeProgress = fs.readFileSync(progressFile, 'utf8');
    const beforeSummary = fs.readFileSync(summaryFile, 'utf8');
    const repaired = repairInterruptedTeamsProgress({ outDir, pass: 1 });
    assert.deepEqual(repaired, { repaired: false, reason: 'run-complete' });
    assert.equal(fs.readFileSync(progressFile, 'utf8'), beforeProgress);
    assert.equal(fs.readFileSync(summaryFile, 'utf8'), beforeSummary);
    assert.equal(fs.existsSync(path.join(outDir, 'logs')), false);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('trusted review selects the archived complete result over a recovery sentinel', () => {
  const source = fs.readFileSync(new URL('../lib/trusted-review.mjs', import.meta.url), 'utf8');
  assert.match(source, /resolveCanonicalRunInputs/);
  assert.match(source, /teams-recovery-pass-/);
  assert.match(source, /No complete, non-synthetic Casebook result/);
  assert.match(source, /source_progress: progressPath/);
  assert.doesNotMatch(source, /candidateProgressJson\.stopped\s*!==\s*true/);
  assert.match(source, /candidateProgressJson\.aborted\s*!==\s*true/);
});

test('strict trusted-review overrides reject cross-case and setup-only screenshots', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-review-scope-'));
  const caseA = path.join(outDir, 'cases', '001-SIT-A');
  const caseB = path.join(outDir, 'cases', '002-SIT-B');
  fs.mkdirSync(caseA, { recursive: true });
  fs.mkdirSync(caseB, { recursive: true });
  const report = path.join(caseA, 'case-report.md');
  const before = path.join(caseA, '01-before-send.png');
  const foreign = path.join(caseB, '05-after-reply.png');
  fs.writeFileSync(report, '# report');
  fs.writeFileSync(before, 'png');
  fs.writeFileSync(foreign, 'png');
  const result = { id: 'SIT-A', case_report: report, assertions: [] };
  const base = {
    id: 'SIT-A',
    reason: '完整理由',
    product_observation: '用户看到了完成结果',
    user_operation: '发送任务',
    expected_outcome: '得到结果',
  };
  try {
    assert.equal(pathInside(caseA, before), true);
    assert.equal(pathInside(caseA, foreign), false);
    const setupOnly = validateStrictReviewOverride({ outDir, result, item: { ...base, evidence: [before] }, trustedStatus: 'trusted_pass' });
    assert.equal(setupOnly.ok, false);
    assert.match(setupOnly.errors.join('\n'), /操作后结果截图/);
    const crossCase = validateStrictReviewOverride({ outDir, result, item: { ...base, evidence: [foreign] }, trustedStatus: 'trusted_pass' });
    assert.equal(crossCase.ok, false);
    assert.match(crossCase.errors.join('\n'), /越过当前 Case 目录/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('strict trusted pass requires structured resolution of failed user assertions', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-review-failure-'));
  const caseDir = path.join(outDir, 'cases', '001-SIT-A');
  fs.mkdirSync(caseDir, { recursive: true });
  const report = path.join(caseDir, 'case-report.md');
  const screenshot = path.join(caseDir, '05-after-reply.png');
  fs.writeFileSync(report, '# report');
  fs.writeFileSync(screenshot, 'png');
  const result = {
    id: 'SIT-A',
    case_report: report,
    assertions: [{ name: '核心业务结果', status: 'failed' }],
  };
  const item = {
    id: 'SIT-A',
    reason: '断言解析错误',
    product_observation: '真实结果满足要求',
    user_operation: '发送任务',
    expected_outcome: '得到正确结果',
    evidence: [screenshot],
  };
  try {
    const missingResolution = validateStrictReviewOverride({ outDir, result, item, trustedStatus: 'trusted_pass' });
    assert.equal(missingResolution.ok, false);
    assert.match(missingResolution.errors.join('\n'), /核心业务结果/);
    const resolved = validateStrictReviewOverride({
      outDir,
      result,
      item: { ...item, resolved_failures: [{ assertion: '核心业务结果', reason: 'DOM 文本被错误解析', evidence: [screenshot] }] },
      trustedStatus: 'trusted_pass',
    });
    assert.equal(resolved.ok, true, resolved.errors.join('\n'));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('run metadata pins bundle identity and rejects host drift on resume', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-run-metadata-'));
  const app = path.join(root, '360Teams.app');
  const plist = path.join(app, 'Contents', 'Info.plist');
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  fs.writeFileSync(plist, 'fixture');
  const identity = readMacAppBundleIdentity(app, (_command, args) => (
    args[1] === 'CFBundleShortVersionString' ? '5.2.17\n' : '2119072078\n'
  ));
  const metadata = {
    schema_version: 1,
    captured_at: '2026-07-21T00:00:00.000Z',
    last_observed_at: '2026-07-21T00:00:00.000Z',
    host: identity,
    qwork: { version: '0.0.8', url: 'file:///Users/test/.deepbank/ui/0.0.8/index.html' },
    control_plane: { origin: 'https://dev.example.test' },
    model_tier: 'M3',
    timeout_ms: 600000,
    observed_host_pids: [101],
    selected_case_ids: ['SIT-A'],
  };
  try {
    writePinnedRunMetadata(root, metadata);
    writePinnedRunMetadata(root, { ...metadata, last_observed_at: '2026-07-21T00:01:00.000Z', observed_host_pids: [202] });
    const saved = JSON.parse(fs.readFileSync(path.join(root, 'run-metadata.json'), 'utf8'));
    assert.deepEqual(saved.observed_host_pids, [101, 202]);
    assert.throws(
      () => writePinnedRunMetadata(root, { ...metadata, host: { ...metadata.host, build: 'wrong' } }),
      /identity drift.*host\.build/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release artifact fingerprints cover the Teams binary, QWork payload and Casebook contents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-release-fingerprint-'));
  try {
    const app = path.join(root, '360Teams.app');
    const plist = path.join(app, 'Contents', 'Info.plist');
    const binary = path.join(app, 'Contents', 'MacOS', '360Teams');
    const qwork = path.join(root, 'qwork', '1.0.0');
    const index = path.join(qwork, 'index.html');
    const installed = path.join(qwork, '.installed.json');
    const casebook = path.join(root, 'casebook.xlsx');
    fs.mkdirSync(path.dirname(binary), { recursive: true });
    fs.mkdirSync(qwork, { recursive: true });
    fs.writeFileSync(plist, 'plist-content');
    fs.writeFileSync(binary, 'binary-content');
    fs.writeFileSync(index, '<!doctype html>');
    fs.writeFileSync(installed, '{"status":"ready"}');
    fs.writeFileSync(casebook, 'casebook-content');
    const first = buildReleaseArtifactFingerprints({
      host: { app_path: app },
      qworkUiUrl: `file://${index}`,
      casebookPath: casebook,
    });
    for (const field of ['host_info_plist_sha256', 'host_main_binary_sha256', 'qwork_index_sha256', 'qwork_install_metadata_sha256', 'casebook_sha256']) {
      assert.match(first[field], /^[a-f0-9]{64}$/);
    }
    fs.writeFileSync(index, '<!doctype html><title>changed</title>');
    const changed = buildReleaseArtifactFingerprints({ host: { app_path: app }, qworkUiUrl: `file://${index}`, casebookPath: casebook });
    assert.notEqual(changed.qwork_index_sha256, first.qwork_index_sha256);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('trusted validation overlay can select a clean subset from a complete matching run', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-trusted-overlay-'));
  const outDir = path.join(root, 'validation');
  fs.mkdirSync(outDir, { recursive: true });
  const targetHost = {
    product: '360Teams',
    version: '5.2.17',
    build: '2119072078',
    qwork: '0.0.8',
    control_plane_origin: 'https://dev.example.test',
    model_tier: 'M3',
    timeout_ms: 600000,
  };
  const metadata = {
    host: { product: '360Teams', version: '5.2.17', build: '2119072078' },
    qwork: { version: '0.0.8' },
    control_plane: { origin: 'https://dev.example.test' },
    model_tier: 'M3',
    timeout_ms: 600000,
    selected_case_ids: ['SIT-A', 'SIT-B'],
  };
  const manifest = path.join(root, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({
    schema_version: 1,
    sources: [{ out_dir: 'validation', expected_case_ids: ['SIT-A', 'SIT-B'], include_case_ids: ['SIT-A'] }],
  }));
  fs.writeFileSync(path.join(outDir, 'run-metadata.json'), JSON.stringify(metadata));
  fs.writeFileSync(path.join(outDir, 'automation-progress.json'), JSON.stringify({
    completed: 2,
    total: 2,
    results: [{ id: 'SIT-A' }, { id: 'SIT-B' }],
  }));
  fs.writeFileSync(path.join(outDir, 'automation-run-summary.json'), JSON.stringify({
    status: 'failed',
    ended_at: '2026-07-21T00:10:00.000Z',
    counts: { total: 2, failed: 2 },
  }));
  fs.writeFileSync(path.join(outDir, '可信二次复核结果.json'), JSON.stringify({
    trusted_counts: { trusted_bug: 1, framework_issue: 1, needs_review: 0 },
    results: [{ id: 'SIT-A', trusted_status: 'trusted_bug' }, { id: 'SIT-B', trusted_status: 'framework_issue' }],
  }));
  try {
    const loaded = loadTrustedValidationSources({ manifestPath: manifest, baselineIds: ['SIT-A', 'SIT-B'], targetHost });
    assert.equal(loaded.byId.get('SIT-A').trusted_status, 'trusted_bug');
    assert.equal(loaded.byId.has('SIT-B'), false);
    assert.equal(assertRunMetadataHost(metadata, targetHost).ok, true);
    fs.writeFileSync(path.join(outDir, 'run-metadata.json'), JSON.stringify({
      ...metadata,
      host: { ...metadata.host, build: 'wrong' },
    }));
    assert.throws(
      () => loadTrustedValidationSources({ manifestPath: manifest, baselineIds: ['SIT-A', 'SIT-B'], targetHost }),
      /host identity mismatch/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
