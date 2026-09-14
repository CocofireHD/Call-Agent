// Vercel serverless: POST /api/classify
import { kiloConfigured } from "../backend/src/config.js";
import { ClassifyRequestSchema } from "../backend/src/schemas/classification.js";
import { KiloError, classifyCommunication, kiloErrorToStatus } from "../backend/src/services/kilo.js";

function cors(req: any, res: any): boolean {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const parsed = ClassifyRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", message: "Ungültige Anfrage.", details: parsed.error.flatten() });
  }
  if (!kiloConfigured()) {
    return res.status(500).json({ error: "not_configured", message: "KILO_API_KEY ist nicht konfiguriert." });
  }
  try {
    const result = await classifyCommunication(parsed.data);
    return res.status(200).json(result);
  } catch (e) {
    if (e instanceof KiloError) return res.status(kiloErrorToStatus(e.kind)).json({ error: e.kind, message: e.message });
    return res.status(500).json({ error: "internal", message: e instanceof Error ? e.message : "Fehler" });
  }
}
