import { createHash } from "node:crypto";
import { analyzeCompany } from "@/lib/intelligence/company-engine";
import {
  createIntelligenceAlert,
  listDueMonitoringTargets,
  markMonitoringTargetChecked,
} from "@/lib/persistence/watchlist-repository";
import type { CommercialActionPolicy, CompanyEvent } from "@/types/intelligence";
import type { AlertSeverity, MonitoringTarget } from "@/types/workspace";

export interface MonitoringBatchResult {
  targets: number;
  companies: number;
  analyzed: number;
  alertsCreated: number;
  failures: Array<{ siren: string; message: string }>;
}

function baseSeverity(event: CompanyEvent): AlertSeverity {
  switch (event.type) {
    case "COMMERCIAL_REUSE_CHANGE":
    case "ESTABLISHMENT_OPENING":
    case "ESTABLISHMENT_GROWTH":
    case "PUBLIC_CONTRACT_AWARD":
    case "ACTIVITY_CHANGE":
      return "high";
    case "ESTABLISHMENT_CLOSURE":
    case "HIRING_ACTIVITY_CHANGE":
    case "FINANCIAL_CHANGE":
    case "HEAD_OFFICE_MOVE":
    case "GOVERNANCE_CHANGE":
    case "EMPLOYER_STATUS_CHANGE":
    case "BODACC_ACTIVITY":
      return "medium";
    default:
      return "info";
  }
}

export function monitoringAlertPresentation(
  event: CompanyEvent,
  policy: CommercialActionPolicy,
): { title: string; body: string; severity: AlertSeverity } {
  const policyEvent = event.type === "COMMERCIAL_REUSE_CHANGE";
  const severity = policyEvent
    ? policy.status === "blocked"
      ? "high"
      : "medium"
    : baseSeverity(event);

  if (policy.status === "allowed") {
    return {
      title: event.title,
      body: event.description,
      severity,
    };
  }

  const guard = policy.status === "blocked"
    ? "Cadre d’action : veille uniquement. Le RNE indique une opposition à la réutilisation commerciale ; aucune sollicitation ni enrichissement de contacts ne doit être déclenché."
    : "Cadre d’action : veille uniquement tant que le statut de réutilisation commerciale n’est pas confirmé. Aucune sollicitation ni enrichissement de contacts ne doit être déclenché.";

  return {
    title: policyEvent ? event.title : `Veille · ${event.title}`,
    body: `${event.description}\n\n${guard}`,
    severity,
  };
}

function dedupeKey(target: MonitoringTarget, event: CompanyEvent): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        watchlistId: target.watchlistId,
        companyId: target.companyId,
        type: event.type,
        description: event.description,
        evidenceKeys: [...event.evidenceKeys].sort(),
      }),
    )
    .digest("hex");
}

export async function runMonitoringBatch(limit = 20): Promise<MonitoringBatchResult> {
  const targets = await listDueMonitoringTargets(limit);
  const grouped = new Map<string, MonitoringTarget[]>();

  for (const target of targets) {
    const current = grouped.get(target.siren) || [];
    current.push(target);
    grouped.set(target.siren, current);
  }

  const result: MonitoringBatchResult = {
    targets: targets.length,
    companies: grouped.size,
    analyzed: 0,
    alertsCreated: 0,
    failures: [],
  };

  // Sequential by design: protects provider rate limits and keeps scheduled runs predictable.
  for (const [siren, companyTargets] of grouped) {
    try {
      const analysis = await analyzeCompany(siren, { persist: true });
      if (!analysis) throw new Error("Entreprise introuvable pendant la surveillance.");
      result.analyzed += 1;

      for (const target of companyTargets) {
        for (const event of analysis.events) {
          const presentation = monitoringAlertPresentation(event, analysis.commercialAction);
          const created = await createIntelligenceAlert({
            workspaceId: target.workspaceId,
            watchlistId: target.watchlistId,
            companyId: target.companyId,
            type: event.type,
            severity: presentation.severity,
            title: presentation.title,
            body: presentation.body,
            dedupeKey: dedupeKey(target, event),
          });
          if (created) result.alertsCreated += 1;
        }

        await markMonitoringTargetChecked(target);
      }
    } catch (error) {
      result.failures.push({
        siren,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return result;
}
