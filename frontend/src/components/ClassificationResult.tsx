import {
  AlertTriangle,
  FileText,
  Gauge,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  Tags,
} from "lucide-react";
import { LABEL_META, PRIORITY_META, confidencePct, leadBand } from "../lib/labels";
import type { Classification } from "../types";
import { labelIcon } from "./labelIcon";

export default function ClassificationResult({ result }: { result: Classification }) {
  const meta = LABEL_META[result.label];
  const pri = PRIORITY_META[result.priority];
  const Icon = labelIcon(result.label);

  return (
    <div className="result" aria-live="polite">
      <div className="result-head">
        <span className={`label-chip ${meta.className}`}>
          <Icon size={17} />
          {meta.de} <small>· {meta.hint}</small>
        </span>
        <span className={`pri ${pri.className}`} title="Priorität">
          {pri.de}
        </span>
      </div>

      <div className="score-grid">
        <div className="score-box">
          <div className="k">Lead Score</div>
          <div className="v">{result.leadScore} <span style={{ fontSize: 13, color: "var(--muted)" }}>/ 100</span></div>
          <div className="bar" aria-hidden>
            <div style={{ width: `${result.leadScore}%` }} />
          </div>
          <div className="s">{leadBand(result.leadScore)}es Kaufinteresse</div>
        </div>
        <div className="score-box">
          <div className="k">Priorität</div>
          <div className="v" style={{ textTransform: "capitalize" }}>{pri.de}</div>
          <div className="s">Automatisch priorisiert</div>
        </div>
        <div className="score-box">
          <div className="k">Confidence</div>
          <div className="v">{confidencePct(result.confidence)}</div>
          <div className="s">Modell-Sicherheit</div>
        </div>
      </div>

      <div className="kv">
        <div className="kv-item">
          <div className="k"><FileText size={13} /> Zusammenfassung</div>
          <div className="v">{result.summary}</div>
        </div>
        <div className="kv-item">
          <div className="k"><MessageSquareText size={13} /> Erkannter Intent</div>
          <div className="v">{result.detectedIntent}</div>
        </div>
        <div className="kv-item">
          <div className="k"><ListChecks size={13} /> Warum diese Einordnung?</div>
          <div className="v">{result.reasoning}</div>
        </div>
        <div className="kv-item">
          <div className="k"><Lightbulb size={13} /> Empfohlener nächster Schritt</div>
          <div className="v">{result.suggestedAction}</div>
        </div>
        <div className="kv-item">
          <div className="k"><Tags size={13} /> Tags</div>
          <div className="tag-row">
            {result.tags.length === 0 && <span style={{ color: "var(--muted2)", fontSize: 13 }}>—</span>}
            {result.tags.map((t) => (
              <span className="tag" key={t}>{t}</span>
            ))}
          </div>
        </div>
        <div className="kv-item" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Gauge size={14} color="var(--muted)" />
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Lead Score = Kaufinteresse der anfragenden Person an UNS. Akquise (will uns etwas verkaufen) erhält bewusst niedrige Scores.
          </span>
        </div>
        {result.label === "acquisition" && (
          <div className="warn-box" style={{ display: "flex", gap: 8 }}>
            <AlertTriangle size={15} />
            <span>Richtung erkannt: Diese Person will <b>uns</b> etwas verkaufen — kein Kaufinteresse an unserem Angebot.</span>
          </div>
        )}
      </div>
    </div>
  );
}
