import { describe, expect, it } from "vitest";
import { isBlockedIpAddress, isSafeWebsiteHostname, pageMatchesCompany } from "@/lib/providers/direct-web";
import { mergeWebIntelligence } from "@/lib/intelligence/enrichment";
import type { CompanyWebIntelligence } from "@/types/company";

describe("direct website safety", () => {
  it("blocks local and private destinations", () => {
    expect(isSafeWebsiteHostname("localhost")).toBe(false);
    expect(isSafeWebsiteHostname("service.internal")).toBe(false);
    expect(isSafeWebsiteHostname("127.0.0.1")).toBe(false);
    expect(isBlockedIpAddress("10.1.2.3")).toBe(true);
    expect(isBlockedIpAddress("192.168.1.10")).toBe(true);
    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
  });

  it("accepts a normal public hostname", () => {
    expect(isSafeWebsiteHostname("anaveo.com")).toBe(true);
    expect(isSafeWebsiteHostname("www.anaveo.com")).toBe(true);
  });
});

describe("first-party identity matching", () => {
  it("matches a distinctive company name in first-party page content", () => {
    expect(pageMatchesCompany("ANAVEO", "ANAVEO sécurise et optimise les sites des entreprises." )).toBe(true);
  });

  it("rejects unrelated content", () => {
    expect(pageMatchesCompany("ANAVEO", "Cabinet comptable et audit financier à Paris." )).toBe(false);
  });
});

describe("first-party corroboration merge", () => {
  const hunter: CompanyWebIntelligence = {
    domain: "anaveo.com",
    websiteUrl: "https://anaveo.com",
    technologies: ["wordpress", "nginx"],
    genericEmails: ["contact@anaveo.com"],
    phoneNumbers: [],
  };

  it("validates Hunter data when the first-party website independently matches", () => {
    const web = mergeWebIntelligence(hunter, undefined, {
      domain: "anaveo.com",
      websiteUrl: "https://anaveo.com/",
      description: "ANAVEO accompagne les entreprises avec des solutions de sécurité électronique.",
      domainVerified: true,
      descriptionSource: "first-party-site",
      technologies: [],
      genericEmails: [],
      phoneNumbers: [],
    });

    expect(web?.domainVerified).toBe(true);
    expect(web?.descriptionSource).toBe("first-party-site");
    expect(web?.technologies).toEqual(["wordpress", "nginx"]);
    expect(web?.genericEmails).toEqual(["contact@anaveo.com"]);
  });

  it("does not validate a different first-party domain", () => {
    const web = mergeWebIntelligence(hunter, undefined, {
      domain: "unrelated.example",
      websiteUrl: "https://unrelated.example/",
      domainVerified: true,
      technologies: [],
      genericEmails: [],
      phoneNumbers: [],
    });
    expect(web?.domainVerified).toBe(false);
    expect(web?.technologies).toEqual([]);
  });
});
