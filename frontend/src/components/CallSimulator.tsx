import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Volume2,
} from "lucide-react";
import { apiAgentRespond, apiClassify, apiDeepgramToken } from "../lib/api";
import { addActivity, uid } from "../lib/storage";
import type { ActivityItem, ChatMsg, Classification } from "../types";
import ClassificationResult from "./ClassificationResult";

type CallPhase = "idle" | "connecting" | "live" | "analyzing" | "done";

const GREETING = "Hallo, hier ist die KI-Rezeption. Wie kann ich Ihnen helfen?";
const WS_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=true&interim_results=true&endpointing=300&utterance_end_ms=1200&vad_events=true";

const LIVE_STAGES = ["Verbunden", "Hört zu …", "Transkribiert …", "KI antwortet …"];

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallSimulator({ onDone }: { onDone: (list: ActivityItem[]) => void }) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState("");
  const [agentThinking, setAgentThinking] = useState(false);
  const [interim, setInterim] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [deepgramLive, setDeepgramLive] = useState(false);
  const [result, setResult] = useState<Classification | null>(null);
  const [typed, setTyped] = useState("");
  const [levels, setLevels] = useState<number[]>(new Array(28).fill(6));

  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const convRef = useRef<ChatMsg[]>([]);
  const speakingRef = useRef(false);
  const speakUntilRef = useRef(0);
  const pendingRef = useRef("");
  const turnTimerRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hungUpRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, interim]);

  useEffect(() => () => cleanupAll(), []);

  function cleanupAll() {
    hungUpRef.current = true;
    try { recRef.current?.stop(); } catch { /* noop */ }
    recRef.current = null;
    try { wsRef.current?.close(); } catch { /* noop */ }
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    speakingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    try { audioCtxRef.current?.close(); } catch { /* noop */ }
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
  }

  function speak(text: string) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = /[äöüß]| hallo | guten | danke | bitte | sie /i.test(text) ? "de-DE" : "de-DE";
      u.rate = 1;
      u.onstart = () => {
        speakingRef.current = true;
      };
      u.onend = () => {
        speakingRef.current = false;
        speakUntilRef.current = Date.now() + 700;
      };
      u.onerror = () => {
        speakingRef.current = false;
        speakUntilRef.current = Date.now() + 700;
      };
      speakingRef.current = true;
      synth.speak(u);
    } catch {
      speakingRef.current = false;
    }
  }

  async function startCall() {
    setError("");
    setResult(null);
    setMessages([]);
    setInterim("");
    convRef.current = [];
    pendingRef.current = "";
    hungUpRef.current = false;
    setSeconds(0);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Mikrofon wird in diesem Browser nicht unterstützt. Nutze den Text-Fallback unten oder Chrome/Edge.");
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      // getUserMedia requires secure context; GitHub Pages is https so fine.
    }

    setPhase("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (hungUpRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      startVisualizer(stream);

      let token: string;
      try {
        const t = await apiDeepgramToken();
        token = t.token;
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "Deepgram-Token fehlgeschlagen.");
      }

      const ws = new WebSocket(WS_URL, ["token", token]);
      wsRef.current = ws;

      ws.onopen = () => {
        setDeepgramLive(true);
        setPhase("live");
        timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
        startRecorder(stream, ws);
        const greet: ChatMsg = { role: "assistant", content: GREETING };
        convRef.current = [greet];
        setMessages([greet]);
        speak(GREETING);
      };
      ws.onmessage = (ev) => handleDeepgramMessage(ev.data);
      ws.onerror = () => {
        if (phase !== "live") return;
        setError("Deepgram-Verbindung abgebrochen. Prüfe Backend (.env) und Internet — oder nutze den Text-Fallback.");
      };
      ws.onclose = (ev) => {
        setDeepgramLive(false);
        if (!hungUpRef.current && phase === "live" && ev.code !== 1000) {
          setError("Deepgram-Verbindung geschlossen. Der Anruf läuft ggf. weiter im Text-Modus.");
        }
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mikrofonfehler.";
      if (/permission|denied|NotAllowed/i.test(msg)) {
        setError("Mikrofonzugriff verweigert. Bitte Browser-Berechtigung erlauben (Adressleisten-Icon) und erneut versuchen — oder Text-Fallback nutzen.");
      } else if (/not found|unavailable|NotFound|Overconstrained/i.test(msg)) {
        setError("Kein Mikrofon gefunden. Bitte Mikrofon anschließen oder Text-Fallback nutzen.");
      } else {
        setError(msg);
      }
      setPhase("idle");
      cleanupAll();
      setPhase("idle");
    }
  }

  function startRecorder(stream: MediaStream, ws: WebSocket) {
    try {
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          try { ws.send(e.data); } catch { /* ignore */ }
        }
      };
      rec.start(250);
    } catch {
      setError("Audioaufnahme konnte nicht gestartet werden (MediaRecorder). Text-Fallback steht bereit.");
    }
  }

  function startVisualizer(stream: MediaStream) {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars = 28;
        const next: number[] = [];
        for (let i = 0; i < bars; i++) {
          const v = data[Math.floor((i / bars) * data.length)] ?? 0;
          next.push(5 + (v / 255) * 34);
        }
        setLevels(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // visualization is decorative — ignore failures
    }
  }

  function handleDeepgramMessage(raw: unknown) {
    let msg: {
      type?: string;
      is_final?: boolean;
      speech_final?: boolean;
      channel?: { alternatives?: { transcript?: string }[] };
    };
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.type !== "Results") return;
    const transcript = msg.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
    if (!transcript) return;

    // Prevent TTS feedback loops: ignore mic input while AI speaks (+ grace).
    if (speakingRef.current || Date.now() < speakUntilRef.current) return;

    if (msg.is_final) {
      pendingRef.current = (pendingRef.current + " " + transcript).trim();
      setInterim("");
      // Finalize a user turn on speech_final or after a short pause of finals.
      if (msg.speech_final) {
        void finalizeUserTurn();
      } else {
        if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
        turnTimerRef.current = window.setTimeout(() => void finalizeUserTurn(), 1400);
      }
    } else {
      setInterim(transcript);
    }
  }

  async function finalizeUserTurn() {
    const text = pendingRef.current.trim();
    pendingRef.current = "";
    setInterim("");
    if (!text || hungUpRef.current) return;
    if (speakingRef.current) return; // safety: don't stack turns over TTS
    const userMsg: ChatMsg = { role: "user", content: text };
    convRef.current = [...convRef.current, userMsg].slice(-30);
    setMessages([...convRef.current]);
    setAgentThinking(true);
    try {
      const reply = await apiAgentRespond(convRef.current);
      if (hungUpRef.current) return;
      const ai: ChatMsg = { role: "assistant", content: reply };
      convRef.current = [...convRef.current, ai].slice(-30);
      setMessages([...convRef.current]);
      speak(reply);
    } catch (e) {
      if (!hungUpRef.current) {
        setError(e instanceof Error ? e.message : "KI antwortet gerade nicht.");
      }
    } finally {
      setAgentThinking(false);
    }
  }

  async function sendTyped() {
    const text = typed.trim();
    if (!text) return;
    setTyped("");
    pendingRef.current = (pendingRef.current + " " + text).trim();
    await finalizeUserTurn();
  }

  async function hangUp() {
    if (phase !== "live") return;
    hungUpRef.current = true;
    try { recRef.current?.stop(); } catch { /* noop */ }
    try { wsRef.current?.close(1000); } catch { /* noop */ }
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    speakingRef.current = false;
    if (timerRef.current) window.clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);

    const transcript = buildTranscript(convRef.current);
    if (!transcriptHasUserSpeech(convRef.current)) {
      setError("Kein Gesprächsinhalt erkannt — bitte sprich nach dem Verbinden oder nutze den Text-Fallback, sonst kann nichts analysiert werden.");
      setPhase("idle");
      cleanupAll();
      setPhase("idle");
      return;
    }

    setPhase("analyzing");
    setError("");
    try {
      const classification = await apiClassify({ source: "call", from: "Test Caller", subject: "", text: transcript });
      setResult(classification);
      setPhase("done");
      const item: ActivityItem = {
        id: uid(),
        source: "call",
        from: "Test Caller",
        subject: "",
        text: transcript,
        transcript,
        createdAt: new Date().toISOString(),
        classification,
      };
      onDone(addActivity(item));
    } catch (e) {
      setPhase("live");
      hungUpRef.current = false;
      setError(e instanceof Error ? e.message : "Analyse fehlgeschlagen — Anruf läuft weiter, versuche Auflegen erneut.");
      return;
    } finally {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function reset() {
    cleanupAll();
    setPhase("idle");
    setError("");
    setResult(null);
    setMessages([]);
    setInterim("");
    setSeconds(0);
    setAgentThinking(false);
  }

  const live = phase === "live";

  return (
    <div className="card">
      {phase === "idle" && (
        <>
          <h2>Testanruf starten</h2>
          <p className="desc">
            Du „rufst“ die fiktive Firma an und sprichst mit der KI-Rezeption. Echte Transkription via Deepgram, echte
            Antworten via Kilo — keine Telefonnummer nötig.
          </p>
          <div className="suggest">
            <b>Versuche z.&nbsp;B.:</b>
            „Hallo, wir haben ungefähr 40 Mitarbeiter und suchen gerade eine Lösung für unser Team. Was würde das kosten?“
            <code onClick={() => setTyped("Hallo, wir haben ungefähr 40 Mitarbeiter und suchen gerade eine Lösung für unser Team. Was würde das kosten?")}>
              → sollte „Potenzieller Kunde“ werden
            </code>
            „Guten Tag, ich bin von einer Marketingagentur und würde Ihnen gerne zeigen, wie wir mehr Kunden für Sie gewinnen können.“
            <code onClick={() => setTyped("Guten Tag, ich bin von einer Marketingagentur und würde Ihnen gerne zeigen, wie wir mehr Kunden für Sie gewinnen können.")}>
              → sollte „Akquise“ werden
            </code>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={startCall} type="button">
              <Phone size={16} /> Testanruf starten
            </button>
          </div>
          <div className="info-box">
            Beim Start fragt der Browser nach Mikrofonzugriff. Audio wird nur live transkribiert und <b>nicht</b> gespeichert.
            Während die KI spricht, wird das Mikrofon ignoriert (kein Echo-Feedback).
          </div>
        </>
      )}

      {phase === "connecting" && (
        <div className="call-stage" aria-live="polite">
          <div className="avatar"><Loader2 size={30} className="icon-spin" /></div>
          <div className="call-title">Verbinde …</div>
          <div className="call-status"><span className="spin" /> Mikrofon + Deepgram werden vorbereitet</div>
        </div>
      )}

      {live && (
        <>
          <div className="call-stage">
            <div className="avatar"><Volume2 size={30} /></div>
            <div className="call-title">AI Reception</div>
            <div className="call-timer" aria-label="Anrufdauer">{fmtTime(seconds)} · {deepgramLive ? "live" : "Text-Modus"}</div>
            <div>
              <span className="call-status">
                <span className={`dot ${micOn ? "ok" : "bad"}`} />
                {speakingRef.current || agentThinking ? "KI antwortet …" : "Hört zu …"}
              </span>
            </div>
            <div className={`wave ${micOn ? "live" : ""}`} aria-hidden>
              {levels.map((h, i) => (
                <span key={i} style={{ height: `${Math.round(h)}px` }} />
              ))}
            </div>
            <div className="stages" style={{ justifyContent: "center" }}>
              {LIVE_STAGES.map((s) => (
                <span key={s} className={`stage ${s === "Verbunden" ? "done" : agentThinking && s === "KI antwortet …" ? "active" : s === "Hört zu …" ? "active" : ""}`}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="transcript" ref={scrollRef} aria-live="polite" aria-label="Live-Transkript">
            {messages.length === 0 && <div style={{ color: "var(--muted2)", fontSize: 13 }}>Warte auf Audio …</div>}
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role === "user" ? "user" : "ai"}`}>
                <span className="who">{m.role === "user" ? "Anrufer" : "KI-Rezeption"}</span>
                {m.content}
              </div>
            ))}
            {interim && (
              <div className="bubble user interim"><span className="who">Anrufer · hört …</span>{interim}</div>
            )}
            {agentThinking && <div style={{ color: "var(--muted)", fontSize: 12.5 }}>KI antwortet …</div>}
          </div>

          <div className="btn-row">
            <button className="btn btn-danger" onClick={hangUp} type="button">
              <PhoneOff size={16} /> Auflegen & analysieren
            </button>
            <button className="btn btn-ghost" onClick={() => {
              const next = !micOn;
              setMicOn(next);
              streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = next; });
            }} type="button" aria-pressed={micOn}>
              {micOn ? <Mic size={16} /> : <MicOff size={16} />}
              {micOn ? "Mikro an" : "Mikro aus"}
            </button>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="call-typed">Alternativ tippen (Text-Fallback, falls Mikro streikt)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="call-typed"
                className="input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void sendTyped(); }}
                placeholder="Nachricht an die KI-Rezeption …"
                maxLength={2000}
              />
              <button className="btn btn-ghost" onClick={sendTyped} type="button" aria-label="Nachricht senden">
                <Send size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {phase === "analyzing" && (
        <div className="call-stage" aria-live="polite">
          <div className="avatar"><Loader2 size={30} className="icon-spin" /></div>
          <div className="call-title">Analysiert …</div>
          <div className="stages" style={{ justifyContent: "center" }}>
            {["Transkript finalisiert", "Intent erkannt", "Label vergeben"].map((s, i) => (
              <span key={s} className={`stage ${i === 0 ? "done" : "active"}`}>{i === 0 ? "✓ " : ""}{s}</span>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <>
          <h2>Call Analysis</h2>
          <p className="desc">Der Anruf wurde wie eine E-Mail durch dasselbe Klassifizierungs-System analysiert.</p>
          <ClassificationResult result={result} />
          <div className="transcript" aria-label="Gesprächs-Transkript">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role === "user" ? "user" : "ai"}`}>
                <span className="who">{m.role === "user" ? "Anrufer" : "KI-Rezeption"}</span>
                {m.content}
              </div>
            ))}
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={reset} type="button"><Phone size={16} /> Neuer Testanruf</button>
          </div>
        </>
      )}

      {error && (
        <div className="error-box" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {(phase === "idle" || phase === "done") && (
        <div className="info-box">Demo: Bitte keine vertraulichen oder personenbezogenen Daten eingeben.</div>
      )}
    </div>
  );
}

function buildTranscript(conv: ChatMsg[]): string {
  return conv
    .map((m) => `${m.role === "user" ? "Anrufer" : "KI-Rezeption"}: ${m.content}`)
    .join("\n");
}

function transcriptHasUserSpeech(conv: ChatMsg[]): boolean {
  return conv.some((m) => m.role === "user" && m.content.trim().length >= 3);
}
