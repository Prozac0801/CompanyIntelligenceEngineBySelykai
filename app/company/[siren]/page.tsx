import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleAlert,
  Code2,
  ExternalLink,
  Factory,
  FileSearch,
  Globe2,
  Landmark,
  MapPin,
  Newspaper,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ContactReveal } from "@/components/contact-reveal";
import { analyzeCompany } from "@/lib/intelligence/company-engine";
import {
  activityLabel,
  employeeBandLabel,
  formatFrenchDate,
  legalFormLabel,
} from "@/lib/intelligence/labels";
import { loadCompanyTimeline } from "@/lib/persistence/company-repository";
import { commercialReuseDecision } from "@/lib/providers";
import type { IntelligenceScoreId } from "@/types/company";

function formatCurrency(value?: number): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value?: number): string {
  if (value === undefined) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} %`;
}

function confidenceLabel(value: "low" | "medium" | "high") {
  return value === "high" ? "élevée" : value === "medium" ? "moyenne" : "faible";
}

function scoreIcon(id: IntelligenceScoreId) {
  if (id === "fit") return Target;
  if (id === "momentum") return TrendingUp;
  if (id === "access") return BriefcaseBusiness;
  if (id === "risk") return ShieldCheck;
  return BadgeCheck;
}

function opportunityLabel(status: "triggered" | "watch" | "not-determined") {
  if (status === "triggered") return "Déclencheur détecté";
  if (status === "watch") return "À surveiller";
  return "Non déterminée";
}

export default async function CompanyPage({ params }: { params: Promise<{ siren: string }> }) {
  const { siren } = await params;
  const analysis = await analyzeCompany(siren);
  if (!analysis) notFound();

  const { company, enrichment, score, signals, meta, facts, summary } = analysis;
  const timeline = meta.databaseConfigured ? await loadCompanyTimeline(siren) : [];
  const reuse = commercialReuseDecision(facts);
  const web = enrichment.web;
  const officialActivity = activityLabel(company.nafCode, company.activityLabel);
  const legalForm = legalFormLabel(company.legalForm);
  const employeeBand = employeeBandLabel(company.employeeBand);
  const detailedActiveEstablishments = company.establishments.filter((item) => item.active === true).length;
  const establishmentCoverage = company.openEstablishmentCount
    ? Math.min(100, Math.round((detailedActiveEstablishments / company.openEstablishmentCount) * 100))
    : undefined;
  const sourceEvidence = Array.from(
    new Map(
      [...company.evidence, ...facts.map((fact) => fact.evidence), ...enrichment.evidence].map((item) => [
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
      <div className="workspace company-workspace intelligence-v04 intelligence-v041">
        <Link className="back-link" href="/"><ArrowLeft size={16} /> Nouvelle recherche</Link>

        <header className="intelligence-hero-v04">
          <div className="intelligence-hero-main">
            <div className="company-kicker"><span className={`status-dot ${company.status}`} /> {company.status === "active" ? "Entreprise active" : "Statut à vérifier"}</div>
            <h1>{company.name}</h1>
            <p className="intelligence-headline">{summary.headline}</p>
            <div className="company-ids">
              <span className="mono">SIREN {company.siren}</span>
              {legalForm ? <span>{legalForm}</span> : null}
              {officialActivity ? <span>{officialActivity}</span> : null}
              {company.companyCategory ? <span>{company.companyCategory}</span> : null}
            </div>
          </div>
          <div className={`opportunity-decision ${score.opportunity.status}`}>
            <span>Décision commerciale</span>
            <strong>{opportunityLabel(score.opportunity.status)}</strong>
            {score.opportunity.value !== undefined ? <b>{score.opportunity.value}/100</b> : null}
            <p>{score.opportunity.reason}</p>
            <small>Confiance données : {score.basis.coveragePercent}%</small>
          </div>
        </header>

        <section className="what-matters-v04">
          <div className="what-matters-heading">
            <Sparkles size={18} />
            <div><span>EXECUTIVE INTELLIGENCE</span><h2>Ce qu’il faut retenir</h2></div>
          </div>
          <div className="matter-grid">
            <article className="matter-card strengths">
              <strong>Forces</strong>
              {summary.strengths.map((item) => <p key={item}><BadgeCheck size={15} />{item}</p>)}
            </article>
            <article className="matter-card vigilance">
              <strong>Points de vigilance</strong>
              {summary.vigilance.map((item) => <p key={item}><CircleAlert size={15} />{item}</p>)}
            </article>
            <article className="matter-card triggers">
              <strong>Déclencheurs récents</strong>
              {summary.triggers.length
                ? summary.triggers.map((item) => <p key={item}><Radar size={15} />{item}</p>)
                : <p><Activity size={15} />Aucun déclencheur récent suffisamment fiable</p>}
            </article>
          </div>
          <div className="next-best-action"><Target size={18} /><div><span>Next best action</span><strong>{summary.nextBestAction}</strong></div></div>
        </section>

        <section className="intelligence-score-strip" aria-label="Indicateurs Intelligence V0.4.1">
          {score.subscores.map((subscore) => {
            const Icon = scoreIcon(subscore.id);
            const value = subscore.value;
            return (
              <article className={`intelligence-score-card ${subscore.id}`} key={subscore.id}>
                <div><Icon size={16} /><span>{subscore.label}</span></div>
                <strong>{value === null ? "—" : value}</strong>
                <small>{subscore.status === "insufficient-data" ? "Données insuffisantes" : `confiance ${confidenceLabel(subscore.confidence)}`}</small>
                {value !== null ? <div className="mini-progress"><i style={{ width: `${value}%` }} /></div> : null}
                {subscore.id === "risk" ? <em>0 = faible exposition</em> : null}
              </article>
            );
          })}
        </section>

        <nav className="intelligence-tabs-v04" aria-label="Sections de l’analyse">
          <a href="#overview">Vue d’ensemble</a>
          <a href="#signals">Signaux</a>
          <a href="#finances">Finances</a>
          <a href="#organisation">Organisation</a>
          <a href="#digital">Digital</a>
          <a href="#contacts">Contacts</a>
          <a href="#timeline">Timeline</a>
          <a href="#sources">Sources</a>
        </nav>

        <section className="v04-section" id="overview">
          <div className="v04-section-heading"><span>01</span><div><h2>Vue d’ensemble</h2><p>Identité officielle et profil structurel.</p></div></div>
          <div className="company-grid-v04">
            <article className="detail-panel span-two">
              <div className="panel-title-row"><h3>Identité consolidée</h3><span>{facts.length} faits sourcés</span></div>
              <div className="fact-grid-v04">
                <div><MapPin size={17} /><span>Siège</span><strong>{company.address || "Non disponible"}</strong></div>
                <div><Factory size={17} /><span>Activité</span><strong>{officialActivity || company.nafCode || "Non disponible"}</strong></div>
                <div><Users size={17} /><span>Effectif</span><strong>{employeeBand || "Non renseigné"}</strong></div>
                <div><Building2 size={17} /><span>Établissements ouverts</span><strong>{company.openEstablishmentCount ?? "—"}</strong></div>
                <div><CalendarDays size={17} /><span>Création</span><strong>{formatFrenchDate(company.createdAt) || "—"}</strong></div>
                <div><Landmark size={17} /><span>Forme juridique</span><strong>{legalForm || company.legalForm || "—"}</strong></div>
              </div>
            </article>
            <article className="detail-panel">
              <div className="panel-title-row"><h3><ShieldCheck size={16} /> Cadre de prospection</h3><span>{reuse.status}</span></div>
              <div className={`reuse-status ${reuse.status}`}>
                <strong>{reuseTitle}</strong>
                <p>{reuse.reason}</p>
                {reuse.status === "allowed" ? <small>Le RGPD et les conditions de réutilisation restent applicables.</small> : null}
              </div>
            </article>
            <article className="detail-panel">
              <div className="panel-title-row"><h3>Qualité de l’analyse</h3><span>{score.basis.coveragePercent}%</span></div>
              <p className="analysis-method-copy">{score.basis.description}</p>
              <div className="coverage-list"><strong>Disponible</strong><span>{score.basis.evidenceFamilies.join(" · ")}</span></div>
              <div className="coverage-list missing"><strong>À compléter</strong><span>{score.basis.missingFamilies.join(" · ") || "Aucune famille majeure"}</span></div>
            </article>
          </div>
        </section>

        <section className="v04-section" id="signals">
          <div className="v04-section-heading"><span>02</span><div><h2>Signaux & événements</h2><p>Ce qui vient de bouger ou mérite une attention immédiate.</p></div></div>
          <div className="company-grid-v04">
            <article className="detail-panel span-two">
              <div className="panel-title-row"><h3><FileSearch size={16} /> BODACC</h3><span>{enrichment.legalEvents.length} événement(s)</span></div>
              {enrichment.legalEvents.length ? (
                <div className="legal-event-list">
                  {enrichment.legalEvents.slice(0, 12).map((event) => (
                    <div className={`legal-event ${event.risk}`} key={event.id}>
                      <span className="legal-event-date">{formatFrenchDate(event.date)}</span>
                      <div>
                        <strong>{event.title}</strong>
                        {event.description ? <p>{event.description}</p> : null}
                        <small>{[event.family, event.city].filter(Boolean).join(" · ") || "BODACC / DILA"}</small>
                      </div>
                      {event.url ? <a href={event.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a> : null}
                    </div>
                  ))}
                </div>
              ) : <p className="empty-copy">Aucune annonce BODACC retrouvée dans la fenêtre chargée.</p>}
            </article>
            <article className="detail-panel">
              <div className="panel-title-row"><h3><Radar size={16} /> Signaux moteur</h3><span>{signals.length}</span></div>
              <div className="simple-list signal-list">
                {signals.length ? signals.map((signal) => (
                  <div key={`${signal.type}-${signal.label}`}><strong>{signal.label}</strong><span>{signal.reason} · force {signal.strength}/100</span></div>
                )) : <p>Aucun changement différentiel depuis l’observation précédente.</p>}
              </div>
            </article>
            <article className="detail-panel">
              <div className="panel-title-row"><h3><Newspaper size={16} /> Actualités</h3><span>{enrichment.news.length}</span></div>
              {enrichment.news.length ? enrichment.news.slice(0, 4).map((item) => (
                <a className="news-compact" href={item.url} target="_blank" rel="noreferrer" key={item.url}><strong>{item.title}</strong><small>{item.source || "Source web"}</small></a>
              )) : <p className="empty-copy">Source actualités non disponible ou aucun article pertinent retenu.</p>}
            </article>
          </div>
        </section>

        <section className="v04-section" id="finances">
          <div className="v04-section-heading"><span>03</span><div><h2>Finances</h2><p>Lecture des comptes publics disponibles, sans extrapolation de solvabilité.</p></div></div>
          <article className="detail-panel financial-intelligence-v04">
            <div className="panel-title-row"><h3><BarChart3 size={16} /> Exercice {summary.financial.year || "—"}</h3><span className={`financial-assessment ${summary.financial.assessment}`}>{summary.financial.assessment}</span></div>
            <div className="financial-kpis-v04">
              <div><span>Chiffre d’affaires</span><strong>{formatCurrency(summary.financial.revenue)}</strong><small>{summary.financial.revenueGrowthPercent !== undefined ? `vs précédent ${formatPercent(summary.financial.revenueGrowthPercent)}` : "historique insuffisant"}</small></div>
              <div><span>Résultat net</span><strong>{formatCurrency(summary.financial.netIncome)}</strong><small>{summary.financial.netIncomeGrowthPercent !== undefined ? `vs précédent ${formatPercent(summary.financial.netIncomeGrowthPercent)}` : "historique insuffisant"}</small></div>
              <div><span>Marge nette</span><strong>{summary.financial.netMarginPercent !== undefined ? `${summary.financial.netMarginPercent.toFixed(2)} %` : "—"}</strong><small>résultat net / CA</small></div>
            </div>
            <div className="financial-notes">{summary.financial.notes.map((note) => <span key={note}>{note}</span>)}</div>
          </article>
        </section>

        <section className="v04-section" id="organisation">
          <div className="v04-section-heading"><span>04</span><div><h2>Organisation</h2><p>Gouvernance et implantation opérationnelle.</p></div></div>
          <div className="company-grid-v04">
            <article className="detail-panel">
              <div className="panel-title-row"><h3>Dirigeants publics</h3><span>{company.executives.length}</span></div>
              <div className="simple-list">
                {company.executives.length ? company.executives.slice(0, 12).map((executive, index) => (
                  <div key={`${executive.name}-${index}`}><strong>{executive.name}</strong><span>{executive.role}</span></div>
                )) : <p>Aucun dirigeant retourné par cette source.</p>}
              </div>
            </article>
            <article className="detail-panel span-two establishment-panel-v041">
              <div className="panel-title-row"><h3>Établissements</h3><span>RNE + Recherche Entreprises</span></div>
              <div className="establishment-summary-v041">
                <div><strong>{company.openEstablishmentCount ?? "—"}</strong><span>ouverts selon l’unité légale</span></div>
                <div><strong>{detailedActiveEstablishments}</strong><span>ouverts détaillés par le RNE</span></div>
                <div><strong>{company.establishments.length}</strong><span>fiches détaillées chargées</span></div>
                <div><strong>{establishmentCoverage !== undefined ? `${establishmentCoverage}%` : "—"}</strong><span>couverture des ouverts</span></div>
              </div>
              <div className="establishment-grid-v04">
                {company.establishments.length ? company.establishments.slice(0, 50).map((establishment, index) => (
                  <div className={establishment.active === false ? "is-closed" : ""} key={`${establishment.siret || establishment.address}-${index}`}>
                    <div className="establishment-card-head-v041">
                      <strong>{establishment.city || establishment.address || "Établissement"}</strong>
                      <span className={`establishment-state-v041 ${establishment.active === false ? "closed" : "active"}`}>{establishment.active === false ? "fermé" : "actif"}</span>
                    </div>
                    <span>{establishment.address || "Adresse non disponible"}</span>
                    <small>{establishment.siret ? `SIRET ${establishment.siret}` : "SIRET non disponible"}{establishment.headOffice ? " · siège" : ""}{establishment.nafCode ? ` · NAF ${establishment.nafCode}` : ""}</small>
                  </div>
                )) : <p>Aucun établissement détaillé retourné par les sources officielles.</p>}
              </div>
              {(company.openEstablishmentCount || 0) > detailedActiveEstablishments ? (
                <p className="data-caveat">Le RNE détaille actuellement {detailedActiveEstablishments} établissement(s) ouvert(s) sur {company.openEstablishmentCount} annoncé(s) par l’unité légale. La couverture restante est signalée comme manquante, jamais reconstituée artificiellement.</p>
              ) : (
                <p className="data-confirmed-v041"><BadgeCheck size={14} /> Les établissements ouverts annoncés sont couverts par les fiches officielles détaillées chargées.</p>
              )}
            </article>
          </div>
        </section>

        <section className="v04-section" id="digital">
          <div className="v04-section-heading"><span>05</span><div><h2>Digital</h2><p>Présence web affichée avec son niveau de recoupement.</p></div></div>
          <article className="detail-panel web-intelligence-v04">
            <div className="panel-title-row">
              <h3><Globe2 size={16} /> Présence web</h3>
              <span className={`web-verification-v041 ${web?.domainVerified ? "verified" : web?.domain ? "pending" : "missing"}`}>
                {web?.domainVerified ? "domaine recoupé" : web?.domain ? "domaine à confirmer" : "non résolu"}
              </span>
            </div>
            {web ? (
              <>
                <div className="web-domain-v04">
                  <div>
                    <strong>{web.domain || "Domaine non résolu"}</strong>
                    <p>{officialActivity || "Activité officielle non libellée"}</p>
                    {web.domain && !web.domainVerified ? <small className="web-caveat-v041">Candidat proposé par Hunter ; aucune donnée commerciale dérivée n’est utilisée tant qu’une seconde source ne confirme pas ce domaine.</small> : null}
                    {web.domainVerified ? <small className="web-proof-v041"><BadgeCheck size={13} /> Domaine confirmé indépendamment par Hunter + SERP.</small> : null}
                  </div>
                  {web.websiteUrl ? <a href={web.websiteUrl} target="_blank" rel="noreferrer" aria-label="Ouvrir le site candidat"><ExternalLink size={16} /></a> : null}
                </div>
                {web.description ? <blockquote className="serp-snippet"><strong>Extrait SERP recoupé</strong><br />{web.description}</blockquote> : null}
                <div className="web-kpis">
                  <div><span>SERP</span><strong>{web.serpPosition ? `#${web.serpPosition}` : "—"}</strong></div>
                  <div><span>Emails génériques validés</span><strong>{web.genericEmails.length}</strong></div>
                  <div><span>Téléphones publics validés</span><strong>{web.phoneNumbers.length}</strong></div>
                  <div><span>Technologies sur domaine validé</span><strong>{web.technologies.length}</strong></div>
                </div>
                {web.technologies.length ? <div className="tech-cloud"><Code2 size={15} />{web.technologies.slice(0, 20).map((technology) => <span key={technology}>{technology}</span>)}</div> : null}
                {web.linkedinVerified && web.linkedinHandle ? (
                  <a className="verified-linkedin-v041" href={`https://www.linkedin.com/${web.linkedinHandle}`} target="_blank" rel="noreferrer"><BadgeCheck size={14} /> LinkedIn recoupé <ExternalLink size={13} /></a>
                ) : null}
              </>
            ) : <p className="empty-copy">Aucune présence web suffisamment fiable résolue.</p>}
          </article>
        </section>

        <section className="v04-section" id="contacts">
          <div className="v04-section-heading"><span>06</span><div><h2>Contacts</h2><p>Enrichissement professionnel uniquement à la demande et sur domaine recoupé.</p></div></div>
          <article className="detail-panel">
            {web?.domain && !web.domainVerified ? <p className="data-caveat">Le domaine candidat doit être recoupé avant tout enrichissement de contacts. Aucun crédit Hunter Contacts ne sera consommé sur un domaine non vérifié.</p> : null}
            <ContactReveal siren={company.siren} domain={web?.domainVerified ? web.domain : undefined} />
          </article>
        </section>

        <section className="v04-section" id="timeline">
          <div className="v04-section-heading"><span>07</span><div><h2>Timeline</h2><p>Historique officiel + changements détectés par Selykai.</p></div></div>
          <div className="timeline-v04">
            {timeline.slice(0, 12).map((event, index) => (
              <div key={`internal-${event.type}-${event.observedAt}-${index}`}><span>{formatFrenchDate(event.observedAt)}</span><i /><div><strong>{event.title}</strong><p>{event.description}</p><small>Selykai diff engine</small></div></div>
            ))}
            {enrichment.legalEvents.slice(0, 15).map((event) => (
              <div key={`bodacc-${event.id}`}><span>{formatFrenchDate(event.date)}</span><i className={event.risk} /><div><strong>{event.title}</strong>{event.description ? <p>{event.description}</p> : null}<small>{event.family} · BODACC / DILA</small></div></div>
            ))}
            {!timeline.length && !enrichment.legalEvents.length ? <p className="empty-copy">Aucun événement exploitable pour le moment.</p> : null}
          </div>
        </section>

        <section className="v04-section" id="sources">
          <div className="v04-section-heading"><span>08</span><div><h2>Sources & méthode</h2><p>Chaque information reste liée à une provenance et une confiance.</p></div></div>
          <div className="source-grid-v04">
            {sourceEvidence.map((item) => (
              <article key={item.providerId || item.provider}><strong>{item.provider}</strong><span>{item.kind}</span><p>Observé le {new Date(item.observedAt).toLocaleString("fr-FR")}</p><small>Confiance {Math.round(item.confidence * 100)}%</small>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink size={12} /></a> : null}</article>
            ))}
          </div>
          <div className="method-footer-v04"><Activity size={15} /><span><strong>{score.version}</strong> · engine {meta.engineVersion} · {score.basis.benchmarkDescription}</span></div>
        </section>
      </div>
    </AppShell>
  );
}