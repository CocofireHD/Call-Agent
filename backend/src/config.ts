import "dotenv/config";

export const KILO_MODEL = "kilo-auto/free";
export const KILO_BASE_URL = "https://api.kilo.ai/api/gateway";
export const KILO_CHAT_PATH = "/chat/completions";

export const KILO_TIMEOUT_MS = 25000;
export const DEEPGRAM_TIMEOUT_MS = 8000;

export const MAX_TEXT_CHARS = 12000;
export const MAX_CONVERSATION_MESSAGES = 30;
export const MAX_MESSAGE_CHARS = 2000;

export const kiloConfigured = () => Boolean(process.env.KILO_API_KEY?.trim());
export const deepgramConfigured = () => Boolean(process.env.DEEPGRAM_API_KEY?.trim());

export const PORT = Number(process.env.PORT ?? 3001);

const DEFAULT_ALLOWED = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://cocofirehd.github.io",
];

export function allowedOrigins(): string[] {
  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED, ...extra])];
}
