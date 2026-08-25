import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contactDomainIsFresh,
  persistedContactDomainIsEligible,
} from "@/lib/intelligence/contact-eligibility";
import { factsFromEnrichment } from "@/lib/intelligence/enrichment";
import { executionPolicy } from "@/lib/intelligence/execution-policy";
import { canonicalDomainForPersistence } from "@/lib/persistence/company-repository";
import type { CompanyFact } from "@/types/intelligence";

function domainVerificationFact(value: string, observedAt: string): CompanyFact {
  return {
    type: "web",
    key: "web_verified_domain",
    value,
    fingerprint: `web-verified-domain:${value}`,
    evidence: {
      providerId: "selykai-engine",
      provider: "Selykai Web Verification",
      kind: "inference",
      observedAt,
      confidence: 0.94,
    },
  };
}

describe("v0.5.10 execution intents", () => {
  it("keeps contact and bootstrap work intentionally narrow", () => {
    expect(executionPolicy("contact").providerFamilies).toEqual([
      "official-identity",
      "commercial-policy",
      "web-identity",
    ]);
    expect(executionPolicy("bootstrap").providerFamilies).toEqual(["official-identity"]);
    expect(executionPolicy("monitoring").detectEvents).toBe(true);
    expect(executionPolicy("contact").detectEvents).toBe(false);
  });

  it("uses the real domain observation timestamp, not company updated_at", () => {
    const now = Date.parse("2026-08-24T10:00:00.000Z");
    expect(contactDomainIsFresh({
      domain: "selykai.com",
      domainObservedAt: "2026-08-20T10:00:00.000Z",
    }, now)).toBe(true);
    expect(contactDomainIsFresh({
      domain: "selykai.com",
      domainObservedAt: "2026-06-01T10:00:00.000Z",
    }, now)).toBe(false);
    expect(contactDomainIsFresh({ domain: "selykai.com" }, now)).toBe(false);
  });

  it("never reuses a persisted contact domain without explicit fresh verification", () => {
    const now = Date.parse("2026-08-24T10:00:00.000Z");
    const base = {
      domain: "selykai.com",
      domainObservedAt: "2026-08-20T10:00:00.000Z",
    };

    expect(persistedContactDomainIsEligible({
      ...base,
      facts: [domainVerificationFact("selykai.com", "2026-08-20T10:00:00.000Z")],
    }, now)).toBe(true);
    expect(persistedContactDomainIsEligible({
      ...base,
      facts: [domainVerificationFact("wrong-company.example", "2026-08-20T10:00:00.000Z")],
    }, now)).toBe(false);
    expect(persistedContactDomainIsEligible({ ...base, facts: [] }, now)).toBe(false);
    expect(persistedContactDomainIsEligible({
      ...base,
      facts: [domainVerificationFact("selykai.com", "2026-06-01T10:00:00.000Z")],
    }, now)).toBe(false);
  });

  it("persists only a domain that the current analysis actually verified", () => {
    expect(canonicalDomainForPersistence({
      web: {
        domain: "selykai.com",
        domainVerified: true,
        linkedinVerified: false,
        technologies: [],
        phoneNumbers: [],
        genericEmails: [],
      },
    })).toBe("selykai.com");
    expect(canonicalDomainForPersistence({
      web: {
        domain: "candidate.example",
        domainVerified: false,
        linkedinVerified: false,
        technologies: [],
        phoneNumbers: [],
        genericEmails: [],
      },
    })).toBeNull();
  });

  it("binds persisted verification evidence to the exact verified domain", () => {
    const facts = factsFromEnrichment({
      web: {
        domain: "selykai.com",
        domainVerified: true,
        linkedinVerified: false,
        technologies: [],
        phoneNumbers: [],
        genericEmails: [],
      },
      news: [],
      legalEvents: [],
      evidence: [{
        providerId: "selykai-engine",
        provider: "Selykai Web Verification",
        kind: "inference",
        observedAt: "2026-08-24T10:00:00.000Z",
        confidence: 0.94,
      }],
    });

    expect(facts.find((fact) => fact.key === "web_verified_domain")?.value).toBe("selykai.com");
  });

  it("does not run exhaustive analysis merely to reveal contacts", () => {
    const source = readFileSync(
      new URL("../app/api/v1/companies/[siren]/contacts/route.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("analyzeCompany");
    expect(source).toContain("resolveContactEligibility");
  });

  it("does not run exhaustive analysis merely to add a company to a watchlist", () => {
    const workspaceAction = readFileSync(new URL("../app/workspace/actions.ts", import.meta.url), "utf8");
    const companyAction = readFileSync(new URL("../app/company/[siren]/actions.ts", import.meta.url), "utf8");
    expect(workspaceAction).not.toContain("analyzeCompany");
    expect(companyAction).not.toContain("analyzeCompany");
    expect(workspaceAction).toContain("bootstrapCompany");
    expect(companyAction).toContain("bootstrapCompany");
  });
});
