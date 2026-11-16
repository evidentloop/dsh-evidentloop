# DSH 变更评审交互原型

这是 EvidentLoop 的离线交互原型。交付列表、文件树、单双栏 Diff、问题卡片、批注、需求依据、发回草稿与导出均可操作。审查结论与历史记录为示例数据，不调用真实模型；正式插件的安装和使用见[主说明](../README.md)。

## 打开与操作

直接打开 `prototype/index.html`，或用静态文件服务器打开。资源全部来自本目录，不需要安装依赖，也不会发出网络请求。建议使用至少 640px 宽的桌面窗口；更窄时显示宽度提示。

- 默认进入交付列表。点交付卡片或标题，打开「文件对比」；底部「变更说明 →」打开整批说明，最近会话链接打开对应会话。
- 左侧「变更评审」返回列表；对话交付卡片中的「审查本次变更」直接进入评审台。顶栏「返回」按进入来源返回。
- 评审台可切换「文件对比 / 变更说明」，筛选文件、跳转问题、写批注或标记非问题。历史审查记录只读。
- 「导出与发回」可导出 Markdown、离线 HTML，或预览修改意见后写入模拟会话草稿，不会自动发送。
- 工作区设置中的自动审查仅演示偏好保存，不自动审查，也不调用模型。设置保存在演示内存中，刷新后重置；主题等界面偏好可保存在浏览器本地。

## URL 参数

| 参数 | 值与默认行为 |
|---|---|
| `scenario` | 场景键，见下表；缺省为 `list`。 |
| `view` | `list` / `conversation` / `review`。 |
| `main` | `diff` 文件 Diff / `overview` 整批变更说明；缺省由场景决定。 |
| `panel` | `overview` 切到整批变更说明、`file` 打开当前文件说明、`none` 关闭下方面板。 |
| `menu` | `settings` / `export`，打开对应菜单。 |
| `filter` | `all` / `risk` / `pending`。 |
| `file` | 路径片段，选中第一个匹配文件。 |
| `style` | `double` 为双栏，缺省单栏。 |
| `sidebar` | `0` 收起文件栏。 |
| `auto` | `1` 打开自动审查偏好，仅演示设置，不触发模型。 |
| `target` | 目标分支覆盖值（仅展示）。 |
| `embed` | `1` 让 HTML 报告默认嵌入完整 Diff。 |
| `console` | `0` 隐藏演示控制台，`1` 展开；缺省收起但可见。 |
| `theme` | `auto` / `light` / `dark`，控制整页主题；URL 参数优先于演示控制台保存在浏览器本地存储的选择，两者都没有时跟随系统。 |
| `opt` | 沿用基线优化开关，默认 `all`；`none` 关闭交互增强。 |

## 场景（演示控制台可直接切换）

| 键 | 内容 |
|---|---|
| `list` | 交付列表，默认场景。 |
| `list-empty` | 无交付，仍可打开工作区设置。 |
| `list-history` | 交付列表；当前交付在评审台含三条审查记录，可切换。 |
| `reviewed` | 已有结论、发现 7 个问题、一条已标记非问题。 |
| `partial` | 部分文件已审、其余待审。 |
| `unreviewed` | 待审，全部可审查文件等待审查。 |
| `zero` | 未发现问题且审查完整。 |
| `incomplete` | 审查不完整；工具栏显示「3 条未通过校验」，整批说明的问题块保留完整句「3 条结论证据未通过校验，未展示」。 |
| `incremental` | 沿用上次结论 + 其余待审，显示沿用来源。 |
| `history` | 更早的审查记录，处置只读，可「打开最新审查」。 |
| `running` | 运行中，可取消。 |
| `cancelled` | 已取消，可重新审查。 |
| `failed` | 失败，可重试，附失败文件与原因。 |
| `no-requirement` | 未提供需求依据，只做变更说明。 |
| `added-requirement` | 添加需求依据后，全部文件回到待审。 |
| `sendback-draft` | 发回会话时输入框已有草稿，显示预览与追加 / 复制。 |
| `sendback-no-session` | 交付没有开发会话，发回会话不可用。 |
| `auto-on` / `auto-off` | 自动模式开 / 关，并打开设置菜单。 |
| `extension-none` | 扩展提示词未配置，打开设置菜单。 |
| `extension-configured` | 扩展提示词已配置，打开设置菜单。 |
| `extension-changed` | 扩展提示词修改后，评审台显示复查提示。 |
| `preflight-not-git` | 当前目录不是 Git 仓库。 |
| `preflight-no-target` | 目标分支无法确定，引导到设置。 |
| `preflight-no-model` | 未配置可用模型。 |
| `preflight-split-index` | split index 暂不支持。 |

## 数据与边界

`data/snapshot.js` 保存冻结文件与示例交付。文件清单、行数和 Diff 可由仓库 Git 状态生成；功能说明、问题与历史记录为合成数据，不代表真实审查结果。

```sh
node prototype/scripts/build-data.mjs
```

该命令更新原型数据，查看页面本身不改写仓库。新增需求依据会生成演示记录并将文件恢复待审；正式插件由宿主负责冻结输入与持久化。发回、剪贴板和导出均在浏览器中演示，不能代替真实 DSH 的集成验证。

## 验证

使用已有 Playwright 与系统 Chrome，证据目录须在仓库外：

```sh
EVIDENTLOOP_PRIVATE_DENYLIST=/path/to/private-rules.txt \
  node prototype/tests/verify.cjs /path/to/playwright /tmp/evidentloop-prototype-tests
```

完整验证覆盖交付列表、评审台、问题与批注、需求、历史、发回与导出、浅深主题、离线资源、只读守卫和敏感内容检查，共 1211 项以上。脚本写入截图、`verification.json` 与 `verify.log`，失败或超时以非零状态退出；故障自测只在临时夹具运行。私有规则文件不入库；未提供时，相应检查标为跳过。

只读守卫同时比较文件清单和监听写入事件，但不能保证捕获所有瞬时写入。数据生成尚未覆盖已提交改名、clean/process 过滤器与 Git LFS；原型不用于验证这些宿主能力。离线 HTML 导出有 3 MiB 限制，超限时明确列出省略内容。

## 第三方

`vendor/` 包含 Vue、Diff2Html、Splitpanes、marked 和 highlight.js 的本地构建，许可见 `vendor/LICENSES.txt`。文件树图标来自 Material Icon Theme 5.38.1（MIT），原始署名保留在源码中。
