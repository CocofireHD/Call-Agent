import { useState } from "react";
import { AlertCircle, Inbox, Loader2, Send, Sparkles } from "lucide-react";
import { apiClassify } from "../lib/api";
import { addActivity, uid } from "../lib/storage";
import type { ActivityItem, Classification } from "../types";
import ClassificationResult from "./ClassificationResult";

const EXAMPLES = [
  {
    key: "lead",
    title: "Potenzieller Kunde",
    from: "interessent@beispiel-firma.de",
    subject: "Anfrage für unser Team",
    body: "Hallo, wir sind ein Unternehmen mit rund 35 Mitarbeitern und suchen gerade nach einer Lösung für unser Team. Können Sie uns mehr zu euren Preisen und einer möglichen Demo sagen?",
  },
  {
    key: "acq",
    title: "Akquise",
    from: "vertrieb@marketing-agentur.de",
    subject: "Mehr Kunden für Ihr Unternehmen",
    body: "Hallo, wir helfen Unternehmen mit Performance Marketing mehr Kunden zu gewinnen. Gerne würde ich Ihnen in einem kurzen Gespräch zeigen, wie wir auch für Sie neue Leads generieren können.",
  },
  {
    key: "sup",
    title: "Support",
    from: "kunde@bestandskunde.de",
    subject: "Problem mit meinem Account",
    body: "Hallo, ich kann mich seit heute Morgen nicht mehr in meinen Account einloggen. Könnt ihr mir bitte helfen?",
  },
  {
    key: "fin",
    title: "Finanzen",
    from: "buchhaltung@partner-firma.de",
    subject: "Rechnung 3821 prüfen",
    body: "Hallo, wir haben die Rechnung 3821 erhalten und glauben, dass der Betrag nicht korrekt ist. Könnt ihr das bitte prüfen und uns eine korrigierte Rechnung schicken?",
  },
  {
    key: "partner",
    title: "Partner",
    from: "bizdev@tool-anbieter.de",
    subject: "Integration / Partnerschaft",
    body: "Hallo, wir bauen ein Tool mit vielen gemeinsamen Kunden und würden gerne eine Integration sowie eine Vertriebspartnerschaft mit euch besprechen. Hättet ihr nächste Woche Zeit für ein Kennenlernen?",
  },
];

const STAGES = ["E-Mail empfangen", "Intent erkannt", "Priorität berechnet", "Label vergeben"];

export default function EmailComposer({ onDone }: { onDone: (list: ActivityItem[]) => void }) {
  const [from, setFrom] = useState("interessent@beispiel-firma.de");
  const [subject, setSubject] = useState("Anfrage für unser Team");
  const [body, setBody] = useState(EXAMPLES[0].body);
  const [phase, setPhase] = useState<"idle" | "working" | "done">("idle");
  const [stageIdx, setStageIdx] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Classification | null>(null);

  function fill(e: (typeof EXAMPLES)[number]) {
    setFrom(e.from);
    setSubject(e.subject);
    setBody(e.body);
    setError("");
    setResult(null);
    setPhase("idle");
  }

  async function send() {
    setError("");
    setResult(null);
    if (!body.trim() || !subject.trim()) {
      setError("Bitte Betreff und Nachricht ausfüllen — leere E-Mails können nicht analysiert werden.");
      return;
    }
    if (!navigator.onLine) {
      setError("Du bist offline. Bitte Internetverbindung prüfen und erneut versuchen.");
      return;
    }
    setPhase("working");
    // Staged UI transitions AFTER the real API call begins (deliberate loading feel).
    setStageIdx(0);
    const timers: number[] = [];
    [700, 1500, 2300].forEach((ms, i) =>
      timers.push(window.setTimeout(() => setStageIdx(i + 1), ms))
    );
    try {
      const classification = await apiClassify({
        source: "email",
        from: from.trim(),
        subject: subject.trim(),
        text: `Betreff: ${subject.trim()}\nVon: ${from.trim()}\n\n${body.trim()}`,
      });
      timers.forEach(clearTimeout);
      setStageIdx(STAGES.length);
      setResult(classification);
      setPhase("done");
      const item: ActivityItem = {
        id: uid(),
        source: "email",
        from: from.trim() || "Unbekannt",
        subject: subject.trim(),
        text: body.trim(),
        createdAt: new Date().toISOString(),
        classification,
      };
      onDone(addActivity(item));
    } catch (e) {
      timers.forEach(clearTimeout);
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Unbekannter Fehler bei der Analyse.");
    }
  }

  return (
    <div className="card">
      <h2>E-Mail schreiben</h2>
      <p className="desc">
        Simuliere eine eingehende E-Mail an das Unternehmen. Die KI analysiert sie wie einen echten Posteingang.
      </p>

      <div className="example-chips" role="group" aria-label="Beispiele einfügen">
        {EXAMPLES.map((e) => (
          <button key={e.key} className="chip-btn" onClick={() => fill(e)} type="button">
            <Sparkles size={13} /> {e.title}
          </button>
        ))}
      </div>

      <div className="recipient">
        <Inbox size={14} /> An: <code>demo@company.local</code>
      </div>

      <div className="field">
        <label htmlFor="email-from">Von</label>
        <input
          id="email-from"
          className="input"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="name@firma.de"
          maxLength={200}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="email-subject">Betreff</label>
        <input
          id="email-subject"
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Betreff"
          maxLength={300}
        />
      </div>
      <div className="field">
        <label htmlFor="email-body">Nachricht</label>
        <textarea
          id="email-body"
          className="textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Nachricht hier schreiben …"
          maxLength={12000}
        />
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={send} disabled={phase === "working"} type="button">
          {phase === "working" ? <Loader2 size={16} className="icon-spin" /> : <Send size={16} />}
          {phase === "working" ? "KI analysiert …" : "E-Mail senden"}
        </button>
      </div>

      {phase === "working" && (
        <div className="stages" aria-live="polite">
          {STAGES.map((s, i) => (
            <span key={s} className={`stage ${i < stageIdx ? "done" : i === stageIdx ? "active" : ""}`}>
              {i === stageIdx && <span className="spin" />}
              {i < stageIdx ? "✓ " : ""}{s}
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="error-box" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {result && phase === "done" && <ClassificationResult result={result} />}

      <div className="info-box">Demo: Bitte keine vertraulichen oder personenbezogenen Daten eingeben.</div>
    </div>
  );
}
