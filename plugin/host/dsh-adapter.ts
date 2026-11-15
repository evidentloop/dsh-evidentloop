import { eventIs, type KnownEvent } from "./context.ts";
import type {
  Adapter,
  ReviewRequest,
  Session,
  Snapshot,
} from "../../core/types.js";
import type { ReviewCore } from "../../core/index.mjs";
import type {
  HostContext,
  HostEvent,
  ModelSelection,
  Agent,
  AgentHandle,
  Approval,
  RegistryRow,
} from "./context.ts";
import type { ClientBridge } from "./bridge.ts";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createGit } from "../../core/lib/git.mjs";
import { projectFor } from "../../core/index.mjs";
const never = new AbortController().signal;
const textOf = (event: KnownEvent<"assistant/message">) =>
  event.data.message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
export class DshAdapter implements Adapter {
  ctx: HostContext;
  root: string;
  bridge: ClientBridge;
  approvalFile: string;
  kind = "dsh";
  registryFile: string;
  registry: Record<string, RegistryRow>;
  active = new Map<string, Agent>();
  core!: ReviewCore;
  closed = false;
  constructor(
    ctx: HostContext,
    {
      root,
      bridge,
      approvalFile = path.join(root, "model-approval.json"),
    }: {
      root: string;
      bridge: ClientBridge;
      approvalFile?: string;
    },
  ) {
    this.ctx = ctx;
    this.root = root;
    this.bridge = bridge;
    this.approvalFile = approvalFile;
    fs.mkdirSync(root, { recursive: true });
    this.registryFile = path.join(root, "review-sessions.json");
    this.registry = fs.existsSync(this.registryFile)
      ? JSON.parse(fs.readFileSync(this.registryFile, "utf8"))
      : {};
  }
  saveRegistry() {
    const tmp = this.registryFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.registry, null, 2) + "\n", {
      mode: 0o600,
    });
    fs.renameSync(tmp, this.registryFile);
  }
  async session(id: string): Promise<Session | null> {
    const list = await this.ctx.sessionController.list({}, never),
      row = list.items.find((r) => r.sessionId === id);
    if (!row) return null;
    let projectKey;
    if (row.cwd)
      try {
        projectKey = projectFor(createGit(row.cwd).root).projectKey;
      } catch {}
    const live = this.ctx.sessions.get(id),
      title =
        (live ? this.ctx.get("sessionTitle")?.get(live)?.title : null) ||
        row.projections?.values?.title ||
        "未命名会话";
    return {
      id,
      cwd: row.cwd,
      projectKey: this.registry[id]?.projectKey || projectKey,
      title,
      origin: row.origin,
      parentSession: row.parentSessionId,
      formatStatus: row.formatStatus,
      unavailable: Boolean(
        (row.formatStatus && row.formatStatus !== "current") ||
        ["error", "migration-required"].includes(row.projections?.state || ""),
      ),
      kind: this.registry[id] ? "review" : "development",
      archived: this.ctx.workspaceRegistry.archivedSessionIds.includes(id),
      updatedAt: row.updatedAt,
      running: row.running,
    };
  }
  async getDraft(id: string) {
    const session = await this.session(id);
    if (!session || session.unavailable)
      throw Error("开发会话需要迁移或暂不可用");
    const value = await this.bridge.call("getDraft", { sessionId: id });
    if (
      !value ||
      typeof value.text !== "string" ||
      !Number.isSafeInteger(value.revision)
    )
      throw Error("Invalid native draft response");
    return value;
  }
  async writeDraft(
    id: string,
    text: string,
    options: {
      expectedRevision: number;
      preserveQuotesAndAttachments?: boolean;
    },
  ) {
    const session = await this.session(id);
    if (!session || session.unavailable || session.archived) return false;
    const result = await this.bridge.call("writeDraft", {
      sessionId: id,
      text,
      expectedRevision: options.expectedRevision,
    });
    return result?.written === true;
  }
  async copy(text: string) {
    const result = await this.bridge.call("copy", { text });
    if (result?.copied !== true) throw Error("Clipboard rejected");
    return true;
  }
  approval(): Approval {
    if (!fs.existsSync(this.approvalFile))
      throw Error("隔离验证尚未批准真实模型调用预算");
    const approval = JSON.parse(
      fs.readFileSync(this.approvalFile, "utf8"),
    ) as Approval;
    const used = approval.used ?? 0;
    if (
      typeof approval.approvedBy !== "string" ||
      !approval.approvedBy.trim() ||
      typeof approval.taskId !== "string" ||
      !approval.taskId.trim() ||
      !Number.isFinite(Date.parse(approval.expiresAt)) ||
      Date.parse(approval.expiresAt) < Date.now() ||
      !Number.isSafeInteger(approval.maxCalls) ||
      approval.maxCalls < 1 ||
      !Number.isSafeInteger(used) ||
      used < 0 ||
      used >= approval.maxCalls ||
      !(["projectKey", "inputSha", "promptVersion"] as const).every(
        (k) =>
          typeof approval[k] === "string" && /^[a-f0-9]{64}$/.test(approval[k]),
      ) ||
      (["maxInputBytes", "maxOutputTokens", "contextWindow"] as const).some(
        (k) =>
          approval[k] !== undefined &&
          (!Number.isSafeInteger(approval[k]) || approval[k]! < 1),
      )
    )
      throw Error("真实模型调用预算未批准、格式无效或已用完");
    approval.used = used;
    return approval;
  }
  allowed(selection: ModelSelection, bytes: number, snapshot: Snapshot) {
    const approval = this.approval();
    if (
      !snapshot ||
      (["projectKey", "inputSha", "promptVersion"] as const).some(
        (k) => approval[k] !== snapshot[k],
      )
    )
      throw Error("冻结输入与已批准预算不一致，未调用模型");
    if (
      approval.provider !== selection.provider ||
      approval.model !== selection.model ||
      approval.reasoningEffort !== selection.reasoningEffort
    )
      throw Error("当前模型与已批准轮次不一致");
    if (bytes > (approval.maxInputBytes || 1024 * 1024))
      throw Error("审查包超过已批准输入预算，未删减目标");
    return approval;
  }
  claim(selection: ModelSelection, bytes: number, snapshot: Snapshot) {
    const approval = this.allowed(selection, bytes, snapshot);
    approval.used += 1;
    fs.writeFileSync(
      this.approvalFile + ".tmp",
      JSON.stringify(approval, null, 2),
      { mode: 0o600 },
    );
    fs.renameSync(this.approvalFile + ".tmp", this.approvalFile);
    return approval;
  }
  async review(
    request: ReviewRequest,
    {
      signal,
    }: {
      signal: AbortSignal;
    },
  ): Promise<unknown> {
    if (this.closed) throw Error("Plugin unloaded");
    this.approval();
    signal.throwIfAborted();
    const delivery = this.core.store.delivery(
      request.snapshot.projectKey,
      request.snapshot.deliveryId,
    );
    if (!delivery) throw Error("交付不存在");
    const callerId = request.sourceSessionId || delivery.sessionIds.at(-1);
    let selection = this.ctx.get("agentDefaultModel").currentSelection();
    const caller = callerId ? await this.session(callerId) : null;
    if (
      request.sourceSessionId &&
      (!caller ||
        caller.archived ||
        caller.kind === "review" ||
        caller.projectKey !== request.snapshot.projectKey)
    )
      throw Error("发起审查的开发会话已不可用，未调用模型");
    if (
      caller &&
      !caller.archived &&
      caller.projectKey === request.snapshot.projectKey
    ) {
      const resolved = await this.ctx.sessionController.resolveAgent(caller.id);
      if ("error" in resolved) throw resolved.error;
      selection = resolved.agent.model.current() || selection;
    }
    if (!selection?.provider || !selection.model) throw Error("未配置可用模型");
    const info = await this.ctx.llm.resolveModelInfo(
      selection.provider,
      selection.model,
    );
    selection = {
      ...selection,
      reasoningEffort:
        selection.reasoningEffort ?? info.reasoning?.defaultEffort,
    };
    const prompt = reviewPrompt(request),
      promptBytes = Buffer.byteLength(prompt),
      approval = this.allowed(selection, promptBytes, request.snapshot),
      sessionId = "session-" + crypto.randomUUID(),
      events: HostEvent[] = [];
    let steps = 0,
      failureCode: string | undefined;
    if (
      approval.contextWindow !== undefined &&
      info.context?.contextWindow !== approval.contextWindow
    )
      throw Error(
        "模型上下文与批准配置不符，请在隔离模型配置中设置 contextWindow",
      );
    const cwd = request.bundleRoot;
    if (!cwd || !path.isAbsolute(cwd) || !fs.statSync(cwd).isDirectory())
      throw Error("冻结审查包不可用");
    const titles = this.ctx.get("sessionTitle");
    if (!titles) throw Error("宿主标题服务不可用，未发起模型");
    let handle: AgentHandle | undefined;
    const off = this.ctx.on("session/event", (session, event) => {
      if (session.id !== sessionId) return;
      events.push(event);
      if (eventIs(event, "request/header") && this.registry[sessionId]) {
        const config = event.data.header.config;
        this.registry[sessionId].model = {
          provider: config.provider,
          model: config.model,
          name: info.name || config.model,
          reasoningEffort: config.reasoningEffort,
          contextWindow: config.contextWindow,
          maxTokens: config.maxTokens,
        };
        this.saveRegistry();
      }
      if (
        eventIs(event, "request/context") &&
        this.registry[sessionId]?.model
      ) {
        this.registry[sessionId].model.contextWindow = event.data.contextWindow;
        this.saveRegistry();
      }
    });
    try {
      signal.throwIfAborted();
      handle = await this.ctx.agents.create({
        sessionId,
        meta: { cwd },
        agentOptions: {
          ...selection,
          maxTokens: approval.maxOutputTokens || 16384,
        },
        setup: (agentCtx, agent) => {
          agentCtx.tools.restrict({ allow: [] });
          agentCtx.on("agent/pre-step", async (_payload, next) => {
            if (++steps > 1 || this.ctx.tools.schemas(agent).length)
              throw Error(
                "Controlled review may not expose tools or start another step",
              );
            return next();
          });
          agentCtx.on("agent/assistant-stream", ({ frame }) => {
            if (
              frame.type === "chunk" &&
              frame.chunk.type === "finish" &&
              frame.chunk.reason?.kind === "error"
            ) {
              failureCode = frame.chunk.reason.failure?.code;
              queueMicrotask(() =>
                agent.cancel({ kind: "hook", reason: "No retry budget" }),
              );
            }
          });
        },
      });
      titles.rename(handle.agent.session, "AI 变更评审 · " + delivery.title);
      this.registry[sessionId] = {
        runId: request.runId,
        callerId,
        projectKey: request.snapshot.projectKey,
      };
      this.saveRegistry();
      this.active.set(request.runId, handle.agent);
      const cancel = () => handle!.agent.cancel({ kind: "user" });
      signal.addEventListener("abort", cancel, { once: true });
      try {
        if (signal.aborted) cancel();
        signal.throwIfAborted();
        if (this.ctx.tools.schemas(handle.agent).length)
          throw Error("Write tools were not removed");
        this.claim(selection, promptBytes, request.snapshot);
        await this.ctx.sessionController.prompt(
          {
            sessionId,
            requestId: request.runId,
            mode: "queue",
            content: [{ type: "text", text: prompt }],
          },
          never,
        );
        await handle.agent.whenIdle();
        await this.ctx.sessions.flush(handle.agent.session);
        const raw = events
          .filter((e) => eventIs(e, "assistant/message"))
          .map(textOf)
          .join("\n");
        const rawFolder = path.join(this.root, "model-output");
        fs.mkdirSync(rawFolder, { recursive: true });
        fs.writeFileSync(
          path.join(rawFolder, request.runId + ".raw.txt"),
          raw,
          { mode: 0o600 },
        );
        signal.throwIfAborted();
        const end = events.findLast((e) => eventIs(e, "turn/end"));
        if (end?.data.reason.kind !== "completed")
          throw Error(
            "受控审查未完成：" +
              (failureCode || end?.data.reason.kind || "missing terminal"),
          );
        try {
          return JSON.parse(raw.trim());
        } catch {
          throw Error("模型未返回单个合法JSON，原始文本已保留");
        }
      } finally {
        signal.removeEventListener("abort", cancel);
      }
    } finally {
      this.active.delete(request.runId);
      off?.();
      if (handle) await handle.dispose();
    }
  }
  async close() {
    this.closed = true;
    const agents = [...this.active.values()];
    for (const agent of agents) agent.cancel({ kind: "disposed" });
    await Promise.allSettled(agents.map((agent) => agent.whenIdle()));
  }
}
export function reviewPrompt(request: ReviewRequest) {
  const parts = [
    "按下列冻结方法审查，只读此审查包，不读实时工作区、不运行命令、不修改任何文件。输出中文单个JSON，严格符合schema；不加basis/findingId/证据sha等host字段。",
    "必须返回全部targets的逐文件说明和全局features/impacts/alignment；问题只审查reviewPaths，carriedPaths由host复制，不能替代全局说明。",
    JSON.stringify({
      inputSha: request.snapshot.inputSha,
      promptVersion: request.snapshot.promptVersion,
      reviewPaths: request.reviewPaths,
      carriedPaths: request.carriedPaths,
    }),
  ];
  for (const m of request.modules.filter((m) => !m.path.startsWith("bundle/")))
    parts.push(`\n--- METHOD ${m.path} sha256=${m.sha256} ---\n${m.text}`);
  const visit = (folder: string, prefix = "") => {
    for (const name of fs.readdirSync(folder).sort()) {
      const file = path.join(folder, name),
        stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw Error("Review bundle symlink refused");
      const relative = prefix + name;
      if (stat.isDirectory()) visit(file, relative + "/");
      else
        parts.push(
          `\n--- BUNDLE ${relative} ---\n${fs.readFileSync(file, "utf8")}`,
        );
    }
  };
  visit(request.bundleRoot);
  return parts.join("\n");
}
