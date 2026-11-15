import type { ClientRuntime } from "./runtime.ts";
import type {
  RuntimeState,
  ReviewRecord,
  Jump,
  DraftTemplate,
  DraftChoice,
  DraftLock,
  DraftResult,
  FileEntry,
} from "../shared/contracts.ts";
interface TreeNode {
  folders: Map<string, TreeNode>;
  files: FileEntry[];
  path?: string;
}
import { errorMessage } from "../shared/contracts.ts";
import React, { useEffect, useRef, useState } from "react";
import { Overview } from "./overview.tsx";
import { Diff } from "./diff.tsx";
import {
  Dialog,
  Icon,
  IconButton,
  Menu,
  Link,
  Clip,
  localTime,
  basename,
} from "./ui.tsx";
export function Review({
  runtime,
  state,
  openSettings,
  gateBadge,
}: {
  runtime: ClientRuntime;
  state: RuntimeState;
  openSettings: React.MouseEventHandler<HTMLButtonElement>;
  gateBadge?: React.ReactNode;
}) {
  const r = state.record!,
    files = r.snapshot.files,
    [selected, setSelected] = useState(
      () => r.run?.findings?.[0]?.anchor.path || files[0]?.path,
    ),
    [tree, setTree] = useState(true),
    [width, setWidth] = useState(250),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [preferredSplit, setPreferredSplit] = useState(false),
    [addedSplitChoices, setAddedSplitChoices] = useState<
      Record<string, boolean>
    >({}),
    [explanation, setExplanation] = useState(false),
    [anchor, setAnchor] = useState<Jump | null>(null),
    [draftTemplate, setDraftTemplate] = useState<DraftTemplate | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null),
    run = r.run,
    busy = ["running", "queued"].includes(run?.status || ""),
    active = (run?.findings || []).filter(
      (f) => !r.marks.some((m) => m.findingId === f.findingId && m.suppressed),
    ),
    risk = new Set(active.map((f) => f.anchor.path)),
    changed = new Set([
      ...(r.comparison?.added || []),
      ...(r.comparison?.changed || []),
    ]),
    gate = state.data!.modelTestGate.approved;
  const reviewActionLabel = !run
    ? "审查全部"
    : run.status === "failed"
      ? "重试"
      : run.status === "cancelled"
        ? "重新审查"
        : run.complete
          ? null
          : (r.reviewablePaths || []).some(
                (p) => !run.coverage.reviewed.includes(p),
              )
            ? "审查全部"
            : null;
  const selectedFile = files.find((f) => f.path === selected),
    addedLayout =
      selectedFile?.change === "added" || selectedFile?.baseLineCount === 0,
    layoutKey = r.snapshot.snapshotId + ":" + selected;
  const split = addedLayout
    ? Object.prototype.hasOwnProperty.call(addedSplitChoices, layoutKey)
      ? addedSplitChoices[layoutKey]
      : false
    : preferredSplit;
  const setSplit = (value: boolean) => {
    const next = Boolean(value);
    setPreferredSplit(next);
    if (addedLayout)
      setAddedSplitChoices((old) => ({ ...old, [layoutKey]: next }));
  };
  const args = () => ({
    workspaceId: runtime.workspaceId(),
    deliveryId: r.delivery.deliveryId,
    snapshotId: r.snapshot.snapshotId,
  });
  useEffect(() => {
    if (!files.some((f) => f.path === selected)) setSelected(files[0]?.path);
  }, [r.snapshot.snapshotId]);
  useEffect(() => {
    if ((filter === "risk" && !risk.size) || (filter === "changed" && !changed.size)) {
      setFilter("all");
    }
  }, [filter, risk.size, changed.size]);
  const jump = (ref: Jump) => {
    if (!ref?.path) return;
    const file = files.find(
      (f) => f.path === ref.path || f.oldPath === ref.path,
    );
    if (!file) {
      runtime.update({ error: "该引用不属于所选审查记录" });
      return;
    }
    setSelected(file.path);
    setAnchor({ ...ref, path: file.path, token: Date.now() });
    runtime.update({ view: "diff" });
  };
  const shown = files.filter(
    (f) =>
      f.path.toLowerCase().includes(query.toLowerCase()) &&
      (state.view === "overview" ||
        filter === "all" ||
        (filter === "risk" && risk.has(f.path)) ||
        (filter === "changed" && changed.has(f.path))),
  );
  const review = (force = false) =>
    runtime.perform(() =>
      runtime.run("review", {
        ...args(),
        scope: force ? "all" : "incremental",
        force,
      }),
    );
  const sourceLabel = (range: ReviewRecord["snapshot"]["range"]) =>
    range.kind === "empty-tree-worktree" ? "无历史提交，全部视为新增" : range.headSha === range.baseSha
      ? "未提交的改动"
      : "提交「" +
        (range.headSubject || "提交") +
        "」" +
        (range.dirty ? " + 未提交改动" : "");
  const modelNote = run?.model?.adapter === "synthetic"
    ? "测试记录 · 未调用真实 AI 模型"
    : run?.model?.adapter === "dsh" && run.model.provider
      ? "真实模型 · " + (run.model.name || run.model.model) + " · " + run.model.provider
      : "";
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const start = e.clientX,
      original = width,
      max = Math.min(480, bodyRef.current!.clientWidth * 0.45);
    const move = (ev: PointerEvent) =>
      setWidth(Math.max(180, Math.min(max, original + ev.clientX - start)));
    const end = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end, { once: true });
  };
  return (
    <section className="el-review">
      <div className="el-review-heading">
        <button className="el-btn" onClick={() => runtime.back()}>
          <Icon name="back" />
          返回
        </button>
        <div className="el-review-title">
          <h2>
            <Clip>{r.delivery.title}</Clip>
          </h2>
          <p>
            <span className="el-path">
              {r.delivery.branch || "分支信息不可用"}
            </span>{" "}
            ·{" "}
            <span
              title={
                sourceLabel(r.snapshot.range) +
                " · " +
                (r.snapshot.range.baseSha || "").slice(0, 8)
              }
            >
              {r.snapshot.range.kind === "empty-tree-worktree" ? "无历史提交，全部视为新增" : r.delivery.branch ===
              r.snapshot.range.targetRef?.replace(/^refs\/heads\//, "")
                ? "未提交的改动"
                : "相比 " +
                  (r.snapshot.range.targetRef || "目标分支") +
                  " 的改动"}
            </span>{" "}
            ·{" "}
            <Menu
              label={"切换审查记录（共" + r.history.length + "次）"}
              items={r.history.map((h, i) => ({
                label:
                  localTime(h.createdAt) +
                  (i === 0 ? " · 最新" : "") +
                  " · " +
                  h.statusText,
                note: [sourceLabel(h.range), h.snapshotId === r.snapshot.snapshotId ? modelNote : ""].filter(Boolean).join(" · "),
                selected: h.snapshotId === r.snapshot.snapshotId,
                action: () =>
                  runtime.perform(() =>
                    runtime.open(
                      r.delivery.deliveryId,
                      state.view,
                      h.snapshotId,
                    ),
                  ),
              }))}
            >
              审查记录 · {r.readOnly ? "" : "最新 "}
              {localTime(r.snapshot.createdAt)}
            </Menu>
          </p>
        </div>
        {gateBadge}
        <span className="el-header-spacer" />
      </div>
      {r.readOnly && (
        <div className="el-history-notice">
          正在查看较早的审查记录（只读）·{" "}
          <Link
            onClick={() =>
              runtime.perform(() =>
                runtime.open(r.delivery.deliveryId, state.view),
              )
            }
          >
            打开最新审查
          </Link>
        </div>
      )}
      {r.extensionChanged && (
        <p className="el-review-notice">
          扩展提示词已更改，重新审查全部后按新要求生成结论。
        </p>
      )}
      <div className="el-review-toolbar">
        <IconButton
          label={tree ? "收起文件栏" : "展开文件栏"}
          icon="tree"
          size="tree"
          aria-expanded={tree}
          onClick={() => setTree(!tree)}
        />
        <div className="el-view-switch" role="tablist" aria-label="主区域视图">
          <button
            className="el-btn"
            role="tab"
            aria-selected={state.view === "overview"}
            aria-pressed={state.view === "overview"}
            onClick={() => runtime.update({ view: "overview" })}
          >
            变更说明
          </button>
          <button
            className="el-btn"
            role="tab"
            aria-selected={state.view === "diff"}
            aria-pressed={state.view === "diff"}
            onClick={() => runtime.update({ view: "diff" })}
          >
            文件对比
          </button>
        </div>
        {busy ? (
          <button
            className="el-btn"
            onClick={() =>
              runtime.perform(() =>
                runtime
                  .run("cancel", args(), { open: false })
                  .then(() => runtime.reloadRecord()),
              )
            }
          >
            取消审查
          </button>
        ) : (
          <>
            {reviewActionLabel ? (
              <button
                className="el-primary"
                disabled={r.readOnly || !gate}
                onClick={() => review()}
              >
                {reviewActionLabel}
              </button>
            ) : (
              !run?.complete && (
                <button
                  className="el-status-link"
                  onClick={() => {
                    runtime.update({ view: "overview" });
                    queueMicrotask(() =>
                      document
                        .getElementById("overview-problems")
                        ?.scrollIntoView({ block: "start" }),
                    );
                  }}
                >
                  {r.statusText}
                </button>
              )
            )}
          </>
        )}
        <div
          className={
            "el-file-filter " + (state.view !== "diff" ? "el-invisible" : "")
          }
          role="radiogroup"
          aria-label="文件过滤"
          aria-hidden={state.view !== "diff"}
        >
          {[
            ["all", "全部文件", files.length],
            ...(risk.size > 0 ? [["risk", "风险文件", risk.size]] : []),
            ...(changed.size > 0 && changed.size < files.length
              ? [["changed", "新改动", changed.size]]
              : []),
          ].map(([id, label, count]) => (
            <label key={id} data-filter-mode={id}>
              <input
                type="radio"
                name="el-file-filter"
                checked={filter === id}
                value={id}
                tabIndex={state.view === "diff" ? 0 : -1}
                onChange={() => setFilter(String(id))}
              />
              <span className="el-file-filter-option">
                <span
                  className={"el-file-filter-label el-file-filter-label--" + id}
                >
                  {label}
                </span>
                <b
                  className={"el-file-filter-count el-file-filter-count--" + id}
                >
                  {count}
                </b>
              </span>
            </label>
          ))}
        </div>
        <span className="el-header-spacer" />
        <span
          className={state.view !== "diff" ? "el-invisible" : ""}
          aria-hidden={state.view !== "diff"}
        >
          <IconButton
            label={split ? "切换为单栏" : "切换为双栏"}
            icon={split ? "single" : "split"}
            size="toolbar"
            tabIndex={state.view === "diff" ? 0 : -1}
            onClick={() => setSplit(!split)}
          />
        </span>
        <Menu
          label="导出与发回"
          icon="download"
          size="toolbar"
          items={[
            {
              label: "变更日志（Markdown）",
              action: () => runtime.perform(() => runtime.download("md")),
            },
            {
              label: "评审报告（HTML）",
              action: () => runtime.perform(() => runtime.download("html")),
            },
            {
              label: "嵌入完整 Diff",
              checkbox: true,
              keepOpen: true,
              selected: state.data!.settings!.exportEmbedDiff,
              action: () =>
                runtime.perform(async () => {
                  await runtime.api("settings", {
                    workspaceId: runtime.workspaceId(),
                    settings: {
                      ...state.data!.settings!,
                      exportEmbedDiff: !state.data!.settings!.exportEmbedDiff,
                    },
                  });
                  await runtime.refresh();
                }),
            },
            { separator: true },
            {
              label: "发回会话 · 修改问题",
              disabled: !r.delivery.sessionIds.length || !r.run,
              action: () => setDraftTemplate("issues"),
            },
            {
              label: "发回会话 · 补充说明",
              disabled: !r.delivery.sessionIds.length || !r.run?.understanding,
              action: () => setDraftTemplate("understanding"),
            },
            { separator: true },
            {
              label: "全部重新审查",
              disabled: r.readOnly || busy || !gate,
              danger: true,
              action: () => review(true),
            },
          ]}
        />
        <IconButton
          label="工作区设置"
          icon="settings"
          size="toolbar"
          onClick={openSettings}
        />
      </div>
      <div ref={bodyRef} className="el-review-body">
        {tree && (
          <>
            <aside className="el-file-tree" style={{ width }}>
              <label className="el-search">
                <Icon name="search" size={14} />
                <input
                  type="search"
                  aria-label="搜索文件或路径"
                  placeholder="搜索文件或路径"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <nav aria-label="改动文件">
                <FileTree
                  files={shown}
                  selected={selected}
                  weak={state.view === "overview"}
                  risk={risk}
                  reviewed={r.run?.coverage.reviewed || []}
                  jump={jump}
                  searching={Boolean(query)}
                />
              </nav>
              {!shown.length && (
                <p className="el-muted">没有符合条件的文件。</p>
              )}
            </aside>
            <div
              className="el-tree-resizer"
              role="separator"
              tabIndex={0}
              aria-label="调整文件栏宽度"
              aria-orientation="vertical"
              aria-valuemin={180}
              aria-valuemax={480}
              aria-valuenow={Math.round(width)}
              onPointerDown={startResize}
              onKeyDown={(e) => {
                if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                  e.preventDefault();
                  setWidth(
                    Math.max(
                      180,
                      Math.min(480, width + (e.key === "ArrowLeft" ? -16 : 16)),
                    ),
                  );
                }
              }}
            />
          </>
        )}
        {state.view === "overview" ? (
          <Overview runtime={runtime} record={r} jump={jump} />
        ) : (
          <Diff
            key={r.snapshot.snapshotId}
            runtime={runtime}
            record={r}
            path={selected}
            sideBySide={split}
            anchor={anchor}
            showExplanation={explanation}
            onToggleExplanation={() => setExplanation(!explanation)}
            onFile={jump}
          />
        )}
      </div>
      {draftTemplate && (
        <DraftDialog
          runtime={runtime}
          record={r}
          template={draftTemplate}
          close={() => setDraftTemplate(null)}
        />
      )}
    </section>
  );
}
function DraftDialog({
  runtime,
  record,
  template,
  close,
}: {
  runtime: ClientRuntime;
  record: ReviewRecord;
  template: DraftTemplate;
  close(): void;
}) {
  const [lock, setLock] = useState<DraftLock | null>(null),
    [result, setResult] = useState<DraftResult | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    runtime
      .api("draft/lock", {
        workspaceId: runtime.workspaceId(),
        deliveryId: record.delivery.deliveryId,
        snapshotId: record.snapshot.snapshotId,
        template,
      })
      .then((value) => {
        if (live) setLock(value);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, []);
  const commit = async (choice: DraftChoice) => {
    if (!lock?.available) return;
    setBusy(true);
    try {
      const value = await runtime.api("draft/commit", {
        token: lock.token,
        displayedSnapshotId: runtime.state.record?.snapshot.snapshotId,
        choice,
      });
      setResult(value);
      if (value.status === "written") {
        close();
        await runtime.native.openSession(value.targetId);
      } else if (value.status === "failed") setError(value.reason);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={
        template === "issues" ? "发回会话 · 修改问题" : "发回会话 · 补充说明"
      }
      close={close}
      className="el-wide-dialog"
    >
      {!lock && !error ? (
        <p>正在锁定所选记录的内容…</p>
      ) : lock?.available ? (
        <>
          <p>
            以下内容已锁定为 {localTime(record.snapshot.createdAt)}{" "}
            的审查记录。只写草稿，不发送。
          </p>
          {template === "understanding" && (
            <p>请在会话草稿里填写所需 Skill 名称；插件不会读取或执行它。</p>
          )}
          <textarea readOnly aria-label="发回内容预览" value={lock.text} />
          {lock.omitted.length > 0 && (
            <p>部分条目超过长度上限，省略清单已写在末尾。</p>
          )}
          {result?.status === "preview" && (
            <>
              <p>目标会话已有草稿、引用或附件。可追加到末尾或仅复制。</p>
              <details>
                <summary>查看已有草稿</summary>
                <pre>{result.existingDraft.text || "已有引用或附件。"}</pre>
              </details>
            </>
          )}
          {result && result.status !== "preview" && (
            <p role="status">
              {result.status === "copied"
                ? "已复制。"
                : result.status === "unchanged"
                  ? "相同内容已在草稿中。"
                  : "reason" in result
                    ? result.reason
                    : ""}
            </p>
          )}
          <footer>
            <button className="el-btn" onClick={close}>
              关闭
            </button>
            <button
              className="el-btn"
              disabled={busy}
              onClick={() => commit("copy")}
            >
              复制
            </button>
            <button
              className="el-primary"
              disabled={busy}
              onClick={() =>
                commit(result?.status === "preview" ? "append" : "auto")
              }
            >
              {busy
                ? "正在处理"
                : result?.status === "preview"
                  ? "追加到末尾"
                  : "写入会话草稿"}
            </button>
          </footer>
        </>
      ) : (
        lock && !lock.available && <p>{lock.reason}</p>
      )}
      {error && (
        <p role="alert" className="el-error">
          {error}
        </p>
      )}
    </Dialog>
  );
}
function FileTree({
  files,
  selected,
  weak,
  risk,
  reviewed,
  jump,
  searching,
}: {
  files: FileEntry[];
  selected?: string;
  weak: boolean;
  risk: Set<string>;
  reviewed: string[];
  jump(ref: Jump): void;
  searching: boolean;
}) {
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const root: TreeNode = { folders: new Map(), files: [] };
  for (const file of files) {
    let node = root;
    const parts = file.path.split("/");
    let prefix = "";
    for (const part of parts.slice(0, -1)) {
      prefix += (prefix ? "/" : "") + part;
      if (!node.folders.has(part))
        node.folders.set(part, { folders: new Map(), files: [], path: prefix });
      node = node.folders.get(part)!;
    }
    node.files.push(file);
  }
  const extensions: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "react",
    tsx: "react_ts",
    css: "css",
    vue: "vue",
    html: "html",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    py: "python",
    java: "java",
    go: "go",
    rs: "rust",
    sh: "file",
  };
  const icon = (key: string) => (
    <img
      alt=""
      aria-hidden="true"
      className="el-material-icon"
      src={"/api/dsh-evidentloop/assets/material/" + key + ".svg"}
    />
  );
  const render = (node: TreeNode): React.ReactNode => (
    <div className="el-tree-level">
      {[...node.folders]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, child]) => {
          const closed = !searching && collapsed.has(child.path!),
            folder = ["src", "scripts", "docs"].includes(name)
              ? "folder-" + name
              : "folder";
          return (
            <div key={child.path}>
              <button
                className="el-tree-folder"
                aria-expanded={!closed}
                onClick={() =>
                  setCollapsed((old) => {
                    const next = new Set(old);
                    next.has(child.path!)
                      ? next.delete(child.path!)
                      : next.add(child.path!);
                    return next;
                  })
                }
              >
                {icon(folder + (closed ? "" : "-open"))}
                <Clip>{name}</Clip>
              </button>
              {!closed && (
                <div className="el-tree-children">{render(child)}</div>
              )}
            </div>
          );
        })}
      {node.files.map((file) => (
        <button
          key={file.path}
          title={file.path}
          className={
            "el-tree-file " +
            (selected === file.path
              ? weak
                ? "el-tree-weak"
                : "el-tree-selected"
              : "")
          }
          onClick={() => jump({ path: file.path })}
        >
          {icon(extensions[file.path.split(".").at(-1) || ""] || "file")}
          <Clip>{basename(file.path)}</Clip>
          {risk.has(file.path) ? (
            <span className="el-risk-dot" aria-label="有有效问题" />
          ) : reviewed.includes(file.path) ? (
            <Icon name="treeCheck" size={14} strokeWidth={1.5} />
          ) : null}
        </button>
      ))}
    </div>
  );
  return render(root);
}
