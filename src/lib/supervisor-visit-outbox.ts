import Dexie, { type Table } from "dexie";

export type PendingVisitDraft = {
  id: string;
  schoolWorkId: string;
  visitDate: string;
  notes: string;
  materialsGiven: { item: string; qty: number }[];
  photos: Record<string, unknown>[];
  gpsLocation?: { lat: number; lng: number; locationLabel: string };
  createdAt: number;
  retryCount: number;
};

class SupervisorVisitOutboxDb extends Dexie {
  drafts!: Table<PendingVisitDraft, string>;

  constructor() {
    super("flexhrm_supervisor_visit_outbox");
    this.version(1).stores({ drafts: "id, createdAt, schoolWorkId" });
  }
}

const db = new SupervisorVisitOutboxDb();

export async function queueVisitDraft(
  draft: Omit<PendingVisitDraft, "id" | "createdAt" | "retryCount">,
): Promise<string> {
  const id = `visit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.drafts.put({
    ...draft,
    id,
    createdAt: Date.now(),
    retryCount: 0,
  });
  return id;
}

export async function listPendingVisitDrafts(): Promise<PendingVisitDraft[]> {
  return db.drafts.orderBy("createdAt").toArray();
}

export async function removeVisitDraft(id: string): Promise<void> {
  await db.drafts.delete(id);
}

export async function incrementVisitDraftRetry(id: string): Promise<void> {
  const row = await db.drafts.get(id);
  if (!row) return;
  await db.drafts.put({ ...row, retryCount: row.retryCount + 1 });
}

export async function flushVisitOutbox(
  submit: (draft: PendingVisitDraft) => Promise<void>,
): Promise<number> {
  const drafts = await listPendingVisitDrafts();
  let flushed = 0;
  for (const draft of drafts) {
    if (draft.retryCount >= 10) continue;
    try {
      await submit(draft);
      await removeVisitDraft(draft.id);
      flushed += 1;
    } catch {
      await incrementVisitDraftRetry(draft.id);
    }
  }
  return flushed;
}

export function registerVisitOutboxSync(
  submit: (draft: PendingVisitDraft) => Promise<void>,
): () => void {
  const run = () => {
    void flushVisitOutbox(submit);
  };
  run();
  window.addEventListener("online", run);
  return () => window.removeEventListener("online", run);
}
