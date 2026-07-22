import fs from 'node:fs';
import path from 'node:path';
import { redactText } from './config.mjs';

export function sanitize(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

export function writeReport(outputDir, report) {
  fs.mkdirSync(outputDir, { recursive: true });
  const clean = sanitize(report);
  const jsonFile = path.join(outputDir, 'teams360-automation-report.json');
  const mdFile = path.join(outputDir, 'teams360-automation-report.md');
  fs.writeFileSync(jsonFile, `${JSON.stringify(clean, null, 2)}\n`);
  fs.writeFileSync(mdFile, renderMarkdown(clean));
  return { json: jsonFile, markdown: mdFile };
}

function renderMarkdown(report) {
  const targets = report.inspection?.targets || [];
  const profileSafety = report.profile_mode === 'live'
    ? '- The existing signed-in 360Teams profile is reused through an adapter-owned symlink alias; no profile copy or OAuth/token seeding is performed.'
    : '- The live 360Teams profile is never used by the isolated diagnostic lane.';
  return [
    '# 360Teams QBot Automation Report',
    '',
    `- Command: ${report.command}`,
    `- Status: ${report.status}`,
    `- Generated at: ${report.generated_at}`,
    `- App: ${report.app_path || ''}`,
    `- Profile: ${report.profile_dir || ''}`,
    `- Profile alias: ${report.profile_alias || ''}`,
    `- CDP: ${report.cdp_url || ''}`,
    `- Reason: ${report.reason || ''}`,
    '',
    '## Isolation',
    '- Existing QBot runner and port 9224 are not used or modified.',
    profileSafety,
    '- Stop only acts on the PID recorded by this adapter.',
    '',
    '## Target discovery',
    `- Page count: ${report.inspection?.page_count ?? 0}`,
    `- Frame count: ${report.inspection?.frame_count ?? 0}`,
    `- WebView count: ${report.inspection?.webview_count ?? 0}`,
    `- QBot target found: ${report.inspection?.qbot_target ? 'yes' : 'no'}`,
    `- Host precondition: ${report.inspection?.host_precondition?.status || 'unknown'}`,
    `- Host precondition reason: ${report.inspection?.host_precondition?.reason || ''}`,
    ...targets.map((target) => `- page=${target.page_index} frame=${target.frame_index} score=${target.score ?? 0} surface=${target.surface || '-'} url=${target.url || '-'}`),
    '',
    '## Smoke',
    `- Status: ${report.inspection?.smoke?.status || 'not-run'}`,
    `- Reason: ${report.inspection?.smoke?.reason || ''}`,
    `- Reply excerpt: ${report.inspection?.smoke?.reply_excerpt || ''}`,
    `- Assertions: ${JSON.stringify(report.inspection?.smoke?.assertions || {})}`,
    '',
    '## Screenshots',
    ...Object.entries(report.inspection?.screenshots || {}).map(([name, file]) => `- ${name}: ${file}`),
    ...((report.inspection?.smoke?.screenshots || []).map((file) => `- smoke: ${file}`)),
    '',
  ].join('\n');
}
