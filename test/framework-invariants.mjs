import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = fs.readFileSync(path.join(root, 'src', 'lib', 'ui-agent-casebook-runner.mjs'), 'utf8');

const required = [
  ['逐次发送前模型校验', /async function send[\s\S]*ensureModelTier\(page, state, state\.case_dir[\s\S]*model_tier_before_send[\s\S]*const selectors/],
  ['可信度审计使用逐次发送前证据', /preSendTierChecks[\s\S]*successfulSendCount[\s\S]*preSendTierChecks\.length < successfulSendCount/],
  ['HOME-007 专项执行', /SIT-HOME-007'[\s\S]*executeSitHomeSkillOnly/],
  ['HOME-020 不走附件泛化路由', /SIT-HOME-020'[\s\S]*executeSitHomePrdBoundary/],
  ['HOME-023 记录真实停止点击', /recordStep\(state, '点击停止生成'/],
  ['HOME-025 使用可控失败注入', /__QBOT_QA_ORIGINAL_SEND__[\s\S]*controlled failure/],
  ['HOME-030 真实打开并 dry-run 快速反馈', /composer-feedback[\s\S]*quick-feedback-panel[\s\S]*__QBOT_QA_ORIGINAL_SUBMIT_FEEDBACK__/],
  ['HOME-052 打开并取消原生工作区选择器', /executeSitHomeWorkspacePicker[\s\S]*wspick-trigger[\s\S]*wspick-menu[\s\S]*osascript/],
  ['技能安装等待终态', /waitForSkillInstallTerminal[\s\S]*安装中\|准备中\|物化中\|待物化/],
  ['成果任务使用独立可见工作区', /prepareVisibleQaWorkspace[\s\S]*outputs', 'ui-agent-workspaces/],
  ['成果预览拒绝受保护路径误判', /artifactPreviewReadable[\s\S]*受保护路径[\s\S]*expectedContent\.test/],
  ['连接器刷新失败注入', /__QBOT_QA_ORIGINAL_GET_CONNECTOR_CATALOG__[\s\S]*forceRefresh/],
  ['技能安装中断注入', /__QBOT_QA_ORIGINAL_INSTALL_SKILL__[\s\S]*controlled network interruption/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(runner)) throw new Error(`Framework invariant missing: ${label}`);
}

const forbidden = [
  ['成果删除仍直接声明缺少注入', '当前测试环境缺少可控的成果文件删除注入能力'],
  ['连接器刷新仍直接声明不能注入', '当前 runner 不修改网络或服务状态，无法可信验证刷新失败时保留缓存'],
  ['技能中断仍直接声明不能注入', '当前批量 runner 不能擅自修改用户网络环境'],
];
for (const [label, text] of forbidden) {
  if (runner.includes(text)) throw new Error(`Framework invariant violated: ${label}`);
}

console.log('framework invariants ok');
