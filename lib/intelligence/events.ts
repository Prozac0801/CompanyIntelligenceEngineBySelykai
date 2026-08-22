import type { CompanyEvent, CompanyFact } from "@/types/intelligence";

function equalValue(a: CompanyFact["value"], b: CompanyFact["value"]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function changed(previous: Map<string, CompanyFact>, current: Map<string, CompanyFact>, key: string) {
  const before = previous.get(key);
  const after = current.get(key);
  if (!before || !after || equalValue(before.value, after.value)) return null;
  return { before, after };
}

function stringList(value: CompanyFact["value"]): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberValue(value: CompanyFact["value"]): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function listDelta(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const previous = new Set(before);
  const current = new Set(after);
  return {
    added: after.filter((value) => !previous.has(value)),
    removed: before.filter((value) => !current.has(value)),
  };
}

function formatAmount(value: number | undefined): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function commercialReuseStatus(fact: CompanyFact): "allowed" | "blocked" | "unknown" {
  if (fact.value === true) return "allowed";
  if (fact.value === false) return "blocked";
  return "unknown";
}

function commercialReuseLabel(status: "allowed" | "blocked" | "unknown"): string {
  if (status === "allowed") return "autorisé sans opposition RNE détectée";
  if (status === "blocked") return "bloqué par opposition RNE";
  return "non confirmé";
}

export function detectCompanyEvents(
  previous: Map<string, CompanyFact>,
  current: Map<string, CompanyFact>,
): CompanyEvent[] {
  if (previous.size === 0) return [];

  const events: CompanyEvent[] = [];
  const now = new Date().toISOString();
  const address = changed(previous, current, "head_office_address");

  if (address) {
    events.push({
      type: "HEAD_OFFICE_MOVE",
      title: "Changement d’adresse du siège",
      description: `Adresse observée : ${String(address.before.value || "—")} → ${String(address.after.value || "—")}`,
      observedAt: now,
      confidence: address.after.evidence.confidence,
      evidenceKeys: ["head_office_address"],
    });
  }

  const naf = changed(previous, current, "naf_code");
  if (naf) {
    events.push({
      type: "ACTIVITY_CHANGE",
      title: "Activité principale modifiée",
      description: `Code NAF observé : ${String(naf.before.value || "—")} → ${String(naf.after.value || "—")}`,
      observedAt: now,
      confidence: naf.after.evidence.confidence,
      evidenceKeys: ["naf_code"],
    });
  }

  const employer = changed(previous, current, "employer");
  if (employer) {
    events.push({
      type: "EMPLOYER_STATUS_CHANGE",
      title: "Statut employeur modifié",
      description: `Caractère employeur : ${String(employer.before.value)} → ${String(employer.after.value)}`,
      observedAt: now,
      confidence: employer.after.evidence.confidence,
      evidenceKeys: ["employer"],
    });
  }

  const previousReuseFact = previous.get("commercial_prospecting_allowed");
  const currentReuseFact = current.get("commercial_prospecting_allowed");
  if (previousReuseFact && currentReuseFact) {
    const previousReuse = commercialReuseStatus(previousReuseFact);
    const currentReuse = commercialReuseStatus(currentReuseFact);
    if (previousReuse !== currentReuse) {
      const title = currentReuse === "blocked"
        ? "Réutilisation commerciale désormais bloquée"
        : currentReuse === "allowed"
          ? "Opposition RNE à la réutilisation commerciale levée"
          : "Statut de réutilisation commerciale devenu indéterminé";
      events.push({
        type: "COMMERCIAL_REUSE_CHANGE",
        title,
        description: `Cadre RNE : ${commercialReuseLabel(previousReuse)} → ${commercialReuseLabel(currentReuse)}. La plateforme adapte immédiatement les actions disponibles à ce statut.`,
        observedAt: now,
        confidence: currentReuseFact.evidence.confidence,
        evidenceKeys: ["commercial_prospecting_allowed"],
      });
    }
  }

  const activeEstablishments = changed(previous, current, "active_establishment_sirets");
  let preciseEstablishmentChange = false;
  if (activeEstablishments) {
    const delta = listDelta(
      stringList(activeEstablishments.before.value),
      stringList(activeEstablishments.after.value),
    );
    if (delta.added.length) {
      preciseEstablishmentChange = true;
      events.push({
        type: "ESTABLISHMENT_OPENING",
        title: delta.added.length === 1 ? "Nouvel établissement ouvert" : "Nouveaux établissements ouverts",
        description: `${delta.added.length} nouveau(x) SIRET actif(s) : ${delta.added.slice(0, 8).join(", ")}`,
        observedAt: now,
        confidence: activeEstablishments.after.evidence.confidence,
        evidenceKeys: ["active_establishment_sirets", "open_establishment_count"],
      });
    }
    if (delta.removed.length) {
      preciseEstablishmentChange = true;
      events.push({
        type: "ESTABLISHMENT_CLOSURE",
        title: delta.removed.length === 1 ? "Fermeture d’établissement détectée" : "Fermetures d’établissements détectées",
        description: `${delta.removed.length} SIRET(s) ne figurent plus parmi les établissements actifs : ${delta.removed.slice(0, 8).join(", ")}`,
        observedAt: now,
        confidence: activeEstablishments.after.evidence.confidence,
        evidenceKeys: ["active_establishment_sirets", "open_establishment_count"],
      });
    }
  }

  const establishments = changed(previous, current, "open_establishment_count");
  if (
    !preciseEstablishmentChange &&
    establishments &&
    typeof establishments.before.value === "number" &&
    typeof establishments.after.value === "number" &&
    establishments.after.value > establishments.before.value
  ) {
    events.push({
      type: "ESTABLISHMENT_GROWTH",
      title: "Hausse du nombre d’établissements ouverts",
      description: `${establishments.before.value} → ${establishments.after.value} établissements ouverts`,
      observedAt: now,
      confidence: establishments.after.evidence.confidence,
      evidenceKeys: ["open_establishment_count"],
    });
  }

  const executives = changed(previous, current, "executive_names");
  if (executives) {
    events.push({
      type: "GOVERNANCE_CHANGE",
      title: "Gouvernance modifiée",
      description: "La liste publique des dirigeants a changé depuis la précédente observation.",
      observedAt: now,
      confidence: executives.after.evidence.confidence,
      evidenceKeys: ["executive_names"],
    });
  }

  const bodacc = changed(previous, current, "bodacc_latest_event_id");
  if (bodacc && bodacc.after.value) {
    const family = current.get("bodacc_latest_family")?.value;
    events.push({
      type: "BODACC_ACTIVITY",
      title: "Nouvelle annonce BODACC détectée",
      description: family ? `Nouvel événement officiel : ${String(family)}` : "Une nouvelle annonce officielle BODACC est apparue.",
      observedAt: now,
      confidence: bodacc.after.evidence.confidence,
      evidenceKeys: ["bodacc_latest_event_id", "bodacc_latest_family"],
    });
  }

  const procurement = changed(previous, current, "boamp_latest_award_id");
  if (procurement && procurement.after.value) {
    const date = current.get("boamp_latest_award_date")?.value;
    events.push({
      type: "PUBLIC_CONTRACT_AWARD",
      title: "Nouvelle attribution BOAMP détectée",
      description: date ? `Une nouvelle attribution de marché public a été observée (${String(date)}).` : "Une nouvelle attribution de marché public a été observée.",
      observedAt: now,
      confidence: procurement.after.evidence.confidence,
      evidenceKeys: ["boamp_latest_award_id", "boamp_latest_award_date"],
    });
  }

  const hiringDetected = changed(previous, current, "hiring_detected");
  const hiringCount = changed(previous, current, "hiring_opening_count");
  const hiringActivated = hiringDetected?.before.value === false && hiringDetected.after.value === true;
  const beforeHiringCount = hiringCount ? numberValue(hiringCount.before.value) : undefined;
  const afterHiringCount = hiringCount ? numberValue(hiringCount.after.value) : undefined;
  const hiringGrowth = beforeHiringCount !== undefined && afterHiringCount !== undefined && afterHiringCount > beforeHiringCount;
  if (hiringActivated || hiringGrowth) {
    const after = hiringDetected?.after || hiringCount?.after;
    if (after) {
      events.push({
        type: "HIRING_ACTIVITY_CHANGE",
        title: hiringActivated ? "Recrutement actif détecté" : "Hausse des recrutements visibles",
        description: hiringGrowth
          ? `${beforeHiringCount} → ${afterHiringCount} ouverture(s) détectée(s) sur la surface carrière officielle.`
          : "La surface carrière officielle présente désormais des recrutements actifs.",
        observedAt: now,
        confidence: after.evidence.confidence,
        evidenceKeys: ["hiring_detected", "hiring_opening_count", "hiring_job_titles"],
      });
    }
  }

  const latestYear = changed(previous, current, "financial_latest_year");
  const revenue = changed(previous, current, "financial_revenue");
  if ((latestYear || revenue) && current.get("financial_revenue")) {
    const beforeRevenue = revenue ? numberValue(revenue.before.value) : numberValue(previous.get("financial_revenue")?.value ?? null);
    const afterRevenue = numberValue(current.get("financial_revenue")?.value ?? null);
    const growth = numberValue(current.get("financial_revenue_growth_percent")?.value ?? null);
    const after = revenue?.after || latestYear?.after || current.get("financial_revenue");
    if (after) {
      events.push({
        type: "FINANCIAL_CHANGE",
        title: "Nouvel exercice financier observé",
        description: `Chiffre d’affaires : ${formatAmount(beforeRevenue)} → ${formatAmount(afterRevenue)}${growth !== undefined ? ` · variation ${growth >= 0 ? "+" : ""}${growth.toFixed(1)} %` : ""}`,
        observedAt: now,
        confidence: after.evidence.confidence,
        evidenceKeys: ["financial_latest_year", "financial_revenue", "financial_revenue_growth_percent"],
      });
    }
  }

  return events;
}
