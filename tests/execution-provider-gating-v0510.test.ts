import { beforeEach, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({
  resolveDomain: vi.fn(async () => "example.com"),
  hunterCompany: vi.fn(async () => ({
    web: {
      domain: "example.com",
      technologies: [],
      phoneNumbers: [],
      genericEmails: [],
    },
    evidence: {
      providerId: "hunter",
      provider: "Hunter",
      kind: "commercial" as const,
      observedAt: "2026-08-24T10:00:00.000Z",
      confidence: 0.86,
    },
  })),
  serp: vi.fn(async () => ({ web: { domain: "example.com" } })),
  news: vi.fn(async () => ({ news: [] })),
  firstParty: vi.fn(async () => ({
    web: {
      domain: "example.com",
      domainVerified: true,
      technologies: [],
      phoneNumbers: [],
      genericEmails: [],
    },
  })),
  procurement: vi.fn(async () => ({ awards: [] })),
  hiring: vi.fn(async () => ({
    hiring: {
      checkedAt: "2026-08-24T10:00:00.000Z",
      hiringDetected: false,
      jobTitles: [],
      method: "not-found" as const,
    },
  })),
}));

vi.mock("@/lib/providers/hunter", () => ({
  getHunterCompanyIntelligence: providers.hunterCompany,
  resolveHunterDomain: providers.resolveDomain,
}));
vi.mock("@/lib/providers/apilayer", () => ({
  getCompanyNews: providers.news,
  getSerpWebIntelligence: providers.serp,
}));
vi.mock("@/lib/providers/direct-web", () => ({
  verifyCompanyWebsite: providers.firstParty,
}));
vi.mock("@/lib/providers/boamp", () => ({
  getBoampAwards: providers.procurement,
}));
vi.mock("@/lib/providers/careers", () => ({
  getFirstPartyHiringIntelligence: providers.hiring,
}));

import { enrichCompany } from "@/lib/intelligence/enrichment";
import { executionPolicy } from "@/lib/intelligence/execution-policy";
import type { CompanyProfile } from "@/types/company";

const company: CompanyProfile = {
  siren: "123456789",
  name: "Example",
  status: "active",
  executives: [],
  establishments: [],
  evidence: [],
};

describe("execution provider gating v0.5.10", () => {
  beforeEach(() => {
    for (const provider of Object.values(providers)) provider.mockClear();
  });

  it("keeps contact enrichment away from news, procurement and hiring", async () => {
    await enrichCompany(company, executionPolicy("contact"));

    expect(providers.resolveDomain).toHaveBeenCalledOnce();
    expect(providers.serp).toHaveBeenCalledOnce();
    expect(providers.news).not.toHaveBeenCalled();
    expect(providers.procurement).not.toHaveBeenCalled();
    expect(providers.hiring).not.toHaveBeenCalled();
  });

  it("keeps bootstrap on official identity only", async () => {
    await enrichCompany(company, executionPolicy("bootstrap"));

    expect(providers.resolveDomain).not.toHaveBeenCalled();
    expect(providers.serp).not.toHaveBeenCalled();
    expect(providers.news).not.toHaveBeenCalled();
    expect(providers.procurement).not.toHaveBeenCalled();
    expect(providers.hiring).not.toHaveBeenCalled();
  });

  it("retains the complete provider path for monitoring", async () => {
    await enrichCompany(company, executionPolicy("monitoring"));

    expect(providers.resolveDomain).toHaveBeenCalledOnce();
    expect(providers.serp).toHaveBeenCalledOnce();
    expect(providers.news).toHaveBeenCalledOnce();
    expect(providers.procurement).toHaveBeenCalledOnce();
    expect(providers.hiring).toHaveBeenCalledOnce();
  });
});
