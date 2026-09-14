// Vercel serverless: POST /api/deepgram-token
export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) return res.status(500).json({ error: "not_configured", message: "DEEPGRAM_API_KEY ist nicht konfiguriert." });

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
      return res.status(502).json({ error: "deepgram_token_failed", message: `Deepgram-Token Fehler (${dgRes.status}).`, details: text.slice(0, 300) });
    }
    const data = (await dgRes.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return res.status(502).json({ error: "deepgram_token_failed", message: "Kein Token erhalten." });
    return res.status(200).json({ token: data.access_token, expiresIn: data.expires_in ?? 60 });
  } catch {
    return res.status(502).json({ error: "deepgram_token_failed", message: "Deepgram-Token konnte nicht erstellt werden." });
  }
}
