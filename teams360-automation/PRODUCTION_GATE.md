# QBot Teams-QWork 生产级 QA 门禁

本门禁只负责 QA 侧发布判断。它不会把一次原始 `passed` 或一次 100% 可信通过直接解释为允许全量生产。

## 决策语义

- `NO-GO`：存在发布物漂移、未完成、非可信通过、框架/用例/环境问题、重复稳定性不足、风险元数据缺失、黄金集校准不足或独立复核不足。
- `GO-CANARY`：QA 生产门禁全部满足，只允许进入受控生产灰度。
- 全量生产：不由本工具自动授权。必须由灰度指标与回滚验证共同决定。

## Casebook 生产元数据

发布用 Casebook 的每条 Case 必须显式提供以下列：

| 中文列 | 导出字段 | 用途 |
|---|---|---|
| 风险域 | `risk_domain` | 功能、安全、可靠性、性能、兼容、数据隔离、外链、发布回滚 |
| 判定Oracle | `oracle_type` | UI、状态、日志、工具调用、文件/成果读回等 |
| 确定性 | `deterministic` | 区分确定性检查与 Agent 随机性检查 |
| 重复策略 | `repeat_policy` | 例如 P0 5/5、P1 3/3 |
| 必需Fixture | `required_fixture` | 账号、权限、连接器、项目 runtime、文件和故障注入 |
| 硬门禁 | `hard_gate` | 是否一票否决 |
| 清理策略 | `cleanup_policy` | Case 结束后的任务、项目、技能、文件清理 |
| 版本范围 | `version_scope` | 适用发布候选版本 |
| 历史Bug | `known_bug_link` | 可选；历史缺陷追溯 |
| 生产观测指标 | `production_signal` | 灰度时关联的成功率、错误率和恢复指标 |

当前核心门禁表如果缺少这些列，生产门禁会输出 `NO-GO`。这是有意设计，不能使用推断值冒充显式风险设计。

## 发布物冻结

Teams Casebook wrapper 会在 `run-metadata.json` 中固定：

- 360Teams 版本、build、Info.plist SHA-256、主二进制 SHA-256。
- QWork 版本、URL、index.html SHA-256、安装元数据 SHA-256。
- Casebook SHA-256、Case ID 集合。
- 自动化框架 commit/dirty 状态、deepbankV2 fixture commit。
- 控制面、模型档位、timeout。
- 后端版本、Prompt/策略版本、feature flags SHA-256。

发布侧需通过参数或环境变量提供：

```bash
--backend-version <immutable-version>
--prompt-policy-version <immutable-version>
--feature-flags-hash <64-char-sha256>
```

对应环境变量为 `QBOT_BACKEND_VERSION`、`QBOT_PROMPT_POLICY_VERSION`、`QBOT_FEATURE_FLAGS_HASH`。

任一恢复轮次的固定字段发生变化，wrapper 会立即拒绝续跑。

正式执行时必须启用生产前置 lint：

```bash
npm run casebook -- \
  --casebook /abs/production-casebook.xlsx \
  --case SIT-A,SIT-B \
  --out /Users/qifu/Documents/QbotTestAgent/teams360-automation/output/<run> \
  --profile full \
  --model-tier M3 \
  --timeout-ms 600000 \
  --production-gate true \
  --backend-version <immutable-version> \
  --prompt-policy-version <immutable-version> \
  --feature-flags-hash <64-char-sha256>
```

Casebook 风险元数据或发布输入不完整时，Runner 会在执行任何 Case 操作前生成 `production-casebook-preflight.json` 并停止。

## 黄金缺陷集

复制并填写：

```text
quality-gate/golden-defect-calibration.template.json
```

默认硬指标：

- 至少 30 个有证据样本。
- 每个样本的证据文件必须存在，且 `evidence_sha256` 与文件内容一致。
- 至少 20 个缺陷样本、5 个 P0 缺陷、5 个无缺陷控制样本。
- 总体缺陷检出率不低于 95%。
- P0 缺陷检出率 100%。
- 分类准确率不低于 95%。
- 误报率不高于 2%。
- 校准文件的 framework commit 必须与发布执行使用的框架 commit 一致。

## 独立复核

复制并填写：

```text
quality-gate/independent-review.template.json
```

默认要求：

- 全部 P0 必须由独立人工或第二判定引擎复核。
- 必须提供复核人、角色、复核方法、有效时间，并显式声明 `independence_attestation=true`。
- 至少复核 20% 的可信通过 Case。
- 每条必须标记 `evidence_checked=true` 并给出理由。
- 独立结论与框架结论存在任何冲突时输出 `NO-GO`。

## 执行生产门禁

生产策略要求同一不可变 RC 至少提供 5 个完整执行目录：P0 必须 5/5，P1 至少 3/3。

```bash
npm run production-gate -- \
  --runs /abs/run-1,/abs/run-2,/abs/run-3,/abs/run-4,/abs/run-5 \
  --policy /Users/qifu/Documents/QbotTestAgent/teams360-automation/quality-gate/production-gate-policy.json \
  --calibration /abs/golden-defect-calibration.json \
  --independent-review /abs/independent-review.json \
  --report-out /abs/production-gate-report
```

产物：

- `production-quality-gate.json`
- `production-quality-gate.md`
- `production-quality-gate.html`
- `qa-release-candidate-manifest.json`

RC 清单会固定全部运行轮次的 Casebook、metadata、summary、progress、可信复核文件哈希，以及策略、黄金集校准和独立复核输入哈希。

命令在 `NO-GO` 时返回非零退出码，可直接接入 CI 或发布平台。

## 不允许的豁免

- 不允许把不同 Teams、QWork、后端、Prompt 或 feature flag 的运行结果相加。
- 不允许用“重跑成功”覆盖同一 RC 的偶现失败。
- 不允许用 raw passed 代替可信二次复核。
- 不允许用框架问题、阻塞或缺证据结果计算 100% 通过。
- 不允许在黄金缺陷集或独立复核未完成时输出 `GO-CANARY`。
- 不允许由 QA 门禁直接输出全量生产授权。
