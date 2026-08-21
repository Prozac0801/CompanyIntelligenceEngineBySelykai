import type { CompanyEvent, CompanySignal } from "@/types/intelligence";

export function inferSignals(events: CompanyEvent[]): CompanySignal[] {
  const signals: CompanySignal[] = [];
  const types = new Set(events.map((event) => event.type));

  const expansionEventTypes: CompanyEvent["type"][] = ["ESTABLISHMENT_GROWTH", "ESTABLISHMENT_OPENING"];
  const expansionEvidence = expansionEventTypes.filter((type) => types.has(type));
  if (expansionEvidence.length) {
    signals.push({
      type: "EXPANSION",
      label: "Expansion multi-sites détectée",
      strength: types.has("ESTABLISHMENT_OPENING") ? 84 : 75,
      reason: types.has("ESTABLISHMENT_OPENING")
        ? "Un ou plusieurs nouveaux SIRET actifs sont apparus depuis la précédente observation."
        : "Une hausse factuelle du nombre d’établissements ouverts a été observée.",
      evidenceEventTypes: expansionEvidence,
    });
  }

  if (types.has("ESTABLISHMENT_CLOSURE")) {
    signals.push({
      type: "CONTRACTION",
      label: "Contraction d’implantation détectée",
      strength: 72,
      reason: "Un ou plusieurs SIRET précédemment actifs ne figurent plus parmi les établissements ouverts.",
      evidenceEventTypes: ["ESTABLISHMENT_CLOSURE"],
    });
  }

  if (types.has("PUBLIC_CONTRACT_AWARD")) {
    signals.push({
      type: "PROCUREMENT",
      label: "Nouveau marché public attribué",
      strength: 88,
      reason: "Une nouvelle attribution BOAMP a été observée depuis la précédente analyse.",
      evidenceEventTypes: ["PUBLIC_CONTRACT_AWARD"],
    });
  }

  if (types.has("HIRING_ACTIVITY_CHANGE")) {
    signals.push({
      type: "HIRING",
      label: "Dynamique de recrutement",
      strength: 82,
      reason: "La surface carrière officielle présente une activité de recrutement nouvelle ou en hausse.",
      evidenceEventTypes: ["HIRING_ACTIVITY_CHANGE"],
    });
  }

  const structuralTypes: CompanyEvent["type"][] = [
    "HEAD_OFFICE_MOVE",
    "GOVERNANCE_CHANGE",
    "ACTIVITY_CHANGE",
    "FINANCIAL_CHANGE",
  ];
  const evidenceEventTypes = structuralTypes.filter((type) => types.has(type));

  if (evidenceEventTypes.length > 0) {
    signals.push({
      type: "CHANGE",
      label: "Entreprise en mouvement",
      strength: Math.min(82, 45 + evidenceEventTypes.length * 10),
      reason: "Un ou plusieurs changements structurels ou financiers récents ont été observés.",
      evidenceEventTypes,
    });
  }

  if (types.has("BODACC_ACTIVITY")) {
    signals.push({
      type: "CHANGE",
      label: "Activité juridique récente",
      strength: 60,
      reason: "Une nouvelle annonce BODACC est apparue depuis la précédente observation.",
      evidenceEventTypes: ["BODACC_ACTIVITY"],
    });
  }

  return signals;
}
