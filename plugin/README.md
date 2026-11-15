# AI 变更评审 / EvidentLoop · 0.1.0-rc.1（Beta）

面向人工验收的 AI 变更评审插件，当前为 Beta，Release 安装包尚待发布。需手动点击「审查全部」或对单个文件发起审查；自动触发尚未接入。

React 客户端由宿主提供 React/ReactDOM；插件独立实现，界面基于作者个人原型。Cordis 宿主通过 connection 路由使用纯 Node 核心库，不启动独立业务服务。浏览器测试服务仅为合成夹具。

## 本地构建与验证

```sh
npm ci
npm run typecheck
node plugin/scripts/build.mjs
node --import tsx plugin/tests/run.mjs /tmp/evidentloop-plugin-tests
node --import tsx plugin/tests/browser-headless.mjs /tmp/evidentloop-browser-tests
node core/tests/all.mjs /tmp/evidentloop-core-tests
```

在仓库根目录用 `npm ci` 安装锁定的开发依赖；UI 测试使用已有 Playwright 与系统 Chrome。构建脚本不自动安装依赖。优先解析本地依赖，也兼容已有工具缓存；可用 `ESBUILD_PACKAGE`、`REACT_PACKAGE`、`PLAYWRIGHT_PACKAGE` 指定相应 package.json。测试使用合成输入，真实模型调用为 0；不操作用户浏览器或主应用实例。

`tests/toolbar-browser.mjs --before` 的可选旧版对比需要设置 `EVIDENTLOOP_BASELINE_STYLES` 与 `EVIDENTLOOP_BASELINE_CLIENT`，分别指向自己的基线 CSS 和浏览器夹具脚本。

`node plugin/scripts/package.mjs <外部目录/file.tgz>` 只生成本地离线安装包和清单，不上传或发布。安装与真实模型验证须另行授权。

客户端与宿主源码使用严格 TypeScript；`tsconfig.json` 采用 `react-jsx` 与 Bundler 解析。esbuild 在打包时转换为宿主提供的 `React.createElement`，保持 ModuleLoader 只依赖 React/ReactDOM，输出仍为 `dist/host.mjs` 与 `dist/client.js`。`core/` 保持可直接运行的 Node MJS；声明定义 adapter 消费的数据边界，模型输出类型由现有 schema 生成，`typecheck` 会检查是否过期。运行时证据校验仍由 core 执行。

## 数据和适配接口

- `host/service.ts`：真实工作区/仓库寻址、准备锁、需求order、设置、所选记录/冻结文件、Mark/批注、MD/HTML、锁定发回、代码段追问。各类写入由core再次校验当前记录；工作区归属不靠UI数组推断。
- `host/dsh-adapter.ts`：本次发起开发会话配置、原生受控Agent、tools=[]、单步/失败不重试、真实取消与等待、原始文本落盘、自身会话登记。原始返回不修补为合格JSON。
- `host/bridge.ts` / `client/native.ts`：按发起client和目标Session寻址，nonce/期限/实际回执；草稿CAS且保留引用附件，不发送消息。文件打开、代码引用与剪贴板只在原生回执成功后报告成功。
- `client/`：两层页面、文件树、双视图、六段概览、Diff2Html位置承载、统一建议区域、问题处置与批注、历史只读、真实设置与扩展编辑保护。主题跟随DSH，不增加产品主题开关。

当前自动触发接线仍属P5，自动模式偏好可保存；本轮由人工发起。`conversation.chat.turnTail` 使用renderer给出的session作用域sessionId，不能用当前主会话代替历史或侧栏会话。

## 隔离模型预算门禁

程序缺省不创建预算文件，也不发起真实模型调用。每轮须主控确认后，才在隔离私有存储写入独立 `model-approval.json`。必需字段：approvedBy、taskId、expiresAt、maxCalls、provider、model、reasoningEffort，以及**本次公开仓的projectKey、冻结inputSha、promptVersion**；used必须是非负整数，maxInputBytes/maxOutputTokens可进一步限定。

缺失、过期、计数格式错误、仓库/冻结输入/方法/模型不匹配均拒绝模型调用。预算计数在受控Agent准备成功且即将提交原生请求时扣减，初始化失败不消耗一次调用。此文件不含账号凭据，不打入源码、安装包或公开证据；主DSH配置、账号和网络保持不变。

## 范围边界

真实模型与原生端到端按任务门禁单独验证；合成检查不能代替原生能力或质量判断。生产宿主、实机IME、跨进程多写入者、物理磁盘满与发布扫描另行验收。来源：Diff2Html官方vendor及许可证；Material Icon Theme 5.38.1的实际SVG与MIT许可证，见vendor/material/source.json；未搬原型业务代码。
