import type { Watchlist } from "@/types/workspace";

export function resolveActiveWatchlist(
  watchlists: Watchlist[],
  requestedId?: string,
): Watchlist | undefined {
  if (!watchlists.length) return undefined;
  if (!requestedId) return watchlists[0];
  return watchlists.find((watchlist) => watchlist.id === requestedId) || watchlists[0];
}
