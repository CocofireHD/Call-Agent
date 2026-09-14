import type { ChatMsg, Classification } from "../types";

/** Backend base URL — NOT a secret. Configured via env, defaults to local dev. */
export function backendBase(): string {
  const fromEnv = import.meta.env.VITE_BACKEND_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // On GitHub Pages the same-origin /api won't exist; user must set VITE_BACKEND_URL.
  // Default to localhost for local dev (Vite proxies /api -> :3001 anyway).
  if (typeof window !== "undefined" && window.location.hostname.endsWith("github.io")) return "";
  return "http://localhost:3001";
}

export function apiUrl(path: string): string {
  const base = backendBase();
  if (!base) return path; // same-origin attempt (will 404 on Pages without backend — handled in UI)
  // If base is set and path starts with /api, join them.
  return `${base}${path}`;
}

export interface ApiError {
  error: string;
  message: string;
}

export async function apiHealth(): Promise<{ ok: boolean; kiloConfigured: boolean; deepgramConfigured: boolean; model?: string }> {
  const res = await fetchWithTimeout(apiUrl("/api/health"), { method: "GET" }, 8000);
  if (!res.ok) throw new Error(`Backend ${res.status}`);
  return (await res.json()) as { ok: boolean; kiloConfigured: boolean; deepgramConfigured: boolean };
}

export async function apiClassify(input: {
  source: "email" | "call";
  from?: string;
  subject?: string;
  text: string;
}): Promise<Classification> {
  if (backendMissingOnPages()) {
    throw new Error("Backend-URL nicht konfiguriert. Setze VITE_BACKEND_URL auf dein deployed Backend (siehe README).");
  }
  const res = await fetchWithTimeout(
    apiUrl("/api/classify"),
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    45000
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as ApiError | null)?.message ?? `Klassifizierung fehlgeschlagen (${res.status})`);
  }
  return data as Classification;
}

export async function apiAgentRespond(conversation: ChatMsg[]): Promise<string> {
  if (backendMissingOnPages()) {
    throw new Error("Backend-URL nicht konfiguriert (VITE_BACKEND_URL).");
  }
  const res = await fetchWithTimeout(
    apiUrl("/api/agent/respond"),
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation }) },
    40000
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as ApiError | null)?.message ?? `Agent antwortet nicht (${res.status})`);
  const reply = (data as { reply?: string })?.reply;
  if (!reply) throw new Error("Leere Agent-Antwort erhalten.");
  return reply;
}

export async function apiDeepgramToken(): Promise<{ token: string; expiresIn: number }> {
  if (backendMissingOnPages()) {
    throw new Error("Backend-URL nicht konfiguriert. Deepgram-Token braucht das Backend (siehe README).");
  }
  const res = await fetchWithTimeout(apiUrl("/api/deepgram-token"), { method: "POST" }, 12000);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as ApiError | null)?.message ?? `Deepgram-Token Fehler (${res.status})`);
  return data as { token: string; expiresIn: number };
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Zeitüberschreitung — Backend antwortet nicht.");
    if (e instanceof TypeError) throw new Error("Backend nicht erreichbar. Läuft das Backend? (npm run dev)");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function backendMissingOnPages(): boolean {
  return backendBase() === "";
}
