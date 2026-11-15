import {
  errorMessage,
  type ApiRoute,
  type ApiUrl,
  type ApiRequests,
  type ApiResponses,
  type RuntimeState,
  type View,
  type ReviewInput,
  type TriggerResult,
  type SessionContext,
} from "../shared/contracts.ts";
import type { NativePort } from "./context.ts";
const base = "/api/dsh-evidentloop/";
export class ClientRuntime {
  native: NativePort;
  clientId: string;
  listeners = new Set<() => void>();
  stopped = false;
  requestGeneration = 0;
  navigation = 0;
  recordGeneration = 0;
  annotationDrafts = new Map<string, string>();
  sessionContexts = new Map<
    string,
    {
      at: number;
      promise: Promise<SessionContext>;
    }
  >();
  state: RuntimeState;
  offNative?: () => void;
  bridgeTimer?: ReturnType<typeof setTimeout>;
  refreshTimer?: ReturnType<typeof setInterval>;
  constructor(native: NativePort) {
    this.native = native;
    this.clientId = crypto.randomUUID();
    this.state = {
      loading: true,
      error: "",
      workspaceId: null,
      data: null,
      page: "list",
      record: null,
      view: "overview",
      query: "",
      listPreferences: {
        archived: false,
        onlyIssues: false,
        sort: "updated",
        compact: false,
      },
      returnSessionId: null,
      notice: "",
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  update(value: Partial<RuntimeState>) {
    this.state = { ...this.state, ...value };
    for (const fn of this.listeners) fn();
  }
  async api<K extends ApiRoute>(
    route: ApiUrl<K>,
    value: ApiRequests[K] | null = null,
  ): Promise<ApiResponses[K]> {
    const response = await fetch(
      base + route,
      value
        ? {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...value, clientId: this.clientId }),
          }
        : undefined,
    );
    let data;
    try {
      data = await response.json();
    } catch {
      throw Error(
        "插件接口未加载（" + response.status + "），请重新加载插件。",
      );
    }
    if (!response.ok || data?.error) throw Error(data?.error || "连接请求失败");
    return data as ApiResponses[K];
  }
  async refresh() {
    const generation = ++this.requestGeneration;
    try {
      const workspaceId =
        this.state.page !== "list"
          ? this.state.workspaceId
          : this.native.workspaceId() || this.state.workspaceId;
      const data = await this.api(
        workspaceId
          ? `bootstrap?workspaceId=${encodeURIComponent(workspaceId)}`
          : "bootstrap",
      );
      if (generation === this.requestGeneration && !this.stopped) {
        const selected = this.state.record,
          navigation = this.navigation,
          extensionChanged =
            this.state.data?.settings?.extensionPrompt !==
            data.settings?.extensionPrompt;
        this.update({ loading: false, data, workspaceId, error: "" });
        if (
          this.state.page === "review" &&
          selected &&
          (!selected.readOnly || extensionChanged)
        ) {
          const d = data.deliveries.find(
            (d) => d.deliveryId === selected.delivery.deliveryId,
          );
          if (
            workspaceId &&
            d?.current?.snapshotId &&
            (extensionChanged ||
              d.current.snapshotId !== selected.snapshot.snapshotId ||
              d.run?.runId !== selected.run?.runId ||
              d.run?.status !== selected.run?.status)
          ) {
            const record = await this.api(
              `record?${new URLSearchParams({ workspaceId, deliveryId: d.deliveryId, ...(selected.readOnly ? { snapshotId: selected.snapshot.snapshotId } : {}) })}`,
            );
            if (
              generation === this.requestGeneration &&
              navigation === this.navigation
            )
              this.update({ record });
          }
        }
      }
    } catch (error) {
      if (generation === this.requestGeneration)
        this.update({ loading: false, error: errorMessage(error) });
    }
  }
  async selectWorkspace(workspaceId: string) {
    const navigation = ++this.navigation;
    this.recordGeneration++;
    await this.native.selectWorkspace(workspaceId);
    if (navigation !== this.navigation) return;
    this.update({
      workspaceId,
      page: "list",
      record: null,
      returnSessionId: null,
    });
    await this.refresh();
  }
  async open(deliveryId: string, view: View = "diff", snapshotId?: string) {
    const generation = ++this.recordGeneration,
      navigation = ++this.navigation,
      workspaceId = this.workspaceId();
    const args = new URLSearchParams({ workspaceId, deliveryId });
    if (snapshotId) args.set("snapshotId", snapshotId);
    const record = await this.api(`record?${args}`);
    if (
      generation === this.recordGeneration &&
      navigation === this.navigation &&
      workspaceId === this.state.workspaceId
    )
      this.update({
        page: "review",
        record,
        view,
        error: "",
      });
  }
  async reloadRecord() {
    if (this.state.record)
      await this.open(
        this.state.record.delivery.deliveryId,
        this.state.view,
        this.state.record.snapshot.snapshotId,
      );
    await this.refresh();
  }
  back() {
    const id = this.state.returnSessionId;
    this.navigation++;
    this.recordGeneration++;
    this.update({ page: "list", record: null, returnSessionId: null });
    if (id) this.native.openSession(id);
    else this.refresh();
  }
  async run(
    route: "review" | "capture" | "cancel",
    value: Omit<ReviewInput, "workspaceId"> & {
      workspaceId?: string;
    },
    {
      open = true,
      view,
    }: {
      open?: boolean;
      view?: View;
    } = {},
  ): Promise<TriggerResult> {
    const navigation = this.navigation;
    const workspaceId = value.workspaceId || this.workspaceId();
    const { operationId } = await this.api(route, { ...value, workspaceId });
    await this.refresh();
    for (;;) {
      if (this.stopped) throw Error("界面已关闭，可重新打开查看运行状态");
      const data = await this.api(
          `bootstrap?workspaceId=${encodeURIComponent(workspaceId)}`,
        ),
        operation = data.operations.find((o) => o.id === operationId);
      if (!operation) throw Error("运行状态已重启，请重新加载");
      if (operation.status !== "running") {
        if (operation.status === "failed")
          throw Error(
            operation.error ||
              operation.result?.reason ||
              operation.result?.errorCode ||
              "审查失败",
          );
        const result = operation.result || { status: operation.status };
        if (workspaceId === this.state.workspaceId) {
          await this.refresh();
          if (
            open &&
            navigation === this.navigation &&
            result?.deliveryId &&
            result?.snapshotId
          )
            await this.open(
              result.deliveryId,
              view || this.state.view,
              result.snapshotId,
            );
        }
        return result;
      }
      if (workspaceId === this.state.workspaceId) this.update({ data });
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  async openFromSession(sessionId: string) {
    const context = await this.api(
      `session-context?sessionId=${encodeURIComponent(sessionId)}`,
    );
    if (!context.available) throw Error("该会话没有可用的Git工作区");
    const previousPage = this.state.page;
    const navigation = ++this.navigation;
    this.recordGeneration++;
    this.update({
      page: "preparing",
      workspaceId: context.workspaceId,
      returnSessionId: sessionId,
    });
    try {
      const result = await this.run(
        "capture",
        { workspaceId: context.workspaceId, sessionId: context.sessionId },
        { view: "overview", open: false },
      );
      if (!result.snapshotId)
        throw Error(result.reason || "没有可生成审查记录的改动");
      if (navigation === this.navigation) {
        await this.open(result.deliveryId!, "overview", result.snapshotId);
        this.native.showPanel();
      }
    } catch (error) {
      if (navigation === this.navigation)
        this.update({ page: previousPage, error: "" });
      throw error;
    }
  }
  sessionContext(sessionId: string) {
    const old = this.sessionContexts.get(sessionId);
    if (old && Date.now() - old.at < 1000) return old.promise;
    const promise = this.api(
      `session-context?sessionId=${encodeURIComponent(sessionId)}`,
    );
    this.sessionContexts.set(sessionId, { at: Date.now(), promise });
    return promise;
  }
  download(format: "md" | "html") {
    const r = this.state.record;
    if (!r) throw Error("没有所选审查记录");
    const query = new URLSearchParams({
      workspaceId: this.workspaceId(),
      deliveryId: r.delivery.deliveryId,
      snapshotId: r.snapshot.snapshotId,
      format,
    });
    return fetch(base + "download?" + query).then(async (response) => {
      if (!response.ok) throw Error(await response.text());
      const blob = await response.blob(),
        a = document.createElement("a"),
        url = URL.createObjectURL(blob);
      a.href = url;
      a.download =
        r.delivery.title.replace(/[<>:"/\\|?*]/g, "_") + "." + format;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }
  async perform<T>(action: () => Promise<T>): Promise<T | null> {
    try {
      return await action();
    } catch (error) {
      this.update({ error: errorMessage(error) });
      return null;
    }
  }
  workspaceId(): string {
    const id = this.state.workspaceId;
    if (!id) throw Error("请选择工作区");
    return id;
  }
  start() {
    this.offNative = this.native.subscribe(() => this.refresh());
    this.refresh();
    const loop = async () => {
      if (this.stopped) return;
      try {
        const { jobs } = await this.api(
          `bridge/next?clientId=${encodeURIComponent(this.clientId)}`,
        );
        for (const job of jobs) {
          let result, error;
          try {
            result = await this.native.execute(
              job.action,
              job.payload,
              job.expiresAt,
            );
          } catch (e) {
            error = errorMessage(e);
          }
          await this.api("bridge/answer", {
            id: job.id,
            nonce: job.nonce,
            result,
            error,
          });
        }
      } catch {
      } finally {
        if (!this.stopped) this.bridgeTimer = setTimeout(loop, 500);
      }
    };
    loop();
    this.refreshTimer = setInterval(() => {
      if (this.state.data?.operations.some((o) => o.status === "running"))
        this.refresh();
    }, 1000);
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.bridgeTimer);
    clearInterval(this.refreshTimer);
    this.offNative?.();
  }
}
