# 看清 AI 改了什么，再决定要不要合并

**EvidentLoop（AI 变更评审）** 是 DeepSeek Harness 的代码评审插件。看懂整批改动，核对需求，复核有代码依据的问题，再把修改意见发回会话。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/site/assets/diff-finding-dark.png">
  <img src="docs/site/assets/diff-finding-light.png" alt="评审台：文件树、单栏 Diff 与定位到代码行的问题卡片" width="100%">
</picture>

[观看 44 秒操作演示](https://evidentloop.sanze.dev/demo.html) · [下载 MP4](docs/site/assets/workflow.mp4)

**0.1.0-rc.1 · beta**。当前需手动发起审查，自动触发尚未接入。画面来自公开项目 sopify 的真实审查：已审 1 个文件、24 个待审、9 个跳过；人工批注和「标记非问题」展示复核操作，不表示整批代码已通过。

## 安装

需要 DeepSeek Harness 兼容版本 `^0.2.2-rc.2`；开发环境使用 Node.js ≥ 20。

1. 从 [GitHub Release](https://github.com/evidentloop/dsh-evidentloop/releases/tag/v0.1.0-rc.1) 下载 `dsh-evidentloop-0.1.0-rc.1.tgz`。
2. 在 DSH 所在机器打开 **插件 → 添加插件**，输入离线包的绝对路径，安装后启用。也可在当前使用的 profile 安装：

   ```sh
   dsh plugin --profile desktop add /absolute/path/dsh-evidentloop-0.1.0-rc.1.tgz
   ```

   将 `desktop` 替换为实际使用的 profile；如宿主提示需要重启，重启后打开侧栏「变更评审」。
3. 若希望通过「发现」安装，在 **插件 → 实验性插件 → 自定义插件索引** 启用该功能，再到 **发现 → 添加索引源**，填入 [本仓库的插件索引](https://raw.githubusercontent.com/evidentloop/dsh-evidentloop/main/docs/market/index.json)。搜索「AI 变更评审」或 `EvidentLoop`，核对版本和来源后安装。索引是自定义入口，未宣称已被官方商店收录；市场安装尚未完成端到端验证。

安装不会发起模型请求。beta 期间真实审查需要单独配置调用额度，见[插件配置说明](plugin/README.md#隔离模型预算门禁)。

## 快速开始

1. **改代码**：在 DSH 开发会话中照常完成功能或修复。无需先提交；新仓库还没有首次提交时，也可以审查本地改动，空仓库会给出提示。
2. **发起审查**：打开「变更评审」，进入交付，点击「审查全部」或仅审查一个文件。
3. **复核并发回**：先看变更说明与需求核对，再用单栏 Diff 对照问题的代码依据。添加批注或标记非问题后，从「导出与发回」预览并写入会话草稿，由你确认发送。

改完再次审查，未变的文件沿用上次结论；待审、跳过和失败状态仍会保留。

## 功能图解

| 你要做的事 | 评审台如何帮助你 |
|---|---|
| 看懂整批改动 | 按功能解释为什么改、如何改、行为有什么变化，区分代码事实与模型推断 |
| 核对有没有漏需求 | 合并会话需求和手动补充项，列出已对齐、待确认、已调整与需求外改动 |
| 复核问题 | 用文件类型图标和左右箭头浏览文件，在单栏 Diff 中定位代码；引用对不上原文的问题不展示，判断是否成立仍由你确认 |
| 留下人工判断 | 添加批注，标记非问题或恢复，再将修改意见整理为会话草稿 |
| 回看与导出 | 保留每次审查记录，导出 Markdown 或离线 HTML，可选附带完整 Diff |

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/site/assets/overview-summary-dark.png">
  <img src="docs/site/assets/overview-summary-light.png" alt="变更说明按功能解释本次改动，并保留尚未审完的覆盖状态" width="100%">
</picture>

界面跟随 DSH 浅深主题，标题字重与留白沿用宿主。会话中提供审查卡片，JSON 以代码块显示，便于查看结果；演示模式提示可关闭，调用配置仍可从工作区设置查看。插件读取本地改动，不修改代码、暂存区或提交。

## 文档

- [完整使用说明](https://evidentloop.sanze.dev/guide.html)：操作与状态解释；[本地版本](docs/guide.md)。
- [DSH 官方插件管理说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.zh.md)与[自定义索引指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.zh.md)。

## 开发

在仓库根目录运行；UI 测试使用已有 Playwright 与系统 Chrome。

```sh
npm ci
npm run build
node --import tsx plugin/tests/run.mjs /tmp/evidentloop-plugin-tests
node --import tsx plugin/tests/browser-headless.mjs /tmp/evidentloop-ui-tests
node core/tests/all.mjs /tmp/evidentloop-core-tests
node plugin/scripts/package.mjs /tmp/dsh-evidentloop-0.1.0-rc.1.tgz
```

输出目录须尚不存在，安装包路径须在仓库外。测试使用合成数据，不调用真实模型。客户端与宿主位于 [plugin/](plugin/README.md)，快照、校验和导出位于 [core/](core/README.md)，审查方法位于 [skills/](skills/evidentloop-review/SKILL.md)。

## 许可

[MIT](LICENSE)，Copyright (c) 2026 sanze.li。第三方代码与图形保留原许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
