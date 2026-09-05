#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync, { constants as fsConstants } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';
import {
  CORE_BETA_SCENARIO_REGISTRY,
  FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS,
  PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS,
  PRODUCTION_GRAY_PROMOTED_LEGACY_CASE_IDS,
  coreBetaScenarioSpec,
  validateCoreBetaCasePlan,
} from '../src/lib/core-beta-case-protocol.mjs';
import {
  buildConversationTurns,
  coreBetaRuntimeExecutorBinding,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';
import { migrateProductionCase } from '../src/lib/production-casebook-contract.mjs';
import {
  QWORK_CORE_LIFELINE_CASE_IDS,
  QWORK_MR_SMOKE_CASE_IDS,
} from '../src/lib/qwork-release-test-plan.mjs';
import {
  sha256File,
  validateQworkReleaseIntake,
} from '../src/lib/qwork-release-intake.mjs';
import {
  QWORK_MR1552_EXECUTION_RUNNER_RISK_ID,
  QWORK_MR1552_FAILURE_IDS,
  QWORK_MR1552_MERGE_COMMIT_SHA,
  qworkReleaseBlockingRiskProtectedPaths,
  validateQworkReleaseBlockingRisksForReport,
} from '../src/lib/qwork-release-blocking-risks.mjs';
import {
  QWORK_RELEASE_SOURCE_CLAIM_SCOPE,
  QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED,
} from '../src/lib/qwork-release-source-contracts.mjs';

const ROOT = path.resolve(process.env.QBOT_CASEBOOK_ROOT || path.resolve(import.meta.dirname, '..'));
const ATOMIC_RENAME_HELPER = path.join(import.meta.dirname, 'atomic-rename-no-replace.py');
const SOURCE = path.join(ROOT, 'PRD', 'QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx');
const SMOKE_SOURCE = path.join(ROOT, 'PRD', 'QWork_MR1243-1260_核心冒烟自动化Casebook_11条_2026-08-23.xlsx');
const LEGACY_SOURCE_JSON = path.join(ROOT, 'PRD', 'QBot核心上线门禁用例_Teams-QWork_2026-07-22_框架修复版.json');
const LEGACY_SUPPLEMENT_XLSX = path.join(ROOT, 'PRD', 'QBot系统SIT自动化测试用例_框架清零版_2026-07-11.xlsx');
let PRODUCT_COMMIT = '';
const PREVIOUS_CASEBOOK_PRODUCT_COMMIT = '4693c5bd57b1170bed530e7559f9dc93a0b4a492';
const PRODUCT_REF = 'origin/release/0.1';
const PRODUCT_VERSION = '0.1.7';
let MR_WINDOW_START = '';
let MR_WINDOW_END = '';
const OUTPUT_NAME = 'QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r16.xlsx';
const FORMAL_OUTPUT = path.join(ROOT, 'PRD', OUTPUT_NAME);
const PREVIOUS_CASEBOOK = path.join(ROOT, 'PRD', 'QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-03-r12.xlsx');
const PREVIOUS_CASEBOOK_SHA256 = 'da9181fdc4e8d63ec5e9ed1bad231b4ffe78870b085d96598586070b97cf8c54';
const EXPECTED_PREVIOUS_MR_COUNT = 134;
const CORE_LIFELINE_CASE_IDS = QWORK_CORE_LIFELINE_CASE_IDS;
const SMOKE_CASE_IDS = QWORK_MR_SMOKE_CASE_IDS;
const CASEBOOK_DESIGN_MR1552_BLOCKER = 'release 阻断风险审计未通过，存在必须在 G0 修复的 P1 执行隔离缺陷';
const CASEBOOK_DESIGN_MR1552_FAILURES = Object.freeze(QWORK_MR1552_FAILURE_IDS.map(
  (failureId) => `${QWORK_MR1552_EXECUTION_RUNNER_RISK_ID}:${failureId}`,
));
const RELEASE_INTAKE_UNRESOLVED_KEYS = Object.freeze([
  'api_errors',
  'blocking_risk_failures',
  'out_of_scope_case_ids',
  'source_contract_failures',
  'unmapped_product_paths',
  'unattributed_direct_commits',
  'unverified_mr_metadata',
]);
const R13_INCREMENTAL_MR_ORDER = Object.freeze([
  '1527', '1532', '1531', '1500', '1528', '1530', '1537', '1535',
  '1533', '1539', '1529', '1538', '1536', '1541', '1544', '1547', '1548', '1546',
  '1540', '1550', '1511', '1552', '1558', '1556', '1549', '1557', '1559', '1561', '1560',
  '1564', '1563', '1566', '1568', '1569', '1570', '1572', '1573',
]);
const EXPECTED_INCREMENTAL_MR_COUNT = R13_INCREMENTAL_MR_ORDER.length;
const EXPECTED_TOTAL_MR_COUNT = EXPECTED_PREVIOUS_MR_COUNT + EXPECTED_INCREMENTAL_MR_COUNT;
const COVERAGE_STRENGTHS = new Set(['直接E2E', '相邻回归+源码合同', '相邻回归', '静态合同']);
const R13_INCREMENTAL_MR_CONTRACTS = new Map([
  ['1527', {
    caseIds: ['MRSMOKE-NAV-001', 'BETA-INIT-001', 'BETA-HOST-003', 'BETA-CHAT-007'],
    coverageStrength: '相邻回归',
    reason: 'G0 与 NAV、INIT、HOST、CHAT Case 回归发布身份、侧栏、初始化、宿主和任务重开主链；legacy Host Core 内部一致性仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1532', {
    caseIds: ['MRSMOKE-AUTH-001', 'BETA-CHAT-002', 'BETA-HOST-003', 'BETA-SEC-002', 'BETA-CHAT-009', 'SIT-MEM-001'],
    coverageStrength: '相邻回归',
    reason: '工作空间授权、会话隔离、宿主、隐私与自然语言 Memory Case 只做相邻回归；Cloud Memory、个人记忆 bridge、feature gate 与多 runtime 内部链路仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1531', {
    caseIds: ['MRSMOKE-CHART-001', 'SIT-CONN-016'],
    coverageStrength: '相邻回归',
    reason: '既有 qbot_chart 真实调用与 interactive_chart_readback 回归 Chart SVG、内容、fallback 和布局；Diagram 专项身份及 exploration 包装仅做源码/测试资产静态审查，未作为桌面 E2E 结论。',
  }],
  ['1500', {
    caseIds: ['MRSMOKE-SKILL-001', 'BETA-INIT-003', 'SIT-SKILL-007', 'BETA-ART-004'],
    coverageStrength: '相邻回归',
    reason: '既有 Skill 安装/执行/隔离、运行时初始化和文档成果 Case 只做相邻回归；requirements、canonical venv 与预热包细节仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1528', {
    caseIds: ['MRSMOKE-ACT-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-001', 'BETA-CHAT-005', 'BETA-CHAT-006', 'BETA-CHAT-007', 'BETA-PERF-003'],
    coverageStrength: '相邻回归',
    reason: '活动流、失败脱敏、基础对话、停止/重开与长回复 Case 只回归可见执行和终态主链；runtime tail revision 仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1530', {
    caseIds: ['MRSMOKE-ROUTE-001', 'BETA-ROUTE-001'],
    coverageStrength: '相邻回归',
    reason: '现有模型菜单与路由 Case 只回归候选过滤、可用模型和同任务路由稳定；reasoning-effort 二级选择仅做源码/测试资产静态审查，尚无正式桌面材料化能力，也没有产品测试执行回执。',
  }],
  ['1537', {
    caseIds: ['MRSMOKE-ACT-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-002', 'BETA-CHAT-007', 'BETA-PERF-003'],
    coverageStrength: '相邻回归',
    reason: '活动、路由、多轮、任务重开与性能 Case 只做上下文相关用户行为的相邻回归；context usage 刷新链仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1535', {
    caseIds: [],
    staticOnly: true,
    coverageStrength: '静态合同',
    reason: '仅在 G0 静态审查 test:unit 失败后的 build/e2e/profile DAG、rules、needs 与 CI 测试资产；不增加桌面 Case，不计入 16/12/70/160，也没有 CI 执行回执。',
  }],
  ['1533', {
    caseIds: ['MRSMOKE-FAIL-001'],
    coverageStrength: '相邻回归',
    reason: 'FAIL 冒烟只对真实失败、脱敏和同任务恢复路径做相邻回归；budget terminal 与恢复动作集合仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1539', {
    caseIds: ['MRSMOKE-ACT-001', 'BETA-CHAT-001', 'BETA-CHAT-005', 'BETA-CHAT-006'],
    coverageStrength: '相邻回归',
    reason: '活动流、基础对话和停止/长文本 Case 只回归完成态及既有布局边界；pulse 动画时序仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1529', {
    caseIds: ['MRSMOKE-ACT-001', 'BETA-CHAT-006', 'BETA-CHAT-007', 'BETA-PERF-003'],
    coverageStrength: '相邻回归',
    reason: '活动、停止、任务重开和长回复 Case 只回归用户可见失败终态与正文保持；failed-turn 分片内部账本仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1538', {
    caseIds: ['MRSMOKE-ACT-001', 'MRSMOKE-WEB-001', 'MRSMOKE-CHART-001', 'BETA-CHAT-001', 'BETA-CHAT-002', 'BETA-CHAT-005', 'BETA-PERF-003', 'SIT-CONN-016'],
    coverageStrength: '相邻回归',
    reason: '活动、Web、图表、基础/多轮/长回复 Case 只回归既有完成与超时 Oracle；callback settlement 内部耗时仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1536', {
    caseIds: ['MRSMOKE-ACT-001', 'BETA-CHAT-005'],
    coverageStrength: '相邻回归',
    reason: '活动流与会话展示 Case 只回归相邻 UI；child-task 生命周期仅做源码/测试资产静态审查，暂无确定性正式桌面 Fixture，未作为桌面 E2E 结论，也没有产品测试执行回执。',
  }],
  ['1541', {
    caseIds: ['MRSMOKE-ACT-001', 'MRSMOKE-ROUTE-001', 'BETA-INIT-001', 'BETA-HOST-003', 'BETA-CHAT-001', 'BETA-CHAT-007'],
    coverageStrength: '相邻回归',
    reason: '360Teams 活动、路由、初始化、宿主、基础聊天与重开 Case 只回归可执行用户主链；worker spawn/generation 内部细节仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1544', {
    caseIds: ['MRSMOKE-ROUTE-001', 'BETA-CHAT-001', 'BETA-ROUTE-001', 'BETA-HOST-003'],
    coverageStrength: '相邻回归+源码合同',
    requiredSourceContractIds: ['deepbankv2-mr-1544-claude-turn-header-branding/v1'],
    reason: '桌面 Case 只做同任务路由与宿主连续性的相邻回归；deepbankv2-mr-1544-claude-turn-header-branding/v1 仅鉴证 GitLab changes 中源码行与测试断言存在，claim_scope=source_and_test_declarations、test_execution_attested=false，不代表产品测试已执行或通过。',
  }],
  ['1547', {
    caseIds: ['MRSMOKE-CHART-001', 'BETA-CHAT-005', 'SIT-CONN-016'],
    coverageStrength: '相邻回归',
    reason: '图表与会话 Case 只回归真实工具结果的展示、持久化和既有交互读回；同名 occurrence 内部去重账本仅做源码/测试资产静态审查，未作为桌面 E2E 结论，且没有产品测试执行回执。',
  }],
  ['1548', {
    caseIds: ['MRSMOKE-CHART-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'SIT-CONN-016'],
    coverageStrength: '相邻回归+源码合同',
    requiredSourceContractIds: ['deepbankv2-mr-1548-call-tool-budget/v1'],
    reason: '桌面 Case 只做既有真实工具正常/失败主链的相邻回归；deepbankv2-mr-1548-call-tool-budget/v1 仅鉴证 maxCalls、RATE_LIMITED 等源码行及 128 次并发测试断言存在，claim_scope=source_and_test_declarations、test_execution_attested=false，不代表该产品测试已执行或通过。',
  }],
  ['1546', {
    caseIds: ['MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-CHAT-007'],
    coverageStrength: '相邻回归+源码合同',
    requiredSourceContractIds: ['deepbankv2-mr-1546-rejected-regenerate/v1'],
    reason: '桌面 Case 只做相邻的失败收敛、回复终态和任务重开回归，不执行 rejected regenerate，也不验证其持久化；deepbankv2-mr-1546-rejected-regenerate/v1 仅鉴证源码行与测试断言存在，claim_scope=source_and_test_declarations、test_execution_attested=false，不代表产品测试已执行或通过。',
  }],
  ['1540', {
    caseIds: ['SIT-MEM-001', 'BETA-CHAT-009', 'BETA-SEC-002', 'BETA-HOST-003', 'BETA-INIT-001'],
    coverageStrength: '相邻回归+源码合同',
    requiredSourceContractIds: ['deepbankv2-mr-1540-memory-feature-profile/v1'],
    reason: '桌面 Case 只做记忆生命周期、隐私、安全、宿主和初始化的相邻回归；deepbankv2-mr-1540-memory-feature-profile/v1 仅鉴证 Feature Check、Profile Report、Cloud Memory bridge、feature gate 与多 runtime 路由的源码行和测试断言存在，claim_scope=source_and_test_declarations、test_execution_attested=false，不代表产品测试已执行或通过。',
  }],
  ['1550', {
    caseIds: ['MRSMOKE-SKILL-001', 'SIT-SKILL-007', 'BETA-SKILL-001', 'BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004', 'BETA-SKILL-005', 'BETA-SKILL-014'],
    coverageStrength: '相邻回归+源码合同',
    requiredSourceContractIds: ['deepbankv2-mr-1550-claude-skill-description-routing/v1'],
    reason: '桌面 Case 只做 Skill 安装、选择、执行、隔离和生命周期的相邻回归；deepbankv2-mr-1550-claude-skill-description-routing/v1 仅鉴证 GPT Skill description、prompt layer、preflight 与 SkillHub adapter 接线的源码行和测试断言存在，claim_scope=source_and_test_declarations、test_execution_attested=false，不代表产品测试已执行或通过。',
  }],
  ['1511', {
    caseIds: [
      'BETA-CHAT-007', 'BETA-TASK-008', 'BETA-HOST-003',
      'MRSMOKE-NAV-001', 'MRSMOKE-ENTRY-001', 'MRSMOKE-ROUTE-001', 'MRSMOKE-SKILL-001',
      'BETA-EXPERT-001', 'BETA-EXPERT-002', 'BETA-EXPERT-005', 'BETA-EXPERT-007',
      'BETA-EXPERT-012', 'BETA-EXPERT-014',
      'SIT-EXPERT-001', 'SIT-EXPERT-004', 'SIT-EXPERT-006', 'SIT-EXPERT-021', 'SIT-EXPERT-022',
    ],
    coverageStrength: '相邻回归',
    reason: '已发布 Expert 进入上下文维护任务、display-safe 目标投影、草稿持久化/重开、固定 Builder 身份、direct MCP 与维护态 UI 属于高影响产品链；现有任务、导航、路由、Skill、宿主和专家生命周期 Case 只做相邻回归，BETA-EXPERT-012 必须增强为真实维护任务闭环后才能宣称直接行为覆盖；GitLab 源码/测试声明不等于产品测试已执行。',
  }],
  ['1552', {
    caseIds: [
      'BETA-INIT-001', 'BETA-CHAT-001', 'BETA-CHAT-007', 'BETA-HOST-003',
      'MRSMOKE-ACT-001', 'MRSMOKE-FAIL-001', 'MRSMOKE-ROUTE-001',
      'BETA-CHAT-005', 'BETA-CHAT-006', 'BETA-CHAT-008', 'BETA-PERF-003',
      'SIT-TEAMS-NEW-002', 'SIT-TEAMS-NEW-003',
    ],
    coverageStrength: '相邻回归',
    reason: 'execution runner 与 controller heartbeat 隔离涉及请求身份、credit/cancel/broker 路由、迟到消息、超时终止和宿主存活；现有初始化、基础/并发/失败/长回复、路由及宿主 Case 只能相邻回归，缺少可控 busy/crash 专项 Oracle 时不得声称已直接证明 heartbeat 隔离，且没有产品测试执行回执。',
  }],
  ['1558', {
    caseIds: ['BETA-ROUTE-001', 'MRSMOKE-ROUTE-001', 'MRSMOKE-NAV-001', 'SIT-HOME-013'],
    coverageStrength: '相邻回归+源码合同',
    requiredSourceContractIds: ['deepbankv2-mr-1558-settings-model-name-dedup/v1'],
    reason: '设置页按 modelLabel/modelId 的 trim+大小写等价键去重并保留首项；deepbankv2-mr-1558-settings-model-name-dedup/v1 仅鉴证三文件的新增源码与测试声明存在，claim_scope=source_and_test_declarations、test_execution_attested=false；当前 SIT 无同名 collision 时，桌面 Case 只能验证设置列表当前唯一及 Composer 菜单不误删，不代表 collision 分支已由桌面执行或通过。',
  }],
  ['1556', {
    caseIds: ['BETA-CHAT-002', 'BETA-CHAT-007', 'BETA-TASK-008', 'BETA-HOST-003'],
    coverageStrength: '相邻回归',
    reason: '会话 reconciliation 改动可能在流式投影与重开时抹除已可见消息；多轮会话、任务重开/历史持久化与宿主 Case 只保守回归用户消息和助手正文持续可见、同 task 收敛及重开保持，不把内部 reconcile 状态机或单元测试声明冒充直接桌面 E2E，也没有产品测试执行回执。',
  }],
  ['1549', {
    caseIds: [
      'MRSMOKE-SKILL-001', 'MRSMOKE-CHART-001', 'MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001',
      'BETA-MCP-001', 'BETA-MCP-002', 'BETA-SKILL-011',
      'SIT-CONN-003', 'SIT-CONN-005', 'SIT-CONN-016', 'BETA-HOST-003',
    ],
    coverageStrength: '相邻回归',
    reason: 'availableMcpServers guidance、MCP materialization、Connectors UI 与 host/runtime 接线跨越提示词、bridge、控制面和工具执行；现有 Skill/Chart/Route/Fail 冒烟、MCP/Connector 真实工具链及宿主 Case 只做保守相邻回归，不声称已直接证明内部 guidance 合并或所有 materialization 分支，也没有产品测试执行回执。',
  }],
  ['1557', {
    caseIds: ['BETA-TASK-002', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-CHAT-007', 'BETA-HOST-003'],
    coverageStrength: '相邻回归+源码合同',
    requiredSourceContractIds: ['deepbankv2-mr-1557-immediate-regenerate-projection/v1'],
    reason: 'BETA-TASK-002 承担真实桌面重新生成链：点击重新生成后、最终回复前立即读回原用户消息仍唯一可见，旧 assistant 已被新的 running/占位 assistant 替换，最终在同一 task 收敛且重开保持；deepbankv2-mr-1557-immediate-regenerate-projection/v1 仅鉴证 GitLab changes 中即时占位/重开语义的源码与测试声明存在，claim_scope=source_and_test_declarations、test_execution_attested=false；其余失败、回复、重开与宿主 Case 仅做相邻恢复回归，不把源码声明冒充产品测试执行结果。',
  }],
  ['1559', {
    caseIds: ['MRSMOKE-NAV-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-007', 'BETA-TASK-008', 'BETA-HOST-003', 'BETA-PERF-003'],
    coverageStrength: '相邻回归',
    reason: '每 turn 独立 utilityProcess、并发上限排队/释放、provider 首输出等待期间 heartbeat 与 session navigation transition barrier 只做源码及测试声明静态核对；导航、路由、任务重开/历史、宿主与长回复 Case 仅保守回归用户可见连续性和宿主稳定性，不声称桌面 E2E 已证明源码内部隔离、排队、heartbeat 或 barrier 实现，也没有产品测试执行回执。',
  }],
  ['1561', {
    caseIds: ['MRSMOKE-NAV-001', 'MRSMOKE-ROUTE-001', 'BETA-INIT-001', 'BETA-HOST-003', 'BETA-CHAT-008', 'BETA-PERF-003'],
    coverageStrength: '相邻回归+源码合同',
    requiredSourceContractIds: ['deepbankv2-mr-1561-worker-envelope-limit/v1'],
    reason: '桌面 Case 只回归运行时初始化、导航/路由连续性、宿主身份、20任务并发与长回复主链；deepbankv2-mr-1561-worker-envelope-limit/v1 仅鉴证 worker envelope 常量提升到 32 MiB、execution start 与共享上限一致及对应测试声明存在，claim_scope=source_and_test_declarations、test_execution_attested=false；不声称桌面 E2E 已直接构造或验证 32 MiB 协议边界。',
  }],
  ['1560', {
    caseIds: ['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001', 'BETA-INIT-001', 'BETA-CHAT-001', 'BETA-CHAT-005', 'BETA-CHAT-007', 'BETA-HOST-003', 'BETA-ROUTE-001'],
    coverageStrength: '相邻回归+源码合同',
    requiredSourceContractIds: ['deepbankv2-mr-1560-turn-authority-readiness/v1'],
    reason: '桌面 Case 只回归运行时初始化、首轮与多轮发送、失败恢复、任务重开、路由和宿主连续性；deepbankv2-mr-1560-turn-authority-readiness/v1 仅鉴证 last-good 立即返回、仅对 desktop_model_authority_not_ready 做 10 秒/100 毫秒有界本地观察、scope/永久错误立即停止且 desktop host 不 refresh、不 re-accept 的源码与测试声明，claim_scope=source_and_test_declarations、test_execution_attested=false；不声称桌面 E2E 已确定性制造冷模型权威竞争窗口。',
  }],
  ['1564', {
    caseIds: ['BETA-EXPERT-012', 'BETA-EXPERT-005', 'BETA-MCP-001', 'BETA-MCP-002', 'MRSMOKE-ROUTE-001', 'BETA-HOST-003'],
    coverageStrength: '相邻回归',
    reason: 'BETA-EXPERT-012 以真实可见入口召唤专家构建师，要求工具结果精确绑定 draft/revision/summary/persona、发布 operation/version/release，并验证旧任务与新任务隔离；专家创建、MCP、路由和宿主 Case 补充相邻回归。additionalEntries 与系统提示词内部拼接仅做 GitLab changes 静态审查，不把模型偶然识别工具或源码测试声明冒充桌面 E2E 直接证明。',
  }],
  ['1563', {
    caseIds: ['MRSMOKE-ACT-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-CHAT-006', 'BETA-PERF-003', 'BETA-HOST-003'],
    coverageStrength: '相邻回归',
    reason: '活动流、失败终态、长回复、停止、滚动性能和宿主 Case 回归运行中状态、正文保持与最终收敛；reasoning.active 文案、runtime activity coalescer、worker-host 事件接线和对比度字节仅做 GitLab changes 静态审查，当前真实 SIT 不确定性模型输出不能冒充专用 runtime-tail fixture 或源码单元测试已执行。',
  }],
  ['1566', {
    caseIds: ['MRSMOKE-ACT-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-PERF-003', 'BETA-HOST-003'],
    coverageStrength: '相邻回归',
    reason: '活动、失败、长回复、滚动性能和宿主 Case 回归普通长时任务不中断、终态可见且无正文截断；ordinaryStallMs=300000 的精确内部阈值仅做 GitLab changes 静态审查，真实 SIT 不人为制造五分钟无语义进展，也不把自然等待或单元测试声明冒充确定性桌面阈值验证。',
  }],
  ['1568', {
    caseIds: ['SIT-TASK-EDIT-001', 'BETA-TASK-002', 'BETA-CHAT-007', 'BETA-TASK-008'],
    coverageStrength: '直接E2E',
    reason: 'SIT-TASK-EDIT-001 真实编辑已发送用户消息、在同一 task 重发并核对新回复不延续旧问题，BETA-TASK-002 真实点击重新生成并验证用户历史、即时占位、最终版本与重开保持；BETA-CHAT-007 和 BETA-TASK-008 补充任务重开及 Composer 历史隔离，四条 Case 共同覆盖编辑、重新生成和历史保持，不使用通用路径映射代替专项断言。',
  }],
  ['1569', {
    caseIds: ['MRSMOKE-NAV-001', 'BETA-CHAT-001', 'BETA-CHAT-002', 'BETA-CHAT-007'],
    coverageStrength: '相邻回归',
    reason: '导航、基础对话、多轮与任务重开 Case 只回归 Composer 可用、聊天布局稳定和会话主链不中断；上下文窗口组件隐藏及其条件渲染只做 GitLab changes 与测试资产静态审查，现有桌面 Case 未设置该组件不存在的专项 DOM Oracle，因此不得声称已直接 E2E 证明隐藏行为。',
  }],
  ['1570', {
    caseIds: ['BETA-CHAT-002', 'BETA-CHAT-007', 'BETA-PERF-003', 'BETA-HOST-003'],
    coverageStrength: '相邻回归',
    reason: 'Claude 多轮、任务重开、长回复和宿主 Case 回归 turn-end 后回复收敛、历史持久化与 runtime 连续性；context usage normalization、scheduler、持久化及 turn-end 刷新接线仅做 GitLab changes 与测试资产静态审查，桌面证据不得冒充内部调度源码合同或单元测试已执行。',
  }],
  ['1572', {
    caseIds: ['MRSMOKE-ACT-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-CHAT-006', 'BETA-PERF-003', 'BETA-HOST-003'],
    coverageStrength: '相邻回归',
    reason: '活动流、失败终态、长回复、停止、滚动性能和宿主 Case 回归 runtime tail 可见状态、正文保持与最终收敛；tail copy、pulse 样式和 host runtime-tail 状态接线只做 GitLab changes 与测试资产静态审查，当前无确定性 copy/pulse 专项桌面 Oracle，不把普通完成态或截图冒充直接 E2E 证明。',
  }],
  ['1573', {
    caseIds: ['SIT-MEM-001', 'BETA-CHAT-001', 'BETA-CHAT-002', 'BETA-CHAT-009', 'BETA-SEC-002', 'BETA-MCP-001', 'BETA-MCP-002', 'BETA-HOST-003', 'BETA-INIT-001', 'BETA-ROUTE-001', 'MRSMOKE-ROUTE-001'],
    coverageStrength: '相邻回归+源码合同',
    requiredSourceContractIds: ['deepbankv2-mr-1573-memory-session-profile-stability/v1'],
    reason: '桌面 Case 只回归记忆首会话/跨会话连续性、Recall/MCP、组织身份与隐私边界、路由、宿主和初始化主链；deepbankv2-mr-1573-memory-session-profile-stability/v1 仅鉴证 Feature 已验证状态在后台刷新失败时保留、Feature/Recall/MCP 跨 session cadence、node:url 原生 URL、直属上级多形态归一化与统一 bridge helper，以及 standalone/teams360 两套 runtime 同时关闭 CLAUDE.md 和 auto memory 的源码行与测试声明存在，claim_scope=source_and_test_declarations、test_execution_attested=false；桌面 E2E 不直接证明缓存失败分支、URL 构造、Profile 归一化或本地记忆关闭，禁止把相邻主链通过冒充这些内部合同已执行或通过。',
  }],
]);
const DIRECT_E2E_MR_CASE_CONTRACTS = new Map([
  ['1523', ['MRSMOKE-WEB-001', 'MRSMOKE-WEB-002', 'BETA-CHAT-005', 'SIT-CONN-019']],
  ['1568', ['SIT-TASK-EDIT-001', 'BETA-TASK-002', 'BETA-CHAT-007', 'BETA-TASK-008']],
]);
const REQUIRED_SOURCE_CONTRACTS_BY_MR = new Map([
  ['1522', ['deepbankv2-mr-1522-claude-turn-headers/v1']],
  ...[...R13_INCREMENTAL_MR_CONTRACTS]
    .filter(([, contract]) => Array.isArray(contract.requiredSourceContractIds))
    .map(([iid, contract]) => [iid, [...contract.requiredSourceContractIds]]),
]);
const RECENT_MR_CASE_MAPPING = new Map([
  ['1328', ['MRSMOKE-ACT-001', 'MRSMOKE-AUTO-001', 'MRSMOKE-NAV-001', 'BETA-CHAT-007']],
  ['1327', ['MRSMOKE-FAIL-001', 'BETA-CHAT-009']],
  ['1298', ['MRSMOKE-CHART-001', 'SIT-CONN-016']],
  ['1323', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1311', ['MRSMOKE-SKILL-001', 'SIT-SKILL-030', 'SIT-SKILL-032']],
  ['1319', ['MRSMOKE-AUTH-001', 'SIT-WORKSPACE-001']],
  ['1306', ['BETA-HOST-003', 'BETA-INIT-001']],
  ['1315', ['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001']],
  ['1303', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1314', ['BETA-FILE-006', 'BETA-FILE-008', 'BETA-FILE-009', 'SIT-HOME-044']],
  ['1305', ['BETA-FILE-006', 'BETA-FILE-008', 'BETA-FILE-009', 'SIT-HOME-044']],
  ['1302', ['MRSMOKE-SKILL-001', 'SIT-SKILL-030', 'SIT-SKILL-032']],
  ['1277', ['MRSMOKE-SKILL-001']],
  ['1293', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1287', ['BETA-HOST-003', 'BETA-INIT-001']],
  ['1304', ['MRSMOKE-ACT-001']],
  ['1300', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1296', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1297', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1295', ['MRSMOKE-SKILL-001']],
  ['1294', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1292', ['MRSMOKE-SKILL-001', 'MRSMOKE-FAIL-001']],
  ['1280', ['MRSMOKE-ROUTE-001', 'MRSMOKE-ENTRY-001']],
  ['1334', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1331', ['MRSMOKE-ART-001', 'BETA-FILE-001', 'BETA-FILE-003', 'BETA-FILE-004', 'BETA-ART-002', 'BETA-ART-003', 'BETA-ART-004', 'SIT-HOME-040', 'SIT-HOME-066']],
  ['1332', ['MRSMOKE-FAIL-001', 'BETA-FILE-005']],
  ['1336', ['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001', 'BETA-INIT-001', 'BETA-ROUTE-001']],
  ['1338', ['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001', 'BETA-ROUTE-001', 'BETA-CHAT-005', 'BETA-PERF-003']],
  ['1339', ['MRSMOKE-FAIL-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-005', 'BETA-CHAT-006', 'BETA-FILE-005', 'BETA-HOST-003']],
  ['1341', ['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-PERF-003']],
  ['1320', ['MRSMOKE-NAV-001', 'MRSMOKE-ENTRY-001']],
  ['1343', ['MRSMOKE-ROUTE-001', 'BETA-CHAT-005', 'BETA-PERF-003']],
  ['1345', ['MRSMOKE-NAV-001', 'MRSMOKE-ENTRY-001']],
  ['1346', ['MRSMOKE-FAIL-001', 'BETA-CHAT-005']],
  ['1348', ['MRSMOKE-ROUTE-001', 'BETA-ROUTE-001']],
  ['1350', ['MRSMOKE-FAIL-001', 'BETA-FILE-005']],
  ['1354', ['MRSMOKE-FAIL-001', 'BETA-CHAT-005']],
  ['1355', ['MRSMOKE-NAV-001', 'MRSMOKE-ENTRY-001', 'BETA-CHAT-007']],
  ['1356', ['MRSMOKE-ROUTE-001', 'BETA-CHAT-005', 'BETA-CHAT-007']],
  ['1357', ['MRSMOKE-AUTO-001']],
  ['1352', ['BETA-FILE-006', 'BETA-FILE-008', 'BETA-FILE-009', 'SIT-HOME-044']],
  ['1359', ['BETA-FILE-005', 'BETA-FILE-006', 'BETA-FILE-007', 'SIT-HOME-056']],
  ['1361', ['MRSMOKE-SKILL-001', 'BETA-SKILL-001', 'BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004', 'BETA-SKILL-005', 'BETA-SKILL-014']],
  ['1364', ['MRSMOKE-ART-001', 'BETA-ART-001', 'BETA-FILE-005']],
  ['1358', ['MRSMOKE-ART-001', 'BETA-ART-001', 'BETA-ART-002', 'BETA-ART-003', 'BETA-ART-004']],
  ['1365', ['MRSMOKE-ACT-001', 'MRSMOKE-NAV-001', 'MRSMOKE-ENTRY-001', 'BETA-CHAT-007']],
  ['1428', ['MRSMOKE-FAIL-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-005', 'BETA-PERF-003']],
  ['1443', ['MRSMOKE-AUTH-001', 'BETA-CHAT-001', 'BETA-CHAT-009']],
  ['1450', ['BETA-INIT-001', 'BETA-HOST-003']],
  ['1451', ['MRSMOKE-FAIL-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-005']],
  ['1374', ['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-PERF-003']],
  ['1393', ['MRSMOKE-SKILL-001', 'SIT-SKILL-007', 'BETA-INIT-003', 'BETA-SKILL-005', 'BETA-SKILL-011']],
  ['1430', ['MRSMOKE-NAV-001', 'MRSMOKE-ENTRY-001', 'BETA-CHAT-007', 'SIT-INIT-002', 'SIT-HOME-051']],
  ['1465', ['MRSMOKE-NAV-001', 'MRSMOKE-ENTRY-001', 'BETA-CHAT-007']],
  ['1466', ['MRSMOKE-AUTH-001', 'MRSMOKE-NAV-001', 'BETA-SEC-002', 'SIT-WORKSPACE-001']],
  ['1467', ['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001', 'BETA-ROUTE-001', 'SIT-HOME-013']],
  ['1471', ['MRSMOKE-NAV-001', 'MRSMOKE-ENTRY-001', 'BETA-CHAT-007', 'BETA-EXPERT-001']],
  ['1470', ['MRSMOKE-SKILL-001', 'SIT-SKILL-007', 'BETA-INIT-003', 'BETA-SKILL-005', 'BETA-SKILL-011', 'BETA-SKILL-014']],
  ['1472', ['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'SIT-HOME-053']],
  ['1476', ['MRSMOKE-NAV-001', 'BETA-EXPERT-001', 'BETA-EXPERT-015', 'SIT-EXPERT-001', 'SIT-EXPERT-006']],
  ['1480', ['MRSMOKE-CHART-001', 'MRSMOKE-ROUTE-001', 'BETA-MCP-001', 'BETA-MCP-002', 'BETA-SKILL-011', 'SIT-CONN-003']],
  ['1484', ['BETA-INIT-001', 'BETA-HOST-003']],
  ['1481', ['MRSMOKE-WEB-001', 'MRSMOKE-WEB-002', 'MRSMOKE-FAIL-001', 'SIT-CONN-019']],
  ['1494', ['MRSMOKE-WEB-002', 'MRSMOKE-AUTH-001', 'MRSMOKE-ART-001', 'BETA-ART-001', 'BETA-SEC-002', 'SIT-ART-015', 'SIT-ART-024']],
  ['1488', ['MRSMOKE-AUTO-001', 'MRSMOKE-SKILL-001', 'BETA-TASK-008', 'BETA-SKILL-005', 'SIT-SKILL-007']],
  ['1495', ['MRSMOKE-AUTH-001', 'MRSMOKE-NAV-001', 'BETA-SEC-002', 'SIT-WORKSPACE-001']],
  ['1491', ['MRSMOKE-WEB-001', 'MRSMOKE-WEB-002', 'MRSMOKE-FAIL-001', 'SIT-CONN-019']],
  ['1492', ['MRSMOKE-ACT-001', 'MRSMOKE-AUTO-001', 'BETA-CHAT-002', 'BETA-TASK-008']],
  ['1499', ['MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-PERF-003', 'SIT-HOME-053']],
  ['1501', ['BETA-EXPERT-001', 'BETA-EXPERT-015', 'SIT-EXPERT-001', 'SIT-EXPERT-006']],
  ['1479', ['MRSMOKE-AUTO-001', 'MRSMOKE-FAIL-001', 'MRSMOKE-ROUTE-001', 'BETA-INIT-001', 'BETA-HOST-003', 'BETA-CHAT-005']],
  ['1490', ['MRSMOKE-AUTO-001', 'MRSMOKE-SKILL-001', 'BETA-SKILL-011', 'SIT-SKILL-SCOPE-001']],
  ['1486', ['MRSMOKE-AUTH-001', 'BETA-CHAT-004', 'BETA-CHAT-009', 'BETA-SEC-002', 'SIT-MEM-001']],
  ['1489', ['MRSMOKE-ART-001', 'BETA-FILE-002', 'SIT-HOME-037', 'SIT-HOME-038']],
  ['1504', ['MRSMOKE-NAV-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-005', 'SIT-HOME-053']],
  ['1483', ['MRSMOKE-SKILL-001', 'MRSMOKE-NAV-001', 'BETA-INIT-001', 'BETA-HOST-003', 'BETA-EXPERT-001']],
  ['1487', ['MRSMOKE-WEB-001', 'MRSMOKE-FAIL-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-005', 'SIT-CONN-019']],
  ['1508', ['MRSMOKE-AUTO-001', 'BETA-INIT-001', 'BETA-HOST-003', 'BETA-TASK-008']],
  ['1512', ['MRSMOKE-NAV-001', 'BETA-CHAT-005', 'SIT-HOME-053']],
  ['1515', ['BETA-INIT-001', 'BETA-HOST-003']],
  ['1509', ['MRSMOKE-AUTH-001', 'BETA-INIT-001', 'BETA-CHAT-004', 'SIT-MEM-001']],
  ['1503', ['MRSMOKE-NAV-001', 'BETA-EXPERT-001', 'SIT-EXPERT-006']],
  ['1513', ['MRSMOKE-AUTO-001', 'MRSMOKE-FAIL-001', 'MRSMOKE-ROUTE-001', 'BETA-INIT-001', 'BETA-HOST-003', 'BETA-CHAT-005']],
  ['1518', ['MRSMOKE-NAV-001', 'BETA-CHAT-005', 'BETA-CHAT-007', 'BETA-PERF-003', 'SIT-ISSUE-793']],
  ['1519', ['BETA-INIT-001', 'BETA-INIT-003', 'BETA-HOST-003', 'SIT-INIT-025']],
  ['1521', ['MRSMOKE-AUTO-001', 'MRSMOKE-FAIL-001', 'BETA-INIT-001', 'BETA-HOST-003', 'BETA-CHAT-001', 'BETA-CHAT-005']],
  ['1520', ['MRSMOKE-NAV-001', 'BETA-INIT-001', 'BETA-INIT-003', 'BETA-HOST-003', 'SIT-TEAMS-NEW-001', 'SIT-TEAMS-NEW-003']],
  ['1516', ['MRSMOKE-FAIL-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-005', 'BETA-PERF-003']],
  ['1526', ['MRSMOKE-SKILL-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-006', 'BETA-PERF-003']],
  ['1523', ['MRSMOKE-WEB-001', 'MRSMOKE-WEB-002', 'BETA-CHAT-005', 'SIT-CONN-019']],
  ['1522', ['MRSMOKE-ROUTE-001', 'BETA-CHAT-001', 'BETA-ROUTE-001', 'BETA-HOST-003']],
]);
const RECENT_MR_STATIC_AUDITS = new Map([
  ['1329', {
    expectedFiles: ['.gitlab-ci.yml'],
    disposition: 'CI-only：固定单元测试物料镜像digest；不新增桌面QWork E2E',
      reason: '静态核对QBOT_CI_UNIT_IMAGE由sha256:ec7c3f更新为sha256:3410bb，保留merge commit与文件清单；由CI物料溯源/单元测试负责，不计12/70/160桌面通过',
  }],
  ['1330', {
    expectedFiles: ['server/dashboard-admin-routes.mjs', 'test/unit/ui/dashboard-admin-routes.test.mjs'],
    disposition: 'Dashboard-only：组织部门链 scope 合同静态审计；不新增桌面QWork E2E',
    reason: '保留 Dashboard route 与单元测试文件清单；该管理面授权合同不属于当前桌面 SIT 候选，不计12/70/160桌面通过',
  }],
  ['1337', {
    expectedFiles: ['.gitlab-ci.yml'],
    disposition: 'CI-only：固定 unit-material digest；不新增桌面QWork E2E',
    reason: '保留 merge commit 与 CI 文件清单；由 CI 物料溯源负责，不计12/70/160桌面通过',
  }],
  ['1310', {
    expectedFiles: [
      '.agent/compiled/skills-manifest.json', '.agent/skills-src/qwork-session-eval/skill.yaml',
      '.agents/skills/qwork-session-eval/SKILL.md', '.agents/skills/qwork-session-eval/agents/openai.yaml',
      '.claude/skills/qwork-session-eval/SKILL.md', 'eval/qwork-session-experience/.gitignore',
      'eval/qwork-session-experience/.runs/.gitkeep', 'eval/qwork-session-experience/README.md',
      'eval/qwork-session-experience/bin/qwork-session-eval.mjs',
      'eval/qwork-session-experience/fixtures/attributions.jsonl',
      'eval/qwork-session-experience/fixtures/judgments.jsonl',
      'eval/qwork-session-experience/fixtures/managed-result.json',
      'eval/qwork-session-experience/fixtures/synthetic-calibration-corpus.json',
      'eval/qwork-session-experience/package-lock.json', 'eval/qwork-session-experience/package.json',
      'eval/qwork-session-experience/prompts/attribution-judge-v1.md',
      'eval/qwork-session-experience/prompts/journey-link-v1.md',
      'eval/qwork-session-experience/prompts/outcome-judge-v1.md',
      'eval/qwork-session-experience/queries/agent-session-v5-export.sql',
      'eval/qwork-session-experience/queries/agent-session-v5-local-files.sql',
      'eval/qwork-session-experience/report/template.html',
      'eval/qwork-session-experience/rubric/calibration-v1.json',
      'eval/qwork-session-experience/rubric/scoring-v1.json',
      'eval/qwork-session-experience/schemas/attempt.schema.json',
      'eval/qwork-session-experience/schemas/attribution-finding-input.schema.json',
      'eval/qwork-session-experience/schemas/attribution-finding.schema.json',
      'eval/qwork-session-experience/schemas/error-occurrence.schema.json',
      'eval/qwork-session-experience/schemas/event.schema.json',
      'eval/qwork-session-experience/schemas/human-turn.schema.json',
      'eval/qwork-session-experience/schemas/journey-link-judgment.schema.json',
      'eval/qwork-session-experience/schemas/journey.schema.json',
      'eval/qwork-session-experience/schemas/model-comparison.schema.json',
      'eval/qwork-session-experience/schemas/outcome-judgment-input.schema.json',
      'eval/qwork-session-experience/schemas/outcome-judgment.schema.json',
      'eval/qwork-session-experience/schemas/report.schema.json',
      'eval/qwork-session-experience/schemas/run-manifest-legacy.schema.json',
      'eval/qwork-session-experience/schemas/run-manifest.schema.json',
      'eval/qwork-session-experience/schemas/score-receipt.schema.json',
      'eval/qwork-session-experience/schemas/session.schema.json',
      'eval/qwork-session-experience/src/attribution.mjs', 'eval/qwork-session-experience/src/calibration.mjs',
      'eval/qwork-session-experience/src/cli-paths.mjs', 'eval/qwork-session-experience/src/constants.mjs',
      'eval/qwork-session-experience/src/intake.mjs', 'eval/qwork-session-experience/src/journeys.mjs',
      'eval/qwork-session-experience/src/local-session-files.mjs',
      'eval/qwork-session-experience/src/managed-result.mjs', 'eval/qwork-session-experience/src/metrics.mjs',
      'eval/qwork-session-experience/src/model-comparison.mjs', 'eval/qwork-session-experience/src/normalize.mjs',
      'eval/qwork-session-experience/src/pipeline.mjs', 'eval/qwork-session-experience/src/redaction.mjs',
      'eval/qwork-session-experience/src/report.mjs', 'eval/qwork-session-experience/src/schema-validator.mjs',
      'eval/qwork-session-experience/src/scoring.mjs', 'eval/qwork-session-experience/src/util.mjs',
      'eval/qwork-session-experience/src/verify.mjs', 'eval/qwork-session-experience/src/viewer-server.mjs',
      'eval/qwork-session-experience/tests/eval/fixture.test.mjs',
      'eval/qwork-session-experience/tests/helpers.mjs',
      'eval/qwork-session-experience/tests/ui/report-interactions.mjs',
      'eval/qwork-session-experience/tests/unit/attribution-calibration.test.mjs',
      'eval/qwork-session-experience/tests/unit/redaction-report.test.mjs',
      'eval/qwork-session-experience/tests/unit/schema-managed.test.mjs',
      'eval/qwork-session-experience/tests/unit/scoring-model.test.mjs',
      'eval/qwork-session-experience/tests/unit/segmentation-metrics.test.mjs',
      'eval/qwork-session-experience/tests/unit/viewer-server.test.mjs',
      'eval/qwork-session-experience/viewer/index.html', 'eval/qwork-session-experience/viewer/viewer.css',
      'eval/qwork-session-experience/viewer/viewer.js',
    ],
    disposition: 'Eval-only：QWork session experience 评估与报告工具静态审计；不新增桌面QWork E2E',
    reason: '该 MR 新增离线/受管评估管线、schema、viewer 与测试物料；不改变候选桌面产品行为，不计12/70/160桌面通过',
  }],
  ['1340', {
    expectedFiles: [
      'docs/server-structure-migration-runbook.md', 'package.json', 'scripts/build-control-plane.mjs',
      'scripts/build-electron-runtime.mjs', 'scripts/ci/node-unit-test-weights.json',
      'scripts/refactor/server-structure/cli.mjs',
      'scripts/refactor/server-structure/dependency-cruiser.config.cjs',
      'scripts/refactor/server-structure/experiment-manifest.json',
      'scripts/refactor/server-structure/graph.mjs', 'scripts/refactor/server-structure/manifest.mjs',
      'scripts/refactor/server-structure/manifest.schema.json',
      'scripts/refactor/server-structure/metafile-equivalence.mjs',
      'scripts/refactor/server-structure/package-lock.json', 'scripts/refactor/server-structure/package.json',
      'scripts/refactor/server-structure/rewrite-imports.mjs',
      'scripts/refactor/server-structure/test/server-structure-refactor.spec.mjs',
      'test/unit/tools/server-structure-refactor.test.mjs',
    ],
    disposition: 'Toolchain-only：服务端结构迁移工具链静态审计；不新增桌面QWork E2E',
    reason: '保留构建等价、依赖图与迁移工具测试清单；未改变当前候选桌面运行行为，不计12/70/160桌面通过',
  }],
  ['1333', {
    expectedFiles: ['.gitlab-ci.yml', 'scripts/ci/gitlab-ci.test.mjs', 'scripts/ci/node-unit-affected.mjs', 'scripts/ci/node-unit-affected.test.mjs'],
    disposition: 'CI-only：version-only 内容识别与跳过重活 job 静态审计；不新增桌面QWork E2E',
    reason: '保留 CI route 与单元测试文件清单；只影响流水线调度，不计12/70/160桌面通过',
  }],
  ['1326', {
    expectedFiles: ['.deepbank-runtime/runtime-provision-seed/0.1.5/provision-manifest.json', 'deploy/helm/qbot/Chart.yaml', 'package-lock.json', 'package.json', 'teams360.host-sync.json'],
    disposition: 'Version-only：0.1.6 发布身份与打包清单静态审计；不冒充桌面功能通过',
    reason: '由 Casebook 产品基线、pretest 发布身份和制品 SHA 冻结；该版本号变更本身不新增桌面业务 Case，不计12/70/160桌面通过',
  }],
  ['1342', {
    expectedFiles: ['.gitlab-ci.yml', 'scripts/ci/gitlab-ci.test.mjs', 'scripts/ci/node-unit-affected.mjs', 'scripts/ci/node-unit-affected.test.mjs'],
    disposition: 'CI-only：release version bump 路由静态审计；不新增桌面QWork E2E',
    reason: '保留 CI route 与单元测试文件清单；只影响版本变更流水线校验，不计12/70/160桌面通过',
  }],
  ['1344', {
    expectedFiles: ['deploy/dashboard/package-lock.json', 'deploy/dashboard/package.json', 'docs/research/web-crawl-reliability/freeze.json', 'docs/research/web-search-journey/issue-1320-searxng-v8-ledger.json', 'docs/research/web-search-journey/issue-1371-searxng-v9-experiments.jsonl'],
    disposition: 'Dashboard/研究物料-only：补齐 dashboard runtime yaml 与研究冻结物料静态审计；不新增桌面QWork E2E',
    reason: '保留 dashboard package 与研究物料文件清单；该 MR 不改变当前桌面候选的可执行行为，不计12/70/160桌面通过',
  }],
  ['1349', {
    expectedFiles: ['dashboard/server/gitlab/release-client.test.ts', 'dashboard/server/gitlab/release-client.ts', 'dashboard/server/app.ts', 'dashboard/server/dashboard-bff.test.ts', 'dashboard/src/app/App.tsx', 'dashboard/src/app/release-version.ts', 'dashboard/test/release-version.test.ts'],
    disposition: 'Dashboard/OTA-only：发布版本下限计算静态审计；不新增桌面QWork E2E',
    reason: '该 MR 仅修复 Dashboard OTA 版本下限推导，不改变 macOS QWork 桌面候选行为，不计12/70/160桌面通过',
  }],
  ['1454', {
    disposition: 'Dashboard-only：QWork Dashboard 任务看板；不新增桌面QWork E2E',
    reason: '变更位于 Dashboard 与 control-plane Dashboard 路由，由 Dashboard 契约/端到端测试负责，不计16/12/70/160桌面通过',
  }],
  ['1461', {
    disposition: 'Docs/governance-only：仓库文档与 Agent Context 生命周期；不新增桌面QWork E2E',
    reason: '变更为文档、Agent 元数据、治理脚本与测试物料，由静态治理检查负责，不计16/12/70/160桌面通过',
  }],
  ['1475', {
    disposition: 'Observability-only：control-plane 请求 trace 日志上下文；不新增桌面QWork E2E',
    reason: '只改变服务端可观测日志上下文，由 observability 单元/日志契约验证，不把桌面业务Case通过冒充该合同',
  }],
  ['1524', {
    disposition: 'Repo-governance-only：退役 OpenSpec 与本地规范框架；不新增桌面QWork E2E',
    reason: '仅删除/调整 Agent、OpenSpec、文档与仓库元数据，由静态治理检查负责，不计16/12/70/160桌面通过',
  }],
  ['1535', {
    expectedFiles: ['.gitlab-ci.yml', 'scripts/ci/policy/gitlab-ci.test.mjs'],
    disposition: 'CI-only：test:unit 失败后的 fail-fast DAG 合同静态审计；不新增桌面QWork E2E',
    reason: '静态核对 test:unit 失败后 build/e2e/profile 不继续，并校验 rules/needs 与 CI 单测；不计16/12/70/160桌面通过',
  }],
]);

// 历史 r5 增量清单保留为静态回归约束；正式生成改用 release ancestry。
// deepbankV2 保持只读，当前发布清单由冻结基线到 PRODUCT_COMMIT 的 first-parent 读取。
const LEGACY_MR_APPEND = Object.freeze([
  { mr: '1334', commit: 'f64a85f53de75ca37de0aee7aca2de3d1f5c10e2', mergedAt: '2026-08-26T23:54:58+08:00', branch: 'enhancement/1410-managed-http-proxy-ttl', files: ['docs/qbot-web-tools.md', 'electron/managed-http-proxy-cache.cjs', 'server/managed-http-proxy-config.mjs', 'test/unit/desktop/managed-http-proxy-cache.test.cjs', 'test/unit/server/managed-http-proxy-config.test.mjs'] },
  { mr: '1331', commit: '4e3ce28ac3521ea6f5feef43199198645ba1e94e', mergedAt: '2026-08-26T23:55:36+08:00', branch: 'enhancement/1405-document-processing-routing', files: ['.agent/compiled/root/AGENTS.md', '.agent/compiled/root/CLAUDE.md', '.agent/context.yaml', 'AGENTS.md', 'CLAUDE.md', 'docs/file-ingress-contract.md', 'resources/builtin-skills/document-processing/SKILL.md', 'resources/builtin-skills/document-processing/references/requirements.txt', 'scripts/e2e-module.test.mjs', 'scripts/e2e-qbot-claude-real.mjs', 'test/e2e/local-real-claude-code.spec.mjs', 'test/e2e/remote-dev-local-only-assertions.spec.mjs', 'test/e2e/remote-dev.spec.mjs', 'test/e2e/support/bug-derived-suite-materials.mjs', 'test/e2e/support/module-suites.mjs', 'test/e2e/support/module-suites.test.mjs', 'test/unit/skills/document-processing-skill.test.mjs'] },
  { mr: '1330', commit: '34c4093940eeb4fb6306f2337b52792c23dce655', mergedAt: '2026-08-26T23:59:16+08:00', branch: 'codex/1398-org-dept-chain-scope', files: ['server/dashboard-admin-routes.mjs', 'test/unit/ui/dashboard-admin-routes.test.mjs'] },
  { mr: '1332', commit: 'df5e3057fb2fba3ed83bd023b1cddd013a652ace', mergedAt: '2026-08-27T00:11:27+08:00', branch: 'codex/issue-1408-enametoolong-notice', files: ['electron/desktop-agent-host.cjs', 'server/engine.mjs', 'test/unit/core/chat-user-error-notice.test.mjs', 'test/unit/core/model-connection-fail-closed.test.mjs', 'test/unit/observability/client-error-observability-contract.test.mjs'] },
  { mr: '1336', commit: 'b941861781a0467d59e8bf787d91ce6b9f1bc3ce', mergedAt: '2026-08-27T01:10:08+08:00', branch: 'chore/1411-claude-sdk-0.3.246', files: ['docs/research/web-crawl-reliability/freeze.json', 'docs/research/web-search-journey/issue-1320-searxng-v8-ledger.json', 'docs/research/web-search-journey/issue-1371-searxng-v9-experiments.jsonl', 'package-lock.json', 'package.json', 'scripts/build-desktop-runtime-mirror.test.mjs', 'server/prompt-layers.mjs', 'server/runtime-provisioner.mjs', 'test/runtime-features/README.md', 'test/runtime-features/runtime-feature-surface.baseline.json', 'test/unit/runtime/runtime-provisioner.test.mjs'] },
  { mr: '1337', commit: 'fc26a1dde0f36c5fca1acd34bef6d231117616c1', mergedAt: '2026-08-27T05:28:37+08:00', branch: 'ci/unit-material-pin-release-0.1-3a4620263385', files: ['.gitlab-ci.yml'] },
  { mr: '1338', commit: '157abc15d8635be8ac65b2ffc8e6fa5f031770c0', mergedAt: '2026-08-27T06:00:11+08:00', branch: 'issue/1378-claude-context-window-v2', files: ['runtime-family.mjs', 'scripts/deepbank-llm-gateway-inspect.mjs', 'scripts/e2e-module.test.mjs', 'server/engine.mjs', 'server/llm-connections.mjs', 'test/e2e/claude-custom-context-window.local.spec.mjs', 'test/e2e/support/claude-custom-context-window-fixture.mjs', 'test/e2e/support/claude-custom-context-window-probe.mjs', 'test/e2e/support/module-suites.mjs', 'test/e2e/support/module-suites.test.mjs', 'test/unit/core/llm-connections.test.mjs', 'test/unit/desktop/desktop-agent-private-runtime-context.test.mjs', 'test/unit/desktop/desktop-auto-current-turn-authority.test.mjs', 'test/unit/runtime/deepbank-llm-gateway-inspect.test.mjs', 'test/unit/runtime/runtime-connection-ownership.test.mjs', 'test/unit/server/connection-view.test.mjs'] },
  { mr: '1310', commit: 'dc55622898aab0acc96954dc93f2c4464d4f8eb5', mergedAt: '2026-08-27T07:04:27+08:00', branch: 'test/1382-qwork-session-experience', files: [...RECENT_MR_STATIC_AUDITS.get('1310').expectedFiles] },
  { mr: '1339', commit: '2688feb0a1ac4883764846b94e58d7b7e16f4b43', mergedAt: '2026-08-27T08:00:58+08:00', branch: 'bugfix/1409-runtime-terminal-budget', files: ['electron/chat-user-error-notice.cjs', 'electron/desktop-agent-host.cjs', 'electron/preload.cjs', 'scripts/ci/node-unit-test-weights.json', 'scripts/e2e-module.test.mjs', 'server/engine.mjs', 'server/prompt-layers.mjs', 'server/prompt-templates.mjs', 'server/runtime-terminal.mjs', 'src/chat-user-error.ts', 'src/global.d.ts', 'test/e2e/agent-runtime-regression.local.spec.mjs', 'test/e2e/support/module-suites.mjs', 'test/e2e/support/module-suites.test.mjs', 'test/unit/core/chat-user-error-notice.test.mjs', 'test/unit/desktop/desktop-returned-terminal-contract.test.mjs', 'test/unit/prompts/chat-error-classifier.test.mjs', 'test/unit/prompts/prompt-claude-system-prompt.test.mjs', 'test/unit/prompts/prompt-layers.test.mjs', 'test/unit/server/engine-prompt-composer.test.mjs', 'test/unit/server/engine-stream-adapters.test.mjs', 'test/unit/server/runtime-terminal.test.mjs', 'test/unit/ui/result-event-turn-correlation.test.mjs'] },
  { mr: '1340', commit: 'eed5a8f81b7514b3adea65e2d66014f05eaa0f07', mergedAt: '2026-08-27T09:01:04+08:00', branch: 'chore/1414-server-structure-toolchain', files: [...RECENT_MR_STATIC_AUDITS.get('1340').expectedFiles] },
  { mr: '1333', commit: 'c104139109e62df733fcf206b3dd6f9c1b171efb', mergedAt: '2026-08-27T09:15:29+08:00', branch: 'chore/1406-ci-version-only-skip', files: [...RECENT_MR_STATIC_AUDITS.get('1333').expectedFiles] },
  { mr: '1341', commit: '8f001d12aa0b95818d64b0d334d50e6ac192c220', mergedAt: '2026-08-27T09:42:24+08:00', branch: 'issue/1415-claude-output-budget-32k', files: ['runtime-family.mjs', 'scripts/e2e-module.test.mjs', 'server/engine.mjs', 'test/e2e/claude-custom-context-window.local.spec.mjs', 'test/e2e/support/claude-custom-context-window-probe.mjs', 'test/e2e/support/module-suites.mjs', 'test/e2e/support/module-suites.test.mjs', 'test/unit/runtime/runtime-connection-ownership.test.mjs'] },
  { mr: '1326', commit: '82dc44e8155e1e978d38c4c9586bcb5e44fe8d72', mergedAt: '2026-08-27T09:51:26+08:00', branch: 'codex/bump-0.1.6', files: [...RECENT_MR_STATIC_AUDITS.get('1326').expectedFiles] },
  { mr: '1342', commit: 'df3492ffcd138ca5e7485cb6329b6f01386a7424', mergedAt: '2026-08-27T10:20:02+08:00', branch: 'codex/release-version-only-ci-routing', files: [...RECENT_MR_STATIC_AUDITS.get('1342').expectedFiles] },
  { mr: '1320', commit: '185208fd1cb816fb9b9c27ecd49dd81fa8252a04', mergedAt: '2026-08-27T13:49:30+08:00', branch: 'fix/1384-view-drag-regions', files: ['src/app.css', 'src/expert-center.css', 'src/use-teams-window-drag.ts', 'test/e2e/expert-v2-lifecycle.local.spec.mjs', 'test/e2e/local.spec.mjs', 'test/unit/skills/expert-v2-ui-contract.test.mjs', 'test/window-moving.test.mjs'] },
  { mr: '1344', commit: '256faf63cab1ea7516726c0dc6d714703adc1344', mergedAt: '2026-08-27T14:06:09+08:00', branch: 'codex/issue-1424-dashboard-yaml-runtime', files: [...RECENT_MR_STATIC_AUDITS.get('1344').expectedFiles] },
  { mr: '1343', commit: '9659468a228da6ff36b9079cecf578b7a1cbce4b', mergedAt: '2026-08-27T14:15:16+08:00', branch: 'codex/enhance-1378-claude-context-window-v2', files: ['runtime-family.mjs', 'scripts/deepbank-llm-gateway-inspect.mjs', 'scripts/e2e-module.test.mjs', 'server/engine.mjs', 'server/llm-connections.mjs', 'test/e2e/claude-custom-context-window.local.spec.mjs', 'test/e2e/support/claude-custom-context-window-fixture.mjs', 'test/e2e/support/claude-custom-context-window-probe.mjs', 'test/e2e/support/module-suites.mjs', 'test/e2e/support/module-suites.test.mjs', 'test/unit/core/llm-connections.test.mjs', 'test/unit/runtime/runtime-connection-ownership.test.mjs'] },
  { mr: '1345', commit: 'af202b42717a1c5b7180aabd660998e318e1c419', mergedAt: '2026-08-27T14:59:24+08:00', branch: 'issue-1425-automation-expert-ui-polish', files: ['src/AutomationView.tsx', 'src/app.css', 'src/components/HoverPortalTip.tsx', 'src/components/OverflowPortalText.tsx', 'src/expert-center.css', 'src/qbot.css', 'test/unit/skills/expert-v2-ui-contract.test.mjs', 'test/unit/ui/personal-automation-view-contract.test.mjs'] },
  { mr: '1346', commit: '3cca4701e866dcce3e4c2dcd34e304274f016682', mergedAt: '2026-08-27T15:18:52+08:00', branch: 'codex/issue-1426-p0-error-notice', files: ['electron/chat-user-error-notice.cjs', 'electron/client-error-presentation.cjs', 'electron/desktop-agent-host.cjs', 'electron/preload.cjs', 'test/unit/core/chat-user-error-notice.test.mjs', 'test/unit/core/client-error-presentation.test.mjs', 'test/unit/core/codex-response-connection-route-contract.test.mjs', 'test/unit/desktop/accept-turn-expert-progress-target.test.mjs'] },
  { mr: '1349', commit: 'f47b92bdf92006df9159398d86a06fced8609972', mergedAt: '2026-08-27T15:56:28+08:00', branch: 'codex/issue-1432-dashboard-ota-main-version', files: ['dashboard/server/gitlab/release-client.test.ts', 'dashboard/server/gitlab/release-client.ts', 'dashboard/server/app.ts', 'dashboard/server/dashboard-bff.test.ts', 'dashboard/src/app/App.tsx', 'dashboard/src/app/release-version.ts', 'dashboard/test/release-version.test.ts'] },
  { mr: '1348', commit: 'ed83a095d48b75e70da1ea726607fbce3a7f176a', mergedAt: '2026-08-27T16:13:13+08:00', branch: 'codex/fix-1378-native-claude-classifier', files: ['scripts/ci/node-unit-test-weights.json', 'test/e2e/support/claude-custom-context-window-fixture.mjs', 'test/e2e/support/claude-custom-context-window-probe.mjs', 'test/e2e/claude-custom-context-window.local.spec.mjs', 'test/unit/runtime/runtime-connection-ownership.test.mjs', 'runtime-family.mjs'] },
  { mr: '1350', commit: '9eb2faa9bb01c18231694e7c6ed040640a0254c1', mergedAt: '2026-08-27T16:28:25+08:00', branch: 'bugfix/1427-retired-attachment-error', files: ['electron/chat-user-error-notice.cjs', 'electron/client-error-presentation.cjs', 'src/chat-user-error.ts', 'test/unit/core/chat-user-error-notice.test.mjs'] },
  { mr: '1355', commit: '3941ab333f2788ca1c19473facd630cd21b1b358', mergedAt: '2026-08-27T17:06:23+08:00', branch: 'issue-1440-sidebar-space-expand-tip', files: ['src/components/HoverPortalTip.tsx', 'src/components/OverflowPortalText.tsx', 'src/Sidebar.tsx', 'test/unit/skills/skill-desc-preview-portal.test.mjs', 'test/unit/ui/personal-automation-view-contract.test.mjs', 'test/unit/ui/sidebar-task-count-spaces-ready.test.mjs'] },
  { mr: '1354', commit: '67c35d84bd64fc619b0aa60559888df962bee3a8', mergedAt: '2026-08-27T17:10:23+08:00', branch: 'codex/1437-chat-error-low-risk-mapping', files: ['electron/chat-user-error-notice.cjs', 'electron/desktop-agent-host.cjs', 'src/chat-error.ts', 'test/unit/core/chat-user-error-notice.test.mjs', 'test/unit/prompts/chat-error-classifier.test.mjs'] },
  { mr: '1356', commit: 'f22edbac971f53e5ec743dd63d93f4dcf2fd99e1', mergedAt: '2026-08-27T17:35:22+08:00', branch: 'codex/issue-1433-runtime-handle-revision', files: ['electron/desktop-agent-host.cjs', 'server/localdb.mjs', 'src/components/assistant-ui/thread.tsx', 'src/activity-grouping.ts', 'src/qbot.css', 'test/unit/database/personal-automation-localdb.test.mjs', 'test/unit/desktop/desktop-current-turn-authority.test.mjs', 'test/unit/desktop/personal-automation-background-turn.test.mjs', 'test/unit/projects/session-rename.test.mjs', 'test/unit/ui/activity-grouping.test.mjs', 'test/unit/ui/assistant-turn-summary-ui.test.mjs'] },
  { mr: '1357', commit: '535137d658ce98123170e328bca476be2d51a756', mergedAt: '2026-08-27T18:13:07+08:00', branch: 'codex/1417-automation-execution-guard', files: ['electron/desktop-agent-host.cjs', 'test/unit/desktop/personal-automation-background-turn.test.mjs'] },
  { mr: '1352', commit: '6a1ee16853312d2f50eb24dd3a44db835e8a07f7', mergedAt: '2026-08-27T18:23:18+08:00', branch: 'codex/issue-1438-fileinput-direct-path', files: ['.agent/compiled/electron/AGENTS.md', '.agent/compiled/electron/CLAUDE.md', '.agent/compiled/root/AGENTS.md', '.agent/compiled/root/CLAUDE.md', '.agent/context/scopes/electron.yaml', '.agent/context.yaml', 'electron/AGENTS.md', 'electron/preload.cjs', 'electron/shell-handlers.cjs', 'test/unit/desktop/shell-file-ingress.test.mjs', 'test/unit/web/web-preview-iframe.test.mjs', 'AGENTS.md'] },
  { mr: '1359', commit: '12c0fe127550a33f4fa36809a832d159cd05d5f2', mergedAt: '2026-08-27T19:05:49+08:00', branch: 'bugfix/1422-mixed-attachment-partial-success', files: ['electron/chat-user-error-notice.cjs', 'electron/desktop-agent-host.cjs', 'electron/preload.cjs', 'scripts/ci/node-unit-test-weights.json', 'scripts/e2e-module.test.mjs', 'src/components/assistant-ui/thread.tsx', 'src/global.d.ts', 'src/runtime.tsx', 'test/e2e/support/module-suites.mjs', 'test/e2e/support/module-suites.test.mjs', 'test/e2e/bug-derived-materials.local.spec.mjs', 'test/unit/core/chat-user-error-notice.test.mjs', 'test/unit/desktop/desktop-file-acceptance.test.mjs', 'test/unit/skills/skill-shell-token-env.test.mjs', 'test/unit/ui/preload-session-domain.test.mjs'] },
  { mr: '1361', commit: '1b9dfe886279ec768a922654658e167aeadf30f6', mergedAt: '2026-08-27T20:07:33+08:00', branch: 'codex/1442-skill-runtime-unit-fetch', files: ['server/skill-install.mjs', 'test/unit/skills/skill-install.test.mjs'] },
  { mr: '1364', commit: '025649f48b6f99e35479d859f5874788e34b754a', mergedAt: '2026-08-27T20:29:04+08:00', branch: 'codex/issue-1444-encoded-win-path', files: ['src/local-file-reference.ts', 'test/unit/ui/local-file-reference.test.mts'] },
  { mr: '1358', commit: '5a35d94dc132e55279b96ec987e7e6be17b25bb6', mergedAt: '2026-08-27T20:48:11+08:00', branch: 'codex/fix-1430-artifact-panel-session-isolation', files: ['src/runtime-artifacts.ts', 'src/runtime.tsx', 'test/unit/runtime/runtime-artifacts.test.mjs', 'test/unit/ui/result-event-turn-correlation.test.mjs', 'test/unit/web/web-preview-iframe.test.mjs'] },
  { mr: '1365', commit: '7ed47469a843b4ff4fc24405dccc75b5b9561c35', mergedAt: '2026-08-27T20:51:32+08:00', branch: 'codex/issue-1425-automation-ui-followup', files: ['src/AutomationView.tsx', 'src/app.css', 'src/qbot.css', 'test/unit/ui/personal-automation-view-contract.test.mjs'] },
  { mr: '1428', commit: '223d76516fb4df08534e496b7a4d4e1fee358291', mergedAt: '2026-08-27T23:15:28+08:00', branch: 'enhancement/1428-claude-sdk-retry-fallback', files: ['electron/desktop-agent-host.cjs', 'electron/preload.cjs', 'scripts/ci/node-unit-test-weights.json', 'scripts/e2e-module.test.mjs', 'scripts/electron-runtime-entry.mjs', 'scripts/runtime-features/surface.mjs', 'server/engine.mjs', 'server/experience-metrics.mjs', 'server/localdb.mjs', 'server/model-auto-routing.mjs', 'server/session-execution-compatibility.mjs', 'src/claude-continuation-intent.ts', 'src/components/assistant-ui/thread.tsx', 'src/global.d.ts', 'src/runtime-session-state.ts', 'src/runtime.tsx', 'test/e2e/agent-chat-ask-cancel.local.spec.mjs', 'test/e2e/support/claude-sdk-resilience.conformance.mjs', 'test/e2e/support/module-suites.mjs', 'test/e2e/support/module-suites.test.mjs', 'test/runtime-features.test.mjs', 'test/runtime-features/runtime-feature-surface.baseline.json', 'test/unit/connectors/connector-session-state.test.mjs', 'test/unit/core/localdb-transcript.test.mjs', 'test/unit/core/model-auto-routing.test.mjs', 'test/unit/desktop/desktop-auto-current-turn-authority.test.mjs', 'test/unit/desktop/desktop-observability.test.mjs', 'test/unit/desktop/desktop-provider-retry-contract.test.mjs', 'test/unit/runtime/runtime-session-reconcile.test.mts', 'test/unit/runtime/runtime-session-state.test.mjs', 'test/unit/runtime/runtime-subscription-cleanup.test.mjs', 'test/unit/server/engine-stream-adapters.test.mjs', 'test/unit/server/model-auto-routing-fallback.test.mjs', 'test/unit/ui/assistant-message-more-action.test.mjs', 'test/unit/ui/assistant-turn-summary-ui.test.mjs', 'test/unit/ui/claude-continuation-intent.test.mts', 'test/unit/ui/experience-metrics.test.mjs', 'test/unit/ui/preload-session-domain.test.mjs'] },
  { mr: '1430', commit: 'f699d8b24c0931031d68d49f382f876debad29e9', mergedAt: '2026-08-27T23:45:54+08:00', branch: 'codex/fix-1430-artifact-attribution-no-lock', files: ['scripts/ci/node-unit-test-weights.json', 'server/artifact-snapshot-lifecycle.mjs', 'src/components/assistant-ui/markdown-text.tsx', 'src/local-file-reference.ts', 'src/runtime-artifacts.ts', 'src/runtime.tsx', 'test/unit/runtime/runtime-artifacts.test.mjs', 'test/unit/ui/assistant-message-text-rendering.test.mjs', 'test/unit/ui/local-file-reference.test.mts', 'test/unit/ui/workspace-snapshot-lifecycle.test.mjs'] },
  { mr: '1443', commit: '66a6791c675d552157ab2b464878849d5a125c04', mergedAt: '2026-08-27T23:48:00+08:00', branch: 'enhancement/1443-user-workplace-profile', files: ['docs/teams-org-api.md', 'server/teams-org.mjs', 'server/user-org-profile.mjs', 'test/unit/core/teams-org.test.mjs', 'test/unit/core/user-org-profile.test.mjs', 'test/unit/server/engine-prompt-composer.test.mjs'] },
  { mr: '1450', commit: '44e1b50067d6c01fef0124f171e9f4e9ae5114fc', mergedAt: '2026-08-27T23:59:40+08:00', branch: 'codex/issue-1450-ota-quarantine-loop', files: ['electron/preload.cjs', 'electron/runtime-orchestrator.cjs', 'server/python-standalone-runtime.mjs', 'test/unit/core/python-standalone-runtime.test.mjs', 'test/unit/desktop/teams360-host-sync.test.mjs', 'test/unit/runtime/ai-daily-orchestrator.test.mjs', 'test/unit/runtime/runtime-orchestrator.test.mjs', 'test/unit/ui/preload-runtime-control-plane-sync.test.mjs'] },
  { mr: '1451', commit: '63e2cabce3d15b8db3ecfbb54380ad87a6bb5acd', mergedAt: '2026-08-28T00:08:35+08:00', branch: 'fix/1451-claude-fallback-alias', files: ['server/engine.mjs', 'test/e2e/support/claude-sdk-resilience.conformance.mjs', 'test/unit/server/engine-stream-adapters.test.mjs'] },
  { mr: '1374', commit: 'b2c9e1a99ca051ff21cc34db3b1f56e2055c091a', mergedAt: '2026-08-28T01:06:27+08:00', branch: 'fix/1344-catalog-tier-routing', files: ['.agent/context/_shared/references/auto-model-policy.md', 'docs/desktop-local-sqlite-design.md', 'electron/desktop-agent-host.cjs', 'server/model-auto-routing.mjs', 'test/fixtures/preferred-order-v1-platform-connections.json', 'test/unit/core/model-auto-routing.test.mjs', 'test/unit/desktop/desktop-auto-current-turn-authority.test.mjs', 'test/README.md'] },
]);

const RELEASE_MR_IID_FALLBACKS = new Map([
  ['ba535cb350624fe0983004d6c9b8497376ef7cac', '1386'],
]);

let RECENT_MR_APPEND = [];

const LOCAL_FIXTURE_ADAPTERS = new Set([
  'native_ime_input',
  'managed_teams_restart',
  'managed_runtime_restart',
]);
const EXCLUDED_ACCOUNT_CASES = new Set(['BETA-EXPERT-011', 'BETA-EXPERT-013', 'BETA-AUTH-006']);
const REPLACED_CASES = new Set(['BETA-TASK-008', 'BETA-ROUTE-001']);
const FULL_ONLY_NATIVE_CASE_REPLACEMENTS = new Map([
  ['SIT-TASK-REGEN-001', 'BETA-TASK-002'],
]);
const FULL_REGRESSION_EXCLUDED_LEGACY_IDS = new Set([
  'SIT-HOME-025',
  'SIT-TASK-RECOVER-001',
  'SIT-ISSUE-800',
  'SIT-CONN-008',
  'SIT-TEAMS-DOC-001',
  'SIT-RUNTIME-RECOVER-001',
  'SIT-FILE-NEW-001',
]);
const FULL_REGRESSION_SUPPLEMENTAL_LEGACY_IDS = new Set([
  'SIT-HOME-027',
  'SIT-HOME-047',
  'SIT-HOME-052',
  'SIT-HOME-028',
  'SIT-HOME-046',
  'SIT-HOME-051',
  'SIT-CONN-005',
  'SIT-HOME-048',
]);
const CORE_BETA_BASE_EVIDENCE_ROLES = Object.freeze([
  'before_screenshot',
  'action_receipt',
  'after_screenshot',
  'public_state_readback',
  'cleanup_readback',
  'product_action_trace',
]);
const CONVERSATION_EVIDENCE_ROLES = Object.freeze([
  'task_id',
  'prompt',
  'send_receipt',
  'transcript',
  'reply_delta',
  'reply_completion',
]);

function option(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback;
}

function asString(value) {
  return value == null ? '' : String(value);
}

export function assertExpectedProductCommit(expectedProductCommit, releaseHead) {
  const expected = asString(expectedProductCommit);
  if (!expected) {
    throw new Error('必须通过 --expected-product-commit 提供最新 release/0.1 的 40 位提交 SHA');
  }
  if (!/^[a-f0-9]{40}$/iu.test(expected)) {
    throw new Error(`--expected-product-commit 必须是 40 位提交 SHA：${expected}`);
  }
  if (expected !== asString(releaseHead)) {
    throw new Error(`r16 release intake HEAD 与 --expected-product-commit 不一致：expected=${expected} actual=${releaseHead}`);
  }
  return expected;
}

export function assertExpectedReleaseIntakeSha256(expectedSha256, actualSha256) {
  const expected = asString(expectedSha256).trim().toLowerCase();
  const actual = asString(actualSha256).trim().toLowerCase();
  if (!expected) throw new Error('必须通过 --release-intake-sha256 绑定 release intake 文件 SHA-256');
  if (!/^[a-f0-9]{64}$/u.test(expected)) {
    throw new Error('--release-intake-sha256 必须是 64 位 SHA-256');
  }
  if (expected !== actual) {
    throw new Error(`release intake 文件 SHA-256 不一致：expected=${expected} actual=${actual}`);
  }
  return expected;
}

function securePathSegments(candidate) {
  const resolved = path.resolve(candidate);
  const parsed = path.parse(resolved);
  const relative = path.relative(parsed.root, resolved);
  const segments = relative ? relative.split(path.sep).filter(Boolean) : [];
  const paths = [parsed.root];
  let cursor = parsed.root;
  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    paths.push(cursor);
  }
  return { resolved, paths };
}

function assertNoSymlinkAncestors(candidate, label, { missingLeafAllowed = false } = {}) {
  const { resolved, paths } = securePathSegments(candidate);
  for (const [index, current] of paths.entries()) {
    let stat;
    try {
      stat = fsSync.lstatSync(current, { bigint: true });
    } catch (error) {
      if (error?.code === 'ENOENT' && missingLeafAllowed && index === paths.length - 1) return resolved;
      throw new Error(`${label} 路径不可读：${current}；${error?.message || error}`);
    }
    if (stat.isSymbolicLink()) throw new Error(`${label} 的路径祖先不得是符号链接：${current}`);
    if (index < paths.length - 1 && !stat.isDirectory()) {
      throw new Error(`${label} 的路径祖先必须是目录：${current}`);
    }
  }
  return resolved;
}

function captureSecureDirectory(candidate, label) {
  const resolved = assertNoSymlinkAncestors(candidate, label);
  const stat = fsSync.lstatSync(resolved, { bigint: true });
  const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : stat.uid;
  const permissions = Number(stat.mode & 0o777n);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} 必须是普通目录且不得是符号链接：${resolved}`);
  }
  if (fsSync.realpathSync(resolved) !== resolved) {
    throw new Error(`${label} canonical realpath 漂移：${resolved}`);
  }
  if (stat.uid !== currentUid) throw new Error(`${label} 必须由当前用户拥有：${resolved}`);
  if ((permissions & 0o022) !== 0) {
    throw new Error(`${label} 禁止 group/other 写入：${resolved}`);
  }
  return {
    path: resolved,
    dev: stat.dev,
    ino: stat.ino,
    uid: stat.uid,
    permissions,
  };
}

function assertSecureDirectoryGuard(guard, label) {
  const current = captureSecureDirectory(guard?.path || '', label);
  if (current.dev !== guard.dev || current.ino !== guard.ino || current.uid !== guard.uid
    || current.permissions !== guard.permissions) {
    throw new Error(`${label} 在生成期间发生替换或权限漂移：${guard.path}`);
  }
  return current.path;
}

function assertPathAbsent(candidate, label) {
  const resolved = assertNoSymlinkAncestors(candidate, label, { missingLeafAllowed: true });
  try {
    fsSync.lstatSync(resolved);
  } catch (error) {
    if (error?.code === 'ENOENT') return resolved;
    throw error;
  }
  throw new Error(`${label} 必须在调用前不存在，禁止复用或覆盖：${resolved}`);
}

function stableRegularFileSnapshot(candidate, label, { allowedLinkCounts = [1] } = {}) {
  const resolved = assertNoSymlinkAncestors(candidate, label);
  const lexical = fsSync.lstatSync(resolved, { bigint: true });
  const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : lexical.uid;
  const permissions = Number(lexical.mode & 0o777n);
  const allowedLinks = new Set(allowedLinkCounts.map((value) => BigInt(value)));
  if (!lexical.isFile() || lexical.isSymbolicLink()) {
    throw new Error(`${label} 必须是普通文件且不得是符号链接：${resolved}`);
  }
  if (lexical.uid !== currentUid || (permissions & 0o022) !== 0 || !allowedLinks.has(lexical.nlink)) {
    throw new Error(`${label} 必须由当前用户独占且禁止 group/other 写入：${resolved}`);
  }
  if (fsSync.realpathSync(resolved) !== resolved) {
    throw new Error(`${label} canonical realpath 漂移：${resolved}`);
  }
  const descriptor = fsSync.openSync(
    resolved,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0),
  );
  try {
    const before = fsSync.fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.dev !== lexical.dev || before.ino !== lexical.ino
      || !allowedLinks.has(before.nlink)) {
      throw new Error(`${label} 在打开期间发生替换或硬链接复用：${resolved}`);
    }
    const bytes = fsSync.readFileSync(descriptor);
    const after = fsSync.fstatSync(descriptor, { bigint: true });
    const final = fsSync.lstatSync(resolved, { bigint: true });
    if (!final.isFile() || final.isSymbolicLink()
      || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs
      || before.dev !== final.dev || before.ino !== final.ino || before.size !== final.size
      || before.mtimeNs !== final.mtimeNs || before.ctimeNs !== final.ctimeNs
      || !allowedLinks.has(final.nlink) || BigInt(bytes.length) !== before.size) {
      throw new Error(`${label} 在读取期间发生变化：${resolved}`);
    }
    return {
      path: resolved,
      bytes,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      dev: before.dev,
      ino: before.ino,
      uid: before.uid,
      permissions,
      nlink: before.nlink,
      mtime_ns: before.mtimeNs,
      ctime_ns: before.ctimeNs,
    };
  } finally {
    fsSync.closeSync(descriptor);
  }
}

function fsyncDirectory(directory, expectedGuard = null) {
  const guard = captureSecureDirectory(directory, 'fsync 目录');
  if (expectedGuard && (
    guard.dev !== expectedGuard.dev
    || guard.ino !== expectedGuard.ino
    || guard.uid !== expectedGuard.uid
    || guard.permissions !== expectedGuard.permissions
  )) {
    throw new Error(`fsync 目录在打开前发生替换或权限漂移：${guard.path}`);
  }
  const descriptor = fsSync.openSync(
    guard.path,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0),
  );
  try {
    const opened = fsSync.fstatSync(descriptor, { bigint: true });
    if (!opened.isDirectory() || opened.dev !== guard.dev || opened.ino !== guard.ino) {
      throw new Error(`fsync 目录在打开期间发生替换：${guard.path}`);
    }
    fsSync.fsyncSync(descriptor);
    const after = fsSync.fstatSync(descriptor, { bigint: true });
    const final = fsSync.lstatSync(guard.path, { bigint: true });
    if (!final.isDirectory() || final.isSymbolicLink()
      || after.dev !== opened.dev || after.ino !== opened.ino
      || final.dev !== opened.dev || final.ino !== opened.ino
      || final.uid !== opened.uid || Number(final.mode & 0o777n) !== guard.permissions) {
      throw new Error(`fsync 目录在同步期间发生替换或权限漂移：${guard.path}`);
    }
  } finally {
    fsSync.closeSync(descriptor);
  }
}

function captureSecureTreeSnapshot(root, { sync = false } = {}) {
  const rootResolved = path.resolve(root);
  const entries = [];
  const visit = (candidate) => {
    const resolved = assertNoSymlinkAncestors(candidate, 'Casebook staging');
    const stat = fsSync.lstatSync(resolved, { bigint: true });
    const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : stat.uid;
    const permissions = Number(stat.mode & 0o777n);
    if (stat.uid !== currentUid || (permissions & 0o022) !== 0 || stat.isSymbolicLink()) {
      throw new Error(`Casebook staging 节点所有权、权限或类型不安全：${resolved}`);
    }
    const relative = path.relative(rootResolved, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Casebook staging 节点越界：${resolved}`);
    }
    if (stat.isDirectory()) {
      for (const entry of fsSync.readdirSync(resolved).sort()) visit(path.join(resolved, entry));
      const beforeSync = fsSync.lstatSync(resolved, { bigint: true });
      if (!beforeSync.isDirectory() || beforeSync.isSymbolicLink()
        || beforeSync.dev !== stat.dev || beforeSync.ino !== stat.ino
        || beforeSync.uid !== stat.uid || Number(beforeSync.mode & 0o777n) !== permissions
        || beforeSync.mtimeNs !== stat.mtimeNs || beforeSync.ctimeNs !== stat.ctimeNs) {
        throw new Error(`Casebook staging 目录在遍历期间发生变化：${resolved}`);
      }
      const guard = {
        path: resolved,
        dev: stat.dev,
        ino: stat.ino,
        uid: stat.uid,
        permissions,
      };
      if (sync) fsyncDirectory(resolved, guard);
      entries.push({
        path: path.relative(rootResolved, resolved) || '.',
        type: 'directory',
        dev: stat.dev.toString(),
        ino: stat.ino.toString(),
        uid: stat.uid.toString(),
        permissions,
        nlink: stat.nlink.toString(),
      });
      return;
    }
    if (!stat.isFile() || stat.nlink !== 1n) {
      throw new Error(`Casebook staging 只允许独占普通文件和目录：${resolved}`);
    }
    const descriptor = fsSync.openSync(
      resolved,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0),
    );
    try {
      const opened = fsSync.fstatSync(descriptor, { bigint: true });
      if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino
        || opened.size !== stat.size || opened.nlink !== 1n) {
        throw new Error(`Casebook staging 文件在 fsync 前发生替换：${resolved}`);
      }
      const bytes = fsSync.readFileSync(descriptor);
      if (sync) fsSync.fsyncSync(descriptor);
      const after = fsSync.fstatSync(descriptor, { bigint: true });
      const final = fsSync.lstatSync(resolved, { bigint: true });
      if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size
        || after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs
        || !final.isFile() || final.isSymbolicLink()
        || final.dev !== opened.dev || final.ino !== opened.ino || final.size !== opened.size
        || final.mtimeNs !== opened.mtimeNs || final.ctimeNs !== opened.ctimeNs
        || final.nlink !== 1n || BigInt(bytes.length) !== opened.size) {
        throw new Error(`Casebook staging 文件在 fsync 期间发生变化：${resolved}`);
      }
      entries.push({
        path: path.relative(rootResolved, resolved),
        type: 'file',
        dev: opened.dev.toString(),
        ino: opened.ino.toString(),
        uid: opened.uid.toString(),
        permissions,
        nlink: opened.nlink.toString(),
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    } finally {
      fsSync.closeSync(descriptor);
    }
  };
  visit(rootResolved);
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    schema_version: 'qbot-casebook-secure-tree-snapshot/v1',
    entries,
    sha256: createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
  };
}

function fsyncSecureTree(root) {
  return captureSecureTreeSnapshot(root, { sync: true });
}

function verifySecureTreeSnapshot(root, expected, label) {
  if (!expected || expected.schema_version !== 'qbot-casebook-secure-tree-snapshot/v1'
    || !Array.isArray(expected.entries) || !/^[a-f0-9]{64}$/u.test(asString(expected.sha256))) {
    throw new Error(`${label} 缺少有效的整树快照`);
  }
  const actual = captureSecureTreeSnapshot(root);
  if (actual.sha256 !== expected.sha256
    || JSON.stringify(actual.entries) !== JSON.stringify(expected.entries)) {
    throw new Error(`${label} 与 fsync 时的整树身份或内容快照不一致`);
  }
  return actual;
}

export function atomicRenameNoReplace(source, target) {
  const sourceValue = asString(source).trim();
  const targetValue = asString(target).trim();
  if (!sourceValue || !targetValue) {
    throw new Error('排他原子 rename 的 source/target 不能为空');
  }
  const resolvedSource = path.resolve(sourceValue);
  const resolvedTarget = path.resolve(targetValue);
  const helper = stableRegularFileSnapshot(ATOMIC_RENAME_HELPER, '排他原子 rename helper');
  const execution = spawnSync(
    '/usr/bin/python3',
    ['-I', '-B', '-c', helper.bytes.toString('utf8'), resolvedSource, resolvedTarget],
    {
      cwd: ROOT,
      env: {
        PATH: '/usr/bin:/bin',
        LANG: 'C',
        LC_ALL: 'C',
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONNOUSERSITE: '1',
      },
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
      shell: false,
      timeout: 10_000,
    },
  );
  if (execution.error || execution.signal || execution.status !== 0) {
    const reason = execution.error?.message
      || execution.stderr?.trim()
      || execution.signal
      || `exit=${execution.status}`;
    throw new Error(`Casebook 输出目录排他原子提交失败：${reason}`);
  }
  return resolvedTarget;
}

function directoryIdentityMatches(stat, guard) {
  return Boolean(stat?.isDirectory?.())
    && !stat.isSymbolicLink()
    && stat.dev === guard.dev
    && stat.ino === guard.ino
    && stat.uid === guard.uid
    && Number(stat.mode & 0o777n) === guard.permissions;
}

function regularFileIdentityMatches(snapshot, guard) {
  return snapshot.dev === guard.dev
    && snapshot.ino === guard.ino
    && snapshot.uid === guard.uid
    && snapshot.size === guard.size
    && snapshot.sha256 === guard.sha256
    && snapshot.permissions === guard.permissions;
}

function transactionQuarantinePath(target, label) {
  const quarantine = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${label}-${process.pid}-${randomBytes(8).toString('hex')}`,
  );
  assertPathAbsent(quarantine, `${label} 隔离路径`);
  return quarantine;
}

function testFaultEnabled(name) {
  return process.env.NODE_ENV === 'test' && process.env[name] === '1';
}

function transactionFailure(error, stateLabel, transaction) {
  const reason = error?.message || String(error);
  const wrapped = new Error(`${reason}；${stateLabel}=${transaction.state}`, { cause: error });
  wrapped.transaction_state = transaction.state;
  wrapped.rollback = transaction.rollback || null;
  return wrapped;
}

function restoreQuarantinedPath(quarantine, target, parentGuard, label) {
  try {
    assertSecureDirectoryGuard(parentGuard, `${label} 父目录`);
    assertPathAbsent(target, `${label} 恢复目标`);
    atomicRenameNoReplace(quarantine, target);
    fsyncDirectory(parentGuard.path, parentGuard);
    return { restored: true, preserved_path: target, error: null };
  } catch (error) {
    return {
      restored: false,
      preserved_path: fsSync.existsSync(quarantine) ? quarantine : target,
      error: error?.message || String(error),
    };
  }
}

async function isolateAndRetainGuardedDirectory({ target, guard, parentGuard, label }) {
  assertSecureDirectoryGuard(parentGuard, `${label} 父目录`);
  let lexical;
  try {
    lexical = fsSync.lstatSync(target, { bigint: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return { status: 'absent', preserved_path: null };
    return { status: 'rollback_incomplete', preserved_path: target, error: error?.message || String(error) };
  }
  if (!directoryIdentityMatches(lexical, guard)) {
    return { status: 'rollback_conflict', preserved_path: target, error: `${label} 已被非本事务目录替换` };
  }
  const quarantine = transactionQuarantinePath(target, 'rollback-quarantine');
  try {
    atomicRenameNoReplace(target, quarantine);
  } catch (error) {
    return { status: 'rollback_incomplete', preserved_path: target, error: error?.message || String(error) };
  }
  let isolated;
  try {
    isolated = fsSync.lstatSync(quarantine, { bigint: true });
  } catch (error) {
    return { status: 'rollback_incomplete', preserved_path: quarantine, error: error?.message || String(error) };
  }
  if (!directoryIdentityMatches(isolated, guard)) {
    const restoration = restoreQuarantinedPath(quarantine, target, parentGuard, label);
    return {
      status: 'rollback_conflict',
      preserved_path: restoration.preserved_path,
      restored: restoration.restored,
      error: restoration.error || `${label} 与本事务目录身份不一致`,
    };
  }
  try {
    assertSecureDirectoryGuard({ ...guard, path: quarantine }, `${label} 隔离目录`);
    if (testFaultEnabled('QBOT_CASEBOOK_TEST_REPLACE_DIRECTORY_QUARANTINE_AFTER_VERIFY')) {
      const transactionPreservedPath = `${quarantine}.transaction-owned`;
      atomicRenameNoReplace(quarantine, transactionPreservedPath);
      fsSync.mkdirSync(quarantine, { mode: 0o700 });
      fsSync.writeFileSync(path.join(quarantine, 'third-party.txt'), 'third-party-directory-quarantine');
      return {
        status: 'rollback_conflict',
        preserved_path: quarantine,
        transaction_preserved_path: transactionPreservedPath,
        error: `${label} 隔离目录在最终复核后被第三方替换`,
      };
    }
    const finalCheck = fsSync.lstatSync(quarantine, { bigint: true });
    if (!directoryIdentityMatches(finalCheck, guard)) {
      return {
        status: 'rollback_conflict',
        preserved_path: quarantine,
        error: `${label} 隔离目录在最终复核后发生身份漂移`,
      };
    }
    fsyncDirectory(parentGuard.path, parentGuard);
    return {
      status: 'retained',
      preserved_path: quarantine,
      error: `${label} 已隔离保留；当前平台无法按 inode 条件原子递归删除`,
    };
  } catch (error) {
    return {
      status: 'rollback_incomplete',
      preserved_path: fsSync.existsSync(quarantine) ? quarantine : null,
      error: error?.message || String(error),
    };
  }
}

async function isolateAndRetainGuardedRegularFile({
  target,
  guard,
  parentGuard,
  label,
  syncParent = true,
}) {
  assertSecureDirectoryGuard(parentGuard, `${label} 父目录`);
  let lexical;
  try {
    lexical = fsSync.lstatSync(target, { bigint: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return { status: 'absent', preserved_path: null };
    return { status: 'rollback_incomplete', preserved_path: target, error: error?.message || String(error) };
  }
  if (!lexical.isFile() || lexical.isSymbolicLink()) {
    return { status: 'rollback_conflict', preserved_path: target, error: `${label} 已被非普通文件替换` };
  }
  try {
    const beforeIsolation = stableRegularFileSnapshot(target, `${label} 隔离前复核`, { allowedLinkCounts: [1, 2] });
    if (!regularFileIdentityMatches(beforeIsolation, guard)) {
      return { status: 'rollback_conflict', preserved_path: target, error: `${label} 在隔离前发生身份或内容漂移` };
    }
  } catch (error) {
    return { status: 'rollback_conflict', preserved_path: target, error: error?.message || String(error) };
  }
  const quarantine = transactionQuarantinePath(target, 'rollback-quarantine');
  try {
    atomicRenameNoReplace(target, quarantine);
  } catch (error) {
    return { status: 'rollback_incomplete', preserved_path: target, error: error?.message || String(error) };
  }
  let isolated;
  try {
    isolated = stableRegularFileSnapshot(quarantine, `${label} 隔离文件`, { allowedLinkCounts: [1, 2] });
  } catch (error) {
    const restoration = restoreQuarantinedPath(quarantine, target, parentGuard, label);
    return {
      status: 'rollback_conflict',
      preserved_path: restoration.preserved_path,
      restored: restoration.restored,
      error: restoration.error || error?.message || String(error),
    };
  }
  if (!regularFileIdentityMatches(isolated, guard)) {
    const restoration = restoreQuarantinedPath(quarantine, target, parentGuard, label);
    return {
      status: 'rollback_conflict',
      preserved_path: restoration.preserved_path,
      restored: restoration.restored,
      error: restoration.error || `${label} 与本事务文件身份或内容不一致`,
    };
  }
  try {
    const finalCheck = stableRegularFileSnapshot(quarantine, `${label} 删除前复核`, { allowedLinkCounts: [1, 2] });
    if (!regularFileIdentityMatches(finalCheck, guard)) {
      throw new Error(`${label} 在隔离后发生身份或内容漂移`);
    }
    if (testFaultEnabled('QBOT_CASEBOOK_TEST_REPLACE_FILE_QUARANTINE_AFTER_VERIFY')) {
      const transactionPreservedPath = `${quarantine}.transaction-owned`;
      atomicRenameNoReplace(quarantine, transactionPreservedPath);
      fsSync.writeFileSync(quarantine, 'third-party-file-quarantine', { mode: 0o600, flag: 'wx' });
      return {
        status: 'rollback_conflict',
        preserved_path: quarantine,
        transaction_preserved_path: transactionPreservedPath,
        error: `${label} 隔离文件在最终复核后被第三方替换`,
      };
    }
    if (syncParent) fsyncDirectory(parentGuard.path, parentGuard);
    return {
      status: 'retained',
      preserved_path: quarantine,
      error: `${label} 已隔离保留；当前平台无法按 inode 条件原子删除`,
    };
  } catch (error) {
    return {
      status: 'rollback_incomplete',
      preserved_path: fsSync.existsSync(quarantine) ? quarantine : null,
      error: error?.message || String(error),
    };
  }
}

async function guardedRollbackAttempt(action, preservedPath) {
  try {
    return await action();
  } catch (error) {
    return {
      status: 'rollback_incomplete',
      preserved_path: preservedPath,
      error: error?.message || String(error),
    };
  }
}

async function rollbackCasebookOutputDirectory(transaction) {
  const finalResult = await guardedRollbackAttempt(
    () => isolateAndRetainGuardedDirectory({
      target: transaction.final,
      guard: transaction.staging_guard,
      parentGuard: transaction.parent_guard,
      label: 'Casebook 最终输出目录回滚',
    }),
    transaction.final,
  );
  const stagingResult = await guardedRollbackAttempt(
    () => isolateAndRetainGuardedDirectory({
      target: transaction.staging,
      guard: transaction.staging_guard,
      parentGuard: transaction.parent_guard,
      label: 'Casebook staging 目录回滚',
    }),
    transaction.staging,
  );
  transaction.rollback = { final: finalResult, staging: stagingResult };
  transaction.committed = false;
  if ([finalResult, stagingResult].some((item) => item.status === 'rollback_incomplete')) {
    transaction.state = 'rollback_incomplete';
  } else if ([finalResult, stagingResult].some((item) => item.status === 'rollback_conflict')) {
    transaction.state = 'rollback_conflict';
  } else if ([finalResult, stagingResult].some((item) => item.status === 'retained')) {
    transaction.state = 'rollback_incomplete';
  } else {
    transaction.state = 'rolled_back';
  }
  return transaction.rollback;
}

export async function prepareCasebookOutputDirectory(outputDirectory) {
  const requested = asString(outputDirectory).trim();
  if (!requested) throw new Error('必须提供非空 --out 输出目录');
  const resolved = path.resolve(requested);
  if (resolved === path.parse(resolved).root) throw new Error('--out 不得是文件系统根目录');
  const parentGuard = captureSecureDirectory(path.dirname(resolved), 'Casebook 输出父目录');
  assertPathAbsent(resolved, '--out');
  const staging = await fs.mkdtemp(path.join(
    parentGuard.path,
    `.${path.basename(resolved)}.staging-${process.pid}-`,
  ));
  let stagingGuard = null;
  let transactionOwnedPath = null;
  try {
    stagingGuard = captureSecureDirectory(staging, 'Casebook 新建私有 staging 目录');
    if (testFaultEnabled('QBOT_CASEBOOK_TEST_REPLACE_STAGING_DURING_PREPARE')) {
      transactionOwnedPath = `${staging}.transaction-owned`;
      atomicRenameNoReplace(staging, transactionOwnedPath);
      fsSync.mkdirSync(staging, { mode: 0o700 });
      fsSync.writeFileSync(path.join(staging, 'third-party.txt'), 'third-party-prepare-staging');
      throw new Error('fault_injected_staging_replaced_during_prepare');
    }
    await fs.chmod(staging, 0o700);
    assertSecureDirectoryGuard(parentGuard, 'Casebook 输出父目录');
    assertPathAbsent(resolved, '--out');
    const finalStagingGuard = captureSecureDirectory(staging, 'Casebook 私有 staging 目录');
    if (finalStagingGuard.dev !== stagingGuard.dev || finalStagingGuard.ino !== stagingGuard.ino
      || finalStagingGuard.uid !== stagingGuard.uid) {
      throw new Error(`Casebook 私有 staging 目录在 prepare 期间发生替换：${staging}`);
    }
    stagingGuard = finalStagingGuard;
    return {
      final: resolved,
      staging,
      parent_guard: parentGuard,
      staging_guard: stagingGuard,
      state: 'prepared',
      rollback: null,
      committed: false,
    };
  } catch (error) {
    const rollback = stagingGuard
      ? await guardedRollbackAttempt(
        () => isolateAndRetainGuardedDirectory({
          target: staging,
          guard: stagingGuard,
          parentGuard,
          label: 'Casebook staging prepare 失败隔离',
        }),
        staging,
      )
      : {
        status: 'rollback_incomplete',
        preserved_path: staging,
        error: 'staging 身份尚未建立，禁止按路径删除',
      };
    const failedTransaction = {
      final: resolved,
      staging,
      parent_guard: parentGuard,
      staging_guard: stagingGuard,
      state: rollback.status === 'rollback_conflict' ? 'rollback_conflict' : 'rollback_incomplete',
      rollback: { staging_prepare: rollback },
      committed: false,
    };
    const wrapped = transactionFailure(error, 'casebook_output_prepare_transaction_state', failedTransaction);
    wrapped.staging_path = staging;
    wrapped.transaction_owned_path = transactionOwnedPath;
    throw wrapped;
  }
}

export async function commitCasebookOutputDirectory(transaction) {
  if (!transaction || typeof transaction !== 'object' || transaction.state !== 'prepared'
    || transaction.committed === true) {
    throw new Error('Casebook 输出事务无效或已经提交');
  }
  try {
    assertSecureDirectoryGuard(transaction.parent_guard, 'Casebook 输出父目录');
    assertSecureDirectoryGuard(transaction.staging_guard, 'Casebook 私有 staging 目录');
    assertPathAbsent(transaction.final, '--out');
    transaction.tree_snapshot = fsyncSecureTree(transaction.staging);
    if (testFaultEnabled('QBOT_CASEBOOK_TEST_MUTATE_TREE_AFTER_FSYNC')) {
      const file = transaction.tree_snapshot.entries.find((entry) => entry.type === 'file');
      if (!file) throw new Error('fault_injected_tree_mutation_requires_file');
      fsSync.appendFileSync(path.join(transaction.staging, file.path), 'third-party-tree-mutation');
    }
    assertSecureDirectoryGuard(transaction.parent_guard, 'Casebook 输出父目录');
    assertSecureDirectoryGuard(transaction.staging_guard, 'Casebook 私有 staging 目录');
    assertPathAbsent(transaction.final, '--out');
    if (testFaultEnabled('QBOT_CASEBOOK_FAULT_BEFORE_OUTPUT_COMMIT')) {
      throw new Error('fault_injected_before_casebook_output_commit');
    }
    if (testFaultEnabled('QBOT_CASEBOOK_TEST_RACE_EMPTY_OUTPUT_AFTER_GUARD')) {
      fsSync.mkdirSync(transaction.final, { mode: 0o700 });
    }
    atomicRenameNoReplace(transaction.staging, transaction.final);
    transaction.state = 'renamed_pending_commit';
    if (testFaultEnabled('QBOT_CASEBOOK_TEST_REPLACE_OUTPUT_AFTER_RENAME')) {
      fsSync.renameSync(transaction.final, transaction.staging);
      fsSync.mkdirSync(transaction.final, { mode: 0o700 });
      fsSync.writeFileSync(path.join(transaction.final, 'third-party.txt'), 'third-party-output');
      throw new Error('fault_injected_output_replaced_after_rename');
    }
    if (testFaultEnabled('QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_RENAME')) {
      throw new Error('fault_injected_after_casebook_output_rename');
    }
    fsyncDirectory(transaction.parent_guard.path, transaction.parent_guard);
    transaction.state = 'parent_synced';
    if (testFaultEnabled('QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_PARENT_FSYNC')) {
      throw new Error('fault_injected_after_casebook_output_parent_fsync');
    }
    const finalGuard = captureSecureDirectory(transaction.final, 'Casebook 最终输出目录');
    if (finalGuard.dev !== transaction.staging_guard.dev
      || finalGuard.ino !== transaction.staging_guard.ino
      || finalGuard.uid !== transaction.staging_guard.uid
      || finalGuard.permissions !== transaction.staging_guard.permissions) {
      throw new Error(`Casebook 最终输出目录与 staging inode 不一致：${transaction.final}`);
    }
    transaction.committed_tree_snapshot = verifySecureTreeSnapshot(
      transaction.final,
      transaction.tree_snapshot,
      'Casebook rename 后最终输出目录',
    );
    if (testFaultEnabled('QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_FINAL_VERIFY')) {
      throw new Error('fault_injected_after_casebook_output_final_verify');
    }
    transaction.state = 'committed';
    transaction.committed = true;
    return transaction.final;
  } catch (error) {
    if (transaction.state === 'renamed_pending_commit' || transaction.state === 'parent_synced') {
      await rollbackCasebookOutputDirectory(transaction);
    }
    throw transactionFailure(error, 'casebook_output_transaction_state', transaction);
  }
}

export async function abortCasebookOutputDirectory(transaction) {
  if (!transaction || transaction.committed === true || transaction.state === 'committed'
    || !transaction.staging) return false;
  if (transaction.state === 'renamed_pending_commit' || transaction.state === 'parent_synced') {
    await rollbackCasebookOutputDirectory(transaction);
    return transaction.state === 'rolled_back';
  }
  if (['rolled_back', 'rollback_incomplete', 'rollback_conflict', 'aborted', 'aborted_retained']
    .includes(transaction.state)) return false;
  const result = await guardedRollbackAttempt(
    () => isolateAndRetainGuardedDirectory({
      target: transaction.staging,
      guard: transaction.staging_guard,
      parentGuard: transaction.parent_guard,
      label: 'Casebook staging 目录中止清理',
    }),
    transaction.staging,
  );
  transaction.rollback = { ...(transaction.rollback || {}), staging_abort: result };
  if (result.status === 'retained') {
    transaction.state = 'aborted_retained';
    return true;
  }
  if (result.status === 'absent') {
    if (transaction.state !== 'rollback_conflict') transaction.state = 'aborted';
    return false;
  }
  transaction.state = result.status;
  throw transactionFailure(
    new Error(result.error || 'Casebook staging 目录无法安全清理'),
    'casebook_output_transaction_state',
    transaction,
  );
}

export async function assertCasebookOutputAbsent(outputFile) {
  const resolved = path.resolve(asString(outputFile).trim());
  if (!asString(outputFile).trim()) throw new Error('正式 Casebook 输出路径不能为空');
  captureSecureDirectory(path.dirname(resolved), '正式 Casebook 输出父目录');
  try {
    return assertPathAbsent(resolved, '正式 Casebook 输出');
  } catch (error) {
    throw new Error(`禁止覆盖已存在的正式 Casebook：${resolved}；${error.message}`);
  }
}

export function assertR13CasebookLayering({ gateIds, fullIds, regressionAddonIds, mrRows }) {
  const gate = Array.isArray(gateIds) ? gateIds : [];
  const full = Array.isArray(fullIds) ? fullIds : [];
  const addons = Array.isArray(regressionAddonIds) ? regressionAddonIds : [];
  if (gate.length !== 70 || full.length !== 160
    || JSON.stringify(full.slice(0, 70)) !== JSON.stringify(gate)) {
    throw new Error(`r13 分层数量或 G4 的 G3 前缀漂移：gate=${gate.length} full=${full.length}`);
  }
  if (gate.includes('BETA-TASK-002') || !full.includes('BETA-TASK-002')
    || full.includes('SIT-TASK-REGEN-001') || !addons.includes('BETA-TASK-002')) {
    throw new Error('r13 分层漂移：G3 不得包含 BETA-TASK-002，G4 增量必须以 BETA-TASK-002 替换 SIT-TASK-REGEN-001');
  }
  const mr1557 = (Array.isArray(mrRows) ? mrRows : []).find((row) => row?.[1] === '!1557');
  const expectedCases = R13_INCREMENTAL_MR_CONTRACTS.get('1557').caseIds.join(',');
  if (!mr1557 || mr1557[6] !== expectedCases || mr1557[7] !== '12条冒烟+70条门禁+160条增量') {
    throw new Error(`MR !1557 层级必须精确为“12条冒烟+70条门禁+160条增量”：${JSON.stringify(mr1557)}`);
  }
  return true;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function json(value) {
  return JSON.stringify(value);
}

function parseJson(value, fallback) {
  try { return JSON.parse(asString(value)); } catch { return fallback; }
}

function sourceCases(values) {
  const headerIndex = values.findIndex((row) => row.map(asString).includes('用例ID'));
  if (headerIndex < 0) throw new Error('Casebook Sheet 缺少“用例ID”表头');
  const headers = values[headerIndex].map(asString).filter(Boolean);
  const index = new Map(headers.map((header, column) => [header, column]));
  const rows = values.slice(headerIndex + 1).filter((row) => asString(row[index.get('用例ID')]).trim());
  return {
    headers,
    cases: rows.map((row) => Object.fromEntries(headers.map((header, column) => [header, row[column] ?? '']))),
  };
}

function matrix(headers, rows) {
  return rows.map((row) => headers.map((header) => row[header] ?? ''));
}

export function normalizeCasebookContractCase(testCase = {}) {
  const evidenceRoles = Array.isArray(testCase.evidence_roles)
    ? unique(testCase.evidence_roles.map((role) => asString(role).trim()))
    : unique(`${asString(testCase['证据角色'])},${asString(testCase['证据要求'])}`
      .split(',').map((role) => role.trim()));
  const preciseAssertions = testCase.precise_assertions && typeof testCase.precise_assertions === 'object'
    ? testCase.precise_assertions
    : parseJson(testCase['精准断言JSON'], null);
  const actionPlan = Array.isArray(testCase.action_plan)
    ? testCase.action_plan
    : parseJson(testCase['动作计划JSON'], []);
  const conversationTurns = Array.isArray(testCase.conversation_turns)
    ? testCase.conversation_turns
    : parseJson(testCase['会话轮次JSON'], []);
  return {
    id: asString(testCase.id || testCase['用例ID']).trim(),
    case_type: asString(testCase.case_type || testCase['用例类型']).trim(),
    scenario: asString(testCase.scenario || testCase['测试场景']),
    steps: asString(testCase.steps || testCase['自动化执行步骤'] || testCase['执行步骤']),
    expected_result: asString(testCase.expected_result || testCase['预期结果']),
    success_criteria: asString(testCase.success_criteria || testCase['成功判定']),
    oracle_type: asString(testCase.oracle_type || testCase['判定Oracle']),
    evidence_roles: evidenceRoles,
    precise_assertions: preciseAssertions,
    contract_version: asString(testCase.contract_version || testCase['契约版本']),
    automation_protocol: asString(testCase.automation_protocol || testCase['自动化协议']),
    evidence_schema_version: asString(testCase.evidence_schema_version || testCase['证据Schema版本']),
    pipeline_policy: asString(testCase.pipeline_policy || testCase['流水线策略']),
    batch_size: Number(testCase.batch_size || testCase['批次大小'] || 1),
    initialization_policy: asString(testCase.initialization_policy || testCase['初始化策略']),
    cleanup_policy: asString(testCase.cleanup_policy || testCase['清理策略']),
    risk_domain: asString(testCase.risk_domain || testCase['风险域']),
    deterministic: asString(testCase.deterministic || testCase['确定性']),
    repeat_policy: asString(testCase.repeat_policy || testCase['重复策略']),
    required_fixture: asString(testCase.required_fixture || testCase['必需Fixture']),
    hard_gate: asString(testCase.hard_gate || testCase['硬门禁']),
    version_scope: asString(testCase.version_scope || testCase['版本范围']),
    production_signal: asString(testCase.production_signal || testCase['生产观测指标']),
    action_plan: actionPlan,
    conversation_turns: conversationTurns,
  };
}

export function capability(testCase) {
  const contractCase = normalizeCasebookContractCase(testCase);
  const scenario = coreBetaScenarioSpec(contractCase);
  const binding = coreBetaRuntimeExecutorBinding(contractCase, scenario);
  const publicState = scenario?.fixture_control === 'public_product_state';
  const localOption = binding.mode === 'native' && LOCAL_FIXTURE_ADAPTERS.has(scenario?.fixture_control);
  const directlyRunnable = binding.mode === 'verified_legacy' || (binding.mode === 'native' && (publicState || localOption));
  return {
    scenario,
    binding,
    directlyRunnable,
    class: binding.mode === 'verified_legacy'
      ? 'runner_legacy_verified'
      : localOption
        ? 'runner_native_with_fixture_option'
        : publicState && binding.mode === 'native'
          ? 'runner_native'
          : 'strict_controller_required',
  };
}

function patchBaseline(testCase) {
  const next = { ...testCase };
  for (const [key, value] of Object.entries(next)) {
    if (typeof value !== 'string') continue;
    next[key] = value
      .replace(/origin\/release\/0\.1@[0-9a-f]{7,40}/g, `${PRODUCT_REF}@${PRODUCT_COMMIT}`)
      .replace(/QWork>=0\.0\.28/g, `QWork>=${PRODUCT_VERSION}`)
      .replace(/QWork>=0\.1\.1(?:-rc\.2)?/g, `QWork>=${PRODUCT_VERSION}`)
      .replace(/Teams>=5\.2\.29/g, 'Teams>=5.3.0');
  }
  next['备注'] = `${asString(next['备注']).replace(/；?origin\/release\/0\.1@[0-9a-f]{7,40}。?/g, '').trim()}；基线${PRODUCT_REF}@${PRODUCT_COMMIT}，版本${PRODUCT_VERSION}。`
    .replace(/^；/, '');
  return next;
}

function withEvidenceRole(testCase, role) {
  const next = { ...testCase };
  const roles = unique(`${asString(next['证据角色'])},${asString(next['证据要求'])},${role}`
    .split(',').map((item) => item.trim()));
  next['证据角色'] = roles.join(',');
  next['证据要求'] = roles.join(',');
  return next;
}

function appendHardOracles(testCase, values) {
  const next = { ...testCase };
  const precise = parseJson(next['精准断言JSON'], {});
  precise.hard_oracles = unique([...(Array.isArray(precise.hard_oracles) ? precise.hard_oracles : []), ...values]);
  next['精准断言JSON'] = json(precise);
  return next;
}

export function normalizeCasebookSourceIds(value) {
  return unique(asString(value).split(/[;,，；]/u).map((item) => item.trim()));
}

function dedupeCasebookSourceIds(testCase, separator = ',') {
  const next = { ...testCase };
  next['来源ID'] = normalizeCasebookSourceIds(next['来源ID']).join(separator);
  return next;
}

function appendMrSources(testCase, iids, separator = '; ') {
  const next = { ...testCase };
  next['来源ID'] = unique([
    ...normalizeCasebookSourceIds(next['来源ID']),
    ...iids.map((iid) => `MR!${iid}`),
  ]).join(separator);
  return next;
}

function applyR13MrCoverage(testCase, separator = '; ') {
  const id = asString(testCase['用例ID']);
  let next = { ...testCase };
  for (const [iid, contract] of R13_INCREMENTAL_MR_CONTRACTS) {
    if (!contract.caseIds.includes(id)) continue;
    next = appendMrSources(next, [iid], separator);
    if (contract.requiredSourceContractIds?.length) {
      next['备注'] = `${asString(next['备注'])}；MR!${iid} 的 ${contract.requiredSourceContractIds.join('/')} 仅证明 GitLab changes 中源码与测试声明存在（claim_scope=${QWORK_RELEASE_SOURCE_CLAIM_SCOPE}、test_execution_attested=${QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED}），不证明产品测试已执行或通过；本 Case 只提供已声明的桌面相邻回归。`;
    }
  }
  return next;
}

export function patchSmokeCase(testCase) {
  const id = asString(testCase['用例ID']);
  let next = patchBaseline(testCase);
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === 'string') next[key] = value.replaceAll('1/11', '1/12');
  }
  next['来源类型'] = `r8基线至${MR_WINDOW_END || '当前候选'} release/0.1 直接合入 MR 核心路径自动化`;
  next['版本范围'] = `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=${PRODUCT_VERSION}`;
  next['备注'] = `${asString(next['备注'])}；本版${EXPECTED_TOTAL_MR_COUNT}个直接合入MR已在“近2天MR覆盖”逐条映射，Dashboard/CI/eval/refactor/version-only变更只做静态合同审计。`;
  if (id === 'MRSMOKE-WEB-001') {
    next = withEvidenceRole(next, 'external_navigation_trace');
    next = withEvidenceRole(next, 'web_search_quota_trace');
    next['测试数据'] = '请使用内置 Web 搜索查找 OpenAI 官方网站最近 30 天发布的两条产品更新；若不足两条请明确说明并列出最近两条。每条给出标题、发布日期、原始 HTTPS 链接和一句摘要；回答末尾另附 https://www.iana.org/domains/reserved 作为公共外链打开验证。';
    next['执行步骤'] = '1. 新建任务，技能禁用，连接器自动。\n2. 在同一任务连续发送四轮互异的 OpenAI 官方站点搜索请求，每轮均等待完整回复。\n3. 每轮分别绑定 prompt SHA、确认发送、同一非空 taskId、runtime authority、materialized builtin:qbot_web、唯一 provider receipt 与截图。\n4. 第四轮仍必须真实调用 provider，禁止“最多三次/额度用尽/固定上限/服务端拒绝”等误导。\n5. 真实点击首轮回复中的 IANA 公共 HTTPS 链接。\n6. 断言 openPreview 公开终态为 external/external_opened，且无“无法预览/无法打开”假失败。';
    next['预期结果'] = '同一 task 四轮均真实调用 builtin:qbot_web；四个 provider receipt 有效且唯一；每轮官方来源业务 Oracle 通过；第四轮无固定搜索次数拒绝；公共域外链走 external fallback 且不显示假失败。';
    next['来源ID'] = `${asString(next['来源ID'])}; MR!1293; MR!1294; MR!1296; MR!1297; MR!1300; MR!1303; MR!1323; MR!1523`;
    next = appendHardOracles(next, [
      '同一非空 taskId 连续四轮确认发送，每轮 prompt SHA、runtime authority、provider receipt 和截图完整',
      '四轮 provider receipt 均为有效且唯一的 SHA-256，四轮 Web 业务结果 Oracle 均通过',
      '第四轮仍真实物化 builtin:qbot_web，且不出现最多三次、额度用尽、固定上限或服务端拒绝',
      '真实点击公共 HTTPS 链接后公开结果为 external/external_opened，页面无假失败提示',
    ]);
  }
  if (id === 'MRSMOKE-AUTH-001') {
    next = withEvidenceRole(next, 'workspace_missing_error_readback');
    next['执行步骤'] = `${asString(next['执行步骤'])}\n5. 保留原 taskId，删除本 Case 创建的授权 cwd。\n6. 在同一 task 重发确定性请求，读取结构化 chat.workspace.cwd_missing、原 cwd、retryable=false 与用户可见提示。\n7. 断言没有自动重试、新 taskId 或 causeCode/内部错误字段泄漏。`;
    next['预期结果'] = `${asString(next['预期结果'])}；cwd 删除后同一 task 明确返回 chat.workspace.cwd_missing，精确指向原 cwd、不可重试且不泄漏内部字段。`;
    next['来源ID'] = `${asString(next['来源ID'])}; MR!1319`;
    next = appendHardOracles(next, [
      'cwd 删除后同 taskId 返回结构化 chat.workspace.cwd_missing，params.cwd 精确且 retryable=false',
      '用户提示解释目录不存在且隐藏 desktop_local_workspace_unavailable/causeCode/stack',
    ]);
  }
  if (id === 'MRSMOKE-AUTO-001') {
    next['测试数据'] = 'intervalMs=60000；activeFrom=当前时刻；唯一显示名；禁止调用 runNow。';
    next['执行步骤'] = '1. 从自动化页用公开 API 创建 intervalMs=60000、activeFrom=当前时刻的定义\n2. listLocal 与可见列表读回同一 ID/名称\n3. 禁止 runNow，等待首次真实 interval tick 自动触发\n4. 核对 triggerKind、occurrenceKey、scheduledFor/scheduledAt、sessionId 和 succeeded\n5. 只删除本 Case run 与 definition，refresh 后有界连续读回 definition 消失';
    next['预期结果'] = '不调用 runNow；约 60 秒后产生真实 schedule run；运行身份完整且 succeeded；definition 与 run 定向清理并经 refresh 终态对账。';
    next = appendHardOracles(next, [
      'intervalMs 精确为 60000，activeFrom 使用创建时当前时刻，禁止回填过去时间',
      '删除 definition 后显式 refresh，并在有界窗口内读回目标 definition 消失',
    ]);
  }
  if (id === 'MRSMOKE-SKILL-001') {
    next = withEvidenceRole(next, 'skill_install_attempt_ledger');
    next = withEvidenceRole(next, 'skill_execution_trace');
    next['测试场景'] = 'Skill 依赖安装以 personal installAttempt 事务提交/回滚，原生 Skill 工具判定不被服务端预检提前拒绝，并保持任务级选择隔离';
    next['执行步骤'] = '1. 通过可见技能市场安装含必填依赖的确定性 Skill，读取 personal installAttempt、operationId 与成功库存/历史。\n2. 安装含失败必填依赖的确定性 Skill，读取失败 attempt 并证明只回滚本 attempt、库存/个人历史无残留。\n3. 选择 qa-scope-isolation，在任务 A 发送自检并绑定原生 Skill tool-use/result、同一taskId、runtime authority和provider receipt；禁止服务端因旧available=false/materialization投影提前拒绝。\n4. 新建任务 B、重开任务 A 并移除 Skill，核对任务级隔离。\n5. 定向卸载本 Case Fixture。';
    next['预期结果'] = '成功 attempt 原子提交根技能与依赖；失败 attempt 原子回滚且不污染个人历史；任务 A 的原生 Skill 调用返回SKILL_SCOPE_ACTIVE且无服务端提前拒绝；任务 A/B 技能选择不串扰。';
    next['来源ID'] = `${asString(next['来源ID'])}; MR!1277; MR!1292; MR!1295; MR!1302; MR!1311; MR!1526`;
    next = appendHardOracles(next, [
      '成功安装产生 schemaVersion=1、scope=personal 的 installAttempt，并按 operationId 提交根技能与依赖',
      '依赖失败产生 failed_rolled_back attempt，installed/history 对该 attempt 均无残留',
      '任务 A 的确认发送、taskId、原生 Skill tool-use/result、runtime authority 与 provider receipt 完整绑定',
      'Skill 由 Claude Code 原生工具判定，禁止 skill_runtime_materialization_unavailable、installed-but-not-mounted 或 unknown skill 服务端提前拒绝',
      '任务 A/B 技能选择与移除仍保持 task-bound 隔离',
    ]);
  }
  if (id === 'MRSMOKE-ACT-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1304; MR!1315`;
  if (id === 'MRSMOKE-ACT-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1328`;
  if (id === 'MRSMOKE-AUTO-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1328`;
  if (id === 'MRSMOKE-NAV-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1328`;
  if (id === 'MRSMOKE-ROUTE-001') {
    next['来源ID'] = `${asString(next['来源ID'])}; MR!1280; MR!1315; MR!1522`;
    next['备注'] = `${asString(next['备注'])}；MR!1522 Header 字节只由源码静态合同审计证明；桌面 E2E 仅证明同任务多轮、fallback 连续性和宿主/runtime 稳定性。`;
  }
  if (id === 'MRSMOKE-WEB-002') next['来源ID'] = `${asString(next['来源ID'])}; MR!1523`;
  if (id === 'MRSMOKE-FAIL-001') {
    const roles = unique([
      ...asString(next['证据要求']).split(',').map((role) => role.trim()),
      ...asString(next['证据角色']).split(',').map((role) => role.trim()),
      ...CONVERSATION_EVIDENCE_ROLES,
      'credential_redaction_scan',
      'security_boundary_trace',
      'negative_ui_trace',
      'log_excerpt',
      'connector_retry_recovery_trace',
    ]);
    next['测试场景'] = '凭据失败脱敏；同一 qbot_chart/render_chart 连续两次参数失败后，第三轮修正参数仍可真实成功，不得同轮或跨轮熔断';
    next['测试数据'] = '先保存确定性测试凭据并验证UI/日志/结构化读回脱敏；随后同一task依次调用render_chart：1) type=bar,data=[]；2) type=line,data=[]；3) type=bar,data=曝光12000/点击860/报名240/成交28。每轮只能调用一次。';
    next['执行步骤'] = '1. 保存只属于本Case的测试LLM连接，触发连接失败并扫描UI、日志增量和结构化API，确认密钥与路径不泄漏后定向删除。\n2. 新建干净任务，技能禁用、连接器自动。\n3. 第一轮精确发送type=bar,data=[]，等待真实render_chart参数拒绝。\n4. 同一task第二轮精确发送type=line,data=[]，等待第二次真实参数拒绝。\n5. 同一task第三轮修正为合法四点bar并等待真实成功。\n6. 每轮分别绑定prompt SHA、确认发送、同一taskId、tool-use/result、runtime authority、provider receipt和截图；禁止connector_circuit_open或“本轮不再重试”。';
    next['预期结果'] = '测试凭据在UI、日志和证据中保持脱敏；前两轮均为真实invalid_chart_data失败；第三轮仍真实调用同一工具并成功返回四点图表；三轮taskId一致且无熔断标记。';
    next['成功判定'] = '脱敏Oracle通过；三轮各恰好一个qbot_chart/render_chart工具part且证据完整；前两轮失败、第三轮四点envelope成功；runtime authority每轮ready；不存在connector_circuit_open/停止重试。';
    next['失败/阻塞判定'] = '任一秘密泄漏、第二/三轮被熔断、第三轮未真实调用或合法参数失败记trusted_bug；发送/task/tool/runtime/provider/screenshot关联缺失记framework_issue。';
    next['来源ID'] = `${asString(next['来源ID'])}; MR!1292; MR!1315; MR!1319; MR!1327; MR!1526`;
    next['证据要求'] = roles.join(',');
    next['证据角色'] = roles.join(',');
    next['会话轮次JSON'] = json([
      { turn: 1, prompt: '连接器恢复探针 1/3：必须且只能真实调用一次内置 qbot_chart 的 render_chart；参数精确为 {"type":"bar","data":[]}，不要自行修正。工具失败后只用一句话说明参数无效。', oracle: '真实调用一次并返回invalid_chart_data，不得熔断。' },
      { turn: 2, prompt: '连接器恢复探针 2/3：在同一任务中再次且只能真实调用一次 qbot_chart 的 render_chart；参数精确为 {"type":"line","data":[]}，不要自行修正。工具失败后只用一句话说明仍需有效数据。', oracle: '同task再次真实调用并返回参数失败，不得connector_circuit_open。' },
      { turn: 3, prompt: '连接器恢复探针 3/3：修正参数并且只能真实调用一次 qbot_chart 的 render_chart，type=bar，data 精确为曝光12000、点击860、报名240、成交28；必须成功生成四点柱状图。', oracle: '同task第三次真实调用成功并返回精确四点envelope。' },
    ]);
    next['动作计划JSON'] = json(actionPlan(id, asString(next['用例类型']) || 'security_privacy', next['执行步骤']));
    next['精准断言JSON'] = json(assertions([
      'UI、日志增量和结构化读回均不出现测试密钥或私有路径原值',
      '三轮确认发送、prompt SHA、taskId、tool-use/result、runtime authority、provider receipt和截图分别完整',
      '前两轮输入精确为空data且真实失败，第三轮合法四点输入真实成功',
      '三轮使用同一非空taskId，且不出现connector_circuit_open或本轮/当前轮停止重试',
    ], next['预期结果']));
  }
  if (id === 'MRSMOKE-ENTRY-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1280`;
  if (id === 'MRSMOKE-CHART-001') {
    next['产品模块'] = '内置图表与助手消息';
    next['子模块'] = 'MR 核心冒烟';
    next['测试场景'] = 'qbot_chart 四点柱状图以 qcharts-react 交互 SVG 渲染，内容、运行身份和响应式边界完整';
    next['测试数据'] = '必须且只能调用内置 qbot_chart 的 render_chart 生成柱状图。数据固定为：曝光 12000、点击 860、报名 240、成交 28。图中必须显示四个类别名称和四个固定数值标签，不要输出 SVG data URI、base64 或编码正文。';
    next['执行步骤'] = '1. 新建干净任务，技能禁用、连接器自动。\n2. 发送固定四点柱状图请求并等待同 taskId 终态。\n3. 对账确认发送、session、runtime authority、builtin:qbot_chart materialization、provider receipt 和同轮 render_chart tool part。\n4. 等待图表渲染收敛，读取唯一 qcharts-react SVG、四个标签/数值、静态与 fallback 计数。\n5. 核对图表位于 assistant/container 边界内，container、assistant、message-list、document 均无横向溢出，正文无 SVG data URI/base64 泄漏。';
    next['预期结果'] = '同轮真实调用 qbot_chart/render_chart；合法 type/data 四点 envelope 以唯一 qcharts-react SVG 渲染；无静态或失败 fallback；四个标签与数值可读；布局无横向溢出；正文无编码泄漏。';
    next['来源ID'] = 'MR!1298; SIT-CONN-016; CHART-1360-001';
    next['用例类型'] = 'mcp_use';
    next['风险域'] = 'functional,security_privacy,reliability_recovery';
    next['Oracle类型'] = 'task_bound_tool_result+runtime_authority+interactive_svg+layout_bounds';
    next['生产观测指标'] = 'qbot_chart调用成功率、qcharts交互渲染率、fallback率、图表溢出率、编码泄漏数';
    next['必需Fixture'] = 'public_product_state,account:authenticated,release_identity:frozen,builtin:qbot_chart';
    next['动作计划JSON'] = json(actionPlan(id, 'mcp_use', next['执行步骤']));
    next['会话轮次JSON'] = json([{
      label: '交互图表核心冒烟',
      prompt: next['测试数据'],
      oracle: next['预期结果'],
    }]);
    next['精准断言JSON'] = json(assertions([
      '确认发送、taskId、session、runtime authority、provider receipt 与同轮 qbot_chart/render_chart tool part 全等绑定',
      'envelope kind=qbot-chart-result、mimeType=image/svg+xml、type 非空且 data 精确为曝光12000/点击860/报名240/成交28',
      '唯一 qcharts-react SVG 可见且非零；静态 qbot-chart-result 与 qbot-chart-result-fallback 均不存在',
      'SVG 中四个标签和四个固定数值可读，图表位于 assistant/container 边界且四层横向溢出均为零',
      '助手正文不包含 SVG data URI、base64 或长编码文本',
    ], next['预期结果']));
    next = withEvidenceRole(next, 'interactive_chart_readback');
  }
  if (id === 'MRSMOKE-WEB-001') {
    next['会话轮次JSON'] = json([
      { turn: 1, label: '官方产品更新', prompt: '请使用内置 Web 搜索查找 OpenAI 官方网站最近 30 天发布的至少两条产品更新。每条必须给出标题、发布日期、原始 HTTPS 链接和一句摘要；回答末尾另附 https://www.iana.org/domains/reserved。', oracle: '至少两条独立 OpenAI 官方结果，每条均包含标题、发布日期、原始 HTTPS 链接和一句摘要；第一个唯一 provider receipt 绑定同一 task；公共外链可追溯。' },
      { turn: 2, label: '官方 API 更新', prompt: '继续在同一任务使用内置 Web 搜索，查找 OpenAI 官方网站最近 30 天至少两条 API 更新。每条必须给出标题、发布日期、原始 HTTPS 链接和一句摘要。', oracle: '至少两条独立 OpenAI 官方结果，每条均包含标题、发布日期、原始 HTTPS 链接和一句摘要；第二个唯一 provider receipt 绑定同一 task。' },
      { turn: 3, label: '官方文档更新', prompt: '继续在同一任务使用内置 Web 搜索，查找 OpenAI 官方文档最近更新的至少两条文档更新。每条必须给出标题、发布日期、原始 HTTPS 链接和一句摘要。', oracle: '至少两条独立 OpenAI 官方结果，每条均包含标题、发布日期、原始 HTTPS 链接和一句摘要；第三个唯一 provider receipt 绑定同一 task。' },
      { turn: 4, label: '第四轮额度回归', prompt: '第4轮继续在同一任务使用内置 Web 搜索，查找 OpenAI 官方网站最近至少两条安全或可靠性更新。每条必须给出标题、发布日期、原始 HTTPS 链接和一句摘要。', oracle: '至少两条独立 OpenAI 官方结果，每条均包含标题、发布日期、原始 HTTPS 链接和一句摘要；第四个唯一 provider receipt 绑定同一 task，且没有固定三次上限或服务端拒绝。' },
    ]);
  }
  next = applyR13MrCoverage(next);
  const planSteps = asString(next['执行步骤'] || next['自动化执行步骤']);
  next['动作计划JSON'] = json(actionPlan(id, asString(next['用例类型']) || 'conversation', planSteps));
  return dedupeCasebookSourceIds(next, '; ');
}

function patchFullFunctionRecentCase(testCase) {
  const id = asString(testCase['用例ID']);
  let next = { ...testCase };
  if (id === 'SIT-HOME-044') {
    next['测试场景'] = 'picker、paste、drag 三入口统一 FileInput ingress；81 MiB 发送前拒绝；删除后恢复前两份附件且顺序/identity 不漂移';
    next['测试数据'] = '三份不同内容/同名或可区分标记的确定性附件；分别经 picker、paste、drag 进入；另准备总量 81 MiB 拒绝组合。';
    next['自动化执行步骤'] = '1. 分别通过 picker、paste、drag 上传三份确定性文件并核对统一 descriptor。\n2. 删除指定附件并验证剩余前两份的顺序与 identity。\n3. 恢复被删附件并核对三份顺序。\n4. 尝试 81 MiB 总量并证明发送前拒绝、零 task/消息/send。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1305,MR!1314,MR!1352`;
    next = appendHardOracles(next, [
      'picker/paste/drag 三入口进入同一 Composer FileInput 合同',
      '81 MiB 总量发送前拒绝且不创建 task/消息/send receipt',
      '删除后前两份附件 identity 与顺序保持，恢复后完整三份可读',
    ]);
  }
  if (id === 'SIT-WORKSPACE-001') {
    next = withEvidenceRole(next, 'workspace_missing_error_readback');
    next['来源ID'] = `${asString(next['来源ID'])},MR!1319`;
    next = appendHardOracles(next, [
      '授权 cwd 删除后在原 task 重发，结构化 chat.workspace.cwd_missing 精确绑定原 cwd 且 retryable=false',
      '用户可见提示隐藏 causeCode、内部 errorCode 与 stack',
    ]);
  }
  if (['SIT-SKILL-030', 'SIT-SKILL-032'].includes(id)) {
    next = withEvidenceRole(next, 'skill_install_attempt_ledger');
    next['来源ID'] = `${asString(next['来源ID'])},MR!1302,MR!1311`;
    next = appendHardOracles(next, [
      id === 'SIT-SKILL-030'
        ? 'personal installAttempt 以稳定 operationId 原子提交根技能和全部必填依赖'
        : '失败 personal installAttempt 只回滚本 attempt，installed 与个人 history 均无残留',
    ]);
  }
  if (id === 'SIT-CONN-019') {
    next = withEvidenceRole(next, 'external_navigation_trace');
    next['来源ID'] = `${asString(next['来源ID'])},MR!1293,MR!1294,MR!1296,MR!1297,MR!1300,MR!1303,MR!1323,MR!1523`;
    next = appendHardOracles(next, [
      'Web 业务 Oracle、同 task runtime authority/provider receipt 与外链 openPreview 终态分别成立',
    ]);
  }
  if (id === 'SIT-CONN-016') {
    next = withEvidenceRole(next, 'interactive_chart_readback');
    next['用例类型'] = 'mcp_use';
    next['测试场景'] = '内置 qbot_chart 四点柱状图以 qcharts-react 交互 SVG 渲染，任务/运行身份、内容与响应式边界完整';
    next['测试数据'] = '必须且只能调用内置 qbot_chart 的 render_chart 生成柱状图。数据固定为：曝光 12000、点击 860、报名 240、成交 28。图中必须显示四个类别名称和四个固定数值标签，不要输出 SVG data URI、base64 或编码正文。';
    next['自动化执行步骤'] = '1. 新建任务，技能禁用、连接器自动。\n2. 发送固定四点请求并等待同 taskId 终态。\n3. 对账确认发送、session、runtime authority、provider receipt 与同轮 render_chart tool part。\n4. 读取唯一 qcharts-react SVG、四个标签/数值以及静态/fallback 计数。\n5. 核对 assistant/container/message-list/document 边界无横向溢出，正文无编码泄漏。';
    next['预期结果'] = '真实 qbot_chart 调用与运行身份完整；type/data 四点 envelope 以唯一交互 SVG 渲染；无静态/fallback；标签数值可读；布局无溢出；正文无 SVG/base64 泄漏。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1298,CHART-1360-001`;
    next['动作计划JSON'] = json(actionPlan(id, 'mcp_use', next['自动化执行步骤']));
    next['会话轮次JSON'] = json([{
      label: '交互图表门禁',
      prompt: next['测试数据'],
      oracle: next['预期结果'],
    }]);
    next['精准断言JSON'] = json(assertions([
      '确认发送、taskId、session、runtime authority、provider receipt 与同轮 qbot_chart/render_chart tool part 全等绑定',
      'envelope type 非空且 data 精确为曝光12000/点击860/报名240/成交28',
      '唯一 qcharts-react SVG 可见，四个标签与数值可读，静态/fallback 均不存在',
      '图表位于 assistant/container 边界，container/assistant/message-list/document 无横向溢出',
      '助手正文无 SVG data URI、base64 或长编码泄漏',
    ], next['预期结果']));
  }
  next = applyR13MrCoverage(next, ',');
  return dedupeCasebookSourceIds(next, ',');
}

function actionPlan(id, caseType, steps) {
  const executor = CORE_BETA_SCENARIO_REGISTRY.get(id).executor_route;
  return [
    {
      number: 1,
      action_id: `${id.toLowerCase()}-prepare`,
      operation: 'prepare',
      target: `${id}:prepare`,
      declared_step: `建立干净任务、固定发布身份并准备场景：${steps.split('\n')[0]}`,
      command: `prepare_${caseType}`,
      executor,
      expected_state: '页面、账号、发布身份、fixture与串行策略ready',
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [{ id: 'page-ready', path: 'state.page.body_text_length', operator: 'gte', expected: 1 }],
    },
    {
      number: 2,
      action_id: `${id.toLowerCase()}-execute`,
      operation: 'execute',
      target: `${id}:execute`,
      declared_step: steps,
      command: `execute_${caseType}`,
      executor,
      expected_state: '专项原生执行器完成全部真实UI动作并生成机器读回',
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [{ id: 'observable-assertion', path: 'receipt.assertion_count', operator: 'gte', expected: 1 }],
    },
    {
      number: 3,
      action_id: `${id.toLowerCase()}-verify`,
      operation: 'verify',
      target: `${id}:verify`,
      declared_step: '核对专项Oracle、任务/会话归属、证据完整性和清理读回。',
      command: `verify_${caseType}`,
      executor,
      expected_state: '专项精准断言无失败且必需证据可生成不可变manifest',
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [
        { id: 'no-step-failure', path: 'receipt.step_failures', operator: 'equals', expected: 0 },
        { id: 'no-assertion-failure', path: 'receipt.assertion_failures', operator: 'equals', expected: 0 },
      ],
    },
  ];
}

function assertions(hardOracles, passRule) {
  return {
    pass_rule: passRule,
    fail_rule: '产品公开状态违背业务Oracle记trusted_bug；执行、取证、关联或清理缺失记framework_issue；禁止用raw结果直接放行。',
    block_rule: '仅发布身份漂移、登录/权限或声明的真实运行资源不可用时阻塞；产品能力不足不得伪装为环境阻塞。',
    hard_oracles: hardOracles,
    text_only_capability_claim_forbidden: true,
    machine_assertions: [
      { id: 'evidence-complete', path: 'evidence.complete', operator: 'equals', expected: true },
      { id: 'no-step-failure', path: 'result.step_failures', operator: 'equals', expected: 0 },
      { id: 'no-assertion-failure', path: 'result.assertion_failures', operator: 'equals', expected: 0 },
    ],
  };
}

function inferLegacyKind(source) {
  const runner = asString(source.runner).toLowerCase();
  if (runner.includes('attachment')) return 'attachment';
  if (runner.includes('auth')) return 'auth';
  if (runner.includes('conversation')) return 'conversation';
  return 'ui';
}

function legacyCaseType(source) {
  const id = asString(source.id);
  const text = `${source.steps || ''}\n${source.scenario || ''}`;
  const hasConversation = /发送|回复|对话|追问|生成|调用|召唤.*任务/.test(text)
    && /conversation|attachment/.test(asString(source.runner).toLowerCase());
  if (/^SIT-INIT-/.test(id)) return 'run_initialization';
  if (/^SIT-AUTH-/.test(id)) return 'auth_recovery';
  if (/^SIT-(?:TEAMS-NEW|RUNTIME-RECOVER)-/.test(id)) return 'recovery';
  if (id === 'SIT-ISSUE-793') return 'performance_capacity';
  if (/^SIT-TASK-/.test(id)) return 'task_lifecycle';
  if (/^SIT-ART-|^SIT-FILE-NEW-/.test(id)) return 'artifact';
  if (id === 'SIT-KNOWLEDGE-001') return 'knowledge_lifecycle';
  if (id === 'SIT-MEM-001') return 'memory_lifecycle';
  if (id === 'SIT-WORKSPACE-001') return 'security_privacy';
  if (id === 'SIT-HOME-056') return 'attachment';
  if (/^SIT-(?:HOME|SKILL|CONN|EXPERT)-/.test(id) && hasConversation) return 'conversation';
  if (id === 'SIT-HITL-002') return 'conversation';
  return 'settings_lifecycle';
}

function legacyCoreDomain(source, caseType) {
  if (/^SIT-AUTH-/.test(source.id)) return '登录与会话';
  if (/^SIT-(?:TEAMS|RUNTIME)-/.test(source.id)) return '宿主恢复';
  if (/^SIT-ART-|^SIT-FILE/.test(source.id)) return '成果与文件';
  if (/^SIT-SKILL-/.test(source.id)) return 'Skill';
  if (/^SIT-EXPERT-/.test(source.id)) return '专家';
  if (/^SIT-CONN-/.test(source.id)) return 'MCP与连接器';
  if (/^SIT-HOME-/.test(source.id)) return '任务与会话';
  if (caseType === 'knowledge_lifecycle') return '知识';
  if (caseType === 'memory_lifecycle') return '记忆';
  return asString(source.module) || '全量功能';
}

function legacyConversationTurns(source) {
  const generated = buildConversationTurns(source, []);
  const finalOracle = asString(source.success_criteria || source.expected_result);
  return generated.map((turn, index) => ({
    turn: index + 1,
    label: asString(turn.label) || `第${index + 1}轮`,
    prompt: asString(turn.prompt),
    oracle: asString(turn.expectedDescription)
      || (index === generated.length - 1
        ? finalOracle
        : '本轮回复应完成当前指令、保持同一任务上下文，且不得改写前序已确认的业务事实。'),
  })).filter((turn) => turn.prompt);
}

function fullFunctionLegacyCase(source) {
  const migrated = migrateProductionCase({
    ...source,
    kind: source.kind || inferLegacyKind(source),
    pipeline_policy: source.pipeline_policy || source.pipeline_strategy || 'serial',
    second_review_required: source.second_review_required || source.review_requirement || '是',
  });
  if (['SIT-INIT-002', 'SIT-INIT-004'].includes(asString(migrated.id))) {
    migrated.precondition = 'QBot使用待发布Teams/QWork包启动；网络正常；测试账号已登录；自动化记录进程日志、页面截图和运行时公开状态。';
  }
  if (asString(migrated.id) === 'SIT-INIT-009') {
    migrated.test_data = '在正常网络与当前待发布runtime状态下点击检查更新，核对处理中和最终完成反馈。';
  }
  if (['SIT-AUTH-001', 'SIT-AUTH-003', 'SIT-AUTH-005'].includes(asString(migrated.id))) {
    migrated.test_data = 'dev/UAT有效测试账号；网络正常；使用当前已冻结的Lingxi OAuth配置和本轮浏览器会话。';
  }
  if (asString(migrated.id) === 'SIT-CONN-003') {
    migrated.test_data = '准备至少一个健康可选择连接器；核对自动/手动选择、chip状态与移除读回。';
  }
  if (asString(migrated.id) === 'SIT-CONN-009') {
    migrated.precondition = 'QBot使用待发布Teams/QWork包启动并已登录；框架准备一个公开状态为needs_auth的测试连接器。';
  }
  const id = asString(migrated.id);
  const caseType = legacyCaseType(migrated);
  const conversationRequired = [
    'conversation',
    'attachment',
    'artifact',
    'task_lifecycle',
    'knowledge_lifecycle',
    'memory_lifecycle',
    'security_privacy',
    'performance_capacity',
  ].includes(caseType);
  const evidenceRoles = [...CORE_BETA_BASE_EVIDENCE_ROLES];
  if (conversationRequired) evidenceRoles.push(...CONVERSATION_EVIDENCE_ROLES);
  if (caseType === 'attachment') {
    evidenceRoles.push('attachment_name_size_sha256', 'composer_attachment_state', 'attachment_readback');
  }
  const capabilityConversation = caseType === 'conversation'
    && /^SIT-(?:SKILL|CONN|EXPERT)-/.test(id);
  if (capabilityConversation) evidenceRoles.push('capability_selection', 'capability_execution_event');
  const roles = unique(evidenceRoles);
  const turns = conversationRequired ? legacyConversationTurns(migrated) : [];
  const route = CORE_BETA_SCENARIO_REGISTRY.get(id)?.executor_route || '';
  if (!route) throw new Error(`${id} 缺少全量功能回归执行器注册`);
  const steps = asString(migrated.steps);
  const hardOracles = unique([
    asString(migrated.expected_result),
    asString(migrated.success_criteria),
  ]);
  return {
    '用例ID': id,
    '产品模块': asString(migrated.module),
    '子功能': asString(migrated.submodule),
    '核心域': legacyCoreDomain(migrated, caseType),
    '优先级': asString(migrated.priority || 'P1'),
    '用例类型': caseType,
    '测试场景': asString(migrated.scenario),
    '用户旅程': asString(migrated.user_journey || `${migrated.module} → ${migrated.submodule} → 结果复核`),
    '前置条件': patchBaseline({ '前置条件': asString(migrated.precondition), '备注': '' })['前置条件'],
    '测试数据': asString(migrated.test_data),
    '自动化执行步骤': steps,
    '预期结果': asString(migrated.expected_result),
    '成功判定': asString(migrated.success_criteria),
    '失败/阻塞判定': `${asString(migrated.failure_criteria)}\n产品Oracle失败记trusted_bug；执行、取证、关联或清理缺失记framework_issue。`,
    '证据要求': roles.join(','),
    '流水线策略': 'serial',
    '批次大小': 1,
    '初始化策略': 'case_clean_only',
    '清理策略': '仅清理本Case创建的QA资源、关闭浮层并恢复空能力选择；不得删除用户真实数据。',
    '契约版本': 'qbot-core-beta/v2',
    '自动化协议': 'core-beta-action-plan/v2',
    '动作计划JSON': json(actionPlan(id, caseType, steps)),
    '会话轮次JSON': json(turns),
    '能力抽样策略JSON': '',
    '精准断言JSON': json(assertions(hardOracles, asString(migrated.success_criteria || migrated.expected_result))),
    '证据角色': roles.join(','),
    '证据Schema版本': 'qbot-core-evidence/v2',
    '自动化Runner': 'core-beta-v2/verified-legacy',
    '每轮必跑': '是',
    '来源ID': asString(migrated.source_id),
    '来源类型': `${asString(migrated.source_type)}；最新${PRODUCT_REF}@${PRODUCT_COMMIT}源码复核`,
    '备注': `全量正常功能增量；legacy executor=${id}；不属于网络异常、切换账号、受保护部署或纯故障矩阵。`,
    '风险域': 'functional,reliability_recovery,security_privacy,data_integrity_isolation',
    '判定Oracle': asString(migrated.oracle_type || 'visible_action+public_state+business_oracle'),
    '确定性': '是',
    '重复策略': '每个候选release identity至少完成1轮160/160可信全绿；本轮中的70条硬门禁同时计入连续5轮要求。',
    '必需Fixture': 'runtime:ready,account:authenticated,public_product_state',
    '硬门禁': '是',
    '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=${PRODUCT_VERSION}`,
    '生产观测指标': asString(migrated.production_signal || `${migrated.module}/${migrated.submodule}成功率`),
    'Executor路由': route,
  };
}

function englishLegacyCaseFromChinese(row) {
  return {
    id: asString(row['用例ID']),
    priority: asString(row['优先级']),
    module: asString(row['产品模块']),
    submodule: asString(row['子功能']),
    scenario: asString(row['测试场景']),
    precondition: asString(row['前置条件']),
    test_data: asString(row['测试数据']),
    selectors: asString(row['执行入口/Selector']),
    steps: asString(row['执行步骤'] || row['自动化执行步骤']),
    expected_result: asString(row['预期结果']),
    success_criteria: asString(row['成功判定']),
    failure_criteria: asString(row['失败判定'] || row['失败/阻塞判定']),
    evidence_required: asString(row['证据要求']),
    runner: asString(row['自动化Runner']),
    execution_level: asString(row['执行层级']),
    mandatory: asString(row['每轮必跑']),
    source_id: asString(row['来源ID']),
    source_type: asString(row['来源类型']),
    note: asString(row['备注']),
    user_journey: asString(row['用户旅程']),
  };
}

function rowsFromSupplementWorkbook(workbook) {
  const result = [];
  for (let index = 0; ; index += 1) {
    let sheet;
    try { sheet = workbook.worksheets.getItemAt(index); } catch { break; }
    if (!sheet) break;
    const values = sheet.getUsedRange()?.values || [];
    const headerIndex = values.findIndex((row) => row.map(asString).includes('用例ID'));
    if (headerIndex < 0) continue;
    const headers = values[headerIndex].map(asString);
    for (const valuesRow of values.slice(headerIndex + 1)) {
      const row = Object.fromEntries(headers.map((header, column) => [header, valuesRow[column] ?? '']));
      if (asString(row['用例ID'])) result.push(englishLegacyCaseFromChinese(row));
    }
  }
  return result;
}

async function loadFullFunctionLegacyCases() {
  const source = JSON.parse(await fs.readFile(LEGACY_SOURCE_JSON, 'utf8')).cases || [];
  const supplementalWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(LEGACY_SUPPLEMENT_XLSX));
  const supplemental = rowsFromSupplementWorkbook(supplementalWorkbook);
  const sourceById = new Map([...source, ...supplemental].map((item) => [asString(item.id), item]));
  const selectedIds = [...FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS];
  if (selectedIds.some((id) => FULL_REGRESSION_EXCLUDED_LEGACY_IDS.has(id))) {
    throw new Error('全量功能回归注册表包含已删除的低频/故障场景');
  }
  if ([...FULL_REGRESSION_SUPPLEMENTAL_LEGACY_IDS].some((id) => !selectedIds.includes(id))) {
    throw new Error('全量功能回归缺少补充正常功能Case');
  }
  const missing = selectedIds.filter((id) => !sourceById.has(id));
  if (missing.length) throw new Error(`全量功能回归源数据缺失：${missing.join(',')}`);
  return selectedIds.map((id) => fullFunctionLegacyCase(sourceById.get(id)));
}

export function patchRecentCases(testCase) {
  const id = asString(testCase['用例ID']);
  let next = patchBaseline(testCase);
  if (id === 'BETA-INIT-003') {
    next = withEvidenceRole(next, 'product_action_trace');
    next = withEvidenceRole(next, 'skill_reinstall_readiness_verdict');
    next = withEvidenceRole(next, 'initialization_continuation_surface');
    next['测试场景'] = '真实点击一键重装 Skill 并完成破坏性确认；以动作前、动作后两个独立 catalog ledger、前后 installed identity 全等和逐项 ready 证明运行层重建终态';
    next['用户旅程'] = '设置 → 系统设置 → 动作前稳定 catalog ledger → 一键重装 Skill → 破坏性确认 → 动作后稳定 catalog ledger → 新建任务恢复';
    next['前置条件'] = '固定发布身份与测试账号有效；无运行中任务；重装前可在有界窗口读取非空、identity 唯一且 readiness 字段完整的 getSkillsCatalog()。动作前允许在有界窗口等待 syncing 收敛，单次 syncing 不能立即定性为证据失败。';
    next['测试数据'] = '每个已安装 Skill 以 sourcePlatform/namespace/slug/installedVersion|version|revision|packageDigest|fingerprint 组成 identity；前后 installed identity 集合必须非空、唯一且全等。两个 ledger 均须 read_error_count=0、retry_error_count=0。';
    next['自动化执行步骤'] = '1. 动作前有界读取完整 getSkillsCatalog()，形成 phase=before_action 的独立 catalog ledger；允许先从 syncing 收敛，但最终各自至少三次连续同签名 syncStatus=idle，且零读取错误、零重试错误；每份 ledger 满足 started_at <= observations[*].captured_at <= ended_at 且样本时间非递减。\n2. 真实点击【一键重装 Skill】，在唯一 button.click() 紧前固化 action attempt 的 dispatched_at，捕获并接受与 method=skillsReinstall、testid=assistant-skills-reinstall 严格绑定的破坏性确认；click_count=1。\n3. 动作后有界读取完整 getSkillsCatalog()，形成 phase=after_action 的独立 catalog ledger；同样要求各自至少三次连续同签名 syncStatus=idle，read_error_count=0、retry_error_count=0，且样本处于自身 ledger 时间窗口内并非递减。\n4. 对账前后 installed identity 集合必须非空、唯一且全等；每个已安装 Skill ready=true，且不存在 unready/python_runtime_failed、半安装或错误状态。\n5. 生成 qbot-core-beta-skill-reinstall-product-action-trace/v1，精确绑定 case_id=BETA-INIT-003、method=skillsReinstall、testid=assistant-skills-reinstall、click_count=1、破坏性确认、catalog_observations_before_action、catalog_observations_after_action、terminal_outcome 和 continuation_surface，并证明 before ledger ended_at <= action dispatched_at <= after ledger started_at <= trace captured_at。\n6. 专项 Oracle 成功或失败后均真实点击【新建任务】恢复 continuation surface，写入 initialization-continuation-surface.json；必须读回非空 draftInstanceId、taskId=null、messageCount=0、running=false、Skill/Connector/Expert 全空，并记录 send_count_before、send_count_after 为可观测非负安全整数且严格全等，send_count_unchanged=true。terminal 与 catalog Oracle 组合判定，只有二者均成功才可 pass；terminal 明确失败但结构完整且 continuation safe=true 时保留 Bug。\n7. 恢复前后 PNG 均须为 Case 内普通文件，并固化路径、bytes、SHA-256 供可信复核从磁盘重放。';
    next['预期结果'] = '真实重装动作与破坏性确认可证明；动作前、动作后两个独立 catalog ledger 各自至少三次连续同签名 idle 且无读取/重试/时序错误；before ledger ended_at <= action dispatched_at <= after ledger started_at <= trace captured_at；前后 installed identity 集合必须非空、唯一且全等；terminal 与 catalog Oracle 均成功，所有已安装 Skill 均明确 ready；恢复 surface 的 send_count_before/send_count_after 均为非负安全整数、严格全等且 send_count_unchanged=true。';
    next['成功判定'] = 'qbot-core-beta-skill-reinstall-product-action-trace/v1 证明 case_id=BETA-INIT-003、method=skillsReinstall、testid=assistant-skills-reinstall、click_count=1、匹配的破坏性确认，并按 catalog_observations_before_action、catalog_observations_after_action、terminal_outcome、continuation_surface 顺序绑定全部引用；动作前、动作后两个独立 catalog ledger 各自至少三次连续同签名 syncStatus=idle，read_error_count=0、retry_error_count=0，started_at <= observations[*].captured_at <= ended_at 且样本非递减；before ledger ended_at <= action dispatched_at <= after ledger started_at <= trace captured_at；前后 installed identity 集合必须非空、唯一且全等；每个已安装 Skill ready=true 且不存在 unready/python_runtime_failed；terminal 与 catalog Oracle 均成功，专项 verdict 从原始 maintenance/terminal/catalog/截图 bytes/SHA/schema/Case/method/testid 重算为 pass；恢复 surface 为非空 draftInstanceId、taskId=null、messageCount=0、running=false、Skill/Connector/Expert 全空，send_count_before 和 send_count_after 均为可观测非负安全整数且严格全等，send_count_unchanged=true；前后 PNG 是 Case 内普通文件且路径、bytes、SHA-256 可重放。';
    next['失败/阻塞判定'] = '真实产品动作与原始证据完整时，identity 丢失/新增或任一 installed unready/python_runtime_failed/半安装/错误记 trusted_bug；缺任一前后 ledger、任一 ledger 少于三次同签名 idle、读取/重试错误、identity 空/重复/不等、专项 trace schema/Case/method/testid/点击/确认/引用漂移、恢复 surface 不干净、send count 不可观测/非安全整数/发生变化，或 PNG/引用 bytes/SHA 漂移均记 framework_issue；动作前单次 syncing 仅进入有界收敛等待，不得立即判证据失败；仅登录、权限、发布身份或服务真实不可用可记 trusted_blocked。';
    next['判定Oracle'] = 'public_state_machine+skill_reinstall_readiness+immutable_readback';
    next['动作计划JSON'] = json(actionPlan(id, 'run_initialization', next['自动化执行步骤']));
    next['精准断言JSON'] = json(assertions([
      '真实点击一键重装 Skill 且破坏性确认与 skillsReinstall 动作严格绑定，只允许一次产品点击',
      'qbot-core-beta-skill-reinstall-product-action-trace/v1 精确绑定 case_id=BETA-INIT-003、method=skillsReinstall、testid=assistant-skills-reinstall、click_count=1、破坏性确认、catalog_observations_before_action、catalog_observations_after_action、terminal_outcome、continuation_surface',
      '动作前、动作后两个独立 catalog ledger 各自至少三次连续同签名 syncStatus=idle，read_error_count=0、retry_error_count=0',
      'before ledger ended_at <= action dispatched_at <= after ledger started_at <= trace captured_at',
      '动作前允许在有界窗口等待 syncing 收敛，单次 syncing 不能立即定性为证据失败',
      '前后 installed identity 集合必须非空、唯一且全等',
      '每个已安装 Skill ready=true，且不存在 unready/python_runtime_failed/半安装/错误状态',
      '原始 maintenance/terminal/catalog/截图引用均为本 Case 普通文件，bytes/SHA/schema/Case/method/testid 全等',
      '专项 Oracle 成功或失败后点击【新建任务】恢复 continuation surface，并生成 initialization-continuation-surface.json 恢复文件',
      '恢复 surface 必须为非空 draftInstanceId、taskId=null、messageCount=0、running=false 且 Skill/Connector/Expert 全空；send_count_before、send_count_after 均为可观测非负安全整数并严格全等，send_count_unchanged=true，前后严格不变',
      '恢复前后 PNG 均为 Case 内普通文件，其路径、bytes、SHA-256 可重放',
    ], next['预期结果']));
  }
  if (id === 'BETA-FILE-006') {
    next['测试场景'] = '不支持类型、单文件超限与81 MiB总量均发送前拒绝；总量拒绝只拒第3份并保留前2份，删除后可恢复额度';
    next['测试数据'] = '不支持扩展名fixture；>30 MiB单文件；picker与paste各27 MiB后，以drag加入第3份27 MiB使累计达到81 MiB。';
    next['自动化执行步骤'] = '1. 分别验证不支持类型和单文件超限发送前拒绝且Composer为空\n2. 通过picker、paste加入前两份27 MiB附件\n3. 通过drag加入第3份27 MiB并断言只拒绝第3份、前两份同序保留\n4. 删除第一份后通过公开stageFiles重新加入第3份并核对额度恢复\n5. 全程核对零task/消息/send并定向清理';
    next['预期结果'] = '三类原因准确提示；累计81 MiB只拒绝第3份且保留前两份；删除后可重新加入第3份；全程无半成品任务或消息。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1305,MR!1314,MR!1352`;
    next = appendHardOracles(next, [
      '累计达到81 MiB时只拒绝第3份，前两份附件identity与顺序保持不变',
      '删除第一份后公开stageFiles可重新加入原第3份并保持零task/消息/send',
    ]);
  }
  if (id === 'BETA-FILE-008') {
    next['测试场景'] = 'picker、drag、clipboard三入口进入统一FileInput合同；预览可读，删除并重新加入后identity与顺序不漂移';
    next['自动化执行步骤'] = '1. 通过picker、drag和clipboard分别加入三个确定性附件并逐步读回Composer\n2. 打开clipboard图片预览并核对非空像素\n3. 删除clipboard附件，再次粘贴并核对恢复为3份且无重复\n4. 发送并核对Agent逐项引用三个附件';
    next['预期结果'] = '三入口各只增加一份附件并进入统一descriptor；预览非空；删除后恢复无重复；回复逐项引用。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1305,MR!1314,MR!1352`;
    next = appendHardOracles(next, [
      'picker、drag、clipboard三入口各增加且仅增加一个统一附件descriptor',
      'clipboard附件删除后重新粘贴恢复为3份且同名只出现一次',
    ]);
  }
  if (id === 'BETA-FILE-009') {
    next['来源ID'] = `${asString(next['来源ID'])},MR!1305,MR!1314,MR!1352`;
    next = appendHardOracles(next, [
      '同名不同SHA附件按卡片identity精确删除，保留项顺序稳定且回复不引用已删内容',
    ]);
  }
  if (id === 'BETA-EXPERT-008') {
    const turns = parseJson(next['会话轮次JSON'], []);
    next['测试数据'] = '固定研究主题：截至2026-08-10，比较 OpenAI Responses API 与 Chat Completions API；至少两个可打开的 OpenAI 官方来源。';
    if (turns[0]) turns[0].prompt = '检索至少两个 OpenAI 官方来源，说明截至2026-08-10 Responses API 与 Chat Completions API 的官方定位、主要能力差异和迁移建议。';
    next['会话轮次JSON'] = json(turns);
  }
  if (id === 'BETA-EXPERT-007') {
    next['测试场景'] = '串行发布本轮研究、数据、交付三类专家草稿，验证每类唯一operation、active release和suite ledger闭环';
    next['用户旅程'] = '本轮三类草稿 → 逐项发布 → 等待终态 → 写入本轮专家账本';
    next['前置条件'] = 'BETA-EXPERT-002/003/004已创建本轮研究、数据、交付三类草稿；使用当前单一测试账号。';
    next['测试数据'] = '三个本轮draftId/etag；三个唯一幂等键；仅使用本轮单账号正常发布链路，不引入历史专家或特殊授权。';
    next['自动化执行步骤'] = '1. 读取三类本轮草稿身份\n2. 逐项发起发布并等待completed\n3. 读回三个active expert/release并写入published_research/data/delivery';
    next['预期结果'] = '三类草稿各自产生唯一发布operation和active expert；后续专家Case只消费本轮账本。';
    next['成功判定'] = 'operation=3且全部completed；expertId/releaseId完整；三类ledger key完整；无半版本、重复发布或历史复用。';
    next['失败/阻塞判定'] = '任一发布失败、半状态、重复或账本缺失记trusted_bug/framework_issue；不得因缺少非必要外部命令阻塞。';
    next['必需Fixture'] = 'runtime:ready,account:authenticated,run_owned_expert_drafts:3';
    next['来源ID'] = 'MR!972,MR!943,MR!1065';
    next['来源类型'] = '近2天MR回归+自包含门禁重构';
    next['证据要求'] = 'before_screenshot,action_receipt,after_screenshot,public_state_readback,expert_identity_snapshot,expert_publish_operation,restart_trace,credential_redaction_scan,capability_selection,capability_execution_event,cleanup_readback';
    next['证据角色'] = next['证据要求'];
    next['动作计划JSON'] = json(actionPlan(id, 'expert_lifecycle', next['自动化执行步骤']));
    next['精准断言JSON'] = json(assertions(
      ['研究/数据/交付三个唯一发布operation全部completed', '三个active expert写入本轮suite ledger', '无历史复用、半版本或重复发布'],
      '三个本轮草稿的发布动作、终态、active release和账本身份全部闭环。',
    ));
  }
  if (id === 'BETA-EXPERT-001') {
    next['测试场景'] = '专家中心分区、搜索、详情、召唤与“发布记录仅显示本人创建专家”管理面投影';
    next['前置条件'] = 'BETA-EXPERT-007已发布本轮专家；当前账号已登录；Expert v2 bridge与M3模型可用。';
    next['测试数据'] = '按专家display.label和稳定expertId搜索；确定性短提示：请用一句话回答：你当前能以专家身份协助什么工作？';
    next['自动化执行步骤'] = '1. 读取expertLifecycle完整列表和owned=true集合\n2. 打开发布记录并核对计数/可见ID严格等于owned集合\n3. 按display.label搜索本轮已发布专家并读回详情identity\n4. 新建taskId为空的干净草稿，执行recordRecent+setExpert后发送确定性短提示\n5. 核对新taskId、expertId/versionId/releaseId、Composer与最近召唤一致';
    next['预期结果'] = '共享/内置专家只出现在专家中心对应分组，不进入发布记录；本人专家可搜索、查看并在本Case新任务中完成召唤。';
    next['成功判定'] = '发布记录计数与可见ID严格等于owned=true集合；搜索命中；发送后产生非空且不同于上游Case的新taskId；expertId/versionId/releaseId在选择、任务与最近召唤中一致。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1065`.replace(/^,/, '');
    const evidenceRoles = unique([
      ...asString(next['证据要求']).split(',').map((role) => role.trim()),
      ...CONVERSATION_EVIDENCE_ROLES,
      'product_state_diff',
    ]);
    next['证据要求'] = evidenceRoles.join(',');
    next['证据角色'] = evidenceRoles.join(',');
    next['会话轮次JSON'] = json([{
      turn: 1,
      prompt: '请用一句话回答：你当前能以专家身份协助什么工作？',
      oracle: '回复完成；发送后生成本Case独立taskId，且expertId/versionId/releaseId与本次召唤一致。',
    }]);
    next['动作计划JSON'] = json(actionPlan(id, 'expert_lifecycle', next['自动化执行步骤']));
    const precise = parseJson(next['精准断言JSON'], {});
    precise.hard_oracles = unique([
      ...(precise.hard_oracles || []),
      '发布记录可见ID与owned=true集合完全一致',
      '召唤前为干净草稿；发送后taskId非空且不等于上游Case taskId',
      'expertId/versionId/releaseId在选择、任务与最近召唤中完全一致',
    ]);
    next['精准断言JSON'] = json(precise);
  }
  if (id === 'BETA-EXPERT-012') {
    next = withEvidenceRole(next, 'expert_maintenance_task_trace');
    next['测试场景'] = '从本轮已发布 Expert 卡片进入真实“通过对话修改”维护任务，固定 Builder 与原 expert/draft，完成唯一工具更新、配置往返、可见发布、会话重开和新任务隔离';
    next['前置条件'] = 'BETA-EXPERT-004 与 BETA-EXPERT-007 已在本轮创建并发布 delivery Expert；当前账号已登录；Expert v2 lifecycle bridge、维护任务 Composer 与 M3 模型可用。';
    next['测试数据'] = '本轮 published_delivery 的稳定 expertId/名称；唯一 summary/persona 标记；快捷任务“调整职责”；维护提示只允许依次调用 get_expert_draft 与 update_expert_draft。';
    next['自动化执行步骤'] = '1. 从“我的专家”中按本轮稳定 expertId 定位已发布卡片，打开更多菜单并真实点击“通过对话修改”\n2. 核对固定 Builder、原 expertId、自动创建/复用的唯一 draftId 与维护态公开投影\n3. 点击“调整职责”快捷任务，只允许填充 Composer，确认 task/send/message 均未增加\n4. 在当前维护任务唯一发送带唯一标记的修改请求，按同一 taskId 读取工具 parts，要求精确先 get_expert_draft 后 update_expert_draft，且只更新原 draftId\n5. 读回 draft revision、summary 与 persona，再打开完整配置核对相同 expert/draft 和字段值，返回维护任务\n6. 通过可见发布按钮和确认面板发布，等待终态，核对恰好新增一个 version 与一个 release\n7. 返回并重开原维护 taskId，确认 Builder/expert/draft/历史保持；新建任务确认维护态与 Expert 选择不继承。';
    next['预期结果'] = '已发布 Expert 可从卡片进入绑定固定 Builder 和原 expert/draft 的维护任务；快捷任务零发送；唯一维护轮次仅执行 get/update 两个目标工具并持久化字段；配置往返一致；可见发布恰好产生一个新版本和发布；原会话重开稳定，新任务完全隔离。';
    next['成功判定'] = '入口、快捷任务、唯一发送、工具顺序/参数/结果、draft revision 与字段、配置往返、发布终态与计数、原会话重开及新任务空态全部由 expert_maintenance_task_trace 从磁盘复算通过；evidence_valid 与 oracle_valid 均为 true。';
    next['失败/阻塞判定'] = '产品缺入口、身份/草稿漂移、快捷任务误发送、工具多调/错序/错目标、字段未持久化、发布计数不为+1、重开漂移或新任务继承记 trusted_bug；动作、截图、task/tool/draft/publication/readback 任一证据不完整记 framework_issue；仅账号、权限或必要真实依赖不可用记 trusted_blocked。';
    next['判定Oracle'] = 'expert_published_maintenance_task_roundtrip+exact_tool_sequence+visible_publish+reopen_and_new_task_isolation';
    next['生产观测指标'] = '维护入口成功率、快捷任务零发送率、get/update工具精确率、draft字段持久化率、发布版本增量、会话重开一致率、新任务隔离率';
    next['动作计划JSON'] = json(actionPlan(id, 'expert_lifecycle', next['自动化执行步骤']));
    next['精准断言JSON'] = json(assertions([
      '从本轮已发布 Expert 卡片真实点击“通过对话修改”，维护态必须固定 qwork.builtin.expert-authoring、原 expertId 与唯一 draftId',
      '“调整职责”快捷任务只填充 Composer，taskId、send count 和消息数均不得增加；随后维护请求只确认发送一次',
      '同一维护 taskId 的工具调用精确为 get_expert_draft 后 update_expert_draft，且两者只绑定原 draftId',
      'draft revision 前进且 summary/persona 等于唯一目标值；打开完整配置与返回维护态后 expert/draft/字段保持',
      '可见发布终态成功并恰好新增一个 version 与一个 release；原维护会话重开保持，新任务不继承维护态或 Expert 选择',
    ], next['成功判定']));
  }
  if (id === 'BETA-ART-001') {
    next['测试场景'] = '生成Markdown与交互HTML成果，核对文件内容、网页预览、分享入口和宿主安全隔离';
    next['预期结果'] = 'Markdown源码可读；HTML在QWork受管网页预览中打开，分享按钮可用并出现分享对话框；脚本不在宿主DOM执行。';
    next['成功判定'] = '文件SHA/内容有效；HTML网页预览内容可见；分享入口enabled且对话框无错误；宿主无dialog/script污染。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1039,MR!1045`.replace(/^,/, '');
  }
  if (id === 'BETA-TASK-002') {
    next = withEvidenceRole(next, 'regenerate_placeholder_readback');
    next = withEvidenceRole(next, 'task_regenerate_transition');
    next['测试场景'] = '同一任务真实重新生成时立即切换 assistant 占位，保留唯一用户消息，并在版本收敛与任务重开后保持一致';
    next['测试数据'] = '确定性单轮请求生成可辨识助手回复；点击该回复的重新生成；记录点击前版本、点击后首个同task空正文running占位、最终非空第二版及重开投影。';
    next['自动化执行步骤'] = '1. 新建干净任务，发送唯一确定性请求并等待首个助手版本稳定完成\n2. 对账同一taskId、唯一用户消息、首个assistant版本与running=false\n3. 真实点击该回复的重新生成，并在等待最终回复收敛前立即读取消息投影\n4. 断言taskId不变、用户消息序列逐项不变，旧assistant已被正文为空且running=true的新assistant占位替换，没有空白或重复用户轮次\n5. 等待同一taskId的新assistant第二版以非空正文稳定收敛，核对generation/version与成果账本无幽灵项\n6. 重开同一任务，确认用户消息序列、选中的第二版非空正文和running=false保持。';
    next['预期结果'] = '点击重新生成后、最终收敛前立即出现绑定同一task、正文为空且running=true的新assistant占位，原用户消息序列逐项不变且旧assistant不再作为当前版本展示；最终非空第二版稳定完成，重开后消息、版本、正文和成果账本一致。';
    next['成功判定'] = '重新生成点击已确认；最终回复收敛前的立即读回满足taskId不变、user消息序列逐项不变、新assistant正文为空且running=true；最终与重开均为同taskId、非空第二版正文、新generation/version、running=false，且无重复正式成果或幽灵项。';
    next['失败/阻塞判定'] = '用户消息消失/重复、旧assistant残留为当前版本、点击后未立即出现新占位、跨task、最终不收敛或重开漂移记trusted_bug；点击、即时读回、版本/task关联、截图或证据缺失记framework_issue。';
    next['判定Oracle'] = 'task_bound_regenerate_transition+immediate_placeholder+version_artifact_readback+reopen_persistence';
    next['生产观测指标'] = '重新生成占位切换延迟、用户消息保持率、版本收敛率、重开一致率、幽灵成果数';
    next['动作计划JSON'] = json(actionPlan(id, 'task_lifecycle', next['自动化执行步骤']));
    next = appendHardOracles(next, [
      '真实点击重新生成后、等待最终回复收敛前立即读取消息投影，且非空taskId与点击前全等',
      '即时读回中用户消息序列逐项不变，旧assistant已被正文为空且running=true的新assistant占位替换',
      '最终新assistant第二版在同一task以非空正文收敛为running=false，generation/version唯一且成果账本无幽灵项',
      '重开同一task后用户消息序列、选中的第二版非空正文和running=false保持一致',
    ]);
  }
  if (id === 'BETA-TASK-008') {
    const steps = '1. 在同一新任务依次发送两个唯一输入并等待接受\n2. 输入未发送草稿并把光标置于首行起点；第一次物理ArrowUp只建立边界握手且草稿不变，第二次才回放最新输入，随后Up/Down核对新到旧与草稿恢复\n3. 新建任务用两次物理ArrowUp核对历史隔离，再重开原task并用两次物理ArrowUp核对最新输入持久化';
    const roles = ['before_screenshot', 'action_receipt', 'after_screenshot', 'public_state_readback', 'task_id', 'prompt', 'send_receipt', 'transcript', 'reply_delta', 'reply_completion', 'product_action_trace', 'data_integrity_readback', 'cleanup_readback'];
    Object.assign(next, {
      '产品模块': '任务与会话',
      '子功能': 'Composer历史输入',
      '核心域': '任务生命周期',
      '优先级': 'P0',
      '用例类型': 'task_lifecycle',
      '测试场景': 'Composer通过两阶段物理方向键边界握手进入当前会话历史，恢复未发送草稿，并保持任务隔离与重开持久化',
      '用户旅程': '发送两轮 → 输入草稿 → 首次方向键握手 → 第二次进入历史 → Up/Down浏览 → 新任务隔离 → 重开原任务',
      '前置条件': '运行时ready；当前账号已登录；从干净新任务开始；Composer无附件、Skill、Expert、MCP残留。',
      '测试数据': 'QBOT-HISTORY-FIRST、QBOT-HISTORY-SECOND、QBOT-HISTORY-DRAFT-NOT-SENT；均绑定本轮taskId。',
      '自动化执行步骤': steps,
      '预期结果': '空闲态第一次同向物理方向键只确认外边界，第二次才进入历史；浏览态Up按新到旧、Down按旧到新并恢复原草稿；新任务无历史；重开原task后历史仍在。',
      '成功判定': '三处边界握手读回符合预期，六个历史导航读回逐字一致；原taskId非空；新任务为activeId为空、messageCount=0的独立草稿且两次ArrowUp均为空；重开原task第二次ArrowUp等于第二条输入。',
      '失败/阻塞判定': '第一次方向键直接进入历史、第二次仍不进入、顺序错误、草稿丢失、跨任务泄漏或重开丢历史记trusted_bug；读回/截图/任务关联缺失记framework_issue。',
      '证据要求': roles.join(','),
      '流水线策略': 'serial',
      '批次大小': 1,
      '初始化策略': 'run_full_reset_then_case_clean',
      '清理策略': '关闭浮层并清空当前任务能力选择；保留两taskId与历史读回；不发送未提交草稿。',
      '契约版本': 'qbot-core-beta/v2',
      '自动化协议': 'core-beta-action-plan/v2',
      '动作计划JSON': json(actionPlan(id, 'task_lifecycle', steps)),
      '会话轮次JSON': json([
        { turn: 1, prompt: 'QBOT-HISTORY-FIRST：只回复 FIRST-ACCEPTED。', oracle: '回复完整且输入被当前task接受' },
        { turn: 2, prompt: 'QBOT-HISTORY-SECOND：只回复 SECOND-ACCEPTED。', oracle: '回复完整且输入被当前task接受' },
      ]),
      '能力抽样策略JSON': '',
      '精准断言JSON': json(assertions(
        ['空闲态第一次物理ArrowUp只建立边界握手且输入不变', '第二次ArrowUp进入历史且Up顺序为SECOND→FIRST', 'Down顺序为SECOND→未发送草稿', '新任务两次ArrowUp均为空且重开原task第二次ArrowUp保留最新历史'],
        '两阶段物理方向键握手、当前会话已接受输入顺序、草稿恢复、任务隔离和持久化同时成立。',
      )),
      '证据角色': roles.join(','),
      '证据Schema版本': 'qbot-core-evidence/v2',
      '自动化Runner': 'core-beta-v2',
      '每轮必跑': '是',
      '来源ID': 'MR!1063,MR!1087',
      '来源类型': '近2天MR新增原生回归',
      '备注': `Composer history navigation；${PRODUCT_REF}@${PRODUCT_COMMIT}。`,
      '风险域': 'functional,data_integrity_isolation,reliability_recovery',
      '判定Oracle': 'task_bound_history_readback+draft_restore',
      '确定性': '是',
      '重复策略': '同一冻结发布身份连续5个全量轮次；任一非pass、阻塞、波动、继承/synthetic或证据缺失都会把连续全绿计数归零',
      '必需Fixture': 'runtime:ready,account:authenticated,composer:clean',
      '硬门禁': '是',
      '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=${PRODUCT_VERSION}`,
      '生产观测指标': '历史回放顺序、草稿恢复率、跨任务泄漏数、重开持久化率',
      'Executor路由': CORE_BETA_SCENARIO_REGISTRY.get(id).executor_route,
    });
  }
  if (id === 'BETA-ROUTE-001') {
    const steps = '1. 新建干净任务并读回当前runtimeFamily与connection view\n2. 打开模型菜单并等待同步终态\n3. 比对菜单候选与当前SDK允许的runtimeFamily/protocol/disabled过滤结果';
    const roles = ['before_screenshot', 'action_receipt', 'after_screenshot', 'public_state_readback', 'model_route_trace', 'cleanup_readback'];
    Object.assign(next, {
      '产品模块': '模型与路由',
      '子功能': '模型菜单SDK过滤',
      '核心域': 'Auto模型路由',
      '优先级': 'P0',
      '用例类型': 'model_routing',
      '测试场景': 'Composer模型菜单只展示当前SDK/runtimeFamily可执行且协议匹配的模型候选',
      '用户旅程': '新建任务 → 读取当前SDK → 打开模型菜单 → 核对候选',
      '前置条件': '运行时ready；当前账号已登录；connection view至少有一个当前SDK可用模型。',
      '测试数据': 'Claude Code允许anthropic；Codex允许response；disabled、其他runtimeFamily和其他协议作为负向集合。',
      '自动化执行步骤': steps,
      '预期结果': '菜单候选多重集合严格等于当前SDK允许集合；无同步错误；档位仅M1-M4。',
      '成功判定': 'expected/rendered modelId多重集合一致；Claude/Codex协议映射正确；无其他SDK候选泄漏。',
      '失败/阻塞判定': '错误候选、漏候选或跨SDK泄漏记trusted_bug；connection view/DOM证据缺失记framework_issue。',
      '证据要求': roles.join(','),
      '流水线策略': 'serial',
      '批次大小': 1,
      '初始化策略': 'run_full_reset_then_case_clean',
      '清理策略': '只读打开并关闭模型菜单，不修改当前模型选择；保留脱敏model route trace。',
      '契约版本': 'qbot-core-beta/v2',
      '自动化协议': 'core-beta-action-plan/v2',
      '动作计划JSON': json(actionPlan(id, 'model_routing', steps)),
      '会话轮次JSON': '[]',
      '能力抽样策略JSON': '',
      '精准断言JSON': json(assertions(
        ['Claude Code仅anthropic候选', 'Codex仅response候选', '菜单候选与当前SDK可用集合完全一致'],
        'connection view与可见菜单按当前SDK过滤后的模型多重集合完全一致。',
      )),
      '证据角色': roles.join(','),
      '证据Schema版本': 'qbot-core-evidence/v2',
      '自动化Runner': 'core-beta-v2',
      '每轮必跑': '是',
      '来源ID': 'MR!1028',
      '来源类型': '近2天MR新增原生回归',
      '备注': `Composer model menu SDK filter；${PRODUCT_REF}@${PRODUCT_COMMIT}。`,
      '风险域': 'functional,compatibility_upgrade,data_integrity_isolation',
      '判定Oracle': 'connection_view+visible_model_multiset',
      '确定性': '是',
      '重复策略': '同一冻结发布身份连续5个全量轮次；任一非pass、阻塞、波动、继承/synthetic或证据缺失都会把连续全绿计数归零',
      '必需Fixture': 'runtime:ready,account:authenticated,model_options:min1',
      '硬门禁': '是',
      '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=${PRODUCT_VERSION}`,
      '生产观测指标': '候选集合一致率、跨SDK泄漏数、同步错误数',
      'Executor路由': CORE_BETA_SCENARIO_REGISTRY.get(id).executor_route,
    });
  }
  if (['BETA-CHAT-006', 'BETA-PERF-003'].includes(id)) {
    next = withEvidenceRole(next, 'horizontal_overflow_readback');
    next['来源ID'] = `${asString(next['来源ID'])},MR!1526`.replace(/^,/, '');
    next['预期结果'] = `${asString(next['预期结果'])}；助手正文、助手消息、消息列表和document四层均无横向溢出。`;
    next['成功判定'] = `${asString(next['成功判定'])}；四层scrollWidth-clientWidth差值均不超过1px。`;
    next['失败/阻塞判定'] = `${asString(next['失败/阻塞判定'])}；任一层横向溢出记trusted_bug，DOM或截图证据缺失记framework_issue。`;
    next = appendHardOracles(next, [
      '助手正文、助手消息、消息列表和document四层横向溢出差值均不超过1px',
      id === 'BETA-CHAT-006'
        ? '停止后保留回复与继续追问回复分别完成四层边界读回'
        : '80条长文本流式回复终态完成四层边界读回',
    ]);
  }
  if (id === 'BETA-CHAT-005') {
    next['来源ID'] = `${asString(next['来源ID'])},MR!1523`.replace(/^,/, '');
  }
  if (id === 'BETA-CHAT-001') {
    next['来源ID'] = `${asString(next['来源ID'])},MR!1522`.replace(/^,/, '');
  }
  if (id === 'BETA-ROUTE-001') {
    next['来源ID'] = `${asString(next['来源ID'])},MR!1522`.replace(/^,/, '');
    next['备注'] = `${asString(next['备注'])}；MR!1522 Header 字节由源码静态合同审计；本桌面 Case 只验证路由/runtime 稳定性。`;
  }
  if (id === 'BETA-HOST-003') {
    next['来源ID'] = `${asString(next['来源ID'])},MR!1522`.replace(/^,/, '');
  }
  next = applyR13MrCoverage(next, ',');
  const planSteps = asString(next['自动化执行步骤'] || next['执行步骤']);
  if (planSteps) next['动作计划JSON'] = json(actionPlan(id, asString(next['用例类型']), planSteps));
  return dedupeCasebookSourceIds(next, ',');
}

function orderCases(cases) {
  const expertOrder = [
    'BETA-EXPERT-002', 'BETA-EXPERT-003', 'BETA-EXPERT-004', 'BETA-EXPERT-005',
    'BETA-EXPERT-007', 'BETA-EXPERT-001', 'BETA-EXPERT-008', 'BETA-EXPERT-009',
    'BETA-EXPERT-010', 'BETA-EXPERT-012', 'BETA-EXPERT-014', 'BETA-EXPERT-015',
    'BETA-EXPERT-016',
  ];
  const expertRank = new Map(expertOrder.map((id, index) => [id, index]));
  const sourceRank = new Map(cases.map((item, index) => [asString(item['用例ID']), index]));
  return [...cases].sort((left, right) => {
    const leftId = asString(left['用例ID']);
    const rightId = asString(right['用例ID']);
    if (expertRank.has(leftId) && expertRank.has(rightId)) return expertRank.get(leftId) - expertRank.get(rightId);
    return sourceRank.get(leftId) - sourceRank.get(rightId);
  });
}

function sameFileSet(expectedFiles, actualFiles) {
  if (!Array.isArray(expectedFiles) || !Array.isArray(actualFiles) || expectedFiles.length !== actualFiles.length) {
    return false;
  }
  const expected = new Set(expectedFiles);
  const actual = new Set(actualFiles);
  return expected.size === expectedFiles.length
    && actual.size === actualFiles.length
    && [...expected].every((file) => actual.has(file));
}

async function previousCasebookMrRows() {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(PREVIOUS_CASEBOOK));
  const values = workbook.worksheets.getItem('近2天MR覆盖').getUsedRange().values;
  const rows = values
    .slice(4)
    .filter((row) => /^!\d+$/.test(asString(row[1])))
    .map((row) => {
      const previous = Array.from({ length: 10 }, (_, index) => row[index] ?? '');
      const iid = asString(previous[1]).replace(/^!/, '');
      const coverageStrength = previous[7] === '静态合同审计' || !asString(previous[6])
        ? '静态合同'
        : REQUIRED_SOURCE_CONTRACTS_BY_MR.has(iid)
          ? '相邻回归+源码合同'
          : DIRECT_E2E_MR_CASE_CONTRACTS.has(iid)
            ? '直接E2E'
            : '相邻回归';
      return [...previous.slice(0, 8), coverageStrength, ...previous.slice(8)];
    });
  if (rows.length !== EXPECTED_PREVIOUS_MR_COUNT
    || new Set(rows.map((row) => asString(row[1]))).size !== EXPECTED_PREVIOUS_MR_COUNT
    || new Set(rows.map((row) => asString(row[2]))).size !== EXPECTED_PREVIOUS_MR_COUNT) {
    throw new Error(`r12 历史 MR 覆盖行必须恰好${EXPECTED_PREVIOUS_MR_COUNT}条且IID/commit唯一`);
  }
  return rows;
}

function sameOrderedValues(actual, expected) {
  return Array.isArray(actual) && JSON.stringify(actual) === JSON.stringify(expected);
}

function validateCasebookDesignMr1552BlockedException(report) {
  const failures = [];
  const rejectUnless = (condition, failure) => {
    if (!condition) failures.push(failure);
  };
  const unresolved = report?.unresolved;
  const apiFreshness = report?.policy?.api_freshness;
  const scanBoundary = report?.scan_boundary;
  const mergeRequests = Array.isArray(report?.merge_requests) ? report.merge_requests : [];
  const sourceContracts = Array.isArray(report?.source_contracts) ? report.source_contracts : [];
  const risks = Array.isArray(report?.blocking_risks) ? report.blocking_risks : [];
  const risk = risks[0];
  const releaseHead = asString(report?.release?.head);
  const riskProtectedPaths = qworkReleaseBlockingRiskProtectedPaths({
    releaseHead,
    successorAncestry: risk?.successor_ancestry,
    releaseBeforeSuccessorAncestry: risk?.release_before_successor_ancestry,
  });
  const baselineCommit = asString(scanBoundary?.baseline_commit);
  const expectedBranch = asString(report?.release?.ref).replace(/^origin\//u, '');
  const riskValidation = validateQworkReleaseBlockingRisksForReport(report);

  rejectUnless(report?.decision === 'BLOCKED', 'decision_not_blocked');
  rejectUnless(sameOrderedValues(report?.blockers, [CASEBOOK_DESIGN_MR1552_BLOCKER]), 'blockers_not_exact_mr1552_product_risk');
  rejectUnless(unresolved && typeof unresolved === 'object' && !Array.isArray(unresolved), 'unresolved_invalid');
  rejectUnless(sameOrderedValues(Object.keys(unresolved || {}).sort(), [...RELEASE_INTAKE_UNRESOLVED_KEYS].sort()), 'unresolved_keys_mismatch');
  for (const key of RELEASE_INTAKE_UNRESOLVED_KEYS) {
    rejectUnless(Array.isArray(unresolved?.[key]), `unresolved_${key}_not_array`);
  }
  rejectUnless(unresolved?.unmapped_product_paths?.length === 0, 'unmapped_product_paths_present');
  rejectUnless(unresolved?.unverified_mr_metadata?.length === 0, 'unverified_mr_metadata_present');
  rejectUnless(unresolved?.unattributed_direct_commits?.length === 0, 'unattributed_direct_commits_present');
  rejectUnless(unresolved?.api_errors?.length === 0, 'api_errors_present');
  rejectUnless(unresolved?.source_contract_failures?.length === 0, 'source_contract_failures_present');
  rejectUnless(sameOrderedValues(unresolved?.blocking_risk_failures, CASEBOOK_DESIGN_MR1552_FAILURES), 'blocking_risk_failures_not_exact');
  rejectUnless(Number(report?.summary?.unknown_count) === 0, 'summary_unknown_count_nonzero');
  rejectUnless(Number(report?.summary?.source_contract_failure_count) === 0, 'summary_source_contract_failure_count_nonzero');

  rejectUnless(report?.policy?.source_of_truth === 'commit-ancestry-first', 'source_of_truth_mismatch');
  rejectUnless(report?.policy?.metadata_read_only === true, 'metadata_not_read_only');
  rejectUnless(report?.policy?.require_gitlab_metadata === true, 'gitlab_metadata_not_required');
  rejectUnless(apiFreshness?.mode === 'gitlab-api', 'freshness_mode_not_gitlab_api');
  rejectUnless(apiFreshness?.verified === false, 'freshness_decision_not_isolated_blocked');
  rejectUnless(apiFreshness?.branch === expectedBranch, 'freshness_branch_mismatch');
  rejectUnless(/^[a-f0-9]{40}$/iu.test(releaseHead), 'release_head_invalid');
  rejectUnless(apiFreshness?.branch_head_before === releaseHead, 'branch_head_before_mismatch');
  rejectUnless(apiFreshness?.branch_head_after === releaseHead, 'branch_head_after_mismatch');
  rejectUnless(apiFreshness?.compare_from === baselineCommit, 'compare_from_mismatch');
  rejectUnless(apiFreshness?.compare_to === releaseHead, 'compare_to_mismatch');
  rejectUnless(apiFreshness?.first_parent_complete === true, 'first_parent_incomplete');
  rejectUnless(Number.isSafeInteger(Number(apiFreshness?.compare_commit_count))
    && Number(apiFreshness.compare_commit_count) >= mergeRequests.length, 'compare_commit_count_invalid');
  rejectUnless(Number(apiFreshness?.first_parent_merge_count) === mergeRequests.length, 'first_parent_merge_count_mismatch');
  rejectUnless(Number(apiFreshness?.mr_changes_verified_count) === mergeRequests.length, 'mr_changes_verified_count_mismatch');
  rejectUnless(scanBoundary?.mode === 'commit_ancestry' && scanBoundary?.ancestry_verified === true
    && scanBoundary?.verification_source === 'gitlab-api', 'scan_boundary_not_gitlab_api_ancestry');
  rejectUnless(Array.isArray(scanBoundary?.compare_attempts)
    && scanBoundary.compare_attempts.some((attempt) => attempt?.ok === true
      && attempt?.baseline_commit === baselineCommit), 'scan_boundary_compare_attempt_missing');
  rejectUnless(Number(report?.summary?.scanned_commit_count) === mergeRequests.length, 'summary_scanned_commit_count_mismatch');
  rejectUnless(Number(report?.summary?.merge_request_count) === mergeRequests.length, 'summary_merge_request_count_mismatch');

  rejectUnless(mergeRequests.length > 0, 'merge_requests_empty');
  for (const [index, mr] of mergeRequests.entries()) {
    const expectedParent = index === 0 ? baselineCommit : asString(mergeRequests[index - 1]?.commit);
    rejectUnless(/^\d+$/u.test(asString(mr?.iid)), `mr_${index}_iid_invalid`);
    rejectUnless(/^[a-f0-9]{40}$/iu.test(asString(mr?.commit)), `mr_${index}_commit_invalid`);
    rejectUnless(asString(mr?.parent) === expectedParent, `mr_${index}_first_parent_mismatch`);
    rejectUnless(Number(mr?.parent_count) === 2, `mr_${index}_not_direct_merge`);
    rejectUnless(mr?.metadata_source === 'gitlab-api-changes' && mr?.metadata_verified === true, `mr_${index}_metadata_unverified`);
    rejectUnless(Array.isArray(mr?.changed_paths) && mr.changed_paths.length > 0
      && new Set(mr.changed_paths).size === mr.changed_paths.length
      && mr.changed_paths.every((item) => asString(item)), `mr_${index}_changes_invalid`);
    rejectUnless(/^[a-f0-9]{64}$/iu.test(asString(mr?.diff_sha256))
      && Number.isSafeInteger(Number(mr?.diff_bytes)) && Number(mr.diff_bytes) > 0, `mr_${index}_diff_invalid`);
    rejectUnless(Array.isArray(mr?.source_contract_ids), `mr_${index}_source_contract_ids_missing`);
    rejectUnless(mr?.impact?.mapping_status === 'MAPPED'
      && Array.isArray(mr?.impact?.unmapped_product_paths)
      && mr.impact.unmapped_product_paths.length === 0, `mr_${index}_mapping_untrusted`);
  }
  rejectUnless(asString(mergeRequests.at(-1)?.commit) === releaseHead, 'merge_request_head_mismatch');
  const mr1552 = mergeRequests.filter((mr) => asString(mr?.iid) === '1552');
  rejectUnless(mr1552.length === 1 && asString(mr1552[0]?.commit) === QWORK_MR1552_MERGE_COMMIT_SHA, 'mr1552_merge_binding_mismatch');

  const sourceContractVerifiedCount = sourceContracts.filter(
    (attestation) => attestation?.verified === true && attestation?.status === 'VERIFIED',
  ).length;
  const sourceContractOriginCount = sourceContracts.filter(
    (attestation) => attestation?.origin_change_attestation !== null
      && attestation?.origin_change_attestation !== undefined,
  ).length;
  const sourceContractOriginVerifiedCount = sourceContracts.filter(
    (attestation) => attestation?.origin_change_attestation?.verified === true
      && attestation?.origin_change_attestation?.status === 'VERIFIED',
  ).length;
  rejectUnless(sourceContractVerifiedCount === sourceContracts.length, 'source_contracts_not_all_verified');
  rejectUnless(apiFreshness?.source_contracts_verified === true, 'freshness_source_contracts_not_verified');
  rejectUnless(Number(apiFreshness?.source_contract_count) === sourceContracts.length
    && Number(apiFreshness?.source_contract_verified_count) === sourceContracts.length
    && Number(apiFreshness?.source_contract_current_count) === sourceContracts.length
    && Number(apiFreshness?.source_contract_current_verified_count) === sourceContracts.length
    && Number(apiFreshness?.source_contract_origin_count) === sourceContractOriginCount
    && Number(apiFreshness?.source_contract_origin_verified_count) === sourceContractOriginVerifiedCount,
  'freshness_source_contract_counts_mismatch');
  rejectUnless(Number(report?.summary?.source_contract_count) === sourceContracts.length
    && Number(report?.summary?.source_contract_verified_count) === sourceContracts.length
    && Number(report?.summary?.source_contract_current_count) === sourceContracts.length
    && Number(report?.summary?.source_contract_current_verified_count) === sourceContracts.length
    && Number(report?.summary?.source_contract_origin_count) === sourceContractOriginCount
    && Number(report?.summary?.source_contract_origin_verified_count) === sourceContractOriginVerifiedCount,
  'summary_source_contract_counts_mismatch');

  rejectUnless(risks.length === 1 && risk?.risk_id === QWORK_MR1552_EXECUTION_RUNNER_RISK_ID, 'blocking_risk_not_unique_mr1552');
  rejectUnless(risk?.mr_iid === '1552' && risk?.merge_commit_sha === QWORK_MR1552_MERGE_COMMIT_SHA
    && risk?.release_head === releaseHead, 'blocking_risk_identity_mismatch');
  rejectUnless(risk?.applicable === true && risk?.activation_source === 'gitlab-api-first-parent-ancestry'
    && risk?.status === 'BLOCKED' && risk?.verified === false, 'blocking_risk_status_mismatch');
  rejectUnless(sameOrderedValues(risk?.protected_paths, riskProtectedPaths), 'blocking_risk_protected_paths_mismatch');
  rejectUnless(sameOrderedValues(risk?.failure_ids, [...QWORK_MR1552_FAILURE_IDS]), 'blocking_risk_failure_ids_mismatch');
  rejectUnless(Array.isArray(risk?.evidence_failures) && risk.evidence_failures.length === 0, 'blocking_risk_evidence_failure');
  rejectUnless(sameOrderedValues((risk?.checks || []).map((check) => check?.id), [...QWORK_MR1552_FAILURE_IDS])
    && risk.checks.every((check) => check?.passed === false
      && check?.observations && typeof check.observations === 'object'
      && Object.keys(check.observations).length > 0), 'blocking_risk_checks_mismatch');
  rejectUnless(sameOrderedValues((risk?.source_files || []).map((file) => file?.path), riskProtectedPaths)
    && risk.source_files.every((file) => file?.requested_ref === releaseHead
      && file?.ref === releaseHead && file?.commit_id === releaseHead && !asString(file?.error)
      && /^[a-f0-9]{40}$/iu.test(asString(file?.blob_id))
      && /^[a-f0-9]{40}$/iu.test(asString(file?.last_commit_id))
      && file?.encoding === 'base64' && Number.isSafeInteger(Number(file?.bytes)) && Number(file.bytes) > 0
      && /^[a-f0-9]{64}$/iu.test(asString(file?.sha256))), 'blocking_risk_source_evidence_invalid');
  rejectUnless(Number(apiFreshness?.blocking_risk_count) === 1
    && Number(apiFreshness?.blocking_risk_applicable_count) === 1
    && Number(apiFreshness?.blocking_risk_verified_count) === 0
    && Number(apiFreshness?.blocking_risk_failure_count) === QWORK_MR1552_FAILURE_IDS.length
    && apiFreshness?.blocking_risks_verified === false, 'freshness_blocking_risk_counts_mismatch');
  rejectUnless(Number(report?.summary?.blocking_risk_count) === 1
    && Number(report?.summary?.blocking_risk_applicable_count) === 1
    && Number(report?.summary?.blocking_risk_verified_count) === 0
    && Number(report?.summary?.blocking_risk_failure_count) === QWORK_MR1552_FAILURE_IDS.length,
  'summary_blocking_risk_counts_mismatch');
  failures.push(...riskValidation.failures.map((failure) => `blocking_risk:${failure}`));
  return { ok: failures.length === 0, failures };
}

export function validateCasebookDesignReleaseIntake(report, validationOptions = {}) {
  const readyValidation = validateQworkReleaseIntake(report, {
    ...validationOptions,
    requireReady: true,
    requireFreshRef: true,
  });
  if (readyValidation.ok) return { ok: true, acceptance: 'READY', failures: [] };
  const structuralValidation = validateQworkReleaseIntake(report, {
    ...validationOptions,
    requireReady: false,
    requireFreshRef: false,
  });
  const blockedException = validateCasebookDesignMr1552BlockedException(report);
  const failures = unique([
    ...structuralValidation.failures.map((failure) => `intake:${failure}`),
    ...blockedException.failures.map((failure) => `design_exception:${failure}`),
  ]);
  return {
    ok: structuralValidation.ok && blockedException.ok,
    acceptance: structuralValidation.ok && blockedException.ok ? 'BLOCKED_MR1552_DESIGN_ONLY' : 'REJECTED',
    failures,
  };
}

async function loadReleaseIntake() {
  const intakeFile = option('release-intake');
  if (!intakeFile) throw new Error('必须通过 --release-intake 提供最新 GitLab API freshness 报告');
  const resolved = path.resolve(intakeFile);
  const intakeSnapshot = stableRegularFileSnapshot(resolved, 'release intake');
  const intakeBytes = intakeSnapshot.bytes;
  const artifactSha256 = intakeSnapshot.sha256;
  assertExpectedReleaseIntakeSha256(option('release-intake-sha256'), artifactSha256);
  const report = JSON.parse(intakeBytes.toString('utf8'));
  const validation = validateCasebookDesignReleaseIntake(report, {
    releaseRef: PRODUCT_REF,
    casebookSha256: PREVIOUS_CASEBOOK_SHA256,
  });
  if (!validation.ok) throw new Error(`release intake 校验失败：${validation.failures.join(',')}`);
  if (report.scan_boundary?.baseline_commit !== PREVIOUS_CASEBOOK_PRODUCT_COMMIT
    || report.policy?.api_freshness?.compare_from !== PREVIOUS_CASEBOOK_PRODUCT_COMMIT) {
    throw new Error(`release intake 必须从 r12 产品基线开始：${PREVIOUS_CASEBOOK_PRODUCT_COMMIT}`);
  }
  const releaseHead = asString(report.release?.head);
  const expectedProductCommit = asString(option('expected-product-commit'));
  if (!/^[a-f0-9]{40}$/iu.test(releaseHead)
    || asString(report.policy?.api_freshness?.branch_head_before) !== releaseHead
    || asString(report.policy?.api_freshness?.branch_head_after) !== releaseHead) {
    throw new Error('r13 release intake HEAD 必须由 GitLab API 扫描前后稳定读回');
  }
  assertExpectedProductCommit(expectedProductCommit, releaseHead);
  if (Number(report.policy?.api_freshness?.first_parent_merge_count) !== EXPECTED_INCREMENTAL_MR_COUNT
    || report.merge_requests?.length !== EXPECTED_INCREMENTAL_MR_COUNT) {
    throw new Error(`r13 增量直接 MR 必须恰好${EXPECTED_INCREMENTAL_MR_COUNT}个，actual=${report.merge_requests?.length || 0}`);
  }
  const observedMrOrder = report.merge_requests.map((mr) => asString(mr.iid));
  if (JSON.stringify(observedMrOrder) !== JSON.stringify(R13_INCREMENTAL_MR_ORDER)) {
    throw new Error(`r13 增量 MR 顺序漂移：expected=${R13_INCREMENTAL_MR_ORDER.join(',')} actual=${observedMrOrder.join(',')}`);
  }
  const declaredMrOrder = [...R13_INCREMENTAL_MR_CONTRACTS.keys()];
  if (R13_INCREMENTAL_MR_CONTRACTS.size !== EXPECTED_INCREMENTAL_MR_COUNT
    || JSON.stringify(declaredMrOrder) !== JSON.stringify(R13_INCREMENTAL_MR_ORDER)) {
    throw new Error(`r13 显式覆盖合同必须恰好${EXPECTED_INCREMENTAL_MR_COUNT}项且顺序固定`);
  }
  const sourceAttestations = Array.isArray(report.source_contracts) ? report.source_contracts : [];
  const expectedSourceContractIds = unique([...REQUIRED_SOURCE_CONTRACTS_BY_MR.values()].flat());
  const observedSourceContractIds = sourceAttestations.map((item) => asString(item?.contract_id));
  if (observedSourceContractIds.length !== expectedSourceContractIds.length
    || new Set(observedSourceContractIds).size !== observedSourceContractIds.length
    || expectedSourceContractIds.some((contractId) => !observedSourceContractIds.includes(contractId))) {
    throw new Error(`r13 source contract 集合必须精确为 ${expectedSourceContractIds.join(',')}`);
  }
  for (const [iid, contract] of R13_INCREMENTAL_MR_CONTRACTS) {
    if (!COVERAGE_STRENGTHS.has(contract.coverageStrength)) {
      throw new Error(`r13 增量 MR !${iid} 覆盖强度非法：${contract.coverageStrength}`);
    }
    if (contract.coverageStrength === '静态合同'
      && (!contract.staticOnly || contract.caseIds.length !== 0 || contract.requiredSourceContractIds?.length)) {
      throw new Error(`r13 增量 MR !${iid} 静态合同必须 staticOnly=true、caseIds=[] 且无源码合同绑定`);
    }
    if (contract.coverageStrength === '相邻回归+源码合同' && !contract.requiredSourceContractIds?.length) {
      throw new Error(`r13 增量 MR !${iid} 相邻回归+源码合同缺少 requiredSourceContractIds`);
    }
    if (contract.coverageStrength === '相邻回归+源码合同'
      && (contract.staticOnly || contract.caseIds.length === 0)) {
      throw new Error(`r13 增量 MR !${iid} 相邻回归+源码合同必须同时具备桌面相邻 Case`);
    }
    if (contract.coverageStrength === '相邻回归'
      && (contract.staticOnly || contract.caseIds.length === 0 || contract.requiredSourceContractIds?.length)) {
      throw new Error(`r13 增量 MR !${iid} 相邻回归必须具备桌面 Case 且不得冒充源码合同`);
    }
    if (contract.coverageStrength === '直接E2E') {
      const directCases = DIRECT_E2E_MR_CASE_CONTRACTS.get(iid);
      if (!directCases || JSON.stringify(directCases) !== JSON.stringify(contract.caseIds)) {
        throw new Error(`r13 增量 MR !${iid} 直接E2E 未命中显式 MR→Case 白名单`);
      }
    }
  }
  for (const [iid, contractIds] of REQUIRED_SOURCE_CONTRACTS_BY_MR) {
    for (const contractId of contractIds) {
      const attestation = sourceAttestations.find((item) => asString(item?.contract_id) === contractId);
      if (!attestation || attestation.verified !== true || attestation.status !== 'VERIFIED'
        || !Array.isArray(attestation.failures) || attestation.failures.length !== 0
        || attestation.claim_scope !== QWORK_RELEASE_SOURCE_CLAIM_SCOPE
        || attestation.test_execution_attested !== QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED) {
        throw new Error(`MR !${iid} 源码合同未满足 VERIFIED 声明边界：${contractId}`);
      }
    }
  }
  for (const mr of report.merge_requests) {
    const iid = asString(mr.iid);
    const contract = R13_INCREMENTAL_MR_CONTRACTS.get(iid);
    if (!contract) throw new Error(`r13 增量 MR !${iid} 缺少显式映射合同`);
    const productPaths = Array.isArray(mr.impact?.product_paths) ? mr.impact.product_paths : [];
    if (Boolean(contract.staticOnly) !== (productPaths.length === 0)) {
      throw new Error(`r13 增量 MR !${iid} 静态/产品分类漂移`);
    }
    const sourceContractIds = Array.isArray(mr.source_contract_ids)
      ? mr.source_contract_ids.map(asString).filter(Boolean)
      : [];
    const requiredSourceContractIds = contract.requiredSourceContractIds || [];
    if (new Set(sourceContractIds).size !== sourceContractIds.length
      || JSON.stringify(sourceContractIds) !== JSON.stringify(requiredSourceContractIds)) {
      throw new Error(`r13 增量 MR !${iid} source_contract_ids 缺失或重复`);
    }
  }
  const rows = report.merge_requests.map((mr) => ({
    mr: asString(mr.iid),
    commit: asString(mr.commit),
    mergedAt: asString(mr.merged_at),
    subject: asString(mr.title),
    body: '',
    branch: asString(mr.branch || mr.title),
    files: Array.isArray(mr.changed_paths) ? mr.changed_paths.map(asString).filter(Boolean) : [],
    sourceContractIds: Array.isArray(mr.source_contract_ids)
      ? mr.source_contract_ids.map(asString).filter(Boolean)
      : [],
    intakeIncrement: true,
    intakeStaticAudit: Array.isArray(mr.impact?.product_paths) && mr.impact.product_paths.length === 0
      ? {
        disposition: 'GitLab API静态合同审计：不新增桌面QWork E2E',
        reason: `全部变更均分类为${unique((mr.impact.static_dispositions || []).map((item) => item.disposition)).join('/') || '非产品源码'}；保留精确merge commit与changes，不计16/12/70/160桌面通过`,
      }
      : null,
  }));
  if (new Set(rows.map((row) => row.mr)).size !== rows.length
    || new Set(rows.map((row) => row.commit)).size !== rows.length
    || rows.some((row) => !/^\d+$/.test(row.mr) || !/^[a-f0-9]{40}$/i.test(row.commit) || row.files.length === 0)) {
    throw new Error('release intake 的 MR IID、merge commit 或 changes 列表不完整/重复');
  }
  if (rows.at(-1)?.commit !== report.release.head) {
    throw new Error(`release intake 最后一条 first-parent MR 必须等于 HEAD：${rows.at(-1)?.commit}`);
  }
  return { report, resolved, artifactSha256, rows, acceptance: validation.acceptance };
}

function mrMapping(mr) {
  const r13Contract = R13_INCREMENTAL_MR_CONTRACTS.get(String(mr.mr || ''));
  if (r13Contract) return [...r13Contract.caseIds];
  if (String(mr.mr || '') === '1523') {
    return [...(RECENT_MR_CASE_MAPPING.get('1523') || [])];
  }
  if (String(mr.mr || '') === '1522') {
    return [...(RECENT_MR_CASE_MAPPING.get('1522') || [])];
  }
  if (String(mr.mr || '') === '1526') {
    return [...(RECENT_MR_CASE_MAPPING.get('1526') || [])];
  }
  if (String(mr.mr || '') === '1516') {
    return [...(RECENT_MR_CASE_MAPPING.get('1516') || [])];
  }
  const text = `${mr.branch} ${mr.subject} ${mr.files.join(' ')}`.toLowerCase();
  const mappings = [];
  const add = (...ids) => mappings.push(...ids);
  if (/composer-history|history-navigation/.test(text)) add('BETA-TASK-008');
  if (/model-menu-sdk|model.*sdk.*filter/.test(text)) add('BETA-ROUTE-001');
  if (/expert-publish-records-owned/.test(text)) add('BETA-EXPERT-001', 'BETA-EXPERT-007');
  if (/company.*(org|profile|context)|org-profile/.test(text)) add('BETA-CHAT-001', 'BETA-CHAT-009');
  if (/web-preview|markdown-link-preview|session-artifact-isolation/.test(text)) add('BETA-ART-001', 'BETA-CHAT-007');
  if (/skill-creator|skill-card|skillhub|workflow-skill/.test(text)) add('BETA-SKILL-002', 'BETA-SKILL-005', 'BETA-SKILL-014');
  if (/mcp|connector/.test(text)) add('BETA-MCP-001', 'BETA-MCP-002', 'BETA-SKILL-011');
  if (/qcharts|interactive-chart|chart-view|chart-tool/.test(text)) add('MRSMOKE-CHART-001', 'SIT-CONN-016');
  if (/reasoning-scroll|chat-ui|avatar|assistant-thread|turn-context|capability-isolation/.test(text)) add('BETA-CHAT-005', 'BETA-CHAT-007');
  if (/expert|handoff/.test(text)) add('BETA-EXPERT-001', 'BETA-EXPERT-007', 'BETA-EXPERT-012');
  if (/attachment|file|enametoolong/.test(text)) add('BETA-FILE-005', 'BETA-FILE-006', 'BETA-FILE-007');
  if (/teams|desktop|runtime|bootstrap|host-core|ota|recovery-readiness/.test(text)) add('BETA-INIT-001', 'BETA-REC-001', 'BETA-REC-002', 'BETA-HOST-003');
  if (/secret|security|auth-shell|terminal-arbitration/.test(text)) add('BETA-CHAT-009', 'BETA-SEC-002');
  add(...(RECENT_MR_CASE_MAPPING.get(String(mr.mr || '')) || []));
  return unique(mappings);
}

function mrArea(mr) {
  const text = `${mr.branch} ${mr.files.join(' ')}`.toLowerCase();
  if (/composer|chat|thread/.test(text)) return '会话与Composer';
  if (/expert/.test(text)) return '专家';
  if (/skill/.test(text)) return 'Skill';
  if (/qcharts|interactive-chart|chart-view|chart-tool/.test(text)) return '交互图表';
  if (/mcp|connector/.test(text)) return 'MCP/连接器';
  if (/preview|artifact/.test(text)) return '成果与预览';
  if (/teams|desktop|runtime|host/.test(text)) return '宿主与运行时';
  if (/deploy|helm|ingress|migration|docker|server/.test(text)) return '服务端/部署';
  if (/test|ci|chore|refactor|bump/.test(text)) return '工程与CI';
  return '其他';
}

function deletionReason(testCase, cap) {
  const id = asString(testCase['用例ID']);
  const fixture = asString(cap.scenario?.fixture_control);
  const text = `${id} ${fixture} ${testCase['测试场景']}`.toLowerCase();
  if (PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS.has(id)) {
    return ['低频恢复/故障注入', '按用户要求从70条门禁和160条全量回归同时删除；由正常高频功能Case补齐固定规模。'];
  }
  if (EXCLUDED_ACCOUNT_CASES.has(id) || /secondary_account|second_account|切换账号|第二账号/.test(text)) {
    return ['低频账号场景', '按用户要求删除切换账号/第二账号场景；单账号owner投影由BETA-EXPERT-001覆盖。'];
  }
  if (/network|proxy|unreachable|connection_cache|discovery_fault|service_fail|网络|不可达|代理/.test(text)) {
    return ['低频网络异常', '按用户要求删除网络异常、不可达、代理和连接缓存故障注入；保留正常联网业务路径。'];
  }
  if (/protected_release_deployment|deploy/.test(text)) {
    return ['非桌面灰度批次', '需要受保护K8s/Postgres/Helm控制器，不能混入桌面串行门禁；保留为独立发布工程检查。'];
  }
  if (REPLACED_CASES.has(id)) {
    return ['近2天语义替换', '旧场景移出；同一Case ID已重写为近2天高风险原生场景。'];
  }
  return ['框架能力收敛', '当前只有严格外部控制器契约，没有QbotTestAgent原生真实执行器；为避免伪可执行，从发布门禁移入自动化待办。'];
}

function styleSheet(sheet, title, subtitle, headers, rows, widths = []) {
  const columns = Math.max(1, headers.length);
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, columns).values = [[title, ...Array(columns - 1).fill('')]];
  sheet.getRangeByIndexes(1, 0, 1, columns).values = [[subtitle, ...Array(columns - 1).fill('')]];
  sheet.getRangeByIndexes(3, 0, 1, columns).values = [headers];
  if (rows.length) sheet.getRangeByIndexes(4, 0, rows.length, columns).values = rows;
  const titleRange = sheet.getRangeByIndexes(0, 0, 1, columns);
  titleRange.merge();
  titleRange.format.fill = '#17324D';
  titleRange.format.font = { bold: true, color: '#FFFFFF', size: 16 };
  titleRange.format.rowHeightPx = 34;
  const subtitleRange = sheet.getRangeByIndexes(1, 0, 1, columns);
  subtitleRange.merge();
  subtitleRange.format.fill = '#DDF2EF';
  subtitleRange.format.font = { color: '#1C2B36', size: 10 };
  subtitleRange.format.wrapText = true;
  subtitleRange.format.rowHeightPx = 44;
  const headerRange = sheet.getRangeByIndexes(3, 0, 1, columns);
  headerRange.format.fill = '#176B68';
  headerRange.format.font = { bold: true, color: '#FFFFFF', size: 10 };
  headerRange.format.wrapText = true;
  headerRange.format.verticalAlignment = 'center';
  headerRange.format.rowHeightPx = 38;
  if (rows.length) {
    const body = sheet.getRangeByIndexes(4, 0, rows.length, columns);
    body.format.wrapText = true;
    body.format.verticalAlignment = 'top';
    body.format.borders = { preset: 'all', style: 'thin', color: '#C9D6E2' };
    body.format.rowHeightPx = columns > 15 ? 112 : 58;
  }
  headerRange.format.borders = { preset: 'all', style: 'thin', color: '#C9D6E2' };
  widths.forEach((width, index) => {
    if (index < columns) sheet.getRangeByIndexes(0, index, rows.length + 4, 1).format.columnWidthPx = width;
  });
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(1);
}

function addSheet(workbook, name, title, subtitle, headers, rows, widths) {
  const sheet = workbook.worksheets.add(name);
  styleSheet(sheet, title, subtitle, headers, rows, widths);
  return sheet;
}

function capabilitySet(cases) {
  const items = cases.map((testCase) => ({ testCase, ...capability(testCase) }));
  const counts = Object.fromEntries(
    [...new Set(items.map((item) => item.class))]
      .map((name) => [name, items.filter((item) => item.class === name).length]),
  );
  return {
    items,
    counts,
    strict: items.filter((item) => item.class === 'strict_controller_required'),
    unsupported: items.filter((item) => !item.binding.dispatchable),
  };
}

export function auditCasebookRuntimeScopes(scopes, { fixtureRoot = path.join(ROOT, 'testflies') } = {}) {
  const expectedScopes = [
    ['核心生命线门禁', 16],
    ['新增MR核心冒烟', 12],
    ['生产灰度门禁Case', 70],
    ['全量功能回归Case', 160],
  ];
  const sheets = expectedScopes.map(([sheetName, expectedCount]) => {
    const sourceRows = scopes?.[sheetName];
    if (!Array.isArray(sourceRows)) throw new Error(`r16 导出后能力审计缺少 Sheet：${sheetName}`);
    const cases = sourceRows.map(normalizeCasebookContractCase);
    const protocol = validateCoreBetaCasePlan(cases, { fixtureRoot });
    const rows = cases.map((testCase) => {
      const scenario = coreBetaScenarioSpec(testCase);
      const binding = coreBetaRuntimeExecutorBinding(testCase, scenario);
      const cap = capability(testCase);
      const protocolCase = protocol.cases.find((item) => item.id === testCase.id);
      return {
        case_id: testCase.id,
        protocol_ok: protocolCase?.ok === true,
        protocol_errors: protocolCase?.errors || [],
        executor_route: scenario?.executor_route || '',
        driver: scenario?.driver || '',
        fixture_control: scenario?.fixture_control || '',
        runtime_executor_mode: binding.mode,
        runtime_dispatchable: binding.dispatchable,
        directly_runnable: cap.directlyRunnable,
        capability_class: cap.class,
      };
    });
    const capabilitySummary = capabilitySet(sourceRows);
    return {
      sheet_name: sheetName,
      expected_count: expectedCount,
      case_count: rows.length,
      case_ids: rows.map((row) => row.case_id),
      protocol: {
        ok: protocol.ok,
        executable_count: protocol.executable_count,
        errors: protocol.errors,
        warnings: protocol.warnings,
      },
      runtime_dispatch: {
        ok: rows.every((row) => row.runtime_dispatchable),
        dispatchable_count: rows.filter((row) => row.runtime_dispatchable).length,
        unsupported_count: rows.filter((row) => !row.runtime_dispatchable).length,
      },
      directly_runnable: {
        ok: rows.every((row) => row.directly_runnable),
        count: rows.filter((row) => row.directly_runnable).length,
      },
      capability: {
        summary: capabilitySummary.counts,
        strict_controller_required: capabilitySummary.strict.length,
        unsupported_runtime: capabilitySummary.unsupported.length,
      },
      cases: rows,
    };
  });
  const failures = sheets.flatMap((sheet) => {
    const errors = [];
    if (sheet.case_count !== sheet.expected_count) errors.push(`count=${sheet.case_count}/${sheet.expected_count}`);
    if (!sheet.protocol.ok || sheet.protocol.executable_count !== sheet.expected_count) {
      errors.push(`protocol=${sheet.protocol.executable_count}/${sheet.expected_count}:${sheet.protocol.errors.join(' | ')}`);
    }
    if (!sheet.runtime_dispatch.ok || sheet.runtime_dispatch.dispatchable_count !== sheet.expected_count) {
      errors.push(`dispatchable=${sheet.runtime_dispatch.dispatchable_count}/${sheet.expected_count}`);
    }
    if (!sheet.directly_runnable.ok || sheet.directly_runnable.count !== sheet.expected_count) {
      errors.push(`directly_runnable=${sheet.directly_runnable.count}/${sheet.expected_count}`);
    }
    if (sheet.capability.strict_controller_required !== 0 || sheet.capability.unsupported_runtime !== 0) {
      errors.push(`strict=${sheet.capability.strict_controller_required},unsupported=${sheet.capability.unsupported_runtime}`);
    }
    return errors.map((error) => `${sheet.sheet_name}:${error}`);
  });
  if (failures.length) throw new Error(`r16 导出后完整协议与运行时能力审计失败：${failures.join('; ')}`);
  return {
    schema_version: 'qbot-release01-exported-runtime-audit/v1',
    ok: true,
    sheets,
  };
}

export async function publishValidatedCasebookArtifact({
  artifactFile,
  formalOutput,
  expectedArtifactSha256 = '',
  expectedArtifactSize = null,
}) {
  const artifact = stableRegularFileSnapshot(artifactFile, '已验收 Casebook artifact');
  const expectedSha256 = asString(expectedArtifactSha256).trim().toLowerCase();
  if (expectedSha256 && (!/^[a-f0-9]{64}$/u.test(expectedSha256) || artifact.sha256 !== expectedSha256)) {
    throw new Error(`已验收 Casebook artifact 与 runtime audit SHA-256 不一致：expected=${expectedSha256} actual=${artifact.sha256}`);
  }
  if (expectedArtifactSize != null && Number(expectedArtifactSize) !== artifact.size) {
    throw new Error(`已验收 Casebook artifact 与 runtime audit 字节数不一致：expected=${expectedArtifactSize} actual=${artifact.size}`);
  }
  const resolvedFormalOutput = await assertCasebookOutputAbsent(formalOutput);
  const parentGuard = captureSecureDirectory(
    path.dirname(resolvedFormalOutput),
    '正式 Casebook 输出父目录',
  );
  const temporary = path.join(
    parentGuard.path,
    `.${path.basename(resolvedFormalOutput)}.staging-${process.pid}-${randomBytes(8).toString('hex')}`,
  );
  const publication = {
    state: 'prepared',
    committed: false,
    formal_created: false,
    temporary,
    temporary_guard: null,
    temporary_open_guard: null,
    rollback: null,
  };
  let handle;
  let failure = null;
  try {
    handle = await fs.open(
      temporary,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL
        | (fsConstants.O_NOFOLLOW || 0),
      0o600,
    );
    const opened = await handle.stat({ bigint: true });
    publication.temporary_open_guard = {
      dev: opened.dev,
      ino: opened.ino,
      uid: opened.uid,
      permissions: Number(opened.mode & 0o777n),
    };
    await handle.writeFile(artifact.bytes);
    await handle.sync();
    const written = await handle.stat({ bigint: true });
    const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : written.uid;
    if (!written.isFile() || written.size !== BigInt(artifact.size) || written.nlink !== 1n
      || written.uid !== currentUid || Number(written.mode & 0o777n) !== 0o600) {
      throw new Error('正式 Casebook staging 文件写入不完整或被复用');
    }
    await handle.close();
    handle = null;
    assertSecureDirectoryGuard(parentGuard, '正式 Casebook 输出父目录');
    assertPathAbsent(resolvedFormalOutput, '正式 Casebook 输出');
    const staged = stableRegularFileSnapshot(temporary, '正式 Casebook staging 文件');
    if (staged.sha256 !== artifact.sha256 || staged.size !== artifact.size) {
      throw new Error('正式 Casebook staging 文件与已验收 artifact 不一致');
    }
    publication.temporary_guard = staged;
    if (testFaultEnabled('QBOT_CASEBOOK_TEST_REPLACE_ARTIFACT_BEFORE_FORMAL_PUBLISH')) {
      const displacedArtifact = `${artifact.path}.audited-artifact`;
      atomicRenameNoReplace(artifact.path, displacedArtifact);
      fsSync.writeFileSync(artifact.path, 'third-party-artifact', { mode: 0o600, flag: 'wx' });
      publication.displaced_artifact = displacedArtifact;
    }
    if (testFaultEnabled('QBOT_CASEBOOK_FAULT_BEFORE_FORMAL_PUBLISH')) {
      throw new Error('fault_injected_before_formal_casebook_publish');
    }
    const prepublishArtifact = stableRegularFileSnapshot(artifact.path, '正式发布前 Casebook artifact');
    if (!regularFileIdentityMatches(prepublishArtifact, artifact)) {
      throw new Error('正式发布前 Casebook artifact 与 runtime audit 快照不一致');
    }
    assertSecureDirectoryGuard(parentGuard, '正式 Casebook 输出父目录');
    assertPathAbsent(resolvedFormalOutput, '正式 Casebook 输出');
    atomicRenameNoReplace(temporary, resolvedFormalOutput);
    publication.formal_created = true;
    publication.state = 'renamed_pending_commit';
    const renamed = stableRegularFileSnapshot(resolvedFormalOutput, '正式 Casebook rename 结果');
    if (!regularFileIdentityMatches(renamed, staged) || renamed.nlink !== 1n) {
      throw new Error('正式 Casebook rename 后身份、权限、内容或 link count 漂移');
    }
    if (testFaultEnabled('QBOT_CASEBOOK_TEST_REPLACE_FORMAL_BEFORE_ROLLBACK')) {
      const displacedFormal = `${resolvedFormalOutput}.transaction-owned`;
      atomicRenameNoReplace(resolvedFormalOutput, displacedFormal);
      await fs.writeFile(resolvedFormalOutput, 'third-party-formal', { mode: 0o600, flag: 'wx' });
      publication.displaced_formal = displacedFormal;
      throw new Error('fault_injected_formal_replaced_before_rollback');
    }
    if (testFaultEnabled('QBOT_CASEBOOK_FAULT_AFTER_FORMAL_RENAME')) {
      throw new Error('fault_injected_after_formal_rename');
    }
    fsyncDirectory(parentGuard.path, parentGuard);
    publication.state = 'parent_synced';
    if (testFaultEnabled('QBOT_CASEBOOK_FAULT_AFTER_FORMAL_PARENT_FSYNC')) {
      throw new Error('fault_injected_after_formal_parent_fsync');
    }
    assertSecureDirectoryGuard(parentGuard, '正式 Casebook 输出父目录');
    const published = stableRegularFileSnapshot(resolvedFormalOutput, '正式 Casebook');
    const publishedStat = fsSync.lstatSync(resolvedFormalOutput, { bigint: true });
    if (published.sha256 !== artifact.sha256 || published.size !== artifact.size
      || published.dev !== staged.dev || published.ino !== staged.ino
      || published.uid !== staged.uid || published.permissions !== staged.permissions
      || Number(publishedStat.mode & 0o777n) !== 0o600 || publishedStat.nlink !== 1n) {
      throw new Error('正式 Casebook 原子发布后字节或 SHA-256 漂移');
    }
    publication.state = 'verified_pending_commit';
    if (testFaultEnabled('QBOT_CASEBOOK_FAULT_AFTER_FORMAL_FINAL_VERIFY')) {
      throw new Error('fault_injected_after_formal_final_verify');
    }
    publication.state = 'committed';
    publication.committed = true;
  } catch (error) {
    failure = error;
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch (error) {
        if (!failure) failure = error;
      }
    }
  }
  if (failure) {
    let formalRollback;
    if (publication.formal_created) {
      formalRollback = await guardedRollbackAttempt(
        () => isolateAndRetainGuardedRegularFile({
          target: resolvedFormalOutput,
          guard: publication.temporary_guard,
          parentGuard,
          label: '正式 Casebook 发布回滚',
        }),
        resolvedFormalOutput,
      );
    } else {
      try {
        fsSync.lstatSync(resolvedFormalOutput);
        formalRollback = {
          status: 'rollback_conflict',
          preserved_path: resolvedFormalOutput,
          error: '正式目标已被非本事务对象抢占',
        };
      } catch (error) {
        formalRollback = error?.code === 'ENOENT'
          ? { status: 'absent', preserved_path: null }
          : { status: 'rollback_incomplete', preserved_path: resolvedFormalOutput, error: error?.message || String(error) };
      }
    }

    let temporaryGuard = publication.temporary_guard;
    if (!temporaryGuard && publication.temporary_open_guard) {
      try {
        const candidate = stableRegularFileSnapshot(
          temporary,
          '正式 Casebook staging 失败清理身份复核',
          { allowedLinkCounts: [1, 2] },
        );
        const opened = publication.temporary_open_guard;
        if (candidate.dev === opened.dev && candidate.ino === opened.ino
          && candidate.uid === opened.uid && candidate.permissions === opened.permissions) {
          temporaryGuard = candidate;
        }
      } catch {
        // Unknown or replaced temporary names are intentionally preserved.
      }
    }
    let temporaryRollback;
    if (temporaryGuard) {
      temporaryRollback = await guardedRollbackAttempt(
        () => isolateAndRetainGuardedRegularFile({
          target: temporary,
          guard: temporaryGuard,
          parentGuard,
          label: '正式 Casebook staging 失败清理',
        }),
        temporary,
      );
    } else {
      try {
        fsSync.lstatSync(temporary);
        temporaryRollback = {
          status: 'rollback_incomplete',
          preserved_path: temporary,
          error: '临时文件身份未建立，禁止按路径删除',
        };
      } catch (error) {
        temporaryRollback = error?.code === 'ENOENT'
          ? { status: 'absent', preserved_path: null }
          : { status: 'rollback_incomplete', preserved_path: temporary, error: error?.message || String(error) };
      }
    }
    publication.rollback = { formal: formalRollback, temporary: temporaryRollback };
    if ([formalRollback, temporaryRollback].some((item) => item.status === 'rollback_incomplete')) {
      publication.state = 'rollback_incomplete';
    } else if ([formalRollback, temporaryRollback].some((item) => item.status === 'rollback_conflict')) {
      publication.state = 'rollback_conflict';
    } else if ([formalRollback, temporaryRollback].some((item) => item.status === 'retained')) {
      publication.state = 'rollback_incomplete';
    } else {
      publication.state = 'rolled_back';
    }
    const wrapped = transactionFailure(failure, 'casebook_publication_transaction_state', publication);
    wrapped.publication_state = publication.state;
    wrapped.temporary_path = temporary;
    throw wrapped;
  }
  return {
    path: resolvedFormalOutput,
    bytes: artifact.size,
    sha256: artifact.sha256,
    state: publication.state,
    committed: publication.committed,
  };
}

export async function publishCasebookAfterRuntimeAudit({
  artifactFile,
  formalOutput,
  scopes,
  expectedArtifactSha256,
  expectedArtifactSize,
}) {
  const runtimeAudit = auditCasebookRuntimeScopes(scopes);
  const auditedArtifact = stableRegularFileSnapshot(artifactFile, 'runtime audit 绑定的 Casebook artifact');
  const expectedSha256 = asString(expectedArtifactSha256).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256) || auditedArtifact.sha256 !== expectedSha256
    || !Number.isSafeInteger(Number(expectedArtifactSize))
    || auditedArtifact.size !== Number(expectedArtifactSize)) {
    throw new Error(`runtime audit 与 Casebook artifact 字节绑定不一致：expected=${expectedSha256}/${expectedArtifactSize} actual=${auditedArtifact.sha256}/${auditedArtifact.size}`);
  }
  await publishValidatedCasebookArtifact({
    artifactFile,
    formalOutput,
    expectedArtifactSha256: expectedSha256,
    expectedArtifactSize: Number(expectedArtifactSize),
  });
  return runtimeAudit;
}

function exportedCasebookScopes(workbook) {
  return Object.fromEntries([
    '核心生命线门禁',
    '新增MR核心冒烟',
    '生产灰度门禁Case',
    '全量功能回归Case',
  ].map((sheetName) => {
    const values = workbook.worksheets.getItem(sheetName).getUsedRange()?.values || [];
    return [sheetName, sourceCases(values).cases];
  }));
}

async function verifyWorkbook(workbook, outputDir, sheetNames) {
  const verificationDir = path.join(outputDir, 'workbook-verification');
  const renderDir = path.join(verificationDir, 'renders');
  await fs.mkdir(renderDir, { recursive: true });
  const actualSheetNames = [];
  for (let index = 0; ; index += 1) {
    let sheet;
    try { sheet = workbook.worksheets.getItemAt(index); } catch { break; }
    if (!sheet) break;
    actualSheetNames.push(asString(sheet.name));
  }
  if (JSON.stringify(actualSheetNames) !== JSON.stringify(sheetNames)) {
    throw new Error(`导出后 Sheet 顺序漂移：expected=${JSON.stringify(sheetNames)} actual=${JSON.stringify(actualSheetNames)}`);
  }
  const inspections = [];
  const inspectionScopes = [
    { sheetName: '核心生命线门禁', rowCount: 20, lastColumn: 'AO' },
    { sheetName: '新增MR核心冒烟', rowCount: 14, lastColumn: 'AM' },
    { sheetName: '生产灰度门禁Case', rowCount: 74, lastColumn: 'AO' },
    { sheetName: '全量功能回归Case', rowCount: 164, lastColumn: 'AO' },
    { sheetName: '近2天MR覆盖', rowCount: EXPECTED_TOTAL_MR_COUNT + 4, lastColumn: 'K' },
    { sheetName: '源码依据', rowCount: 20, lastColumn: 'D' },
  ];
  for (const { sheetName, rowCount, lastColumn } of inspectionScopes) {
    const result = await workbook.inspect({
      kind: 'table',
      range: `${sheetName}!A1:${lastColumn}${rowCount}`,
      include: 'values,formulas',
      tableMaxRows: 10,
      tableMaxCols: 12,
      maxChars: 8000,
    });
    inspections.push(`# ${sheetName}\n${result.ndjson}`);
  }
  const formulaErrors = await workbook.inspect({
    kind: 'match',
    searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
    options: { useRegex: true, maxResults: 300 },
    summary: 'final formula error scan',
  });
  inspections.push(`# Formula errors\n${formulaErrors.ndjson}`);
  await fs.writeFile(path.join(verificationDir, 'inspection.ndjson'), `${inspections.join('\n')}\n`);
  if (/^\s*\{"kind":"match"/mu.test(formulaErrors.ndjson)) {
    throw new Error(`导出后 Casebook 存在公式错误：${formulaErrors.ndjson}`);
  }

  const rendered = [];
  for (const sheetName of sheetNames) {
    const largeCaseSheet = ['核心生命线门禁', '新增MR核心冒烟', '生产灰度门禁Case', '全量功能回归Case'].includes(sheetName);
    const preview = await workbook.render({
      sheetName,
      ...(largeCaseSheet ? { range: 'A1:AO12' } : { autoCrop: 'all' }),
      scale: largeCaseSheet ? 0.55 : 0.8,
      format: 'png',
    });
    const file = path.join(renderDir, `${String(rendered.length + 1).padStart(2, '0')}-${sheetName}.png`);
    await fs.writeFile(file, new Uint8Array(await preview.arrayBuffer()));
    rendered.push(file);
  }
  const gateSheet = workbook.worksheets.getItem('生产灰度门禁Case');
  const gateValues = gateSheet.getUsedRange()?.values || [];
  const expertCaseIndex = gateValues.findIndex((row) => asString(row?.[0]).trim() === 'BETA-EXPERT-012');
  if (expertCaseIndex < 0) throw new Error('导出后生产灰度门禁Case缺少 BETA-EXPERT-012');
  const expertCaseRow = expertCaseIndex + 1;
  const expertCasePreview = await workbook.render({
    sheetName: '生产灰度门禁Case',
    range: `A${Math.max(1, expertCaseRow - 2)}:AO${Math.min(gateValues.length, expertCaseRow + 3)}`,
    scale: 0.75,
    format: 'png',
  });
  const expertCaseFile = path.join(renderDir, '15-BETA-EXPERT-012-focused.png');
  await fs.writeFile(expertCaseFile, new Uint8Array(await expertCasePreview.arrayBuffer()));
  rendered.push(expertCaseFile);
  return {
    sheet_names: actualSheetNames,
    formula_error_count: 0,
    expert_case_row: expertCaseRow,
    inspection_file: path.join(verificationDir, 'inspection.ndjson'),
    rendered,
  };
}

async function main() {
  const outputTransaction = await prepareCasebookOutputDirectory(option('out'));
  const outputDir = outputTransaction.staging;
  try {
    await assertCasebookOutputAbsent(FORMAL_OUTPUT);
  if (sha256File(PREVIOUS_CASEBOOK) !== PREVIOUS_CASEBOOK_SHA256) {
    throw new Error(`r12 Casebook SHA-256 漂移：${sha256File(PREVIOUS_CASEBOOK)}`);
  }
  const releaseIntake = await loadReleaseIntake();
  PRODUCT_COMMIT = releaseIntake.report.release.head;
  MR_WINDOW_START = releaseIntake.report.scan_boundary.baseline_commit;
  MR_WINDOW_END = releaseIntake.report.scan_boundary.window_end;
  RECENT_MR_APPEND = Object.freeze(releaseIntake.rows);
  if (RECENT_MR_APPEND.at(-1)?.commit !== PRODUCT_COMMIT) {
    throw new Error(`最新增量MR终点必须等于产品设计基线：${RECENT_MR_APPEND.at(-1)?.commit}`);
  }
  const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(SOURCE));
  const sourceValues = sourceWorkbook.worksheets.getItem('核心内测Case').getRange('A1:AO188').values;
  const { headers, cases: allCases } = sourceCases(sourceValues);
  const smokeSourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(SMOKE_SOURCE));
  const smokeSourceValues = smokeSourceWorkbook.worksheets.getItem('新增MR核心冒烟').getUsedRange().values;
  const { headers: smokeHeaders, cases: rawSmokeCases } = sourceCases(smokeSourceValues);
  const smokeById = new Map(rawSmokeCases.map((testCase) => [asString(testCase['用例ID']), testCase]));
  const smokeCases = SMOKE_CASE_IDS.map((id) => {
    const testCase = smokeById.get(id) || (id === 'MRSMOKE-CHART-001'
      ? { ...smokeById.get('MRSMOKE-WEB-001'), '用例ID': id }
      : null);
    if (!testCase) throw new Error(`新增MR核心冒烟源数据缺失：${id}`);
    return patchSmokeCase(testCase);
  });
  if (rawSmokeCases.length !== 11 || smokeById.size !== 11 || smokeCases.length !== 12) {
    throw new Error(`新增MR核心冒烟必须由11条历史源加1条交互图表组成且ID唯一，actual=${rawSmokeCases.length}/${smokeById.size}/${smokeCases.length}`);
  }
  const gateCoreCases = orderCases(allCases
    .map(patchRecentCases)
    .filter((testCase) => capability(testCase).directlyRunnable)
    .filter((testCase) => ![...FULL_ONLY_NATIVE_CASE_REPLACEMENTS.values()]
      .includes(asString(testCase['用例ID'])))
    .filter((testCase) => !EXCLUDED_ACCOUNT_CASES.has(asString(testCase['用例ID'])))
    .filter((testCase) => !PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS.has(asString(testCase['用例ID']))));
  const allCasesById = new Map(allCases.map((testCase) => [asString(testCase['用例ID']), testCase]));
  const fullFunctionPool = (await loadFullFunctionLegacyCases()).map((testCase) => {
    const replacementId = FULL_ONLY_NATIVE_CASE_REPLACEMENTS.get(asString(testCase['用例ID']));
    if (!replacementId) return patchFullFunctionRecentCase(testCase);
    const replacement = allCasesById.get(replacementId);
    if (!replacement) throw new Error(`全量功能回归原生替换Case缺失：${replacementId}`);
    return patchRecentCases(replacement);
  });
  const fullFunctionById = new Map(fullFunctionPool.map((testCase) => [asString(testCase['用例ID']), testCase]));
  const gatePromotions = [...PRODUCTION_GRAY_PROMOTED_LEGACY_CASE_IDS].map((id) => {
    const testCase = fullFunctionById.get(id);
    if (!testCase) throw new Error(`门禁正常功能替补缺失：${id}`);
    return testCase;
  });
  const gateCases = [...gateCoreCases, ...gatePromotions];
  const gateById = new Map(gateCases.map((testCase) => [asString(testCase['用例ID']), testCase]));
  const coreLifelineCases = CORE_LIFELINE_CASE_IDS.map((id) => gateById.get(id));
  if (coreLifelineCases.some((testCase) => !testCase)) {
    const missing = CORE_LIFELINE_CASE_IDS.filter((id) => !gateById.has(id));
    throw new Error(`核心生命线 Case 缺失：${missing.join(',')}`);
  }
  if (coreLifelineCases.length !== 16) {
    throw new Error(`核心生命线门禁必须恰好16条，actual=${coreLifelineCases.length}`);
  }
  const regressionAddons = fullFunctionPool.filter(
    (testCase) => !PRODUCTION_GRAY_PROMOTED_LEGACY_CASE_IDS.has(asString(testCase['用例ID'])),
  );
  const fullCases = [...gateCases, ...regressionAddons];
  if (gateCoreCases.length !== 65) throw new Error(`剔除低频恢复/账号切换后原生门禁必须恰好65条，actual=${gateCoreCases.length}`);
  if (gatePromotions.length !== 5) throw new Error(`门禁正常功能替补必须恰好5条，actual=${gatePromotions.length}`);
  if (fullFunctionPool.length !== 95) throw new Error(`正常功能池必须恰好95条，actual=${fullFunctionPool.length}`);
  if (gateCases.length !== 70) throw new Error(`新版门禁必须恰好70条，actual=${gateCases.length}`);
  if (regressionAddons.length !== 90) throw new Error(`全量功能增量必须恰好90条，actual=${regressionAddons.length}`);
  if (fullCases.length !== 160) throw new Error(`全量功能回归必须恰好160条，actual=${fullCases.length}`);
  const gateIds = gateCases.map((testCase) => asString(testCase['用例ID']));
  const fullIds = fullCases.map((testCase) => asString(testCase['用例ID']));
  if (new Set(fullIds).size !== fullIds.length) throw new Error('全量功能回归Case ID重复');
  if (JSON.stringify(fullIds.slice(0, 70)) !== JSON.stringify(gateIds)) {
    throw new Error('全量功能回归前70条必须与生产灰度门禁顺序完全一致');
  }
  for (const [legacyId, nativeId] of FULL_ONLY_NATIVE_CASE_REPLACEMENTS) {
    if (gateIds.includes(nativeId)
      || !fullIds.includes(nativeId)
      || fullIds.includes(legacyId)
      || !regressionAddons.some((testCase) => asString(testCase['用例ID']) === nativeId)) {
      throw new Error(`全量功能原生替换合同漂移：G3不得包含${nativeId}，G4增量必须以${nativeId}替换${legacyId}`);
    }
  }
  for (const id of PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS) {
    if (gateIds.includes(id) || fullIds.includes(id)) {
      throw new Error(`低频恢复/故障注入Case不得进入正式70/160：${id}`);
    }
  }
  const gateIdSet = new Set(gateIds);
  const fullIdSet = new Set(fullIds);
  const smokeIdSet = new Set(SMOKE_CASE_IDS);
  const smokeCapability = capabilitySet(smokeCases);
  const coreLifelineCapability = capabilitySet(coreLifelineCases);
  const gateCapability = capabilitySet(gateCases);
  const addonCapability = capabilitySet(regressionAddons);
  const fullCapability = capabilitySet(fullCases);
  for (const [scope, summary] of [['16条核心生命线', coreLifelineCapability], ['12条冒烟', smokeCapability], ['70条门禁', gateCapability], ['160条全量', fullCapability]]) {
    if (summary.strict.length) {
      throw new Error(`${scope}仍含strict controller：${summary.strict.map((item) => item.testCase['用例ID']).join(',')}`);
    }
    if (summary.unsupported.length) {
      throw new Error(`${scope}仍含unsupported runtime：${summary.unsupported.map((item) => item.testCase['用例ID']).join(',')}`);
    }
  }
  const incrementalMrRows = RECENT_MR_APPEND.map((mr) => {
    const r13Contract = R13_INCREMENTAL_MR_CONTRACTS.get(String(mr.mr || ''));
    if (!r13Contract) throw new Error(`r13 增量 MR !${mr.mr} 缺少覆盖合同`);
    const staticAudit = RECENT_MR_STATIC_AUDITS.get(String(mr.mr || '')) || mr.intakeStaticAudit;
    const mappings = (staticAudit ? [] : mrMapping(mr)).filter((id) => smokeIdSet.has(id) || gateIdSet.has(id) || fullIdSet.has(id));
    const area = mrArea(mr);
    const desktopRelevant = mappings.length > 0;
    const smokeMappings = mappings.filter((id) => smokeIdSet.has(id));
    const gateMappings = mappings.filter((id) => gateIdSet.has(id));
    const fullMappings = mappings.filter((id) => fullIdSet.has(id) && !gateIdSet.has(id));
    if (staticAudit?.expectedFiles && !sameFileSet(staticAudit.expectedFiles, mr.files)) {
      throw new Error(`MR !${mr.mr}静态审计文件漂移：expected=${staticAudit.expectedFiles.join(',')} actual=${mr.files.join(',')}`);
    }
    if (mr.intakeIncrement && !staticAudit && mappings.length === 0) {
      throw new Error(`增量产品 MR !${mr.mr} 未映射到任何16/12/70/160真实Case`);
    }
    const layers = unique([
      smokeMappings.length ? '12条冒烟' : '',
      gateMappings.length ? '70条门禁' : '',
      fullMappings.length ? '160条增量' : '',
    ]);
    return [
      mr.mergedAt.replace('T', ' ').slice(0, 19),
      mr.mr ? `!${mr.mr}` : '',
      mr.commit.slice(0, 12),
      mr.branch,
      area,
      mr.files.slice(0, 8).join('\n'),
      mappings.join(','),
      layers.join('+') || '静态合同审计',
      r13Contract.coverageStrength,
      desktopRelevant ? '纳入当前框架可执行Case' : (staticAudit?.disposition || 'Dashboard/CI/设计/发布工程变更不冒充桌面QWork E2E'),
      r13Contract.reason,
    ];
  });
  const previousMrRows = await previousCasebookMrRows();
  const mrRows = [...incrementalMrRows].reverse().concat(previousMrRows);
  if (mrRows.length !== EXPECTED_TOTAL_MR_COUNT) throw new Error(`本窗口直接合入MR必须恰好${EXPECTED_TOTAL_MR_COUNT}个，actual=${mrRows.length}`);
  if (new Set(mrRows.map((row) => asString(row[1]))).size !== EXPECTED_TOTAL_MR_COUNT
    || new Set(mrRows.map((row) => asString(row[2]))).size !== EXPECTED_TOTAL_MR_COUNT) {
    throw new Error('完整 MR 审计链存在重复 IID 或 merge commit');
  }
  assertR13CasebookLayering({
    gateIds,
    fullIds,
    regressionAddonIds: regressionAddons.map((testCase) => asString(testCase['用例ID'])),
    mrRows,
  });
  for (const [iid, contract] of R13_INCREMENTAL_MR_CONTRACTS) {
    const row = mrRows.find((item) => item[1] === `!${iid}`);
    const expectedCases = contract.caseIds.join(',');
    if (!row || row[6] !== expectedCases || row[8] !== contract.coverageStrength || row[10] !== contract.reason) {
      throw new Error(`r13 MR !${iid} 映射或理由未精确采用显式合同：${JSON.stringify(row)}`);
    }
    if (contract.staticOnly) {
      if (row[7] !== '静态合同审计' || row[8] !== '静态合同' || !/不新增|不冒充/.test(row[9])) {
        throw new Error(`r13 MR !${iid} 必须保持静态合同审计：${JSON.stringify(row)}`);
      }
    } else if (!row[7] || row[7] === '静态合同审计') {
      throw new Error(`r13 产品 MR !${iid} 必须映射真实 Case 层级：${JSON.stringify(row)}`);
    }
  }
  for (const iid of ['1459', '1462', '1463', '1464', '1468', '1469', '1454', '1458', '1473', '1461', '1475', '1460', '1477', '1474', '1496', '1498', '1485', '1506', '1497', '1514', '1524']) {
    const row = mrRows.find((item) => item[1] === `!${iid}`);
    if (!row || row[6] !== '' || row[7] !== '静态合同审计' || row[8] !== '静态合同' || !/不新增|不冒充/.test(row[9])) {
      throw new Error(`MR !${iid}必须保持静态合同审计且不冒充桌面E2E：${JSON.stringify(row)}`);
    }
  }
  const mr1520 = mrRows.find((row) => row[1] === '!1520');
  if (!mr1520 || !/BETA-INIT-001/.test(mr1520[6]) || !/BETA-HOST-003/.test(mr1520[6]) || !/SIT-TEAMS-NEW-001/.test(mr1520[6])) {
    throw new Error(`MR !1520必须覆盖运行时初始化、宿主身份和Teams Tab恢复：${JSON.stringify(mr1520)}`);
  }
  const mr1516 = mrRows.find((row) => row[1] === '!1516');
  const mr1516Expected = 'MRSMOKE-FAIL-001,MRSMOKE-ROUTE-001,BETA-CHAT-005,BETA-PERF-003';
  if (!mr1516 || mr1516[6] !== mr1516Expected || mr1516[7] !== '12条冒烟+70条门禁') {
    throw new Error(`MR !1516必须精确覆盖VPN失败提示、路由恢复和长文本收敛：${JSON.stringify(mr1516)}`);
  }
  const mr1526 = mrRows.find((row) => row[1] === '!1526');
  const mr1526Expected = 'MRSMOKE-SKILL-001,MRSMOKE-FAIL-001,BETA-CHAT-006,BETA-PERF-003';
  if (!mr1526 || mr1526[6] !== mr1526Expected || mr1526[7] !== '12条冒烟+70条门禁') {
    throw new Error(`MR !1526必须精确覆盖Skill原生判定、连接器失败恢复与中断/长文本布局：${JSON.stringify(mr1526)}`);
  }
  const mr1523 = mrRows.find((row) => row[1] === '!1523');
  const mr1523Expected = 'MRSMOKE-WEB-001,MRSMOKE-WEB-002,BETA-CHAT-005,SIT-CONN-019';
  if (!mr1523 || mr1523[6] !== mr1523Expected || mr1523[7] !== '12条冒烟+70条门禁+160条增量'
    || mr1523[8] !== '直接E2E' || !/同一task四轮真实provider调用/.test(mr1523[10])) {
    throw new Error(`MR !1523必须精确覆盖四轮Web搜索、SSRF和连续会话：${JSON.stringify(mr1523)}`);
  }
  const mr1522 = mrRows.find((row) => row[1] === '!1522');
  const mr1522Expected = 'MRSMOKE-ROUTE-001,BETA-CHAT-001,BETA-ROUTE-001,BETA-HOST-003';
  if (!mr1522 || mr1522[6] !== mr1522Expected || mr1522[7] !== '12条冒烟+70条门禁'
    || mr1522[8] !== '相邻回归+源码合同'
    || !/Header 字节由源码静态合同审计/.test(mr1522[10]) || !/不声称UI证明Header注入/.test(mr1522[10])) {
    throw new Error(`MR !1522必须区分Header源码静态审计与桌面连续性验证：${JSON.stringify(mr1522)}`);
  }
  const mr1511 = mrRows.find((row) => row[1] === '!1511');
  const mr1511Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1511').caseIds.join(',');
  if (!mr1511 || mr1511[6] !== mr1511Expected || mr1511[7] !== '12条冒烟+70条门禁+160条增量'
    || !/已发布 Expert 进入上下文维护任务/.test(mr1511[10])
    || !/BETA-EXPERT-012 必须增强/.test(mr1511[10])) {
    throw new Error(`MR !1511必须精确映射专家维护任务的身份、任务、能力与重开链：${JSON.stringify(mr1511)}`);
  }
  const mr1552 = mrRows.find((row) => row[1] === '!1552');
  const mr1552Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1552').caseIds.join(',');
  if (!mr1552 || mr1552[6] !== mr1552Expected || mr1552[7] !== '12条冒烟+70条门禁+160条增量'
    || !/controller heartbeat 隔离/.test(mr1552[10])
    || !/不得声称已直接证明 heartbeat 隔离/.test(mr1552[10])) {
    throw new Error(`MR !1552必须精确映射执行runner隔离、失败、并发与宿主稳定链：${JSON.stringify(mr1552)}`);
  }
  const mr1558 = mrRows.find((row) => row[1] === '!1558');
  const mr1558Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1558').caseIds.join(',');
  if (!mr1558 || mr1558[6] !== mr1558Expected || mr1558[7] !== '12条冒烟+70条门禁'
    || mr1558[8] !== '相邻回归+源码合同'
    || !/trim\+大小写等价键去重/.test(mr1558[10])
    || !/Composer 菜单不误删/.test(mr1558[10])
    || !/不代表 collision 分支已由桌面执行或通过/.test(mr1558[10])) {
    throw new Error(`MR !1558必须精确映射设置模型去重与Composer路由双表面：${JSON.stringify(mr1558)}`);
  }
  const mr1557 = mrRows.find((row) => row[1] === '!1557');
  const mr1557Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1557').caseIds.join(',');
  if (!mr1557 || mr1557[6] !== mr1557Expected || mr1557[7] !== '12条冒烟+70条门禁+160条增量'
    || mr1557[8] !== '相邻回归+源码合同'
    || !/deepbankv2-mr-1557-immediate-regenerate-projection\/v1/.test(mr1557[10])
    || !/即时占位\/重开语义/.test(mr1557[10])
    || !/claim_scope=source_and_test_declarations/.test(mr1557[10])
    || !/test_execution_attested=false/.test(mr1557[10])
    || !/不把源码声明冒充产品测试执行结果/.test(mr1557[10])) {
    throw new Error(`MR !1557必须区分真实桌面重新生成链与源码声明边界：${JSON.stringify(mr1557)}`);
  }
  const mr1561 = mrRows.find((row) => row[1] === '!1561');
  const mr1561Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1561').caseIds.join(',');
  if (!mr1561 || mr1561[6] !== mr1561Expected || mr1561[7] !== '12条冒烟+70条门禁'
    || mr1561[8] !== '相邻回归+源码合同'
    || !/32 MiB/.test(mr1561[10])
    || !/不声称桌面 E2E 已直接构造或验证 32 MiB 协议边界/.test(mr1561[10])) {
    throw new Error(`MR !1561必须区分worker envelope源码静态合同与桌面连续性回归：${JSON.stringify(mr1561)}`);
  }
  const mr1560 = mrRows.find((row) => row[1] === '!1560');
  const mr1560Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1560').caseIds.join(',');
  if (!mr1560 || mr1560[6] !== mr1560Expected || mr1560[7] !== '12条冒烟+70条门禁'
    || mr1560[8] !== '相邻回归+源码合同'
    || !/10 秒\/100 毫秒/.test(mr1560[10])
    || !/不 refresh、不 re-accept/.test(mr1560[10])
    || !/不声称桌面 E2E 已确定性制造冷模型权威竞争窗口/.test(mr1560[10])) {
    throw new Error(`MR !1560必须区分turn authority readiness源码静态合同与桌面连续性回归：${JSON.stringify(mr1560)}`);
  }
  const mr1564 = mrRows.find((row) => row[1] === '!1564');
  const mr1564Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1564').caseIds.join(',');
  if (!mr1564 || mr1564[6] !== mr1564Expected || mr1564[7] !== '12条冒烟+70条门禁'
    || mr1564[8] !== '相邻回归'
    || !/真实可见入口召唤专家构建师/.test(mr1564[10])
    || !/工具结果精确绑定 draft\/revision\/summary\/persona/.test(mr1564[10])
    || !/不把模型偶然识别工具或源码测试声明冒充桌面 E2E 直接证明/.test(mr1564[10])) {
    throw new Error(`MR !1564必须映射专家构建师真实工具闭环并限制内部提示词声明：${JSON.stringify(mr1564)}`);
  }
  const mr1563 = mrRows.find((row) => row[1] === '!1563');
  const mr1563Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1563').caseIds.join(',');
  if (!mr1563 || mr1563[6] !== mr1563Expected || mr1563[7] !== '12条冒烟+70条门禁'
    || mr1563[8] !== '相邻回归'
    || !/reasoning\.active/.test(mr1563[10])
    || !/worker-host 事件接线/.test(mr1563[10])
    || !/不能冒充专用 runtime-tail fixture/.test(mr1563[10])) {
    throw new Error(`MR !1563必须映射runtime-tail用户链并限制源码内部接线声明：${JSON.stringify(mr1563)}`);
  }
  const mr1566 = mrRows.find((row) => row[1] === '!1566');
  const mr1566Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1566').caseIds.join(',');
  if (!mr1566 || mr1566[6] !== mr1566Expected || mr1566[7] !== '12条冒烟+70条门禁'
    || mr1566[8] !== '相邻回归'
    || !/ordinaryStallMs=300000/.test(mr1566[10])
    || !/不人为制造五分钟无语义进展/.test(mr1566[10])
    || !/不把自然等待或单元测试声明冒充确定性桌面阈值验证/.test(mr1566[10])) {
    throw new Error(`MR !1566必须映射长时任务用户链并限制五分钟阈值声明：${JSON.stringify(mr1566)}`);
  }
  const mr1568 = mrRows.find((row) => row[1] === '!1568');
  const mr1568Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1568').caseIds.join(',');
  if (!mr1568 || mr1568[6] !== mr1568Expected || mr1568[8] !== '直接E2E'
    || !/真实编辑已发送用户消息/.test(mr1568[10])
    || !/真实点击重新生成/.test(mr1568[10])
    || !/历史保持/.test(mr1568[10])
    || !/不使用通用路径映射代替专项断言/.test(mr1568[10])) {
    throw new Error(`MR !1568必须精确映射编辑、重新生成与历史保持专项E2E：${JSON.stringify(mr1568)}`);
  }
  const mr1569 = mrRows.find((row) => row[1] === '!1569');
  const mr1569Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1569').caseIds.join(',');
  if (!mr1569 || mr1569[6] !== mr1569Expected || mr1569[8] !== '相邻回归'
    || !/Composer 可用/.test(mr1569[10])
    || !/上下文窗口组件隐藏/.test(mr1569[10])
    || !/未设置该组件不存在的专项 DOM Oracle/.test(mr1569[10])
    || !/不得声称已直接 E2E 证明隐藏行为/.test(mr1569[10])) {
    throw new Error(`MR !1569必须精确映射Composer相邻链并限制隐藏组件声明：${JSON.stringify(mr1569)}`);
  }
  const mr1570 = mrRows.find((row) => row[1] === '!1570');
  const mr1570Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1570').caseIds.join(',');
  if (!mr1570 || mr1570[6] !== mr1570Expected || mr1570[8] !== '相邻回归'
    || !/Claude 多轮/.test(mr1570[10])
    || !/turn-end/.test(mr1570[10])
    || !/context usage normalization/.test(mr1570[10])
    || !/桌面证据不得冒充内部调度源码合同/.test(mr1570[10])) {
    throw new Error(`MR !1570必须精确映射turn-end连续性并限制内部调度声明：${JSON.stringify(mr1570)}`);
  }
  const mr1572 = mrRows.find((row) => row[1] === '!1572');
  const mr1572Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1572').caseIds.join(',');
  if (!mr1572 || mr1572[6] !== mr1572Expected || mr1572[8] !== '相邻回归'
    || !/runtime tail 可见状态/.test(mr1572[10])
    || !/tail copy、pulse 样式/.test(mr1572[10])
    || !/无确定性 copy\/pulse 专项桌面 Oracle/.test(mr1572[10])
    || !/不把普通完成态或截图冒充直接 E2E 证明/.test(mr1572[10])) {
    throw new Error(`MR !1572必须精确映射runtime-tail文案与pulse相邻链并限制直接覆盖声明：${JSON.stringify(mr1572)}`);
  }
  const mr1573 = mrRows.find((row) => row[1] === '!1573');
  const mr1573Expected = R13_INCREMENTAL_MR_CONTRACTS.get('1573').caseIds.join(',');
  if (!mr1573 || mr1573[6] !== mr1573Expected || mr1573[7] !== '12条冒烟+70条门禁+160条增量'
    || mr1573[8] !== '相邻回归+源码合同'
    || !/记忆首会话\/跨会话连续性/.test(mr1573[10])
    || !/deepbankv2-mr-1573-memory-session-profile-stability\/v1/.test(mr1573[10])
    || !/claim_scope=source_and_test_declarations/.test(mr1573[10])
    || !/test_execution_attested=false/.test(mr1573[10])
    || !/禁止把相邻主链通过冒充这些内部合同已执行或通过/.test(mr1573[10])) {
    throw new Error(`MR !1573必须区分Memory/Profile桌面相邻链与非执行态源码合同：${JSON.stringify(mr1573)}`);
  }
  for (const row of mrRows) {
    const iid = asString(row[1]).replace(/^!/, '');
    const strength = asString(row[8]);
    if (!COVERAGE_STRENGTHS.has(strength)) {
      throw new Error(`MR !${iid} 覆盖强度非法：${strength}`);
    }
    if (strength === '静态合同' && (asString(row[6]) || row[7] !== '静态合同审计')) {
      throw new Error(`MR !${iid} 静态合同不得映射桌面 Case：${JSON.stringify(row)}`);
    }
    if (strength === '相邻回归+源码合同' && !REQUIRED_SOURCE_CONTRACTS_BY_MR.has(iid)) {
      throw new Error(`MR !${iid} 相邻回归+源码合同缺少 required source contract`);
    }
    if (['相邻回归', '相邻回归+源码合同'].includes(strength) && !asString(row[6])) {
      throw new Error(`MR !${iid} ${strength} 缺少桌面相邻 Case 映射`);
    }
    if (strength === '直接E2E') {
      const directCases = DIRECT_E2E_MR_CASE_CONTRACTS.get(iid);
      if (!directCases || row[6] !== directCases.join(',')) {
        throw new Error(`MR !${iid} 直接E2E 未精确命中显式 MR→Case 白名单：${JSON.stringify(row)}`);
      }
    }
  }
  const omitted = allCases.filter((testCase) => !gateIdSet.has(asString(testCase['用例ID'])));
  const replacementAudit = allCases.filter((testCase) => REPLACED_CASES.has(asString(testCase['用例ID'])));
  const deletionRows = [...omitted, ...replacementAudit].map((testCase) => {
    const cap = capability(testCase);
    const [kind, reason] = deletionReason(testCase, cap);
    const id = asString(testCase['用例ID']);
    return [
      id,
      asString(testCase['产品模块']),
      asString(testCase['测试场景']),
      cap.class,
      asString(cap.scenario?.fixture_control),
      kind,
      reason,
      REPLACED_CASES.has(id) ? `同ID新场景：${gateCases.find((item) => item['用例ID'] === id)?.['测试场景'] || ''}` : '',
    ];
  });
  for (const id of FULL_REGRESSION_EXCLUDED_LEGACY_IDS) {
    const reason = id === 'SIT-TEAMS-DOC-001'
      ? '权限/账号态依赖的低频Teams文档场景，按要求从常规功能回归移除。'
      : '网络异常、连接恢复或纯故障注入场景，按要求从常规功能回归移除。';
    deletionRows.push([id, '历史SIT', id, 'legacy excluded', '不适用', '全量回归低频场景删除', reason, '由正常主路径Case覆盖']);
  }
  const byDomain = new Map();
  const byType = new Map();
  for (const [scope, cases] of [['门禁70', gateCases], ['全量160', fullCases]]) {
    for (const testCase of cases) {
      const domainKey = `${scope}\u0000${asString(testCase['核心域'])}`;
      const typeKey = `${scope}\u0000${asString(testCase['用例类型'])}`;
      byDomain.set(domainKey, (byDomain.get(domainKey) || 0) + 1);
      byType.set(typeKey, (byType.get(typeKey) || 0) + 1);
    }
  }
  const workbook = Workbook.create();
  const coreLifelineSheet = addSheet(
    workbook,
    '核心生命线门禁',
    'QWork 发布候选核心生命线门禁 Casebook（16条）',
    `基线 ${PRODUCT_REF}@${PRODUCT_COMMIT}（v${PRODUCT_VERSION}）；每次候选部署必须先执行；16/16逐Case可信全绿才允许进入新增MR冒烟，任一非pass立即阻断后续阶段。`,
    headers,
    matrix(headers, coreLifelineCases),
    [120, 100, 115, 110, 60, 110, 300, 250, 280, 260, 340, 280, 280, 300, 330, 90, 70, 160, 270, 145, 180, 400, 350, 220, 400, 360, 170, 120, 80, 190, 180, 260, 220, 220, 70, 260, 260, 70, 320, 240, 250],
  );
  coreLifelineSheet.getRangeByIndexes(4, 4, coreLifelineCases.length, 1).format.fill = '#DDEBF7';
  const smokeSheet = addSheet(
    workbook,
    '新增MR核心冒烟',
    'QWork 最新 release/0.1 MR 核心冒烟自动化 Casebook（12条）',
    `基线 ${PRODUCT_REF}@${PRODUCT_COMMIT}（v${PRODUCT_VERSION}）；固定顺序12/12可执行、可分发、可直接运行；只承担新增MR核心冒烟，不替代70/160发布门禁。`,
    smokeHeaders,
    matrix(smokeHeaders, smokeCases),
    [135, 70, 130, 130, 360, 360, 360, 460, 380, 380, 380, 360, 170, 80, 300, 230, 300, 420, 350, 100, 80, 160, 380, 150, 180, 220, 190, 240, 260, 90, 360, 300, 90, 360, 300, 480, 480, 520, 420],
  );
  smokeSheet.getRangeByIndexes(4, 1, smokeCases.length, 1).format.fill = '#E8F4F1';
  const gateSheet = addSheet(
    workbook,
    '生产灰度门禁Case',
    'QBot release/0.1 生产灰度发布门禁 Casebook（70条）',
    `基线 ${PRODUCT_REF}@${PRODUCT_COMMIT}（v${PRODUCT_VERSION}）；串行执行；70/70协议有效且运行时可分发；strict controller=0；unsupported runtime=0。`,
    headers,
    matrix(headers, gateCases),
    [120, 100, 115, 110, 60, 110, 300, 250, 280, 260, 340, 280, 280, 300, 330, 90, 70, 160, 270, 145, 180, 400, 350, 220, 400, 360, 170, 120, 80, 190, 180, 260, 220, 220, 70, 260, 260, 70, 320, 240, 250],
  );
  gateSheet.getRangeByIndexes(4, 4, gateCases.length, 1).format.fill = '#E8F4F1';
  const fullSheet = addSheet(
    workbook,
    '全量功能回归Case',
    'QBot release/0.1 全量正常功能回归 Casebook（160条）',
    `前70条与“生产灰度门禁Case”逐条同序一致，追加90条正常功能；160/160协议有效且运行时可分发；Case间永久串行；strict controller=0；unsupported runtime=0。`,
    headers,
    matrix(headers, fullCases),
    [120, 100, 115, 110, 60, 110, 300, 250, 280, 260, 340, 280, 280, 300, 330, 90, 70, 160, 270, 145, 180, 400, 350, 220, 400, 360, 170, 120, 80, 190, 180, 260, 220, 220, 70, 260, 260, 70, 320, 240, 250],
  );
  fullSheet.getRangeByIndexes(4, 4, fullCases.length, 1).format.fill = '#E8F4F1';
  fullSheet.getRangeByIndexes(4, 0, 70, headers.length).format.borders = {
    bottom: { style: 'medium', color: '#176B68' },
  };
  addSheet(workbook, '设计总览', 'QWork 分层止损与生产灰度测试设计总览', '先以16条核心生命线判断候选是否具备继续测试价值，再依次执行12条变更冒烟、70条生产风险门禁、160条全量回归和soak；阶段间只接受逐Case可信结论。',
    ['指标', '结果', '门禁含义', '证据'], [
      ['核心生命线门禁', 16, '每次候选部署首个真实Case阶段；任一非pass立即阻断后续阶段', '核心生命线门禁'],
      ['新增MR变更冒烟', 12, '核心生命线16/16可信全绿后执行', '新增MR核心冒烟'],
      ['生产灰度门禁', 70, '每轮完整串行，禁止Case间并发', '生产灰度门禁Case'],
      ['全量功能回归', 160, '同70条门禁前缀 + 90条正常功能增量', '全量功能回归Case'],
      ['门禁框架真实分发', '70/70', 'protocol/runtime dispatch=100%', '能力审计'],
      ['全量框架真实分发', '160/160', 'protocol/runtime dispatch=100%', '能力审计'],
      ['严格外部控制器', 0, '两层strict_controller_required=0', '能力审计'],
      ['不支持运行时', 0, '两层unsupported_runtime=0', '能力审计'],
      ['全量原生公开状态执行器', fullCapability.counts.runner_native || 0, 'QWork UI/bridge/CDP真实动作与读回', 'runner_native'],
      ['全量原生本机fixture选项', fullCapability.counts.runner_native_with_fixture_option || 0, '原生IME；pretest必须就绪', 'runner_native_with_fixture_option'],
      ['全量经语义复核旧执行器', fullCapability.counts.runner_legacy_verified || 0, '9条门禁映射 + 90条常规功能映射', 'runner_legacy_verified'],
      ['审计窗口直接合并MR', mrRows.length, '全部记录自动化映射或静态审计结论', '近2天MR覆盖'],
      ['全量回归排除', FULL_REGRESSION_EXCLUDED_LEGACY_IDS.size, '网络异常、账号/权限低频、纯故障注入不进入本套', '删除场景清单'],
      ['门禁低频恢复剔除', PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS.size, '从70条门禁及160条前缀同步删除', '删除场景清单'],
      ['全量准入', '至少1轮160/160', '候选release identity完整可信全绿', '生产灰度准入'],
      ['连续放行', '5轮70/70', '160轮的前70条可计其中一轮；任一阻塞/非pass/flaky归零', '生产灰度准入'],
      ['最终权限', '1%-5%受控生产灰度', '完成门禁不等于GA，仍需监控与回滚', '发布判定'],
    ], [180, 180, 520, 240]);
  const coverageSheet = addSheet(workbook, '覆盖矩阵', '70条门禁与160条全量覆盖矩阵', '按范围、核心域和Case类型统计，会话、附件、成果、Skill、专家、MCP、安全、模型和常规设置均纳入。',
    ['范围', '维度', '名称', '用例数', '占比'], [
      ...[...byDomain.entries()].map(([key, count]) => {
        const [scope, name] = key.split('\u0000');
        return [scope, '核心域', name, count, count / (scope === '门禁70' ? 70 : 160)];
      }),
      ...[...byType.entries()].map(([key, count]) => {
        const [scope, name] = key.split('\u0000');
        return [scope, '用例类型', name, count, count / (scope === '门禁70' ? 70 : 160)];
      }),
    ], [100, 100, 260, 100, 100]);
  coverageSheet.getRangeByIndexes(4, 4, byDomain.size + byType.size, 1).format.numberFormat = '0.0%';
  addSheet(workbook, '执行配置', '执行配置与串行规则', '正式轮的精确版本、Casebook SHA、框架commit和fixture选项必须在pretest冻结；READY才允许启动唯一runner。',
    ['参数', '固定值/要求', '阶段', '硬约束', '说明'], [
      ['core_lifeline_case_count', 16, 'G1/pretest/runner/trusted-review', '固定16且逐Case可信全绿', '首道真实部署门禁；失败后G2-G5保持NOT_STARTED'],
      ['gate_case_count', 70, 'pretest/runner/gray-gate', '固定70', '不得用scoped、inherited或synthetic补齐'],
      ['mr_smoke_case_count', 12, 'G2/pretest/runner/trusted-review', '固定12且顺序不可漂移', '只在G1通过后执行；不能替代生产灰度门禁'],
      ['full_case_count', 160, 'pretest/runner/full-regression', '固定160', '前70条必须与门禁逐条同序一致'],
      ['execution_policy', 'core-beta-v2-forced-serial', 'runner', '唯一runner；Case间并发=0', 'BETA-CHAT-008内部20任务仍属于单Case'],
      ['casebook', OUTPUT_NAME, 'pretest', '精确路径+Sheet+SHA-256', 'Casebook变化即新测试合同'],
      ['product_source', `${PRODUCT_REF}@${PRODUCT_COMMIT}`, '设计/复核', 'deepbankV2只读', `package.version=${PRODUCT_VERSION}`],
      ['host_identity', 'Teams/QWork每轮精确冻结', 'pretest', '版本、build、control plane全部一致', '当前最低Teams 5.3.0 / QWork 0.1.1'],
      ['fixture_options', 'native IME', 'pretest', '缺少所选Case能力则BLOCKED', '不允许运行中临时降级'],
      ['gray_gate_runs', 5, '发布判定', '同一release identity连续5轮', '任一非pass或flaky归零'],
      ['soak', '至少100任务+3次受管重启', '灰度前稳定性', '至少一个候选轮次完成', '独立soak证据，不伪装成普通Case'],
      ['stage_admission', 'trusted-review-only', 'G1→G5', '任一trusted非pass、证据缺失或身份漂移立即止损', 'raw passed/failed不得驱动下一阶段'],
      ['monitor_policy', 'read-only + self-healing', '执行期', 'framework/testcase issue冻结并自愈', '阶段内可完成安全诊断，但后续阶段不得启动'],
    ], [180, 360, 180, 320, 420]);
  const evidenceCounts = new Map();
  for (const [scope, cases] of [['核心16', coreLifelineCases], ['门禁70', gateCases], ['全量160', fullCases]]) {
    for (const testCase of cases) {
      for (const role of asString(testCase['证据角色']).split(',').map((item) => item.trim()).filter(Boolean)) {
        const key = `${scope}\u0000${role}`;
        evidenceCounts.set(key, (evidenceCounts.get(key) || 0) + 1);
      }
    }
  }
  addSheet(workbook, '证据与断言', '证据角色与硬断言', 'raw passed/failed不构成发布结论；manifest、动作收据、公开状态与业务Oracle必须同时成立。',
    ['范围', '证据角色', '覆盖Case数', '用途', '缺失处理'], [...evidenceCounts.entries()].map(([key, count]) => {
      const [scope, role] = key.split('\u0000');
      return [scope,
      role,
      count,
      /screenshot/.test(role) ? '用户可见动作前后状态' : /reply|prompt|transcript|task_id/.test(role) ? '任务与回复归属' : /trace|readback|snapshot|inventory|selection|event/.test(role) ? '机器状态/身份/工具读回' : '清理、路径或内容证据',
      'manifest incomplete；不得trusted_pass',
    ]; }), [100, 260, 110, 360, 300]);
  addSheet(workbook, '删除场景清单', '门禁收敛与全量回归排除场景', '网络异常、切换账号、受保护部署和纯故障注入按要求删除；没有真实执行器的场景禁止继续宣称“可执行”。',
    ['旧Case ID', '模块', '旧场景', '旧能力类别', 'Fixture/控制器', '处置分类', '处置理由', '替代'], deletionRows,
    [125, 120, 360, 190, 230, 160, 460, 420]);
  addSheet(workbook, '执行器映射', '160条Case执行器映射', '每条Case都绑定独立场景驱动、执行模式和fixture；两层正式批次都不允许额外排除。',
    ['范围', '序号', 'Case ID', '模块', '场景', '执行模式', '能力类别', 'Fixture', '来源/MR', '结论'], fullCapability.items.map(({ testCase, scenario, binding, class: capabilityClass }, index) => [
      index < 70 ? '门禁70+全量160' : '全量160增量', index + 1, testCase['用例ID'], testCase['产品模块'], testCase['测试场景'], binding.mode, capabilityClass, scenario.fixture_control, testCase['来源ID'], '必跑；框架支持',
    ]), [140, 70, 125, 120, 420, 140, 220, 220, 260, 180]);
  addSheet(workbook, '近2天MR覆盖', '最新release/0.1直接合并MR审计', `提交边界 ${MR_WINDOW_START} 至 ${PRODUCT_COMMIT}（扫描完成 ${MR_WINDOW_END}）；以GitLab API验证的first-parent直接合入${PRODUCT_REF}为准，共${mrRows.length}个merge commit。Dashboard/CI/eval/refactor/version-only变更保留静态合同审计，不冒充桌面E2E。`,
    ['合并时间', 'MR', 'Merge commit', '分支/主题', '领域', '主要变更文件', '映射Case', '覆盖层', '覆盖强度', '处置', '理由'], mrRows,
    [165, 70, 110, 300, 130, 360, 320, 160, 170, 260, 420]);
  addSheet(workbook, '生产灰度准入', '全量功能与生产灰度准入规则', '至少一轮完整160条可信全绿，并满足70条连续多轮与soak门禁后，才允许1%-5%受控生产灰度。',
    ['门禁项', '必须满足', '失败后动作', '可否豁免'], [
      ['G0 静态与身份', '框架/Casebook/发布身份/runner/capabilities/health全部精确READY', '不启动runner，修复具体前置', '否'],
      ['G1 核心生命线', '16/16真实执行、证据完整、逐Case trusted_pass', '立即停止G2-G5；产品候选NO-GO', '否'],
      ['G2 新增MR冒烟', '12/12真实执行、证据完整、逐Case trusted_pass', '立即停止G3-G5；产品候选NO-GO', '否'],
      ['G3 生产风险门禁', '70/70真实执行、证据完整、逐Case trusted_pass', '立即停止G4-G5；产品候选NO-GO', '否'],
      ['G4 全量功能回归', '同一候选release identity至少1轮160/160可信全绿；前70条与门禁同序同内容', '停止G5；修复framework/testcase问题后新目录重跑160；产品Bug保留', '否'],
      ['单轮完整性', 'executed=unique=trusted_pass=evidence_complete=70；inherited=synthetic=0', '该轮不计连续全绿', '否'],
      ['可信分类', '候选绿轮次trusted_bug/fail/blocked/framework_issue/testcase_issue=0', '框架/Case问题停机修复；产品Bug继续独立Case并阻止本轮绿判定', '否'],
      ['连续稳定', '同一release identity连续5轮完整全绿；flaky=0', '计数归零，从新不可变目录重跑', '否'],
      ['轮次复用', '160条轮次的前70条完整可信结果可计入5轮70条中的1轮', '不得把后90条或不完整前缀拆算为门禁轮次', '否'],
      ['G5 Soak', '至少100任务、3次受管重启、0 crash、0资源泄漏且证据完整', 'NO_GO', '否'],
      ['清理', 'QA创建资源清理完成，fixture restored=true', '冻结证据并修复清理', '否'],
      ['发布范围', '仅1%-5%受控生产灰度，具备实时监控与回滚', '停止扩量/回滚', '否'],
    ], [180, 520, 420, 100]);
  addSheet(workbook, '发布判定', '发布判定状态机', 'Case通过只是输入；最终放行由连续轮次、稳定性、身份一致性和清理证据共同决定。',
    ['阶段', '输入', '通过条件', '输出'], [
      ['G0 静态与身份', '16+12+70+160 Casebook、框架commit、真实发布身份', 'SHA固定；能力审计100%；精确READY；无候选待激活', '可启动G1'],
      ['G1 核心生命线', '16条串行真实Case', '16/16逐Case可信全绿；evidence complete；身份不漂移', '可启动G2'],
      ['G2 新增MR冒烟', '12条串行真实Case', '12/12逐Case可信全绿', '可启动G3'],
      ['G3 生产风险门禁', '70条串行真实Case', '70/70逐Case可信全绿', '可启动G4'],
      ['G4 全量回归', '160条串行真实Case', '160/160可信全绿，前70条同门禁合同', '全量绿轮次+一个门禁绿轮次'],
      ['门禁补轮', '另外4轮70条串行真实Case', '累计5轮70/70可信全绿', '候选可评估'],
      ['连续验证', '同一release identity 5轮', '5轮均可信全绿且flaky=0', '候选可评估'],
      ['G5 稳定性', '100任务+3重启soak', '0 crash、0泄漏、证据完整', '可进入多轮灰度聚合'],
      ['多轮发布聚合', 'G4全量绿轮次+累计5轮G3同合同门禁+G5 soak', '同一release identity；flaky=0；清理完整', 'GO_CONTROLLED_GRAY'],
      ['生产灰度', '1%-5%流量', '监控健康、无新增P0/P1', '逐步扩量或回滚'],
    ], [170, 360, 500, 240]);
  addSheet(workbook, '源码依据', 'Casebook源码与审计依据', '所有依据均绑定固定commit；deepbankV2仓库只读，QbotTestAgent负责Case、执行器、证据和放行规则。',
    ['类型', '位置/版本', '用途', '校验'], [
      ['产品源码', `/Users/qifu/Documents/deepbankV2 ${PRODUCT_REF}@${PRODUCT_COMMIT}`, '最新MR与产品行为设计依据；产品仓库只读', 'GitLab GraphQL mergeCommitSha 与增量MR终点全等'],
      ['上一Casebook产品基线', PREVIOUS_CASEBOOK_PRODUCT_COMMIT, '冻结r12的134个直接合入MR审计终点', `r12 SHA-256=${PREVIOUS_CASEBOOK_SHA256}`],
      ['MR增量窗口', `${PREVIOUS_CASEBOOK_PRODUCT_COMMIT}..${PRODUCT_COMMIT}`, `继承r12的${EXPECTED_PREVIOUS_MR_COUNT}条并追加${EXPECTED_INCREMENTAL_MR_COUNT}条API验证增量`, 'GitLab API branch HEAD稳定 + compare first-parent完整 + MR changes无overflow'],
      ['Release intake', `${releaseIntake.resolved}\nSHA-256=${releaseIntake.artifactSha256}`, '扫描前后HEAD、first-parent、MR元数据与changes完整性', `decision=${releaseIntake.report.decision}; design_acceptance=${releaseIntake.acceptance}; execution_authorized=false; release=${PRODUCT_COMMIT}; incremental=${EXPECTED_INCREMENTAL_MR_COUNT}`],
      ['产品版本', PRODUCT_VERSION, 'release/0.1 产品版本设计范围', `Casebook设计按${PRODUCT_VERSION}冻结；SIT候选另按完整版本号与十字段身份读回`],
      ['源Casebook', SOURCE, '184条历史合同与字段/样式来源', '只读导入'],
      ['MR冒烟源Casebook', SMOKE_SOURCE, '历史11条固定顺序合同来源', '只读导入并按最新MR补强，追加1条交互图表'],
      ['新Casebook', FORMAL_OUTPUT, '16条核心生命线+12条MR冒烟+70条生产门禁+160条全量功能回归合同', 'SHA写入两份框架规范'],
      ['框架协议', 'src/lib/core-beta-case-protocol.mjs', '独立scenario/fixture/证据契约', 'test/core-beta-case-protocol.mjs'],
      ['原生Runner', 'src/lib/ui-agent-casebook-runner-v2.mjs', '真实UI/bridge/CDP执行与Oracle', 'test/framework-invariants-v2.mjs'],
      ['能力审计', 'npm run core-beta:capability-audit', 'dispatchable/native/controller统计', 'strict_controller_required=0'],
      ['动态预检', 'npm run core-beta:pretest', '完整身份、fixture、CDP、唯一runner', '每阶段独立READY才可启动'],
      ['阶段编排', 'npm run qwork-release:orchestrate', 'G0-G5可信准入与止损状态机', '下一阶段只接受可信全绿'],
      ['灰度判定', 'npm run core-beta:gray-gate', '5轮+soak发布决策', 'GO_CONTROLLED_GRAY'],
    ], [150, 520, 420, 360]);

  const sheetNames = [
    '核心生命线门禁', '新增MR核心冒烟', '生产灰度门禁Case', '全量功能回归Case', '设计总览', '覆盖矩阵', '执行配置',
    '证据与断言', '删除场景清单', '执行器映射', '近2天MR覆盖', '生产灰度准入',
    '发布判定', '源码依据',
  ];
  const outputFile = path.join(outputDir, OUTPUT_NAME);
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(outputFile);
  const auditedArtifact = stableRegularFileSnapshot(outputFile, '导出后 runtime audit Casebook artifact');
  const exportedWorkbook = await SpreadsheetFile.importXlsx(new FileBlob(
    auditedArtifact.bytes,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ));
  const stagingVerification = await verifyWorkbook(exportedWorkbook, outputDir, sheetNames);
  const rebaseOutputPath = (candidate) => path.join(
    outputTransaction.final,
    path.relative(outputDir, path.resolve(candidate)),
  );
  const verification = {
    ...stagingVerification,
    inspection_file: rebaseOutputPath(stagingVerification.inspection_file),
    rendered: stagingVerification.rendered.map(rebaseOutputPath),
  };
  const exportedScopes = exportedCasebookScopes(exportedWorkbook);
  const exportedRuntimeAudit = auditCasebookRuntimeScopes(exportedScopes);
  const audit = {
    schema_version: 'qbot-release01-combined-casebook-build/v8',
    generated_at: new Date().toISOString(),
    product: { ref: PRODUCT_REF, commit: PRODUCT_COMMIT, version: PRODUCT_VERSION },
    release_intake: {
      path: releaseIntake.resolved,
      artifact_sha256: releaseIntake.artifactSha256,
      content_sha256: releaseIntake.report.integrity.content_sha256,
      decision: releaseIntake.report.decision,
      design_acceptance: releaseIntake.acceptance,
      execution_authorized: false,
      incremental_mr_count: releaseIntake.rows.length,
    },
    smoke_case_count: smokeCases.length,
    smoke_case_ids: smokeCases.map((item) => item['用例ID']),
    smoke_capability_summary: smokeCapability.counts,
    core_lifeline_case_count: coreLifelineCases.length,
    core_lifeline_case_ids: coreLifelineCases.map((item) => item['用例ID']),
    core_lifeline_capability_summary: coreLifelineCapability.counts,
    source_case_count: allCases.length,
    gate_case_count: gateCases.length,
    gate_case_ids: gateIds,
    regression_addon_count: regressionAddons.length,
    regression_addon_case_ids: regressionAddons.map((item) => item['用例ID']),
    full_case_count: fullCases.length,
    full_case_ids: fullIds,
    full_prefix_matches_gate: JSON.stringify(fullIds.slice(0, 70)) === JSON.stringify(gateIds),
    gate_capability_summary: gateCapability.counts,
    addon_capability_summary: addonCapability.counts,
    full_capability_summary: fullCapability.counts,
    strict_controller_required: fullCapability.strict.length,
    unsupported_runtime: fullCapability.unsupported.length,
    deleted_or_replaced_old_scenarios: deletionRows.length,
    mr_merge_commit_count: mrRows.length,
    mr_coverage_strength_counts: Object.fromEntries(
      [...COVERAGE_STRENGTHS].map((strength) => [strength, mrRows.filter((row) => row[8] === strength).length]),
    ),
    source_contract_claim_boundary: {
      claim_scope: QWORK_RELEASE_SOURCE_CLAIM_SCOPE,
      test_execution_attested: QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED,
      contract_ids: unique([...REQUIRED_SOURCE_CONTRACTS_BY_MR.values()].flat()),
    },
    audited_artifact: {
      bytes: auditedArtifact.size,
      sha256: auditedArtifact.sha256,
    },
    exported_runtime_audit: exportedRuntimeAudit,
    verification,
    outputs: {
      formal: FORMAL_OUTPUT,
      artifact: path.join(outputTransaction.final, OUTPUT_NAME),
    },
  };
  await fs.writeFile(path.join(outputDir, 'casebook-build-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
  const committedOutputDir = await commitCasebookOutputDirectory(outputTransaction);
  if (process.env.NODE_ENV === 'test'
    && process.env.QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_COMMIT === '1') {
    throw new Error('fault_injected_after_casebook_output_commit');
  }
  await publishCasebookAfterRuntimeAudit({
    artifactFile: path.join(committedOutputDir, OUTPUT_NAME),
    formalOutput: FORMAL_OUTPUT,
    scopes: exportedScopes,
    expectedArtifactSha256: auditedArtifact.sha256,
    expectedArtifactSize: auditedArtifact.size,
  });
  process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
  } finally {
    await abortCasebookOutputDirectory(outputTransaction);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
