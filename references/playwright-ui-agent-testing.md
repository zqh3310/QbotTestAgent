# QBot Playwright UI Agent 测试方案

目标：尽量“只动嘴不动手”，让自动化 Agent 通过 QBot 界面完成真实用户路径测试，并自动沉淀截图、对话文本、断言和中文报告。

## 启动方式

先启动 QBot，并暴露 Chrome DevTools Protocol 端口。推荐本地最新源码 UI + dev control-plane：

```bash
cd /Users/qifu/Documents/deepbankV2
npm run dev:ui -- --host 127.0.0.1 --port 5173

DEEPBANK_SERVER=https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net \
DEEPBANK_UI_URL=http://127.0.0.1:5173 \
./node_modules/.bin/electron . --remote-debugging-port=9224 '--remote-allow-origins=*'
```

打开后先手工完成 Lingxi OAuth2 登录。登录完成后再执行自动化。

## 生成测试材料

```bash
cd /Users/qifu/Documents/QbotTestAgent
npm run ui-agent:fixtures
```

默认生成到：

```text
/Users/qifu/Documents/QbotTestAgent/testflies
```

覆盖：txt、md、csv、json、html、js、docx、xlsx、pdf、pptx、svg、png。

## 诊断当前窗口

```bash
npm run ui-agent:doctor -- --cdp http://127.0.0.1:9224
```

诊断会检查：

- Playwright 是否可用
- 是否能连接 QBot CDP
- 是否停在登录页
- 是否找到会话输入框
- 是否检测到附件上传入口
- 当前页面截图和可见控件

## 执行 UI Agent 测试

```bash
npm run ui-agent:run -- --cdp http://127.0.0.1:9224
```

常用参数：

```bash
# 只跑前 3 条
npm run ui-agent:run -- --limit 3

# 只跑指定场景
npm run ui-agent:run -- --case CORE-TEXT-001,CORE-MD-005

# 使用自定义场景文件
npm run ui-agent:run -- --scenarios /absolute/path/scenarios.json
```

## 产物

每次运行默认输出到：

```text
/Users/qifu/Documents/QbotTestAgent/outputs/qbot-ui-agent-run-<timestamp>
```

核心文件：

- `ui-agent-report.md`：中文总报告
- `ui-agent-report.json`：结构化结果
- `ui-agent-scenarios.json`：本次执行的场景
- `cases/*/case-report.md`：单场景报告
- `cases/*/*.png`：每步截图
- `cases/*/transcript.txt`：完整页面对话证据
- `cases/*/reply-delta.txt`：本轮回复增量文本

## 断言原则

UI Agent 不直接测底层接口。它只模拟用户：

- 新建任务
- 输入自然语言问题
- 上传附件
- 点击发送
- 等待 Agent 回复
- 截图留证
- 判断回复是否有效、是否暴露内部错误、是否支持附件/多模态
- 输出易用性、实用性、回复相关性、证据质量评分

如果卡在登录页、找不到输入框、找不到上传入口、超时无回复，报告会明确标记为 blocked/failed，不会假装通过。
