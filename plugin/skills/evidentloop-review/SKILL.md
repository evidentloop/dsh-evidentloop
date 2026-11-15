---
name: evidentloop-review
description: 审查一次代码交付：说明改了什么、怎么实现、是否对齐需求，并找出问题，结论全部引用冻结快照中的代码行。由 dsh-evidentloop 插件的受控审查加载，也可在对话中手动调用。输入是一个已冻结的审查包，输出是一个符合 schema/run.schema.json 的 JSON。
---

# EvidentLoop 交付审查

你在审查一次已经冻结的代码交付。目标是让人**更快看懂这次改了什么、怎么实现、是否做到了需求**，并指出真实存在的问题。没有问题时，变更说明同样要完整。

## 输入：审查包

审查包由插件（或手动试验时的准备脚本）生成，你只读它，不读工作区里的实时文件：

| 文件 | 内容 |
|---|---|
| `bundle/snapshot.json` | 快照：文件清单（path、oldPath、change、kind、两侧哈希、增删行数）、对比范围、需求依据、`inputSha`、`promptVersion` |
| `bundle/base/<path>`、`bundle/head/<path>` | 每个审查目标文件的旧侧与新侧全文（冻结内容）。行号以这里为准 |
| `bundle/diff/<path>.patch` | 每个审查目标文件的 diff |
| `bundle/requirements.json` | 需求依据：来源、全文、条目（itemId 与在原文中的区间）。可能为空 |
| `bundle/targets.json` | 本次必须审查的文件清单（审查目标）。`files[]` 必须恰好覆盖这些文件 |
| `bundle/rules.json` | 本次加载的审查规则（id、类别、说明）。`ruleSource.id` 只能取自这里 |
| `bundle/extension.md` | 工作区扩展提示词（可能没有）。可指定重点检查或不报告的问题类型，以及某类问题的严重度（覆盖 `references/findings.md` 的默认判级，仍限 P0–P2）。不能改变输出结构、证据要求与「什么算问题」的边界；「不报告」不减少审查目标与逐文件理解。据此提出的问题 `ruleSource` 写 `{ "kind": "project", "id": "extension" }` |

`kind` 为 binary、oversize、excluded、submodule 的文件，以及只有元数据变化（如仅改权限）的文件，不在审查范围：不会出现在 `targets.json` 中，不要为它们写说明或问题。

## 必须遵守的模块

以下模块由插件一并注入，**全部适用**，冲突时以模块为准：

- `references/understanding.md`：逐文件理解、功能归并、行为影响怎么写
- `references/alignment.md`：需求对齐怎么判
- `references/findings.md`：问题的类别、严重度、证据
- `references/quality-rules.md`：所有文字的质量规则

## 步骤

1. **读需求**：读 `requirements.json`。没有需求依据时，后面只做变更说明和问题审查，不做需求对齐。
2. **逐文件理解**：对每个审查目标文件，读 diff，并按需读该文件冻结全文的上下文；需要理解调用关系时，读审查包中其他文件。写出该文件的变更摘要要点（`understanding.md`）。
3. **功能归并**：把文件归成几个功能改动，每个写目的与实现路径。
4. **行为影响**：写出对调用方、接口、数据、配置、依赖、界面的影响。
5. **需求对齐**：逐个需求条目给出状态，并列出需求之外的改动（`alignment.md`）。
6. **问题审查**：找出真实问题，每条都带能逐字核对的证据（`findings.md`）。
7. **自查后输出**：按 `quality-rules.md` 删掉套话和无引用的句子，按 `schema/run.schema.json` 输出**一个 JSON 对象**，不输出其他文字。

## 引用格式

所有引用都是 `{ "path", "side": "base"|"head", "startLine", "endLine" }`，行号对应 `bundle/base|head/<path>` 中的冻结内容，从 1 开始。新增的代码引用 head 侧，被删除的代码引用 base 侧。

## 你不做的事

- 不评价代码风格、命名、可维护性，不给可选的改进建议（这些不是问题）。
- 不推测审查包之外的代码；看不到的就写「未能从代码判断」。
- 不修改任何文件，不运行命令。
- 不编造需求：需求依据里没有的，不当成需求。

## 输出语言

与需求依据的语言一致；没有需求依据时，与对话语言一致。代码、符号、路径保持原样。
