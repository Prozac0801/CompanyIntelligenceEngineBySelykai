import { describe, expect, it } from "vitest";
import { normalizeInpiEstablishments } from "@/lib/providers/inpi-rne";
import { normalizeSerpstackResponse } from "@/lib/providers/apilayer";

describe("RNE wrapped payload discovery", () => {
  it("finds establishment containers even when the API wraps content below another envelope", () => {
    const result = normalizeInpiEstablishments({
      data: {
        company: {
          formalite: {
            content: {
              personneMorale: {
                etablissementPrincipal: {
                  descriptionEtablissement: { siret: "42492579000083", indicateurEtablissementPrincipal: true },
                  adresse: { numVoie: "10", typeVoie: "RUE", voie: "DES ROSIERISTES", codePostal: "69410", commune: "CHAMPAGNE-AU-MONT-D'OR" },
                  activites: [{ rolePrincipalPourEntreprise: true, codeApe: "80.20Z", dateDebut: "2005-05-09" }],
                },
                autresEtablissements: [
                  {
                    descriptionEtablissement: { siret: "42492579000125" },
                    adresse: { numVoie: "2", typeVoie: "RUE", voie: "EXEMPLE", codePostal: "31000", commune: "TOULOUSE" },
                    activites: [{ indicateurPrincipal: true, codeApe: "80.20Z", dateDebut: "2012-01-01" }],
                  },
                ],
              },
            },
          },
        },
      },
    });

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.siret === "42492579000083")).toMatchObject({ headOffice: true, active: true });
    expect(result.find((item) => item.siret === "42492579000125")).toMatchObject({ city: "TOULOUSE", active: true });
  });
});

describe("Serpstack response normalization", () => {
  it("accepts the documented organic_results response", () => {
    const normalized = normalizeSerpstackResponse({
      request: { success: true },
      organic_results: [
        {
          position: 1,
          title: "ANAVEO | Sécurité électronique",
          url: "https://www.anaveo.com/",
          domain: "www.anaveo.com",
          snippet: "Solutions de sécurité électronique pour les entreprises.",
        },
      ],
    });
    expect(normalized?.organic_results[0]).toMatchObject({
      position: 1,
      url: "https://www.anaveo.com/",
      snippet: "Solutions de sécurité électronique pour les entreprises.",
    });
  });

  it("accepts the alternate organic/rank/link/description response shape", () => {
    const normalized = normalizeSerpstackResponse({
      request: { success: true },
      organic: [
        {
          rank: 1,
          title: "ANAVEO | Sécurité électronique",
          link: "https://www.anaveo.com/",
          description: "Solutions de sécurité électronique pour les entreprises.",
        },
      ],
    });
    expect(normalized?.organic_results[0]).toMatchObject({
      position: 1,
      url: "https://www.anaveo.com/",
      snippet: "Solutions de sécurité électronique pour les entreprises.",
    });
  });
});
