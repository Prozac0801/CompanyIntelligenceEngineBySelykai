import { describe, expect, it } from "vitest";
import { detectCompanyEvents } from "@/lib/intelligence/events";
import { inferSignals } from "@/lib/intelligence/signals";
import { monitoringAlertPresentation } from "@/lib/monitoring/run-monitoring";
import type { CompanyEvent, CompanyFact } from "@/types/intelligence";
import type { SourceEvidence } from "@/types/company";

const rneEvidence: SourceEvidence = {
  providerId: "inpi-rne",
  provider: "INPI / RNE",
  kind: "official",
  observedAt: "2026-08-22T08:00:00.000Z",
  confidence: 1,
};

function reuseFact(value: boolean | null): CompanyFact {
  return {
    type: "structure",
    key: "commercial_prospecting_allowed",
    value,
    evidence: rneEvidence,
    fingerprint: `reuse-${String(value)}`,
  };
}

function event(type: CompanyEvent["type"], title = "Événement détecté"): CompanyEvent {
  return {
    type,
    title,
    description: "Un changement factuel a été observé.",
    observedAt: "2026-08-22T08:00:00.000Z",
    confidence: 1,
    evidenceKeys: ["test"],
  };
}

describe("V0.5.5 RNE policy events", () => {
  it("emits a high-value monitoring event when commercial reuse becomes blocked", () => {
    const previous = new Map<string, CompanyFact>([["commercial_prospecting_allowed", reuseFact(true)]]);
    const current = new Map<string, CompanyFact>([["commercial_prospecting_allowed", reuseFact(false)]]);

    const events = detectCompanyEvents(previous, current);
    const policyEvent = events.find((item) => item.type === "COMMERCIAL_REUSE_CHANGE");

    expect(policyEvent?.title).toContain("désormais bloquée");
    expect(policyEvent?.description).toContain("autorisé sans opposition RNE détectée");
    expect(policyEvent?.description).toContain("bloqué par opposition RNE");
  });

  it("emits an explicit event when an RNE opposition is lifted", () => {
    const previous = new Map<string, CompanyFact>([["commercial_prospecting_allowed", reuseFact(false)]]);
    const current = new Map<string, CompanyFact>([["commercial_prospecting_allowed", reuseFact(true)]]);

    const policyEvent = detectCompanyEvents(previous, current)
      .find((item) => item.type === "COMMERCIAL_REUSE_CHANGE");

    expect(policyEvent?.title).toContain("levée");
    expect(policyEvent?.description).toContain("bloqué par opposition RNE");
  });

  it("does not turn a temporarily missing RNE fact into a policy-change event", () => {
    const previous = new Map<string, CompanyFact>([["commercial_prospecting_allowed", reuseFact(false)]]);
    const current = new Map<string, CompanyFact>();

    const policyEvent = detectCompanyEvents(previous, current)
      .find((item) => item.type === "COMMERCIAL_REUSE_CHANGE");

    expect(policyEvent).toBeUndefined();
  });

  it("does not create an upgrade-noise event when the previous snapshot had no RNE policy fact", () => {
    const previous = new Map<string, CompanyFact>([["legal_name", {
      type: "identity",
      key: "legal_name",
      value: "TEST",
      evidence: rneEvidence,
      fingerprint: "legal-name-test",
    }]]);
    const current = new Map<string, CompanyFact>([["commercial_prospecting_allowed", reuseFact(false)]]);

    const policyEvent = detectCompanyEvents(previous, current)
      .find((item) => item.type === "COMMERCIAL_REUSE_CHANGE");

    expect(policyEvent).toBeUndefined();
  });

  it("does not inflate Momentum from a policy-only change", () => {
    const signals = inferSignals([event("COMMERCIAL_REUSE_CHANGE")]);
    expect(signals).toEqual([]);
  });
});

describe("V0.5.5 monitoring alert presentation", () => {
  it("keeps a material event visible but labels it as monitoring-only when reuse is blocked", () => {
    const presentation = monitoringAlertPresentation(event("ESTABLISHMENT_OPENING", "Nouvel établissement ouvert"), {
      status: "blocked",
      reason: "Opposition RNE",
    });

    expect(presentation.title).toBe("Veille · Nouvel établissement ouvert");
    expect(presentation.body).toContain("veille uniquement");
    expect(presentation.body).toContain("aucune sollicitation");
    expect(presentation.severity).toBe("high");
  });

  it("fails closed in alerts when reuse status is unknown", () => {
    const presentation = monitoringAlertPresentation(event("BODACC_ACTIVITY", "Nouvelle annonce BODACC"), {
      status: "unknown",
      reason: "Statut non confirmé",
    });

    expect(presentation.title).toBe("Veille · Nouvelle annonce BODACC");
    expect(presentation.body).toContain("statut de réutilisation commerciale n’est pas confirmé");
    expect(presentation.severity).toBe("medium");
  });

  it("leaves normal monitoring alerts unchanged when reuse is allowed", () => {
    const source = event("PUBLIC_CONTRACT_AWARD", "Nouveau marché public attribué");
    const presentation = monitoringAlertPresentation(source, {
      status: "allowed",
      reason: "Aucune opposition RNE",
    });

    expect(presentation.title).toBe(source.title);
    expect(presentation.body).toBe(source.description);
    expect(presentation.severity).toBe("high");
  });

  it("keeps a policy-change alert explicit instead of adding a generic Veille prefix", () => {
    const presentation = monitoringAlertPresentation(
      event("COMMERCIAL_REUSE_CHANGE", "Réutilisation commerciale désormais bloquée"),
      { status: "blocked", reason: "Opposition RNE" },
    );

    expect(presentation.title).toBe("Réutilisation commerciale désormais bloquée");
    expect(presentation.severity).toBe("high");
  });
});
