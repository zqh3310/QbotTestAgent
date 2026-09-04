import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  QWORK_RELEASE_INTAKE_SCHEMA,
  QWORK_RELEASE_INTAKE_TOOL_VERSION,
  mapReleaseImpact,
  scanQworkReleaseIntake,
  sha256Text,
  stableJson,
  validateQworkReleaseIntake,
  writeQworkReleaseIntake,
} from '../src/lib/qwork-release-intake.mjs';
import {
  QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT,
  QWORK_MR1546_REJECTED_REGENERATE_CONTRACT,
  QWORK_MR1557_IMMEDIATE_REGENERATE_PROJECTION_CONTRACT,
  QWORK_MR1550_CLAUDE_SKILL_DESCRIPTION_ROUTING_CONTRACT,
  QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT,
  QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT,
  QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT,
  QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT,
  QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT,
  QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT,
  QWORK_RELEASE_SOURCE_CLAIM_SCOPE,
  QWORK_RELEASE_SOURCE_CONTRACTS,
  QWORK_RELEASE_SOURCE_OWNER_SCOPE_SCHEMA,
  QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED,
  auditCurrentReleaseSourceContract,
  auditReleaseSourceContract,
  normalizeGitLabChanges,
  reconstructGitLabAddedLinesSource,
  reconstructGitLabNewFileSource,
  releaseSourceContractProtectedPaths,
  releaseSourceContractTrigger,
  resolveCurrentReleaseHeaderContract,
  resolveReleaseSourceContracts,
  summarizeGitLabChanges,
  validateCurrentReleaseSourceContractAttestation,
  validateReleaseSourceContractAttestation,
  validateReleaseSourceContractsForReport,
} from '../src/lib/qwork-release-source-contracts.mjs';
import { validateQworkReleaseIntakeBinding } from '../src/lib/qwork-release-test-plan.mjs';
import {
  QWORK_MR1552_LEGACY_PROTECTED_PATHS,
  QWORK_MR1552_MERGE_COMMIT_SHA,
  QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID,
  QWORK_MR1559_MERGE_COMMIT_SHA,
  QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS,
} from '../src/lib/qwork-release-blocking-risks.mjs';

function git(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function gitBlobSha1(source) {
  const body = Buffer.from(source, 'utf8');
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${body.length}\0`, 'utf8'),
    body,
  ])).digest('hex');
}

function gitLabFilePayload(filePath, source, head) {
  return {
    file_name: path.basename(filePath),
    file_path: filePath,
    size: Buffer.byteLength(source, 'utf8'),
    encoding: 'base64',
    content: Buffer.from(source, 'utf8').toString('base64'),
    ref: head,
    blob_id: gitBlobSha1(source),
    commit_id: head,
    last_commit_id: head,
  };
}

function commit(repo, file, value, message) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), value);
  git(repo, 'add', file);
  git(repo, 'commit', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

function fixtureRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-intake-repo-'));
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.email', 'qa@example.invalid');
  git(repo, 'config', 'user.name', 'QA');
  const root = commit(repo, 'README.md', 'initial\n', 'initial');
  git(repo, 'checkout', '-b', 'release/0.1');
  const baseline = root;
  fs.mkdirSync(path.join(repo, 'server', 'qbot-core', 'automation'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'server', 'qbot-core', 'automation', 'scheduler.mjs'), 'export const schedule = true;\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', "Merge branch 'feature/automation' into release/0.1 (!101)");
  const releaseHead = git(repo, 'rev-parse', 'HEAD');
  return { repo, baseline, releaseHead };
}

function currentReleaseFileFixtures(contracts, head) {
  const linesByPath = new Map();
  const addLine = (filePath, line) => {
    if (!linesByPath.has(filePath)) linesByPath.set(filePath, []);
    const lines = linesByPath.get(filePath);
    if (line && !lines.includes(line)) lines.push(line);
  };
  const appendLine = (filePath, line) => {
    if (!linesByPath.has(filePath)) linesByPath.set(filePath, []);
    if (line) linesByPath.get(filePath).push(line);
  };
  const ancestryByContractId = new Map(contracts.map((contract) => [contract.contract_id, {
    verified: true,
    first_parent_complete: true,
  }]));
  for (const contract of contracts) {
    const headerOwner = resolveCurrentReleaseHeaderContract(contract, {
      contracts,
      ancestryByContractId,
    }).owner;
    const replacedBindingIds = new Set((headerOwner.supersedes || [])
      .find((item) => item.contract_id === contract.contract_id)?.current_assertions
      ?.filter((item) => item.startsWith('integration_binding:'))
      .map((item) => item.slice('integration_binding:'.length)) || []);
    for (const filePath of releaseSourceContractProtectedPaths(contract)) {
      if (!linesByPath.has(filePath)) linesByPath.set(filePath, []);
    }
    for (const filePath of releaseSourceContractProtectedPaths(headerOwner)) {
      if (!linesByPath.has(filePath)) linesByPath.set(filePath, []);
    }
    for (const header of headerOwner.header_emissions) {
      addLine(headerOwner.source_file.path, header.value_definition?.source);
      addLine(headerOwner.source_file.path, header.emission?.source);
    }
    for (const binding of contract.integration_bindings.filter((item) => (
      !item.current_release_scope && !replacedBindingIds.has(item.id)
    ))) {
      addLine(binding.path, binding.addition?.source);
    }
    for (const binding of contract.integration_bindings.filter((item) => item.current_release_scope)) {
      appendLine(binding.path, binding.current_release_scope.owner_start.source);
      for (const fragment of binding.current_release_scope.required_fragments) {
        appendLine(binding.path, fragment.value.source);
      }
    }
  }
  return new Map([...linesByPath].map(([filePath, lines], index) => {
    const source = `${lines.join('\n')}\n`;
    return [filePath, {
      file_name: path.basename(filePath),
      file_path: filePath,
      size: Buffer.byteLength(source, 'utf8'),
      encoding: 'base64',
      content: Buffer.from(source, 'utf8').toString('base64'),
      ref: head,
      blob_id: String(index + 1).padStart(40, '1').slice(-40),
      commit_id: head,
      last_commit_id: head,
    }];
  }));
}

function apiFixture({
  baseline = 'a'.repeat(40),
  head = 'b'.repeat(40),
  afterHead = head,
  mrState = 'merged',
  targetBranch = 'release/0.1',
  mergeCommitSha = head,
  squashCommitSha = '',
  mrIid = 901,
  changesCount = '1',
  changes = [{ old_path: 'README.md', new_path: 'docs/release.md', diff: '+release' }],
  overflow = false,
  omitHeadFromCompare = false,
  sourceContracts = QWORK_RELEASE_SOURCE_CONTRACTS,
  releaseFileOverrides = new Map(),
  failContractAncestry = false,
  compareCommits = null,
  commitMrRows = null,
  mrChangesByIid = null,
} = {}) {
  let branchReads = 0;
  const releaseFiles = currentReleaseFileFixtures(sourceContracts, head);
  for (const [filePath, payload] of releaseFileOverrides) releaseFiles.set(filePath, payload);
  const reader = (endpoint) => {
    if (endpoint.startsWith('repository/branches/')) {
      branchReads += 1;
      return { commit: { id: branchReads === 1 ? head : afterHead } };
    }
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      const from = query.get('from');
      const to = query.get('to');
      const isContractAncestry = sourceContracts.some((contract) => contract.merge_commit_sha === from);
      if (isContractAncestry && failContractAncestry) return { compare_timeout: false, commits: [] };
      if (from === baseline && to === head && Array.isArray(compareCommits)) {
        return { compare_timeout: false, commits: omitHeadFromCompare ? [] : compareCommits };
      }
      if (from === head && [QWORK_MR1552_MERGE_COMMIT_SHA, QWORK_MR1559_MERGE_COMMIT_SHA].includes(to)) {
        if (head === QWORK_MR1559_MERGE_COMMIT_SHA) return { compare_timeout: false, commits: [] };
        return {
          compare_timeout: false,
          commits: [{
            id: to,
            parent_ids: [head],
            title: 'Synthetic forward history fixture',
            message: 'Synthetic forward history fixture',
            committed_date: '2026-09-03T01:00:00Z',
          }],
        };
      }
      if ([QWORK_MR1552_MERGE_COMMIT_SHA, QWORK_MR1559_MERGE_COMMIT_SHA].includes(from)
        && to === head) {
        return { compare_timeout: false, commits: [] };
      }
      return {
        compare_timeout: false,
        commits: omitHeadFromCompare ? [] : [{
          id: head,
          parent_ids: [isContractAncestry ? from : baseline, 'c'.repeat(40)],
          title: 'Merge branch feature into release/0.1',
          message: 'Merge branch feature into release/0.1',
          committed_date: '2026-09-03T01:00:00Z',
        }],
      };
    }
    const commitMrMatch = endpoint.match(/^repository\/commits\/([a-f0-9]{40})\/merge_requests$/i);
    if (commitMrMatch) {
      const commitSha = commitMrMatch[1];
      const override = commitMrRows instanceof Map
        ? commitMrRows.get(commitSha)
        : commitMrRows?.[commitSha];
      if (override !== undefined) return override;
      if (commitSha !== head) return [];
      return [{
        iid: mrIid,
        title: 'release change',
        state: mrState,
        target_branch: targetBranch,
        source_branch: 'feature/release-change',
        merge_commit_sha: mergeCommitSha,
        squash_commit_sha: squashCommitSha,
        merged_at: '2026-09-03T01:00:00Z',
        labels: ['area/runtime'],
      }];
    }
    const changesMatch = endpoint.match(/^merge_requests\/([^/]+)\/changes$/);
    if (changesMatch) {
      const iid = changesMatch[1];
      const override = mrChangesByIid instanceof Map
        ? mrChangesByIid.get(iid)
        : mrChangesByIid?.[iid];
      if (override !== undefined) return override;
      if (String(iid) !== String(mrIid)) throw new Error(`missing MR changes fixture ${iid}`);
      return {
        iid: mrIid,
        state: mrState,
        target_branch: targetBranch,
        merge_commit_sha: mergeCommitSha,
        squash_commit_sha: squashCommitSha,
        changes_count: changesCount,
        overflow,
        changes,
      };
    }
    if (endpoint.startsWith('repository/files/')) {
      const encodedPath = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      const filePath = decodeURIComponent(encodedPath);
      if (!releaseFiles.has(filePath)) throw new Error(`missing release file fixture ${filePath}`);
      return releaseFiles.get(filePath);
    }
    throw new Error(`unexpected endpoint ${endpoint}`);
  };
  return { baseline, head, reader };
}

function byteRecord(source) {
  return {
    source,
    bytes: Buffer.byteLength(source, 'utf8'),
    sha256: sha256Text(source),
  };
}

function sourceContractFixture() {
  const sourceLines = [
    'const userAgent = `SID_${sessionId}#TID_${turnId}`;',
    'lines.push(`User-Agent: ${userAgent}`);',
    "appendHeader(lines, 'x-session-id', sessionId);",
    "appendHeader(lines, 'x-turn-id', turnId);",
    "appendHeader(lines, 'x-request-id', requestId);",
    "appendHeader(lines, 'x-request-time', requestTime);",
    'export { lines };',
  ];
  const source = `${sourceLines.join('\n')}\n`;
  const sourcePath = 'server/qbot-core/models/test-turn-headers.mjs';
  const sourceChange = {
    old_path: sourcePath,
    new_path: sourcePath,
    new_file: true,
    renamed_file: false,
    deleted_file: false,
    diff: `@@ -0,0 +1,${sourceLines.length} @@\n${sourceLines.map((line) => `+${line}`).join('\n')}\n`,
  };
  const hostAddition = 'session: turnSession, turnId: currentTurnId,';
  const engineAddition = 'env = withTurnHeaders(env, { sessionId, turnId, requestId, requestTime });';
  const fallbackTurnAddition = 'session: { ...fallbackSession, agentSessionId: null }, turnId,';
  const fallbackContextAddition = 'fallbackSession: null, turnRequestContext: requestContext,';
  const changes = [
    {
      old_path: 'electron/host.cjs',
      new_path: 'electron/host.cjs',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -1 +1,2 @@\n context\n+${hostAddition}\n`,
    },
    {
      old_path: 'server/qbot-core/engine.mjs',
      new_path: 'server/qbot-core/engine.mjs',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -1 +1,4 @@\n context\n+${engineAddition}\n+${fallbackTurnAddition}\n+${fallbackContextAddition}\n`,
    },
    sourceChange,
  ];
  const summarized = summarizeGitLabChanges(changes);
  const normalizedSourceChange = normalizeGitLabChanges([sourceChange])[0];
  const definition = {
    claim_scope: QWORK_RELEASE_SOURCE_CLAIM_SCOPE,
    test_execution_attested: QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED,
    contract_id: 'test-turn-headers/v1',
    mr_iid: '42',
    state: 'merged',
    target_branch: 'release/0.1',
    merge_commit_sha: '4'.repeat(40),
    changes_count: changes.length,
    changed_paths: summarized.paths,
    mr_diff: {
      bytes: summarized.diff_bytes,
      sha256: summarized.diff_sha256,
    },
    source_file: {
      proof_mode: 'exact-new-file',
      path: sourcePath,
      old_path: sourcePath,
      new_file: true,
      renamed_file: false,
      deleted_file: false,
      change_bytes: Buffer.byteLength(stableJson(normalizedSourceChange), 'utf8'),
      change_sha256: sha256Text(stableJson(normalizedSourceChange)),
      source_bytes: Buffer.byteLength(source, 'utf8'),
      source_sha256: sha256Text(source),
      source_line_count: sourceLines.length,
    },
    header_emissions: [
      {
        name: 'user-agent',
        wire_name: 'User-Agent',
        value_source: 'userAgent',
        value_template: 'SID_${sessionId}#TID_${turnId}',
        value_definition: byteRecord(sourceLines[0]),
        emission: byteRecord(sourceLines[1]),
      },
      ...[
        ['x-session-id', 'sessionId', sourceLines[2]],
        ['x-turn-id', 'turnId', sourceLines[3]],
        ['x-request-id', 'requestId', sourceLines[4]],
        ['x-request-time', 'requestTime', sourceLines[5]],
      ].map(([name, valueSource, line]) => ({
        name,
        wire_name: name,
        value_source: valueSource,
        emission: byteRecord(line),
      })),
    ],
    integration_bindings: [
      { id: 'host_turn', path: 'electron/host.cjs', addition: byteRecord(hostAddition) },
      { id: 'engine_env', path: 'server/qbot-core/engine.mjs', addition: byteRecord(engineAddition) },
      { id: 'fallback_turn', path: 'server/qbot-core/engine.mjs', addition: byteRecord(fallbackTurnAddition) },
      { id: 'fallback_context', path: 'server/qbot-core/engine.mjs', addition: byteRecord(fallbackContextAddition) },
    ],
  };
  const contract = {
    ...definition,
    contract_sha256: sha256Text(stableJson(definition)),
  };
  return { changes, contract, source };
}

function exactAddedLinesContractFixture(baseContract) {
  const additionsByPath = new Map(baseContract.changed_paths.map((filePath) => [filePath, []]));
  const add = (filePath, line) => {
    const lines = additionsByPath.get(filePath) || [];
    if (line && !lines.includes(line)) lines.push(line);
    additionsByPath.set(filePath, lines);
  };
  for (const header of baseContract.header_emissions) {
    add(baseContract.source_file.path, header.value_definition?.source);
    add(baseContract.source_file.path, header.emission?.source);
  }
  for (const binding of baseContract.integration_bindings) add(binding.path, binding.addition.source);
  while ((additionsByPath.get(baseContract.source_file.path) || []).length < baseContract.source_file.source_line_count) {
    add(baseContract.source_file.path, `const fixturePadding${additionsByPath.get(baseContract.source_file.path).length} = true;`);
  }
  for (const [filePath, lines] of additionsByPath) {
    if (!lines.length) lines.push(`const fixtureFor${sha256Text(filePath).slice(0, 8)} = true;`);
  }
  const changes = baseContract.changed_paths.map((filePath) => {
    const additions = additionsByPath.get(filePath);
    return {
      old_path: filePath,
      new_path: filePath,
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -1,3 +1,${additions.length + 2} @@\n const before = true;\n-const stale = true;\n+${additions.join('\n+')}\n const after = true;\n`,
    };
  });
  const summary = summarizeGitLabChanges(changes);
  const sourceChange = normalizeGitLabChanges(changes)
    .find((change) => change.new_path === baseContract.source_file.path);
  const source = `${additionsByPath.get(baseContract.source_file.path).join('\n')}\n`;
  const definition = {
    ...structuredClone(baseContract),
    mr_diff: { bytes: summary.diff_bytes, sha256: summary.diff_sha256 },
    source_file: {
      ...structuredClone(baseContract.source_file),
      change_bytes: Buffer.byteLength(stableJson(sourceChange), 'utf8'),
      change_sha256: sha256Text(stableJson(sourceChange)),
      source_bytes: Buffer.byteLength(source, 'utf8'),
      source_sha256: sha256Text(source),
      source_line_count: additionsByPath.get(baseContract.source_file.path).length,
    },
  };
  delete definition.contract_sha256;
  return {
    changes,
    source,
    contract: {
      ...definition,
      contract_sha256: sha256Text(stableJson(definition)),
    },
  };
}

function exactNewFileContractFixture(baseContract) {
  const additionsByPath = new Map(baseContract.changed_paths.map((filePath) => [filePath, []]));
  const add = (filePath, line) => {
    const lines = additionsByPath.get(filePath) || [];
    if (line && !lines.includes(line)) lines.push(line);
    additionsByPath.set(filePath, lines);
  };
  for (const header of baseContract.header_emissions) {
    add(baseContract.source_file.path, header.value_definition?.source);
    add(baseContract.source_file.path, header.emission?.source);
  }
  for (const binding of baseContract.integration_bindings) add(binding.path, binding.addition.source);
  while ((additionsByPath.get(baseContract.source_file.path) || []).length < baseContract.source_file.source_line_count) {
    add(baseContract.source_file.path, `const fixturePadding${additionsByPath.get(baseContract.source_file.path).length} = true;`);
  }
  for (const [filePath, lines] of additionsByPath) {
    if (!lines.length) lines.push(`const fixtureFor${sha256Text(filePath).slice(0, 8)} = true;`);
  }
  const changes = baseContract.changed_paths.map((filePath) => {
    const additions = additionsByPath.get(filePath);
    if (filePath === baseContract.source_file.path) {
      return {
        old_path: filePath,
        new_path: filePath,
        new_file: true,
        renamed_file: false,
        deleted_file: false,
        diff: `@@ -0,0 +1,${additions.length} @@\n${additions.map((line) => `+${line}`).join('\n')}\n`,
      };
    }
    return {
      old_path: filePath,
      new_path: filePath,
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -1 +1,${additions.length + 1} @@\n const before = true;\n${additions.map((line) => `+${line}`).join('\n')}\n`,
    };
  });
  const summary = summarizeGitLabChanges(changes);
  const sourceChange = normalizeGitLabChanges(changes)
    .find((change) => change.new_path === baseContract.source_file.path);
  const source = `${additionsByPath.get(baseContract.source_file.path).join('\n')}\n`;
  const definition = {
    ...structuredClone(baseContract),
    mr_diff: { bytes: summary.diff_bytes, sha256: summary.diff_sha256 },
    source_file: {
      ...structuredClone(baseContract.source_file),
      change_bytes: Buffer.byteLength(stableJson(sourceChange), 'utf8'),
      change_sha256: sha256Text(stableJson(sourceChange)),
      source_bytes: Buffer.byteLength(source, 'utf8'),
      source_sha256: sha256Text(source),
      source_line_count: additionsByPath.get(baseContract.source_file.path).length,
    },
  };
  delete definition.contract_sha256;
  return {
    changes,
    source,
    contract: {
      ...definition,
      contract_sha256: sha256Text(stableJson(definition)),
    },
  };
}

function mr1561OriginChanges() {
  return [
    {
      old_path: 'electron/host-core/agent/execution-worker-protocol.cjs',
      new_path: 'electron/host-core/agent/execution-worker-protocol.cjs',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -2,7 +2,7 @@ const { LATE_CONTEXT_USAGE_RETENTION_MS } = require('./execution-worker-context-
 const { validateContextUsagePayload } = require('./execution-worker-context-usage-protocol.cjs');
${' '}
 const PROTOCOL_VERSION = 1;
-const MAX_ENVELOPE_BYTES = 256 * 1024;
+const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;
 const MAX_EXECUTION_START_ENVELOPE_BYTES = 32 * 1024 * 1024;
 const EXPERT_DRAFT_AUTHORING_CAPABILITY_PURPOSE = 'expert-draft-authoring-v1';
 const MEMORY_AUGMENTATION_CAPABILITY_PURPOSE = 'memory-augmentation-v1';
`,
    },
    {
      old_path: 'test/unit/desktop/execution-worker-supervisor.test.mjs',
      new_path: 'test/unit/desktop/execution-worker-supervisor.test.mjs',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -501,13 +501,15 @@ test('protocol rejects unknown, expired, oversized and identity-free messages',
   });
 });
${' '}
-test('execution start accepts model context above the control-envelope limit', () => {
+test('execution messages share the 32 MiB envelope limit', () => {
   const identity = { ...authority, requestId: 'large-turn', ownershipGeneration: 'o1', sessionId: 's1', turnId: 't1' };
-  const payload = { input: { text: 'x'.repeat(MAX_ENVELOPE_BYTES + 1) } };
+  assert.equal(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);
+  const payload = { input: { text: 'x'.repeat(MAX_ENVELOPE_BYTES - 1024) } };
   const message = createEnvelope('execution.start', identity, payload);
-  assert.equal(message.payload.input.text.length, MAX_ENVELOPE_BYTES + 1);
-  assert.ok(MAX_EXECUTION_START_ENVELOPE_BYTES > MAX_ENVELOPE_BYTES);
-  assert.throws(() => createEnvelope('interaction.resolve', identity, payload), {
+  assert.equal(message.payload.input.text.length, MAX_ENVELOPE_BYTES - 1024);
+  assert.throws(() => createEnvelope('interaction.resolve', identity, {
+    input: { text: 'x'.repeat(MAX_ENVELOPE_BYTES) },
+  }), {
     code: 'execution_worker_message_too_large',
   });
   assert.throws(() => createEnvelope('execution.start', identity, {
`,
    },
  ];
}

function mr1560OriginChanges() {
  return [
    {
      old_path: 'electron/host-core/agent/desktop-host-context.cjs',
      new_path: 'electron/host-core/agent/desktop-host-context.cjs',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -10097,7 +10097,7 @@ function registerDesktopAgentHost(ipcMain, {
         (SPAN_NAMES && SPAN_NAMES.SESSION_PREPARE) || 'qbot.session.prepare',
         { 'qbot.phase': 'turn_authority' },
         { parent: acceptSpan, errorClass: 'turn_authority' },
-        async () => currentTurnAuthorityForScope(turnScope, userId, {
+        async () => require('./turn-authority-readiness.cjs').readReadyTurnAuthority(() => currentTurnAuthorityForScope(turnScope, userId, {
           resolveCurrentTurnState: backgroundTurn
             ? () => desktopBackgroundAutomationTurnState(
                 userId,
@@ -10105,7 +10105,7 @@ function registerDesktopAgentHost(ipcMain, {
                 turnRequestId,
               )
             : () => desktopTurnState(userId),
-        }),
+        })),
       );
     } catch (error) {
       releaseRejectedPersistedDraftTurn();
`,
    },
    {
      old_path: 'electron/host-core/agent/turn-authority-readiness.cjs',
      new_path: 'electron/host-core/agent/turn-authority-readiness.cjs',
      new_file: true,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -0,0 +1,18 @@
+// Observe lifecycle-owned local projections; never initiate refresh or re-accept a turn.
+async function readReadyTurnAuthority(read, {
+  timeoutMs = 10_000,
+  intervalMs = 100,
+  now = Date.now,
+  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
+} = {}) {
+  const deadline = now() + timeoutMs;
+  for (;;) {
+    const result = await read();
+    if (result?.ok || result?.code !== 'desktop_model_authority_not_ready') return result;
+    const remaining = deadline - now();
+    if (remaining <= 0) return result;
+    await wait(Math.min(intervalMs, remaining));
+  }
+}
+
+module.exports = { readReadyTurnAuthority };
`,
    },
    {
      old_path: 'scripts/ci/unit/node-unit-test-weights.json',
      new_path: 'scripts/ci/unit/node-unit-test-weights.json',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -4367,6 +4367,14 @@
       "setupWeightMs": 0,
       "durationMs": 6133
     },
+    {
+      "file": "test/unit/desktop/turn-authority-readiness.test.mjs",
+      "blobSha": "fa9aba734ba8dfb2b71d6fb050a29c2207f1cdab",
+      "sampleCount": 0,
+      "testWeightMs": 1493,
+      "setupWeightMs": 0,
+      "durationMs": 1493
+    },
     {
       "file": "test/unit/electron/desktop-network-diagnostics.test.mjs",
       "blobSha": "12966b1e8648174a63eeef68a44ab552eb78f8ce",
`,
    },
    {
      old_path: 'test/unit/desktop/turn-authority-readiness.test.mjs',
      new_path: 'test/unit/desktop/turn-authority-readiness.test.mjs',
      new_file: true,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -0,0 +1,45 @@
+import assert from 'node:assert/strict';
+import { createRequire } from 'node:module';
+import test from 'node:test';
+
+const { readReadyTurnAuthority } = createRequire(import.meta.url)('../../../electron/host-core/agent/turn-authority-readiness.cjs');
+const pending = { ok: false, code: 'desktop_model_authority_not_ready' };
+// 契约(desktop-host,#1634,2026-09-04): cache-first local authority wait stays within one accept.
+
+test('valid last-good authority is returned without waiting', async () => {
+  const ready = { ok: true, modelAuthority: {} };
+  assert.equal(await readReadyTurnAuthority(() => ready, {
+    wait: () => assert.fail('last-good must be immediate'),
+  }), ready);
+});
+
+test('cold model authority observes local refresh without re-accepting the turn', async () => {
+  let reads = 0, elapsed = 0;
+  const ready = { ok: true };
+  assert.equal(await readReadyTurnAuthority(() => ++reads === 3 ? ready : pending, {
+    now: () => elapsed,
+    wait: async (ms) => { elapsed += ms; },
+  }), ready);
+  assert.equal(reads, 3);
+  assert.equal(elapsed, 200);
+});
+
+test('missing model authority fails within a bounded preparation window', async () => {
+  let elapsed = 0;
+  assert.equal(await readReadyTurnAuthority(() => pending, {
+    timeoutMs: 250, now: () => elapsed,
+    wait: async (ms) => { elapsed += ms; },
+  }), pending);
+  assert.equal(elapsed, 250);
+});
+
+test('scope changes and permanent permission failures stop the wait', async () => {
+  for (const code of ['desktop_local_context_superseded', 'desktop_local_authority_not_ready']) {
+    let reads = 0;
+    const rejected = { ok: false, code };
+    assert.equal(await readReadyTurnAuthority(() => ++reads === 1 ? pending : rejected, {
+      wait: async () => {},
+    }), rejected);
+    assert.equal(reads, 2);
+  }
+});
`,
    },
  ];
}

function verifiedAttestation(contract) {
  const value = {
    schema_version: 'qbot-qwork-release-source-contract/v1',
    claim_scope: contract.claim_scope,
    test_execution_attested: contract.test_execution_attested,
    contract_id: contract.contract_id,
    status: 'VERIFIED',
    verified: true,
    source: 'gitlab-api-changes',
    contract_sha256: contract.contract_sha256,
    mr: {
      iid: contract.mr_iid,
      state: contract.state,
      target_branch: contract.target_branch,
      merge_commit_sha: contract.merge_commit_sha,
      changes_count: contract.changes_count,
      changed_paths: [...contract.changed_paths],
      diff_bytes: contract.mr_diff.bytes,
      diff_sha256: contract.mr_diff.sha256,
    },
    source_file: {
      ...contract.source_file,
      source_line_count_observed: contract.source_file.source_line_count,
    },
    headers: contract.header_emissions.map((header) => ({
      ...header,
      emission_count: 1,
      value_definition_count: header.value_definition ? 1 : 0,
      verified: true,
    })),
    integration_bindings: contract.integration_bindings.map((binding) => ({
      ...binding,
      addition_count: 1,
      verified: true,
    })),
    forbidden_fragments: (contract.forbidden_fragments || []).map((assertion) => ({
      ...assertion,
      observation_scope: 'added-lines',
      occurrence_count: 0,
      verified: true,
    })),
    failures: [],
  };
  return {
    ...value,
    attestation_sha256: sha256Text(stableJson(value)),
  };
}

function auditFixture(fixture, overrides = {}) {
  return auditReleaseSourceContract({
    iid: fixture.contract.mr_iid,
    state: fixture.contract.state,
    targetBranch: fixture.contract.target_branch,
    mergeCommitSha: fixture.contract.merge_commit_sha,
    changesCount: fixture.contract.changes_count,
    changes: fixture.changes,
    contract: fixture.contract,
    ...overrides,
  });
}

function mr1522Report() {
  const contract = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  return {
    merge_requests: [{
      iid: contract.mr_iid,
      commit: contract.merge_commit_sha,
      diff_sha256: contract.mr_diff.sha256,
      diff_bytes: contract.mr_diff.bytes,
      changed_paths: [...contract.changed_paths],
      source_contract_ids: [contract.contract_id],
    }],
    source_contracts: [verifiedAttestation(contract)],
    summary: {
      source_contract_count: 1,
      source_contract_verified_count: 1,
      source_contract_failure_count: 0,
    },
    unresolved: { source_contract_failures: [] },
  };
}

test('source contract reconstructs an exact new file and emits a complete verified attestation', () => {
  const fixture = sourceContractFixture();
  const sourceChange = fixture.changes.find((change) => change.new_file);
  assert.equal(reconstructGitLabNewFileSource(sourceChange), fixture.source);
  const attestation = auditFixture(fixture);
  assert.equal(attestation.status, 'VERIFIED');
  assert.equal(attestation.verified, true);
  assert.deepEqual(attestation.failures, []);
  assert.deepEqual(attestation.headers.map((header) => [header.wire_name, header.value_source, header.verified]), [
    ['User-Agent', 'userAgent', true],
    ['x-session-id', 'sessionId', true],
    ['x-turn-id', 'turnId', true],
    ['x-request-id', 'requestId', true],
    ['x-request-time', 'requestTime', true],
  ]);
  assert.equal(attestation.integration_bindings.every((binding) => binding.verified), true);
  assert.match(attestation.attestation_sha256, /^[a-f0-9]{64}$/u);
});

test('exact-added-lines reconstructs ordered additions across context and deletions', () => {
  const fixture = exactAddedLinesContractFixture(QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT);
  const sourceChange = fixture.changes.find((change) => change.new_path === fixture.contract.source_file.path);
  assert.equal(reconstructGitLabAddedLinesSource(sourceChange), fixture.source);
  const attestation = auditFixture(fixture);
  assert.equal(attestation.status, 'VERIFIED');
  assert.deepEqual(attestation.failures, []);
  assert.equal(attestation.headers.every((header) => header.verified), true);
  assert.equal(attestation.integration_bindings.every((binding) => binding.verified), true);
  assert.equal(attestation.forbidden_fragments.every((assertion) => assertion.verified), true);
});

for (const scenario of [
  {
    name: 'reordered additions',
    mutate(change, source) {
      const [first, second] = source.replace(/\n$/u, '').split('\n');
      change.diff = change.diff.replace(`+${first}\n+${second}\n`, `+${second}\n+${first}\n`);
    },
  },
  {
    name: 'duplicate additions',
    mutate(change, source) {
      const [first, second] = source.replace(/\n$/u, '').split('\n');
      change.diff = change.diff.replace(`+${second}\n`, `+${first}\n`);
    },
  },
  {
    name: 'deleted addition',
    mutate(change, source) {
      const last = source.replace(/\n$/u, '').split('\n').at(-1);
      change.diff = change.diff.replace(`+${last}\n`, '');
      change.diff = change.diff.replace(/(\+1,)(\d+)( @@)/u, (_, prefix, count, suffix) => (
        `${prefix}${Number(count) - 1}${suffix}`
      ));
    },
  },
]) {
  test(`exact-added-lines blocks ${scenario.name}`, () => {
    const fixture = exactAddedLinesContractFixture(QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT);
    const changes = structuredClone(fixture.changes);
    const sourceChange = changes.find((change) => change.new_path === fixture.contract.source_file.path);
    scenario.mutate(sourceChange, fixture.source);
    const attestation = auditFixture(fixture, { changes });
    assert.equal(attestation.verified, false);
    assert.equal(attestation.failures.includes('source_source_sha256_mismatch'), true);
  });
}

test('exact-added-lines rejects malformed hunks and forbidden source regressions', () => {
  const malformedFixture = exactAddedLinesContractFixture(QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT);
  const malformedChanges = structuredClone(malformedFixture.changes);
  const malformedSource = malformedChanges.find((change) => change.new_path === malformedFixture.contract.source_file.path);
  malformedSource.diff = malformedSource.diff.replace(/(\+1,)(\d+)( @@)/u, (_, prefix, count, suffix) => (
    `${prefix}${Number(count) + 1}${suffix}`
  ));
  assert.throws(() => reconstructGitLabAddedLinesSource(malformedSource), /source_diff_line_count_mismatch/u);
  const malformedAttestation = auditFixture(malformedFixture, { changes: malformedChanges });
  assert.equal(malformedAttestation.verified, false);
  assert.equal(malformedAttestation.failures.some((failure) => failure.includes('source_diff_line_count_mismatch')), true);

  const forbiddenFixture = exactAddedLinesContractFixture(QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT);
  const forbiddenChanges = structuredClone(forbiddenFixture.changes);
  const forbiddenSource = forbiddenChanges.find((change) => change.new_path === forbiddenFixture.contract.source_file.path);
  forbiddenSource.diff = forbiddenSource.diff.replace(/\+const fixturePadding\d+ = true;/u, '+const retryAfterMs = 1000;');
  const forbiddenAttestation = auditFixture(forbiddenFixture, { changes: forbiddenChanges });
  assert.equal(forbiddenAttestation.verified, false);
  assert.equal(forbiddenAttestation.failures.includes('forbidden_fragment:retry_after_ms_absent_from_call_tool'), true);
});

test('MR !1544 and !1548 built-in contracts freeze exact source and behavioral assertions', () => {
  const header = QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT;
  assert.equal(header.merge_commit_sha, '16004bd34157448100945a8d50fa2d81c3e40153');
  assert.deepEqual(header.mr_diff, {
    bytes: 9047,
    sha256: 'b218b2fa93cb59bbef998547b1d3c991f5419a4b2642de1649f5765bb34e6be1',
  });
  assert.equal(header.source_file.proof_mode, 'exact-added-lines');
  assert.equal(header.source_file.source_bytes, 1062);
  assert.equal(header.source_file.source_line_count, 16);
  assert.equal(header.source_file.source_sha256, '39b518052df74d24b52b627a67f99fcedfb5aaccf68e6b32cdb5687c202d9e9b');
  assert.deepEqual(header.header_emissions.map((item) => item.wire_name), [
    'x-qwork-session',
    'x-qwork-session-id',
    'x-qwork-turn-id',
    'x-qwork-request-id',
    'x-qwork-request-time',
  ]);
  assert.match(header.header_emissions[0].value_template, /^qwork-SID_/u);
  assert.deepEqual(header.supersedes, [{
    contract_id: QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id,
    current_assertions: ['header_emissions'],
  }]);

  const budget = QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT;
  assert.equal(budget.merge_commit_sha, '0cd593b1fa29ff03a73d42ad845d2be31d9a6e26');
  assert.deepEqual(budget.mr_diff, {
    bytes: 3570,
    sha256: 'b08be0acf8c734c1f329ddc5e9c05931edee9336f62853a96217a52c2a4e98de',
  });
  assert.equal(budget.source_file.source_bytes, 329);
  assert.equal(budget.source_file.source_line_count, 4);
  assert.equal(budget.source_file.source_sha256, '7bc30e7a4541fcfaacafb39d52101320c8d0304f31c2ef2d7a04cfe781e83b24');
  const additions = budget.integration_bindings.map((item) => item.addition.source).join('\n');
  assert.match(additions, /maxCalls = Math\.max\(1, Math\.min\(1000,/u);
  assert.match(additions, /RATE_LIMITED.*retryable: false/u);
  assert.match(additions, /length: 128/u);
  assert.match(additions, /calls, 128/u);
  assert.match(additions, /isError !== true/u);
  assert.equal(budget.forbidden_fragments[0].value.source, 'retryAfterMs');

  for (const contract of [header, budget]) {
    const fixture = exactAddedLinesContractFixture(contract);
    const attestation = auditFixture(fixture);
    assert.equal(attestation.verified, true);
    assert.deepEqual(attestation.failures, []);
  }
});

test('MR !1540, !1546 and !1550 source contracts freeze exact GitLab bytes and required behavior', () => {
  const memory = QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT;
  assert.equal(memory.merge_commit_sha, 'be6a1d5d9b804d143597aa6f2554491a801115d7');
  assert.equal(memory.contract_sha256, '7ea042e9d6f46b1bde6ce0bab42dcc739775776ce54b3ebb640427566057b388');
  assert.deepEqual(memory.mr_diff, {
    bytes: 71833,
    sha256: '25a43ebdd09ace45958b9607644e9f1692784faaa589b4c4f109607f34038778',
  });
  assert.deepEqual(
    [memory.source_file.change_bytes, memory.source_file.change_sha256],
    [2048, '1efc26eb90909ef8a26b6c62128bef5fe05c1eb9034f33ee25b6690d18cb4c98'],
  );
  assert.deepEqual(
    [memory.source_file.source_bytes, memory.source_file.source_line_count, memory.source_file.source_sha256],
    [788, 21, '4991180f94dcc144f768e495086638f85bf53e43e01901c75ec3762aa52da745'],
  );
  const memoryAdditions = memory.integration_bindings.map((item) => item.addition.source).join('\n');
  assert.match(memoryAdditions, /'GET'[\s\S]*qwork-memory\/feature/u);
  assert.match(memoryAdditions, /options\.body, undefined/u);
  assert.match(memoryAdditions, /'POST'.*qwork-memory\/profile/u);
  assert.match(memoryAdditions, /body: \{ tm_user_profile: tmUserProfile \}/u);
  assert.match(memoryAdditions, /organizationFlight[\s\S]*reportQworkMemoryProfile/u);
  assert.match(memoryAdditions, /\.catch\(\(\) => \{\}\)/u);
  const memoryScopes = memory.integration_bindings
    .filter((binding) => binding.current_release_scope)
    .map((binding) => ({ id: binding.id, scope: binding.current_release_scope }));
  assert.deepEqual(memoryScopes.map((item) => item.id), [
    'feature_check_body_absent_test',
    'test_profile_report_exact_body',
  ]);
  assert.equal(memoryScopes.every((item) => (
    item.scope.schema_version === QWORK_RELEASE_SOURCE_OWNER_SCOPE_SCHEMA
    && item.scope.boundary === 'next-top-level-test-or-eof'
    && item.scope.owner_start.source.startsWith("test('")
    && item.scope.required_fragments.length === 3
    && item.scope.required_fragments.every((fragment) => fragment.match === 'line')
  )), true);
  assert.deepEqual(memoryScopes.map((item) => (
    item.scope.required_fragments.map((fragment) => fragment.id)
  )), [
    ['target_url', 'request_method', 'request_body'],
    ['target_url', 'request_method', 'request_body'],
  ]);
  const missingOwnerScope = structuredClone(memory);
  delete missingOwnerScope.integration_bindings.find((binding) => (
    binding.id === 'feature_check_body_absent_test'
  )).current_release_scope;
  delete missingOwnerScope.contract_sha256;
  missingOwnerScope.contract_sha256 = sha256Text(stableJson(missingOwnerScope));
  assert.throws(
    () => resolveReleaseSourceContracts([missingOwnerScope]),
    /source_contract_current_release_scope_set_invalid/u,
  );
  const broadenedOwnerScope = structuredClone(memory);
  broadenedOwnerScope.integration_bindings.find((binding) => (
    binding.id === 'test_feature_check_maps_gate'
  )).current_release_scope = structuredClone(memoryScopes[0].scope);
  delete broadenedOwnerScope.contract_sha256;
  broadenedOwnerScope.contract_sha256 = sha256Text(stableJson(broadenedOwnerScope));
  assert.throws(
    () => resolveReleaseSourceContracts([broadenedOwnerScope]),
    /source_contract_current_release_scope_set_invalid/u,
  );
  assert.deepEqual(memory.forbidden_fragments.map((item) => item.value.source), [
    "bootstrapQworkMemory({ tmUserProfile: '' })",
    'bootstrapOrganizationMemory',
  ]);

  const regenerate = QWORK_MR1546_REJECTED_REGENERATE_CONTRACT;
  assert.equal(regenerate.merge_commit_sha, 'fa351a4cbc3205222a75da6f0030bd8687c35587');
  assert.deepEqual(regenerate.mr_diff, {
    bytes: 46188,
    sha256: '6262007ecc64655d9221e3370db62c2565115848b97a2694484c3b8e6f646e61',
  });
  assert.deepEqual(
    [regenerate.source_file.change_bytes, regenerate.source_file.change_sha256],
    [1822, '0aa820d303fa33cd19042f3a77cf8b14dc609818a1495030808a186b94de37ed'],
  );
  assert.deepEqual(
    [regenerate.source_file.source_bytes, regenerate.source_file.source_line_count, regenerate.source_file.source_sha256],
    [1561, 42, '3b514bd9875829779afd490c018ca9d4ded03246e80fbd4a8e53ee41ad9b788c'],
  );
  const regenerateAdditions = regenerate.integration_bindings.map((item) => item.addition.source).join('\n');
  for (const expected of [
    'cloneValue(messages.at(-1))',
    'agentSessionId: null',
    'onPrepare();',
    'onReload();',
    'resolveRegenerateSourceTurn',
    'applyRegenerateFailure',
    'running: false',
    "errorMessage || 'Regeneration failed'",
  ]) assert.equal(regenerateAdditions.includes(expected), true, expected);
  assert.deepEqual(regenerate.forbidden_fragments.map((item) => item.value.source), [
    '  const sourceAssistantMessage = cloneValue(messages[sourceIndex + 1]);',
    '<ActionBarPrimitive.Reload asChild>',
    '        onClick={onPrepare}',
    '      // sendMessage restores the authoritative persisted branch on failure.',
    'regenerate_first_turn_candidate_invalid',
  ]);

  const routing = QWORK_MR1550_CLAUDE_SKILL_DESCRIPTION_ROUTING_CONTRACT;
  assert.equal(routing.merge_commit_sha, '1fc032633b5f70db34c17e1a9014efd981920cdb');
  assert.deepEqual(routing.mr_diff, {
    bytes: 33381,
    sha256: '7fd92710dfe49dc6e185a04b58cc4f590ff8e9f559ee3a7c47c857bb4a98372e',
  });
  assert.deepEqual(
    [routing.source_file.change_bytes, routing.source_file.change_sha256],
    [1842, 'e9d41e72c3a37eb0806500f91b473d253693264b5384bdbf66829a4ea61ecf1c'],
  );
  assert.deepEqual(
    [routing.source_file.source_bytes, routing.source_file.source_line_count, routing.source_file.source_sha256],
    [1553, 32, '1fb1f65c3677c6ce646d9dd6bd422e4e0b826e546b0518121a6f6aaa8d290067'],
  );
  const routingAdditions = routing.integration_bindings.map((item) => item.addition.source).join('\n');
  for (const expected of [
    'session?.llmSelection',
    'selection.modelId || selection.model',
    "modelId === 'claude-code'",
    "? '' : undefined",
    'claudeRuntimeSkillInvocationNoteOverride(s)',
    'mergeAutomaticSkillIndexInstallRows(rawSelection.allowedRows, s.skillInstalls)',
    '必须先调用 Skill 工具',
  ]) assert.equal(routingAdditions.includes(expected), true, expected);
  assert.equal(
    routing.forbidden_fragments[0].value.source,
    "    skillInvocationNote: runtimeFamily === RUNTIME_FAMILY_CLAUDE ? '' : undefined,",
  );

  for (const contract of [memory, regenerate, routing]) {
    assert.equal(contract.claim_scope, QWORK_RELEASE_SOURCE_CLAIM_SCOPE);
    assert.equal(contract.test_execution_attested, false);
    assert.equal(
      contract.integration_bindings.some((binding) => binding.path.startsWith('test/')),
      true,
      `${contract.contract_id} must attest at least one exact test declaration`,
    );
  }
});

test('MR !1557 source contract preserves !1546 origin while transferring three current bindings', () => {
  const origin = QWORK_MR1546_REJECTED_REGENERATE_CONTRACT;
  const successor = QWORK_MR1557_IMMEDIATE_REGENERATE_PROJECTION_CONTRACT;
  assert.equal(successor.merge_commit_sha, 'f0cc2a164b6c5279fe12290c207e29cf9ef1b261');
  assert.equal(successor.changes_count, 11);
  assert.deepEqual(successor.mr_diff, {
    bytes: 38739,
    sha256: '43e9e0b1ca93fb9f214a3d0c7bb72bdc902ef90437bed96248c34667e88ff790',
  });
  assert.deepEqual(
    [successor.source_file.change_bytes, successor.source_file.change_sha256],
    [3083, '8bda7ef9aaa971c2bfb14d0ec731cd7197c439fe027e485d1410a5214b47c97a'],
  );
  assert.deepEqual(
    [successor.source_file.source_bytes, successor.source_file.source_line_count, successor.source_file.source_sha256],
    [2180, 45, '69cfde5f693406f75ef71f65d49b62411e9365252deddeb883970e50c412f5cc'],
  );
  assert.equal(successor.test_execution_attested, false);
  assert.deepEqual(successor.supersedes, [{
    contract_id: origin.contract_id,
    current_assertions: [
      'integration_binding:latest_assistant_snapshot',
      'integration_binding:rejected_regenerate_projects_failure',
      'integration_binding:test_rejected_regenerate_projects_failure',
    ],
  }]);
  assert.equal(auditFixture(exactAddedLinesContractFixture(successor)).verified, true);

  const head = successor.merge_commit_sha;
  const contracts = [origin, successor];
  const ancestryByContractId = new Map(contracts.map((contract) => [contract.contract_id, {
    verified: true,
    first_parent_complete: true,
  }]));
  const resolution = resolveCurrentReleaseHeaderContract(origin, { contracts, ancestryByContractId });
  assert.equal(resolution.owner.contract_id, successor.contract_id);
  assert.deepEqual(resolution.lineage, [origin.contract_id, successor.contract_id]);
  const fixtureMap = currentReleaseFileFixtures(contracts, head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({ path: filePath, requested_ref: head, payload }));
  const originMr = {
    iid: origin.mr_iid,
    commit: origin.merge_commit_sha,
    changed_paths: [...origin.changed_paths],
  };
  const audit = (auditFiles = files, lineage = resolution.lineage) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: origin.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: origin.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests: [originMr],
    originAttestation: verifiedAttestation(origin),
    contract: origin,
    currentHeaderContract: successor,
    currentHeaderLineage: lineage,
  });
  const verified = audit();
  assert.equal(verified.verified, true);
  assert.equal(verified.origin_change_attestation.contract_id, origin.contract_id);
  assert.equal(verified.origin_change_attestation.verified, true);
  assert.equal(verified.test_execution_attested, false);
  for (const id of [
    'latest_assistant_snapshot',
    'rejected_regenerate_projects_failure',
    'test_rejected_regenerate_projects_failure',
  ]) {
    const owner = verified.current_assertion_owners.integration_bindings.find((item) => item.id === id);
    assert.equal(owner.contract_id, successor.contract_id, id);
    assert.deepEqual(owner.lineage, [origin.contract_id, successor.contract_id], id);
    const observed = verified.integration_bindings.find((item) => item.id === id);
    assert.deepEqual(observed.addition, successor.integration_bindings.find((item) => item.id === id).addition, id);

    const missing = structuredClone(files);
    const target = missing.find((item) => item.path === observed.path);
    const source = Buffer.from(target.payload.content, 'base64').toString('utf8');
    const rewritten = source.replace(`${observed.addition.source}\n`, `// removed ${id}\n`);
    target.payload.content = Buffer.from(rewritten, 'utf8').toString('base64');
    target.payload.size = Buffer.byteLength(rewritten, 'utf8');
    assert.equal(audit(missing).failures.includes(`current_integration_binding_mismatch:${id}`), true, id);
  }

  const restoredOldBehavior = structuredClone(files);
  const oldSnapshot = successor.forbidden_fragments.find((item) => item.id === 'unconditional_latest_assistant_snapshot');
  const oldSnapshotFile = restoredOldBehavior.find((item) => item.path === oldSnapshot.path);
  const oldSnapshotSource = Buffer.from(oldSnapshotFile.payload.content, 'base64').toString('utf8');
  const withOldSnapshot = `${oldSnapshotSource}${oldSnapshot.value.source}\n`;
  oldSnapshotFile.payload.content = Buffer.from(withOldSnapshot, 'utf8').toString('base64');
  oldSnapshotFile.payload.size = Buffer.byteLength(withOldSnapshot, 'utf8');
  assert.equal(
    audit(restoredOldBehavior).failures.includes('current_forbidden_fragment:unconditional_latest_assistant_snapshot'),
    true,
  );
  assert.equal(audit(files, [origin.contract_id]).failures.includes('current_header_lineage_invalid'), true);

  const unproven = resolveCurrentReleaseHeaderContract(origin, {
    contracts,
    ancestryByContractId: new Map([[successor.contract_id, { verified: false, first_parent_complete: false }]]),
  });
  assert.equal(unproven.owner.contract_id, origin.contract_id);
  assert.deepEqual(unproven.lineage, [origin.contract_id]);
  const originPaths = new Set(releaseSourceContractProtectedPaths(origin));
  const unprovenAudit = auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: origin.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: origin.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: files.filter((item) => originPaths.has(item.path)),
    contract: origin,
    currentHeaderContract: unproven.owner,
    currentHeaderLineage: unproven.lineage,
  });
  assert.equal(unprovenAudit.verified, false);
  assert.equal(
    unprovenAudit.failures.includes('current_integration_binding_mismatch:latest_assistant_snapshot'),
    true,
  );

  const forgedOwner = structuredClone(verified);
  forgedOwner.current_assertion_owners.integration_bindings
    .find((item) => item.id === 'latest_assistant_snapshot').contract_id = origin.contract_id;
  delete forgedOwner.attestation_sha256;
  forgedOwner.attestation_sha256 = sha256Text(stableJson(forgedOwner));
  const validation = validateCurrentReleaseSourceContractAttestation(forgedOwner, {
    report: {
      release: { head },
      merge_requests: [originMr],
      source_contracts: [
        forgedOwner,
        {
          contract_id: successor.contract_id,
          release: { ancestry: { verified: true, first_parent_complete: true } },
        },
      ],
    },
    contract: origin,
    contracts,
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.includes('attestation_current_assertion_owners_mismatch'), true);
});

test('MR !1558 source contract freezes settings model-name dedup declarations without attesting execution', () => {
  const contract = QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT;
  assert.equal(contract.merge_commit_sha, '90063782129701951edd90a9df8cf6145f1de425');
  assert.equal(contract.contract_sha256, '77d0bc15b5050c3d2553d8be9b1bdb46c7d9a918bc1ac59fa05dfca4b17e953a');
  assert.equal(contract.changes_count, 3);
  assert.deepEqual(contract.changed_paths, [
    'src/AssistantConfig.tsx',
    'src/composer-model-display-groups.ts',
    'test/unit/config/settings-ui-surface-contract.test.mjs',
  ]);
  assert.deepEqual(contract.mr_diff, {
    bytes: 4152,
    sha256: '3adb4b2161ae946eb3e4d37b487e7deb7c359e1f52c777d9ce751d1e5c768ee9',
  });
  assert.deepEqual(
    [contract.source_file.change_bytes, contract.source_file.change_sha256],
    [973, '32967fa02c0e1eb69ca9b6101615a092c8153e4e73b1b23e682dbbe4846d7bdf'],
  );
  assert.deepEqual(
    [contract.source_file.source_bytes, contract.source_file.source_line_count, contract.source_file.source_sha256],
    [492, 13, '24046d6d5979d9d57c8174696fb044b3a89e752a1a884f3b1490bf4db9edb82d'],
  );
  assert.equal(contract.claim_scope, QWORK_RELEASE_SOURCE_CLAIM_SCOPE);
  assert.equal(contract.test_execution_attested, false);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'dedupe_normalizes_display_name'), true);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'dedupe_rejects_empty_or_seen_name'), true);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'dedupe_preserves_input_order'), true);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'dedupe_records_first_name'), true);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'settings_dedupes_before_grouping'), true);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'test_declares_settings_name_dedup_contract'), true);
  assert.equal(contract.integration_bindings.every((binding) => !binding.current_release_scope), true);
});

test('MR !1561 source contract freezes the shared 32 MiB worker envelope and its test declaration', () => {
  const contract = QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT;
  assert.equal(contract.contract_id, 'deepbankv2-mr-1561-worker-envelope-limit/v1');
  assert.equal(contract.merge_commit_sha, 'ba03b0fa37825de35b556de1d9681da2456b40f2');
  assert.equal(contract.contract_sha256, 'dadedabb8c586fd97766b73be6c7b962ea46ada43e7d32bf2a8698c293966882');
  assert.equal(contract.changes_count, 2);
  assert.deepEqual(contract.changed_paths, [
    'electron/host-core/agent/execution-worker-protocol.cjs',
    'test/unit/desktop/execution-worker-supervisor.test.mjs',
  ]);
  assert.deepEqual(contract.mr_diff, {
    bytes: 2236,
    sha256: '4844c34e0098f0f1bf485df52c92ef8c868da2b301e6d8e25270a2bdab2878fd',
  });
  assert.deepEqual(
    [contract.source_file.change_bytes, contract.source_file.change_sha256],
    [744, '6b7fdee93bc1e6da48828eb814edd4a7a47bdaab17d2bb981e477d0eca9ae64e'],
  );
  assert.deepEqual(
    [contract.source_file.source_bytes, contract.source_file.source_line_count, contract.source_file.source_sha256],
    [45, 1, '59a592a8156a1ea5100f747805dc68fffb2b2856fe3515c5a19a66967c73fbb5'],
  );
  assert.equal(contract.claim_scope, QWORK_RELEASE_SOURCE_CLAIM_SCOPE);
  assert.equal(contract.test_execution_attested, false);
  const bindings = new Map(contract.integration_bindings.map((binding) => [binding.id, binding.addition.source]));
  assert.equal(bindings.get('shared_worker_envelope_limit_32_mib'), 'const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;');
  assert.equal(
    bindings.get('test_declares_shared_32_mib_envelope_limit'),
    "test('execution messages share the 32 MiB envelope limit', () => {",
  );
  assert.equal(
    bindings.get('test_asserts_execution_start_matches_shared_limit'),
    '  assert.equal(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);',
  );
  assert.equal(contract.forbidden_fragments.some((item) => (
    item.value.source === 'const MAX_ENVELOPE_BYTES = 256 * 1024;'
  )), true);
});

test('MR !1561 origin changes verify exactly and fail closed on limit, equality, title, or legacy drift', () => {
  const contract = QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT;
  const changes = mr1561OriginChanges();
  const summary = summarizeGitLabChanges(changes);
  assert.deepEqual(
    { paths: summary.paths, bytes: summary.diff_bytes, sha256: summary.diff_sha256 },
    { paths: contract.changed_paths, bytes: contract.mr_diff.bytes, sha256: contract.mr_diff.sha256 },
  );
  const sourceChange = normalizeGitLabChanges(changes)
    .find((change) => change.new_path === contract.source_file.path);
  assert.equal(reconstructGitLabAddedLinesSource(sourceChange), 'const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;\n');

  const audit = (auditChanges) => auditReleaseSourceContract({
    iid: contract.mr_iid,
    state: contract.state,
    targetBranch: contract.target_branch,
    mergeCommitSha: contract.merge_commit_sha,
    changesCount: contract.changes_count,
    changes: auditChanges,
    contract,
  });
  const verified = audit(changes);
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.failures, []);
  assert.equal(validateReleaseSourceContractAttestation(verified, { contract }).ok, true);

  const scenarios = [
    {
      name: 'shared limit',
      path: contract.source_file.path,
      from: 'const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;',
      to: 'const MAX_ENVELOPE_BYTES = 16 * 1024 * 1024;',
      failure: 'integration_binding_mismatch:shared_worker_envelope_limit_32_mib',
    },
    {
      name: 'test title',
      path: contract.changed_paths[1],
      from: "test('execution messages share the 32 MiB envelope limit', () => {",
      to: "test('execution messages use an envelope limit', () => {",
      failure: 'integration_binding_mismatch:test_declares_shared_32_mib_envelope_limit',
    },
    {
      name: 'equality assertion',
      path: contract.changed_paths[1],
      from: '  assert.equal(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);',
      to: '  assert.notEqual(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);',
      failure: 'integration_binding_mismatch:test_asserts_execution_start_matches_shared_limit',
    },
    {
      name: 'legacy 256 KiB limit',
      path: contract.source_file.path,
      from: 'const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;',
      to: 'const MAX_ENVELOPE_BYTES = 256 * 1024;',
      failure: 'forbidden_fragment:legacy_shared_worker_envelope_limit_256_kib',
    },
  ];
  for (const scenario of scenarios) {
    const drifted = structuredClone(changes);
    const change = drifted.find((item) => item.new_path === scenario.path);
    assert.ok(change, scenario.name);
    change.diff = change.diff.replace(scenario.from, scenario.to);
    const attestation = audit(drifted);
    assert.equal(attestation.verified, false, scenario.name);
    assert.equal(attestation.failures.includes('mr_diff_sha256_mismatch'), true, scenario.name);
    assert.equal(attestation.failures.includes(scenario.failure), true, scenario.name);
  }
});

test('MR !1561 current-release persistence verifies declarations and blocks removal or legacy restoration', () => {
  const contract = QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT;
  const head = 'e'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([contract], head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const audit = (auditFiles) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests: [],
    originAttestation: null,
    contract,
  });
  const verified = audit(files);
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.failures, []);
  assert.equal(validateCurrentReleaseSourceContractAttestation(verified, {
    report: { release: { head }, merge_requests: [], source_contracts: [verified] },
    contract,
    contracts: [contract],
  }).ok, true);

  const rewriteFile = (filePath, from, to) => {
    const drifted = structuredClone(files);
    const file = drifted.find((item) => item.path === filePath);
    assert.ok(file, filePath);
    const source = Buffer.from(file.payload.content, 'base64').toString('utf8');
    const rewritten = source.replace(from, to);
    assert.notEqual(rewritten, source, from);
    file.payload.content = Buffer.from(rewritten, 'utf8').toString('base64');
    file.payload.size = Buffer.byteLength(rewritten, 'utf8');
    return drifted;
  };
  for (const scenario of [
    {
      binding: 'shared_worker_envelope_limit_32_mib',
      path: contract.source_file.path,
      replacement: 'const MAX_ENVELOPE_BYTES = 16 * 1024 * 1024;',
    },
    {
      binding: 'test_declares_shared_32_mib_envelope_limit',
      path: contract.changed_paths[1],
      replacement: "test('execution messages use an envelope limit', () => {",
    },
    {
      binding: 'test_asserts_execution_start_matches_shared_limit',
      path: contract.changed_paths[1],
      replacement: '  assert.notEqual(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);',
    },
  ]) {
    const binding = contract.integration_bindings.find((item) => item.id === scenario.binding);
    const attestation = audit(rewriteFile(scenario.path, binding.addition.source, scenario.replacement));
    assert.equal(attestation.verified, false, scenario.binding);
    assert.equal(
      attestation.failures.includes(`current_integration_binding_mismatch:${scenario.binding}`),
      true,
      scenario.binding,
    );
  }

  const legacy = contract.forbidden_fragments.find((item) => (
    item.id === 'legacy_shared_worker_envelope_limit_256_kib'
  ));
  const protocolFile = files.find((item) => item.path === contract.source_file.path);
  const protocolSource = Buffer.from(protocolFile.payload.content, 'base64').toString('utf8');
  const withLegacy = `${protocolSource}${legacy.value.source}\n`;
  const legacyFiles = rewriteFile(contract.source_file.path, protocolSource, withLegacy);
  const legacyAttestation = audit(legacyFiles);
  assert.equal(legacyAttestation.verified, false);
  assert.equal(
    legacyAttestation.failures.includes('current_forbidden_fragment:legacy_shared_worker_envelope_limit_256_kib'),
    true,
  );
});

test('MR !1560 source contract freezes local turn-authority readiness declarations without attesting execution', () => {
  const contract = QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT;
  assert.equal(contract.contract_id, 'deepbankv2-mr-1560-turn-authority-readiness/v1');
  assert.equal(contract.merge_commit_sha, 'cebd32ba077e8708c0a5d241067bfb8b848f5b54');
  assert.equal(contract.contract_sha256, 'ceff1658513713f9cf6970ea85bfb23e257338fdd16446dce70bfe685e82d94e');
  assert.equal(contract.changes_count, 4);
  assert.deepEqual(contract.changed_paths, [
    'electron/host-core/agent/desktop-host-context.cjs',
    'electron/host-core/agent/turn-authority-readiness.cjs',
    'scripts/ci/unit/node-unit-test-weights.json',
    'test/unit/desktop/turn-authority-readiness.test.mjs',
  ]);
  assert.deepEqual(contract.mr_diff, {
    bytes: 4783,
    sha256: 'a3a98779ece45cf3335e26c7f18a0b0b5e3177741d91a73daaa756c44e8f3d52',
  });
  assert.deepEqual(
    [contract.source_file.change_bytes, contract.source_file.change_sha256],
    [886, '105c5f138f268bdde351d6e3f0eec378bbae3b444681038285f119f2bd4b5be8'],
  );
  assert.deepEqual(
    [contract.source_file.source_bytes, contract.source_file.source_line_count, contract.source_file.source_sha256],
    [629, 18, '520a26f968093a7c5ed40465fd1e0118dda2825325bbb1fb2aa12d05ad9c4aea'],
  );
  assert.equal(contract.source_file.proof_mode, 'exact-new-file');
  assert.equal(contract.claim_scope, QWORK_RELEASE_SOURCE_CLAIM_SCOPE);
  assert.equal(contract.test_execution_attested, false);

  const bindings = new Map(contract.integration_bindings.map((binding) => [binding.id, binding.addition.source]));
  assert.equal(bindings.get('readiness_default_timeout_10_seconds'), '  timeoutMs = 10_000,');
  assert.equal(bindings.get('readiness_default_interval_100_ms'), '  intervalMs = 100,');
  assert.equal(
    bindings.get('readiness_returns_ok_or_non_transient_error_immediately'),
    "    if (result?.ok || result?.code !== 'desktop_model_authority_not_ready') return result;",
  );
  assert.match(bindings.get('desktop_host_wraps_single_accept_authority_read'), /readReadyTurnAuthority.*currentTurnAuthorityForScope/u);
  assert.match(bindings.get('test_cold_start_ready_on_third_read'), /\+\+reads === 3/u);
  assert.equal(bindings.get('test_bounded_failure_timeout_250_ms'), '    timeoutMs: 250, now: () => elapsed,');
  assert.match(bindings.get('test_covers_scope_and_permanent_error_codes'), /desktop_local_context_superseded/u);
  assert.equal(contract.forbidden_fragments.some((item) => (
    item.id === 'desktop_host_direct_authority_read_without_readiness'
  )), true);
});

test('MR !1560 origin changes verify exactly and fail closed on readiness policy or test drift', () => {
  const contract = QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT;
  const changes = mr1560OriginChanges();
  const summary = summarizeGitLabChanges(changes);
  assert.deepEqual(
    { paths: summary.paths, bytes: summary.diff_bytes, sha256: summary.diff_sha256 },
    { paths: contract.changed_paths, bytes: contract.mr_diff.bytes, sha256: contract.mr_diff.sha256 },
  );
  const sourceChange = normalizeGitLabChanges(changes)
    .find((change) => change.new_path === contract.source_file.path);
  const source = reconstructGitLabNewFileSource(sourceChange);
  assert.equal(Buffer.byteLength(source, 'utf8'), contract.source_file.source_bytes);
  assert.equal(sha256Text(source), contract.source_file.source_sha256);

  const audit = (auditChanges) => auditReleaseSourceContract({
    iid: contract.mr_iid,
    state: contract.state,
    targetBranch: contract.target_branch,
    mergeCommitSha: contract.merge_commit_sha,
    changesCount: contract.changes_count,
    changes: auditChanges,
    contract,
  });
  const verified = audit(changes);
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.failures, []);
  assert.equal(validateReleaseSourceContractAttestation(verified, { contract }).ok, true);

  const scenarios = [
    {
      name: 'local observation only declaration',
      binding: 'readiness_observes_lifecycle_projection_only',
      replacement: '// Refresh model authority before reading it.',
    },
    {
      name: 'ten second timeout',
      binding: 'readiness_default_timeout_10_seconds',
      replacement: '  timeoutMs = 20_000,',
    },
    {
      name: 'one hundred millisecond interval',
      binding: 'readiness_default_interval_100_ms',
      replacement: '  intervalMs = 250,',
    },
    {
      name: 'transient-code-only retry',
      binding: 'readiness_returns_ok_or_non_transient_error_immediately',
      replacement: '    if (result?.ok) return result;',
    },
    {
      name: 'single accept host wrapper',
      binding: 'desktop_host_wraps_single_accept_authority_read',
      replacement: '        async () => currentTurnAuthorityForScope(turnScope, userId, {',
      forbidden: 'forbidden_fragment:desktop_host_direct_authority_read_without_readiness',
    },
    {
      name: 'cold start third read',
      binding: 'test_cold_start_ready_on_third_read',
      replacement: '  assert.equal(await readReadyTurnAuthority(() => ++reads === 4 ? ready : pending, {',
    },
    {
      name: 'bounded 250 millisecond failure',
      binding: 'test_bounded_failure_timeout_250_ms',
      replacement: '    timeoutMs: 500, now: () => elapsed,',
    },
    {
      name: 'scope and permanent error coverage',
      binding: 'test_covers_scope_and_permanent_error_codes',
      replacement: "  for (const code of ['desktop_local_context_superseded']) {",
    },
  ];
  for (const scenario of scenarios) {
    const binding = contract.integration_bindings.find((item) => item.id === scenario.binding);
    assert.ok(binding, scenario.name);
    const drifted = structuredClone(changes);
    const change = drifted.find((item) => item.new_path === binding.path);
    assert.ok(change, scenario.name);
    change.diff = change.diff.replace(binding.addition.source, scenario.replacement);
    const attestation = audit(drifted);
    assert.equal(attestation.verified, false, scenario.name);
    assert.equal(attestation.failures.includes('mr_diff_sha256_mismatch'), true, scenario.name);
    assert.equal(
      attestation.failures.includes(`integration_binding_mismatch:${scenario.binding}`),
      true,
      scenario.name,
    );
    if (scenario.forbidden) assert.equal(attestation.failures.includes(scenario.forbidden), true, scenario.name);
  }
});

test('MR !1560 current-release persistence requires every readiness binding and rejects forbidden behavior', () => {
  const contract = QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT;
  const head = 'f'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([contract], head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const audit = (auditFiles) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 0,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests: [],
    originAttestation: null,
    contract,
  });
  const verified = audit(files);
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.failures, []);
  assert.equal(validateCurrentReleaseSourceContractAttestation(verified, {
    report: { release: { head }, merge_requests: [], source_contracts: [verified] },
    contract,
    contracts: [contract],
  }).ok, true);

  const rewriteFile = (inputFiles, filePath, rewrite) => {
    const drifted = structuredClone(inputFiles);
    const file = drifted.find((item) => item.path === filePath);
    assert.ok(file, filePath);
    const source = Buffer.from(file.payload.content, 'base64').toString('utf8');
    const rewritten = rewrite(source);
    assert.notEqual(rewritten, source, filePath);
    file.payload.content = Buffer.from(rewritten, 'utf8').toString('base64');
    file.payload.size = Buffer.byteLength(rewritten, 'utf8');
    return drifted;
  };
  for (const binding of contract.integration_bindings) {
    const removedFiles = rewriteFile(files, binding.path, (source) => (
      source.replace(`${binding.addition.source}\n`, '')
    ));
    const attestation = audit(removedFiles);
    assert.equal(attestation.verified, false, binding.id);
    assert.equal(
      attestation.failures.includes(`current_integration_binding_mismatch:${binding.id}`),
      true,
      binding.id,
    );
  }
  for (const forbidden of contract.forbidden_fragments) {
    const forbiddenFiles = rewriteFile(files, forbidden.path, (source) => `${source}${forbidden.value.source}\n`);
    const attestation = audit(forbiddenFiles);
    assert.equal(attestation.verified, false, forbidden.id);
    assert.equal(
      attestation.failures.includes(`current_forbidden_fragment:${forbidden.id}`),
      true,
      forbidden.id,
    );
  }
});

test('new release source contracts audit synthetic equivalents and reject source or old-behavior restoration', () => {
  for (const contract of [
    QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT,
    QWORK_MR1546_REJECTED_REGENERATE_CONTRACT,
    QWORK_MR1550_CLAUDE_SKILL_DESCRIPTION_ROUTING_CONTRACT,
    QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT,
    QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT,
    QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT,
  ]) {
    const fixture = contract.source_file.proof_mode === 'exact-new-file'
      ? exactNewFileContractFixture(contract)
      : exactAddedLinesContractFixture(contract);
    assert.equal(auditFixture(fixture).verified, true, contract.contract_id);

    const sourceTampered = structuredClone(fixture.changes);
    const sourceChange = sourceTampered.find((change) => change.new_path === contract.source_file.path);
    sourceChange.diff = sourceChange.diff.replace('+', '+tampered-');
    const sourceAudit = auditFixture(fixture, { changes: sourceTampered });
    assert.equal(sourceAudit.verified, false, contract.contract_id);
    assert.equal(sourceAudit.failures.includes('mr_diff_sha256_mismatch'), true, contract.contract_id);
    assert.equal(sourceAudit.failures.includes('source_source_sha256_mismatch'), true, contract.contract_id);

    const testBinding = contract.integration_bindings.find((binding) => binding.path.startsWith('test/'));
    const testTampered = structuredClone(fixture.changes);
    const testChange = testTampered.find((change) => change.new_path === testBinding.path);
    testChange.diff = testChange.diff.replace(testBinding.addition.source, `${testBinding.addition.source} // forged`);
    const testAudit = auditFixture(fixture, { changes: testTampered });
    assert.equal(testAudit.verified, false, contract.contract_id);
    assert.equal(
      testAudit.failures.includes(`integration_binding_mismatch:${testBinding.id}`),
      true,
      contract.contract_id,
    );

    const forbidden = contract.forbidden_fragments?.[0];
    if (forbidden) {
      const restored = structuredClone(fixture.changes);
      const target = restored.find((change) => change.new_path === forbidden.path);
      const addedLine = target.diff.split('\n').find((line) => line.startsWith('+') && !line.startsWith('+++'));
      target.diff = target.diff.replace(addedLine, `+${forbidden.value.source}`);
      const restoredAudit = auditFixture(fixture, { changes: restored });
      assert.equal(
        restoredAudit.failures.includes(`forbidden_fragment:${forbidden.id}`),
        true,
        contract.contract_id,
      );
    }
  }
});

test('MR !1558 origin changes fail closed on helper, settings wiring, or test declaration drift', () => {
  const contract = QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT;
  const scenarios = [
    {
      binding: 'dedupe_normalizes_display_name',
      replacement: "    const name = String(option.modelId || '').trim().toLocaleLowerCase();",
    },
    {
      binding: 'dedupe_rejects_empty_or_seen_name',
      replacement: '    if (!name) return false;',
    },
    {
      binding: 'settings_dedupes_before_grouping',
      replacement: '  const availableModelGroups = buildModelDisplayGroups(visibleModelOptions);',
    },
    {
      binding: 'test_declares_settings_name_dedup_contract',
      replacement: "test('settings available models list protocol variants', () => {",
    },
  ];
  for (const scenario of scenarios) {
    const fixture = exactAddedLinesContractFixture(contract);
    const binding = fixture.contract.integration_bindings.find((item) => item.id === scenario.binding);
    assert.ok(binding, scenario.binding);
    const changes = structuredClone(fixture.changes);
    const target = changes.find((change) => change.new_path === binding.path);
    assert.ok(target, scenario.binding);
    target.diff = target.diff.replace(binding.addition.source, scenario.replacement);
    const attestation = auditFixture(fixture, { changes });
    assert.equal(attestation.verified, false, scenario.binding);
    assert.equal(
      attestation.failures.includes(`integration_binding_mismatch:${scenario.binding}`),
      true,
      scenario.binding,
    );
  }
});

test('MR !1558 current-release continuity requires every binding exactly once without owner-scope exceptions', () => {
  const contract = QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT;
  const head = 'e'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([contract], head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const audit = (auditFiles) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests: [],
    originAttestation: null,
    contract,
  });
  assert.equal(audit(files).verified, true);

  for (const binding of contract.integration_bindings) {
    const duplicatedFiles = structuredClone(files);
    const target = duplicatedFiles.find((file) => file.path === binding.path);
    assert.ok(target, binding.id);
    const source = Buffer.from(target.payload.content, 'base64').toString('utf8');
    const duplicated = `${source}${binding.addition.source}\n`;
    target.payload.content = Buffer.from(duplicated, 'utf8').toString('base64');
    target.payload.size = Buffer.byteLength(duplicated, 'utf8');
    const attestation = audit(duplicatedFiles);
    assert.equal(attestation.verified, false, binding.id);
    assert.equal(
      attestation.failures.includes(`current_integration_binding_mismatch:${binding.id}`),
      true,
      binding.id,
    );
    assert.equal(
      attestation.integration_bindings.find((item) => item.id === binding.id)?.occurrence_count,
      2,
      binding.id,
    );
  }
});

test('source contracts and attestations cannot claim that declared tests were executed', () => {
  for (const contract of QWORK_RELEASE_SOURCE_CONTRACTS) {
    assert.equal(contract.claim_scope, 'source_and_test_declarations');
    assert.equal(contract.test_execution_attested, false);
  }
  const forgedDefinition = structuredClone(QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT);
  forgedDefinition.test_execution_attested = true;
  delete forgedDefinition.contract_sha256;
  forgedDefinition.contract_sha256 = sha256Text(stableJson(forgedDefinition));
  assert.throws(
    () => resolveReleaseSourceContracts([forgedDefinition]),
    /source_contract_test_execution_attested_invalid/u,
  );

  const report = mr1522Report();
  report.source_contracts[0].test_execution_attested = true;
  const attestationValue = structuredClone(report.source_contracts[0]);
  delete attestationValue.attestation_sha256;
  report.source_contracts[0].attestation_sha256 = sha256Text(stableJson(attestationValue));
  const validation = validateReleaseSourceContractsForReport(report);
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.some((failure) => failure.includes('attestation_test_execution_attested_invalid')), true);
});

test('source contract blocks merge SHA and full MR diff drift', () => {
  const fixture = sourceContractFixture();
  const wrongMerge = auditFixture(fixture, { mergeCommitSha: '9'.repeat(40) });
  assert.equal(wrongMerge.verified, false);
  assert.equal(wrongMerge.failures.includes('mr_merge_commit_sha_mismatch'), true);

  const changes = structuredClone(fixture.changes);
  changes[0].diff = changes[0].diff.replace(' context', ' changed-context');
  const wrongDiff = auditFixture(fixture, { changes });
  assert.equal(wrongDiff.verified, false);
  assert.equal(wrongDiff.failures.includes('mr_diff_sha256_mismatch'), true);
  assert.equal(wrongDiff.failures.includes('mr_diff_bytes_mismatch'), true);
});

test('source contract blocks reconstructed source byte drift', () => {
  const fixture = sourceContractFixture();
  const changes = structuredClone(fixture.changes);
  const sourceChange = changes.find((change) => change.new_file);
  sourceChange.diff = sourceChange.diff.replace('+export { lines };', '+export { lines, extra };');
  const attestation = auditFixture(fixture, { changes });
  assert.equal(attestation.verified, false);
  assert.equal(attestation.failures.includes('source_source_sha256_mismatch'), true);
  assert.equal(attestation.failures.includes('source_source_bytes_mismatch'), true);
});

for (const scenario of [
  {
    name: 'Header wire name',
    mutate: (diff) => diff.replace("'x-turn-id', turnId", "'x-turn-key', turnId"),
  },
  {
    name: 'Header value source',
    mutate: (diff) => diff.replace("'x-turn-id', turnId", "'x-turn-id', sessionId"),
  },
]) {
  test(`source contract blocks ${scenario.name} drift`, () => {
    const fixture = sourceContractFixture();
    const changes = structuredClone(fixture.changes);
    const sourceChange = changes.find((change) => change.new_file);
    sourceChange.diff = scenario.mutate(sourceChange.diff);
    const attestation = auditFixture(fixture, { changes });
    assert.equal(attestation.verified, false);
    assert.equal(attestation.failures.includes('header_source_mismatch:x-turn-id'), true);
  });
}

for (const scenario of [
  { name: 'host turnId', changeIndex: 0, from: 'currentTurnId', to: 'staleTurnId', binding: 'host_turn' },
  { name: 'engine Header injection', changeIndex: 1, from: 'withTurnHeaders', to: 'withoutTurnHeaders', binding: 'engine_env' },
  { name: 'fallback turnId', changeIndex: 1, from: 'agentSessionId: null }, turnId', to: 'agentSessionId: null }, staleTurnId', binding: 'fallback_turn' },
  { name: 'fallback request context', changeIndex: 1, from: 'turnRequestContext: requestContext', to: 'turnRequestContext: null', binding: 'fallback_context' },
]) {
  test(`source contract blocks ${scenario.name} integration wiring drift`, () => {
    const fixture = sourceContractFixture();
    const changes = structuredClone(fixture.changes);
    changes[scenario.changeIndex].diff = changes[scenario.changeIndex].diff.replace(scenario.from, scenario.to);
    const attestation = auditFixture(fixture, { changes });
    assert.equal(attestation.verified, false);
    assert.equal(attestation.failures.includes(`integration_binding_mismatch:${scenario.binding}`), true);
  });
}

test('MR !1522 report requires one exact attestation and bidirectional MR binding', () => {
  const report = mr1522Report();
  assert.equal(validateReleaseSourceContractsForReport(report).ok, true);

  const missing = structuredClone(report);
  missing.source_contracts = [];
  missing.summary.source_contract_count = 0;
  missing.summary.source_contract_verified_count = 0;
  const missingValidation = validateReleaseSourceContractsForReport(missing);
  assert.equal(missingValidation.ok, false);
  assert.equal(missingValidation.failures.some((failure) => failure.includes('source_contract_attestation_count')), true);

  const forged = structuredClone(report);
  forged.source_contracts[0].headers[0].value_source = 'forgedUserAgent';
  const forgedValue = structuredClone(forged.source_contracts[0]);
  delete forgedValue.attestation_sha256;
  forged.source_contracts[0].attestation_sha256 = sha256Text(stableJson(forgedValue));
  const forgedValidation = validateReleaseSourceContractsForReport(forged);
  assert.equal(forgedValidation.ok, false);
  assert.equal(forgedValidation.failures.some((failure) => failure.includes('attestation_not_exact_verified_projection')), true);
});

test('source contract report rejects unrelated bindings, summary drift, and forged unresolved state', () => {
  const unrelated = mr1522Report();
  unrelated.merge_requests.push({ iid: '9999', source_contract_ids: [QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id] });
  const unrelatedValidation = validateReleaseSourceContractsForReport(unrelated);
  assert.equal(unrelatedValidation.ok, false);
  assert.equal(unrelatedValidation.failures.some((failure) => failure.includes('source_contract_mr_binding_wrong_mr')), true);

  const summaryDrift = mr1522Report();
  summaryDrift.summary.source_contract_verified_count = 0;
  summaryDrift.summary.source_contract_failure_count = 1;
  assert.equal(validateReleaseSourceContractsForReport(summaryDrift).ok, false);

  const unresolvedDrift = mr1522Report();
  unresolvedDrift.unresolved.source_contract_failures = ['forged:pass'];
  unresolvedDrift.summary.source_contract_failure_count = 1;
  const unresolvedValidation = validateReleaseSourceContractsForReport(unresolvedDrift);
  assert.equal(unresolvedValidation.ok, false);
  assert.equal(unresolvedValidation.failures.includes('source_contract_unresolved_mismatch'), true);
});

test('source contract registry always retains immutable built-ins and appends custom contracts', () => {
  const fixture = sourceContractFixture();
  assert.deepEqual(resolveReleaseSourceContracts([]), QWORK_RELEASE_SOURCE_CONTRACTS);
  assert.deepEqual(
    resolveReleaseSourceContracts([fixture.contract]),
    [...QWORK_RELEASE_SOURCE_CONTRACTS, fixture.contract],
  );
  assert.throws(
    () => resolveReleaseSourceContracts([
      ...QWORK_RELEASE_SOURCE_CONTRACTS,
      { ...QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT, mr_iid: '9999' },
    ]),
    /source_contract_registry_duplicate_id/u,
  );
  assert.deepEqual(
    resolveReleaseSourceContracts([...QWORK_RELEASE_SOURCE_CONTRACTS, fixture.contract]),
    [...QWORK_RELEASE_SOURCE_CONTRACTS, fixture.contract],
  );
  const validation = validateReleaseSourceContractsForReport(mr1522Report(), []);
  assert.equal(validation.ok, true);
});

test('source contract trigger requires exact IID or merge SHA and never binds by protected path alone', () => {
  const contract = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  const protectedPath = releaseSourceContractProtectedPaths(contract)[0];
  const unrelated = releaseSourceContractTrigger({
    iid: '1532',
    commit: 'f'.repeat(40),
    changed_paths: [protectedPath],
  }, contract);
  assert.equal(unrelated.triggered, false);
  assert.deepEqual(unrelated.protected_paths, [protectedPath]);
  assert.equal(releaseSourceContractTrigger({ iid: contract.mr_iid }, contract).triggered, true);
  assert.equal(releaseSourceContractTrigger({ commit: contract.merge_commit_sha }, contract).triggered, true);
});

test('current Header ownership transfers from !1522 to proven !1544 ancestry only', () => {
  const base = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  const successor = QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT;
  const proven = resolveCurrentReleaseHeaderContract(base, {
    ancestryByContractId: new Map([[successor.contract_id, {
      verified: true,
      first_parent_complete: true,
    }]]),
  });
  assert.equal(proven.owner.contract_id, successor.contract_id);
  assert.deepEqual(proven.lineage, [base.contract_id, successor.contract_id]);

  const unproven = resolveCurrentReleaseHeaderContract(base, {
    ancestryByContractId: new Map([[successor.contract_id, {
      verified: false,
      first_parent_complete: false,
    }]]),
  });
  assert.equal(unproven.owner.contract_id, base.contract_id);
  assert.deepEqual(unproven.lineage, [base.contract_id]);
});

test('current release audit keeps !1522 integration ownership while enforcing !1544 Headers', () => {
  const base = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  const successor = QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT;
  const head = 'e'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([base, successor], head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const audit = (overrides = {}) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: 'release/0.1',
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: base.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 2,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files,
    mergeRequests: [],
    originAttestation: null,
    contract: base,
    currentHeaderContract: successor,
    currentHeaderLineage: [base.contract_id, successor.contract_id],
    ...overrides,
  });
  const verified = audit();
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.headers.map((item) => item.wire_name), successor.header_emissions.map((item) => item.wire_name));
  assert.deepEqual(verified.integration_bindings.map((item) => item.id), base.integration_bindings.map((item) => item.id));

  const driftedFiles = structuredClone(files);
  const sourceFile = driftedFiles.find((file) => file.path === base.source_file.path);
  const source = Buffer.from(sourceFile.payload.content, 'base64').toString('utf8');
  const forbidden = successor.forbidden_fragments[0].value.source;
  const driftedSource = `${source}${forbidden}\n`;
  sourceFile.payload.content = Buffer.from(driftedSource, 'utf8').toString('base64');
  sourceFile.payload.size = Buffer.byteLength(driftedSource, 'utf8');
  const drifted = audit({ files: driftedFiles });
  assert.equal(drifted.verified, false);
  assert.equal(drifted.failures.includes(`current_forbidden_fragment:${successor.forbidden_fragments[0].id}`), true);

  const headerDriftFiles = structuredClone(files);
  const headerSourceFile = headerDriftFiles.find((file) => file.path === base.source_file.path);
  const headerSource = Buffer.from(headerSourceFile.payload.content, 'base64').toString('utf8');
  const expectedEmission = successor.header_emissions.find((item) => item.name === 'x-qwork-turn-id').emission.source;
  const headerDriftSource = headerSource.replace(expectedEmission, expectedEmission.replace('x-qwork-turn-id', 'x-turn-id'));
  headerSourceFile.payload.content = Buffer.from(headerDriftSource, 'utf8').toString('base64');
  headerSourceFile.payload.size = Buffer.byteLength(headerDriftSource, 'utf8');
  const headerDrift = audit({ files: headerDriftFiles });
  assert.equal(headerDrift.verified, false);
  assert.equal(headerDrift.failures.includes('current_header_source_mismatch:x-qwork-turn-id'), true);
});

test('MR !1540 current release continuity scopes repeated test assertions to unique owners', () => {
  const contract = QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT;
  const scopedBindings = contract.integration_bindings.filter((item) => item.current_release_scope);
  assert.deepEqual(scopedBindings.map((item) => item.id), [
    'feature_check_body_absent_test',
    'test_profile_report_exact_body',
  ]);
  const head = 'e'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([contract], head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const rewriteBindingFile = (inputFiles, binding, rewrite) => {
    const next = structuredClone(inputFiles);
    const file = next.find((item) => item.path === binding.path);
    assert.ok(file);
    const source = Buffer.from(file.payload.content, 'base64').toString('utf8');
    const rewritten = rewrite(source);
    file.payload.content = Buffer.from(rewritten, 'utf8').toString('base64');
    file.payload.size = Buffer.byteLength(rewritten, 'utf8');
    return next;
  };
  const audit = (auditFiles) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 2,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests: [],
    originAttestation: null,
    contract,
  });

  for (const binding of scopedBindings) {
    const unrelatedOwner = `test('unrelated duplicate for ${binding.id}', async () => {`;
    const repeated = audit(rewriteBindingFile(files, binding, (source) => (
      `${source}${unrelatedOwner}\n${binding.addition.source}\n});\n`
    )));
    assert.equal(repeated.verified, true, binding.id);
    const repeatedBinding = repeated.integration_bindings.find((item) => item.id === binding.id);
    assert.equal(repeatedBinding.addition_count, 2, binding.id);
    assert.equal(repeatedBinding.occurrence_count, 2, binding.id);
    assert.equal(repeatedBinding.scope_observation.owner_occurrence_count, 1, binding.id);
    assert.equal(repeatedBinding.scope_observation.occurrence_count, 1, binding.id);
    assert.equal(
      repeatedBinding.scope_observation.required_fragments.every((fragment) => (
        fragment.occurrence_count === 1 && fragment.verified === true
      )),
      true,
      binding.id,
    );
    const repeatedValidationOptions = {
      report: {
        release: { head },
        merge_requests: [],
        source_contracts: [repeated],
      },
      contract,
      contracts: [contract],
    };
    assert.equal(
      validateCurrentReleaseSourceContractAttestation(repeated, repeatedValidationOptions).ok,
      true,
      binding.id,
    );
    const forgedScopeCount = structuredClone(repeated);
    const forgedBinding = forgedScopeCount.integration_bindings.find((item) => item.id === binding.id);
    forgedBinding.scope_observation.owner_occurrence_count = 2;
    delete forgedScopeCount.attestation_sha256;
    forgedScopeCount.attestation_sha256 = sha256Text(stableJson(forgedScopeCount));
    const forgedValidation = validateCurrentReleaseSourceContractAttestation(forgedScopeCount, {
      ...repeatedValidationOptions,
      report: {
        ...repeatedValidationOptions.report,
        source_contracts: [forgedScopeCount],
      },
    });
    assert.equal(forgedValidation.ok, false, binding.id);
    assert.equal(
      forgedValidation.failures.includes(`attestation_current_integration_binding_scope_owner:${binding.id}`),
      true,
      binding.id,
    );

    const removed = audit(rewriteBindingFile(files, binding, (source) => (
      source.split(`${binding.addition.source}\n`).join('')
    )));
    assert.equal(removed.verified, false, binding.id);
    assert.equal(
      removed.integration_bindings.find((item) => item.id === binding.id)?.occurrence_count,
      0,
      binding.id,
    );
    assert.equal(removed.failures.includes(`current_integration_binding_mismatch:${binding.id}`), true);

    const moved = audit(rewriteBindingFile(files, binding, (source) => (
      `${source.split(`${binding.addition.source}\n`).join('')}${unrelatedOwner}\n${binding.addition.source}\n});\n`
    )));
    assert.equal(moved.verified, false, binding.id);
    assert.equal(
      moved.failures.includes(`current_integration_binding_scope_occurrence_mismatch:${binding.id}`),
      true,
      binding.id,
    );

    const duplicatedOwner = audit(rewriteBindingFile(files, binding, (source) => (
      `${source}${binding.current_release_scope.owner_start.source}\n${binding.current_release_scope.required_fragments
        .map((fragment) => fragment.value.source).join('\n')}\n});\n`
    )));
    assert.equal(duplicatedOwner.verified, false, binding.id);
    assert.equal(
      duplicatedOwner.failures.includes(`current_integration_binding_scope_owner_mismatch:${binding.id}`),
      true,
      binding.id,
    );

    for (const fragment of binding.current_release_scope.required_fragments) {
      const missingFragment = audit(rewriteBindingFile(files, binding, (source) => (
        source.replace(`${fragment.value.source}\n`, `// removed ${fragment.id}\n`)
      )));
      assert.equal(missingFragment.verified, false, `${binding.id}:${fragment.id}`);
      assert.equal(
        missingFragment.failures.includes(
          `current_integration_binding_scope_required_fragment_mismatch:${binding.id}:${fragment.id}`,
        ),
        true,
        `${binding.id}:${fragment.id}`,
      );
    }
  }

  const strictBinding = contract.integration_bindings.find((item) => item.id === 'test_feature_check_maps_gate');
  const duplicatedStrictBinding = audit(rewriteBindingFile(files, strictBinding, (source) => (
    `${source}test('unrelated strict duplicate', async () => {\n${strictBinding.addition.source}\n});\n`
  )));
  assert.equal(duplicatedStrictBinding.verified, false);
  assert.equal(
    duplicatedStrictBinding.failures.includes(`current_integration_binding_mismatch:${strictBinding.id}`),
    true,
  );
});

test('origin changes attestation continues to require each positive binding exactly once', () => {
  const fixture = exactAddedLinesContractFixture(QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT);
  const binding = fixture.contract.integration_bindings.find((item) => (
    item.id === 'feature_check_body_absent_test'
  ));
  assert.ok(binding);
  const repeatedChanges = structuredClone(fixture.changes);
  const target = repeatedChanges.find((change) => change.new_path === binding.path);
  assert.ok(target);
  target.diff = target.diff.replace(
    `+${binding.addition.source}`,
    `+${binding.addition.source}\n+${binding.addition.source}`,
  );
  const attestation = auditFixture(fixture, { changes: repeatedChanges });
  assert.equal(attestation.verified, false);
  assert.equal(attestation.failures.includes(`integration_binding_mismatch:${binding.id}`), true);
});

test('impact mapping stays conservative for unknown product paths', () => {
  const mapped = mapReleaseImpact({
    changedPaths: ['server/qbot-core/automation/scheduler.mjs', 'server/mystery/contract.mjs'],
    subject: 'automation scheduler !101',
    availableCaseIds: ['MRSMOKE-AUTO-001', 'MRSMOKE-ROUTE-001'],
  });
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-AUTO-001'), true);
  assert.deepEqual(mapped.unmapped_product_paths, ['server/mystery/contract.mjs']);
  assert.equal(mapped.mapping_status, 'BLOCKED');
});

for (const unknownPath of [
  'server/unknown-domain/auth-runtime.mjs',
  'future/skill-router.ts',
  'extensions/automation-scheduler.mjs',
]) {
  test(`unknown keyword path cannot manufacture impact coverage: ${unknownPath}`, () => {
    const mapped = mapReleaseImpact({
      changedPaths: [unknownPath],
      branch: 'feature/runtime-auth-skill-automation',
      subject: 'auth runtime skill automation',
      labels: ['area/runtime'],
      availableCaseIds: [
        'MRSMOKE-AUTH-001',
        'MRSMOKE-AUTO-001',
        'MRSMOKE-ROUTE-001',
        'MRSMOKE-SKILL-001',
      ],
    });
    assert.deepEqual(mapped.known_product_paths, []);
    assert.deepEqual(mapped.direct_case_ids, []);
    assert.deepEqual(mapped.unmapped_product_paths, [unknownPath]);
    assert.equal(mapped.mapping_status, 'BLOCKED');
  });
}

test('known product paths and generated metadata are classified without false unknowns', () => {
  const mapped = mapReleaseImpact({
    changedPaths: [
      '.agent/context.yaml',
      'AGENTS.md',
      'package.json',
      'server/engine.mjs',
      'electron/desktop-agent-host.cjs',
      'src/components/assistant-ui/thread.tsx',
      'resources/builtin-skills/document-processing/SKILL.md',
      'scripts/e2e-module.test.mjs',
    ],
    subject: 'runtime and routing update',
    availableCaseIds: ['MRSMOKE-FAIL-001', 'MRSMOKE-NAV-001', 'MRSMOKE-SKILL-001'],
  });
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.static_dispositions.length, 3);
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-FAIL-001'), true);
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-NAV-001'), true);
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-SKILL-001'), true);
  assert.equal(mapped.required_stages.includes('G3'), true);
});

test('purely static changes do not become desktop E2E impact from branch wording', () => {
  const mapped = mapReleaseImpact({
    changedPaths: ['dashboard/src/app/App.tsx', 'docs/release-runtime.md', '.gitlab-ci.yml'],
    branch: 'codex/dashboard-yaml-runtime',
    subject: 'Merge branch runtime update into release/0.1',
    availableCaseIds: ['MRSMOKE-FAIL-001', 'BETA-HOST-003'],
  });
  assert.deepEqual(mapped.direct_case_ids, []);
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.mapping_status, 'MAPPED');
  assert.deepEqual(mapped.required_stages, ['G1']);
});

test('latest repository refactors classify known product domains and governance material', () => {
  const mapped = mapReleaseImpact({
    changedPaths: [
      '.gitlab/policies/ci-policy-reference.md',
      'scripts/governance/context/agent-context.mjs',
      'eval/qwork-session-experience/src/pipeline.mjs',
      'openspec/changes/add-local-model-gateway-diagnostics/design.md',
      'schemas/expert-definition-v1.schema.json',
      'server/docs/capabilities.yaml',
      'server/qbot-core/engine/engine.mjs',
      'server/control-plane/index.mjs',
      'server/expert-definition/codec.mjs',
      'src/nav.ts',
      'electron/preload.cjs',
      'assets/lib/ui/icons/common/circle-play.svg',
      'resources/builtin-skills/expert-creator/SKILL.md',
      'db/migrations/20260831000100_preserve_owner_expert_visibility.sql',
      'runtime-family.mjs',
    ],
    subject: 'Merge branch refactor into release/0.1',
    availableCaseIds: [
      'MRSMOKE-ACT-001', 'MRSMOKE-WEB-001', 'MRSMOKE-WEB-002', 'MRSMOKE-AUTH-001',
      'MRSMOKE-AUTO-001', 'MRSMOKE-NAV-001', 'MRSMOKE-ROUTE-001', 'MRSMOKE-SKILL-001',
      'MRSMOKE-FAIL-001', 'MRSMOKE-ART-001', 'MRSMOKE-ENTRY-001', 'MRSMOKE-CHART-001',
    ],
  });
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.static_paths.length, 6);
  assert.equal(mapped.in_scope_case_ids.length, 12);
  assert.equal(mapped.direct_case_ids.includes('BETA-SEC-002'), true);
  assert.equal(mapped.mapping_status, 'MAPPED');
  assert.deepEqual(mapped.required_stages, ['G1', 'G2', 'G3']);
});

test('unknown nested server domains remain fail-closed after refactor mappings', () => {
  const mapped = mapReleaseImpact({
    changedPaths: ['server/qbot-core/engine/engine.mjs', 'server/unknown-domain/contract.mjs'],
    subject: 'server refactor',
    availableCaseIds: ['MRSMOKE-AUTH-001'],
  });
  assert.deepEqual(mapped.unmapped_product_paths, ['server/unknown-domain/contract.mjs']);
  assert.equal(mapped.mapping_status, 'BLOCKED');
});

test('release intake uses commit ancestry and binds verified MR metadata', () => {
  const { repo, baseline, releaseHead } = fixtureRepo();
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001', 'MRSMOKE-ROUTE-001', 'BETA-TASK-008'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      gitlabReader: () => [{ iid: 101, title: 'automation scheduler', state: 'merged', target_branch: 'HEAD', merge_commit_sha: releaseHead, labels: ['area/automation'], merged_at: '2026-08-31T01:00:00Z' }],
      now: new Date('2026-08-31T02:00:00Z'),
    });
    assert.equal(report.schema_version, QWORK_RELEASE_INTAKE_SCHEMA);
    assert.equal(report.decision, 'READY', report.blockers.join('; '));
    assert.equal(report.scan_boundary.mode, 'commit_ancestry');
    assert.equal(report.scan_boundary.baseline_commit, baseline);
    assert.equal(report.merge_requests[0].metadata_verified, true);
    assert.equal(report.summary.direct_case_ids.includes('MRSMOKE-AUTO-001'), true);
    assert.equal(report.summary.dependency_case_ids.includes('BETA-TASK-008'), true);
    assert.equal(validateQworkReleaseIntake(report, { releaseRef: 'HEAD', releaseHead, frameworkCommit: 'a'.repeat(40) }).ok, true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('dependency closure keeps cross-sheet prerequisites in the intake', () => {
  const { repo, baseline } = fixtureRepo();
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      requireGitLabMetadata: false,
      gitlabReader: () => [],
    });
    assert.equal(report.summary.dependency_case_ids.includes('BETA-TASK-008'), true);
    assert.equal(report.summary.dependency_case_ids.includes('BETA-ROUTE-001'), true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('intake falls back to a bounded time window when ancestry is unavailable', () => {
  const { repo } = fixtureRepo();
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: 'b'.repeat(40),
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      requireGitLabMetadata: false,
      gitlabReader: () => [],
      now: new Date('2026-08-31T02:00:00Z'),
      fallbackDays: 30,
    });
    assert.equal(report.scan_boundary.mode, 'time_window_fallback');
    assert.equal(report.scan_boundary.ancestry_verified, false);
    assert.match(report.scan_boundary.fallback_reason, /baseline/);
    assert.equal(report.policy.time_window_is_fallback, true);
    assert.equal(report.decision, 'BLOCKED');
    assert.match(report.blockers.join('\n'), /祖先关系/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('GitLab MR intake paginates beyond the first 100 rows', () => {
  const { repo, baseline, releaseHead } = fixtureRepo();
  try {
    const calls = [];
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      gitlabReader: (endpoint) => {
        calls.push(endpoint);
        if (endpoint.endsWith('page=1')) {
          return Array.from({ length: 100 }, (_, index) => ({
            iid: String(index + 1),
            merge_commit_sha: index === 0 ? releaseHead : '0'.repeat(40),
            state: 'merged',
            target_branch: 'HEAD',
          }));
        }
        return [{ iid: '101', merge_commit_sha: '1'.repeat(40), state: 'merged', target_branch: 'HEAD' }];
      },
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].endsWith('page=2'), true);
    assert.equal(report.merge_requests[0].metadata_verified, true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('GitLab API freshness proves stable branch, complete first-parent chain, and exact MR changes', () => {
  const fixture = apiFixture();
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', JSON.stringify({
    blockers: report.blockers,
    freshness: report.policy.api_freshness,
    risk: report.blocking_risks[0],
    apiErrors: report.unresolved.api_errors,
  }));
  assert.equal(report.release.head, fixture.head);
  assert.equal(report.policy.fetch_latest, false);
  assert.equal(report.policy.api_freshness.verified, true);
  assert.equal(report.policy.api_freshness.mr_changes_verified_count, 1);
  assert.equal(report.merge_requests[0].metadata_verified, true);
  const blockingRisk = report.blocking_risks[0];
  assert.equal(blockingRisk.applicability, 'VERIFIED_NOT_APPLICABLE');
  assert.equal(blockingRisk.status, 'NOT_APPLICABLE');
  assert.equal(blockingRisk.release_before_origin_ancestry.compare_from, fixture.head);
  assert.equal(blockingRisk.release_before_origin_ancestry.compare_to, QWORK_MR1552_MERGE_COMMIT_SHA);
  assert.equal(blockingRisk.release_before_origin_ancestry.verified, true);
  const legacyHeaderAttestation = report.source_contracts.find((item) => (
    item.contract_id === QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id
  ));
  assert.deepEqual(legacyHeaderAttestation.current_assertion_owners.header_emissions, {
    contract_id: QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT.contract_id,
    contract_sha256: QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT.contract_sha256,
    lineage: [
      QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id,
      QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT.contract_id,
    ],
  });
  assert.deepEqual(
    legacyHeaderAttestation.headers.map((header) => header.wire_name),
    QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT.header_emissions.map((header) => header.wire_name),
  );
  assert.equal(legacyHeaderAttestation.forbidden_fragments.every((item) => item.verified), true);
  assert.equal(validateQworkReleaseIntake(report, { requireFreshRef: true }).ok, true);

  const forged = structuredClone(report);
  const forgedLegacy = forged.source_contracts.find((item) => (
    item.contract_id === QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id
  ));
  forgedLegacy.current_assertion_owners.header_emissions.lineage = [
    QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id,
  ];
  const forgedValue = structuredClone(forgedLegacy);
  delete forgedValue.attestation_sha256;
  forgedLegacy.attestation_sha256 = sha256Text(stableJson(forgedValue));
  const forgedValidation = validateReleaseSourceContractsForReport(forged);
  assert.equal(forgedValidation.ok, false);
  assert.equal(forgedValidation.failures.some((failure) => (
    failure.includes('attestation_current_assertion_owners_mismatch')
  )), true);
  assert.equal(validateQworkReleaseIntake(forged, { requireReady: false }).failures.includes('content_sha256_mismatch'), true);
  const forgedReportValue = structuredClone(forged);
  delete forgedReportValue.integrity.content_sha256;
  forged.integrity.content_sha256 = sha256Text(stableJson(forgedReportValue));
  const rehashedValidation = validateQworkReleaseIntake(forged, { requireReady: false });
  assert.equal(rehashedValidation.ok, false);
  assert.equal(rehashedValidation.failures.some((failure) => (
    failure.includes('attestation_current_assertion_owners_mismatch')
  )), true);
});

test('GitLab API intake proves a release between MR !1552 and MR !1559 and audits legacy source', () => {
  const head = '7'.repeat(40);
  const fixture = apiFixture({ head });
  const fixedController = `
function terminalFor(start, code) {
  return { ...start, operation: 'execution.terminal', deadlineAt: Date.now() + 30000, payload: { code } };
}
runner.on('message', (runnerMessage) => {
  let validatedRunnerMessage;
  try {
    validatedRunnerMessage = validateEnvelope(runnerMessage, { direction: 'worker-to-host' });
  } catch (error) {
    process.parentPort.postMessage(terminalFor(startMessage, 'execution_worker_runner_protocol_error'));
    void runner.terminate();
    return;
  }
  if (validatedRunnerMessage?.operation === 'worker.pressure') {
    process.parentPort.postMessage({ ...validatedRunnerMessage, operation: 'worker.pressure' });
    return;
  }
  process.parentPort.postMessage(validatedRunnerMessage);
});
runner.on('exit', (exitCode) => {
  if (state.settled) return;
  state.settled = true;
  process.parentPort.postMessage(terminalFor(startMessage,
    exitCode === 0 ? 'execution_worker_runner_clean_exit_without_terminal' : 'execution_worker_runner_exit'));
});
`;
  const fixedSupervisor = `
function executionWorkerPressureFromMessage(message, currentPressure) {
  if (message.operation === 'worker.heartbeat') return currentPressure;
  if (message.operation !== 'worker.pressure') return null;
  return message.payload;
}
const onMessage = (raw) => {
  let message;
  try { message = validateEnvelope(raw, { direction: 'worker-to-host' }); }
  catch (error) { logger.error(error); return; }
  const nextPressure = executionWorkerPressureFromMessage(message, pressure);
  if (nextPressure) pressure = nextPressure;
};
`;
  const riskSources = new Map([
    ['electron/execution-worker.cjs', fixedController],
    ['electron/host-core/agent/execution-worker-supervisor.cjs', fixedSupervisor],
  ]);
  const reader = (endpoint) => {
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      const from = query.get('from');
      const to = query.get('to');
      if (from === QWORK_MR1552_MERGE_COMMIT_SHA && to === head) {
        return {
          compare_timeout: false,
          commits: [{
            id: head,
            parent_ids: [QWORK_MR1552_MERGE_COMMIT_SHA],
            title: 'Release after MR !1552',
            message: 'Release after MR !1552',
            committed_date: '2026-09-03T01:00:00Z',
          }],
        };
      }
      if (from === head && to === QWORK_MR1552_MERGE_COMMIT_SHA) {
        return { compare_timeout: false, commits: [] };
      }
      if (from === QWORK_MR1559_MERGE_COMMIT_SHA && to === head) {
        return { compare_timeout: false, commits: [] };
      }
      if (from === head && to === QWORK_MR1559_MERGE_COMMIT_SHA) {
        return {
          compare_timeout: false,
          commits: [{
            id: QWORK_MR1559_MERGE_COMMIT_SHA,
            parent_ids: [head],
            title: 'MR !1559 follows current release',
            message: 'MR !1559 follows current release',
            committed_date: '2026-09-03T01:01:00Z',
          }],
        };
      }
    }
    if (endpoint.startsWith('repository/files/')) {
      const encodedPath = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      const filePath = decodeURIComponent(encodedPath);
      if (QWORK_MR1552_LEGACY_PROTECTED_PATHS.includes(filePath)) {
        let inheritedSource = '';
        try {
          const inherited = fixture.reader(endpoint);
          inheritedSource = Buffer.from(inherited.content, 'base64').toString('utf8');
        } catch {
          // This fixture path is owned only by the blocking-risk contract.
        }
        const source = `${inheritedSource}${riskSources.get(filePath) || `// legacy release source: ${filePath}\n`}`;
        return gitLabFilePayload(filePath, source, head);
      }
    }
    return fixture.reader(endpoint);
  };
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  const risk = report.blocking_risks[0];
  assert.equal(risk.applicability, 'VERIFIED_APPLICABLE');
  assert.equal(risk.successor_applicability, 'VERIFIED_NOT_APPLICABLE');
  assert.equal(risk.architecture, 'shared-worker-registry/v1');
  assert.equal(risk.status, 'VERIFIED', JSON.stringify(risk));
  assert.equal(risk.release_before_successor_ancestry.compare_from, head);
  assert.equal(risk.release_before_successor_ancestry.compare_to, QWORK_MR1559_MERGE_COMMIT_SHA);
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
});

test('GitLab API intake blocks when neither direction proves the blocking-risk ancestry', () => {
  const fixture = apiFixture();
  const riskMerges = new Set([QWORK_MR1552_MERGE_COMMIT_SHA, QWORK_MR1559_MERGE_COMMIT_SHA]);
  const reader = (endpoint) => {
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      const from = query.get('from');
      const to = query.get('to');
      if ((riskMerges.has(from) && to === fixture.head)
        || (from === fixture.head && riskMerges.has(to))) {
        return { compare_timeout: false, commits: [] };
      }
    }
    return fixture.reader(endpoint);
  };
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.equal(report.policy.api_freshness.verified, false);
  assert.equal(report.blocking_risks[0].applicability, 'UNKNOWN');
  assert.equal(report.blocking_risks[0].status, 'BLOCKED');
  assert.deepEqual(report.blocking_risks[0].evidence_failures, ['release_ancestry_unknown']);
  assert.match(report.blockers.join('\n'), /阻断风险审计未通过/);
});

test('GitLab API freshness accounts a trusted single-parent squash MR', () => {
  const baseline = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const fixture = apiFixture({
    baseline,
    head,
    mergeCommitSha: '',
    squashCommitSha: head,
    compareCommits: [{
      id: head,
      parent_ids: [baseline],
      title: 'Squashed release change',
      message: 'Squashed release change',
      committed_date: '2026-09-03T01:00:00Z',
    }],
    changes: [{
      old_path: 'server/engine.mjs',
      new_path: 'server/engine.mjs',
      diff: '+export const routed = true;',
    }],
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-FAIL-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  assert.deepEqual(report.commit_accounting, [{
    commit: head,
    parent_count: 1,
    classification: 'squash_mr',
    mr_iid: '901',
    attribution_verified: true,
    reason: '',
  }]);
  assert.equal(report.merge_requests[0].attribution_kind, 'squash_mr');
  assert.equal(report.policy.api_freshness.first_parent_commit_count, 1);
  assert.equal(report.policy.api_freshness.accounted_commit_count, 1);
  assert.equal(report.policy.api_freshness.merge_commit_count, 0);
  assert.equal(report.policy.api_freshness.squash_mr_commit_count, 1);
  assert.equal(report.policy.api_freshness.unattributed_direct_commit_count, 0);
  assert.equal(validateQworkReleaseIntake(report, { requireFreshRef: true }).ok, true);
});

test('GitLab API freshness never drops an unattributed single-parent HEAD', () => {
  const baseline = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const fixture = apiFixture({
    baseline,
    head,
    compareCommits: [{
      id: head,
      parent_ids: [baseline],
      title: 'Direct release commit',
      message: 'Direct release commit',
      committed_date: '2026-09-03T01:00:00Z',
    }],
    commitMrRows: new Map([[head, []]]),
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-FAIL-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.deepEqual(report.unresolved.unattributed_direct_commits, [head]);
  assert.equal(report.commit_accounting.length, 1);
  assert.equal(report.commit_accounting[0].classification, 'unattributed_direct_commit');
  assert.equal(report.policy.api_freshness.first_parent_commit_count, 1);
  assert.equal(report.policy.api_freshness.accounted_commit_count, 1);
  assert.equal(report.policy.api_freshness.unattributed_direct_commit_count, 1);
  assert.equal(report.policy.api_freshness.mr_changes_verified_count, 0);
  assert.match(report.blockers.join('\n'), /无法可信归因/);
});

test('GitLab API freshness accounts a direct commit between two merge commits', () => {
  const baseline = 'a'.repeat(40);
  const firstMerge = 'b'.repeat(40);
  const direct = 'c'.repeat(40);
  const head = 'd'.repeat(40);
  const mrRow = (iid, commitSha) => ({
    iid,
    title: `release change ${iid}`,
    state: 'merged',
    target_branch: 'release/0.1',
    source_branch: `feature/release-${iid}`,
    merge_commit_sha: commitSha,
    squash_commit_sha: '',
    merged_at: '2026-09-03T01:00:00Z',
    labels: ['area/runtime'],
  });
  const mrChanges = (iid, commitSha) => ({
    iid,
    state: 'merged',
    target_branch: 'release/0.1',
    merge_commit_sha: commitSha,
    squash_commit_sha: '',
    changes_count: '1',
    overflow: false,
    changes: [{
      old_path: 'server/engine.mjs',
      new_path: 'server/engine.mjs',
      diff: `+export const mr${iid} = true;`,
    }],
  });
  const fixture = apiFixture({
    baseline,
    head,
    compareCommits: [
      {
        id: firstMerge,
        parent_ids: [baseline, 'e'.repeat(40)],
        title: 'First merge',
        message: 'First merge',
        committed_date: '2026-09-03T01:00:00Z',
      },
      {
        id: direct,
        parent_ids: [firstMerge],
        title: 'Direct release commit',
        message: 'Direct release commit',
        committed_date: '2026-09-03T01:01:00Z',
      },
      {
        id: head,
        parent_ids: [direct, 'f'.repeat(40)],
        title: 'Second merge',
        message: 'Second merge',
        committed_date: '2026-09-03T01:02:00Z',
      },
    ],
    commitMrRows: new Map([
      [firstMerge, [mrRow(1001, firstMerge)]],
      [direct, []],
      [head, [mrRow(1002, head)]],
    ]),
    mrChangesByIid: new Map([
      ['1001', mrChanges(1001, firstMerge)],
      ['1002', mrChanges(1002, head)],
    ]),
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-FAIL-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.deepEqual(report.commit_accounting.map((row) => row.commit), [firstMerge, direct, head]);
  assert.deepEqual(report.commit_accounting.map((row) => row.classification), [
    'merge_mr',
    'unattributed_direct_commit',
    'merge_mr',
  ]);
  assert.deepEqual(report.unresolved.unattributed_direct_commits, [direct]);
  assert.equal(report.policy.api_freshness.first_parent_commit_count, 3);
  assert.equal(report.policy.api_freshness.accounted_commit_count, 3);
  assert.equal(report.policy.api_freshness.merge_commit_count, 2);
  assert.equal(report.policy.api_freshness.unattributed_direct_commit_count, 1);
  assert.equal(report.policy.api_freshness.mr_changes_verified_count, 2);
  assert.equal(report.merge_requests.length, 2);
});

for (const scenario of [
  { name: 'wrong squash SHA', options: { squashCommitSha: 'c'.repeat(40) } },
  { name: 'unmerged squash MR', options: { mrState: 'opened' } },
  { name: 'wrong squash target branch', options: { targetBranch: 'main' } },
  {
    name: 'changes squash identity mismatch',
    options: {
      mrChangesByIid: new Map([['901', {
        iid: 901,
        state: 'merged',
        target_branch: 'release/0.1',
        merge_commit_sha: '',
        squash_commit_sha: 'c'.repeat(40),
        changes_count: '1',
        overflow: false,
        changes: [{ old_path: 'server/engine.mjs', new_path: 'server/engine.mjs', diff: '+change' }],
      }]]),
    },
  },
]) {
  test(`GitLab API freshness fail-closes claimed squash MR with ${scenario.name}`, () => {
    const baseline = 'a'.repeat(40);
    const head = 'b'.repeat(40);
    const fixture = apiFixture({
      baseline,
      head,
      mergeCommitSha: '',
      squashCommitSha: head,
      compareCommits: [{
        id: head,
        parent_ids: [baseline],
        title: 'Claimed squash release change',
        message: 'Claimed squash release change',
        committed_date: '2026-09-03T01:00:00Z',
      }],
      changes: [{ old_path: 'server/engine.mjs', new_path: 'server/engine.mjs', diff: '+change' }],
      ...scenario.options,
    });
    const report = scanQworkReleaseIntake({
      repoRoot: process.cwd(),
      releaseRef: 'origin/release/0.1',
      baselineCommit: fixture.baseline,
      caseIds: ['MRSMOKE-FAIL-001'],
      frameworkCommit: 'd'.repeat(40),
      gitlabReader: fixture.reader,
      freshnessSource: 'gitlab-api',
    });
    assert.equal(report.decision, 'BLOCKED');
    assert.equal(report.policy.api_freshness.verified, false);
    assert.equal(report.policy.api_freshness.unattributed_direct_commit_count, 1);
    assert.deepEqual(report.unresolved.unattributed_direct_commits, [head]);
  });
}

test('release intake validation rejects rehashed first-parent accounting drift', () => {
  const fixture = apiFixture();
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  const forged = structuredClone(report);
  forged.policy.api_freshness.accounted_commit_count += 1;
  const forgedValue = structuredClone(forged);
  delete forgedValue.integrity.content_sha256;
  forged.integrity.content_sha256 = sha256Text(stableJson(forgedValue));
  const validation = validateQworkReleaseIntake(forged, { requireFreshRef: true });
  assert.equal(validation.ok, false);
  assert.equal(
    validation.failures.includes('commit_accounting:accounted_commit_count_mismatch'),
    true,
  );
  assert.equal(validation.failures.includes('content_sha256_mismatch'), false);
});

test('GitLab API intake switches MR !1552 blocking-risk assertions to the proven MR !1559 architecture', () => {
  const fixture = apiFixture({
    head: QWORK_MR1559_MERGE_COMMIT_SHA,
    mergeCommitSha: QWORK_MR1559_MERGE_COMMIT_SHA,
    mrIid: 1559,
  });
  const sources = new Map([
    ['electron/execution-worker.cjs', "require('./host-core/agent/execution-worker-entry.cjs');\n"],
    ['electron/host-core/agent/execution-worker-manager.cjs', `
      async function acquire(identity) {
        if (executions.size >= maxConcurrentExecutions) throw Object.assign(new Error(), { code: 'execution_worker_pressure_admission_closed' });
        const supervisor = supervisorFactory({ maxPendingRequests: 1, maxRestarts: 0 });
        const requestId = identity.requestId;
        const record = { supervisor };
        executions.set(requestId, record);
        return { supervisor, release: async () => { executions.delete(requestId); await supervisor.stop(); } };
      }
    `],
    ['electron/host-core/agent/execution-worker-supervisor.cjs', `
      function rejectPending(error) { return error; }
      function executionWorkerExitFailure(code, signal) { return { code, signal }; }
      function onExit(code, signal) { rejectPending(executionWorkerExitFailure(code, signal)); }
    `],
    ['electron/host-core/agent/desktop-host-context.cjs', `
      executionWorkerLease = await executionWorkerManager.acquire('execution.start', identity, { signal });
      supervisor = executionWorkerLease.supervisor;
      try { await supervisor.request(); } finally { await executionWorkerLease?.release?.(); }
    `],
  ]);
  const blockingRiskFiles = new Map(QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS.map((filePath, index) => {
    const source = sources.get(filePath) || `// current MR !1559 release source: ${filePath}\n`;
    return [filePath, {
      file_name: path.basename(filePath),
      file_path: filePath,
      size: Buffer.byteLength(source, 'utf8'),
      encoding: 'base64',
      content: Buffer.from(source, 'utf8').toString('base64'),
      ref: fixture.head,
      blob_id: gitBlobSha1(source),
      commit_id: fixture.head,
      last_commit_id: fixture.head,
    }];
  }));
  const reader = (endpoint) => {
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      if (query.get('from') === QWORK_MR1552_MERGE_COMMIT_SHA) {
        return {
          compare_timeout: false,
          commits: [{
            id: fixture.head,
            parent_ids: [QWORK_MR1552_MERGE_COMMIT_SHA, 'c'.repeat(40)],
            title: 'Merge branch execution-worker-utility-process into release/0.1',
            message: 'Merge branch execution-worker-utility-process into release/0.1',
            committed_date: '2026-09-04T01:00:00Z',
          }],
        };
      }
    }
    if (endpoint.startsWith('repository/files/')) {
      const encodedPath = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      const filePath = decodeURIComponent(encodedPath);
      if (blockingRiskFiles.has(filePath)) {
        const riskFile = blockingRiskFiles.get(filePath);
        let inheritedSource = '';
        let inheritedFile = null;
        try {
          inheritedFile = fixture.reader(endpoint);
          inheritedSource = Buffer.from(inheritedFile.content, 'base64').toString('utf8');
        } catch {
          // This path is protected only by the blocking-risk contract in this fixture.
        }
        if (!inheritedFile) return riskFile;
        const source = `${inheritedSource}${Buffer.from(riskFile.content, 'base64').toString('utf8')}`;
        return {
          ...inheritedFile,
          size: Buffer.byteLength(source, 'utf8'),
          content: Buffer.from(source, 'utf8').toString('base64'),
          blob_id: gitBlobSha1(source),
        };
      }
    }
    return fixture.reader(endpoint);
  };
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  const risk = report.blocking_risks[0];
  assert.equal(risk.architecture, 'per-turn-utility-process/v1');
  assert.equal(risk.assertion_owner.contract_id, QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID);
  assert.equal(risk.status, 'VERIFIED', JSON.stringify(risk));
  assert.equal(report.policy.api_freshness.blocking_risks_verified, true);
  const validation = validateQworkReleaseIntake(report, { requireFreshRef: true });
  assert.equal(validation.ok, true, validation.failures.join(','));
});

test('GitLab API scan binds a verified source contract into MR, summary, and freshness', () => {
  const sourceFixture = sourceContractFixture();
  const fixture = apiFixture({
    head: sourceFixture.contract.merge_commit_sha,
    mrIid: Number(sourceFixture.contract.mr_iid),
    changesCount: String(sourceFixture.changes.length),
    changes: sourceFixture.changes,
    sourceContracts: [...QWORK_RELEASE_SOURCE_CONTRACTS, sourceFixture.contract],
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-ROUTE-001', 'BETA-HOST-003'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
    sourceContracts: [...QWORK_RELEASE_SOURCE_CONTRACTS, sourceFixture.contract],
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  assert.equal(report.policy.api_freshness.verified, true);
  assert.equal(report.policy.api_freshness.source_contracts_verified, true);
  assert.deepEqual(report.merge_requests[0].source_contract_ids, [sourceFixture.contract.contract_id]);
  assert.equal(report.source_contracts.find((item) => item.contract_id === sourceFixture.contract.contract_id)?.verified, true);
  const expectedContractCount = QWORK_RELEASE_SOURCE_CONTRACTS.length + 1;
  assert.equal(report.summary.source_contract_count, expectedContractCount);
  assert.equal(report.summary.source_contract_verified_count, expectedContractCount);
  assert.equal(report.summary.source_contract_current_count, expectedContractCount);
  assert.equal(report.summary.source_contract_origin_count, 1);
  assert.equal(report.policy.api_freshness.source_contract_current_count, expectedContractCount);
  assert.equal(report.policy.api_freshness.source_contract_origin_count, 1);
  assert.equal(report.summary.source_contract_failure_count, 0);
  assert.deepEqual(report.unresolved.source_contract_failures, []);
  assert.equal(validateQworkReleaseIntake(report, {
    requireFreshRef: true,
    sourceContracts: [...QWORK_RELEASE_SOURCE_CONTRACTS, sourceFixture.contract],
  }).ok, true);
});

test('GitLab API scan binds a source contract by exact merge SHA when IID is wrong', () => {
  const sourceFixture = sourceContractFixture();
  const fixture = apiFixture({
    head: sourceFixture.contract.merge_commit_sha,
    mrIid: Number(sourceFixture.contract.mr_iid) + 1,
    changesCount: String(sourceFixture.changes.length),
    changes: sourceFixture.changes,
    sourceContracts: [...QWORK_RELEASE_SOURCE_CONTRACTS, sourceFixture.contract],
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-ROUTE-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
    sourceContracts: [...QWORK_RELEASE_SOURCE_CONTRACTS, sourceFixture.contract],
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.equal(report.source_contracts.length, QWORK_RELEASE_SOURCE_CONTRACTS.length + 1);
  const customAttestation = report.source_contracts.find((item) => item.contract_id === sourceFixture.contract.contract_id);
  assert.equal(customAttestation.origin_change_attestation.failures.includes('mr_iid_mismatch'), true);
  assert.equal(customAttestation.failures.includes('origin_change_attestation_not_verified'), true);
  assert.equal(report.policy.api_freshness.source_contracts_verified, false);
  assert.equal(report.unresolved.source_contract_failures.length > 0, true);
});

test('GitLab API scan treats an explicit empty registry as all built-in source contracts', () => {
  const fixture = apiFixture();
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: [],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
    sourceContracts: [],
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  assert.equal(report.source_contracts.length, QWORK_RELEASE_SOURCE_CONTRACTS.length);
  assert.equal(report.summary.source_contract_current_count, QWORK_RELEASE_SOURCE_CONTRACTS.length);
  assert.equal(report.summary.source_contract_current_verified_count, QWORK_RELEASE_SOURCE_CONTRACTS.length);
  assert.equal(report.summary.source_contract_origin_count, 0);
  assert.equal(report.summary.source_contract_origin_verified_count, 0);
  assert.equal(report.source_contracts.every((item) => item.source === 'gitlab-api-current-release-files'), true);
  assert.equal(report.source_contracts.every((item) => item.origin_change_attestation === null), true);
});

test('GitLab API scan fail-closes MR !1522 when protected source bytes do not match', () => {
  const contract = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  const fixture = apiFixture({
    head: contract.merge_commit_sha,
    mrIid: Number(contract.mr_iid),
    changes: [{
      old_path: contract.source_file.path,
      new_path: contract.source_file.path,
      new_file: true,
      renamed_file: false,
      deleted_file: false,
      diff: '@@ -0,0 +1,1 @@\n+export const forged = true;\n',
    }],
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-ROUTE-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.equal(report.policy.api_freshness.source_contracts_verified, false);
  assert.equal(report.summary.source_contract_count, QWORK_RELEASE_SOURCE_CONTRACTS.length);
  assert.equal(report.summary.source_contract_verified_count, QWORK_RELEASE_SOURCE_CONTRACTS.length - 1);
  assert.equal(report.summary.source_contract_current_count, QWORK_RELEASE_SOURCE_CONTRACTS.length);
  assert.equal(report.summary.source_contract_origin_count, 1);
  assert.equal(report.summary.source_contract_origin_verified_count, 0);
  assert.equal(report.summary.source_contract_failure_count > 0, true);
  assert.deepEqual(report.merge_requests[0].source_contract_ids, [contract.contract_id]);
  const sourceAttestation = report.source_contracts.find((item) => item.contract_id === contract.contract_id);
  assert.equal(sourceAttestation.verified, false);
  assert.equal(sourceAttestation.origin_change_attestation.failures.includes('mr_changes_count_mismatch'), true);
  assert.equal(sourceAttestation.failures.includes('origin_change_attestation_not_verified'), true);
  assert.equal(report.unresolved.source_contract_failures.length > 0, true);
  assert.equal(validateQworkReleaseIntake(report, { requireReady: false, requireFreshRef: true }).ok, false);
});

test('GitLab API freshness blocks when release branch moves during the scan', () => {
  const fixture = apiFixture({ afterHead: 'e'.repeat(40) });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.equal(report.policy.api_freshness.verified, false);
  assert.equal(validateQworkReleaseIntake(report, { requireReady: false, requireFreshRef: true }).ok, false);
});

test('GitLab API freshness blocks incomplete compare first-parent data', () => {
  const fixture = apiFixture({ omitHeadFromCompare: true });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.match(report.blockers.join('\n'), /freshness/);
});

for (const scenario of [
  { name: 'unmerged MR', options: { mrState: 'opened' } },
  { name: 'wrong target branch', options: { targetBranch: 'main' } },
  { name: 'wrong merge SHA', options: { mergeCommitSha: 'f'.repeat(40) } },
  { name: 'incomplete changes', options: { changesCount: '2' } },
  { name: 'overflow changes', options: { overflow: true } },
]) {
  test(`GitLab API freshness blocks ${scenario.name}`, () => {
    const fixture = apiFixture(scenario.options);
    const report = scanQworkReleaseIntake({
      repoRoot: process.cwd(),
      releaseRef: 'origin/release/0.1',
      baselineCommit: fixture.baseline,
      caseIds: ['BETA-INIT-001'],
      frameworkCommit: 'd'.repeat(40),
      gitlabReader: fixture.reader,
      freshnessSource: 'gitlab-api',
    });
    assert.equal(report.decision, 'BLOCKED');
    assert.equal(report.policy.api_freshness.verified, false);
    assert.equal(report.unresolved.unverified_mr_metadata.length, 1);
  });
}

test('new repository governance paths remain static-only', () => {
  const mapped = mapReleaseImpact({
    changedPaths: [
      '.architecture.yaml',
      '.codex/environments/environment.toml',
      '.codex/hooks.json',
      'CONTEXT.md',
      'server/qbot-core/docs/model-gateway-local-diagnostics.md',
    ],
    subject: 'repository governance cleanup',
    availableCaseIds: ['BETA-INIT-001'],
  });
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.direct_case_ids.length, 0);
  assert.deepEqual(mapped.static_dispositions.map((item) => item.disposition).sort(), [
    'Agent-metadata-only',
    'Codex-governance-only',
    'Codex-governance-only',
    'Repository-architecture-only',
    'Research/docs-only',
  ]);
});

test('intake output is immutable and content hash is validated', () => {
  const { repo, baseline } = fixtureRepo();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-intake-out-'));
  fs.rmSync(out, { recursive: true, force: true });
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      requireGitLabMetadata: false,
      gitlabReader: () => [],
    });
    const files = writeQworkReleaseIntake({ report, outDir: out });
    assert.equal(fs.existsSync(files.json), true);
    assert.equal(validateQworkReleaseIntake(JSON.parse(fs.readFileSync(files.json, 'utf8')), { requireReady: false }).ok, true);
    assert.equal(validateQworkReleaseIntake(JSON.parse(fs.readFileSync(files.json, 'utf8')), { requireReady: false, requireFreshRef: true }).ok, false);
    assert.throws(() => writeQworkReleaseIntake({ report, outDir: out }), /新的不可变目录/);
    assert.equal(typeof stableJson(report), 'string');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('a bound intake cannot cross release, Casebook, or framework identity', () => {
  const report = {
    schema_version: QWORK_RELEASE_INTAKE_SCHEMA,
    tool: { version: QWORK_RELEASE_INTAKE_TOOL_VERSION },
    decision: 'READY',
    release: { ref: 'origin/release/0.1', head: 'c'.repeat(40) },
    framework: { commit: 'd'.repeat(40) },
    casebook: { sha256: 'e'.repeat(64) },
    scan_boundary: { mode: 'commit_ancestry', ancestry_verified: true },
    merge_requests: [],
    source_contracts: [],
    summary: {
      source_contract_count: 0,
      source_contract_verified_count: 0,
      source_contract_failure_count: 0,
    },
    unresolved: {
      unmapped_product_paths: [],
      unverified_mr_metadata: [],
      source_contract_failures: [],
    },
    blockers: [],
    policy: { fetch_latest: true },
    integrity: { content_sha256: '' },
  };
  const withoutHash = structuredClone(report);
  delete withoutHash.integrity.content_sha256;
  report.integrity.content_sha256 = sha256Text(stableJson(withoutHash));
  const plan = {
    policy: { release_intake_required: true },
    release_intake: {
      schema_version: QWORK_RELEASE_INTAKE_SCHEMA,
      path: '/tmp/release-intake.json',
      sha256: 'f'.repeat(64),
      content_sha256: report.integrity.content_sha256,
      release_ref: report.release.ref,
      release_head: report.release.head,
    },
    casebook: { sha256: report.casebook.sha256 },
    framework: { commit: report.framework.commit },
  };
  const accepted = validateQworkReleaseIntakeBinding({ plan, report, reportSha256: 'f'.repeat(64) });
  assert.equal(accepted.ok, true);
  const drifted = validateQworkReleaseIntakeBinding({
    plan: { ...plan, framework: { commit: '0'.repeat(40) } },
    report,
    reportSha256: 'f'.repeat(64),
  });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.failures.some((item) => item.includes('framework_commit')), true);
});
