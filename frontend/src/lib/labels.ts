import type { Classification, Label, Priority } from "../types";

export const LABEL_META: Record<Label, { de: string; hint: string; className: string }> = {
  potential_customer: { de: "Potenzieller Kunde", hint: "Will BEI uns kaufen", className: "lbl-pc" },
  existing_customer: { de: "Bestehender Kunde", hint: "Hat bereits ein Konto", className: "lbl-ec" },
  acquisition: { de: "Akquise", hint: "Will UNS etwas verkaufen", className: "lbl-acq" },
  support: { de: "Support", hint: "Braucht Hilfe", className: "lbl-sup" },
  partner: { de: "Partner", hint: "Kooperation", className: "lbl-par" },
  finance: { de: "Finanzen", hint: "Rechnung / Zahlung", className: "lbl-fin" },
  spam: { de: "Spam", hint: "Irrelevant / Scam", className: "lbl-spam" },
  other: { de: "Sonstiges", hint: "Keine Kategorie", className: "lbl-other" },
};

export const PRIORITY_META: Record<Priority, { de: string; className: string }> = {
  low: { de: "Niedrig", className: "pri-low" },
  medium: { de: "Mittel", className: "pri-med" },
  high: { de: "Hoch", className: "pri-high" },
  urgent: { de: "Dringend", className: "pri-urgent" },
};

export function leadBand(score: number): string {
  if (score >= 75) return "Stark";
  if (score >= 50) return "Mittel";
  if (score >= 25) return "Schwach";
  return "Kein";
}

export function confidencePct(c: Classification["confidence"]): string {
  return `${Math.round(c * 100)} %`;
}
