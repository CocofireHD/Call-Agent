export type Label =
  | "potential_customer"
  | "existing_customer"
  | "acquisition"
  | "support"
  | "partner"
  | "finance"
  | "spam"
  | "other";

export type Priority = "low" | "medium" | "high" | "urgent";

export interface Classification {
  label: Label;
  priority: Priority;
  leadScore: number;
  confidence: number;
  summary: string;
  reasoning: string;
  detectedIntent: string;
  suggestedAction: string;
  tags: string[];
}

export type Source = "call" | "email";

export interface ActivityItem {
  id: string;
  source: Source;
  from: string;
  subject: string;
  text: string;
  transcript?: string;
  createdAt: string;
  classification: Classification;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export type Tab = "dashboard" | "call" | "email" | "activity";
