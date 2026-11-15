import { eventIs, type KnownEvent } from "./context.ts";
import type { Project, TriggerResult } from "../../core/types.js";
import type { HostContext, HostEvent, PluginConfig } from "./context.ts";
import {
  errorMessage,
  type ApiRequests,
  type ClientRequest,
  type Bootstrap,
  type ReviewInput,
  type Operation,
} from "../shared/contracts.ts";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  ReviewCore,
  FileStore,
  Drafts,
  projectFor,
  loadBundle,
  markdown,
  html,
  RequirementLedger,
  developmentSession,
  reviewStatus,
  compareSnapshots,
  redactText,
} from "../../core/index.mjs";
import { createGit, rangeOf, branchLabelOf, currentBranchOf } from "../../core/lib/git.mjs";
import { inside, isTarget } from "../../core/lib/common.mjs";
import { ClientBridge } from "./bridge.ts";
import { DshAdapter } from "./dsh-adapter.ts";
const never = new AbortController().signal;
const json = (value: unknown) => Response.json(value);
type WorkspaceProject = {
  workspaceId: string;
  path: string;
} & (
  | (Project & {
      notGit?: false;
    })
  | {
      notGit: true;
      projectKey?: undefined;
      displayName?: undefined;
    }
);
type GitProject = Extract<
  WorkspaceProject,
  {
    projectKey: string;
  }
>;
type OperationRow = Operation & {
  promise?: Promise<void>;
};
export class PluginService {
  ctx: HostContext;
  config: PluginConfig;
  workspaceCache = new Map<string, WorkspaceProject>();
  operations = new Map<string, OperationRow>();
  captureTails = new Map<string, Promise<void>>();
  bridge: ClientBridge;
  adapter: DshAdapter;
  core: ReviewCore;
  drafts: Drafts;
  routePaths: string[];
  constructor(ctx: HostContext, config: PluginConfig) {
    this.ctx = ctx;
    this.config = config;
    this.bridge = new ClientBridge();
    const store = new FileStore(path.join(config.storageRoot, "projects"));
    this.adapter = new DshAdapter(ctx, {
      root: config.storageRoot,
      bridge: this.bridge,
      approvalFile: config.approvalFile,
    });
    this.core = new ReviewCore({
      store,
      adapter: this.adapter,
      methodRoot: config.methodRoot,
    });
    this.adapter.core = this.core;
    this.drafts = new Drafts(this.adapter);
    this.routePaths = [];
  }
  async initialize() {
    await this.core.initialize();
    this.register();
    return this;
  }
  workspace(id: string) {
    const row = this.ctx.workspaceRegistry
      .list()
      .find((w) => String(w.id) === String(id));
    if (!row) throw Error("工作区不存在");
    return row;
  }
  project(workspaceId: string): WorkspaceProject {
    const workspace = this.workspace(workspaceId),
      cached = this.workspaceCache.get(String(workspaceId));
    if (cached?.path === workspace.path) return cached;
    try {
      const git = createGit(workspace.path),
        project = {
          ...projectFor(git.root),
          displayName: path.basename(git.root),
          workspaceId: String(workspace.id),
          path: workspace.path,
        };
      this.workspaceCache.set(String(workspaceId), project);
      return project;
    } catch {
      return {
        workspaceId: String(workspace.id),
        path: workspace.path,
        notGit: true,
      };
    }
  }
  requireProject(workspaceId: string): GitProject {
    const project = this.project(workspaceId);
    if (project.notGit) throw Error("当前工作区不是Git仓库");
    return project;
  }
  requireDelivery(project: GitProject, deliveryId: string) {
    const d = this.core.store.delivery(project.projectKey, deliveryId);
    if (!d) throw Error("交付不存在或不属于当前仓库");
    return d;
  }
  selected(project: GitProject, deliveryId: string, snapshotId?: string) {
    const d = this.requireDelivery(project, deliveryId),
      id = snapshotId || d.current?.snapshotId || d.latestSnapshotId;
    if (!id || !d.snapshotIds.includes(id)) throw Error("审查记录不存在");
    const previousId = d.snapshotIds[d.snapshotIds.indexOf(id) - 1];
    const view = this.core.selected(project.projectKey, id),
      native = Object.values(this.adapter.registry).find(
        (row) => row.runId === view.run?.runId,
      )?.model;
    return {
      ...view,
      ...(native && view.run?.model?.adapter === "dsh"
        ? { run: { ...view.run, model: { ...view.run.model, ...native } } }
        : {}),
      previousSnapshot: previousId
        ? this.core.store.snapshot(project.projectKey, previousId)
        : null,
    };
  }
  async bootstrap(workspaceId?: string): Promise<Bootstrap> {
    const workspaces = this.ctx.workspaceRegistry.list().map((w) => ({
      workspaceId: String(w.id),
      path: w.path,
      title: w.title,
      sessionIds: [...w.sessionIds],
      projectKey: this.project(w.id).projectKey,
      notGit: this.project(w.id).notGit || false,
    }));
    const project = workspaceId ? this.project(workspaceId) : null;
    const deliveries = project?.projectKey
      ? this.core.store.deliveries(project.projectKey).map((d) => {
          const snapshot =
            d.current &&
            this.core.store.snapshot(project.projectKey, d.current.snapshotId);
          const view = snapshot
            ? this.core.selected(project.projectKey, snapshot.snapshotId)
            : null;
          const marks = view?.marks || [],
            findings = view?.run?.findings || [],
            activeFindingCount = findings.filter(
              (f) =>
                !marks.some((m) => m.findingId === f.findingId && m.suppressed),
            ).length;
          return {
            ...d,
            snapshot: snapshot || null,
            run: view?.run || null,
            marks,
            activeFindingCount,
            statusText: snapshot
              ? reviewStatus(snapshot, view?.run, marks)
              : "尚未审查",
          };
        })
      : [];
    const sessions = (
      await this.ctx.sessionController.list({}, never)
    ).items.map((row) => ({
      sessionId: row.sessionId,
      formatStatus: row.formatStatus,
      unavailable: Boolean(
        (row.formatStatus && row.formatStatus !== "current") ||
        ["error", "migration-required"].includes(row.projections?.state || ""),
      ),
      cwd: row.cwd,
      updatedAt: row.updatedAt,
      title: row.projections?.values?.title || "未命名会话",
      archived: this.ctx.workspaceRegistry.archivedSessionIds.includes(
        row.sessionId,
      ),
      review: Boolean(this.adapter.registry[row.sessionId]),
    }));
    return {
      workspaces,
      project: project && {
        projectKey: project.projectKey,
        displayName: project.displayName,
        notGit: Boolean(project.notGit),
      },
      deliveries,
      sessions,
      settings: project?.projectKey
        ? this.core.store.settings(project.projectKey)
        : null,
      operations: [...this.operations.values()].map(({ promise, ...o }) => o),
      modelTestGate: this.modelGate(),
    };
  }
  modelGate() {
    try {
      const a = this.adapter.approval();
      return { approved: true, remaining: a.maxCalls - (a.used || 0) };
    } catch {
      return { approved: false, remaining: 0 };
    }
  }
  operation(
    type: string,
    action: () => Promise<TriggerResult>,
  ): {
    operationId: string;
    status: "accepted";
  } {
    for (const [key, row] of this.operations)
      if (this.operations.size > 100 && row.status !== "running")
        this.operations.delete(key);
    const id = crypto.randomUUID(),
      row: OperationRow = {
        id,
        type,
        status: "running",
        startedAt: new Date().toISOString(),
      };
    this.operations.set(id, row);
    row.promise = Promise.resolve()
      .then(action)
      .then(
        (result) => {
          row.status = ["failed", "incomplete"].includes(result?.status)
            ? "failed"
            : "completed";
          row.result = result;
        },
        (error) => {
          row.status = "failed";
          row.error = String(error.message || error);
        },
      )
      .finally(() => {
        row.endedAt = new Date().toISOString();
      });
    return { operationId: id, status: "accepted" };
  }
  async messages(sessionId?: string) {
    if (!sessionId) return [];
    let cut: number | undefined, beforeSeq: number | undefined;
    const events = new Map<number, HostEvent>();
    for (;;) {
      const page = await this.ctx.sessionController.events(
        {
          address: { kind: "session", sessionId },
          maxMessages: 500,
          ...(cut === undefined ? {} : { throughSeq: cut }),
          ...(beforeSeq === undefined ? {} : { beforeSeq }),
        },
        never,
      );
      cut ??= page.cursor;
      const entries = page.records
        .filter((r) => r.type === "event")
        .map((r) => r.event);
      for (const event of entries) events.set(event.seq, event);
      if (events.size > 100000)
        throw Error("会话需求来源过长，未裁减内容，请选择较短的开发会话");
      if (!page.hasMore) break;
      const next = Math.min(...entries.map((e) => e.seq));
      if (!Number.isSafeInteger(next) || next < 0 || next === beforeSeq)
        throw Error("无法确认需求消息顺序");
      beforeSeq = next;
    }
    return [...events.values()]
      .sort((a, b) => a.seq - b.seq)
      .filter(
        (e): e is KnownEvent<"user/message"> =>
          eventIs(e, "user/message") && e.data.source.kind === "user",
      )
      .map((e) => ({
        id: e.data.id,
        sequence: e.seq,
        text: e.data.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n"),
      }))
      .filter((m) => m.text.trim());
  }
  async acquirePreparation(key: string) {
    const previous = this.captureTails.get(key) || Promise.resolve();
    let unlock!: () => void;
    const turn = new Promise<void>((resolve) => {
        unlock = resolve;
      }),
      tail = previous.catch(() => {}).then(() => turn);
    this.captureTails.set(key, tail);
    await previous.catch(() => {});
    let released = false;
    return () => {
      if (released) return;
      released = true;
      unlock();
      if (this.captureTails.get(key) === tail) this.captureTails.delete(key);
    };
  }
  async review(body: ReviewInput, { captureOnly = false } = {}) {
    const project = this.requireProject(body.workspaceId);
    const release = await this.acquirePreparation(project.projectKey);
    try {
      let source = await developmentSession(this.adapter, body.sessionId);
      if (source && source.projectKey !== project.projectKey) source = null;
      let delivery = body.deliveryId
        ? this.requireDelivery(project, body.deliveryId)
        : null;
      if (body.snapshotId) {
        this.selected(project, body.deliveryId!, body.snapshotId);
        this.core.writable(project.projectKey, body.snapshotId, false);
      }
      const git = createGit(project.repoRoot),
        branch = currentBranchOf(git);
      const range = rangeOf(
        git,
        this.core.store.settings(project.projectKey).targetBranch || undefined,
      );
      delivery ||= this.core.deliveries.findOpen(project.projectKey, {
        branch,
        targetBranch: range.kind === "empty-tree-worktree" ? branch : branchLabelOf(git, range.targetRef),
        session: source,
      });
      if (delivery) {
        if (branch !== delivery.branch)
          throw Error("当前工作区分支已切换，请切回交付分支后审查");
        source ||= await developmentSession(
          this.adapter,
          delivery.sessionIds.at(-1),
        );
      }
      const ledger = new RequirementLedger(delivery?.requirementLedger || []);
      if (source && source.projectKey === project.projectKey)
        ledger.captureMessages(source.id, await this.messages(source.id));
      if (body.requirement) {
        if (
          !["paste", "file"].includes(body.requirement.kind) ||
          typeof body.requirement.text !== "string" ||
          !body.requirement.text.trim()
        )
          throw Error("需求依据不能为空");
        ledger.captureManual({
          id: body.requirement.id,
          source: {
            kind: body.requirement.kind,
            text: body.requirement.text,
            origin: body.requirement.origin || body.requirement.kind,
          },
        });
      }
      return await this.core.trigger({
        repo: project.repoRoot,
        sessionId: source?.id,
        requirements: ledger.sources(),
        scope: body.scope || "incremental",
        force: Boolean(body.force),
        captureOnly,
        expectedDeliveryId: delivery?.deliveryId,
        onPrepared: async (prepared) => {
          await this.core.store.updateDelivery(
            project.projectKey,
            prepared.deliveryId,
            (d) => {
              d.requirementLedger = ledger.state();
              if (typeof body.externalRef === "string")
                d.externalRef = body.externalRef.trim();
            },
          );
          // Only preparation is serialized. New inputs must still interrupt an old model immediately.
          release();
        },
      });
    } finally {
      release();
    }
  }
  route<K extends keyof ApiRequests>(
    suffix: K,
    methods: string[],
    handler: (
      body: ClientRequest<K>,
      request: Request,
    ) => Response | Promise<Response>,
  ) {
    const route = "/api/dsh-evidentloop/" + suffix;
    this.routePaths.push(route);
    this.ctx.connection.fetch.register({
      path: route,
      methods,
      requestBody: "buffered",
      fetch: async (request) => {
        try {
          const params = Object.fromEntries(new URL(request.url).searchParams),
            body = request.method === "POST" ? await request.json() : {};
          return await handler(
            { ...params, ...body } as ClientRequest<K>,
            request,
          );
        } catch (error) {
          return Response.json({ error: errorMessage(error) }, { status: 400 });
        }
      },
    });
  }
  register() {
    this.route("bootstrap", ["GET"], (b) =>
      this.bootstrap(b.workspaceId).then(json),
    );
    this.route("diagnostics", ["GET"], () =>
      json({
        routes: this.routePaths,
        modelGate: this.modelGate(),
        ownedReviewSessions: Object.keys(this.adapter.registry),
        activeReviews: [...this.adapter.active.keys()],
      }),
    );
    this.route("bridge/next", ["GET"], (b) =>
      json({ jobs: this.bridge.next(b.clientId) }),
    );
    this.route("bridge/answer", ["POST"], (b) =>
      json(this.bridge.answer(b.clientId, b)),
    );
    this.route("record", ["GET"], (b) => {
      const p = this.requireProject(b.workspaceId),
        view = this.selected(p, b.deliveryId, b.snapshotId);
      return json({
        ...view,
        bundleRoot: undefined,
        previousSnapshot: undefined,
        reviewablePaths: view.snapshot.files
          .filter(isTarget)
          .map((f) => f.path),
        comparison: compareSnapshots(view.snapshot, view.previousSnapshot),
        statusText: reviewStatus(view.snapshot, view.run, view.marks),
        history: [...view.delivery.snapshotIds].reverse().map((id) => {
          const s = this.core.selected(p.projectKey, id);
          return {
            snapshotId: id,
            createdAt: s.snapshot.createdAt,
            range: s.snapshot.range,
            statusText: reviewStatus(s.snapshot, s.run, s.marks),
          };
        }),
        readOnly:
          view.delivery.current?.snapshotId !== view.snapshot.snapshotId,
        extensionChanged:
          (this.core.store.settings(p.projectKey).extensionPrompt.trim()
            ? crypto
                .createHash("sha256")
                .update(this.core.store.settings(p.projectKey).extensionPrompt)
                .digest("hex")
            : null) !== (view.snapshot.extensionPrompt?.sha256 || null),
      });
    });
    this.route("file", ["GET"], (b) => {
      const p = this.requireProject(b.workspaceId),
        view = this.selected(p, b.deliveryId, b.snapshotId),
        file = view.snapshot.files.find((f) => f.path === b.path);
      if (!file) throw Error("冻结文件不存在");
      const bundle = loadBundle(view.bundleRoot),
        base = bundle.texts.get("base:" + (file.oldPath || file.path)),
        head = bundle.texts.get("head:" + file.path);
      const notes: Partial<
        Record<import("../../core/types.js").FileEntry["kind"], string>
      > = {
        excluded: "按敏感规则或依赖目录跳过，未读取源码。",
        binary: "二进制文件，不显示文本Diff。",
        oversize: "文件超过大小上限，未读取全文。",
        submodule: "子模块仅保留指向信息，不读取内部文件。",
        conflicted: "文件存在合并冲突，请先处理冲突。",
      };
      const note = notes[file.kind] || file.note || "";
      return json({
        file,
        reviewable: isTarget(file),
        base: base?.text ?? null,
        head: head?.text ?? null,
        patch: bundle.targets.includes(file.path)
          ? fs.readFileSync(
              path.join(view.bundleRoot, "diff", file.path + ".patch"),
              "utf8",
            )
          : "",
        note,
      });
    });
    this.route("review", ["POST"], (b) =>
      json(this.operation("review", () => this.review(b))),
    );
    this.route("capture", ["POST"], (b) =>
      json(
        this.operation("capture", () => this.review(b, { captureOnly: true })),
      ),
    );
    this.route("session-context", ["GET"], async (b) => {
      const source = await developmentSession(this.adapter, b.sessionId);
      if (!source?.projectKey) return json({ available: false });
      const workspace = this.ctx.workspaceRegistry
        .list()
        .find((w) => w.sessionIds.includes(source.id));
      if (!workspace) return json({ available: false });
      const project = this.requireProject(workspace.id),
        delivery = this.core.store
          .deliveries(project.projectKey)
          .filter((d) => d.sessionIds.includes(source.id))
          .sort((a, b) =>
            (b.createdAt || "").localeCompare(a.createdAt || ""),
          )[0];
      const view = delivery?.current
        ? this.core.selected(project.projectKey, delivery.current.snapshotId)
        : null;
      return json({
        available: true,
        workspaceId: String(workspace.id),
        sessionId: source.id,
        deliveryId: delivery?.deliveryId,
        statusText: view
          ? reviewStatus(view.snapshot, view.run, view.marks)
          : "待审",
        activeFindingCount:
          view?.run?.findings?.filter(
            (f) =>
              !view.marks.some(
                (m) => m.findingId === f.findingId && m.suppressed,
              ),
          ).length || 0,
      });
    });
    this.route("cancel", ["POST"], (b) => {
      const p = this.requireProject(b.workspaceId);
      this.requireDelivery(p, b.deliveryId);
      return json(
        this.operation("cancel", () =>
          this.core.scheduler
            .cancelDelivery(p.projectKey, b.deliveryId)
            .then(() => ({ status: "cancelled" })),
        ),
      );
    });
    this.route("settings", ["POST"], async (b) => {
      const p = this.requireProject(b.workspaceId),
        s = b.settings;
      if (
        !s ||
        typeof s.autoMode !== "boolean" ||
        typeof s.targetBranch !== "string" ||
        typeof s.extensionPrompt !== "string" ||
        typeof s.exportEmbedDiff !== "boolean"
      )
        throw Error("设置格式无效");
      const text = s.extensionPrompt.replace(/\r\n?/g, "\n");
      if (Array.from(text).length > 20000) throw Error("扩展提示词超过20000字");
      const value = {
        autoMode: s.autoMode,
        targetBranch: s.targetBranch.trim(),
        extensionPrompt: text,
        exportEmbedDiff: s.exportEmbedDiff,
      };
      await this.core.store.setSettings(p.projectKey, value);
      return json({ saved: true, settings: value });
    });
    this.route("mark", ["POST"], async (b) => {
      const p = this.requireProject(b.workspaceId);
      this.selected(p, b.deliveryId, b.snapshotId);
      return json(await this.core.mark(p.projectKey, b));
    });
    this.route("annotation", ["POST"], async (b) => {
      const p = this.requireProject(b.workspaceId);
      this.selected(p, b.deliveryId, b.snapshotId);
      return json(
        b.remove
          ? await this.core.deleteAnnotation(
              p.projectKey,
              b.snapshotId,
              b.annotationId!,
            )
          : await this.core.annotate(p.projectKey, { ...b, text: b.text! }),
      );
    });
    this.route("delivery", ["POST"], async (b) => {
      const p = this.requireProject(b.workspaceId);
      this.requireDelivery(p, b.deliveryId);
      const state = this.core.scheduler.state(p.projectKey);
      if (b.action === "delete") {
        if (
          b.confirm !== "delete" ||
          state.active?.deliveryId === b.deliveryId ||
          state.pending.has(b.deliveryId)
        )
          throw Error("运行中不能删除；删除操作需要确认");
        await this.core.deleteDelivery(p.projectKey, b.deliveryId);
      } else if (b.action === "archive") {
        if (
          state.active?.deliveryId === b.deliveryId ||
          state.pending.has(b.deliveryId)
        )
          throw Error("审查进行中，完成后可归档");
        await this.core.store.archive(
          p.projectKey,
          b.deliveryId,
          Boolean(b.value),
        );
      } else if (b.action === "pin")
        await this.core.store.pin(p.projectKey, b.deliveryId, Boolean(b.value));
      else throw Error("未知交付操作");
      return json({ saved: true });
    });
    this.route("draft/lock", ["POST"], async (b) => {
      const p = this.requireProject(b.workspaceId);
      return json(
        await this.drafts.lock(
          this.selected(p, b.deliveryId, b.snapshotId),
          b.template,
        ),
      );
    });
    this.route("draft/commit", ["POST"], (b) =>
      this.bridge
        .withClient(b.clientId, () =>
          this.drafts.commit(b.token, {
            displayedSnapshotId: b.displayedSnapshotId,
            choice: b.choice,
          }),
        )
        .then(json),
    );
    this.route("open-file", ["POST"], (b) =>
      this.bridge.withClient(b.clientId, async () => {
        const p = this.requireProject(b.workspaceId),
          view = this.selected(p, b.deliveryId, b.snapshotId),
          file = view.snapshot.files.find((f) => f.path === b.path);
        if (!file) throw Error("冻结文件不存在");
        const actual = path.join(p.repoRoot, file.path);
        if (
          !fs.existsSync(actual) ||
          fs.lstatSync(actual).isSymbolicLink() ||
          !inside(p.repoRoot, fs.realpathSync(actual))
        )
          throw Error(
            "当前工作区没有可安全打开的文件；冻结内容仍可在Diff中阅读",
          );
        const result = await this.bridge.call("openFile", { path: actual });
        if (!result?.opened) throw Error("宿主未确认打开文件");
        return json(result);
      }),
    );
    this.route("quote", ["POST"], (b) =>
      this.bridge.withClient(b.clientId, async () => {
        const p = this.requireProject(b.workspaceId),
          view = this.selected(p, b.deliveryId, b.snapshotId);
        this.core.writable(p.projectKey, view.snapshot.snapshotId, false);
        const finding = b.findingId
          ? view.run?.findings?.find((f) => f.findingId === b.findingId)
          : null;
        if (b.findingId && !finding) throw Error("问题不属于当前记录");
        const anchor = finding?.anchor || {
            path: b.path,
            side: b.side,
            line: b.line,
          },
          file = view.snapshot.files.find(
            (f) => f.path === anchor.path || f.oldPath === anchor.path,
          ),
          bundle = loadBundle(view.bundleRoot);
        if (!file || !["base", "head"].includes(anchor.side || ""))
          throw Error("代码定位无效");
        const side = bundle.texts.get(
          anchor.side +
            ":" +
            (anchor.side === "base" ? file.oldPath || file.path : file.path),
        );
        const start = anchor.line ?? 1;
        if (
          !side ||
          !Number.isInteger(start) ||
          start < 1 ||
          start > side.lines.length
        )
          throw Error("冻结代码中没有该行");
        const code = redactText(
          side.lines.slice(start - 1, start + 11).join("\n"),
        );
        if (!code || Buffer.byteLength(code) > 8192)
          throw Error("此处无可用短代码段，请在Diff中选择合适范围");
        const summary =
            file.path +
            (anchor.line === null ? "（文件级）" : ":" + start) +
            (anchor.side === "base" ? "（旧代码）" : "（新代码）"),
          target = await this.drafts.target(view.delivery),
          current = target && (await this.adapter.session(target.id));
        if (
          !current ||
          current.archived ||
          current.unavailable ||
          current.projectKey !== p.projectKey ||
          current.kind === "review"
        ) {
          await this.adapter.copy(summary + "\n" + code);
          return json({
            status: "copied",
            reason: "开发会话不可用，已复制冻结代码段",
          });
        }
        const content =
          summary +
          "\n```\n" +
          code +
          "\n```\n请结合上下文分析这段代码，是否存在安全或逻辑隐患，以及如何改进？";
        try {
          const draft = await this.adapter.getDraft(target.id);
          if (draft.text.includes(content))
            return json({
              status: "written",
              duplicate: true,
              targetId: target.id,
            });
          const text = draft.text + (draft.text ? "\n\n" : "") + content;
          if (
            await this.adapter.writeDraft(target.id, text, {
              expectedRevision: draft.revision,
              preserveQuotesAndAttachments: true,
            })
          )
            return json({
              status: "written",
              duplicate: false,
              targetId: target.id,
            });
        } catch {}
        await this.adapter.copy(content);
        return json({
          status: "copied",
          reason: "草稿已改变或无法写入，已复制代码段；未覆盖原草稿。",
        });
      }),
    );
    this.route("download", ["GET"], (b) => {
      const p = this.requireProject(b.workspaceId),
        view = this.selected(p, b.deliveryId, b.snapshotId),
        kind = b.format === "html" ? "html" : "md";
      const body =
        kind === "html"
          ? html(view, {
              embedDiff: this.core.store.settings(p.projectKey).exportEmbedDiff,
            })
          : markdown(view);
      const filename =
        Buffer.from(
          view.delivery.title
            .replace(/[\x00-\x1f<>:"/\\|?*]/g, "_")
            .slice(0, 80),
        ).toString("utf8") +
        "." +
        kind;
      return new Response(body, {
        headers: {
          "content-type":
            kind === "html"
              ? "text/html; charset=utf-8"
              : "text/markdown; charset=utf-8",
          "content-disposition":
            "attachment; filename*=UTF-8''" + encodeURIComponent(filename),
        },
      });
    });
    const staticFiles = {
      "client.css": ["client.css", "text/css"],
      "diff.js": [
        "../vendor/diff2html-ui@3.4.45.min.js",
        "application/javascript",
      ],
      "diff.css": ["../vendor/diff2html@3.4.45.min.css", "text/css"],
    };
    for (const [key, [file, type]] of Object.entries(staticFiles))
      this.route(
        `assets/${key}`,
        ["GET"],
        () =>
          new Response(
            fs.readFileSync(path.resolve(this.config.assetRoot, file)),
            { headers: { "content-type": type } },
          ),
      );
    const icons = JSON.parse(
      fs.readFileSync(
        path.resolve(this.config.assetRoot, "../vendor/material/source.json"),
        "utf8",
      ),
    ) as {
      files: Array<{
        name: string;
      }>;
    };
    for (const file of icons.files)
      this.route(
        `assets/material/${file.name}`,
        ["GET"],
        () =>
          new Response(
            fs.readFileSync(
              path.resolve(
                this.config.assetRoot,
                "../vendor/material",
                file.name,
              ),
            ),
            { headers: { "content-type": "image/svg+xml" } },
          ),
      );
  }
  async close() {
    this.bridge.close();
    await this.adapter.close();
    for (const key of this.core.scheduler.projects.keys())
      await this.core.scheduler.idle(key);
  }
}
