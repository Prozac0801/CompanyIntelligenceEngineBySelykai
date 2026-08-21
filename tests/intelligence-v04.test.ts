import { afterEach, describe, expect, it } from "vitest";
import { financialInsight } from "@/lib/intelligence/summary";
import { computeOpportunityScore } from "@/lib/scoring/opportunity";
import { classifyBodaccRisk } from "@/lib/providers/bodacc";
import { canWriteRuntimeState } from "@/lib/runtime/write-policy";
import type {
  CompanyEnrichment,
  CompanyLegalEvent,
  CompanyProfile,
  SourceEvidence,
} from "@/types/company";
import type { CompanyFact } from "@/types/intelligence";

const officialEvidence: SourceEvidence = {
  providerId: "recherche-entreprises",
  provider: "API Recherche d'entreprises",
  kind: "official",
  observedAt: "2026-08-21T08:00:00.000Z",
  confidence: 1,
};

const bodaccEvidence: SourceEvidence = {
  providerId: "bodacc",
  provider: "BODACC / DILA",
  kind: "official",
  observedAt: "2026-08-21T08:00:00.000Z",
  confidence: 1,
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
    rawFinancials: { "2024": { ca: 69_320_722, resultat_net: 120_487 } },
    ...overrides,
  };
}

function enrichment(legalEvents: CompanyLegalEvent[] = []): CompanyEnrichment {
  return {
    web: {
      domain: "anaveo.com",
      websiteUrl: "https://anaveo.com",
      technologies: ["wordpress", "nginx"],
      genericEmails: ["contact@anaveo.com"],
      phoneNumbers: [],
      serpPosition: 1,
    },
    news: [],
    legalEvents,
    evidence: [bodaccEvidence],
  };
}

const rneFact: CompanyFact = {
  type: "identity",
  key: "rne_siren",
  value: "424925790",
  fingerprint: "rne-test",
  evidence: {
    providerId: "inpi-rne",
    provider: "INPI / RNE",
    kind: "official",
    observedAt: "2026-08-21T08:00:00.000Z",
    confidence: 1,
  },
};

function recentDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

afterEach(() => {
  delete process.env.VERCEL_ENV;
});

describe("BODACC semantics", () => {
  it("classifies an opening liquidation judgment as critical", () => {
    expect(classifyBodaccRisk({
      code: "collective",
      label: "Procédures collectives",
      detail: "Jugement prononçant l'ouverture d'une liquidation judiciaire",
    })).toBe("critical");
  });

  it("does not classify a liquidation closure as an active critical procedure", () => {
    expect(classifyBodaccRisk({
      code: "collective",
      label: "Procédures collectives",
      detail: "Jugement de clôture de la procédure de liquidation judiciaire pour insuffisance d'actif",
    })).toBe("warning");
  });

  it("classifies an immatriculation as positive", () => {
    expect(classifyBodaccRisk({ label: "Créations d'établissements", type: "Immatriculation" })).toBe("positive");
  });
});

describe("V0.4 financial intelligence", () => {
  it("does not turn missing financial values into zeroes", () => {
    const result = financialInsight({ "2024": { ca: null, resultat_net: "" } });
    expect(result.revenue).toBeUndefined();
    expect(result.netIncome).toBeUndefined();
    expect(result.netMarginPercent).toBeUndefined();
    expect(result.assessment).toBe("unknown");
  });

  it("computes the observed net margin from public values", () => {
    const result = financialInsight({ "2024": { ca: 69_320_722, resultat_net: 120_487 } });
    expect(result.netMarginPercent).toBeCloseTo(0.1738, 3);
    expect(result.assessment).toBe("watch");
  });
});

describe("V0.4 decision scoring", () => {
  it("keeps Momentum unavailable when there is no genuine recent trigger", () => {
    const routineFiling: CompanyLegalEvent = {
      id: "filing",
      date: recentDate(10),
      family: "Dépôt des comptes",
      title: "Dépôt des comptes annuels",
      description: "Comptes annuels déposés",
      risk: "neutral",
    };
    const score = computeOpportunityScore({
      company: company(),
      facts: [rneFact],
      events: [],
      signals: [],
      enrichment: enrichment([routineFiling]),
    });
    expect(score.subscores.find((item) => item.id === "momentum")?.value).toBeNull();
    expect(score.opportunity.status).toBe("watch");
  });

  it("hard-blocks an immediate commercial trigger when a recent critical procedure exists", () => {
    const critical: CompanyLegalEvent = {
      id: "critical",
      date: recentDate(20),
      family: "Procédures collectives",
      title: "Liquidation judiciaire",
      description: "Jugement prononçant l'ouverture d'une liquidation judiciaire",
      risk: "critical",
    };
    const growthTrigger: CompanyLegalEvent = {
      id: "growth",
      date: recentDate(12),
      family: "Créations d'établissements",
      title: "Immatriculation",
      risk: "positive",
    };
    const score = computeOpportunityScore({
      company: company(),
      facts: [rneFact],
      events: [],
      signals: [],
      enrichment: enrichment([critical, growthTrigger]),
    });
    expect(score.subscores.find((item) => item.id === "momentum")?.value).not.toBeNull();
    expect(score.opportunity.status).toBe("watch");
    expect(score.opportunity.reason).toContain("procédure BODACC critique récente");
  });

  it("makes a closed company explicit in risk evidence", () => {
    const score = computeOpportunityScore({
      company: company({ status: "closed" }),
      facts: [rneFact],
      events: [],
      signals: [],
      enrichment: enrichment(),
    });
    const risk = score.subscores.find((item) => item.id === "risk");
    expect(risk?.evidence.join(" ")).toContain("administrativement fermée");
    expect(score.opportunity.status).toBe("watch");
  });
});

describe("preview write policy", () => {
  it("disables database side effects in Vercel previews", () => {
    process.env.VERCEL_ENV = "preview";
    expect(canWriteRuntimeState()).toBe(false);
  });

  it("allows database side effects outside Vercel previews", () => {
    process.env.VERCEL_ENV = "production";
    expect(canWriteRuntimeState()).toBe(true);
  });
});
