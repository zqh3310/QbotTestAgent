#!/usr/bin/env node
import fs from 'node:fs';
import { parseArgs, usage } from './lib/config.mjs';
import {
  launchIsolatedTeams,
  launchLiveTeams,
  resolveSessionCdp,
  stopIsolatedTeams,
  waitForCdp,
} from './lib/launcher.mjs';
import { writeReport } from './lib/report.mjs';
import { inspectTeamsCdp } from './lib/targets.mjs';

let exitCode = 0;
try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }
  fs.mkdirSync(options.outputDir, { recursive: true });

  if (options.command === 'launch' || options.command === 'launch-live') {
    const session = options.command === 'launch-live'
      ? await launchLiveTeams(options)
      : await launchIsolatedTeams(options);
    const report = baseReport(options, {
      status: 'passed',
      reason: options.command === 'launch-live'
        ? '360Teams is running with its existing signed-in profile through the adapter-owned profile alias and loopback-only CDP.'
        : 'An isolated 360Teams instance is running with loopback-only CDP.',
      cdp_url: session.cdp_url,
      pid: session.pid,
      browser: session.browser,
      profile_alias: session.profile_alias || null,
    });
    report.files = writeReport(options.outputDir, report);
    printSummary(report);
  } else if (options.command === 'stop') {
    const stopped = stopIsolatedTeams(options.sessionFile);
    const report = baseReport(options, {
      status: ['stopped', 'not-running', 'stale-session'].includes(stopped.status) ? 'passed' : 'blocked',
      reason: stopped.reason || stopped.status,
      stop_result: stopped,
    });
    report.files = writeReport(options.outputDir, report);
    printSummary(report);
  } else {
    const resolved = resolveSessionCdp(options);
    await waitForCdp({ cdpUrl: resolved.cdpUrl, timeoutMs: options.timeoutMs });
    const inspection = await inspectTeamsCdp({
      cdpUrl: resolved.cdpUrl,
      outputDir: options.outputDir,
      openQbot: options.openQbot,
      captureHost: options.captureHost,
      smoke: options.command === 'smoke',
      allowWrite: options.allowWrite,
      prompt: options.prompt,
      expected: options.expected,
      timeoutMs: Math.max(options.timeoutMs, 60_000),
    });
    const smokeStatus = inspection.smoke?.status;
    const status = options.command === 'smoke'
      ? smokeStatus === 'passed' ? 'passed' : smokeStatus === 'failed' ? 'failed' : 'blocked'
      : inspection.qbot_target ? 'passed' : 'blocked';
    const hostBlockedReason = inspection.host_precondition?.status === 'blocked'
      ? inspection.host_precondition.reason
      : '';
    const reason = status === 'passed'
      ? options.command === 'smoke' ? '360Teams-hosted QBot smoke passed.' : '360Teams CDP and QBot target are ready.'
      : hostBlockedReason
        ? hostBlockedReason
        : options.command === 'smoke'
          ? inspection.smoke?.reason || 'Smoke did not pass.'
          : 'CDP is reachable, but no QBot page/frame/WebView target was identified.';
    const report = baseReport(options, {
      status,
      reason,
      cdp_url: resolved.cdpUrl,
      pid: resolved.session?.pid || null,
      profile_dir: resolved.session?.profile_dir || options.profileDir,
      profile_mode: resolved.session?.profile_mode || options.profileMode,
      profile_alias: resolved.session?.profile_alias || options.profileAlias || null,
      inspection,
    });
    report.files = writeReport(options.outputDir, report);
    printSummary(report);
    if (status === 'blocked') exitCode = 2;
    if (status === 'failed') exitCode = 1;
  }
} catch (error) {
  const fallbackOptions = safeParseOptions();
  const report = baseReport(fallbackOptions, {
    status: 'blocked',
    reason: error.message,
    error_name: error.name,
  });
  try {
    report.files = writeReport(fallbackOptions.outputDir, report);
  } catch {}
  printSummary(report);
  exitCode = 2;
}

// Playwright CDP connections intentionally do not call browser.close(), because
// that could close a 360Teams process attached through --cdp. A forced process
// exit only closes this adapter's socket and leaves the managed IM instance alive.
process.exit(exitCode);

function safeParseOptions() {
  try { return parseArgs(process.argv.slice(2)); } catch {
    return parseArgs([]);
  }
}

function baseReport(options, extra) {
  return {
    schema_version: 1,
    command: options.command,
    generated_at: new Date().toISOString(),
    app_path: options.appPath,
    profile_dir: options.profileDir,
    profile_alias: options.profileAlias || null,
    profile_mode: options.profileMode,
    session_file: options.sessionFile,
    output_dir: options.outputDir,
    ...extra,
  };
}

function printSummary(report) {
  console.log(JSON.stringify({
    command: report.command,
    status: report.status,
    reason: report.reason,
    cdp_url: report.cdp_url || '',
    pid: report.pid || null,
    report: report.files?.markdown || '',
  }, null, 2));
}
