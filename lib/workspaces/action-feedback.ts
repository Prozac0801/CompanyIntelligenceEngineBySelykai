export type WorkspaceFeedbackCode =
  | "invalid_siren"
  | "company_not_found"
  | "invalid_watchlist"
  | "watchlist_add_failed";

const WORKSPACE_FEEDBACK: Record<WorkspaceFeedbackCode, string> = {
  invalid_siren: "Le SIREN doit contenir exactement 9 chiffres.",
  company_not_found: "Entreprise introuvable dans la source officielle.",
  invalid_watchlist: "La liste de veille sélectionnée n’est pas valide.",
  watchlist_add_failed: "Impossible d’ajouter cette entreprise à cette liste de veille.",
};

export function workspaceFeedbackCode(value: unknown): WorkspaceFeedbackCode | undefined {
  if (typeof value !== "string") return undefined;
  return Object.prototype.hasOwnProperty.call(WORKSPACE_FEEDBACK, value)
    ? value as WorkspaceFeedbackCode
    : undefined;
}

export function workspaceFeedbackMessage(value: unknown): string | undefined {
  const code = workspaceFeedbackCode(value);
  return code ? WORKSPACE_FEEDBACK[code] : undefined;
}

export function workspaceFeedbackPath(input: {
  error: WorkspaceFeedbackCode;
  watchlistId?: string;
}): string {
  const params = new URLSearchParams();
  if (input.watchlistId) params.set("watchlist", input.watchlistId);
  params.set("error", input.error);
  return `/workspace?${params.toString()}`;
}
