"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, isAuthConfigured } from "@/lib/auth/server";
import { analyzeCompany } from "@/lib/intelligence/company-engine";
import { addCompanyToWatchlist } from "@/lib/persistence/watchlist-repository";
import type { MonitorFrequency } from "@/types/workspace";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function monitorFrequency(value: FormDataEntryValue | null): MonitorFrequency {
  const frequency = String(value || "daily");
  if (frequency === "weekly" || frequency === "manual") return frequency;
  return "daily";
}

export async function watchCompanyAction(formData: FormData) {
  const siren = String(formData.get("siren") || "").replace(/\D/g, "");
  const watchlistId = String(formData.get("watchlistId") || "");

  if (!/^\d{9}$/.test(siren)) throw new Error("SIREN invalide.");
  if (!UUID_PATTERN.test(watchlistId)) throw new Error("Watchlist invalide.");

  if (!isAuthConfigured()) throw new Error("Authentification non configurée.");
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect(`/auth/sign-in?returnTo=${encodeURIComponent(`/company/${siren}`)}`);
  }

  const analysis = await analyzeCompany(siren, { persist: true });
  if (!analysis) throw new Error("Entreprise introuvable.");

  const added = await addCompanyToWatchlist({
    userId,
    watchlistId,
    siren,
    frequency: monitorFrequency(formData.get("frequency")),
  });
  if (!added) throw new Error("Impossible d’ajouter cette entreprise à cette watchlist.");

  revalidatePath("/workspace");
  revalidatePath(`/company/${siren}`);
}
