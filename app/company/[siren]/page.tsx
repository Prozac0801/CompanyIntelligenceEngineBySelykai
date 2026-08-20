import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, Factory, MapPin, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCompanyBySiren } from "@/lib/providers";
import { computeOpportunityScore } from "@/lib/scoring/opportunity";

export default async function CompanyPage({ params }: { params: Promise<{ siren: string }> }) {
  const { siren } = await params;
  const company = await getCompanyBySiren(siren);
  if (!company) notFound();
  const score = computeOpportunityScore(company);

  return (
    <AppShell>
      <div className="workspace company-workspace">
        <Link className="back-link" href="/"><ArrowLeft size={16} /> Nouvelle recherche</Link>
        <header className="company-header">
          <div>
            <div className="company-kicker"><span className={`status-dot ${company.status}`} /> {company.status === "active" ? "Entreprise active" : "Statut à vérifier"}</div>
            <h1>{company.name}</h1>
            <div className="company-ids"><span className="mono">SIREN {company.siren}</span>{company.nafCode && <span>NAF {company.nafCode}</span>}</div>
          </div>
          <div className="score-orb">
            <span>Opportunity</span>
            <strong>{score.value}</strong>
            <small>/100 · confiance {score.confidence}</small>
          </div>
        </header>

        <div className="company-grid">
          <section className="detail-panel primary-facts">
            <h2>Identité consolidée</h2>
            <div className="fact-grid">
              <div><MapPin size={17} /><span>Siège</span><strong>{company.address || "Non disponible"}</strong></div>
              <div><Factory size={17} /><span>Activité</span><strong>{company.activityLabel || company.nafCode || "Non disponible"}</strong></div>
              <div><Users size={17} /><span>Employeur</span><strong>{company.employer ? "Oui" : "Non renseigné"}</strong></div>
              <div><Building2 size={17} /><span>Établissements ouverts</span><strong>{company.openEstablishmentCount ?? "—"}</strong></div>
              <div><CalendarDays size={17} /><span>Création</span><strong>{company.createdAt || "—"}</strong></div>
              <div><ShieldCheck size={17} /><span>Preuve principale</span><strong>Source publique officielle</strong></div>
            </div>
          </section>

          <section className="detail-panel score-panel">
            <div className="panel-title-row"><h2>Pourquoi ce score ?</h2><span className="mono">{score.version}</span></div>
            <p className="score-warning">Ce pré-score V0.1 n’est pas une vérité commerciale : il ne s’appuie encore que sur les faits disponibles en open data.</p>
            <div className="factor-list">
              {score.factors.length ? score.factors.map((factor) => (
                <div key={`${factor.label}-${factor.impact}`}>
                  <CheckCircle2 size={16} />
                  <span><strong>{factor.label}</strong><small>{factor.evidence}</small></span>
                  <b>+{factor.impact}</b>
                </div>
              )) : <span>Aucun signal suffisamment documenté.</span>}
            </div>
          </section>

          <section className="detail-panel">
            <div className="panel-title-row"><h2>Dirigeants publics</h2><span>{company.executives.length}</span></div>
            <div className="simple-list">
              {company.executives.length ? company.executives.slice(0, 8).map((executive, index) => (
                <div key={`${executive.name}-${index}`}><strong>{executive.name}</strong><span>{executive.role}</span></div>
              )) : <p>Aucun dirigeant retourné par cette source.</p>}
            </div>
          </section>

          <section className="detail-panel">
            <div className="panel-title-row"><h2>Établissements détectés</h2><span>{company.establishments.length}</span></div>
            <div className="simple-list">
              {company.establishments.slice(0, 8).map((establishment, index) => (
                <div key={`${establishment.siret || establishment.address}-${index}`}>
                  <strong>{establishment.address || establishment.siret || "Établissement"}</strong>
                  <span>{establishment.siret ? `SIRET ${establishment.siret}` : establishment.active ? "Actif" : "Statut inconnu"}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="evidence-footer">
          <span>PROVENANCE</span>
          {company.evidence.map((item) => (
            <div key={item.provider}><strong>{item.provider}</strong><small>observé {new Date(item.observedAt).toLocaleString("fr-FR")} · confiance {Math.round(item.confidence * 100)}%</small></div>
          ))}
        </footer>
      </div>
    </AppShell>
  );
}
