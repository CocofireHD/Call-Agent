import { PORT, deepgramConfigured, kiloConfigured } from "./config.js";
import { createApp } from "./server.js";

const app = createApp();

app.get("/", (_req, res) => {
  res.json({ name: "call-agent-backend", ok: true });
});

app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
  console.log(`[backend] kiloConfigured=${kiloConfigured()} deepgramConfigured=${deepgramConfigured()}`);
});
