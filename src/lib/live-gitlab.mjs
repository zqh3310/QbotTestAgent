import { execFileSync } from 'node:child_process';
import { normalizeIssue } from './issues.mjs';

const CURL_BINARY = process.platform === 'win32' ? 'curl.exe' : 'curl';

function gitlabUrl(host, endpoint) {
  return `https://${host}/api/v4/${endpoint}`;
}

function commandError(error) {
  const stderr = error.stderr ? String(error.stderr).trim() : '';
  return stderr || error.message || 'command failed';
}

function parseApiJson(stdout, source) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`GitLab API returned invalid JSON from ${source}: ${error.message}`);
  }
}

function makeApiReader(host) {
  let glabAvailable = true;
  try {
    execFileSync('glab', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    glabAvailable = false;
  }

  return function readApi(endpoint) {
    const errors = [];
    if (glabAvailable) {
      try {
        const stdout = execFileSync('glab', ['api', '--hostname', host, endpoint], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 50 * 1024 * 1024,
        });
        return { stdout, source: `glab api --hostname ${host} ${endpoint}` };
      } catch (error) {
        errors.push(`glab: ${commandError(error)}`);
        glabAvailable = false;
      }
    }

    const token = process.env.GITLAB_TOKEN || process.env.GLAB_TOKEN || process.env.PRIVATE_TOKEN || '';
    const args = ['-k', '-sS', '--max-time', '60'];
    if (token) args.push('--header', `PRIVATE-TOKEN: ${token}`);
    args.push(gitlabUrl(host, endpoint));

    try {
      const stdout = execFileSync(CURL_BINARY, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 50 * 1024 * 1024,
      });
      return { stdout, source: `curl ${gitlabUrl(host, endpoint)}` };
    } catch (error) {
      errors.push(`curl: ${commandError(error)}`);
      throw new Error(`Unable to read GitLab API ${endpoint}: ${errors.join('; ')}`);
    }
  };
}

function readJson(readApi, endpoint) {
  const { stdout, source } = readApi(endpoint);
  return { value: parseApiJson(stdout, source), source };
}

export function loadLiveGitLabIssues({ host, projectPath, maxPages = 100 }) {
  const encodedProject = encodeURIComponent(projectPath);
  const byIid = new Map();
  const sources = [];
  const readApi = makeApiReader(host);

  for (let page = 1; page <= maxPages; page += 1) {
    const endpoint = `projects/${encodedProject}/issues?state=all&per_page=100&page=${page}&order_by=updated_at&sort=desc`;
    const { value: pageIssues, source } = readJson(readApi, endpoint);
    sources.push(source);
    if (!Array.isArray(pageIssues)) throw new Error(`GitLab API returned non-array response for page ${page}.`);
    for (const issue of pageIssues) {
      if (Number.isFinite(issue.iid)) byIid.set(issue.iid, issue);
    }
    if (pageIssues.length < 100) break;
  }

  const issues = [];
  for (const iid of [...byIid.keys()].sort((a, b) => a - b)) {
    const endpoint = `projects/${encodedProject}/issues/${iid}`;
    const { value: detailIssue, source } = readJson(readApi, endpoint);
    sources.push(source);
    if (!Number.isFinite(detailIssue.iid)) throw new Error(`GitLab issue detail response for #${iid} has no iid.`);
    issues.push(normalizeIssue(detailIssue));
  }

  return { issues, sources, errors: [] };
}
