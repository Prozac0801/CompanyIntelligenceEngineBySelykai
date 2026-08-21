import { describe, expect, it } from "vitest";
import { buildBusinessTriggers } from "@/lib/intelligence/business-triggers";
import { detectCompanyEvents } from "@/lib/intelligence/events";
import { inferSignals } from "@/lib/intelligence/signals";
import { createFact } from "@/lib/intelligence/facts";
import { parseJobPostings } from "@/lib/providers/careers";
import { computeOpportunityScore } from "@/lib/scoring/opportunity";
import type {
  CompanyBusinessTrigger,
  CompanyEnrichment,
  CompanyProfile,
  SourceEvidence,
} from "@/types/company";
import type { CompanyFact } from "@/types/intelligence";

const NOW = new Date("2026-08-21T10:00:00.000Z").getTime();

const officialEvidence: SourceEvidence = {
  providerId: "recherche-entreprises",
  provider: "API Recherche d'entreprises",
  kind: "official",
  observedAt: "2026-08-21T09:00:00.000Z",
  confidence: 1,
};

const rneEvidence: SourceEvidence = {
  providerId: "inpi-rne",
  provider: "INPI / RNE",
  kind: "official",
  observedAt: "2026-08-21T09:00:00.000Z",
  confidence: 1,
};

const boampEvidence: SourceEvidence = {
  providerId: "boamp",
  provider: "BOAMP / DILA",
  kind: "official",
  observedAt: "2026-08-21T09:00:00.000Z",
  confidence: 1,
};

const careersEvidence: SourceEvidence = {
  providerId: "selykai-engine",
  provider: "Selykai Career Discovery",
  kind: "inference",
  observedAt: "2026-08-21T09:00:00.000Z",
  sourceUrl: "https://example.com/carrieres",
  confidence: 0.97,
};

function company(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    siren: "424925790",
    name: "ANAVEO",
    legalForm: "5710",
    nafCode: "80.20Z",
    status: "active",
    employeeBand: "32",
    companyCategory: "ETI",
    employer: true,
    openEstablishmentCount: 12,
    establishmentCount: 40,
    createdAt: "1999-11-01",
    evidence: [officialEvidence],
    executives: [{ name: "FINANCIERE MOTIHARI", role: "Président de SAS" }],
    establishments: [],
    rawFinancials: {
      "2025": { ca: 82_000_000, resultat_net: 1_800_000 },
      "2024": { ca: 69_320_722, resultat_net: 120_487 },
    },
    ...overrides,
  };
}

function enrichment(overrides: Partial<CompanyEnrichment> = {}): CompanyEnrichment {
  return {
    web: {
      domain: "anaveo.com",
      websiteUrl: "https://anaveo.com",
      technologies: ["wordpress"],
      phoneNumbers: [],
      genericEmails: ["contact@anaveo.com"],
      domainVerified: true,
    },
    news: [],
    legalEvents: [],
    procurementAwards: [],
    evidence: [rneEvidence, boampEvidence, careersEvidence],
    ...overrides,
  };
}

function fact(key: string, value: CompanyFact["value"], evidence = officialEvidence): CompanyFact {
  return createFact("commercial", key, value, evidence);
}

describe("first-party hiring discovery", () => {
  it("keeps current JobPosting JSON-LD and rejects expired/old jobs", () => {
    const html = `
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"JobPosting","title":"Technicien sécurité","datePosted":"2026-08-01","validThrough":"2026-10-01"}
      </script>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"JobPosting","title":"Poste expiré","datePosted":"2025-01-01","validThrough":"2025-03-01"}
      </script>`;
    const jobs = parseJobPostings(html, NOW);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.title).toBe("Technicien sécurité");
  });
});

describe("business trigger engine", () => {
  it("creates strong, sourced triggers for a recent public award and active hiring", () => {
    const input = enrichment({
      procurementAwards: [{
        id: "award-1",
        publishedAt: "2026-08-01",
        object: "Maintenance de systèmes de vidéoprotection",
        buyer: "Collectivité exemple",
        holder: "ANAVEO 424925790",
        matchConfidence: 0.99,
        sirenMatched: true,
      }],
      hiring: {
        checkedAt: "2026-08-21T09:00:00.000Z",
        hiringDetected: true,
        careersUrl: "https://anaveo.com/carrieres",
        activeOpeningCount: 8,
        jobTitles: ["Technicien", "Chef de projet"],
        latestPostedAt: "2026-08-10",
        method: "structured-data",
      },
    });

    const triggers = buildBusinessTriggers({ company: company(), enrichment: input, now: NOW });
    expect(triggers.some((trigger) => trigger.type === "PUBLIC_CONTRACT_AWARD" && trigger.strength >= 80)).toBe(true);
    expect(triggers.some((trigger) => trigger.type === "HIRING" && trigger.strength >= 70)).toBe(true);
    expect(triggers.find((trigger) => trigger.type === "PUBLIC_CONTRACT_AWARD")?.source.providerId).toBe("boamp");
  });

  it("detects a recent establishment opening and financial growth", () => {
    const profile = company({
      establishments: [{
        siret: "42492579000422",
        city: "TOULOUSE",
        active: true,
        createdAt: "2026-07-15",
      }],
    });
    const triggers = buildBusinessTriggers({ company: profile, enrichment: enrichment(), now: NOW });
    expect(triggers.some((trigger) => trigger.type === "ESTABLISHMENT_OPENING")).toBe(true);
    expect(triggers.some((trigger) => trigger.type === "FINANCIAL_GROWTH")).toBe(true);
  });
});

describe("historical momentum diffs", () => {
  it("turns SIRET additions/removals, BOAMP and hiring changes into precise events", () => {
    const previous = new Map<string, CompanyFact>([
      ["active_establishment_sirets", fact("active_establishment_sirets", ["11111111111111", "22222222222222"])],
      ["boamp_latest_award_id", fact("boamp_latest_award_id", "old-award", boampEvidence)],
      ["boamp_latest_award_date", fact("boamp_latest_award_date", "2026-05-01", boampEvidence)],
      ["hiring_detected", fact("hiring_detected", false, careersEvidence)],
      ["hiring_opening_count", fact("hiring_opening_count", 0, careersEvidence)],
    ]);
    const current = new Map<string, CompanyFact>([
      ["active_establishment_sirets", fact("active_establishment_sirets", ["22222222222222", "33333333333333"])],
      ["boamp_latest_award_id", fact("boamp_latest_award_id", "new-award", boampEvidence)],
      ["boamp_latest_award_date", fact("boamp_latest_award_date", "2026-08-01", boampEvidence)],
      ["hiring_detected", fact("hiring_detected", true, careersEvidence)],
      ["hiring_opening_count", fact("hiring_opening_count", 6, careersEvidence)],
    ]);

    const events = detectCompanyEvents(previous, current);
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      "ESTABLISHMENT_OPENING",
      "ESTABLISHMENT_CLOSURE",
      "PUBLIC_CONTRACT_AWARD",
      "HIRING_ACTIVITY_CHANGE",
    ]));

    const signals = inferSignals(events);
    expect(signals.map((signal) => signal.type)).toEqual(expect.arrayContaining([
      "EXPANSION",
      "CONTRACTION",
      "PROCUREMENT",
      "HIRING",
    ]));
  });
});

describe("Momentum V0.5 scoring", () => {
  it("lets a strong public award create actionable momentum for a good-fit company", () => {
    const trigger: CompanyBusinessTrigger = {
      id: "boamp:award-1",
      type: "PUBLIC_CONTRACT_AWARD",
      label: "Marché public attribué",
      description: "Maintenance d'un parc de vidéoprotection",
      direction: "positive",
      strength: 90,
      confidence: 0.99,
      occurredAt: "2026-08-01",
      source: boampEvidence,
    };
    const input = enrichment({
      procurementAwards: [{
        id: "award-1",
        publishedAt: "2026-08-01",
        object: trigger.description,
        matchConfidence: 0.99,
        sirenMatched: true,
      }],
    });
    const score = computeOpportunityScore({
      company: company({ rawFinancials: { "2025": { ca: 82_000_000, resultat_net: 4_000_000 } } }),
      facts: [createFact("identity", "rne_siren", "424925790", rneEvidence)],
      events: [],
      signals: [],
      enrichment: input,
      triggers: [trigger],
    });
    const momentum = score.subscores.find((item) => item.id === "momentum");
    expect(momentum?.value).toBeGreaterThanOrEqual(50);
    expect(score.opportunity.status).toBe("triggered");
    expect(score.opportunity.reason).toContain("Marché public attribué");
  });

  it("does not convert a negative contraction trigger into positive Momentum", () => {
    const contraction: CompanyBusinessTrigger = {
      id: "closing:1",
      type: "ESTABLISHMENT_CLOSURE",
      label: "Fermeture d’établissement récente",
      description: "Un site a fermé.",
      direction: "negative",
      strength: 78,
      confidence: 1,
      source: rneEvidence,
    };
    const score = computeOpportunityScore({
      company: company(),
      facts: [createFact("identity", "rne_siren", "424925790", rneEvidence)],
      events: [],
      signals: [],
      enrichment: enrichment(),
      triggers: [contraction],
    });
    expect(score.subscores.find((item) => item.id === "momentum")?.value).toBeNull();
    expect(score.opportunity.status).toBe("watch");
    expect(score.subscores.find((item) => item.id === "risk")?.evidence.join(" ")).toContain("déclencheur");
  });
});
