import type React from "react";
import type {
  BridgeAction,
  BridgePayloads,
  BridgeResults,
  NativeDraft,
  Workspace,
} from "../shared/contracts.ts";
export interface Store<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}
export interface Composer {
  draftSnapshot: Omit<NativeDraft, "revision" | "attachments">;
  state: Store<{
    draftRev: number;
    phase: string;
    attachmentIds?: string[];
  }>;
  actions: {
    setDraft(draft: Composer["draftSnapshot"]): void;
    persistDraft(): void;
  };
}
export interface WorkspaceService {
  workspaces: {
    list: Store<{
      items: Workspace[];
    }>;
  };
  selection?: Store<{
    workspaceId?: string;
    sessionId?: string;
  }>;
  openWorkspace(id: string): Promise<void>;
  openSession(id: string): Promise<void>;
}
export interface SessionService {
  current: Store<{
    key: string;
  } | null>;
  sessions: {
    retain(
      id: string,
      options: {
        source: string;
      },
    ): {
      ready: Promise<void>;
      release(): void;
    };
    binding(id: string):
      | {
          ctx: {
            get(name: "conversation"): {
              input: {
                for(ctx: unknown): Composer;
              };
            };
          };
        }
      | undefined;
  };
}
export interface ClientContext {
  get(name: "uiWorkspace"): WorkspaceService;
  get(name: "uiSession"): SessionService;
  get(name: "remote"):
    | {
        session?: {
          openWorkspacePath(
            request: {
              path: string;
            },
            signal: AbortSignal,
          ): Promise<{
            opened: boolean;
          }>;
        };
      }
    | undefined;
  layout: {
    selectPanel(id: string): void;
  };
  slots: {
    inject(name: string, register: () => void): void;
    register(
      options: {
        name: string;
        key?: string;
        id?: string;
        label?: string;
        order?: number;
      },
      component: React.ComponentType<{
        size?: number;
        sessionId: string;
      }>,
    ): void;
  };
  effect(factory: () => () => void): void;
}
export interface NativePort {
  workspaceId(): string | null;
  sessionId(): string | null;
  subscribe(listener: () => void): () => void;
  selectWorkspace(id: string): Promise<void>;
  openSession(id: string): Promise<void>;
  showPanel(): void;
  execute<K extends BridgeAction>(
    action: K,
    payload: BridgePayloads[K],
    expiresAt?: number,
  ): Promise<BridgeResults[K]>;
}
