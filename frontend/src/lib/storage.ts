import type { ActivityItem } from "../types";

const KEY = "call-agent:activity:v1";

export function loadActivity(): ActivityItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.id === "string" && x.classification)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  } catch {
    return [];
  }
}

export function saveActivity(items: ActivityItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
  } catch {
    // storage full/blocked — ignore, app still works this session
  }
}

export function addActivity(item: ActivityItem): ActivityItem[] {
  const next = [item, ...loadActivity()].slice(0, 200);
  saveActivity(next);
  return next;
}

export function clearActivity(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
