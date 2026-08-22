"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/server";
import { analyzeCompany } from "@/lib/intelligence/company-engine";
import {
  archiveAlert,
  markAlertRead,
  markAllWorkspaceAlertsRead,
} from "@/lib/persistence/alert-repository";
import {
  addCompanyToWatchlist,
  createWatchlist,
} from "@/lib/persistence/watchlist-repository";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireUserId(): Promise<string> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Authentication required.");
  return userId;
}

function requireUuid(value: FormDataEntryValue | null, label: string): string {
  const id = String(value || "");
  if (!UUID_PATTERN.test(id)) throw new Error(`${label} invalide.`);
  return id;
}

export async function createWatchlistAction(formData: FormData) {
  const userId = await requireUserId();
  const workspaceId = String(formData.get("workspaceId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!workspaceId || !name) throw new Error("Workspace et nom requis.");

  await createWatchlist({ userId, workspaceId, name });
  revalidatePath("/workspace");
}

export async function addCompanyToWatchlistAction(formData: FormData) {
  const userId = await requireUserId();
  const watchlistId = String(formData.get("watchlistId") || "");
  const siren = String(formData.get("siren") || "").replace(/\D/g, "");
  const frequencyValue = String(formData.get("frequency") || "daily");
  const frequency = frequencyValue === "weekly" || frequencyValue === "manual" ? frequencyValue : "daily";

  if (!watchlistId || !/^\d{9}$/.test(siren)) throw new Error("SIREN invalide ou watchlist absente.");

  // Analyze first so the canonical company exists in the shared intelligence layer.
  const analysis = await analyzeCompany(siren, { persist: true });
  if (!analysis) throw new Error("Entreprise introuvable.");

  const added = await addCompanyToWatchlist({ userId, watchlistId, siren, frequency });
  if (!added) throw new Error("Impossible d’ajouter cette entreprise à la watchlist.");
  revalidatePath("/workspace");
  revalidatePath(`/company/${siren}`);
}

export async function markAlertReadAction(formData: FormData) {
  const userId = await requireUserId();
  const alertId = requireUuid(formData.get("alertId"), "Alerte");
  await markAlertRead({ userId, alertId });
  revalidatePath("/workspace");
}

export async function archiveAlertAction(formData: FormData) {
  const userId = await requireUserId();
  const alertId = requireUuid(formData.get("alertId"), "Alerte");
  await archiveAlert({ userId, alertId });
  revalidatePath("/workspace");
}

export async function markAllAlertsReadAction(formData: FormData) {
  const userId = await requireUserId();
  const workspaceId = requireUuid(formData.get("workspaceId"), "Workspace");
  await markAllWorkspaceAlertsRead({ userId, workspaceId });
  revalidatePath("/workspace");
}
