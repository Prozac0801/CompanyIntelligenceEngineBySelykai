import type { ReactNode } from "react";
import Link from "next/link";
import { ListPlus, LogIn, Radar } from "lucide-react";
import { auth, isAuthConfigured } from "@/lib/auth/server";
import { hasDatabase } from "@/lib/db";
import { listCompanyWatchMemberships } from "@/lib/persistence/company-watch-repository";
import {
  listUserWorkspaces,
  listWatchlists,
} from "@/lib/persistence/watchlist-repository";
import type { MonitorFrequency, Watchlist } from "@/types/workspace";
import { watchCompanyAction } from "./actions";
import styles from "./watch-dock.module.css";

interface WatchState {
  watchlists: Watchlist[];
  memberships: Array<{ watchlistId: string; monitorFrequency: MonitorFrequency }>;
}

async function readWatchState(userId: string, siren: string): Promise<WatchState> {
  if (!hasDatabase()) return { watchlists: [], memberships: [] };

  const workspaces = await listUserWorkspaces(userId);
  const workspace = workspaces[0];
  if (!workspace) return { watchlists: [], memberships: [] };

  const [watchlists, memberships] = await Promise.all([
    listWatchlists(userId, workspace.id),
    listCompanyWatchMemberships({ userId, workspaceId: workspace.id, siren }),
  ]);
  return { watchlists, memberships };
}

export default async function CompanyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ siren: string }>;
}) {
  const { siren } = await params;
  if (!/^\d{9}$/.test(siren)) return children;

  let userId: string | undefined;
  if (isAuthConfigured()) {
    try {
      const { data: session } = await auth.getSession();
      userId = session?.user?.id;
    } catch {
      // A transient auth-provider failure must never make the public company page unavailable.
    }
  }

  let watchState: WatchState = { watchlists: [], memberships: [] };
  if (userId) {
    try {
      watchState = await readWatchState(userId, siren);
    } catch {
      // Read-only watch context is optional on the public company page.
    }
  }

  const membershipIds = new Set(watchState.memberships.map((item) => item.watchlistId));
  const defaultWatchlist =
    watchState.watchlists.find((watchlist) => membershipIds.has(watchlist.id)) || watchState.watchlists[0];
  const defaultMembership = watchState.memberships.find(
    (item) => item.watchlistId === defaultWatchlist?.id,
  );
  const returnTo = `/company/${siren}`;

  return (
    <>
      {children}
      <aside className={styles.dock} aria-label="Mise sous veille de l’entreprise">
        <div className={styles.identity}>
          <span className={styles.icon}><Radar size={17} /></span>
          <div>
            <strong>Veille entreprise</strong>
            <small>
              {watchState.memberships.length
                ? `Déjà suivie dans ${watchState.memberships.length} liste${watchState.memberships.length > 1 ? "s" : ""}.`
                : "Recevoir les prochains changements réellement détectés."}
            </small>
          </div>
        </div>

        {!userId ? (
          <Link
            className={styles.primaryLink}
            href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
          >
            <LogIn size={15} /> Se connecter pour surveiller
          </Link>
        ) : !defaultWatchlist ? (
          <Link className={styles.primaryLink} href="/workspace">
            <ListPlus size={15} /> Initialiser ma veille
          </Link>
        ) : (
          <form className={styles.form} action={watchCompanyAction}>
            <input type="hidden" name="siren" value={siren} />
            <label>
              <span>Liste</span>
              <select name="watchlistId" defaultValue={defaultWatchlist.id}>
                {watchState.watchlists.map((watchlist) => (
                  <option key={watchlist.id} value={watchlist.id}>
                    {watchlist.name}{membershipIds.has(watchlist.id) ? " · suivie" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Contrôle</span>
              <select name="frequency" defaultValue={defaultMembership?.monitorFrequency || "daily"}>
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="manual">Manuel</option>
              </select>
            </label>
            <button type="submit">
              <Radar size={15} /> {defaultMembership ? "Mettre à jour" : "Surveiller"}
            </button>
          </form>
        )}
      </aside>
    </>
  );
}
