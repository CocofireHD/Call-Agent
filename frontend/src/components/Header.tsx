import { useEffect, useState } from "react";
import { AudioWaveform } from "lucide-react";
import { apiHealth, backendMissingOnPages } from "../lib/api";

export default function Header({ backendUrl }: { backendUrl: string }) {
  const [status, setStatus] = useState<"checking" | "ok" | "degraded" | "down">("checking");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (backendMissingOnPages()) {
      setStatus("down");
      setDetail("Backend-URL fehlt (VITE_BACKEND_URL)");
      return;
    }
    apiHealth()
      .then((h) => {
        if (cancelled) return;
        if (h.kiloConfigured && h.deepgramConfigured) {
          setStatus("ok");
          setDetail("AI Backend verbunden");
        } else {
          setStatus("degraded");
          const missing = [
            !h.kiloConfigured ? "Kilo" : "",
            !h.deepgramConfigured ? "Deepgram" : "",
          ]
            .filter(Boolean)
            .join(" + ");
          setDetail(`Backend läuft, aber ${missing} fehlt (.env)`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("down");
          setDetail("Backend nicht erreichbar");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <AudioWaveform size={18} />
          </span>
          <span>
            Call Agent
            <small>Kommunikation automatisch verstehen</small>
          </span>
        </div>
        <span className="ai-badge">AI Demo</span>
        <div className="topbar-spacer" />
        <span className="backend-pill" role="status" title={backendUrl || "Backend-URL nicht gesetzt"}>
          <span
            className={`dot ${status === "ok" ? "ok" : status === "degraded" ? "warn" : status === "down" ? "bad" : ""}`}
          />
          {status === "checking" ? "Verbinde …" : detail}
        </span>
      </div>
    </header>
  );
}
