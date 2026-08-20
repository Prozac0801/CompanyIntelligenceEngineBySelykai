import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Code2,
  ExternalLink,
  Factory,
  Globe2,
  History,
  Landmark,
  Mail,
  MapPin,
  Newspaper,
  Phone,
  Radar,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ContactReveal } from "@/components/contact-reveal";
import { analyzeCompany } from "@/lib/intelligence/company-engine";
import { loadCompanyTimeline } from "@/lib/persistence/company-repository";
import { commercialReuseDecision } from "@/lib/providers";

const EMPLOYEE_BANDS: Record<string, string> = {
  "00": "0 salarié",
  "01": "1–2 salariés",
  "02": "3–5 salariés",
  "03": "6–9 salariés",
  "11": "10–19 salariés",
  "12": "20–49 salariés",
  "21": "50–99 salariés",
  "22": "100–199 salariés",
  "31": "200–249 salariés",
  "32": "250–499 salariés",
  "41": "500–999 salariés",
  "42": "1 000–1 999 salariés",
  "51": "2 000–4 999 salariés",
  "52": "5 000–9 999 salariés",
  "53": "10 000+ salariés",
};

function formatCurrency(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function latestFinancialSnapshot(raw: unknown): {
  year: string;
  revenue?: string;
  result?: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([, value]) => value && typeof value === "object")
    .sort(([a], [b]) => b.localeCompare(a));
  const latest = entries[0];
  if (!latest) return null;
  const [year, value] = latest;
  const data = value as Record<string, unknown>;
  return {
    year,
    revenue: formatCurrency(data.ca ?? data.chiffre_affaires),
    result: formatCurrency(data.resultat_net ?? data.resultat),
  };
}

function confidenceLabel(value: "low" | "medium" | "high") {
  return value === "high" ? "élevée" : value === "medium" ? "moyenne" : "faible";
}

export default async function CompanyPage({ params }: { params: Promise<{ siren: string }> }) {
  const { siren } = await params;
  const analysis = await analyzeCompany(siren);
  if (!analysis) notFound();

  const { company, enrichment, score, signals, meta, facts } = analysis;
  const timeline = meta.databaseConfigured ? await loadCompanyTimeline(siren) : [];
  const reuse = commercialReuseDecision(facts);
  const financial = latestFinancialSnapshot(company.rawFinancials);
  const web = enrichment.web;
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
      <div className="workspace company-workspace intelligence-v03">
        <Link className="back-link" href="/"><ArrowLeft size={16} /> Nouvelle recherche</Link>

        <header className="company-header company-header-v03">
          <div>
            <div className="company-kicker"><span className={`status-dot ${company.status}`} /> {company.status === "active" ? "Entreprise active" : "Statut à vérifier"}</div>
            <h1>{company.name}</h1>
            <div className="company-ids">
              <span className="mono">SIREN {company.siren}</span>
              {company.nafCode ? <span>NAF {company.nafCode}</span> : null}
              {company.companyCategory ? <span>{company.companyCategory}</span> : null}
              <span className="mono">engine {meta.engineVersion}</span>
            </div>
          </div>
          <div className="score-orb score-orb-v03">
            <span>Opportunity</span>
            <strong>{score.value}</strong>
            <small>/100 · confiance {confidenceLabel(score.confidence)}</small>
          </div>
        </header>

        <section className="score-basis-banner">
          <div className="score-basis-icon"><BarChart3 size={20} /></div>
          <div>
            <strong>Ce score n’est pas un percentile.</strong>
            <p>{score.basis.description}</p>
          </div>
          <div className="coverage-meter">
            <span>Couverture des preuves</span>
            <strong>{score.basis.coveragePercent}%</strong>
            <div><i style={{ width: `${score.basis.coveragePercent}%` }} /></div>
          </div>
        </section>

        <section className="subscore-grid" aria-label="Sous-scores Opportunity">
          {score.subscores.map((subscore) => {
            const Icon = subscore.id === "health"
              ? ShieldCheck
              : subscore.id === "growth"
                ? TrendingUp
                : subscore.id === "digital"
                  ? Globe2
                  : BriefcaseBusiness;
            return (
              <div className="subscore-card" key={subscore.id}>
                <div className="subscore-top"><Icon size={17} /><span>{Math.round(subscore.weight * 100)}% du score</span></div>
                <strong>{subscore.value}</strong>
                <h3>{subscore.label}</h3>
                <small>confiance {confidenceLabel(subscore.confidence)}</small>
                <div className="mini-progress"><i style={{ width: `${subscore.value}%` }} /></div>
              </div>
            );
          })}
        </section>

        <div className="company-grid company-grid-v03">
          <section className="detail-panel primary-facts span-two">
            <div className="panel-title-row"><h2>Identité consolidée</h2><span>{facts.length} faits sourcés</span></div>
            <div className="fact-grid fact-grid-v03">
              <div><MapPin size={17} /><span>Siège</span><strong>{company.address || "Non disponible"}</strong></div>
              <div><Factory size={17} /><span>Activité</span><strong>{company.activityLabel || company.nafCode || "Non disponible"}</strong></div>
              <div><Users size={17} /><span>Effectif</span><strong>{company.employeeBand ? EMPLOYEE_BANDS[company.employeeBand] || `Tranche ${company.employeeBand}` : "Non renseigné"}</strong></div>
              <div><Building2 size={17} /><span>Établissements ouverts</span><strong>{company.openEstablishmentCount ?? "—"}</strong></div>
              <div><CalendarDays size={17} /><span>Création</span><strong>{company.createdAt || "—"}</strong></div>
              <div><Landmark size={17} /><span>Forme juridique</span><strong>{company.legalForm || "—"}</strong></div>
            </div>
          </section>

          <section className="detail-panel web-intelligence-panel">
            <div className="panel-title-row"><h2><Globe2 size={16} /> Intelligence web</h2><span>{web?.domain ? "résolu" : "partiel"}</span></div>
            {web ? (
              <div className="web-intelligence">
                <div className="web-domain-row">
                  <div>
                    <strong>{web.domain || "Domaine non résolu"}</strong>
                    {web.description ? <p>{web.description}</p> : null}
                  </div>
                  {web.websiteUrl ? <a href={web.websiteUrl} target="_blank" rel="noreferrer" aria-label="Ouvrir le site"><ExternalLink size={16} /></a> : null}
                </div>
                <div className="web-kpis">
                  <div><span>Secteur web</span><strong>{web.industry || web.sector || "—"}</strong></div>
                  <div><span>Effectif web</span><strong>{web.employeeEstimate || "—"}</strong></div>
                  <div><span>SERP</span><strong>{web.serpPosition ? `#${web.serpPosition}` : "—"}</strong></div>
                  <div><span>Traffic rank</span><strong>{web.trafficRank || "—"}</strong></div>
                </div>
                {web.serpSnippet ? <blockquote className="serp-snippet">{web.serpSnippet}</blockquote> : null}
                {web.technologies.length ? (
                  <div className="tech-cloud"><Code2 size={15} />{web.technologies.slice(0, 14).map((technology) => <span key={technology}>{technology}</span>)}</div>
                ) : null}
                <div className="contactability-strip">
                  <div><Phone size={14} /><strong>{web.phoneNumbers.length}</strong><span>téléphone(s) public(s)</span></div>
                  <div><Mail size={14} /><strong>{web.genericEmails.length}</strong><span>email(s) générique(s)</span></div>
                </div>
              </div>
            ) : <p className="empty-copy">Aucune présence web suffisamment fiable n’a été résolue sur cette observation.</p>}
          </section>

          <section className="detail-panel score-panel">
            <div className="panel-title-row"><h2>Pourquoi ce score ?</h2><span className="mono">{score.version}</span></div>
            <p className="score-warning">Les facteurs ci-dessous sont des contributions pondérées au score composite. Ils ne représentent pas un classement national.</p>
            <div className="factor-list">
              {score.factors.length ? score.factors.slice(0, 10).map((item) => (
                <div key={`${item.group}-${item.label}-${item.impact}`}>
                  <CheckCircle2 size={16} />
                  <span><strong>{item.label}</strong><small>{item.evidence}</small></span>
                  <b>+{item.impact}</b>
                </div>
              )) : <span>Aucun facteur suffisamment documenté.</span>}
            </div>
            <div className="benchmark-note">
              <Activity size={15} />
              <span><strong>Benchmark secteur/taille :</strong> {score.basis.benchmarkDescription}</span>
            </div>
          </section>

          <section className="detail-panel financial-panel">
            <div className="panel-title-row"><h2><BarChart3 size={16} /> Finances publiques</h2><span>{financial?.year || "—"}</span></div>
            {financial ? (
              <div className="financial-kpis">
                <div><span>Chiffre d’affaires</span><strong>{financial.revenue || "Non disponible"}</strong></div>
                <div><span>Résultat net</span><strong>{financial.result || "Non disponible"}</strong></div>
                <small>Données publiques disponibles via la source entreprise. Elles ne constituent pas une analyse de solvabilité.</small>
              </div>
            ) : <p className="empty-copy">Aucun exercice financier exploitable retourné par les sources actuelles.</p>}
          </section>

          <section className="detail-panel news-panel span-two">
            <div className="panel-title-row"><h2><Newspaper size={16} /> Actualités récentes</h2><span>{enrichment.news.length}</span></div>
            {enrichment.news.length ? (
              <div className="news-grid">
                {enrichment.news.map((item) => (
                  <a className="news-card" href={item.url} target="_blank" rel="noreferrer" key={`${item.url}-${item.title}`}>
                    <div><strong>{item.title}</strong><ExternalLink size={14} /></div>
                    {item.description ? <p>{item.description}</p> : null}
                    <small>{[item.source, item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("fr-FR") : null].filter(Boolean).join(" · ")}</small>
                  </a>
                ))}
              </div>
            ) : <p className="empty-copy">Aucune actualité suffisamment pertinente n’a été retenue pour cette observation.</p>}
          </section>

          <section className="detail-panel span-two">
            <div className="panel-title-row"><h2><BriefcaseBusiness size={16} /> Contacts professionnels</h2><span>à la demande</span></div>
            <ContactReveal siren={company.siren} domain={web?.domain} />
          </section>

          <section className="detail-panel">
            <div className="panel-title-row"><h2><ShieldCheck size={16} /> Cadre de prospection</h2><span>{reuse.status}</span></div>
            <div className={`reuse-status ${reuse.status}`}>
              <strong>{reuseTitle}</strong>
              <p>{reuse.reason}</p>
              {reuse.status === "allowed" ? <small>La licence de réutilisation et le RGPD restent applicables ; ce statut n’est pas une autorisation générale de démarchage.</small> : null}
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
              )) : <p>Aucun nouveau changement factuel sur cette observation. L’absence de signal ne signifie pas absence d’opportunité.</p>}
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
              )) : <p>Aucun changement historisé pour le moment. Le moteur a besoin d’au moins deux observations différentes pour détecter une évolution.</p>}
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

        <section className="evidence-coverage-panel">
          <div><strong>Familles de preuves disponibles</strong><span>{score.basis.evidenceFamilies.join(" · ") || "—"}</span></div>
          <div><strong>À compléter</strong><span>{score.basis.missingFamilies.join(" · ") || "Couverture complète"}</span></div>
        </section>

        <footer className="evidence-footer evidence-footer-v03">
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
