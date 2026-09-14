import { ArrowRight, Mail, Phone, ShieldAlert } from "lucide-react";
import type { ActivityItem, Tab } from "../types";
import ActivityView from "./ActivityView";

export default function Dashboard({
  go,
  items,
  onClear,
}: {
  go: (t: Tab) => void;
  items: ActivityItem[];
  onClear: () => void;
}) {
  return (
    <div>
      <section className="hero">
        <h1>
          Kommunikation <span className="accent">automatisch</span> verstehen.
        </h1>
        <p className="sub">
          Teste, wie eingehende Anrufe und E-Mails automatisch erkannt, priorisiert und gelabelt werden.
        </p>
        <span className="no-need">
          <ShieldAlert size={14} /> Keine echten E-Mails oder Telefonnummern erforderlich.
        </span>
      </section>

      <div className="cta-row">
        <button className="cta-card" onClick={() => go("call")} type="button" aria-label="Testanruf starten">
          <span className="icon"><Phone size={20} /></span>
          <span>
            <h3>Testanruf starten</h3>
            <p>Sprich live mit der KI-Rezeption (Deepgram + Kilo).</p>
          </span>
          <ArrowRight size={18} className="go" />
        </button>
        <button className="cta-card" onClick={() => go("email")} type="button" aria-label="E-Mail schreiben">
          <span className="icon"><Mail size={20} /></span>
          <span>
            <h3>E-Mail schreiben</h3>
            <p>Simuliere Posteingang und erhalte Label + Score.</p>
          </span>
          <ArrowRight size={18} className="go" />
        </button>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>So funktioniert der Prototyp</h2>
          <p className="desc">Ein System für beide Kanäle — dieselbe KI-Logik, dieselben Labels.</p>
          <div className="flow" aria-label="Konzept: Anruf oder E-Mail, AI versteht, Label plus Priorität plus Lead Score">
            <div className="flow-step">
              <span className="n">1</span>
              <div><b>Anruf / E-Mail</b><span>Testanruf per Mikrofon oder simulierte E-Mail an demo@company.local</span></div>
            </div>
            <div className="flow-arrow" aria-hidden>↓</div>
            <div className="flow-step">
              <span className="n">2</span>
              <div><b>AI versteht</b><span>Deepgram transkribiert · Kilo erkennt Intent & Richtung (kaufen vs. verkaufen)</span></div>
            </div>
            <div className="flow-arrow" aria-hidden>↓</div>
            <div className="flow-step">
              <span className="n">3</span>
              <div><b>Label + Priorität + Lead Score</b><span>z.&nbsp;B. Potenzieller Kunde · Hoch · 94/100 — inkl. Begründung & nächster Schritt</span></div>
            </div>
          </div>
        </div>
        <div className="card">
          <h2>Letzte Aktivität</h2>
          <p className="desc">Lokal im Browser gespeichert (localStorage).</p>
          <ActivityView items={items} onClear={onClear} compact />
          {items.length > 5 && (
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={() => go("activity")} type="button">
                Alle ansehen <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
