import type { ClientContext, Composer, NativePort } from "./context.ts";
import type {
  BridgeAction,
  BridgePayloads,
  BridgeResults,
  WriteDraft,
} from "../shared/contracts.ts";
export class NativeClient implements NativePort {
  constructor(public ctx: ClientContext) {}
  workspaceState() {
    return this.ctx.get("uiWorkspace").workspaces.list.getSnapshot();
  }
  sessionId() {
    return this.ctx.get("uiSession").current.getSnapshot()?.key || null;
  }
  workspaceId() {
    const w = this.ctx.get("uiWorkspace"),
      selection = w.selection?.getSnapshot?.();
    return (
      selection?.workspaceId ||
      this.workspaceState().items.find((x) =>
        x.sessionIds.includes(this.sessionId() || ""),
      )?.workspaceId ||
      null
    );
  }
  subscribe(callback: () => void) {
    const w = this.ctx.get("uiWorkspace"),
      services = [
        w.workspaces.list,
        w.selection,
        this.ctx.get("uiSession").current,
      ];
    const disposers = services
      .filter((x) => x?.subscribe)
      .map((x) => x!.subscribe(callback));
    return () =>
      disposers.forEach((off) => {
        if (typeof off === "function") off();
      });
  }
  async selectWorkspace(id: string) {
    await this.ctx.get("uiWorkspace").openWorkspace(id);
    this.ctx.layout.selectPanel("dsh-evidentloop");
  }
  async openSession(id: string) {
    await this.ctx.get("uiWorkspace").openSession(id);
  }
  showPanel() {
    this.ctx.layout.selectPanel("dsh-evidentloop");
  }
  async input<T>(
    id: string,
    action: (input: Composer) => Promise<T>,
    expiresAt: number,
  ): Promise<T> {
    const sessions = this.ctx.get("uiSession").sessions,
      lease = sessions.retain(id, { source: "dsh-evidentloop" });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        lease.ready,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(Error("会话输入框加载超时")),
            Math.max(0, expiresAt - Date.now()),
          );
        }),
      ]);
      if (Date.now() >= expiresAt) throw Error("操作已过期，未修改草稿");
      const binding = sessions.binding(id);
      if (!binding) throw Error("会话输入框不可用");
      return await action(
        binding.ctx.get("conversation").input.for(binding.ctx),
      );
    } finally {
      clearTimeout(timer);
      lease.release();
    }
  }
  execute<K extends BridgeAction>(
    action: K,
    payload: BridgePayloads[K],
    expiresAt?: number,
  ): Promise<BridgeResults[K]>;
  async execute(
    action: BridgeAction,
    payload: BridgePayloads[BridgeAction],
    expiresAt = Date.now() + 10000,
  ): Promise<BridgeResults[BridgeAction]> {
    if (Date.now() >= expiresAt) throw Error("操作已过期");
    if (action === "copy") {
      if (!navigator.clipboard?.writeText) throw Error("剪贴板不可用");
      await navigator.clipboard.writeText(
        (payload as BridgePayloads["copy"]).text,
      );
      return { copied: true };
    }
    if (action === "openFile") {
      const remote = this.ctx.get("remote")?.session;
      if (!remote?.openWorkspacePath) throw Error("宿主未提供文件打开接口");
      return remote.openWorkspacePath(
        { path: (payload as BridgePayloads["openFile"]).path },
        AbortSignal.timeout(Math.max(1, expiresAt - Date.now())),
      );
    }
    const sessionId = (payload as BridgePayloads["getDraft"]).sessionId;
    return this.input(
      sessionId,
      async (input) => {
        if (action === "getDraft") {
          const draft = input.draftSnapshot,
            state = input.state.getSnapshot();
          return {
            text: draft.text,
            revision: state.draftRev,
            quotes: draft.quotes || [],
            references: draft.references || [],
            attachments: state.attachmentIds || [],
          };
        }
        if (action === "quote") {
          const quote = payload as BridgePayloads["quote"];
          const draft = input.draftSnapshot,
            state = input.state.getSnapshot();
          const content =
            quote.summary +
            "\n```\n" +
            quote.code +
            "\n```\n请结合上下文分析这段代码，是否存在安全或逻辑隐患，以及如何改进？";
          if (draft.text.includes(content)) {
            await this.openSession(sessionId);
            return { written: true, duplicate: true };
          }
          const result = await this.writeDraft(input, {
            text: draft.text + (draft.text ? "\n\n" : "") + content,
            expectedRevision: quote.expectedRevision ?? state.draftRev,
          });
          if (result.written) await this.openSession(sessionId);
          return result;
        }
        if (action !== "writeDraft") throw Error("未知原生操作");
        return this.writeDraft(input, payload as WriteDraft);
      },
      expiresAt,
    );
  }
  async writeDraft(
    input: Composer,
    payload: Pick<WriteDraft, "text" | "expectedRevision">,
  ) {
    const before = structuredClone(input.draftSnapshot),
      state = input.state.getSnapshot();
    if (state.draftRev !== payload.expectedRevision || state.phase !== "plain")
      return { written: false };
    const attachmentIds = [...(state.attachmentIds || [])];
    input.actions.setDraft({ ...before, text: payload.text });
    const appliedRevision = input.state.getSnapshot().draftRev;
    // Composer state commits without a paint; background Desktop windows may suspend rAF.
    await Promise.resolve();
    const after = input.draftSnapshot,
      next = input.state.getSnapshot();
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a || []) === JSON.stringify(b || []);
    if (
      next.draftRev !== appliedRevision ||
      after.text !== payload.text ||
      !same(after.quotes, before.quotes) ||
      !same(after.references, before.references) ||
      !same(next.attachmentIds, attachmentIds)
    ) {
      // A user may type during the frame. Never roll their newer draft back.
      if (next.draftRev === appliedRevision) input.actions.setDraft(before);
      input.actions.persistDraft();
      return { written: false };
    }
    input.actions.persistDraft();
    return { written: true, revision: next.draftRev };
  }
}
