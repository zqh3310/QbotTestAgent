import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const PROVIDER_MANIFEST_SCHEMA = 'qbot-core-beta-fixture-providers/v1';
const PROVIDER_RESPONSE_SCHEMA = 'qbot-core-beta-fixture-provider-response/v1';
const PREFLIGHT_SCHEMA = 'qbot-core-beta-fixture-preflight/v1';
const DRIVER_RESPONSE_SCHEMA = 'qbot-core-beta-driver-response/v1';
const MAX_PROVIDER_OUTPUT_BYTES = 2 * 1024 * 1024;

function json(response, status, body) {
  const payload = Buffer.from(`${JSON.stringify(body)}\n`);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
    'cache-control': 'no-store',
  });
  response.end(payload);
}

async function readJsonBody(request, maxBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error(`request_body_too_large:${bytes}`);
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
    : [];
}

function sameSetOrSuperset(actual, expected) {
  const actualSet = new Set(normalizeStringArray(actual));
  return normalizeStringArray(expected).every((item) => actualSet.has(item));
}

function validateLoopbackHost(value) {
  const host = String(value || '').trim();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`fixture controller must listen on loopback, got ${host || '(empty)'}`);
  }
  return host;
}

function readProviderManifest(file) {
  const resolved = path.resolve(String(file || ''));
  if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`fixture provider manifest not found: ${resolved || '(missing)'}`);
  }
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (parsed?.schema_version !== PROVIDER_MANIFEST_SCHEMA) {
    throw new Error(`fixture provider manifest schema must be ${PROVIDER_MANIFEST_SCHEMA}`);
  }
  const providers = Array.isArray(parsed.providers) ? parsed.providers : [];
  const ids = new Set();
  const normalized = providers.map((provider, index) => {
    const id = String(provider?.id || '').trim();
    const adapter = String(provider?.adapter || '').trim();
    const command = Array.isArray(provider?.command)
      ? provider.command.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    if (!id || ids.has(id)) throw new Error(`provider[${index}] id missing or duplicated`);
    ids.add(id);
    if (!adapter) throw new Error(`provider ${id} adapter is required`);
    if (!command.length) throw new Error(`provider ${id} command must be a non-empty argv array`);
    const caseIds = provider.case_ids === '*'
      ? '*'
      : normalizeStringArray(provider.case_ids);
    if (caseIds !== '*' && !caseIds.length) {
      throw new Error(`provider ${id} case_ids must be "*" or a non-empty array`);
    }
    const timeoutMs = Number(provider.timeout_ms || 20_000);
    if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
      throw new Error(`provider ${id} timeout_ms must be between 100 and 300000`);
    }
    return Object.freeze({
      id,
      adapter,
      command,
      case_ids: caseIds,
      cwd: path.resolve(path.dirname(resolved), String(provider.cwd || '.')),
      timeout_ms: timeoutMs,
      env: provider.env && typeof provider.env === 'object'
        ? Object.fromEntries(Object.entries(provider.env).map(([key, value]) => [String(key), String(value)]))
        : {},
    });
  });
  return {
    path: resolved,
    sha256: createHash('sha256').update(fs.readFileSync(resolved)).digest('hex'),
    providers: normalized,
  };
}

function providerMatches(provider, requirement) {
  return provider.adapter === String(requirement?.adapter || requirement?.fixture_control || '')
    && (provider.case_ids === '*' || provider.case_ids.includes(String(requirement?.case_id || '')));
}

function providerPublicView(provider) {
  return {
    id: provider.id,
    adapter: provider.adapter,
    case_ids: provider.case_ids,
    command_sha256: sha256(JSON.stringify(provider.command)),
    cwd: provider.cwd,
    timeout_ms: provider.timeout_ms,
  };
}

function invokeProvider(provider, requestBody) {
  return new Promise((resolve) => {
    const [executable, ...args] = provider.command;
    const child = spawn(executable, args, {
      cwd: provider.cwd,
      env: {
        ...process.env,
        ...provider.env,
        QBOT_CORE_BETA_PROVIDER_ID: provider.id,
        QBOT_CORE_BETA_PROVIDER_ADAPTER: provider.adapter,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let overflow = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, provider.timeout_ms);
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_PROVIDER_OUTPUT_BYTES) {
        overflow = true;
        child.kill('SIGKILL');
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= MAX_PROVIDER_OUTPUT_BYTES) stderr.push(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        reason: `provider_spawn_failed:${error?.message || error}`,
        provider: providerPublicView(provider),
      });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ ok: false, reason: `provider_timeout:${provider.timeout_ms}`, provider: providerPublicView(provider) });
        return;
      }
      if (overflow) {
        resolve({ ok: false, reason: 'provider_stdout_exceeded_limit', provider: providerPublicView(provider) });
        return;
      }
      const raw = Buffer.concat(stdout).toString('utf8').trim();
      let body = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        // Provider stderr/stdout can contain secrets. Only hashes and byte
        // counts are returned by the controller, never raw process output.
      }
      if (code !== 0 || !body) {
        resolve({
          ok: false,
          reason: code !== 0
            ? `provider_exit_nonzero:${code ?? 'null'}:${signal || 'none'}`
            : 'provider_response_not_json',
          provider: providerPublicView(provider),
          stdout_bytes: stdoutBytes,
          stdout_sha256: sha256(raw),
          stderr_bytes: stderrBytes,
          stderr_sha256: sha256(Buffer.concat(stderr).toString('utf8')),
        });
        return;
      }
      resolve({
        ok: true,
        body,
        provider: providerPublicView(provider),
        stdout_bytes: stdoutBytes,
        stdout_sha256: sha256(raw),
        stderr_bytes: stderrBytes,
        stderr_sha256: sha256(Buffer.concat(stderr).toString('utf8')),
      });
    });
    child.stdin.end(`${JSON.stringify(requestBody)}\n`);
  });
}

function validateProviderAcknowledgement(body, requirement, phase) {
  const reasons = [];
  if (body?.schema_version !== PROVIDER_RESPONSE_SCHEMA) reasons.push('schema_version_mismatch');
  if (body?.ok !== true) reasons.push('provider_not_ready');
  if (String(body?.phase || '') !== phase) reasons.push('phase_mismatch');
  if (String(body?.case_id || '') !== String(requirement.case_id || '')) reasons.push('case_id_mismatch');
  if (String(body?.adapter || '') !== String(requirement.adapter || requirement.fixture_control || '')) {
    reasons.push('adapter_mismatch');
  }
  if (String(body?.driver || '') !== String(requirement.driver || '')) reasons.push('driver_mismatch');
  if (String(body?.executor_route || '') !== String(requirement.executor_route || '')) {
    reasons.push('executor_route_mismatch');
  }
  if (String(body?.contract_sha256 || '') !== String(requirement.contract_sha256 || '')) {
    reasons.push('contract_sha256_mismatch');
  }
  if (!sameSetOrSuperset(body?.action_ids, requirement.action_ids)) reasons.push('action_ids_incomplete');
  if (!sameSetOrSuperset(body?.evidence_roles, requirement.evidence_roles)) reasons.push('evidence_roles_incomplete');
  if (!sameSetOrSuperset(body?.oracle_sha256s, requirement.oracle_sha256s)) reasons.push('oracle_sha256s_incomplete');
  const phases = normalizeStringArray(body?.supported_phases);
  for (const required of ['prepare', 'execute', 'restore']) {
    if (!phases.includes(required)) reasons.push(`supported_phase_missing:${required}`);
  }
  return { ok: reasons.length === 0, reasons };
}

function sanitizeRequirement(value) {
  return {
    case_id: String(value?.case_id || ''),
    adapter: String(value?.adapter || value?.fixture_control || ''),
    driver: String(value?.driver || ''),
    executor_route: String(value?.executor_route || ''),
    contract_sha256: String(value?.contract_sha256 || ''),
    action_ids: normalizeStringArray(value?.action_ids),
    evidence_roles: normalizeStringArray(value?.evidence_roles),
    oracle_sha256s: normalizeStringArray(value?.oracle_sha256s),
  };
}

export function createCoreBetaFixtureController({
  providerManifest,
  workDir,
  now = () => new Date(),
} = {}) {
  const manifest = readProviderManifest(providerManifest);
  const outputRoot = path.resolve(String(workDir || path.join(process.cwd(), '.runtime', 'core-beta-fixture-controller')));
  fs.mkdirSync(outputRoot, { recursive: true });
  const leases = new Map();
  const readyCases = new Map();

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/health') {
        json(response, 200, {
          ok: true,
          schema_version: 'qbot-core-beta-fixture-controller-health/v1',
          provider_manifest_sha256: manifest.sha256,
          provider_count: manifest.providers.length,
          lease_count: leases.size,
          ready_case_count: readyCases.size,
          checked_at: now().toISOString(),
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/core-beta/preflight') {
        const body = await readJsonBody(request);
        if (body?.schema_version !== PREFLIGHT_SCHEMA || !Array.isArray(body?.cases)) {
          json(response, 400, { ok: false, reason: 'invalid_preflight_contract' });
          return;
        }
        const requirements = body.cases.map(sanitizeRequirement);
        const outcomes = await Promise.all(requirements.map(async (requirement) => {
          const provider = manifest.providers.find((item) => providerMatches(item, requirement));
          if (!provider) {
            return { ok: false, case_id: requirement.case_id, adapter: requirement.adapter, reason: 'provider_missing' };
          }
          const invoked = await invokeProvider(provider, {
            schema_version: 'qbot-core-beta-fixture-provider-request/v1',
            phase: 'preflight',
            requirement,
            controller: {
              provider_manifest_sha256: manifest.sha256,
              provider: providerPublicView(provider),
            },
          });
          if (!invoked.ok) return { ...invoked, case_id: requirement.case_id, adapter: requirement.adapter };
          const validation = validateProviderAcknowledgement(invoked.body, requirement, 'preflight');
          if (!validation.ok) {
            return {
              ok: false,
              case_id: requirement.case_id,
              adapter: requirement.adapter,
              provider: invoked.provider,
              reason: `provider_ack_invalid:${validation.reasons.join(',')}`,
            };
          }
          const ready = {
            case_id: requirement.case_id,
            adapter: requirement.adapter,
            driver: requirement.driver,
            executor_route: requirement.executor_route,
            contract_sha256: requirement.contract_sha256,
            action_ids: requirement.action_ids,
            evidence_roles: requirement.evidence_roles,
            oracle_sha256s: requirement.oracle_sha256s,
            provider: invoked.provider,
            probe: {
              stdout_bytes: invoked.stdout_bytes,
              stdout_sha256: invoked.stdout_sha256,
              stderr_bytes: invoked.stderr_bytes,
              stderr_sha256: invoked.stderr_sha256,
            },
          };
          readyCases.set(requirement.case_id, { requirement, provider, ready });
          return { ok: true, ready };
        }));
        const failures = outcomes.filter((item) => !item.ok);
        const ready = outcomes.filter((item) => item.ok).map((item) => item.ready);
        const requestedAdapters = normalizeStringArray(body.required_adapters);
        const readyAdapters = requestedAdapters.filter((adapter) => (
          requirements.filter((item) => item.adapter === adapter).every((item) => (
            ready.some((candidate) => candidate.case_id === item.case_id)
          ))
        ));
        json(response, failures.length ? 424 : 200, {
          ok: failures.length === 0,
          schema_version: 'qbot-core-beta-fixture-preflight-response/v1',
          ready_adapters: readyAdapters,
          ready_cases: ready,
          unavailable_cases: failures.map((item) => ({
            case_id: item.case_id,
            adapter: item.adapter,
            reason: item.reason,
            provider: item.provider || null,
          })),
          provider_manifest_sha256: manifest.sha256,
          reason: failures.length ? `${failures.length} case provider probe(s) unavailable` : '',
          checked_at: now().toISOString(),
        });
        return;
      }

      const match = url.pathname.match(/^\/v1\/core-beta\/cases\/([^/]+)\/([^/]+)$/);
      if (request.method === 'POST' && match) {
        const caseId = decodeURIComponent(match[1]);
        const phase = decodeURIComponent(match[2]);
        const body = await readJsonBody(request);
        const prepared = readyCases.get(caseId);
        if (!prepared) {
          json(response, 412, { ok: false, reason: 'case_not_preflight_ready', case_id: caseId, phase });
          return;
        }
        const requirement = sanitizeRequirement(body);
        const validation = validateProviderAcknowledgement({
          schema_version: PROVIDER_RESPONSE_SCHEMA,
          ok: true,
          phase: 'request',
          ...requirement,
          supported_phases: ['prepare', 'execute', 'restore'],
        }, prepared.requirement, 'request');
        if (!validation.ok) {
          json(response, 409, {
            ok: false,
            reason: `case_request_contract_drift:${validation.reasons.join(',')}`,
            case_id: caseId,
            phase,
          });
          return;
        }
        const leaseId = String(body.lease_id || '');
        if (phase !== 'prepare') {
          const lease = leases.get(leaseId);
          if (!lease || lease.case_id !== caseId || lease.contract_sha256 !== requirement.contract_sha256) {
            json(response, 409, { ok: false, reason: 'fixture_lease_missing_or_mismatched', case_id: caseId, phase });
            return;
          }
        }
        const invoked = await invokeProvider(prepared.provider, {
          schema_version: 'qbot-core-beta-fixture-provider-request/v1',
          phase,
          requirement,
          lease_id: leaseId || null,
          payload: body,
          controller: {
            provider_manifest_sha256: manifest.sha256,
            provider: providerPublicView(prepared.provider),
          },
        });
        if (!invoked.ok || invoked.body?.ok !== true) {
          json(response, 424, {
            ok: false,
            reason: invoked.reason || invoked.body?.reason || 'provider_phase_failed',
            case_id: caseId,
            phase,
            provider: invoked.provider,
          });
          return;
        }
        if (phase === 'prepare') {
          const createdLeaseId = String(invoked.body.lease_id || randomUUID());
          leases.set(createdLeaseId, {
            case_id: caseId,
            contract_sha256: requirement.contract_sha256,
            provider_id: prepared.provider.id,
            created_at: now().toISOString(),
          });
          json(response, 200, {
            ...invoked.body,
            ok: true,
            case_id: caseId,
            lease_id: createdLeaseId,
            provider: invoked.provider,
          });
          return;
        }
        if (phase === 'restore') leases.delete(leaseId);
        if (phase === 'execute' && invoked.body.schema_version !== DRIVER_RESPONSE_SCHEMA) {
          json(response, 424, { ok: false, reason: `execute_response_schema_must_be:${DRIVER_RESPONSE_SCHEMA}` });
          return;
        }
        json(response, 200, {
          ...invoked.body,
          ok: true,
          case_id: caseId,
          lease_id: leaseId,
          provider: invoked.provider,
        });
        return;
      }
      json(response, 404, { ok: false, reason: 'not_found' });
    } catch (error) {
      json(response, 500, { ok: false, reason: error?.message || String(error) });
    }
  });

  return {
    server,
    manifest: {
      path: manifest.path,
      sha256: manifest.sha256,
      providers: manifest.providers.map(providerPublicView),
    },
    listen({ host = '127.0.0.1', port = 0 } = {}) {
      const loopback = validateLoopbackHost(host);
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(Number(port), loopback, () => {
          server.off('error', reject);
          const address = server.address();
          resolve({
            host: loopback,
            port: typeof address === 'object' && address ? address.port : Number(port),
          });
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

export const CORE_BETA_FIXTURE_PROVIDER_SCHEMAS = Object.freeze({
  manifest: PROVIDER_MANIFEST_SCHEMA,
  provider_response: PROVIDER_RESPONSE_SCHEMA,
  driver_response: DRIVER_RESPONSE_SCHEMA,
});
