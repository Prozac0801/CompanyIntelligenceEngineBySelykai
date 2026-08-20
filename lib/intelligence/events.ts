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

  const establishments = changed(previous, current, "open_establishment_count");
  if (
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

  return events;
}
