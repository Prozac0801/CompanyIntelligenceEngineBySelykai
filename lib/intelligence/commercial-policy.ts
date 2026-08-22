import type { CompanyIntelligenceSummary, ExplainableScore } from "@/types/company";
import type { CommercialActionPolicy } from "@/types/intelligence";

function policyEvidence(policy: CommercialActionPolicy): string {
  if (policy.status === "blocked") {
    return "Joignabilité technique uniquement : une opposition RNE interdit d’en déduire une autorisation de prospection.";
  }
  if (policy.status === "unknown") {
    return "Joignabilité technique uniquement : le statut de réutilisation commerciale n’est pas confirmé.";
  }
  return "Joignabilité technique distincte de l’autorisation de prospection ; le cadre RNE est évalué séparément.";
}

export function applyCommercialActionPolicyToScore(
  score: ExplainableScore,
  policy: CommercialActionPolicy,
): ExplainableScore {
  const subscores = score.subscores.map((subscore) =>
    subscore.id === "access"
      ? {
          ...subscore,
          label: "Joignabilité",
          evidence: Array.from(new Set([...subscore.evidence, policyEvidence(policy)])),
        }
      : subscore,
  );

  if (policy.status === "allowed") {
    return {
      ...score,
      subscores,
      basis: {
        ...score.basis,
        description: `${score.basis.description} La joignabilité reste distincte de l’autorisation de prospection.`,
      },
    };
  }

  const blocked = policy.status === "blocked";
  return {
    ...score,
    label: blocked
      ? "Veille uniquement — prospection bloquée"
      : "Veille uniquement — statut de prospection non confirmé",
    opportunity: {
      status: blocked ? "watch" : "not-determined",
      reason: blocked
        ? "Veille uniquement : le RNE indique une opposition à la réutilisation commerciale. Les signaux restent informatifs mais ne doivent déclencher aucune sollicitation ni enrichissement de contacts."
        : "Le statut de réutilisation commerciale n’est pas confirmé. Les signaux peuvent être suivis, mais aucune action de prospection ou d’enrichissement de contacts ne doit être déclenchée.",
    },
    subscores,
    basis: {
      ...score.basis,
      description: `${score.basis.description} La joignabilité mesure uniquement la capacité technique à identifier des canaux publics ; elle ne vaut jamais autorisation de prospection.`,
    },
  };
}

export function applyCommercialActionPolicyToSummary(
  summary: CompanyIntelligenceSummary,
  policy: CommercialActionPolicy,
): CompanyIntelligenceSummary {
  if (policy.status === "allowed") return summary;

  const blocked = policy.status === "blocked";
  const policyWarning = blocked
    ? "Opposition RNE à la réutilisation commerciale : veille uniquement"
    : "Statut de réutilisation commerciale non confirmé : aucune prospection à déclencher";

  return {
    ...summary,
    vigilance: Array.from(new Set([policyWarning, ...summary.vigilance])).slice(0, 4),
    nextBestAction: blocked
      ? "Veille uniquement. Ne déclencher ni prospection, ni révélation de contacts, ni sollicitation commerciale tant que l’opposition RNE reste active."
      : "Continuer la veille sans enrichissement de contacts ni sollicitation commerciale jusqu’à confirmation explicite du statut de réutilisation.",
  };
}
