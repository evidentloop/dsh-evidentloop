export interface ModelSelection {
  provider: string;
  model: string;
  reasoningEffort?: string;
  contextWindow?: number;
  maxTokens?: number;
}
export interface HostSession {
  id: string;
}
export interface HostEvent {
  seq: number;
  type: string;
  data: unknown;
}
interface EventData {
  "user/message": {
    id: string;
    source: { kind: string };
    content: Array<{ type: string; text: string }>;
  };
  "assistant/message": {
    message: { content: Array<{ type: string; text: string }> };
  };
  "request/header": { header: { config: ModelSelection } };
  "request/context": { contextWindow: number };
  "turn/end": { reason: { kind: string } };
}
export type KnownEvent<K extends keyof EventData> = HostEvent & {
  type: K;
  data: EventData[K];
};
// DSH discriminates its documented event payloads by type; all other events stay opaque.
export function eventIs<K extends keyof EventData>(
  event: HostEvent,
  type: K,
): event is KnownEvent<K> {
  return event.type === type;
}
export interface Agent {
  session: HostSession;
  model: {
    current(): ModelSelection | undefined;
  };
  cancel(reason: { kind: string; reason?: string }): void;
  whenIdle(): Promise<void>;
}
export interface AgentHandle {
  agent: Agent;
  dispose(): Promise<void>;
}
interface AgentContext {
  tools: {
    restrict(options: { allow: string[] }): void;
  };
  on(
    event: "agent/pre-step",
    callback: (
      payload: unknown,
      next: () => Promise<unknown>,
    ) => Promise<unknown>,
  ): void;
  on(
    event: "agent/assistant-stream",
    callback: (payload: {
      frame: {
        type: string;
        chunk: {
          type: string;
          reason?: {
            kind: string;
            failure?: {
              code: string;
            };
          };
        };
      };
    }) => void,
  ): void;
}
export interface HostContext {
  connection: {
    fetch: {
      register(route: {
        path: string;
        methods: string[];
        requestBody: "buffered";
        fetch(request: Request): Promise<Response>;
      }): void;
    };
  };
  workspaceRegistry: {
    list(): Array<{
      id: string;
      path: string;
      title: string;
      sessionIds: string[];
    }>;
    archivedSessionIds: string[];
  };
  sessionController: {
    list(
      query: object,
      signal: AbortSignal,
    ): Promise<{
      items: Array<{
        sessionId: string;
        cwd?: string;
        origin?: string;
        parentSessionId?: string;
        formatStatus?: string;
        updatedAt?: number;
        running?: boolean;
        projections?: {
          state?: string;
          values?: {
            title?: string;
          };
        };
      }>;
    }>;
    events(
      query: {
        address: {
          kind: "session";
          sessionId: string;
        };
        maxMessages: number;
        throughSeq?: number;
        beforeSeq?: number;
      },
      signal: AbortSignal,
    ): Promise<{
      cursor: number;
      records: Array<{
        type: string;
        event: HostEvent;
      }>;
      hasMore: boolean;
    }>;
    resolveAgent(id: string): Promise<
      | {
          agent: Agent;
        }
      | {
          error: Error;
        }
    >;
    prompt(
      request: {
        sessionId: string;
        requestId: string;
        mode: "queue";
        content: Array<{
          type: "text";
          text: string;
        }>;
      },
      signal: AbortSignal,
    ): Promise<unknown>;
  };
  sessions: {
    get(id: string): HostSession | undefined;
    flush(session: HostSession): Promise<void>;
  };
  agents: {
    create(options: {
      sessionId: string;
      meta: {
        cwd: string;
      };
      agentOptions: ModelSelection;
      setup(ctx: AgentContext, agent: Agent): void;
    }): Promise<AgentHandle>;
  };
  tools: {
    schemas(agent: Agent): unknown[];
  };
  llm: {
    resolveModelInfo(
      provider: string,
      model: string,
    ): Promise<{
      name?: string;
      reasoning?: {
        defaultEffort?: string;
      };
      context?: {
        contextWindow?: number;
      };
    }>;
  };
  get(service: "sessionTitle"): {
    get(session: HostSession):
      | {
          title: string;
        }
      | undefined;
    rename(session: HostSession, title: string): void;
  };
  get(service: "agentDefaultModel"): {
    currentSelection(): ModelSelection | undefined;
  };
  on(
    event: "session/event",
    listener: (session: HostSession, event: HostEvent) => void,
  ): () => void;
  effect(factory: () => () => void | Promise<void>): void;
}
export interface PluginConfig {
  storageRoot: string;
  methodRoot: string;
  assetRoot: string;
  /** Explicit isolation guard. Production review does not require an approval file. */
  approvalFile?: string;
  requireApproval?: boolean;
}
export interface Approval extends ModelSelection {
  approvedBy: string;
  taskId: string;
  expiresAt: string;
  maxCalls: number;
  used: number;
  projectKey: string;
  inputSha: string;
  promptVersion: string;
  maxInputBytes?: number;
  maxOutputTokens?: number;
}
export interface RegistryRow {
  runId: string;
  callerId?: string;
  projectKey: string;
  model?: ModelSelection & {
    name: string;
  };
}
