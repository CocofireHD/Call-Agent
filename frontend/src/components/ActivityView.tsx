import { useMemo, useState } from "react";
import { Clock3, Mail, Phone, Trash2 } from "lucide-react";
import { LABEL_META, PRIORITY_META } from "../lib/labels";
import type { ActivityItem, Label } from "../types";
import ClassificationResult from "./ClassificationResult";
import { labelIcon } from "./labelIcon";

type Filter = "all" | "call" | "email" | "potential_customer" | "acquisition" | "support" | "other";

const FILTERS: { key: Filter; de: string }[] = [
  { key: "all", de: "Alle" },
  { key: "call", de: "Anrufe" },
  { key: "email", de: "E-Mails" },
  { key: "potential_customer", de: "Potenzielle Kunden" },
  { key: "acquisition", de: "Akquise" },
  { key: "support", de: "Support" },
  { key: "other", de: "Sonstiges" },
];

export default function ActivityView({
  items,
  onClear,
  selectedId,
  onSelect,
  compact,
}: {
  items: ActivityItem[];
  onClear: () => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(selectedId ?? null);

  const filtered = useMemo(() => {
    switch (filter) {
      case "all":
        return items;
      case "call":
      case "email":
        return items.filter((i) => i.source === filter);
      default:
        return items.filter((i) => i.classification.label === (filter as Label));
    }
  }, [items, filter]);

  function toggle(id: string) {
    if (onSelect) onSelect(selectedId === id ? null : id);
    else setOpenId((cur) => (cur === id ? null : id));
  }

  if (items.length === 0) {
    return (
      <div className="empty">
        Noch keine Aktivität. Starte einen <b>Testanruf</b> oder schreibe eine <b>Test-E-Mail</b> — Ergebnisse landen automatisch hier.
      </div>
    );
  }

  const list = compact ? filtered.slice(0, 5) : filtered;

  return (
    <div>
      {!compact && (
        <div className="filter-row" role="group" aria-label="Aktivität filtern">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className="filter-btn"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              type="button"
            >
              {f.de}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="btn btn-danger" onClick={onClear} type="button" style={{ padding: "7px 12px", fontSize: 12.5 }}>
            <Trash2 size={14} /> Demo-Daten löschen
          </button>
        </div>
      )}

      <div className="activity-list">
        {list.length === 0 && <div className="empty">Keine Einträge für diesen Filter.</div>}
        {list.map((item) => {
          const Icon = item.source === "call" ? Phone : Mail;
          const LIcon = labelIcon(item.classification.label);
          const meta = LABEL_META[item.classification.label];
          const pri = PRIORITY_META[item.classification.priority];
          const isOpen = (onSelect ? selectedId : openId) === item.id;
          return (
            <div key={item.id}>
              <button
                className={`activity-item ${isOpen ? "selected" : ""}`}
                onClick={() => toggle(item.id)}
                type="button"
                aria-expanded={isOpen}
              >
                <span className="activity-icon"><Icon size={16} /></span>
                <span className="activity-main">
                  <span className="activity-top">
                    <span className={`mini-label ${meta.className}`} style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                      <LIcon size={12} /> {meta.de}
                    </span>
                    <span className={`mini-label ${pri.className}`}>{pri.de}</span>
                    <span className="mini-label">Score {item.classification.leadScore}</span>
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </span>
                  <span className="activity-sub">
                    <b style={{ color: "var(--text)" }}>{item.source === "call" ? "Test Caller" : item.from}</b>
                    {item.subject ? ` · ${item.subject}` : ""} — {item.classification.summary}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="card" style={{ marginTop: 8 }}>
                  <ClassificationResult result={item.classification} />
                  <div className="kv-item" style={{ marginTop: 10 }}>
                    <div className="k"><Clock3 size={13} /> Original ({item.source === "call" ? "Transkript" : "E-Mail"})</div>
                    <div className="v" style={{ whiteSpace: "pre-wrap" }}>{item.text}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
