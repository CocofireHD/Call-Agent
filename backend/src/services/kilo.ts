import {
  KILO_BASE_URL,
  KILO_CHAT_PATH,
  KILO_MODEL,
  KILO_TIMEOUT_MS,
} from "../config.js";
import { CLASSIFIER_SYSTEM_PROMPT } from "../prompts/classifier.js";
import { RECEPTIONIST_SYSTEM_PROMPT } from "../prompts/receptionist.js";
import {
  AgentRequestSchema,
  ClassificationSchema,
  type AgentRequest,
  type Classification,
  type ClassifyRequest,
} from "../schemas/classification.js";

export type KiloErrorKind =
  | "not_configured"
  | "timeout"
  | "rate_limited"
  | "bad_response"
  | "malformed_json"
  | "http_error";

export class KiloError extends Error {
  kind: KiloErrorKind;
  status?: number;
  constructor(kind: KiloErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new KiloError("timeout", `Kilo request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function kiloHeaders(): Record<string, string> {
  const key = process.env.KILO_API_KEY?.trim();
  if (!key) throw new KiloError("not_configured", "KILO_API_KEY is not configured on the backend");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function callKiloChat(messages: ChatMessage[], opts?: { maxTokens?: number; temperature?: number }): Promise<string> {
  const url = `${KILO_BASE_URL}${KILO_CHAT_PATH}`;
  const body = {
    model: KILO_MODEL,
    messages,
    max_tokens: opts?.maxTokens ?? 800,
    temperature: opts?.temperature ?? 0.3,
    stream: false,
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        { method: "POST", headers: kiloHeaders(), body: JSON.stringify(body) },
        KILO_TIMEOUT_MS
      );
    } catch (e) {
      lastError = e;
      if (e instanceof KiloError && e.kind === "timeout" && attempt === 0) continue;
      throw e;
    }

    if (res.status === 429) {
      if (attempt === 0) {
        await sleep(1200);
        lastError = new KiloError("rate_limited", "Kilo rate limit (429). Bitte kurz warten und erneut versuchen.", 429);
        continue;
      }
      throw new KiloError("rate_limited", "Kilo rate limit (429). Bitte kurz warten und erneut versuchen.", 429);
    }

    if (!res.ok) {
      const text = await safeText(res);
      if (res.status >= 500 && attempt === 0) {
        lastError = new KiloError("http_error", `Kilo server error (${res.status}). Retry…`, res.status);
        await sleep(800);
        continue;
      }
      throw new KiloError("http_error", `Kilo error ${res.status}: ${truncate(text, 300)}`, res.status);
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new KiloError("bad_response", "Kilo returned a non-JSON response");
    }

    const content = extractContent(json);
    if (!content) throw new KiloError("bad_response", "Kilo response had no message content");
    return content;
  }
  throw lastError instanceof Error ? lastError : new KiloError("http_error", "Kilo request failed");
}

/** Extract OpenAI-compatible message content defensively. */
function extractContent(json: unknown): string | null {
  try {
    const j = json as Record<string, unknown>;
    const choices = j["choices"] as Array<Record<string, unknown>> | undefined;
    const first = choices?.[0];
    const message = first?.["message"] as Record<string, unknown> | undefined;
    const content = message?.["content"];
    if (typeof content === "string" && content.trim()) return content;
    // Some gateways return content as parts array
    if (Array.isArray(content)) {
      const text = content
        .map((p) => (typeof p === "string" ? p : (p as Record<string, unknown>)?.["text"] ?? ""))
        .join("")
        .trim();
      if (text) return text;
    }
    // Fallback: reasoning-style "text" field
    const text = (first as Record<string, unknown> | undefined)?.["text"];
    if (typeof text === "string" && text.trim()) return text;
    return null;
  } catch {
    return null;
  }
}

/** Extract a JSON object even if wrapped in markdown fences or prose. */
export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) return trimmed.slice(first, last + 1).trim();
  return trimmed;
}

function parseClassification(raw: string): Classification {
  const candidate = extractJsonObject(raw);
  const parsed: unknown = JSON.parse(candidate);
  return ClassificationSchema.parse(parsed);
}

export async function classifyCommunication(input: ClassifyRequest): Promise<Classification> {
  const sourceNote =
    input.source === "email"
      ? "Source: EMAIL sent to demo@company.local."
      : "Source: PHONE CALL transcript (caller = outsider, receptionist = our company). Focus on the caller's need.";
  const headerParts = [
    sourceNote,
    input.from ? `From: ${input.from}` : "",
    input.subject ? `Subject: ${input.subject}` : "",
  ].filter(Boolean);

  const userContent = `${headerParts.join("\n")}\n\n--- CONTENT START ---\n${input.text}\n--- CONTENT END ---\n\nClassify now. JSON only.`;

  const messages: ChatMessage[] = [
    { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  let raw: string;
  try {
    raw = await callKiloChat(messages, { maxTokens: 900, temperature: 0.2 });
  } catch (e) {
    throw e;
  }

  try {
    return parseClassification(raw);
  } catch {
    // One repair retry: ask model to re-emit strict JSON
    const repairMessages: ChatMessage[] = [
      { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
      { role: "user", content: userContent },
      { role: "assistant", content: raw },
      {
        role: "user",
        content:
          "Your previous reply was not valid JSON for the required schema. Reply again with ONLY the corrected JSON object, no markdown, no commentary.",
      },
    ];
    try {
      const repaired = await callKiloChat(repairMessages, { maxTokens: 900, temperature: 0 });
      return parseClassification(repaired);
    } catch (e2) {
      if (e2 instanceof SyntaxError || (e2 as Error)?.name === "ZodError") {
        throw new KiloError("malformed_json", "KI-Antwort konnte nicht als valides Label-JSON gelesen werden. Bitte erneut versuchen.");
      }
      throw e2;
    }
  }
}

export async function agentRespond(input: AgentRequest): Promise<string> {
  const parsed = AgentRequestSchema.parse(input);
  const messages: ChatMessage[] = [
    { role: "system", content: RECEPTIONIST_SYSTEM_PROMPT },
    ...parsed.conversation.slice(-12).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];
  const reply = await callKiloChat(messages, { maxTokens: 220, temperature: 0.6 });
  // Keep receptionist brief: hard-trim overly long answers
  const cleaned = reply.trim();
  if (cleaned.length <= 600) return cleaned;
  const cut = cleaned.slice(0, 600);
  const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  return (lastStop > 200 ? cut.slice(0, lastStop + 1) : cut + "…").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function kiloErrorToStatus(kind: KiloErrorKind): number {
  switch (kind) {
    case "not_configured":
      return 500;
    case "timeout":
      return 504;
    case "rate_limited":
      return 429;
    case "malformed_json":
      return 502;
    case "bad_response":
    case "http_error":
    default:
      return 502;
  }
}
