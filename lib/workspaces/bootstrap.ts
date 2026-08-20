import { createHash } from "node:crypto";
import {
  createWatchlist,
  createWorkspaceForUser,
  listUserWorkspaces,
  listWatchlists,
} from "@/lib/persistence/watchlist-repository";
import type { Watchlist, Workspace } from "@/types/workspace";

function personalSlug(userId: string): string {
  const suffix = createHash("sha256").update(userId).digest("hex").slice(0, 12);
  return `personal-${suffix}`;
}

export async function ensurePersonalWorkspace(input: {
  userId: string;
  userName?: string | null;
}): Promise<{ workspace: Workspace; watchlists: Watchlist[] }> {
  let workspaces = await listUserWorkspaces(input.userId);
  let workspace = workspaces[0];

  if (!workspace) {
    workspace = await createWorkspaceForUser({
      userId: input.userId,
      name: input.userName?.trim() ? `Espace de ${input.userName.trim()}` : "Mon espace Intelligence",
      slug: personalSlug(input.userId),
    });
    workspaces = [workspace];
  }

  let watchlists = await listWatchlists(input.userId, workspace.id);
  if (watchlists.length === 0) {
    const defaultWatchlist = await createWatchlist({
      userId: input.userId,
      workspaceId: workspace.id,
      name: "À surveiller",
      description: "Entreprises suivies automatiquement par Selykai Company Intelligence Engine.",
    });
    watchlists = [defaultWatchlist];
  }

  return { workspace, watchlists };
}
