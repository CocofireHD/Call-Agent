import cors from "cors";
import express from "express";
import { z } from "zod";
import {
  MAX_TEXT_CHARS,
  PORT,
  allowedOrigins,
  deepgramConfigured,
  kiloConfigured,
} from "./config.js";
import { CLASSIFIER_SYSTEM_PROMPT } from "./prompts/classifier.js";
import { RECEPTIONIST_GREETING, RECEPTIONIST_SYSTEM_PROMPT } from "./prompts/receptionist.js";
import {
  AgentRequestSchema,
  ClassifyRequestSchema,
} from "./schemas/classification.js";
import {
  KiloError,
  agentRespond,
  classifyCommunication,
  kiloErrorToStatus,
} from "./services/kilo.js";
import { clientKey, rateLimit } from "./services/rateLimit.js";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "200kb" }));

  const origins = allowedOrigins();
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (origins.some((o) => origin === o || origin.startsWith(o))) return cb(null, true);
        // Allow any localhost/127.0.0.1 port in dev
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin ${origin}`));
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    })
  );

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      const key = clientKey(req.ip, req.headers["x-forwarded-for"]);
      const result = rateLimit(`${key}:${req.path}`);
      if (!result.allowed) {
        res.status(429).json({
          error: "rate_limited",
          message: `Zu viele Anfragen. Bitte in ${result.retryAfterSec ?? 30}s erneut versuchen.`,
        });
        return;
      }
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      kiloConfigured: kiloConfigured(),
      deepgramConfigured: deepgramConfigured(),
      model: "kilo-auto/free",
    });
  });

  app.post("/api/classify", async (req, res) => {
    const parsed = ClassifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_request",
        message: "Ungültige Anfrage. Bitte Text prüfen (1–12000 Zeichen).",
        details: parsed.error.flatten(),
      });
      return;
    }
    if (!kiloConfigured()) {
      res.status(500).json({
        error: "not_configured",
        message: "KILO_API_KEY ist auf dem Backend nicht konfiguriert (.env prüfen).",
      });
      return;
    }
    try {
      const result = await classifyCommunication(parsed.data);
      res.json(result);
    } catch (e) {
      sendKiloError(res, e);
    }
  });

  app.post("/api/agent/respond", async (req, res) => {
    const parsed = AgentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_request",
        message: "Ungültiger Gesprächsverlauf.",
        details: parsed.error.flatten(),
      });
      return;
    }
    if (!kiloConfigured()) {
      res.status(500).json({
        error: "not_configured",
        message: "KILO_API_KEY ist auf dem Backend nicht konfiguriert (.env prüfen).",
      });
      return;
    }
    try {
      const reply = await agentRespond(parsed.data);
      res.json({ reply });
    } catch (e) {
      sendKiloError(res, e);
    }
  });

  app.post("/api/deepgram-token", async (_req, res) => {
    const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
    if (!apiKey) {
      res.status(500).json({
        error: "not_configured",
        message: "DEEPGRAM_API_KEY ist auf dem Backend nicht konfiguriert (.env prüfen).",
      });
      return;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let dgRes: Response;
      try {
        dgRes = await fetch("https://api.deepgram.com/v1/auth/grant", {
          method: "POST",
          headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ttl_seconds: 60 }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!dgRes.ok) {
        const text = await dgRes.text().catch(() => "");
        res.status(502).json({
          error: "deepgram_token_failed",
          message: `Deepgram-Token konnte nicht erstellt werden (${dgRes.status}). API-Key prüfen.`,
          details: text.slice(0, 300),
        });
        return;
      }
      const data = (await dgRes.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) {
        res.status(502).json({ error: "deepgram_token_failed", message: "Deepgram gab kein Token zurück." });
        return;
      }
      res.json({ token: data.access_token, expiresIn: data.expires_in ?? 60 });
    } catch (e) {
      const msg = e instanceof Error && e.name === "AbortError" ? "Deepgram-Token Timeout." : "Deepgram-Token Fehler.";
      res.status(502).json({ error: "deepgram_token_failed", message: msg });
    }
  });

  // Debug/metadata (no secrets)
  app.get("/api/prompts/info", (_req, res) => {
    res.json({
      model: "kilo-auto/free",
      classifierChars: CLASSIFIER_SYSTEM_PROMPT.length,
      receptionistChars: RECEPTIONIST_SYSTEM_PROMPT.length,
      greeting: RECEPTIONIST_GREETING,
      maxTextChars: MAX_TEXT_CHARS,
    });
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "not_found", message: "Unbekannter API-Pfad." }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "invalid_json", message: "Ungültiges JSON im Request-Body." });
      return;
    }
    const message = err instanceof Error ? err.message : "Unbekannter Serverfehler";
    if (message.startsWith("CORS blocked")) {
      res.status(403).json({ error: "cors", message: "Origin nicht erlaubt (CORS). Backend ALLOWED_ORIGINS prüfen." });
      return;
    }
    res.status(500).json({ error: "internal", message });
  });

  return app;
}

function sendKiloError(res: express.Response, e: unknown): void {
  if (e instanceof KiloError) {
    res.status(kiloErrorToStatus(e.kind)).json({ error: e.kind, message: friendlyKiloMessage(e) });
    return;
  }
  if (e instanceof z.ZodError) {
    res.status(400).json({ error: "invalid_request", message: "Validierung fehlgeschlagen.", details: e.flatten() });
    return;
  }
  res.status(500).json({ error: "internal", message: e instanceof Error ? e.message : "Unbekannter Fehler" });
}

function friendlyKiloMessage(e: KiloError): string {
  switch (e.kind) {
    case "timeout":
      return "KI-Timeout: Kilo hat zu lange gebraucht. Bitte erneut versuchen.";
    case "rate_limited":
      return "KI-Rate-Limit (429): Bitte kurz warten und erneut versuchen.";
    case "malformed_json":
      return e.message;
    case "not_configured":
      return e.message;
    default:
      return `KI-Fehler: ${e.message}`;
  }
}

export { PORT };
