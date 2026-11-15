import type {
  Adapter,
  Annotation,
  AnnotationAnchor,
  Delivery,
  DraftChoice,
  DraftLock,
  DraftResult,
  DraftTemplate,
  FileEntry,
  LedgerEntry,
  Mark,
  Preparation,
  Project,
  Requirement,
  Run,
  Selected,
  Session,
  Settings,
  Snapshot,
  TriggerResult,
} from "./types.js";
export type * from "./types.js";
export class FileStore {
  constructor(root: string);
  root: string;
  delivery(key: string, id: string): Delivery | null;
  deliveries(key: string): Delivery[];
  snapshot(key: string, id: string): Snapshot | null;
  settings(key: string): Settings;
  setSettings(key: string, settings: Settings): Promise<void>;
  updateDelivery(
    key: string,
    id: string,
    change: (delivery: Delivery) => void,
  ): Promise<Delivery | null>;
  archive(key: string, id: string, value: boolean): Promise<unknown>;
  pin(key: string, id: string, value: boolean): Promise<unknown>;
}
export class ReviewCore {
  constructor(options: {
    store: FileStore;
    adapter: Adapter;
    methodRoot: string;
  });
  store: FileStore;
  adapter: Adapter;
  initialize(): Promise<this>;
  selected(key: string, id: string): Selected;
  writable(key: string, id: string, readOnly: boolean): Snapshot;
  trigger(options: {
    repo: string;
    sessionId?: string;
    requirements: Requirement[];
    scope: string;
    force: boolean;
    captureOnly: boolean;
    expectedDeliveryId?: string;
    onPrepared?: (prepared: Preparation) => Promise<void>;
  }): Promise<TriggerResult>;
  mark(
    key: string,
    value: {
      snapshotId: string;
      findingId: string;
      suppressed: boolean;
    },
  ): Promise<Mark>;
  annotate(
    key: string,
    value: {
      snapshotId: string;
      annotationId?: string;
      findingId?: string;
      anchor?: AnnotationAnchor;
      text: string;
    },
  ): Promise<Annotation>;
  deleteAnnotation(
    key: string,
    snapshotId: string,
    id: string,
  ): Promise<unknown>;
  deleteDelivery(key: string, id: string): Promise<void>;
  deliveries: {
    findOpen(
      key: string,
      options: {
        branch: string;
        targetBranch: string;
        session: Session | null;
      },
    ): Delivery | null;
  };
  scheduler: {
    projects: Map<string, unknown>;
    idle(key: string): Promise<void>;
    cancelDelivery(key: string, id: string): Promise<void>;
    state(key: string): {
      active?: {
        deliveryId: string;
      };
      pending: Map<string, unknown>;
    };
  };
}
export class RequirementLedger {
  constructor(state: LedgerEntry[]);
  captureMessages(
    id: string,
    messages: Array<{
      id: string;
      sequence: number;
      text: string;
    }>,
  ): void;
  captureManual(value: {
    id?: string;
    source: {
      kind: "paste" | "file";
      text: string;
      origin: string;
    };
  }): void;
  sources(): Requirement[];
  state(): LedgerEntry[];
}
export class Drafts {
  constructor(adapter: Adapter);
  target(delivery: Delivery): Promise<{
    id: string;
    session: Session | null;
  } | null>;
  lock(selected: Selected, template: DraftTemplate): Promise<DraftLock>;
  commit(
    token: string,
    options: {
      displayedSnapshotId?: string;
      choice: DraftChoice;
    },
  ): Promise<DraftResult>;
}
export function projectFor(root: string): Project;
export function developmentSession(
  adapter: Adapter,
  id?: string,
): Promise<Session | null>;
export function loadBundle(root: string): {
  texts: Map<
    string,
    {
      text: string;
      lines: string[];
    }
  >;
  targets: string[];
};
export function markdown(selected: Selected): string;
export function html(
  selected: Selected,
  options: {
    embedDiff: boolean;
  },
): string;
export function reviewStatus(
  snapshot: Snapshot,
  run?: Run | null,
  marks?: Mark[],
): string;
export function compareSnapshots(
  snapshot: Snapshot,
  previous: Snapshot | null,
): {
  added: string[];
  changed: string[];
  removed: string[];
} | null;
export function redactText(text: string): string;
