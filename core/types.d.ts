import type { ModelOutput, ModelRef, ModelSide } from "./model-output.js";
export type { ModelOutput, ModelRef, ModelSide } from "./model-output.js";
export type Finding = ModelOutput["findings"][number] & {
  findingId: string;
};
export type Understanding = Omit<
  ModelOutput,
  "findings" | "schemaVersion" | "inputSha" | "promptVersion"
> & {
  overview: ModelOutput["overview"] & {
    basis: "fact" | "inference";
  };
};
export interface FileEntry {
  path: string;
  oldPath?: string;
  kind:
    "text" | "binary" | "oversize" | "excluded" | "submodule" | "conflicted";
  change: "added" | "deleted" | "renamed" | "modified" | "mode-changed";
  note?: string;
  baseSha256: string | null;
  headSha256: string | null;
  baseLineCount?: number;
  headLineCount?: number;
  additions?: number;
  deletions?: number;
}
export interface Range {
  headSha: string;
  baseSha: string;
  targetRef: string;
  headSubject?: string;
  dirty: boolean;
}
export interface Requirement {
  reqId: string;
  origin: string;
  kind: string;
  capturedAt: string;
  sourceId?: string;
  text: string;
  items: Array<{
    itemId: string;
    start: number;
    end: number;
    text?: string;
  }>;
}
export interface Snapshot {
  projectKey: string;
  snapshotId: string;
  deliveryId: string;
  inputSha: string;
  promptVersion: string;
  createdAt: string;
  files: FileEntry[];
  range: Range;
  requirements: Requirement[];
  extensionPrompt?: {
    sha256: string;
  };
}
export interface Delivery {
  projectKey: string;
  deliveryId: string;
  title: string;
  branch: string;
  createdAt: string;
  externalRef?: string;
  archivedAt?: string;
  pinnedAt?: string;
  sessionIds: string[];
  snapshotIds: string[];
  latestSnapshotId?: string;
  current?: {
    snapshotId: string;
    inputSha: string;
    generation: number;
  };
  requirementLedger?: LedgerEntry[];
}
export interface Coverage {
  reviewed: string[];
  skipped: Array<
    | string
    | {
        path: string;
        reason: string;
      }
  >;
  failed: Array<
    | string
    | {
        path: string;
        reason?: string;
      }
  >;
  withheld: Array<{
    reason?: string;
  }>;
}
export interface Run {
  runId: string;
  snapshotId: string;
  deliveryId: string;
  inputSha: string;
  promptVersion: string;
  status:
    "queued" | "running" | "succeeded" | "failed" | "cancelled" | "partial";
  complete: boolean;
  findings?: Finding[];
  understanding?: Understanding;
  coverage: Coverage;
  model: {
    adapter: string;
    provider?: string;
    model?: string;
    name?: string;
  };
  errorCode?: string;
  startedAt: string;
  endedAt?: string;
}
export interface Mark {
  findingId: string;
  snapshotId: string;
  suppressed: boolean;
}
export interface AnnotationAnchor {
  path: string;
  side: ModelSide;
  startLine: number | null;
  endLine: number | null;
  sha256?: string | null;
}
export interface Annotation {
  annotationId: string;
  findingId?: string;
  anchor: AnnotationAnchor;
  text: string;
  updatedAt: string;
}
export interface Selected {
  delivery: Delivery;
  snapshot: Snapshot;
  run: Run | null;
  marks: Mark[];
  annotations: Annotation[];
  bundleRoot: string;
}
export interface Settings {
  autoMode: boolean;
  targetBranch: string;
  extensionPrompt: string;
  exportEmbedDiff: boolean;
}
export interface Project {
  projectKey: string;
  repoRoot: string;
  displayName?: string;
}
export interface Session {
  id: string;
  cwd?: string;
  projectKey?: string;
  kind: "review" | "development";
  title?: string;
  archived?: boolean;
  unavailable?: boolean;
  updatedAt?: number;
  running?: boolean;
  origin?: unknown;
  parentSession?: string;
  formatStatus?: string;
}
export interface NativeDraft {
  text: string;
  revision: number;
  quotes: unknown[];
  references?: unknown[];
  attachments: string[];
}
export interface ReviewRequest {
  runId: string;
  sourceSessionId?: string;
  snapshot: Snapshot;
  bundleRoot: string;
  reviewPaths: readonly string[];
  carriedPaths: readonly string[];
  modules: Array<{
    path: string;
    sha256: string;
    text: string;
  }>;
}
export interface Adapter {
  kind: string;
  review(
    request: ReviewRequest,
    options: {
      signal: AbortSignal;
    },
  ): Promise<unknown>;
  session(id: string): Promise<Session | null>;
  getDraft(id: string): Promise<NativeDraft>;
  writeDraft(
    id: string,
    text: string,
    options: {
      expectedRevision: number;
      preserveQuotesAndAttachments?: boolean;
    },
  ): Promise<boolean>;
  copy(text: string): Promise<boolean>;
}
export interface Preparation {
  projectKey: string;
  deliveryId: string;
  snapshotId: string;
  inputSha: string;
  generation: number;
}
export interface TriggerResult {
  status: string;
  projectKey?: string;
  deliveryId?: string;
  snapshotId?: string;
  inputSha?: string;
  reason?: string;
  errorCode?: string;
}
export interface LedgerEntry {
  source: {
    text: string;
  };
  [key: string]: unknown;
}
export type DraftTemplate = "issues" | "understanding";
export type DraftChoice = "auto" | "append" | "copy";
export type DraftLock =
  | {
      available: false;
      reason: string;
    }
  | {
      available: true;
      token: string;
      text: string;
      omitted: string[];
      targetId: string;
      snapshotId: string;
    };
export type DraftResult =
  | {
      status: "written";
      targetId: string;
      text: string;
    }
  | {
      status: "preview";
      existingDraft: NativeDraft;
      text: string;
      choices: string[];
    }
  | {
      status: "copied" | "failed" | "unchanged";
      reason: string;
      text: string;
    };
