import { readItem, writeItem } from "@/lib/storage";

export const BIOMETRIC_LOCK_KEY = "mtm.biometric-lock";
export const CLASS_REMINDERS_KEY = "mtm.class-reminders";
const listeners = new Map<string, Set<(enabled: boolean) => void>>();

export async function readFlag(key: string): Promise<boolean> {
  return (await readItem(key)) === "1";
}

export async function writeFlag(key: string, enabled: boolean): Promise<void> {
  await writeItem(key, enabled ? "1" : null);
  listeners.get(key)?.forEach((listener) => listener(enabled));
}

export function subscribeFlag(key: string, listener: (enabled: boolean) => void): () => void {
  const group = listeners.get(key) ?? new Set<(enabled: boolean) => void>();
  group.add(listener);
  listeners.set(key, group);
  return () => {
    group.delete(listener);
    if (group.size === 0) listeners.delete(key);
  };
}
