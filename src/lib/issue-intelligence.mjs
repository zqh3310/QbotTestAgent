import { classifyIssue } from './classifier.mjs';
import { extractSection, summarizeDescription } from './issues.mjs';

export const ISSUE_SCOPE_COLUMNS = [
  'iid',
  'scope_decision',
  'scope_category',
  'scope_confidence',
  'scope_reason',
  'handoff_to_test_design',
  'title',
  'state',
  'kind',
  'priority',
  'modules',
  'owner_agents',
  'product_requirement_summary',
  'explicit_constraints',
  'acceptance_source',
  'exclusion_reason',
  'web_url',
  'updated_at',
];

const PRODUCT_KEYWORDS = /qbot|workbuddy|assistant|助理|chat|对话|任务|空间|工作区|workspace|项目|project|专家|expert|skillhub|技能市场|connector|连接器|knowledge|知识|feedback|反馈|artifact|成果|attachment|附件|login|登录|oauth|权限|合规|模型连接|llm connection|mcp|mcphub|teams-hosted|360teams|ui|ux|sidebar|composer|askuserquestion|配置中心|config center|quick feedback|删除任务|成果库/i;
const REQUIREMENT_WORDS = /must|should|support|allow|enable|display|show|hide|validate|enforce|acceptance|requirement|constraint|用户|可以|支持|展示|隐藏|新增|删除|配置|绑定|同步|权限|不得|必须|需要|验收|约束|边界|产品|功能|交互/i;
const PRODUCT_TITLE_PATTERNS = /(design|docs)\(product\)|feature\((qbot|ui|uiux|assistant|projects|experts|connectors|knowledge|llm|teams|artifact)|enhancement\((ui|uiux|assistant|projects|experts|connectors|llm|runtime|qbot|artifact)|bug\((ui|uiux|assistant|qbot|llm|connectors|projects|skillhub|experts|artifact)/i;
const PROCESS_TITLE_PATTERNS = /^(refactor|chore|test|release|docs:|docs\(repo|design\(repo|design\(test|bug\(e2e|test\(runtime|test\(uiux|release-http|qbot quick feedback.*smoke)/i;
const PROCESS_WORDS = /merge request|\bmr\b|resolved mr|cross-agent|issue-intake|issue-implement|review-address|repo-managed|hooks?|\bci\b|pipeline|lint|typecheck|tracker|agent governance|agent-governance|agent context|context governance|governance skills?|context and skill governance|gitlab workflow assets?|e2e support|scripts?|desktop-release|release skill|gitlab workflow skills?|workflow skills?|workflow assets?|repo 治理|治理 skill|回归与修复|测试编排|测试矩阵|构建 lane|package upload|milestone tracker|k8s dev|dev-first|dev-targeted|remote-server-only|runtime feature|feature-regression|regression matrix|controlled prompt|raw capture|coverage matrix|uiux-audit|audit-convergence|cross-sweep|full-chain test|e2e smoke|smoke \d{4}|validation real-upload|repo-root|repo-owned skills/i;
const STRUCTURED_HEADINGS = [
  'Acceptance Criteria',
  'Product Requirements',
  'Requirements',
  'User Story',
  'Scope',
  'Goal',
  'Verification Checklist',
  'Negative Cases',
  'Out of scope',
  '验收标准',
  '产品要求',
  '功能要求',
  '用户故事',
  '范围',
  '目标',
  '负向用例',
  '约束',
];

export function buildIssueIntelligence(issues) {
  const selected = [];
  const excluded = [];
  const rows = [];

  for (const issue of issues) {
    const classification = classifyIssue(issue);
    const decision = decideIssueScope(issue, classification);
    const row = {
      iid: issue.iid,
      scope_decision: decision.include ? 'include_product_scope' : 'exclude_development_process',
      scope_category: decision.category,
      scope_confidence: decision.confidence,
      scope_reason: decision.reason,
      handoff_to_test_design: decision.handoffToTestDesign ? 'yes' : 'no',
      title: issue.title,
      state: issue.state,
      kind: classification.kind,
      priority: classification.priority,
      modules: classification.module_names.join('; '),
      owner_agents: classification.owner_agents.join('; '),
      product_requirement_summary: decision.summary,
      explicit_constraints: decision.constraints,
      acceptance_source: decision.acceptanceSource,
      exclusion_reason: decision.include ? '' : decision.reason,
      web_url: issue.web_url,
      updated_at: issue.updated_at,
    };
    rows.push(row);

    const packet = {
      ...row,
      labels: issue.labels,
      blocked_by: classification.blocked_by,
      content_hash: issue.content_hash,
      full_description: issue.description,
    };
    if (decision.include) selected.push(packet);
    else excluded.push(packet);
  }

  return {
    agent: 'issue-intelligence-analyst',
    generated_at: new Date().toISOString(),
    selection_policy: [
      'Include only product/function/constraint issues with explicit product behavior, user/admin path, acceptance criteria, or product documentation scope.',
      'Exclude development-process issues such as MR workflow, repo hooks, refactor, CI/e2e infrastructure, release plumbing, test orchestration, and governance unless the body defines product-facing behavior.',
      'Pass selected issue full descriptions to qbot-test-chief; downstream test agents consume only the selected test-design scope.',
    ],
    total_issues: issues.length,
    selected_product_issue_count: selected.length,
    excluded_issue_count: excluded.length,
    test_design_issue_count: selected.filter((issue) => issue.handoff_to_test_design === 'yes').length,
    selected_issues: selected,
    excluded_issues: excluded,
    issue_scope_rows: rows,
    handoff: {
      next_agent: 'qbot-test-chief',
      downstream_agents: selected.length
        ? ['test-plan-maintainer', 'functional-test-case-designer', 'codex-os-automation-planner', 'test-case-reviewer', 'evidence-quality-auditor']
        : ['qbot-test-chief'],
      test_design_issue_iids: selected.filter((issue) => issue.handoff_to_test_design === 'yes').map((issue) => issue.iid),
    },
  };
}

export function issuesForTestDesign(issues, issueIntelligence) {
  const selected = new Set((issueIntelligence?.selected_issues || [])
    .filter((issue) => issue.handoff_to_test_design === 'yes')
    .map((issue) => Number(issue.iid)));
  return issues.filter((issue) => selected.has(Number(issue.iid)));
}

function decideIssueScope(issue, classification) {
  const text = `${issue.title}\n${issue.description}\n${(issue.labels || []).join(' ')}`;
  const title = issue.title || '';
  const hasProductKeyword = PRODUCT_KEYWORDS.test(text);
  const hasRequirementWords = REQUIREMENT_WORDS.test(text);
  const hasProductTitle = PRODUCT_TITLE_PATTERNS.test(title);
  const hasStructuredRequirements = structuredRequirementText(issue).length > 0;
  const hasProcessTitle = PROCESS_TITLE_PATTERNS.test(title);
  const hasProcessWords = PROCESS_WORDS.test(text);
  const hasProcessWordsInTitle = PROCESS_WORDS.test(title);
  const hasProductBehavior = hasProductKeyword && hasRequirementWords;
  const summary = requirementSummary(issue);
  const constraints = constraintSummary(issue, classification);
  const acceptanceSource = acceptanceSourceFor(issue);

  if ((hasProcessTitle && !hasProductTitle) || (hasProcessWordsInTitle && !/(design|docs)\(product\)/i.test(title))) {
    return exclude('development_process', 'Title is explicitly development-process, workflow, repo, MR, e2e/test infrastructure, governance, or release plumbing scope.', summary, constraints, acceptanceSource, 'high');
  }

  if (hasStructuredRequirements && hasProductBehavior) {
    return include(hasProductTitle ? 'product_function_or_doc' : 'product_requirement_body', 'Issue body contains explicit product behavior, constraints, acceptance, or user/admin path.', summary, constraints, acceptanceSource, true, hasProductTitle ? 'high' : 'medium');
  }

  if (hasProcessWords && !hasProductTitle) {
    return exclude('development_process', 'Issue body is dominated by development workflow, repo, MR, e2e/test infrastructure, governance, or release plumbing language and has no product-title override.', summary, constraints, acceptanceSource, 'medium');
  }

  if (classification.kind === 'external-dependency' && hasProductKeyword) {
    return include('product_dependency_constraint', 'External dependency constrains a product capability.', summary, constraints, acceptanceSource, true, 'medium');
  }

  if ((hasProductTitle || hasStructuredRequirements) && hasProductBehavior) {
    return include(hasProductTitle ? 'product_function_or_doc' : 'product_requirement_body', 'Issue contains explicit product behavior or constraints.', summary, constraints, acceptanceSource, true, hasProductTitle ? 'high' : 'medium');
  }

  if (hasProcessTitle || hasProcessWords) {
    return exclude('development_process', 'Development workflow, repo, MR, e2e/test infrastructure, governance, or release plumbing issue without explicit product requirement.', summary, constraints, acceptanceSource, 'medium');
  }

  if (classification.kind === 'bug' && hasProductBehavior) {
    return include('product_bug_or_regression', 'Bug describes product-facing behavior or user-visible regression.', summary, constraints, acceptanceSource, true, 'medium');
  }

  if (classification.kind === 'design' && hasProductBehavior) {
    return include('product_design_doc', 'Design issue defines product behavior or product constraints.', summary, constraints, acceptanceSource, true, 'medium');
  }

  return exclude('insufficient_product_requirement', 'No clear product function, user/admin path, acceptance criteria, or product constraint was detected.', summary, constraints, acceptanceSource, 'high');
}

function include(category, reason, summary, constraints, acceptanceSource, handoffToTestDesign, confidence) {
  return { include: true, category, reason, confidence, summary, constraints, acceptanceSource, handoffToTestDesign };
}

function exclude(category, reason, summary, constraints, acceptanceSource, confidence) {
  return { include: false, category, reason, confidence, summary, constraints, acceptanceSource, handoffToTestDesign: false };
}

function structuredRequirementText(issue) {
  return STRUCTURED_HEADINGS
    .map((heading) => extractSection(issue.description, heading))
    .filter((section) => PRODUCT_KEYWORDS.test(section) && REQUIREMENT_WORDS.test(section))
    .join('\n\n');
}

function requirementSummary(issue) {
  const structured = structuredRequirementText(issue);
  const source = structured || summarizeDescription(issue, 420);
  return cleanText(source, 420);
}

function constraintSummary(issue, classification) {
  const parts = [];
  for (const heading of ['Constraints', '约束', 'Out of scope', 'Negative Cases', '负向用例']) {
    const section = extractSection(issue.description, heading);
    if (section) parts.push(`${heading}: ${cleanText(section, 220)}`);
  }
  if (classification.blocked_by) parts.push(`Blocked by: ${classification.blocked_by}`);
  return parts.join('\n');
}

function acceptanceSourceFor(issue) {
  for (const heading of STRUCTURED_HEADINGS) {
    const section = extractSection(issue.description, heading);
    if (section) return `${heading}: ${cleanText(section, 260)}`;
  }
  return `Issue title/body for #${issue.iid}`;
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/#{2,6}\s*/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^- \[[ x]\]\s?/gim, '')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
