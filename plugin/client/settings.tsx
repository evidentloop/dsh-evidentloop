import { errorMessage } from "../shared/contracts.ts";
import type { ClientRuntime } from "./runtime.ts";
import type { Settings as WorkspaceSettings } from "../shared/contracts.ts";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, Link, Prose } from "./ui.tsx";
export function Settings({
  runtime,
  settings,
  workspaceId,
  anchor,
  sharedRepo,
  close,
}: {
  runtime: ClientRuntime;
  settings: WorkspaceSettings;
  workspaceId: string;
  anchor: HTMLElement;
  sharedRepo: boolean;
  close(): void;
}) {
  const [draft, setDraft] = useState({ ...settings }),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [saving, setSaving] = useState(false),
    latest = useRef({ ...settings }),
    tail = useRef<Promise<unknown>>(Promise.resolve()),
    ref = useRef<HTMLDivElement>(null);
  const rect = anchor?.getBoundingClientRect(),
    left = Math.max(
      8,
      Math.min(
        (rect?.right ?? innerWidth - 16) - 360 || innerWidth - 376,
        innerWidth - 368,
      ),
    ),
    top = Math.min(
      (rect?.bottom ?? 66) + 6 || 72,
      Math.max(8, innerHeight - 420),
    );
  useEffect(() => {
    queueMicrotask(() => ref.current?.querySelector("input")?.focus());
    return () => {
      if (anchor?.isConnected) anchor.focus();
    };
  }, []);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (
        !editing &&
        !ref.current?.contains(e.target as Node) &&
        !anchor?.contains(e.target as Node)
      )
        close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [editing]);
  const persist = <K extends keyof WorkspaceSettings>(
    key: K,
    value: WorkspaceSettings[K],
  ) => {
    const next = { ...latest.current, [key]: value };
    latest.current = next;
    setDraft(next);
    setSaving(true);
    setError("");
    const job = tail.current
      .catch(() => {})
      .then(() => runtime.api("settings", { workspaceId, settings: next }))
      .then(async () => {
        await runtime.refresh();
        return true;
      })
      .catch((e) => {
        setError(errorMessage(e));
        return false;
      })
      .finally(() => setSaving(false));
    tail.current = job;
    return job;
  };
  return createPortal(
    <div
      className="el-plugin el-settings-popover"
      ref={ref}
      role="dialog"
      aria-label="工作区设置"
      style={{ left, top }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.nativeEvent.isComposing && !editing) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <h2>工作区设置</h2>
      <p className="el-model-status">
        {runtime.state.data?.modelTestGate.approved ? "真实模型调用已获本轮授权。" : "未开启真实模型调用。需先获得本轮调用授权，再发起审查。"}
        {" "}<a className="el-link" href="https://evidentloop.sanze.dev/guide-status.html" target="_blank" rel="noopener noreferrer">查看调用授权说明 ↗</a>
      </p>
      <p className="el-muted">
        {sharedRepo
          ? "这些设置对同一仓库的所有工作区生效"
          : "这些设置对当前工作区所属仓库生效"}
      </p>
      <label className="el-setting-row">
        <span>
          <strong>自动审查</strong>
          <small>自动审查尚未启用，此偏好会保留。</small>
        </span>
        <input
          type="checkbox"
          checked={draft.autoMode}
          onChange={(e) => persist("autoMode", e.target.checked)}
        />
      </label>
      <label className="el-setting-field">
        <strong>目标分支</strong>
        <small>留空自动检测；下次生成审查时使用，不改变当前 Diff。</small>
        <input
          value={draft.targetBranch}
          onChange={(e) => persist("targetBranch", e.target.value)}
          placeholder="自动检测"
        />
      </label>
      <div className="el-setting-row">
        <span>
          <strong>扩展提示词</strong>
          <small>
            {draft.extensionPrompt.trim()
              ? "已配置 · " + Array.from(draft.extensionPrompt).length + " 字"
              : "未配置"}
          </small>
        </span>
        <Link onClick={() => setEditing(true)}>编辑</Link>
      </div>
      <label className="el-setting-row">
        <span>
          <strong>HTML 报告导出</strong>
          <small>HTML 报告默认嵌入完整 Diff</small>
        </span>
        <input
          type="checkbox"
          checked={draft.exportEmbedDiff}
          onChange={(e) => persist("exportEmbedDiff", e.target.checked)}
        />
      </label>
      <p className="el-muted" role="status">
        {saving ? "正在保存…" : "仅在本机当前 DSH 实例保存。"}
      </p>
      {error && (
        <p role="alert" className="el-error">
          {error}
        </p>
      )}
      {editing && (
        <ExtensionEditor
          value={draft.extensionPrompt}
          save={async (text) => {
            const ok = await persist("extensionPrompt", text);
            if (ok) setEditing(false);
            return ok;
          }}
          close={() => setEditing(false)}
        />
      )}
    </div>,
    document.body,
  );
}
export function ExtensionEditor({
  value,
  save,
  close,
}: {
  value: string;
  save(text: string): Promise<boolean>;
  close(): void;
}) {
  const initial = useRef(value).current,
    [saving, setSaving] = useState(false),
    [text, setText] = useState(value),
    [discard, setDiscard] = useState(false),
    [error, setError] = useState("");
  const update = (value: string) => setText(value.replace(/\r\n?/g, "\n")),
    count = Array.from(text).length;
  const requestClose = () => (text !== initial ? setDiscard(true) : close());
  const load = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (file) {
        if (!file.name.toLowerCase().endsWith(".md"))
          throw Error("请选择 Markdown (.md) 文件");
        update(await file.text());
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      event.target.value = "";
    }
  };
  return (
    <Dialog
      title="编辑扩展提示词"
      close={requestClose}
      className="el-wide-dialog"
    >
      <p>
        随每次审查发送。可补充关注点、忽略项与严重度标准；不能改变输出格式、证据要求及问题边界。
      </p>
      <div className="el-extension-tools">
        <label className="el-file-button">
          导入 .md
          <input type="file" accept=".md,text/markdown" onChange={load} />
        </label>
        <button className="el-btn" onClick={() => update("")}>
          清空
        </button>
        <span
          className={count > 20000 ? "el-error" : "el-muted"}
          aria-live="polite"
        >
          {count} / 20000 字
        </span>
      </div>
      <div className="el-extension-columns">
        <textarea
          aria-label="扩展提示词"
          value={text}
          onChange={(e) => update(e.target.value)}
          spellCheck={false}
        />
        <section aria-label="扩展提示词实时预览">
          <Prose text={text || "预览将显示在这里。"} />
        </section>
      </div>
      {error && (
        <p role="alert" className="el-error">
          {error}
        </p>
      )}
      <footer>
        <button className="el-btn" onClick={requestClose}>
          取消
        </button>
        <button
          className="el-primary"
          disabled={count > 20000 || saving}
          onClick={async () => {
            setSaving(true);
            try {
              if ((await save(text)) === false)
                setError("保存失败，修改仍保留在编辑器中。");
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "正在保存" : "保存"}
        </button>
      </footer>
      {discard && (
        <Dialog title="放弃未保存的修改？" close={() => setDiscard(false)}>
          <p>扩展提示词尚未保存。</p>
          <footer>
            <button
              className="el-btn"
              data-autofocus
              onClick={() => setDiscard(false)}
            >
              继续编辑
            </button>
            <button className="el-btn" onClick={close}>
              放弃修改
            </button>
          </footer>
        </Dialog>
      )}
    </Dialog>
  );
}
