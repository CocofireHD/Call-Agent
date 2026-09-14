import { z } from "zod";

export const LabelSchema = z.enum([
  "potential_customer",
  "existing_customer",
  "acquisition",
  "support",
  "partner",
  "finance",
  "spam",
  "other",
]);

export const PrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const ClassificationSchema = z.object({
  label: LabelSchema,
  priority: PrioritySchema,
  leadScore: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(600),
  reasoning: z.string().min(1).max(1200),
  detectedIntent: z.string().min(1).max(200),
  suggestedAction: z.string().min(1).max(600),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
});

export type Classification = z.infer<typeof ClassificationSchema>;
export type Label = z.infer<typeof LabelSchema>;
export type Priority = z.infer<typeof PrioritySchema>;

export const ClassifyRequestSchema = z.object({
  source: z.enum(["email", "call"]),
  from: z.string().max(200).optional().default(""),
  subject: z.string().max(300).optional().default(""),
  text: z.string().min(1, "Text darf nicht leer sein").max(12000),
});

export type ClassifyRequest = z.infer<typeof ClassifyRequestSchema>;

export const AgentMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

export const AgentRequestSchema = z.object({
  conversation: z.array(AgentMessageSchema).min(1).max(30),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;
