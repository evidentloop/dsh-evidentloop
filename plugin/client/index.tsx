import type { ClientContext } from "./context.ts";
import type { SessionContext } from "../shared/contracts.ts";
import { errorMessage, UNBORN_HEAD_MESSAGE } from "../shared/contracts.ts";
import React from "react";
import { Panel } from "./app.tsx";
import { NativeClient } from "./native.ts";
import { ClientRuntime } from "./runtime.ts";
import { Icon } from "./ui.tsx";
import css from "./styles.css";
export const name = "dsh-evidentloop";
export const inject = [
  "connection",
  "slots",
  "layout",
  "uiSession",
  "uiWorkspace",
];
export function apply(ctx: ClientContext) {
  const runtime = new ClientRuntime(new NativeClient(ctx));
  const link = document.createElement("style");
  link.dataset.pluginCss = "dsh-evidentloop";
  link.textContent = css;
  document.head.append(link);
  ctx.slots.inject("main", () =>
    ctx.slots.register({ name: "main", key: "dsh-evidentloop" }, () => (
      <Panel runtime={runtime} />
    )),
  );
  ctx.slots.inject("sidebar.panellist", () =>
    ctx.slots.register(
      {
        name: "sidebar.panellist",
        id: "dsh-evidentloop",
        label: "变更评审",
        order: 20,
      },
      ({ size = 16 }) => <Icon name="brand" size={size} />,
    ),
  );
  // sessionId is the renderer's standard session-scope prop, never the active main session.
  ctx.slots.inject("conversation.chat.turnTail", () =>
    ctx.slots.register(
      { name: "conversation.chat.turnTail", id: "dsh-evidentloop" },
      (props) => <DeliveryTail {...props} runtime={runtime} />,
    ),
  );
  const diffCss = document.createElement("link");
  diffCss.rel = "stylesheet";
  diffCss.href = "/api/dsh-evidentloop/assets/diff.css";
  document.head.append(diffCss);
  runtime.start();
  ctx.effect(() => () => {
    runtime.stop();
    link.remove();
    diffCss.remove();
  });
}
export function DeliveryTail({
  runtime,
  sessionId,
}: {
  runtime: ClientRuntime;
  sessionId: string;
}) {
  const [context, setContext] = React.useState<SessionContext | null>(null),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    if (typeof sessionId !== "string") return;
    runtime
      .sessionContext(sessionId)
      .then((c) => {
        if (live) setContext(c);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [sessionId]);
  if (!context?.available) return null;
  const open = async () => {
    setBusy(true);
    setError("");
    try {
      await runtime.openFromSession(sessionId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="el-plugin el-tail-card" aria-label="交付区卡片">
      <button className="el-tail-main" aria-label="打开评审台" disabled={busy} onClick={open}>
        <span className="el-tail-icon"><Icon name="brand" size={18} /></span>
        <span className="el-tail-info">
          <span className="el-tail-status"><i aria-hidden="true" />{context.statusText}</span>
          <span className="el-tail-sub">审查当前工作区的累计改动</span>
        </span>
      </button>
      <button
        className="el-primary"
        disabled={busy}
        onClick={open}
      >
        {busy ? "正在冻结" : "审查本次变更"}
        <Icon name="arrowRight" size={14} />
      </button>
      {error && <p className={error === UNBORN_HEAD_MESSAGE ? "el-tail-notice" : "el-tail-error"} role={error === UNBORN_HEAD_MESSAGE ? "status" : "alert"}>{error}</p>}
    </section>
  );
}
