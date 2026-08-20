import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Building2, LogOut, Plus, Radar, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth/server";
import {
  listWatchlistCompanies,
  listWorkspaceAlerts,
} from "@/lib/persistence/watchlist-repository";
import { ensurePersonalWorkspace } from "@/lib/workspaces/bootstrap";
import { addCompanyToWatchlistAction, createWatchlistAction } from "./actions";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const { workspace, watchlists } = await ensurePersonalWorkspace({
    userId: session.user.id,
    userName: session.user.name,
  });
  const activeWatchlist = watchlists[0];
  const companies = activeWatchlist
    ? await listWatchlistCompanies(session.user.id, activeWatchlist.id)
    : [];
  const alerts = await listWorkspaceAlerts({
    userId: session.user.id,
    workspaceId: workspace.id,
    limit: 12,
  });

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
          <div><Bell size={18} /><span>Alertes</span><strong>{alerts.filter((item) => item.status === "unread").length}</strong></div>
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
                  <div><span>{company.monitorFrequency === "daily" ? "quotidien" : company.monitorFrequency === "weekly" ? "hebdomadaire" : "manuel"}</span><small>{company.nextCheckAt ? `prochain contrôle ${new Date(company.nextCheckAt).toLocaleString("fr-FR")}` : "pas de contrôle automatique"}</small></div>
                </Link>
              )) : <p className="empty-copy">Aucune entreprise suivie. Ajoutez un SIREN pour lancer la première observation.</p>}
            </div>
          </section>

          <section className="detail-panel workspace-alert-panel">
            <div className="panel-title-row"><h2><Bell size={16} /> Alertes récentes</h2><span>{alerts.length}</span></div>
            <div className="workspace-alert-list">
              {alerts.length ? alerts.map((alert) => (
                <Link href={`/company/${alert.siren}`} key={alert.id} className={`workspace-alert-row severity-${alert.severity}`}>
                  <div><strong>{alert.title}</strong><span>{alert.companyName}</span></div>
                  <small>{new Date(alert.createdAt).toLocaleString("fr-FR")}</small>
                </Link>
              )) : <p className="empty-copy">Aucune alerte. Elles apparaîtront lorsqu’un changement réel sera détecté sur une entreprise surveillée.</p>}
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
