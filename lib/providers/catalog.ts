import { isInpiRneConfigured } from "./inpi-rne";
import { isApiLayerProviderConfigured } from "./apilayer";
import { isHunterProviderConfigured } from "./hunter";

export type ProviderStatus = "live" | "configured" | "next";

export interface ProviderCatalogItem {
  id: string;
  name: string;
  role: string;
  kind: "official" | "commercial" | "web";
  status: ProviderStatus;
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
      role: "RNE · identité · actes · établissements détaillés",
      kind: "official",
      status: isInpiRneConfigured() ? "live" : "next",
    },
    {
      id: "bodacc",
      name: "BODACC / DILA",
      role: "Créations · modifications · radiations · procédures · comptes",
      kind: "official",
      status: "live",
    },
    {
      id: "boamp",
      name: "BOAMP / DILA",
      role: "Attributions de marchés publics · activité commerciale",
      kind: "official",
      status: "live",
    },
    {
      id: "apilayer",
      name: "APILayer",
      role: "SERP · actualités · géolocalisation",
      kind: "web",
      status: isApiLayerProviderConfigured() ? "live" : "next",
    },
    {
      id: "hunter",
      name: "Hunter",
      role: "Domaine · firmographie · technologies · contacts",
      kind: "commercial",
      status: isHunterProviderConfigured() ? "live" : "next",
    },
  ] as const;
}

export function configuredProviderIds(): string[] {
  return getProviderCatalog()
    .filter((provider) => provider.status !== "next")
    .map((provider) => provider.id);
}
