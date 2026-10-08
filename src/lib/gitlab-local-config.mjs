import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LOCAL_GITLAB_CONFIG = path.join(ROOT, 'config/gitlab.local.json');
const HOST = 'gitlab.daikuan.qihoo.net';
const PROJECT = 'songrongxin/deepbankv2';
const ENTRIES = Object.freeze({
  scan: 'scripts/scan-qwork-release-intake.mjs',
  observe: 'scripts/observe-qwork-release-ref.mjs',
  orchestrate: 'scripts/orchestrate-qwork-release-test.mjs',
});

// Explicitly user-authorized, machine-local credentials only. Never serialize errors
// from JSON.parse, child_process, or the configuration itself: they may contain secrets.
export function readLocalGitLabConfig(file = LOCAL_GITLAB_CONFIG) {
  let value;
  let fd;
  try {
    const resolved = path.resolve(file);
    if (fs.realpathSync(resolved) !== resolved) throw new Error();
    fd = fs.openSync(resolved, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 16384 || stat.size < 2) throw new Error();
    if (process.platform !== 'win32'
      && ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid())) throw new Error();
    value = JSON.parse(fs.readFileSync(fd, 'utf8'));
    if (value.host !== HOST || value.project !== PROJECT
      || typeof value.token !== 'string' || !value.token.trim()
      || /[\r\n\0]/u.test(value.token)) throw new Error();
  } catch {
    throw new Error('GitLab local config is missing or invalid. Use a private regular JSON file (0600 on POSIX) with the fixed host, project, and a nonempty token.');
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return { host: HOST, project: PROJECT, token: value.token.trim() };
}

export function runWithLocalGitLabConfig(command, argv, { configFile, spawn = spawnSync } = {}) {
  if (!Object.hasOwn(ENTRIES, command)) throw new Error('Supported commands: scan, observe, orchestrate.');
  if (argv.some((arg) => /^--(?:gitlab-token(?:-stdin)?|token|password|secret)(?:=|$)/i.test(arg))) {
    throw new Error('Do not supply credential arguments; the wrapper provides stdin.');
  }
  const help = argv.includes('--help') || argv.includes('-h');
  const config = help ? null : readLocalGitLabConfig(configFile);
  const env = { ...process.env };
  for (const key of ['GITLAB_TOKEN', 'GLAB_TOKEN', 'PRIVATE_TOKEN']) delete env[key];
  const args = [path.join(ROOT, ENTRIES[command]), ...argv, ...(help ? [] : ['--gitlab-token-stdin'])];
  const result = spawn(process.execPath, args, {
    cwd: ROOT, env, input: config ? `${config.token}\n` : '',
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 50 * 1024 * 1024,
  });
  const redact = (text) => config ? String(text || '').split(config.token).join('[REDACTED]') : String(text || '');
  return { status: Number.isInteger(result.status) ? result.status : 1,
    stdout: redact(result.stdout), stderr: redact(result.stderr) || (result.error ? 'GitLab command could not complete.\n' : '') };
}
