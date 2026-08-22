import { describe, expect, it } from "vitest";
import {
  applyCommercialActionPolicyToScore,
  applyCommercialActionPolicyToSummary,
} from "@/lib/intelligence/commercial-policy";
import type { CompanyIntelligenceSummary, ExplainableScore } from "@/types/company";

function baseScore(): ExplainableScore {
  return {
    value: 84,
    confidence: "high",
    label: "Priority detected",
    opportunity: { status: "triggered", value: 81, reason: "Recent trigger" },
    factors: [],
    subscores: [
      { id: "fit", label: "Fit", value: 90, weight: 0.4, confidence: "high", status: "scored", evidence: [] },
      { id: "momentum", label: "Momentum", value: 72, weight: 0.25, confidence: "high", status: "scored", evidence: [] },
      { id: "access", label: "Commercial Access", value: 75, weight: 0.2, confidence: "high", status: "scored", evidence: ["Verified domain"] },
      { id: "risk", label: "Risk", value: 18, weight: 0.15, confidence: "high", status: "scored", evidence: [] },
      { id: "confidence", label: "Confidence", value: 85, weight: 0, confidence: "high", status: "scored", evidence: [] },
    ],
    basis: {
      mode: "absolute-evidence",
      description: "Sourced decision.",
      coveragePercent: 85,
      evidenceFamilies: ["RNE", "Web"],
      missingFamilies: [],
      benchmarkStatus: "not-enough-data",
      benchmarkDescription: "No benchmark.",
    },
    version: "intelligence-v0.5.0",
  };
}

function baseSummary(): CompanyIntelligenceSummary {
  return {
    headline: "Test company",
    strengths: ["Hiring"],
    vigilance: [],
    triggers: ["Hiring"],
    nextBestAction: "Prioritize qualification.",
    financial: { assessment: "stable", notes: [] },
  };
}

describe("commercial action policy v0.5.3", () => {
  it("blocks an otherwise triggered decision when reuse is blocked", () => {
    const result = applyCommercialActionPolicyToScore(baseScore(), { status: "blocked", reason: "RNE opposition" });
    expect(result.opportunity.status).toBe("watch");
    expect(result.opportunity.value).toBeUndefined();
    expect(result.label).toContain("prospection bloquée");
    expect(result.subscores.find((item) => item.id === "access")?.label).toBe("Joignabilité");
  });

  it("fails closed when reuse status is unknown", () => {
    const result = applyCommercialActionPolicyToScore(baseScore(), { status: "unknown", reason: "Missing status" });
    expect(result.opportunity.status).toBe("not-determined");
    expect(result.opportunity.reason).toContain("aucune action de prospection");
  });

  it("preserves a triggered decision when reuse is explicitly allowed", () => {
    const result = applyCommercialActionPolicyToScore(baseScore(), { status: "allowed", reason: "Allowed" });
    expect(result.opportunity.status).toBe("triggered");
    expect(result.opportunity.value).toBe(81);
  });

  it("switches the summary to monitoring-only guidance when blocked", () => {
    const result = applyCommercialActionPolicyToSummary(baseSummary(), { status: "blocked", reason: "RNE opposition" });
    expect(result.nextBestAction).toContain("Veille uniquement");
    expect(result.vigilance[0]).toContain("Opposition RNE");
  });
});
