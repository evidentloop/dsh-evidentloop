# EvidentLoop 纯 Node 核心库

ESM、Node >=20，无运行时第三方依赖，不导入 DSH/Electron。本目录包含冻结准备器、四层校验器、Diff 解析与 Schema evaluator；测试不调用真实模型。

## 入口

从index.mjs导入：

    import { ReviewCore, FileStore, Drafts, RequirementLedger, markdown, html } from './core/index.mjs';

    const core = await new ReviewCore({
      storageRoot: '/your/private-data/evidentloop', // 必须在Git仓库之外
      methodRoot: '/your/method/evidentloop-review',
      adapter: yourHostAdapter,
    }).initialize();

    const run = await core.trigger({ repo, sessionId, requirements: ledger.sources() });
    const view = core.selected(projectKey, run.snapshotId);
    const md = markdown(view);
    const report = html(view, { embedDiff: false });

库返回字符串，不把导出自动写进用户仓库。prepare/validate也有CLI，参数见文件底部usage；包级入口通过命名export提供。methodRoot未传时指向本仓skills/evidentloop-review；独立使用可显式传入9文件方法目录，import本身不要求方法目录存在。

## adapter合同

| 方法 | 输入/输出与责任 |
|---|---|
| review(request,{signal}) | request含冻结snapshot、bundleRoot、已冻结方法模块text/hash、reviewPaths、carriedPaths及tools=[]；返回符合锁定Schema的模型JSON。必须把signal接到真实取消并等待settle，不能发送写工具或回读实时工作区 |
| session(id) | 返回{id,kind,origin,parentSession,projectKey,archived,title}或null；kind=review由宿主按自身Run/Session登记映射，不能只看会话名称；origin=subagent时沿parentSession回主会话 |
| getDraft(id) | 返回{text,revision,quotes,attachments}，按指定Session寻址，不读当前活跃会话代替 |
| writeDraft(id,text,{expectedRevision,preserveQuotesAndAttachments}) | CAS写入草稿，不发送、不调用模型；保留引用与附件，不支持时返回false或抛错 |
| copy(text) | 复制同一份锁定最终正文；失败必须抛错，库将返回failed及可手动复制的文字 |

SyntheticAdapter是明确标注的合成实现，供测试，不代表真实模型。Store也可注入；FileStore为纯Node实现，宿主只需提供私有目录。自定义store需实现FileStore同名的settings/deliveries/snapshot/runs/events、串行写入、删除与recover接口，以及assertOutsideRepository，模型不接触这些写接口。

ReviewCore.trigger负责仓库解析、归组、提交观测和冻结；requestBundle是宿主已确认输入的低层入口，消费合法外部bundle。reviewCurrent支持scope=incremental或file:<path>；force=true为全部重新审查，绕过复用/沿用。单文件调用仍要求模型返回全快照说明结构，问题仅针对reviewPaths；core只把实际审查和合法沿用路径计入覆盖。

## 状态与数据

- 项目键来自真实repoRoot路径；开发分支按分支，目标分支按根会话，无会话手动请求按独立manual键。origin/HEAD解析真实目标；无法确认当前分支时返回incomplete，不用目标分支冒充。
- 提交观测先于快照去重；原样提交可复用同inputSha，但更新lastHeadSha/everAhead。关闭一次后不会再次强制归档；新改动用新交付。
- 同交付才缓存/沿用/复制Mark；新Run重映射featureId/findingId。沿用内容是实体复制，删来源后仍可展示/导出；不复制批注。整体说明每次重新生成，完整同输入复用例外。
- 每仓库串行，跨仓库独立；同交付排队scope取并集。先更新current/generation再取消，等待旧适配器settle后检查目标；晚到结果仅留旧Run，不改当前结果。
- 自动资格判断在core中默认关闭，排除未知和自身审查Session；DSH turn事件注册与自动模式产品接线仍属P5/P4，不在本库启动。
- RequirementLedger消费宿主提供的稳定消息id/sequence，手动添加前先纳入截至该动作的消息。已有order不变，不按时间猜序；无法确认就失败。持久化state可存入宿主交付数据，sources()用于freeze；文本、码点区间、itemId由准备器冻结。

私有目录按projectKey分settings.json、deliveries/、snapshots/<id>/{snapshot.json,blobs/}、runs/、marks.jsonl、annotations.jsonl。blobs内是完整可消费审查包；根与blobs的snapshot元数据绑定同一ID。快照API拒绝覆写，文件哈希与diff在消费时重核。

写入每仓库串行；JSON临时写+fsync+rename；事件逐行追加并fsync。追加失败后该流拒绝继续追加，recover清理不完整末行再开放；running启动改failed/interrupted。完整中间坏行不静默丢弃。只支持一个写入实例拥有同一私有目录，不承诺跨进程数据库事务；进程内排队意图不自动跨重启执行。

删除会等待对应活动Run取消，级联删除快照/Run/Mark/批注并更新current/latest指针；晚到写回无法重建已删数据。历史只读校验在写入时再次检查。置顶/归档与关闭字段按仓库保存。

## 导出与发回

Markdown与HTML从同一结构化数据生成。HTML无外部资源，使用nonce CSP、转义和安全JSON数据块；代码片段/完整Diff/总UTF-8体积均有上限与省略清单。预算过小连元数据都无法容纳时拒绝生成，不输出超预算文件。默认2MiB、片段12行/8KiB、单Diff256KiB，均可配置。

扩展正文只在HTML包含：原sha/长度与redacted/truncated分别记录；Markdown和草稿不附扩展正文。需求项导出文本按原码点区间先取片段再脱敏，避免脱敏后区间错位。默认脱敏不是完整发布审计，组织私有词表通过patterns传入，P4发布准出仍需独立扫描。

Drafts.lock(view,'issues'|'understanding')返回预览token和不可变正文副本；commit(token,{displayedSnapshotId,choice:'auto'|'append'|'copy'})再次核对目标Session/仓库/归档/显示快照，失效则复制。已有草稿仅预览，明确append才追加，保留原字节、引用与附件；同正文不重复追加。锁定后Mark/批注变化不改变已预览文字。没有开发会话或无有效说明时对应入口不可用。

## 验证

    node core/tests/all.mjs /private/tmp/new-core-test-output

纯Node运行85个提取管线用例及核心/Git/存储/导出/草稿夹具；临时Git仓用fs/zlib构造，不调用Git写命令。输出目录必须是新的，结果和失败历史不覆盖。dogfood另执行：

    node core/tests/dogfood.mjs /path/to/repo /private/tmp/new-dogfood-output

dogfood使用指定公开仓的真实diff和明确标注的合成adapter（本轮经用户裁决为sopify；不初始化unborn本仓）生成CHANGELOG.md/review.html，不伪称AI审查或质量结论。HTML离线打开的浏览器验证独立留证；库本身不依赖浏览器。

生产DSH权限/会话服务、真实模型、实机IME、跨进程并发写入、物理磁盘满及全部操作系统未在P3验证。Node故障注入不等同物理满盘。合成测试的通过不代表这些环境边界已验证。

## P4 受控接缝增量

- `trigger({captureOnly:true})` 只冻结并更新当前输入，不调用模型；相同输入复用当前记录。新输入仍先更新代次、取消不匹配的旧运行并等待，返回前再次核对当前目标。
- `expectedDeliveryId` 可把所选交付绑定到本次准备动作，分支/会话已改变时拒绝跨交付执行。
- 可选 `onPrepared({projectKey,deliveryId,snapshotId,inputSha,generation})` 在当前输入落盘后、等待旧模型取消或提交新审查前调用。宿主借此按仓库串行归并需求来源并释放准备锁；锁不能持有到模型结束，否则取消等待期的新输入无法前进。
- `Deliveries.findOpen(projectKey,input)` 与正式归组共享同一绑定算法，宿主无需另建交付状态机。
- adapter 的审查 request 额外携带已解析的 `sourceSessionId`（有开发来源时），用于继承发起会话的配置；它不进入输入指纹。批注删除后恢复相同ID时保留原创建时间。

这些增量不改变模型Schema、方法文件或原型。插件通过这些接口连接宿主；历史测试记录不作为当前运行的保证。
