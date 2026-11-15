# 阅变 AI 变更评审 / EvidentLoop AI Code Review

有据可查的代码交付闭环 / Evidence-backed delivery loop for AI-written code。

AI 写完代码，先看懂改了什么、有没有问题：变更说明、带证据的代码评审、发回修改与审查留档。

当前版本为 **0.1.0-rc.1（beta）发布候选**，面向 DeepSeek Harness；本地准备完成不表示已公开发布。当前由人工发起审查，自动触发留待后续版本。

- 按功能解释整批改动，区分代码事实与模型推断。
- 逐条核对会话及手动添加的需求，问题引用冻结代码的原文。
- 没审全时显示原因；再次审查按文件内容增量处理。
- 问题和批注写入开发会话的输入框，由你确认后发送。
- 读取工作树而不改代码、暂存区或提交；审查记录保存在本机，可导出 Markdown 和自包含 HTML。

## 使用与开发

使用说明：[evidentloop.sanze.ai](https://evidentloop.sanze.ai/guide.html)。本地说明书以 [docs/guide.md](docs/guide.md) 为准。

- [plugin/](plugin/README.md)：React 客户端与插件宿主。
- [core/](core/README.md)：纯 Node 核心库，Node 20 及以上。
- [skills/](skills/evidentloop-review/SKILL.md)：证据与需求对齐审查方法。
- [prototype/](prototype/README.md)：离线交互演示，包含明确标注的合成审查数据。

构建需要已有的 esbuild；插件测试还需要已有的 React、ReactDOM、Playwright 和系统 Chrome。脚本不自动安装依赖；可通过 `ESBUILD_PACKAGE`、`REACT_PACKAGE`、`PLAYWRIGHT_PACKAGE` 指定对应 package.json。

```sh
node plugin/scripts/build.mjs
node docs/build.mjs
node plugin/tests/run.mjs /tmp/evidentloop-plugin-tests
node plugin/tests/browser-headless.mjs /tmp/evidentloop-ui-tests
node core/tests/all.mjs /tmp/evidentloop-core-tests
```

测试使用合成适配器，不调用真实模型。安装包中的真实审查仍受独立预算门控制，见插件说明。

## 许可与来源

MIT，Copyright (c) 2026 sanze.li。界面基于作者个人原型，插件客户端独立实现。第三方代码和图形保留各自许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
