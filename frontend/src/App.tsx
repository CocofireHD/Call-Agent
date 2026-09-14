import { useEffect, useState } from "react";
import { Activity, LayoutDashboard, Lock, Mail, Mic2 } from "lucide-react";
import ActivityView from "./components/ActivityView";
import CallSimulator from "./components/CallSimulator";
import Dashboard from "./components/Dashboard";
import EmailComposer from "./components/EmailComposer";
import Header from "./components/Header";
import { backendBase } from "./lib/api";
import { clearActivity, loadActivity } from "./lib/storage";
import type { ActivityItem, Tab } from "./types";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [items, setItems] = useState<ActivityItem[]>(() => loadActivity());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Call Agent — Kommunikation automatisch verstehen";
  }, []);

  function handleDone(list: ActivityItem[]) {
    setItems(list);
  }

  function handleClear() {
    if (!window.confirm("Wirklich alle Demo-Daten löschen?")) return;
    clearActivity();
    setItems([]);
    setSelectedId(null);
  }

  const tabs: { key: Tab; label: string; icon: typeof Mail }[] = [
    { key: "dashboard", label: "Übersicht", icon: LayoutDashboard },
    { key: "call", label: "Anruf", icon: Mic2 },
    { key: "email", label: "E-Mail", icon: Mail },
    { key: "activity", label: `Aktivität${items.length ? ` (${items.length})` : ""}`, icon: Activity },
  ];

  return (
    <div className="app-shell">
      <Header backendUrl={backendBase() || "(nicht gesetzt — VITE_BACKEND_URL prüfen)"} />

      <nav className="tabs" aria-label="Hauptbereiche">
        {tabs.map((t) => (
          <button
            key={t.key}
            className="tab-btn"
            aria-selected={tab === t.key}
            role="tab"
            onClick={() => setTab(t.key)}
            type="button"
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </nav>

      <main className="page" role="tabpanel">
        {tab === "dashboard" && <Dashboard go={setTab} items={items} onClear={handleClear} />}
        {tab === "call" && <CallSimulator onDone={handleDone} />}
        {tab === "email" && <EmailComposer onDone={handleDone} />}
        {tab === "activity" && (
          <div className="card">
            <h2>Aktivität</h2>
            <p className="desc">
              Alle getesteten Anrufe & E-Mails — lokal gespeichert, bleibt nach Reload erhalten. Klick für Details.
            </p>
            <ActivityView items={items} onClear={handleClear} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span className="privacy">
            <Lock size={13} /> Demo: Bitte keine vertraulichen oder personenbezogenen Daten eingeben.
          </span>
          <span style={{ marginLeft: "auto" }}>Prototyp · Audio wird nicht gespeichert · Labels: KI-generiert, bitte prüfen</span>
        </div>
      </footer>
    </div>
  );
}
