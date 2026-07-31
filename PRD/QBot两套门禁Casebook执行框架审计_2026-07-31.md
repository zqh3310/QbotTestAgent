# QBot 两套门禁 Casebook 执行框架审计

审计日期：2026-07-31

## 审计对象

- `QBot核心内测门禁Casebook_74条_2026-07-31.xlsx`
  - SHA-256：`d72aba1cee18f6ec16d66c56920ae3e7b8f31106541cb275507dc4cfe328ba03`
- `QBot完整生产灰度门禁Casebook_160条_2026-07-31.xlsx`
  - SHA-256：`5f93402ef1586d2af16201daaf92aba8b6616825766c0d08c7ed2ed7929eeb6a`

两份 Casebook 均位于本目录，固定 Sheet 为 `核心内测Case`。

## 协议与路由审计结果

| Casebook | Case 数 | 协议可解析/可路由 | Runner 原生 | Runner 原生但需明确 fixture 选项 | 经语义复核的旧执行器 | 必须使用严格逐 Case 控制器 |
|---|---:|---:|---:|---:|---:|---:|
| 核心内测 | 74 | 74/74 | 55 | 7 | 0 | 12 |
| 完整生产灰度 | 160 | 160/160 | 58 | 8 | 5 | 89 |

“协议可解析/可路由”只表示 Case 的动作、执行器路由、Oracle、证据角色和清理契约完整，不表示裸机环境已经具备第二账号、OAuth、GitLab、故障注入、网络安全矩阵、宿主升级/回滚等真实资源。

## 完整执行的硬条件

160 条可以进入正式全量执行的前提是：

1. 前五条初始化 Case 必须按 `BETA-INIT-001` 至 `BETA-INIT-005` 固定顺序执行。
2. Runner 原生但需要 fixture 选项的 Case，必须提供对应重启命令、第二账号凭证、原生 IME 命令或明确的受控故障开关。
3. 89 条严格控制器 Case 必须配置 `--core-beta-fixture-control-url`。
4. 控制器 preflight 必须逐 Case 回显：
   - `case_id`
   - `driver`
   - `executor_route`
   - `contract_sha256`
   - 完整 `action_ids`
   - 完整 `evidence_roles`
   - 全部硬 Oracle 的 `oracle_sha256s`
5. 控制器 execute 必须返回：
   - `qbot-core-beta-driver-response/v1`
   - 每个声明动作的开始/结束时间、passed 状态和证据引用
   - 每个硬 Oracle 的通过结果和证据引用
   - 所有 Case 声明的非 Runner 证据文件
6. 控制器证据必须被复制进本 Case 的不可变目录并重新计算 SHA-256，禁止引用会继续变化的临时文件。

任何字段不匹配、证据缺失、空证据、未声明证据引用、动作收据缺失或 Oracle 缺失，均在 Case 0 前或当前 Case 收尾时 fail-closed，不得进入 completed。

## 本次框架补强

- 单宿主批量数量支持 1–20 配置，并受 Case 自身 `batch_size` 上限约束。
- 批量执行不跨越串行屏障，不混合 `case_type` 或流水线策略；附件、Skill、Expert、MCP、成果和多轮 round-robin 均有独立准备、回收和证据路径。
- 全局清理不支持附件、上传失败、更新提示等阻塞弹窗，同时保留 Case 专属确认弹窗的精确控制权。
- 附件限制、picker/drag/clipboard、同名不同 SHA、部分解析失败使用专用执行器，不再复用语义不完整的旧 Case。
- 工作空间边界实际覆盖同级目录、父目录、symlink 逃逸和 `../` 路径穿越，并记录 canonical path、文件 SHA 和拒绝原因。
- HITL 回答/跳过/超时与高级 SSRF 矩阵改为专用受控 adapter，禁止由单分支或 localhost 探测冒充。
- 旧执行器只有在完整业务 Oracle 语义复核后才允许保留；语义扩展但执行器未同步的 Case 全部改为严格控制器。
- 初始化硬门禁失败立即停止后续业务 Case。
- 任一执行、取证、manifest、断言或清理 `automation_error` 立即冻结本批次；可信产品 Bug 仍允许继续收集其他独立 Case。
- 每个 Case 必须具备 before/action/after 截图、动作收据、公开状态、任务 ID、完整 prompt/transcript/reply delta、能力/工具调用/成果/附件专项证据和清理读回；manifest 缺一项即失败。

## QA 结论

- Case 设计层：两份 Casebook 均达到严格门禁协议要求。
- 框架层：已经具备完整路由、配置化批量、初始化、真实动作、证据、精准断言、清理、恢复和 fail-closed 能力。
- 环境层：裸机不能宣称 160 条“可直接全量执行”；必须先部署并通过 89 条严格控制器能力握手。缺少这些真实资源时停止是正确结果，不是用 mock 文本补齐。
- 放行规则：只有同一冻结发布身份下，160 条全量证据可信、无 framework/testcase issue、无阻断性产品 Bug，并连续达到 Casebook 规定轮次后，才允许生产灰度。

## 可重复审计命令

```bash
npm run check

npm run core-beta:capability-audit -- \
  --casebook PRD/QBot完整生产灰度门禁Casebook_160条_2026-07-31.xlsx \
  --out outputs/qbot-160-framework-audit-20260731

npm run core-beta:capability-audit -- \
  --casebook PRD/QBot核心内测门禁Casebook_74条_2026-07-31.xlsx \
  --out outputs/qbot-74-framework-audit-20260731
```
