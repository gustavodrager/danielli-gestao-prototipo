import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
export const storagePrefix = "danielli-demo-v2:";
// Somente simulações nesta aba. Nenhuma cópia do histórico financeiro real.
export function useLocalState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storagePrefix + key);
      if (raw) return JSON.parse(raw);
    } catch {
      /* aba sem armazenamento */
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      sessionStorage.setItem(storagePrefix + key, JSON.stringify(value));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [key, value]);
  return [value, setValue, saved];
}
export function upsertByDate<T extends { date: string }>(
  records: T[],
  record: T,
): T[] {
  return [...records.filter((r) => r.date !== record.date), record].sort(
    (a, b) => b.date.localeCompare(a.date),
  );
}
