import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contactDomainIsFresh } from "@/lib/intelligence/contact-eligibility";
import { executionPolicy } from "@/lib/intelligence/execution-policy";

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
