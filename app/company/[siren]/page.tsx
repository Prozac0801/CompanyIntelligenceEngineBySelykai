import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Factory,
  History,
  MapPin,
  Radar,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { analyzeCompany } from "@/lib/intelligence/company-engine";
import { loadCompanyTimeline } from "@/lib/persistence/company-repository";
import { commercialReuseDecision } from "@/lib/providers";

export default async function CompanyPage({ params }: { params: Promise<{ siren: string }> }) {
  const { siren } = await params;
  const analysis = await analyzeCompany(siren);
  if (!analysis) notFound();

  const { company, score, signals, meta, facts } = analysis;
  const timeline = meta.databaseConfigured ? await loadCompanyTimeline(siren) : [];
  const reuse = commercialReuseDecision(facts);
  const sourceEvidence = Array.from(
    new Map(
      [...company.evidence, ...facts.map((fact) => fact.evidence)].map((item) => [
        item.providerId || item.provider,
        item,
      ]),
    ).values(),
  );

  const reuseTitle =
    reuse.status === "blocked"
      ? "Prospection bloquée"
      : reuse.status === "allowed"
        ? "Aucune opposition RNE détectée"
        : "Statut de prospection non vérifié";

  return (
    <AppShell>
      <div className="workspace company-workspace">
        <Link className="back-link" href="/"><ArrowLeft size={16} /> Nouvelle recherche</Link>
        <header className="company-header">
          <div>
            <div className="company-kicker"><span className={`status-dot ${company.status}`} /> {company.status === "active" ? "Entreprise active" : "Statut à vérifier"}</div>
            <h1>{company.name}</h1>
            <div className="company-ids">
              <span className="mono">SIREN {company.siren}</span>
              {company.nafCode && <span>NAF {company.nafCode}</span>}
              <span className="mono">engine {meta.engineVersion}</span>
            </div>
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
            <p className="score-warning">Ce score reste volontairement prudent : les signaux web, financiers et recrutement ne sont pas encore activés.</p>
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
            <div className="panel-title-row"><h2><ShieldCheck size={16} /> Cadre de prospection</h2><span>{reuse.status}</span></div>
            <div className={`reuse-status ${reuse.status}`}>
              <strong>{reuseTitle}</strong>
              <p>{reuse.reason}</p>
              {reuse.status === "allowed" && <small>La licence de réutilisation et le RGPD restent applicables ; ce statut n’est pas une autorisation générale de démarchage.</small>}
            </div>
          </section>

          <section className="detail-panel">
            <div className="panel-title-row"><h2><Radar size={16} /> Signaux détectés</h2><span>{signals.length}</span></div>
            <div className="simple-list signal-list">
              {signals.length ? signals.map((signal) => (
                <div key={`${signal.type}-${signal.label}`}>
                  <strong>{signal.label}</strong>
                  <span>{signal.reason} · force {signal.strength}/100</span>
                </div>
              )) : (
                <p>{meta.databaseConfigured ? "Aucun nouveau signal sur cette observation." : "La détection de changement sera active dès la connexion de Neon."}</p>
              )}
            </div>
          </section>

          <section className="detail-panel">
            <div className="panel-title-row"><h2><History size={16} /> Timeline</h2><span>{timeline.length}</span></div>
            <div className="simple-list timeline-list">
              {timeline.length ? timeline.slice(0, 8).map((event, index) => (
                <div key={`${event.type}-${event.observedAt}-${index}`}>
                  <strong>{event.title}</strong>
                  <span>{new Date(event.observedAt).toLocaleDateString("fr-FR")} · {event.description}</span>
                </div>
              )) : <p>Aucun changement historisé pour le moment.</p>}
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
          {sourceEvidence.map((item) => (
            <div key={item.providerId || item.provider}>
              <strong>{item.provider}</strong>
              <small>observé {new Date(item.observedAt).toLocaleString("fr-FR")} · confiance {Math.round(item.confidence * 100)}%</small>
            </div>
          ))}
        </footer>
      </div>
    </AppShell>
  );
}
