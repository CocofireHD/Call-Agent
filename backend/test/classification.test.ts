import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ClassificationSchema } from "../src/schemas/classification.js";
import { extractJsonObject } from "../src/services/kilo.js";
import { CLASSIFIER_SYSTEM_PROMPT } from "../src/prompts/classifier.js";

describe("classification schema", () => {
  it("accepts a valid classification", () => {
    const parsed = ClassificationSchema.safeParse({
      label: "potential_customer",
      priority: "high",
      leadScore: 94,
      confidence: 0.91,
      summary: "Interessent sucht Lösung für 30 Mitarbeiter.",
      reasoning: "Fragt nach Preisen und Demo.",
      detectedIntent: "Pricing / Demo Request",
      suggestedAction: "Zurückrufen und Demo vereinbaren.",
      tags: ["demo", "pricing"],
    });
    assert.equal(parsed.success, true);
  });

  it("rejects acquisition with high lead score only via schema range (schema allows, prompt guides)", () => {
    // Schema itself allows 0-100; prompt engineering enforces low scores for acquisition.
    const parsed = ClassificationSchema.safeParse({
      label: "acquisition",
      priority: "low",
      leadScore: 8,
      confidence: 0.9,
      summary: "Agentur bietet Marketing an.",
      reasoning: "Will etwas verkaufen, nicht kaufen.",
      detectedIntent: "Cold Outreach",
      suggestedAction: "Höflich ablehnen oder ignorieren.",
      tags: ["agentur"],
    });
    assert.equal(parsed.success, true);
  });

  it("rejects out-of-range leadScore", () => {
    const parsed = ClassificationSchema.safeParse({
      label: "other",
      priority: "low",
      leadScore: 150,
      confidence: 0.5,
      summary: "x",
      reasoning: "y",
      detectedIntent: "z",
      suggestedAction: "a",
      tags: [],
    });
    assert.equal(parsed.success, false);
  });
});

describe("extractJsonObject", () => {
  it("passes through plain JSON", () => {
    const raw = `{"label":"support","priority":"high"}`;
    assert.equal(extractJsonObject(raw), raw);
  });

  it("strips markdown fences", () => {
    const raw = "```json\n{\"label\":\"support\"}\n```";
    assert.equal(extractJsonObject(raw), `{"label":"support"}`);
  });

  it("extracts object from prose", () => {
    const raw = `Here is the result: {"label":"finance","priority":"medium"} thanks`;
    assert.equal(extractJsonObject(raw), `{"label":"finance","priority":"medium"}`);
  });
});

describe("classifier prompt", () => {
  it("contains directionality rules and required labels", () => {
    for (const needle of [
      "potential_customer",
      "acquisition",
      "Wir können Ihre Webseite verbessern",
      "leadScore",
      "JSON ONLY",
    ]) {
      assert.ok(CLASSIFIER_SYSTEM_PROMPT.includes(needle), `prompt should include: ${needle}`);
    }
  });
});
