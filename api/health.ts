// Vercel serverless: GET /api/health
import { kiloConfigured, deepgramConfigured } from "../backend/src/config.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  return res.status(200).json({
    ok: true,
    kiloConfigured: kiloConfigured(),
    deepgramConfigured: deepgramConfigured(),
    model: "kilo-auto/free",
  });
}
