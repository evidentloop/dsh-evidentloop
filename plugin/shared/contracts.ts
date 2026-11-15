import type {
  Annotation,
  AnnotationAnchor,
  Delivery,
  DraftChoice,
  DraftLock,
  DraftResult,
  DraftTemplate,
  FileEntry,
  Mark,
  ModelSide,
  Run,
  Selected,
  Settings,
  Snapshot,
  TriggerResult,
} from "../../core/types.js";
export type * from "../../core/types.js";
export interface Workspace {
  workspaceId: string;
  path: string;
  title: string;
  sessionIds: string[];
  projectKey?: string;
  notGit: boolean;
}
export interface SessionRow {
  sessionId: string;
  title: string;
  updatedAt?: number;
  archived: boolean;
  unavailable: boolean;
  review: boolean;
  formatStatus?: string;
  cwd?: string;
}
export interface DeliveryRow extends Delivery {
  snapshot: Snapshot | null;
  run: Run | null;
  marks: Mark[];
  activeFindingCount: number;
  statusText: string;
}
export interface Operation {
  id: string;
  type: string;
  status: "running" | "failed" | "completed";
  startedAt: string;
  endedAt?: string;
  result?: TriggerResult;
  error?: string;
}
export interface Bootstrap {
  workspaces: Workspace[];
  project: {
    projectKey?: string;
    displayName?: string;
    notGit: boolean;
  } | null;
  deliveries: DeliveryRow[];
  sessions: SessionRow[];
  settings: Settings | null;
  operations: Operation[];
  modelTestGate: {
    approved: boolean;
    remaining: number;
  };
}
export interface ReviewRecord extends Omit<Selected, "bundleRoot"> {
  readOnly: boolean;
  reviewablePaths: string[];
  statusText: string;
  extensionChanged: boolean;
  comparison: {
    added: string[];
    changed: string[];
    removed: string[];
  } | null;
  history: Array<{
    snapshotId: string;
    createdAt: string;
    range: Snapshot["range"];
    statusText: string;
  }>;
}
export interface FileResponse {
  file: FileEntry;
  reviewable: boolean;
  base: string | null;
  head: string | null;
  patch: string;
  note: string;
}
export type SessionContext =
  | {
      available: false;
    }
  | {
      available: true;
      workspaceId: string;
      sessionId: string;
      deliveryId?: string;
      statusText: string;
      activeFindingCount: number;
    };
export type View = "overview" | "diff";
export interface ListPreferences {
  archived: boolean;
  onlyIssues: boolean;
  sort: "updated" | "issues";
  compact: boolean;
}
export interface RuntimeState {
  loading: boolean;
  error: string;
  workspaceId: string | null;
  data: Bootstrap | null;
  page: "list" | "preparing" | "review";
  record: ReviewRecord | null;
  view: View;
  query: string;
  listPreferences: ListPreferences;
  returnSessionId: string | null;
  notice: string;
}
export interface Jump {
  path: string;
  side?: ModelSide;
  line?: number | null;
  startLine?: number | null;
  findingId?: string;
  token?: number;
}
export interface RecordAddress {
  workspaceId: string;
  deliveryId: string;
  snapshotId: string;
}
export interface ReviewInput {
  workspaceId: string;
  sessionId?: string;
  deliveryId?: string;
  snapshotId?: string;
  scope?: string;
  force?: boolean;
  externalRef?: string;
  requirement?: {
    id?: string;
    kind: "paste" | "file";
    text: string;
    origin?: string;
  };
}
export interface WriteDraft {
  sessionId: string;
  text: string;
  expectedRevision: number;
}
export interface QuoteDraft {
  sessionId: string;
  summary: string;
  code: string;
  expectedRevision?: number;
}
export interface BridgePayloads {
  getDraft: {
    sessionId: string;
  };
  writeDraft: WriteDraft;
  quote: QuoteDraft;
  copy: {
    text: string;
  };
  openFile: {
    path: string;
  };
}
export interface BridgeResults {
  getDraft: import("../../core/types.js").NativeDraft;
  writeDraft: {
    written: boolean;
    revision?: number;
  };
  quote: {
    written: boolean;
    duplicate?: boolean;
    revision?: number;
  };
  copy: {
    copied: boolean;
  };
  openFile: {
    opened: boolean;
  };
}
export type BridgeAction = keyof BridgePayloads;
export type BridgeJob = {
  [K in BridgeAction]: {
    action: K;
    payload: BridgePayloads[K];
    id: string;
    nonce: string;
    expiresAt: number;
  };
}[BridgeAction];
export interface BridgeAnswer {
  id: string;
  nonce: string;
  result?: unknown;
  error?: string;
}
export type QuoteResult =
  | {
      status: "written";
      targetId: string;
      duplicate: boolean;
      reason?: string;
    }
  | {
      status: "copied";
      reason: string;
      duplicate?: false;
    };
export interface ApiRequests {
  [asset: `assets/${string}`]: Record<string, never>;
  bootstrap: {
    workspaceId?: string;
  };
  record: RecordAddress;
  file: RecordAddress & {
    path: string;
  };
  "session-context": {
    sessionId: string;
  };
  "bridge/next": {
    clientId: string;
  };
  "bridge/answer": BridgeAnswer;
  review: ReviewInput;
  capture: ReviewInput;
  cancel: {
    workspaceId: string;
    deliveryId: string;
  };
  settings: {
    workspaceId: string;
    settings: Settings;
  };
  mark: RecordAddress & {
    findingId: string;
    suppressed: boolean;
  };
  annotation: RecordAddress & {
    annotationId?: string;
    findingId?: string;
    anchor?: AnnotationAnchor;
    text?: string;
    remove?: boolean;
  };
  delivery: {
    workspaceId: string;
    deliveryId: string;
    action: "delete" | "archive" | "pin";
    value?: boolean;
    confirm?: "delete";
  };
  "draft/lock": RecordAddress & {
    template: DraftTemplate;
  };
  "draft/commit": {
    token: string;
    displayedSnapshotId?: string;
    choice: DraftChoice;
  };
  "open-file": RecordAddress & {
    path: string;
  };
  quote: RecordAddress & {
    findingId?: string;
    path?: string;
    side?: ModelSide;
    line?: number | null;
  };
  download: RecordAddress & {
    format: "md" | "html";
  };
  diagnostics: Record<string, never>;
}
export interface ApiResponses {
  diagnostics: {
    routes: string[];
    modelGate: { approved: boolean; remaining: number };
    ownedReviewSessions: string[];
    activeReviews: string[];
  };
  bootstrap: Bootstrap;
  record: ReviewRecord;
  file: FileResponse;
  "session-context": SessionContext;
  "bridge/next": {
    jobs: BridgeJob[];
  };
  "bridge/answer": {
    accepted: boolean;
  };
  review: {
    operationId: string;
    status: "accepted";
  };
  capture: ApiResponses["review"];
  cancel: ApiResponses["review"];
  settings: {
    saved: boolean;
    settings: Settings;
  };
  mark: Mark;
  annotation:
    | Annotation
    | {
        deleted: boolean;
      };
  delivery: {
    saved: boolean;
  };
  "draft/lock": DraftLock;
  "draft/commit": DraftResult;
  "open-file": {
    opened: boolean;
  };
  quote: QuoteResult;
}
export type ApiRoute = keyof ApiResponses;
export type ApiUrl<K extends ApiRoute> = K | `${K}?${string}`;
export type ClientRequest<K extends keyof ApiRequests> = ApiRequests[K] & {
  clientId: string;
};
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
