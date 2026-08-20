export type ProviderStatus = "live" | "next";

export interface ProviderCatalogItem {
  id: string;
  name: string;
  role: string;
  kind: "official" | "commercial" | "web";
  status: ProviderStatus;
}

export const PROVIDER_CATALOG: readonly ProviderCatalogItem[] = [
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
    status: "next",
  },
  {
    id: "apilayer",
    name: "APILayer",
    role: "Web · email · géolocalisation · news",
    kind: "commercial",
    status: "next",
  },
  {
    id: "hunter",
    name: "Hunter",
    role: "Contacts professionnels à la demande",
    kind: "commercial",
    status: "next",
  },
] as const;

export const LIVE_PROVIDERS = PROVIDER_CATALOG.filter((provider) => provider.status === "live");
