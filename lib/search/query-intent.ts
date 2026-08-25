export type SearchIntentId = "company" | "siren" | "siret" | "address";

export interface SearchIntent {
  id: SearchIntentId;
  label: string;
  detail: string;
}

export function detectSearchIntent(value: string): SearchIntent {
  const query = value.trim();
  const compactDigits = query.replace(/[\s.-]/g, "");

  if (/^\d{9}$/.test(compactDigits)) {
    return {
      id: "siren",
      label: "SIREN détecté",
      detail: "Recherche exacte sur l’unité légale",
    };
  }

  if (/^\d{14}$/.test(compactDigits)) {
    return {
      id: "siret",
      label: "SIRET détecté",
      detail: "Recherche exacte sur l’établissement",
    };
  }

  if (/\b\d{5}\b/.test(query) || /\b(rue|avenue|boulevard|route|chemin|place|allée|allee)\b/i.test(query)) {
    return {
      id: "address",
      label: "Adresse détectée",
      detail: "Recherche géographique et établissement",
    };
  }

  return {
    id: "company",
    label: query ? "Raison sociale détectée" : "Saisie intelligente",
    detail: query ? "Correspondance nom, sigle et identité" : "Nom, SIREN, SIRET ou adresse",
  };
}
