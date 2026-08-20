import { createHash } from "node:crypto";
import { analyzeCompany } from "@/lib/intelligence/company-engine";
import {
  createIntelligenceAlert,
  listDueMonitoringTargets,
  markMonitoringTargetChecked,
} from "@/lib/persistence/watchlist-repository";
import type { CompanyEvent } from "@/types/intelligence";
import type { AlertSeverity, MonitoringTarget } from "@/types/workspace";

export interface MonitoringBatchResult {
  targets: number;
  companies: number;
  analyzed: number;
  alertsCreated: number;
  failures: Array<{ siren: string; message: string }>;
}

function severity(event: CompanyEvent): AlertSeverity {
  switch (event.type) {
    case "ESTABLISHMENT_GROWTH":
    case "ACTIVITY_CHANGE":
      return "high";
    case "HEAD_OFFICE_MOVE":
    case "GOVERNANCE_CHANGE":
    case "EMPLOYER_STATUS_CHANGE":
      return "medium";
    default:
      return "info";
  }
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

  // Sequential by design for V0.3: protects public-provider rate limits and makes runs predictable.
  for (const [siren, companyTargets] of grouped) {
    try {
      const analysis = await analyzeCompany(siren, { persist: true });
      if (!analysis) throw new Error("Entreprise introuvable pendant la surveillance.");
      result.analyzed += 1;

      for (const target of companyTargets) {
        for (const event of analysis.events) {
          const created = await createIntelligenceAlert({
            workspaceId: target.workspaceId,
            watchlistId: target.watchlistId,
            companyId: target.companyId,
            type: event.type,
            severity: severity(event),
            title: event.title,
            body: event.description,
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
