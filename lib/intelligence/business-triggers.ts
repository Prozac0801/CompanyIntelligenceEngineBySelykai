import type {
  CompanyBusinessTrigger,
  CompanyEnrichment,
  CompanyProfile,
  SourceEvidence,
} from "@/types/company";
import type { CompanyFact } from "@/types/intelligence";
import { financialInsight } from "./summary";
import { isCommercialMomentumLegalEvent } from "./legal-events";

const DAY_MS = 24 * 60 * 60 * 1000;

function ageDays(value?: string, now = Date.now()): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / DAY_MS) : null;
}

function clampStrength(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function evidenceFor(
  providerId: string,
  company: CompanyProfile,
  enrichment: CompanyEnrichment,
  facts: CompanyFact[],
): SourceEvidence {
  return enrichment.evidence.find((item) => item.providerId === providerId)
    || facts.find((item) => item.evidence.providerId === providerId)?.evidence
    || company.evidence.find((item) => item.providerId === providerId)
    || company.evidence[0]
    || {
      providerId,
      provider: providerId,
      kind: "inference",
      observedAt: new Date().toISOString(),
      confidence: 0.5,
    };
}

function recencyStrength(date: string | undefined, base: number, now: number): number {
  const age = ageDays(date, now);
  if (age === null) return base;
  if (age <= 30) return base + 12;
  if (age <= 90) return base + 8;
  if (age <= 180) return base + 3;
  if (age <= 365) return base - 5;
  return base - 20;
}

function legalStrength(text: string): number {
  const value = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/fusion|augmentation de capital|immatriculation|creation|nouvel etablissement/.test(value)) return 74;
  if (/transfert|cession|vente|achat/.test(value)) return 64;
  return 55;
}

function triggerSort(a: CompanyBusinessTrigger, b: CompanyBusinessTrigger): number {
  const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
  const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return bTime - aTime;
  return b.strength - a.strength;
}

export function buildBusinessTriggers(input: {
  company: CompanyProfile;
  enrichment: CompanyEnrichment;
  facts?: CompanyFact[];
  now?: number;
}): CompanyBusinessTrigger[] {
  const { company, enrichment } = input;
  const facts = input.facts || [];
  const now = input.now ?? Date.now();
  const triggers: CompanyBusinessTrigger[] = [];

  const boampEvidence = evidenceFor("boamp", company, enrichment, facts);
  for (const award of (enrichment.procurementAwards || []).slice(0, 6)) {
    const age = ageDays(award.publishedAt, now);
    if (age === null || age > 365) continue;
    triggers.push({
      id: `boamp:${award.id}`,
      type: "PUBLIC_CONTRACT_AWARD",
      label: "Marché public attribué",
      description: [award.object, award.buyer ? `Acheteur : ${award.buyer}` : undefined]
        .filter(Boolean)
        .join(" · "),
      direction: "positive",
      strength: clampStrength(recencyStrength(award.publishedAt, award.sirenMatched ? 78 : 70, now)),
      confidence: award.matchConfidence,
      occurredAt: award.publishedAt,
      source: boampEvidence,
      url: award.url,
    });
  }

  const hiring = enrichment.hiring;
  if (hiring?.hiringDetected) {
    const count = hiring.activeOpeningCount;
    const hiringEvidence = enrichment.evidence.find((item) => item.provider === "Selykai Career Discovery")
      || evidenceFor("selykai-engine", company, enrichment, facts);
    const countBoost = count ? Math.min(15, Math.round(Math.log2(count + 1) * 5)) : 0;
    triggers.push({
      id: `hiring:${company.siren}:${hiring.checkedAt.slice(0, 10)}`,
      type: "HIRING",
      label: count ? `${count} recrutement(s) visible(s)` : "Recrutement actif détecté",
      description: hiring.jobTitles.length
        ? `Postes visibles : ${hiring.jobTitles.slice(0, 4).join(" · ")}`
        : "Des offres ou liens de postes actifs sont visibles sur la surface carrière officielle.",
      direction: "positive",
      strength: clampStrength(66 + countBoost),
      confidence: hiringEvidence.confidence,
      occurredAt: hiring.latestPostedAt,
      source: hiringEvidence,
      url: hiring.careersUrl,
    });
  }

  const recentOpenings = company.establishments
    .filter((item) => item.active === true && item.createdAt && (ageDays(item.createdAt, now) ?? 9999) <= 365)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  if (recentOpenings.length) {
    const latest = recentOpenings[0];
    const rneEvidence = evidenceFor("inpi-rne", company, enrichment, facts);
    triggers.push({
      id: `establishment-opening:${recentOpenings.map((item) => item.siret || item.city).join("|")}`,
      type: "ESTABLISHMENT_OPENING",
      label: recentOpenings.length === 1 ? "Ouverture d’établissement récente" : `${recentOpenings.length} ouvertures récentes`,
      description: recentOpenings.slice(0, 4).map((item) => item.city || item.address || item.siret || "Établissement").join(" · "),
      direction: "positive",
      strength: clampStrength(68 + Math.min(16, recentOpenings.length * 4)),
      confidence: rneEvidence.confidence,
      occurredAt: latest.createdAt,
      source: rneEvidence,
    });
  }

  const recentClosures = company.establishments
    .filter((item) => item.active === false && item.closedAt && (ageDays(item.closedAt, now) ?? 9999) <= 365)
    .sort((a, b) => new Date(b.closedAt || 0).getTime() - new Date(a.closedAt || 0).getTime());
  if (recentClosures.length) {
    const latest = recentClosures[0];
    const rneEvidence = evidenceFor("inpi-rne", company, enrichment, facts);
    triggers.push({
      id: `establishment-closing:${recentClosures.map((item) => item.siret || item.city).join("|")}`,
      type: "ESTABLISHMENT_CLOSURE",
      label: recentClosures.length === 1 ? "Fermeture d’établissement récente" : `${recentClosures.length} fermetures récentes`,
      description: recentClosures.slice(0, 4).map((item) => item.city || item.address || item.siret || "Établissement").join(" · "),
      direction: "negative",
      strength: clampStrength(62 + Math.min(18, recentClosures.length * 4)),
      confidence: rneEvidence.confidence,
      occurredAt: latest.closedAt,
      source: rneEvidence,
    });
  }

  const financial = financialInsight(company.rawFinancials);
  if (financial.revenueGrowthPercent !== undefined && financial.revenueGrowthPercent >= 10) {
    const source = company.evidence[0] || evidenceFor("recherche-entreprises", company, enrichment, facts);
    triggers.push({
      id: `financial-growth:${company.siren}:${financial.year || "latest"}`,
      type: "FINANCIAL_GROWTH",
      label: "Croissance du chiffre d’affaires",
      description: `CA en hausse de ${financial.revenueGrowthPercent.toFixed(1)} % sur le dernier exercice comparable.`,
      direction: "positive",
      strength: clampStrength(62 + Math.min(25, financial.revenueGrowthPercent * 0.8)),
      confidence: source.confidence,
      source,
    });
  } else if (financial.revenueGrowthPercent !== undefined && financial.revenueGrowthPercent <= -10) {
    const source = company.evidence[0] || evidenceFor("recherche-entreprises", company, enrichment, facts);
    triggers.push({
      id: `financial-contraction:${company.siren}:${financial.year || "latest"}`,
      type: "FINANCIAL_CONTRACTION",
      label: "Recul du chiffre d’affaires",
      description: `CA en baisse de ${Math.abs(financial.revenueGrowthPercent).toFixed(1)} % sur le dernier exercice comparable.`,
      direction: "negative",
      strength: clampStrength(58 + Math.min(28, Math.abs(financial.revenueGrowthPercent) * 0.7)),
      confidence: source.confidence,
      source,
    });
  }

  const bodaccEvidence = evidenceFor("bodacc", company, enrichment, facts);
  for (const event of enrichment.legalEvents.filter((item) => isCommercialMomentumLegalEvent(item, now)).slice(0, 4)) {
    triggers.push({
      id: `bodacc:${event.id}`,
      type: "LEGAL_CHANGE",
      label: event.title || event.family,
      description: event.description || event.family,
      direction: "neutral",
      strength: clampStrength(recencyStrength(event.date, legalStrength(`${event.family} ${event.title} ${event.description || ""}`), now)),
      confidence: bodaccEvidence.confidence,
      occurredAt: event.date,
      source: bodaccEvidence,
      url: event.url,
    });
  }

  const newsEvidence = enrichment.evidence.find((item) => item.providerId === "apilayer");
  if (newsEvidence) {
    for (const item of enrichment.news.slice(0, 3)) {
      const age = ageDays(item.publishedAt, now);
      if (age !== null && age > 120) continue;
      triggers.push({
        id: `news:${item.url}`,
        type: "NEWS",
        label: item.title,
        description: item.description || `Actualité publiée par ${item.source || "une source web"}.`,
        direction: "neutral",
        strength: clampStrength(recencyStrength(item.publishedAt, 50, now)),
        confidence: newsEvidence.confidence,
        occurredAt: item.publishedAt,
        source: newsEvidence,
        url: item.url,
      });
    }
  }

  const unique = new Map<string, CompanyBusinessTrigger>();
  for (const trigger of triggers) {
    const current = unique.get(trigger.id);
    if (!current || trigger.confidence > current.confidence) unique.set(trigger.id, trigger);
  }
  return Array.from(unique.values()).sort(triggerSort).slice(0, 16);
}
