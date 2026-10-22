import type { UnitSalesDraft } from "../unit-sales";
export type LocalEntry = {
  userId: string;
  date: string;
  draft: UnitSalesDraft;
  baseVersion: number | null;
  serverVersion: number | null;
  updatedAt: string;
  confirmed?: boolean;
  syncPaused?: boolean;
  pending?: { requestId: string; body: unknown };
};
export const draftKey = (userId: string, date: string) => `${userId}:${date}`;
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("danielli-production-drafts", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("drafts"))
        request.result.createObjectStore("drafts", { keyPath: "key" });
      if (!request.result.objectStoreNames.contains("locks"))
        request.result.createObjectStore("locks", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function readLocal(
  userId: string,
  date: string,
): Promise<LocalEntry | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("drafts")
        .objectStore("drafts")
        .get(draftKey(userId, date));
      request.onsuccess = () => resolve(request.result?.entry ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function listLocal(
  userId: string,
  month: string,
): Promise<LocalEntry[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("drafts").objectStore("drafts").getAll();
      request.onsuccess = () =>
        resolve(
          request.result
            .map((row) => row.entry as LocalEntry)
            .filter(
              (entry) =>
                entry.userId === userId && entry.date.startsWith(month),
            )
            .sort((a, b) => b.date.localeCompare(a.date)),
        );
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function writeLocal(
  entry: LocalEntry,
  leaseOwner?: string,
  canWrite: () => boolean = () => true,
) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        leaseOwner ? ["drafts", "locks"] : ["drafts"],
        "readwrite",
      );
      const put = () => {
        if (!canWrite()) {
          transaction.abort();
          return;
        }
        return transaction
          .objectStore("drafts")
          .put({ key: draftKey(entry.userId, entry.date), entry });
      };
      if (leaseOwner) {
        const check = transaction
          .objectStore("locks")
          .get(draftKey(entry.userId, entry.date));
        check.onsuccess = () => {
          const lease = check.result;
          if (
            !lease ||
            lease.owner !== leaseOwner ||
            lease.expiresAt <= Date.now()
          ) {
            transaction.abort();
            return;
          }
          put();
        };
      } else put();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(
          new Error(
            "A edição está aberta em outra aba. Seu preenchimento não foi sobrescrito.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function claimLease(
  key: string,
  owner: string,
  release = false,
): Promise<boolean> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("locks", "readwrite");
      const store = transaction.objectStore("locks");
      let held = false;
      const request = store.get(key);
      request.onsuccess = () => {
        const current = request.result;
        if (release) {
          if (current?.owner === owner) store.delete(key);
          return;
        }
        if (
          !current ||
          current.owner === owner ||
          current.expiresAt <= Date.now()
        ) {
          store.put({ key, owner, expiresAt: Date.now() + 30000 });
          held = true;
        }
      };
      transaction.oncomplete = () => resolve(held);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
