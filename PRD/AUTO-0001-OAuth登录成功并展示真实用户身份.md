# AUTO-0001 自动化用例

- 来源 Excel: /Users/qifu/Documents/QbotTestAgent/outputs/qbot-testcase-remediation-2026-07-01/deepbank-qbot-issue-executable-test-cases-2026-07-01-remediated.xlsx
- Sheet: Codex自动化用例
- 行号: 4
- Codex用例ID: AUTO-0001
- 对应功能用例ID: FT-0001
- 测试场景: OAuth 登录成功并展示真实用户身份
- 优先级: P0
- 回归层级: S0 冒烟
- 自动化层级: A2 真实依赖回归
- Issue来源: #15
- GitLab链接: https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/issues/15

## 前置条件
QBot 可正常启动；准备隔离的 Lingxi 测试账号和异常授权条件；当前停留在登录页或可通过左下用户入口退出到登录页。测试执行前记录环境 profile 和登录账号角色。

## 测试数据
正常 Lingxi 测试账号

## 详细执行步骤
1. setup：按“自动化执行契约”准备 A2 真实依赖回归 环境、登录态、fixture 和 evidence/AUTO-0001/ 目录。
2. 使用真实 UI 进入：登录页【使用 Lingxi 登录】；左下用户入口【退出】。优先按 data-testid/aria-label 定位，找不到时用可见文本和相邻区域定位。
3. 按场景“OAuth 登录成功并展示真实用户身份”逐步点击、输入、等待，不直接访问接口、数据库或 shell。
4. 等待统一状态：running/done/failed/canceled/timeout；超时必须截图并记录 blocker。
5. 断言具体文本、按钮状态、数据变化、错误提示、恢复入口和敏感信息反向断言。
6. 保存 screenshots、transcript（如有问答）、assertions.json、scores.json；执行 cleanup 清理测试数据。

## 预期结果/断言
自动化按 A2 真实依赖回归 环境可重复执行；所有操作来自真实 UI。
可观察断言：入口、按钮、状态、数据变化和恢复路径必须明确；AI 回复不得只断言非空，需与场景目标匹配。
断言包含具体可见文本、状态变化、按钮启用/禁用、恢复入口和敏感信息反向检查。
失败时必须输出 blocker 类型、失败步骤、截图和是否可重试。

## 失败判定/阻塞规则
页面入口与实际产品不一致，测试无法按步骤执行。
预期中的按钮、状态、数据变化、错误提示或恢复路径缺失。
证据无法证明业务目标达成，只能证明页面未崩溃或回复非空。
普通用户路径要求理解或配置模型、运行时、密钥、baseURL、provider、MCP 等技术概念。

## UI定位/可观察信号
qbot-auth-shell, auth-login, auth-error, qbot-app, nav-settings-menu, auth-logout

## 自动化证据要求
assertions.json 必含：caseId=AUTO-0001；functionalCaseId=FT-0001；automationLevel=A2 真实依赖回归；environmentProfile；steps[{action,selector,text,elapsedMs,status}]；visibleTexts；buttonStates；dataChanges；negativeAssertions；screenshots；blockers；cleanupStatus；scores{usability,convenience,practicality,onboarding,stability}。

## 评分要求
输出 scores.json：usability、convenience、practicality、onboarding、stability 均为 1-5 分；每个扣分项必须关联截图或断言失败。

## 本次执行映射
该用例是 A2 真实依赖回归，要求真实 Lingxi OAuth 测试账号和 .env.e2e/环境变量。缺少真实依赖时必须输出 blocked，不允许用 mock 登录冒充通过。
