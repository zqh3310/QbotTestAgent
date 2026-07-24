import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LATEST_MAIN_BASELINE,
  PRODUCTION_CASEBOOK_CONTRACT_VERSION,
  migrateProductionCase,
  productionCaseMigrationPlan,
  validateTrustedProductionCaseContract,
} from '../src/lib/production-casebook-contract.mjs';

function sourceCase(id) {
  return {
    id,
    module: id.includes('CONN') ? '连接器功能' : id.includes('SKILL') ? '技能功能' : '首页会话组合',
    submodule: 'production trust contract',
    scenario: `${id} 用户可见生产门禁场景`,
    steps: '1. 执行真实用户动作。\n2. 核对可见结果与独立状态读回。',
    selectors: '[data-testid="composer-plus-menu"]',
    source_type: 'deepbankV2 origin/main@0000000',
    version_scope: '360Teams 5.2.20 (2119072293) + QWork/runtime 0.0.12',
    kind: 'ui',
  };
}

test('latest-main migration plan is an exact unique 92-case set', () => {
  const plan = productionCaseMigrationPlan();
  const entries = Object.entries(plan);
  const ids = entries.flatMap(([, values]) => values);
  assert.equal(ids.length, 92);
  assert.equal(new Set(ids).size, 92);
  assert.deepEqual(
    Object.fromEntries(entries.map(([key, values]) => [key, values.length])),
    {
      replace_obsolete_assertion: 2,
      rewrite_for_latest_main: 51,
      retain_and_strengthen_evidence: 26,
      retain_business_oracle: 13,
    },
  );
});

test('migrated 92-case contract is V2, pinned, and contains no legacy product assertions', () => {
  const ids = Object.values(productionCaseMigrationPlan()).flat();
  const cases = ids.map((id) => migrateProductionCase(sourceCase(id)));
  const audit = validateTrustedProductionCaseContract(cases);
  assert.equal(audit.ok, true, audit.errors.join('\n'));
  assert.equal(audit.case_count, 92);
  assert.equal(audit.unique_case_ids, 92);
  assert.ok(cases.every((item) => item.contract_version === PRODUCTION_CASEBOOK_CONTRACT_VERSION));
  assert.ok(cases.every((item) => item.product_baseline.includes(LATEST_MAIN_BASELINE.commit)));
  assert.ok(cases.every((item) => !/composer-(?:skills|connectors)-menu|composer-(?:skill|connector)-mode-(?:auto|manual|disabled)|assistant-turn-summary-created-file|nav-knowledge/.test(item.selectors)));
});

test('strict contract rejects legacy selector fallback and bridge-only visible acceptance', () => {
  const migrated = migrateProductionCase(sourceCase('SIT-SKILL-007'));
  migrated.selectors = '[data-testid="composer-skills-menu"]';
  migrated.visible_action_contract = 'bridge 调用完成即通过';
  const audit = validateTrustedProductionCaseContract([migrated], { requireFullSet: false });
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((item) => item.includes('失效产品断言')));
  assert.ok(audit.warnings.some((item) => item.includes('bridge')));
});
