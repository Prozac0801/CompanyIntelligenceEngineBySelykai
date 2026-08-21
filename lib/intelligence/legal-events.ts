import type { CompanyLegalEvent } from "@/types/company";

const DAY_MS = 24 * 60 * 60 * 1000;

export function legalEventAgeDays(event: CompanyLegalEvent, now = Date.now()): number | null {
  const timestamp = new Date(event.date).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (now - timestamp) / DAY_MS);
}

export function isRecentLegalEvent(
  event: CompanyLegalEvent,
  days = 365,
  now = Date.now(),
): boolean {
  const age = legalEventAgeDays(event, now);
  return age !== null && age <= days;
}

export function isCommercialMomentumLegalEvent(
  event: CompanyLegalEvent,
  now = Date.now(),
): boolean {
  if (!isRecentLegalEvent(event, 180, now)) return false;
  if (event.risk === "critical" || event.risk === "warning") return false;

  const value = `${event.family} ${event.title} ${event.description || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");

  // Routine account filings are useful evidence but are not growth triggers on their own.
  if (/depot.*compt|comptes annuels|depot des comptes/.test(value)) return false;

  return (
    event.risk === "positive" ||
    /creation|immatriculation|nouvel etablissement|modification|transfert|cession|vente|achat|fusion|augmentation de capital/.test(value)
  );
}

export function hasRecentCriticalLegalEvent(
  events: CompanyLegalEvent[],
  now = Date.now(),
): boolean {
  return events.some((event) => event.risk === "critical" && isRecentLegalEvent(event, 365, now));
}
