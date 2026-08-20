"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/server";
import { analyzeCompany } from "@/lib/intelligence/company-engine";
import {
  addCompanyToWatchlist,
  createWatchlist,
} from "@/lib/persistence/watchlist-repository";

async function requireUserId(): Promise<string> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Authentication required.");
  return userId;
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
