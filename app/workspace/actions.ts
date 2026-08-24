"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { bootstrapCompany } from "@/lib/intelligence/bootstrap-company";
import {
  archiveAlert,
  markAlertRead,
  markAllWorkspaceAlertsRead,
} from "@/lib/persistence/alert-repository";
import {
  addCompanyToWatchlist,
  createWatchlist,
} from "@/lib/persistence/watchlist-repository";
import { workspaceFeedbackPath } from "@/lib/workspaces/action-feedback";

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
  const workspaceId = requireUuid(formData.get("workspaceId"), "Workspace");
  const name = String(formData.get("name") || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!name) throw new Error("Nom de liste requis.");

  const watchlist = await createWatchlist({ userId, workspaceId, name });
  revalidatePath("/workspace");
  redirect(`/workspace?watchlist=${watchlist.id}`);
}

export async function addCompanyToWatchlistAction(formData: FormData) {
  const userId = await requireUserId();
  const rawWatchlistId = String(formData.get("watchlistId") || "");
  if (!UUID_PATTERN.test(rawWatchlistId)) {
    redirect(workspaceFeedbackPath({ error: "invalid_watchlist" }));
  }
  const watchlistId = rawWatchlistId;
  const siren = String(formData.get("siren") || "").replace(/\D/g, "");
  const frequencyValue = String(formData.get("frequency") || "daily");
  const frequency = frequencyValue === "weekly" || frequencyValue === "manual" ? frequencyValue : "daily";

  if (!/^\d{9}$/.test(siren)) {
    redirect(workspaceFeedbackPath({ error: "invalid_siren", watchlistId }));
  }

  const company = await bootstrapCompany(siren);
  if (!company) {
    redirect(workspaceFeedbackPath({ error: "company_not_found", watchlistId }));
  }

  const added = await addCompanyToWatchlist({ userId, watchlistId, siren, frequency });
  if (!added) {
    redirect(workspaceFeedbackPath({ error: "watchlist_add_failed", watchlistId }));
  }
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
