import { describe, expect, it } from "vitest";
import { detectSearchIntent } from "@/lib/search/query-intent";

describe("search intent detection v0.5.10", () => {
  it("recognizes formatted SIREN and SIRET values", () => {
    expect(detectSearchIntent("380 129 866").id).toBe("siren");
    expect(detectSearchIntent("380 129 866 00067").id).toBe("siret");
  });

  it("distinguishes addresses from company names", () => {
    expect(detectSearchIntent("5 avenue des Sports 65600 Séméac").id).toBe("address");
    expect(detectSearchIntent("Airbus").id).toBe("company");
  });

  it("keeps the empty state explicit", () => {
    expect(detectSearchIntent("  ")).toEqual({
      id: "company",
      label: "Saisie intelligente",
      detail: "Nom, SIREN, SIRET ou adresse",
    });
  });
});
