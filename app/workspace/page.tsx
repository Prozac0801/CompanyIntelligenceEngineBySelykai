import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Archive,
  Bell,
  Building2,
  Check,
  CheckCheck,
  LogOut,
  Plus,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth/server";
import {
  countUnreadWorkspaceAlerts,
  listWorkspaceInboxAlerts,
} from "@/lib/persistence/alert-repository";
import { listWatchlistCompanies } from "@/lib/persistence/watchlist-repository";
import { ensurePersonalWorkspace } from "@/lib/workspaces/bootstrap";
import type { AlertSeverity } from "@/types/workspace";
import {
  addCompanyToWatchlistAction,
  archiveAlertAction,
  createWatchlistAction,
  markAlertReadAction,
  markAllAlertsReadAction,
} from "./actions";
import { signOut } from "@/app/auth/actions";
import styles from "./workspace-v056.module.css";

export const dynamic = "force-dynamic";

function frequencyLabel(value: "daily" | "weekly" | "manual") {
  return value === "daily" ? "quotidien" : value === "weekly" ? "hebdomadaire" : "manuel";
}

function severityLabel(value: AlertSeverity) {
  if (value === "critical") return "critique";
  if (value === "high") return "élevée";
  if (value === "medium") return "moyenne";
  return "info";
}

function severityBadgeClass(value: AlertSeverity) {
  if (value === "critical") return styles.severityCritical;
  if (value === "high") return styles.severityHigh;
  if (value === "medium") return styles.severityMedium;
  return styles.severityInfo;
}

export default async function WorkspacePage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const { workspace, watchlists } = await ensurePersonalWorkspace({
    userId: session.user.id,
    userName: session.user.name,
  });
  const activeWatchlist = watchlists[0];

  const [companies, alerts, unreadCount] = await Promise.all([
    activeWatchlist
      ? listWatchlistCompanies(session.user.id, activeWatchlist.id)
      : Promise.resolve([]),
    listWorkspaceInboxAlerts({
      userId: session.user.id,
      workspaceId: workspace.id,
      limit: 20,
    }),
    countUnreadWorkspaceAlerts({
      userId: session.user.id,
      workspaceId: workspace.id,
    }),
  ]);

  return (
    <AppShell>
      <div className="workspace workspace-dashboard">
        <header className="workspace-account-header">
          <div>
            <p className="context-line">{workspace.name.toUpperCase()}</p>
            <h1>Veille entreprise</h1>
            <p className="lead">Surveillez les changements réellement observés et concentrez-vous sur les entreprises qui bougent.</p>
          </div>
          <form action={signOut}><button className="ghost-button" type="submit"><LogOut size={15} /> Déconnexion</button></form>
        </header>

        <section className="workspace-metrics">
          <div><Radar size={18} /><span>Entreprises suivies</span><strong>{companies.length}</strong></div>
          <div><Bell size={18} /><span>Alertes non lues</span><strong>{unreadCount}</strong></div>
          <div><ShieldCheck size={18} /><span>Isolation</span><strong>Workspace</strong></div>
        </section>

        <div className="workspace-columns">
          <section className="detail-panel workspace-watchlist-panel">
            <div className="panel-title-row">
              <h2><Building2 size={16} /> {activeWatchlist?.name || "Watchlist"}</h2>
              <span>{companies.length} société{companies.length > 1 ? "s" : ""}</span>
            </div>
            {activeWatchlist && (
              <form action={addCompanyToWatchlistAction} className="inline-add-form">
                <input type="hidden" name="watchlistId" value={activeWatchlist.id} />
                <input name="siren" inputMode="numeric" maxLength={9} placeholder="SIREN à surveiller" required />
                <select name="frequency" defaultValue="daily">
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="manual">Manuel</option>
                </select>
                <button type="submit"><Plus size={15} /> Ajouter</button>
              </form>
            )}
            <div className="watch-company-list">
              {companies.length ? companies.map((company) => (
                <Link href={`/company/${company.siren}`} key={`${company.watchlistId}-${company.companyId}`} className="watch-company-row">
                  <div><strong>{company.name}</strong><span className="mono">SIREN {company.siren}</span></div>
                  <div><span>{frequencyLabel(company.monitorFrequency)}</span><small>{company.nextCheckAt ? `prochain contrôle ${new Date(company.nextCheckAt).toLocaleString("fr-FR")}` : "pas de contrôle automatique"}</small></div>
                </Link>
              )) : <p className="empty-copy">Aucune entreprise suivie. Ajoutez un SIREN pour lancer la première observation.</p>}
            </div>
          </section>

          <section className="detail-panel workspace-alert-panel">
            <div className={styles.alertPanelHeader}>
              <h2><Bell size={16} /> Boîte d’alertes</h2>
              <div className={styles.alertPanelTools}>
                <span>{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</span>
                {unreadCount > 0 ? (
                  <form action={markAllAlertsReadAction}>
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <button className={styles.batchButton} type="submit"><CheckCheck size={13} /> Tout marquer lu</button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className={styles.alertList}>
              {alerts.length ? alerts.map((alert) => (
                <article
                  key={alert.id}
                  className={`${styles.alertCard} ${alert.status === "unread" ? styles.alertCardUnread : ""}`}
                >
                  <Link href={`/company/${alert.siren}`} className={styles.alertMain}>
                    <div className={styles.alertTitleLine}>
                      {alert.status === "unread" ? <span className={styles.unreadDot} aria-label="Non lue" /> : null}
                      <strong>{alert.title}</strong>
                    </div>
                    <span className={styles.alertCompany}>{alert.companyName}</span>
                    {alert.body ? <p className={styles.alertBody}>{alert.body}</p> : null}
                    <span className={styles.alertMeta}>
                      <span>{new Date(alert.createdAt).toLocaleString("fr-FR")}</span>
                      <b className={`${styles.severityBadge} ${severityBadgeClass(alert.severity)}`}>{severityLabel(alert.severity)}</b>
                      <span>{alert.status === "unread" ? "nouvelle" : "lue"}</span>
                    </span>
                  </Link>

                  <div className={styles.alertActions}>
                    {alert.status === "unread" ? (
                      <form action={markAlertReadAction}>
                        <input type="hidden" name="alertId" value={alert.id} />
                        <button className={styles.alertAction} type="submit" title="Marquer comme lue" aria-label="Marquer comme lue"><Check size={14} /></button>
                      </form>
                    ) : null}
                    <form action={archiveAlertAction}>
                      <input type="hidden" name="alertId" value={alert.id} />
                      <button className={`${styles.alertAction} ${styles.archiveAction}`} type="submit" title="Archiver" aria-label="Archiver"><Archive size={14} /></button>
                    </form>
                  </div>
                </article>
              )) : <p className={styles.emptyState}>Aucune alerte active. Les changements réellement détectés apparaîtront ici ; les éléments archivés ne polluent plus la boîte d’alertes.</p>}
            </div>
          </section>
        </div>

        <section className="detail-panel workspace-list-manager">
          <div className="panel-title-row"><h2>Vos listes</h2><span>{watchlists.length}</span></div>
          <div className="workspace-list-strip">
            {watchlists.map((watchlist) => <div key={watchlist.id}><strong>{watchlist.name}</strong><small>{watchlist.description || "Liste personnalisée"}</small></div>)}
          </div>
          <form action={createWatchlistAction} className="inline-add-form compact">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input name="name" placeholder="Nouvelle liste" required />
            <button type="submit"><Plus size={15} /> Créer</button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
