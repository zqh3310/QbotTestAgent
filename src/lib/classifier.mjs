const MODULES = [
  {
    id: 'assistant',
    name: 'Assistant',
    labels: ['area/assistant-ui'],
    keywords: ['assistant', '助理', 'composer', 'thread', 'askuserquestion', 'artifact', 'chat', '会话'],
    owner_agent: 'ui-product-experience-tester',
  },
  {
    id: 'runtime',
    name: 'Runtime / Protocol',
    labels: ['area/runtime'],
    keywords: ['runtime', 'codex', 'claude code', 'glm', 'responses', 'protocol', '模型', '档位', 'm1', 'm2', 'm3', 'm4'],
    owner_agent: 'runtime-protocol-skill-chain-tester',
  },
  {
    id: 'skills_mcp',
    name: 'Skills / MCP / Experts',
    labels: ['area/skills'],
    keywords: ['skill', 'skills', 'mcp', 'mcphub', 'skillhub', '专家', '技能', 'connector', '连接器'],
    owner_agent: 'runtime-protocol-skill-chain-tester',
  },
  {
    id: 'projects',
    name: 'Projects / GitLab',
    labels: ['area/projects', 'area/db'],
    keywords: ['project', 'projects', 'gitlab', 'workspace', '项目', '仓库', '成员'],
    owner_agent: 'functional-test-case-designer',
  },
  {
    id: 'automation',
    name: 'Project Automation',
    labels: [],
    keywords: ['automation', '自动化', 'schedule', 'scheduled', 'run records', 'cron'],
    owner_agent: 'functional-test-case-designer',
  },
  {
    id: 'uiux',
    name: 'UI / UX',
    labels: ['area/ui', 'area/electron', 'area/preload'],
    keywords: ['uiux', '视觉', 'electron', 'teams', 'sidebar', 'app-shell', '导航', '登录', '品牌'],
    owner_agent: 'ui-product-experience-tester',
  },
  {
    id: 'e2e_release',
    name: 'E2E / Release / Platform',
    labels: ['area/e2e', 'area/deploy', 'area/scripts'],
    keywords: ['e2e', 'release', 'macos', 'windows', 'docker', 'sqlite', 'dmg', 'nsis', '打包', '发布'],
    owner_agent: 'cross-platform-e2e-validator',
  },
  {
    id: 'compliance',
    name: 'Compliance / Security',
    labels: ['dependency/external'],
    keywords: ['lingxi', 'oauth2', 'secret', 'redacted', '权限', '合规', 'm4', '外部依赖', 'dependency'],
    owner_agent: 'compliance-security-tester',
  },
  {
    id: 'context_governance',
    name: 'Context / Governance',
    labels: ['area/context', 'area/repo', 'area/docs'],
    keywords: ['context', 'governance', 'agents.md', 'claude.md', '上下文', '治理'],
    owner_agent: 'issue-intelligence-analyst',
  },
];

export function classifyIssue(issue) {
  const labels = new Set(issue.labels || []);
  const titleAndLabels = `${issue.title}\n${[...labels].join(' ')}`.toLowerCase();
  const modules = [];
  for (const module of MODULES) {
    const labelHit = module.labels.some((label) => labels.has(label));
    const keywordHit = module.keywords.some((keyword) => titleAndLabels.includes(keyword.toLowerCase()));
    if (labelHit || keywordHit) modules.push(module);
  }
  if (modules.length === 0) modules.push(MODULES.find((module) => module.id === 'context_governance'));
  const kind = [...labels].find((label) => label.startsWith('kind/'))?.slice('kind/'.length) || inferKind(issue);
  const status = [...labels].find((label) => label.startsWith('status/'))?.slice('status/'.length) || issue.state;
  return {
    modules,
    module_ids: modules.map((module) => module.id),
    module_names: modules.map((module) => module.name),
    owner_agents: [...new Set(modules.map((module) => module.owner_agent))],
    kind,
    status,
    priority: inferPriority(issue, kind, modules),
    test_types: inferTestTypes(issue, kind, modules),
    validation_commands: inferValidationCommands(issue, modules),
    blocked_by: inferBlocker(issue, status, kind),
    material: isMaterial(issue, kind, modules),
  };
}

function inferKind(issue) {
  const title = issue.title.toLowerCase();
  if (title.includes('bug')) return 'bug';
  if (title.includes('test')) return 'test';
  if (title.includes('release')) return 'release';
  if (title.includes('design')) return 'design';
  if (title.includes('external')) return 'external-dependency';
  if (title.includes('refactor')) return 'refactor';
  return 'feature';
}

function inferPriority(issue, kind, modules) {
  const labels = new Set(issue.labels || []);
  if (labels.has('priority/high') || kind === 'bug') return 'P0';
  if (kind === 'external-dependency' || modules.some((module) => ['runtime', 'projects', 'e2e_release', 'compliance'].includes(module.id))) return 'P1';
  if (kind === 'design' || kind === 'docs') return 'P2';
  return 'P2';
}

function inferTestTypes(issue, kind, modules) {
  const types = new Set(['functional']);
  for (const module of modules) {
    if (module.id === 'uiux' || module.id === 'assistant') types.add('UI');
    if (module.id === 'runtime' || module.id === 'skills_mcp') types.add('runtime');
    if (module.id === 'e2e_release') types.add('e2e');
    if (module.id === 'projects' || module.id === 'automation') types.add('integration');
    if (module.id === 'compliance') types.add('security');
  }
  if (kind === 'bug') types.add('regression');
  if (kind === 'release') types.add('release');
  if (kind === 'external-dependency') types.add('contract');
  return [...types];
}

function inferValidationCommands(issue, modules) {
  const commands = new Set(['npm run check']);
  if (modules.some((module) => ['uiux', 'assistant', 'projects'].includes(module.id))) commands.add('npm run build:ui');
  if (modules.some((module) => ['e2e_release', 'projects', 'assistant', 'uiux'].includes(module.id))) {
    commands.add('npm run e2e:doctor -- --scope=local');
    commands.add('npm run e2e:local');
  }
  if (modules.some((module) => ['runtime', 'skills_mcp'].includes(module.id))) {
    commands.add('npm run codex:doctor && npm run codex:smoke');
    commands.add('npm run runtime-features:doctor');
  }
  if (modules.some((module) => module.id === 'e2e_release')) commands.add('npm run build:desktop');
  return [...commands];
}

function inferBlocker(issue, status, kind) {
  const text = `${issue.title}\n${issue.description}\n${(issue.labels || []).join(' ')}`.toLowerCase();
  if (status === 'blocked') return 'Issue status is blocked.';
  if (kind === 'external-dependency') return 'External dependency acceptance required.';
  if (text.includes('lingxi') && text.includes('token exchange')) return 'Lingxi OAuth2 to GitLab token exchange dependency.';
  if (text.includes('real-provider') || text.includes('真实')) return 'Requires explicit real-provider environment.';
  return '';
}

function isMaterial(issue, kind, modules) {
  if (kind !== 'docs') return true;
  return modules.some((module) => ['runtime', 'projects', 'automation', 'compliance', 'e2e_release'].includes(module.id));
}

export function buildIssueMatrix(issues) {
  return issues.map((issue) => {
    const classification = classifyIssue(issue);
    return {
      iid: issue.iid,
      title: issue.title,
      state: issue.state,
      labels: issue.labels.join('; '),
      kind: classification.kind,
      status: classification.status,
      priority: classification.priority,
      modules: classification.module_names.join('; '),
      owner_agents: classification.owner_agents.join('; '),
      test_types: classification.test_types.join('; '),
      validation_commands: classification.validation_commands.join(' && '),
      blocked_by: classification.blocked_by,
      updated_at: issue.updated_at,
      web_url: issue.web_url,
      content_hash: issue.content_hash,
    };
  });
}
