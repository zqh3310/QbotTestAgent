export const PRODUCTION_CASEBOOK_CONTRACT_VERSION = 'qbot-production-gate/v2';
export const LATEST_MAIN_BASELINE = Object.freeze({
  repository: 'deepbankV2',
  ref: 'origin/main',
  commit: 'a0a4231f47900290dfed11f57ffa786f4dd066d3',
  audited_at: '2026-07-24',
});

export const PRODUCTION_TRUST_CONTRACT_FIELDS = Object.freeze([
  'contract_version',
  'product_baseline',
  'migration_disposition',
  'visible_action_contract',
  'state_readback_contract',
  'required_evidence_roles',
  'forbidden_shortcuts',
  'selector_contract',
  'identity_contract',
  'trusted_review_contract',
]);

export const LEGACY_PRODUCT_ASSERTION_PATTERNS = Object.freeze([
  /composer-skills-menu/,
  /composer-connectors-menu/,
  /composer-skill-mode-(?:auto|manual|disabled)/,
  /composer-connector-mode-(?:auto|manual|disabled)/,
  /assistant-turn-summary-created-file/,
  /data-testid=["']nav-knowledge["']/,
]);

const REPLACE_CASE_IDS = new Set([
  'SIT-SKILL-007',
  'SIT-CONN-003',
]);

const REWRITE_CASE_IDS = new Set([
  'SIT-INIT-002',
  'SIT-AUTH-003',
  'SIT-TEAMS-NEW-001',
  'SIT-TEAMS-NEW-003',
  'SIT-HOME-002',
  'SIT-HOME-012',
  'SIT-HOME-013',
  'SIT-HOME-014',
  'SIT-TASK-RECOVER-001',
  'SIT-ISSUE-793',
  'SIT-HOME-006',
  'SIT-WORKSPACE-001',
  'SIT-EXPERT-001',
  'SIT-EXPERT-004',
  'SIT-EXPERT-006',
  'SIT-EXPERT-009',
  'SIT-EXPERT-013',
  'SIT-EXPERT-021',
  'SIT-EXPERT-022',
  'SIT-SKILL-001',
  'SIT-SKILL-025',
  'SIT-SKILL-003',
  'SIT-SKILL-014',
  'SIT-SKILL-016',
  'SIT-SKILL-017',
  'SIT-SKILL-026',
  'SIT-SKILL-013',
  'SIT-SKILL-030',
  'SIT-SKILL-032',
  'SIT-SKILL-SCOPE-001',
  'SIT-CONN-001',
  'SIT-CONN-002',
  'SIT-CONN-004',
  'SIT-CONN-008',
  'SIT-CONN-009',
  'SIT-CONN-010',
  'SIT-CONN-011',
  'SIT-CONN-015',
  'SIT-CONN-019',
  'SIT-TEAMS-DOC-001',
  'SIT-ART-001',
  'SIT-ART-002',
  'SIT-ART-015',
  'SIT-ART-017',
  'SIT-ART-021',
  'SIT-ART-022',
  'SIT-ART-CONFIRM-001',
  'SIT-ART-013',
  'SIT-ART-014',
  'SIT-ART-024',
  'SIT-KNOWLEDGE-001',
]);

const STRENGTHEN_CASE_IDS = new Set([
  'SIT-INIT-004',
  'SIT-INIT-009',
  'SIT-INIT-025',
  'SIT-AUTH-001',
  'SIT-AUTH-005',
  'SIT-TEAMS-NEW-002',
  'SIT-RUNTIME-RECOVER-001',
  'SIT-HOME-023',
  'SIT-HOME-025',
  'SIT-HOME-030',
  'SIT-HOME-049',
  'SIT-HOME-050',
  'SIT-HITL-002',
  'SIT-TASK-EDIT-001',
  'SIT-TASK-REGEN-001',
  'SIT-ISSUE-800',
  'SIT-HOME-037',
  'SIT-HOME-038',
  'SIT-HOME-040',
  'SIT-HOME-041',
  'SIT-HOME-043',
  'SIT-HOME-044',
  'SIT-HOME-056',
  'SIT-FILE-NEW-001',
  'SIT-CONN-016',
  'SIT-MEM-001',
]);

const RETAIN_CASE_IDS = new Set([
  'SIT-HOME-015',
  'SIT-HOME-016',
  'SIT-HOME-022',
  'SIT-HOME-053',
  'SIT-HOME-057',
  'SIT-HOME-058',
  'SIT-HOME-060',
  'SIT-HOME-062',
  'SIT-HOME-019',
  'SIT-HOME-054',
  'SIT-HOME-055',
  'SIT-HOME-065',
  'SIT-HOME-066',
]);

const EXPECTED_CASE_COUNT_BY_DISPOSITION = Object.freeze({
  replace_obsolete_assertion: 2,
  rewrite_for_latest_main: 51,
  retain_and_strengthen_evidence: 26,
  retain_business_oracle: 13,
});

const SELECTOR_REPLACEMENTS = Object.freeze([
  [/\[data-testid=["']composer-skills-menu["']\]/g, '[data-testid="composer-plus-menu"]; .composer-plus-sub-skill'],
  [/\[data-testid=["']composer-connectors-menu["']\]/g, '[data-testid="composer-plus-menu"]; .composer-plus-sub-connector; [data-testid="composer-connector-chip"]'],
  [/\s*;?\s*\[data-testid=["']composer-skill-mode-(?:auto|manual|disabled)["']\]/g, ''],
  [/\s*;?\s*\[data-testid=["']composer-connector-mode-(?:auto|manual|disabled)["']\]/g, ''],
  [/\[data-testid=["']assistant-turn-summary-created-file["']\]/g, '[data-testid="assistant-turn-summary-modified-files"]; [data-testid="assistant-turn-summary-modified-file"]; [data-testid="assistant-turn-summary-file-status"]'],
  [/\[data-testid=["']nav-knowledge["']\]/g, '[data-testid="nav-more"]（可见标签“知识”）'],
]);

function migrationDisposition(id) {
  if (REPLACE_CASE_IDS.has(id)) return 'replace_obsolete_assertion';
  if (REWRITE_CASE_IDS.has(id)) return 'rewrite_for_latest_main';
  if (STRENGTHEN_CASE_IDS.has(id)) return 'retain_and_strengthen_evidence';
  if (RETAIN_CASE_IDS.has(id)) return 'retain_business_oracle';
  return 'unmapped';
}

function replaceLegacySelectors(value) {
  let selectors = String(value || '');
  for (const [pattern, replacement] of SELECTOR_REPLACEMENTS) {
    selectors = selectors.replace(pattern, replacement);
  }
  return selectors
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .join('; ');
}

function selectorContractFor(testCase) {
  const id = String(testCase.id || '');
  if (id === 'SIT-SKILL-007' || id.startsWith('SIT-SKILL-')) {
    return '主锚点：composer-plus-menu → .composer-plus-sub-skill → composer-skill-chip-*；禁止用旧三态按钮或整页文本冒充当前菜单。';
  }
  if (id === 'SIT-CONN-003' || id.startsWith('SIT-CONN-') || id === 'SIT-TEAMS-DOC-001') {
    return '主锚点：composer-plus-menu → .composer-plus-sub-connector → composer-connector-chip；必须绑定可见连接器项与 selectedConnectors 读回。';
  }
  if (/^(?:SIT-ART-|SIT-TASK-REGEN-001)/.test(id)) {
    return '主锚点：artifact-panel/web-preview-panel/assistant-turn-summary-modified-files；必须按文件名、状态、哈希与预览对象绑定。';
  }
  if (id === 'SIT-KNOWLEDGE-001') {
    return '知识入口由 nav-more 的可见标签“知识”定位；禁止依赖已删除的 nav-knowledge。';
  }
  if (/^SIT-EXPERT-|SIT-HOME-006|SIT-HOME-012/.test(id)) {
    return '主锚点：composer-plus-menu → 专家子菜单 / expert-detail-modal / composer-expert-chip；必须验证专家身份读回与移除。';
  }
  return `仅允许 latest-main 稳定 testid/role/可见标签；当前入口：${replaceLegacySelectors(testCase.selectors) || '按 Case runner 绑定用户可见对象'}。`;
}

function visibleActionContractFor(testCase) {
  const id = String(testCase.id || '');
  if (id === 'SIT-SKILL-007') {
    return '用户必须真实执行“+ > 技能 > 选择技能 > 观察句内 chip > 点击 chip 移除”；默认/禁用策略只能作为 fixture 前置，不能替代可见动作验收。';
  }
  if (id === 'SIT-CONN-003') {
    return '用户必须真实执行“+ > 连接器 > 选择健康连接器 > 观察连接器 chip > 从 chip 子菜单取消选择”；默认/禁用策略只能作为 fixture 前置。';
  }
  if (/^SIT-ART-/.test(id)) {
    return '用户必须从真实会话产生或打开本 Case 成果，并在成果/预览 UI 完成指定操作；不得直接读取工作区文件跳过 UI 主链。';
  }
  if (/^SIT-AUTH-|SIT-TEAMS-NEW-00[12]|SIT-RUNTIME-RECOVER-001/.test(id)) {
    return '登录、退出、关闭/重开或恢复动作必须由受控宿主流程真实发生并保留 before/action/after；setup 日志不能冒充核心用户动作。';
  }
  if (String(testCase.kind || '').includes('conversation') || /会话|回复|对话|任务/.test(String(testCase.scenario || ''))) {
    return '必须新建/绑定本 Case 独立 taskId，填入完整 prompt、真实发送并等待本轮 reply-delta；不得复用历史回复或只检查页面最终文本。';
  }
  return '每个编号步骤必须在 360 Teams 内嵌 QWork 的用户可见 UI 实际执行；入口缺失即产品失败或可信阻塞，不得跳步判通过。';
}

function stateReadbackContractFor(testCase) {
  const id = String(testCase.id || '');
  if (id.startsWith('SIT-SKILL-')) {
    return 'UI 选择/chip 为主证据，capabilities.selectedSkills 与会话强走/工具日志为独立读回；bridge 仅可做 fixture setup/cleanup。';
  }
  if (id.startsWith('SIT-CONN-') || id === 'SIT-TEAMS-DOC-001') {
    return 'UI 连接器项/chip 为主证据，selectedConnectors、connectorRouting、真实 MCP/tool call 为独立读回；bridge 仅可做 fixture setup/cleanup。';
  }
  if (/^SIT-ART-|SIT-KNOWLEDGE-001/.test(id)) {
    return 'UI 成果/知识入口、文件状态与预览为主证据；文件路径、SHA-256、内容读回和任务归属必须全部一致。';
  }
  return '至少两路独立读回：用户可见 UI + DOM/公开能力状态/日志/文件事实之一；不得用同一 DOM 文本重复包装成两份证据。';
}

function evidenceRolesFor(testCase) {
  const roles = new Set([
    'before_screenshot',
    'action_screenshot',
    'after_screenshot',
    'numbered_step_assertions',
    'first_divergence_evidence',
    'case_report',
  ]);
  const id = String(testCase.id || '');
  const kind = String(testCase.kind || '');
  const text = `${kind}\n${testCase.module || ''}\n${testCase.submodule || ''}\n${testCase.scenario || ''}\n${testCase.steps || ''}`;
  if (
    /conversation|attachment/i.test(kind)
    || /发送|回复|对话|会话|提问|请求.*(?:生成|读取|修改)|让\s*(?:QBot|Agent)/i.test(text)
  ) {
    ['prompt', 'task_id', 'transcript', 'reply_delta'].forEach((item) => roles.add(item));
  }
  if (/技能|连接器|工具|Skill|Connector|MCP/i.test(text)) {
    roles.add('public_state_readback');
  }
  if (
    /(?:调用|强走|执行).*(?:技能|连接器|工具)|(?:技能|连接器|工具).*(?:调用|强走|执行)|MCP|qbot_web|qbot_chart/i.test(text)
  ) {
    roles.add('tool_or_mcp_call_log');
  }
  if (/附件|上传|文件上传/.test(text)) {
    ['attachment_name_size_sha256', 'composer_attachment_state', 'attachment_readback'].forEach((item) => roles.add(item));
  }
  if (/成果|artifact|预览|HTML|Markdown|文件/.test(text) || /^SIT-ART-/.test(id)) {
    ['artifact_path_sha256', 'artifact_content_readback', 'artifact_preview'].forEach((item) => roles.add(item));
  }
  if (/AUTH|登录|退出|重启|恢复|Teams/i.test(`${id}\n${text}`)) {
    roles.add('redacted_host_and_auth_log');
  }
  return [...roles].join(',');
}

const SPECIFIC_CASE_UPDATES = Object.freeze({
  'SIT-SKILL-007': {
    scenario: '统一“+ > 技能”的可见选择、句内 chip、状态读回与移除必须一致',
    selectors: '[data-testid="composer-plus-menu"]; .composer-plus-sub-skill; [data-testid^="composer-skill-chip-"]; .skill-chip-x',
    steps: [
      '1. 新建独立任务并记录默认 selectedSkills/技能策略，只读不改状态。',
      '2. 通过可见 UI 打开“+ > 技能”，选择一个已安装技能。',
      '3. 核对输入句内唯一 Skill chip、稳定 testid、技能名和 selectedSkills 一致。',
      '4. 点击 chip 移除按钮，核对 chip 消失且 selectedSkills 不再包含该技能。',
      '5. 核对当前 Case 未使用 bridge 改写选择；禁用隔离和自动调用分别由 SIT-SKILL-009、SIT-SKILL-019 独立验收。',
    ].join('\n'),
    expected_result: '默认策略可读；手动选择与移除均由用户可见 UI 完成并与 selectedSkills 一致。产品不再要求展示旧版禁用/自动/手动三态按钮。',
    success_criteria: '选择和移除均有 action/after 截图；chip testid、技能名和 selectedSkills 一一对应；任何 bridge 读回只能作独立状态证据，不能替代可见动作。',
    failure_criteria: '旧三态按钮缺失不算失败；选择无 chip、chip 与状态不一致、移除后仍残留，或仅靠 bridge/readback 未做可见动作均失败。',
  },
  'SIT-CONN-003': {
    scenario: '统一“+ > 连接器”的可见选择、连接器 chip、状态读回与移除必须一致',
    selectors: '[data-testid="composer-plus-menu"]; .composer-plus-sub-connector; [data-testid="composer-connector-chip"]; [data-testid^="composer-connector-option-"]',
    steps: [
      '1. 新建独立任务并记录默认 selectedConnectors/connectorRouting，只读不改状态。',
      '2. 通过可见 UI 打开“+ > 连接器”，选择一个健康连接器。',
      '3. 核对 composer-connector-chip 出现，selectedConnectors 只包含本次可见选择。',
      '4. 点击连接器 chip 打开其子菜单并取消该连接器，核对 chip 消失且状态清空。',
      '5. 核对当前 Case 未使用 bridge 改写选择；禁用隔离和自动调用分别由 SIT-CONN-010、SIT-CONN-011 独立验收。',
    ].join('\n'),
    expected_result: '默认策略可读；手动选择与移除均由用户可见 UI 完成并与 selectedConnectors/connectorRouting 一致。产品不再要求展示旧版三态按钮。',
    success_criteria: '可见连接器项、chip、selectedConnectors 和 taskId 一一对应；bridge 读回只作独立状态证据，不替代 UI 选择验收。',
    failure_criteria: '旧三态按钮缺失不算失败；选择无 chip、chip 与状态不一致、取消后仍残留，或只靠 bridge/readback 未做可见动作均失败。',
  },
  'SIT-INIT-002': {
    selectors: '[data-testid="composer-shell"]; [data-testid="composer-plus-menu"]; .composer-plus-main; [data-testid="composer-safety-level-menu"]',
    steps: '1. 从固定 360Teams/QWork RC 启动工作台。\n2. 核对 Composer 统一“+”菜单可见。\n3. 展开“+”，核对添加文件/模式/专家/技能/连接器完整且无旧独立技能/连接器入口依赖。\n4. 核对 M1–M4 安全级别为独立入口。\n5. 确认页面不要求普通用户选择模型供应商、Agent、CLI 或 runtime family。',
  },
  'SIT-TASK-REGEN-001': {
    selectors: 'button[aria-label="重新生成"]; [data-testid="message-list"]; [data-testid="assistant-turn-summary"]; [data-testid="assistant-turn-summary-modified-files"]; [data-testid="assistant-turn-summary-file-status"]',
  },
  'SIT-ART-CONFIRM-001': {
    selectors: '[data-testid="artifact-panel"]; [data-testid="assistant-turn-summary-modified-files"]; [data-testid="assistant-turn-summary-modified-file"]; [data-testid="assistant-turn-summary-file-status"]; [data-testid="nav-more"]（可见标签“知识”）',
  },
  'SIT-KNOWLEDGE-001': {
    selectors: '[data-testid="nav-new-task"]; [data-testid="composer-input"]; [data-testid="nav-more"]（可见标签“知识”）; [data-testid="knowledge-view"]',
  },
});

export function migrateProductionCase(testCase) {
  const id = String(testCase.id || '').trim();
  const specific = SPECIFIC_CASE_UPDATES[id] || {};
  const sourceType = String(testCase.source_type || '')
    .replace(/deepbankV2 origin\/main@[a-f0-9]{7,64}/i, `deepbankV2 origin/main@${LATEST_MAIN_BASELINE.commit}`);
  const migrated = {
    ...testCase,
    ...specific,
    selectors: replaceLegacySelectors(specific.selectors ?? testCase.selectors),
    source_type: sourceType || `deepbankV2 origin/main@${LATEST_MAIN_BASELINE.commit}; latest-main UI contract audit 2026-07-24`,
    version_scope: String(testCase.version_scope || '')
      .replace(/QWork\/runtime release 0\.0\.11（UI产品标识v0\.1\.0-dev）/g, 'QWork/runtime 0.0.12')
      .replace(/后端\/Prompt\/Feature Flags以run-metadata哈希冻结/g, 'UI git commit/build ID/release manifest、后端/Prompt/Feature Flags 均以 run-metadata 冻结'),
    contract_version: PRODUCTION_CASEBOOK_CONTRACT_VERSION,
    product_baseline: `${LATEST_MAIN_BASELINE.repository} ${LATEST_MAIN_BASELINE.ref}@${LATEST_MAIN_BASELINE.commit}`,
    migration_disposition: migrationDisposition(id),
    visible_action_contract: visibleActionContractFor({ ...testCase, ...specific }),
    state_readback_contract: stateReadbackContractFor({ ...testCase, ...specific }),
    required_evidence_roles: evidenceRolesFor({ ...testCase, ...specific }),
    forbidden_shortcuts: '禁止旧 selector fallback 充当通过；禁止 bridge-only acceptance；禁止复用历史任务/回复/附件/状态；禁止模型自述代替工具/文件；禁止缺证据时 raw pass。',
    selector_contract: selectorContractFor({ ...testCase, ...specific }),
    identity_contract: 'run-metadata 必须同时冻结 host binary、QWork index、casebook、framework commit、qwork_ui_git_commit、qwork_build_id、qwork_release_manifest_sha256、backend/prompt/feature flags。',
    trusted_review_contract: '逐编号步骤核验 before/action/after、任务归属、独立状态/工具/文件读回与最早偏差；缺任一必需证据只能判 needs_review/testcase_issue/framework_issue/blocked，不得 trusted_pass。',
  };
  migrated.evidence_required = [
    String(migrated.evidence_required || '').trim(),
    `V2 必需证据角色：${migrated.required_evidence_roles}`,
  ].filter(Boolean).join('\n');
  return migrated;
}

export function validateTrustedProductionCaseContract(cases = [], { requireFullSet = true } = {}) {
  const errors = [];
  const warnings = [];
  const ids = cases.map((item) => String(item.id || '').trim());
  if (requireFullSet && cases.length !== 92) errors.push(`latest-main 生产门禁必须恰好 92 条，当前 ${cases.length} 条。`);
  if (new Set(ids).size !== ids.length) errors.push('latest-main 生产门禁 Case ID 重复。');
  const dispositionCounts = {};
  for (const testCase of cases) {
    const missing = PRODUCTION_TRUST_CONTRACT_FIELDS.filter((field) => !String(testCase[field] || '').trim());
    if (missing.length) errors.push(`${testCase.id || 'unknown'} 缺少可信契约字段：${missing.join(',')}`);
    const disposition = String(testCase.migration_disposition || '');
    dispositionCounts[disposition] = Number(dispositionCounts[disposition] || 0) + 1;
    if (disposition === 'unmapped') errors.push(`${testCase.id || 'unknown'} 未映射 latest-main 迁移处置。`);
    if (String(testCase.contract_version || '') !== PRODUCTION_CASEBOOK_CONTRACT_VERSION) {
      errors.push(`${testCase.id || 'unknown'} contract_version 非 V2。`);
    }
    if (!String(testCase.product_baseline || '').includes(LATEST_MAIN_BASELINE.commit)) {
      errors.push(`${testCase.id || 'unknown'} 未固定 latest-main commit。`);
    }
    const visibleAction = String(testCase.visible_action_contract || '');
    if (/bridge/i.test(visibleAction) && !/不能替代|不得|只.*前置/.test(visibleAction)) {
      warnings.push(`${testCase.id || 'unknown'} 可见动作契约提到 bridge，但未明确其不得作为验收主证据。`);
    }
    for (const pattern of LEGACY_PRODUCT_ASSERTION_PATTERNS) {
      if (pattern.test(String(testCase.selectors || ''))) {
        errors.push(`${testCase.id || 'unknown'} 仍包含失效产品断言 ${pattern}.`);
      }
    }
  }
  if (requireFullSet) {
    for (const [disposition, expected] of Object.entries(EXPECTED_CASE_COUNT_BY_DISPOSITION)) {
      const actual = Number(dispositionCounts[disposition] || 0);
      if (actual !== expected) errors.push(`迁移处置 ${disposition} 应为 ${expected} 条，当前 ${actual} 条。`);
    }
  }
  return {
    schema_version: 2,
    contract_version: PRODUCTION_CASEBOOK_CONTRACT_VERSION,
    product_baseline: LATEST_MAIN_BASELINE,
    ok: errors.length === 0,
    case_count: cases.length,
    unique_case_ids: new Set(ids).size,
    disposition_counts: dispositionCounts,
    errors,
    warnings,
  };
}

export function productionCaseDispositionCounts() {
  return { ...EXPECTED_CASE_COUNT_BY_DISPOSITION };
}

export function productionCaseMigrationPlan() {
  return {
    replace_obsolete_assertion: [...REPLACE_CASE_IDS],
    rewrite_for_latest_main: [...REWRITE_CASE_IDS],
    retain_and_strengthen_evidence: [...STRENGTHEN_CASE_IDS],
    retain_business_oracle: [...RETAIN_CASE_IDS],
  };
}
