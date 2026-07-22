import fs from 'node:fs';
import path from 'node:path';

export const TRUSTED_REVIEW_STATUSES = new Set([
  'trusted_pass',
  'trusted_bug',
  'trusted_failure',
  'trusted_blocked',
  'framework_issue',
  'testcase_issue',
  'needs_review',
]);

const TECHNICAL_ASSERTION = /模型档位|fixture|代理|控制面|route\s*hits?|请求计数|环境恢复|配置恢复|数据库|\bdb\b|\bcdp\b|selector|locator|runner|自动化|测试数据准备|截图采集/i;
const SETUP_SCREENSHOT = /(?:^|[-_.])(before|model[-_. ]?tier|fixture[-_. ]?prepared|attachments?[-_. ]?cleared|scene[-_. ]?tag[-_. ]?cleared|selection[-_. ]?cleared|workspace[-_. ]?selected|after[-_. ]?fill|after[-_. ]?send)(?:[-_. ]|$)/i;
const OUTCOME_SCREENSHOT = /after[-_. ]|reply|result|success|installed|reopen|error|fail|missing|empty|retry|interrupt|dialog|panel|preview|artifact|detail|deleted|uninstall|auth|market|dependency|cycle|sandbox|duplicate|feedback/i;

export function pathInside(root, file) {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function resolveScopedEvidence(outDir, result, evidence = []) {
  const caseRoot = result?.case_report ? path.dirname(path.resolve(result.case_report)) : '';
  return evidence.map((value) => {
    const file = path.isAbsolute(String(value || ''))
      ? path.resolve(String(value))
      : path.resolve(outDir, String(value || ''));
    return {
      value,
      file,
      exists: Boolean(value) && fs.existsSync(file),
      in_case: Boolean(caseRoot) && pathInside(caseRoot, file),
      is_screenshot: /\.png$/i.test(file),
      is_outcome_screenshot: /\.png$/i.test(file)
        && !SETUP_SCREENSHOT.test(path.basename(file))
        && OUTCOME_SCREENSHOT.test(path.basename(file)),
    };
  });
}

export function validateStrictReviewOverride({ outDir, result, item, trustedStatus, source = '' }) {
  const errors = [];
  if (!result?.id || item?.id !== result.id) errors.push('override Case ID 与原始结果不一致');
  if (!TRUSTED_REVIEW_STATUSES.has(trustedStatus)) errors.push(`不支持的可信分类：${trustedStatus || '空'}`);
  const evidence = resolveScopedEvidence(outDir, result, Array.isArray(item?.evidence) ? item.evidence : []);
  for (const entry of evidence) {
    if (!entry.exists) errors.push(`证据文件不存在：${entry.value}`);
    else if (!entry.in_case) errors.push(`证据越过当前 Case 目录：${entry.value}`);
  }
  const productConclusion = ['trusted_pass', 'trusted_bug'].includes(trustedStatus);
  if (productConclusion) {
    if (!String(item?.reason || '').trim()) errors.push('可信产品结论缺少 reason');
    if (!String(item?.product_observation || '').trim()) errors.push('可信产品结论缺少 product_observation');
    if (!String(item?.user_operation || '').trim()) errors.push('可信产品结论缺少 user_operation');
    if (!String(item?.expected_outcome || '').trim()) errors.push('可信产品结论缺少 expected_outcome');
    if (!evidence.some((entry) => entry.exists && entry.in_case && entry.is_outcome_screenshot)) {
      errors.push('可信产品结论缺少同 Case 的操作后结果截图');
    }
  }
  if (trustedStatus === 'trusted_bug' && !String(item?.user_impact || '').trim()) {
    errors.push('可信 Bug 缺少 user_impact');
  }
  if (trustedStatus === 'trusted_pass') {
    const failedUserAssertions = (Array.isArray(result?.assertions) ? result.assertions : [])
      .filter((assertion) => assertion?.status === 'failed')
      .filter((assertion) => !TECHNICAL_ASSERTION.test(String(assertion?.name || '')));
    if (failedUserAssertions.length) {
      const resolved = Array.isArray(item?.resolved_failures) ? item.resolved_failures : [];
      for (const assertion of failedUserAssertions) {
        const match = resolved.find((entry) => entry?.assertion === assertion.name || entry?.assertion === '*');
        if (!match?.reason || !Array.isArray(match.evidence) || !match.evidence.length) {
          errors.push(`可信通过未结构化解释失败断言：${assertion.name}`);
        }
      }
    }
  }
  return {
    ok: errors.length === 0,
    source,
    id: result?.id || item?.id || '',
    trusted_status: trustedStatus,
    errors,
    evidence,
  };
}
