import type { CompanyEvent, CompanySignal } from "@/types/intelligence";

export function inferSignals(events: CompanyEvent[]): CompanySignal[] {
  const signals: CompanySignal[] = [];
  const types = new Set(events.map((event) => event.type));

  if (types.has("ESTABLISHMENT_GROWTH")) {
    signals.push({
      type: "EXPANSION",
      label: "Expansion possible",
      strength: 75,
      reason: "Une hausse factuelle du nombre d’établissements ouverts a été observée.",
      evidenceEventTypes: ["ESTABLISHMENT_GROWTH"],
    });
  }

  const structuralTypes: CompanyEvent["type"][] = [
    "HEAD_OFFICE_MOVE",
    "GOVERNANCE_CHANGE",
    "ACTIVITY_CHANGE",
  ];
  const evidenceEventTypes = structuralTypes.filter((type) => types.has(type));

  if (evidenceEventTypes.length > 0) {
    signals.push({
      type: "CHANGE",
      label: "Entreprise en mouvement",
      strength: Math.min(80, 45 + evidenceEventTypes.length * 10),
      reason: "Un ou plusieurs changements structurels récents ont été observés.",
      evidenceEventTypes,
    });
  }

  return signals;
}
