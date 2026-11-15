import type { ClientContext } from "./context.ts";
import type { SessionContext } from "../shared/contracts.ts";
import { errorMessage } from "../shared/contracts.ts";
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
function DeliveryTail({
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
  return (
    <section className="el-plugin el-tail-card">
      <Icon name="brand" size={24} />
      <div>
        <p>{context.statusText}</p>
        <small>审查当前工作区的累计改动</small>
        {error && <p role="alert">{error}</p>}
      </div>
      <button
        className="el-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await runtime.openFromSession(sessionId);
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "正在冻结" : "审查本次变更"}
      </button>
    </section>
  );
}
