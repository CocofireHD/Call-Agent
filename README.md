# Call Agent — Kommunikation automatisch verstehen

Interaktiver KI-Prototyp: **Eingehende Anrufe und E-Mails werden live erkannt, priorisiert und gelabelt** — mit echter Transkription (Deepgram), echten LLM-Antworten und echter Klassifizierung (Kilo Gateway).

Demo-Tabs: **Übersicht · Anruf · E-Mail · Aktivität.** UI-Sprache: Deutsch. Stil: dunkel, ruhig, Premium-SaaS.

> **AI Demo** — Keine echten E-Mails oder Telefonnummern erforderlich.
> **Demo: Bitte keine vertraulichen oder personenbezogenen Daten eingeben.**

---

## Was der Prototyp tut

- **Testanruf (wichtigster Flow):** Mikrofon → Deepgram Live-STT (Nova-3, `language=multi`, Interim Results) → Kilo-Rezeptionistin antwortet kurz (Browser-TTS) → Auflegen → gesamtes Transkript wird durch **denselben Klassifizierer** wie E-Mails analysiert → Call-Analysis-Screen mit Label, Priorität, Lead Score, Summary, Intent, Begründung, Next Step, Tags + Transkript.
- **E-Mail-Simulator:** Composer an `demo@company.local` (Von/Betreff/Nachricht) + 5 Beispiel-Buttons → animierte Analyse-Stages → strukturiertes Ergebnis.
- **Ein Klassifizierer für beide Kanäle:** Zod-validiertes JSON mit `label / priority / leadScore / confidence / summary / reasoning / detectedIntent / suggestedAction / tags`. Richtungssicherheit: *Potenzieller Kunde* (will BEI uns kaufen) vs. *Akquise* (will UNS etwas verkaufen) — Akquise bekommt bewusst niedrige Lead Scores.
- **Aktivität:** jede fertige Analyse landet in `localStorage`, mit Filtern, Detailansicht und „Demo-Daten löschen“. Bleibt nach Reload erhalten.
- **Health-Check:** `GET /api/health` → `{ ok, kiloConfigured, deepgramConfigured }` (nie Secrets). Frontend zeigt „AI Backend verbunden“ oder „Backend nicht konfiguriert“.

## Architektur

```text
Browser (React + Vite, GitHub Pages /Call-Agent/)
  │  /api/health, /api/classify, /api/agent/respond   (Backend-URL via VITE_BACKEND_URL)
  ▼
Backend (Node + Express lokal, Vercel-Functions deployed)
  │  Kilo Gateway  (https://api.kilo.ai/api/gateway/chat/completions, Modell "kilo-auto/free")
  │  Deepgram      (POST /v1/auth/grant → temporärer JWT, 60s TTL)
  ▼
Browser ↔ Deepgram WebSocket direkt (wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&…)
  └── MediaRecorder-Blobs (webm/opus), keine Audio-Speicherung
```

- Labels: `potential_customer, existing_customer, acquisition, support, partner, finance, spam, other` (+ deutsche Anzeige-Namen mit Icon + Text, nicht nur Farbe).
- Keine DB, kein Auth, kein Twilio, kein Gmail, kein Stripe — bewusst nicht im MVP.

## Repository-Struktur

```text
Call-Agent/
├─ frontend/            # React + TS + Vite (Pages-Build, base /Call-Agent/)
├─ backend/src/         # config, schemas (Zod), prompts, services (kilo, rateLimit), server
├─ api/                 # Vercel serverless functions (health, classify, deepgram-token, agent/respond)
├─ .github/workflows/pages.yml
├─ .env.example         # NUR KILO_API_KEY + DEEPGRAM_API_KEY
├─ frontend/.env.example# NUR VITE_BACKEND_URL (kein Secret)
└─ README.md
```

## Voraussetzungen

- Windows 11, Node.js 20+, npm, Git, GitHub CLI (`gh`) — optional: Vercel CLI.
- Zwei API-Keys (Secrets, nur Backend):
  - **Kilo:** https://kilo.ai → API-Key erstellen → als `KILO_API_KEY`. Modell `kilo-auto/free` braucht keine paid credits.
  - **Deepgram:** https://deepgram.com → API-Key erstellen → als `DEEPGRAM_API_KEY` (braucht Member-Rechte für `/v1/auth/grant`).

## Lokales Setup (Windows 11 PowerShell)

```powershell
git clone https://github.com/CocofireHD/Call-Agent.git
cd Call-Agent
npm install
Copy-Item .env.example .env
notepad .env
# eintragen:
# KILO_API_KEY=...
# DEEPGRAM_API_KEY=...
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001 (`GET /api/health` sollte `kiloConfigured:true, deepgramConfigured:true` zeigen)
- `npm run dev` startet beide via `concurrently` (Vite proxy `/api` → `:3001`, daher geht auch ohne `VITE_BACKEND_URL`).

### Nützliche Befehle

```powershell
npm run dev        # frontend + backend zusammen
npm run build      # beide workspaces bauen
npm run lint       # tsc --noEmit in beiden
npm run test       # backend unit tests (node:test via tsx)
```

Backend einzeln: `npm run dev --workspace=backend`, Frontend einzeln: `npm run dev --workspace=frontend`.

### `.env` Setup

`.env.example` enthält exakt:

```env
KILO_API_KEY=
DEEPGRAM_API_KEY=
```

- `.env` liegt im Repo-Root; `backend` lädt es via `dotenv/config`. **Nie committen** (`.gitignore` deckt `.env*` ab).
- Frontend braucht **keine Secrets**. Nur `frontend/.env` (optional, lokal meist leer lassen):
  ```env
  VITE_BACKEND_URL=http://localhost:3001
  ```
  Für Produktion (Pages): `VITE_BACKEND_URL=https://<dein-backend>.vercel.app`.

## Build

```powershell
npm run build --workspace=backend
npm run build --workspace=frontend
# oder: npm run build
```

Frontend-Output: `frontend/dist/` (für `/Call-Agent/` gebaut — GitHub Pages Subpfad; State-Tab-Routing, daher kein SPA-Fallback nötig).

## GitHub Pages Deployment (Frontend)

Workflow: `.github/workflows/pages.yml` (Actions `checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`).

Ablauf bei Push auf `main`: install → `vite build` → Pages-Artifact → Deploy. URL danach: `https://cocofirehd.github.io/Call-Agent/`.

Einmalig: Repo → Settings → Pages → Source: **GitHub Actions**. Optional Secret `VITE_BACKEND_URL` setzen (sonst zeigt die Demo „Backend-URL fehlt“ und API-Calls schlagen mit klarer Fehlermeldung fehl statt Fake-Ergebnissen).

Falls du das Repo neu erstellst:

```powershell
gh repo create CocofireHD/Call-Agent --public --source=. --remote=origin --push
# danach: gh workflow view pages.yml / Actions-Tab prüfen
```

Falls `gh` nicht eingeloggt ist:

```powershell
gh auth login
```

## Backend Deployment (Vercel, empfohlen)

GitHub Pages kann keine Secrets halten — das Backend läuft separat (Serverless). Vercel CLI war bei der Erstellung **nicht authentifiziert**, daher liegt hier die exakte Anleitung:

```powershell
npm i -g vercel
vercel login
vercel --cwd . --prod
# Env setzen (oder im Dashboard: Project → Settings → Environment Variables):
vercel env add KILO_API_KEY production
vercel env add DEEPGRAM_API_KEY production
vercel --cwd . --prod
```

- Funktionen: `api/health.ts`, `api/classify.ts`, `api/deepgram-token.ts`, `api/agent/respond.ts` (importieren Shared-Code aus `backend/src/`).
- Danach: Backend-URL kopieren (z. B. `https://call-agent-backend.vercel.app`), als `VITE_BACKEND_URL` …
  - … lokal in `frontend/.env`, und
  - … im GitHub-Repo als Actions-Secret `VITE_BACKEND_URL` → neuer Push baut das Frontend mit der URL.
- Alternativ: Vercel-Dashboard → Import `CocofireHD/Call-Agent` → Root `./`, Build `npm run build --workspace=frontend`, Output `frontend/dist`, Env `KILO_API_KEY`, `DEEPGRAM_API_KEY`.
- CORS erlaubt bereits `https://cocofirehd.github.io` + alle `localhost`-Ports; weitere Origins via Backend-Env `ALLOWED_ORIGINS=https://...` (kommagetrennt).

## API-Referenz (kurz)

| Methode | Pfad | Body | Antwort |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok, kiloConfigured, deepgramConfigured, model }` |
| POST | `/api/classify` | `{ source: "email"\|"call", from?, subject?, text(1–12000) }` | `Classification` (Zod-validiert) |
| POST | `/api/agent/respond` | `{ conversation: [{role, content}]×1–30 }` | `{ reply }` (max ~600 Zeichen) |
| POST | `/api/deepgram-token` | — | `{ token, expiresIn }` (JWT, 60s) |

Fehler sind ehrlich: kein Fake-Label bei Kilo-/Deepgram-Fehlern — die UI zeigt die Fehlermeldung und speichert **keine** Aktivität.

Manuelle Tests (Backend läuft, `.env` gesetzt):

```powershell
Invoke-RestMethod http://localhost:3001/api/health | ConvertTo-Json
$body = @{source='email'; from='a@b.de'; subject='Anfrage'; text='Wir haben 40 Mitarbeiter und möchten Preise und eine Demo.'} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/classify -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 6
```

Erwartung (mit gültigem `KILO_API_KEY`):
- **Test A** „team of 40, pricing + demo“ → `potential_customer`, Score hoch (75–98).
- **Test B** „SEO agency, more leads for you“ → `acquisition`, Score niedrig (0–15).
- **Test C** „cannot log in“ → primär `support` (existing-customer-Aspekt in reasoning/tags).
- **Test D** „invoice 3821 wrong amount“ → `finance`.

## Test-Buttons in der Demo

E-Mail-Beispiele: Potenzieller Kunde · Akquise · Support · Finanzen · Partner.
Anruf-Vorschläge vor Start: 40-Mitarbeiter-Preisfrage (→ Potenzieller Kunde) vs. Marketingagentur-Pitch (→ Akquise).

## Sicherheit & Limitationen (ehrlich)

- Secrets (`KILO_API_KEY`, `DEEPGRAM_API_KEY`) nur im Backend/Vercel-Env. Frontend enthält sie nie.
- CORS: localhost + `https://cocofirehd.github.io` (+ `ALLOWED_ORIGINS`). Kein Ersatz für Auth.
- Validierung via Zod, JSON-Limit 200 KB, Text-Limit 12000 Zeichen, Timeouts (Kilo 25s, Deepgram 8s), ein Retry bei 429/5xx, best-effort In-Memory Rate Limit (30 req/min/IP/Pfad, geht bei Serverless-Neustarts verloren).
- **Freund-MVP, keine gehärtete Public-API.** Für echtes Public-Deployment zusätzlich nötig: Auth, persistentes Rate Limit, Logging/Monitoring, Abuse-Schutz.
- Keine Behauptungen über DSGVO/Zero-Retention/E2E-Verschlüsselung — externer AI-Durchsatz (Kilo/Deepgram), kein Audio-Storage, aber Anruf-/E-Mail-**Texte** gehen an Kilo. Hinweis in der UI.

## Troubleshooting

**Mikrofon verweigert / nicht gefunden**
- Chrome/Edge nutzen, HTTPS oder localhost (sonst blockt der Browser `getUserMedia`).
- Adressleisten-Icon → Mikrofon erlauben → Seite neu laden. Anruf-Tab zeigt konkrete Fehler + Text-Fallback (tippen statt sprechen).

**Deepgram-Token Fehler**
- `GET /api/health`: `deepgramConfigured` false → `.env`/`vercel env` prüfen, Backend neu starten/redeployen.
- 502 vom Backend → Key ungültig oder ohne Grant-Rechte; Deepgram-Dashboard prüfen.

**Kilo Timeout / 429 / JSON-Fehler**
- Timeout (504): erneut versuchen; `kilo-auto/free` kann schwanken.
- 429: ~1 Min warten (ein automatischer Retry ist eingebaut).
- `malformed_json`: Backend versucht automatisch eine Repair-Runde, danach ehrlicher Fehler — kein Fake-Label.

**Backend nicht erreichbar**
- Lokal: läuft `npm run dev`? `http://localhost:3001/api/health` prüfen.
- Pages: `VITE_BACKEND_URL` gesetzt und neu gebaut? Header-Pill zeigt den Status.

**CORS**
- Fehlermeldung „Origin nicht erlaubt“ → Backend `ALLOWED_ORIGINS` um die Frontend-Origin ergänzen (Pages-Origin ist `https://cocofirehd.github.io`).

**Leerer E-Mail-Text / leeres Transkript**
- Wird client- und serverseitig abgelehnt (400) bzw. Auflegen ohne Sprache bricht mit Hinweis ab statt Fake-Analyse.

## Screenshots

Noch keine Screenshots im Repo — werden nach dem ersten deployed Durchlauf ergänzt (keine Platzhalter-Bilder, keine Stock-Fotos im UI).

## Lizenz

MVP-Prototyp für interne Demo-Zwecke. Bei Weiterentwicklung Lizenz + Sicherheit (Auth, Rate Limit, Datenflüsse) klären.
