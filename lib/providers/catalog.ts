import { isInpiRneConfigured } from "./inpi-rne";

export type ProviderStatus = "live" | "configured" | "next";

export interface ProviderCatalogItem {
  id: string;
  name: string;
  role: string;
  kind: "official" | "commercial" | "web";
  status: ProviderStatus;
}

export function isApiLayerConfigured(): boolean {
  return Boolean(process.env.APILAYER_API_KEY?.trim());
}

export function isHunterConfigured(): boolean {
  return Boolean(process.env.HUNTER_API_KEY?.trim());
}

export function getProviderCatalog(): readonly ProviderCatalogItem[] {
  return [
    {
      id: "recherche-entreprises",
      name: "API Recherche d'entreprises",
      role: "Identité · SIREN · établissements",
      kind: "official",
      status: "live",
    },
    {
      id: "inpi-rne",
      name: "INPI / RNE",
      role: "Événements · actes · comptes",
      kind: "official",
      status: isInpiRneConfigured() ? "live" : "next",
    },
    {
      id: "apilayer",
      name: "APILayer",
      role: "Web · email · géolocalisation · news",
      kind: "commercial",
      status: isApiLayerConfigured() ? "configured" : "next",
    },
    {
      id: "hunter",
      name: "Hunter",
      role: "Contacts professionnels à la demande",
      kind: "commercial",
      status: isHunterConfigured() ? "configured" : "next",
    },
  ] as const;
}

export function configuredProviderIds(): string[] {
  return getProviderCatalog()
    .filter((provider) => provider.status !== "next")
    .map((provider) => provider.id);
}
