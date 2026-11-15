---
title: EvidentLoop AI 变更评审 · 使用说明
description: AI 写完代码，先看懂改了什么、有没有问题：变更说明、带证据的代码评审、发回修改与审查留档。
version: 0.1.0-rc.1 · Beta
---

# AI 变更评审 · EvidentLoop 使用说明

AI 写代码越来越快时，EvidentLoop 帮你把每批改动整理成一份可以验收的交付：看懂改动、核对需求、查出带证据的问题，再发回修改并留档。

当前为 **0.1.0-rc.1（Beta）发布候选**，由人工点击 「审查全部」 或单文件审查。自动触发尚未接入，留待后续版本；安装方式见 [仓库安装指南](https://github.com/evidentloop/dsh-evidentloop#安装指南)，Release 附件尚待发布。

## 工作流 {#workflow}

1. **改代码**：照常在会话里和 AI 对话。
2. **交付出现**：每个开发分支一个交付，在左侧「变更评审」里。
3. **评审**：点「审查全部」，看说明、问题和需求对齐。
4. **发回或迭代**：把问题和批注发回会话，或继续提需求。
5. **再审**：没变的文件沿用上次结论，只审改过的。
6. **合并与归档**：合并到目标分支后，交付自动收进「已归档」。
7. **找回或删除**：搜索或展开分组找回；不需要的删除。

本页截图与[正式插件实录](demo.html)使用公开项目 sopify 的真实历史审查记录快照；采集时没有重新调用模型。该记录实际审查了其中 1 个变更文件，其余 24 个保留待审；P2 审查意见经人工复核可标记为非问题，批注为演示操作添加。

## 列表与评审台 {#workbench}

### 交付列表

- **工作区**：点页头的工作区名切换，与 DSH 左侧栏一致。
- **排序**：按最近活动排列；置顶的排最前。
- **「…」菜单**：置顶、归档、删除。删除会连同审查记录和批注一起删掉，不能恢复。
- **搜索**：按标题、需求编号或分支，已归档的也能搜到。


<figure class="guide-capture"><a href="assets/deliveries-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/deliveries-dark.png"><img src="assets/deliveries-light.png" alt="正式插件交付列表：搜索、过滤与交付卡片" width="760" height="407" loading="lazy"></picture></a><figcaption>正式插件交付列表：搜索、过滤与交付卡片 · <a href="demo.html">查看实录与浅深主题原图</a></figcaption></figure>

### 整批变更说明

| 部分 | 说明 |
|---|---|
| 结论 | 交付目标、本次改动、审查结论 |
| 按功能的变更 | 为什么改、怎么改、行为影响 |
| 需求对齐 | 未对齐 / 待确认、已对齐、已调整、需求外改动 |
| 问题 | 按严重程度汇总，点击定位代码 |
| 审查覆盖 | 已审、待审、跳过、失败的文件 |
| 需求依据 | 会话里的需求原文，也可以手动添加 |

「已调整」指后来的要求改掉或取消了这一条，不算未对齐。每条说明都标明是「代码事实」还是「模型推断」。


<figure class="guide-capture"><a href="assets/overview-summary-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/overview-summary-dark.png"><img src="assets/overview-summary-light.png" alt="真实模型审查的变更说明；未完成的覆盖继续显示待审" width="1600" height="1000" loading="lazy"></picture></a><figcaption>真实模型审查的变更说明；未完成的覆盖继续显示待审 · <a href="demo.html">查看实录与浅深主题原图</a></figcaption></figure>

### 文件对比与问题

- 筛选：全部文件、风险文件、新改动（与上次审查相比有变化）。
- 问题卡片插在代码行下：类别、严重程度（P0 阻断 / P1 严重 / P2 一般）、问题、影响、建议。
- 每个问题都引用冻结代码的原文作为证据，核对不上的不展示。
- 不认同可以「标记非问题」，随时恢复；也可以在代码行或问题上添加批注。


<figure class="guide-capture"><a href="assets/diff-finding-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/diff-finding-dark.png"><img src="assets/diff-finding-light.png" alt="单栏 Diff 与带行定位的真实审查意见" width="1600" height="1000" loading="lazy"></picture></a><figcaption>单栏 Diff 与带行定位的真实审查意见 · <a href="demo.html">查看实录与浅深主题原图</a></figcaption></figure>

### 审查记录

每次审查都冻结当时的代码和结论。顶栏「审查记录」可以切换到较早的记录，旧记录只读。

## 状态、发回与导出 {#status}

### 审查状态

| 你看到的 | 怎么办 |
|---|---|
| 待审 | 点 「审查全部」 |
| 审查中 | 稍等，可以取消 |
| 3 个文件待审 | 点 「审查全部」 审剩下的 |
| 1 个文件审查失败 | 点重试 |
| 2 条结论未通过校验 | 引用对不上，没有展示；可以重新审查 |
| 代码读取不完整 | 按提示处理后重新审查 |
| 发现 N 个问题 / 未发现问题 | 审查完成 |

### 发回会话

写进开发会话的输入框，**不会自动发送**。

- **修改问题**：批注、待处理问题、未对齐的需求。
- **补充说明**：让 AI 用你指定的 Skill 补充说明，比如画一张图。


<figure class="guide-capture"><a href="assets/draft-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/draft-dark.png"><img src="assets/draft-light.png" alt="发回前预览锁定内容，只写草稿，不自动发送" width="1600" height="1000" loading="lazy"></picture></a><figcaption>发回前预览锁定内容，只写草稿，不自动发送 · <a href="demo.html">查看实录与浅深主题原图</a></figcaption></figure>

### 导出

- **变更日志（Markdown）**：贴进合并请求或交付文档。
- **评审报告（HTML）**：单个文件，离线可看，可以嵌入完整 Diff。


<figure class="guide-capture"><a href="assets/export-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/export-dark.png"><img src="assets/export-light.png" alt="导出菜单：Markdown、离线 HTML 与完整 Diff" width="1600" height="1000" loading="lazy"></picture></a><figcaption>导出菜单：Markdown、离线 HTML 与完整 Diff · <a href="demo.html">查看实录与浅深主题原图</a></figcaption></figure>

导出会遮盖疑似密钥，但仍含代码片段与需求原文，分享前请检查。

## 设置与常见问题 {#reference}

### 设置

设置按 Git 仓库保存，同一仓库的多个工作区共用。

| 设置 | 说明 |
|---|---|
| 自动审查 | 当前版本仅保存偏好，不自动触发；请手动发起审查 |
| 目标分支 | 对比的基准，默认是仓库的默认分支 |
| 扩展提示词 | 指定重点关注什么、严重程度怎么判，最多 20000 字 |
| 导出默认项 | 导出时的默认选项 |

### 隐私

- 只读取仓库，不改动代码、暂存区和提交。
- 审查用你在 DSH 里配置的模型；插件不接入其他外部系统。
- 审查记录、处置与批注只保存在本机。

### 当前限制

- 只审与目标分支对比的改动，不按单个 commit 审查。
- 不处理合并请求、合并与暂存。
- 暂不支持启用了 split index 的仓库；浅克隆需先补全历史。

### 常见问题

**和代码审查插件有什么不同？**
先讲清这批改动做了什么、是否对上需求，再给出带证据的问题，并支持发回修改与留档。

**审查结论可靠吗？**
每个问题都必须引用原文作为证据，核对不上的不展示。结论仍是 AI 的判断，请结合证据确认。

**交付不见了？**
合并后会自动归档，在列表底部的「已归档」里。
